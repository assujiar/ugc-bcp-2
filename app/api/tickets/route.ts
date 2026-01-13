import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";

// GET /api/tickets - List tickets with filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const search = searchParams.get("search") || "";
    const ticketType = searchParams.get("ticket_type") || "";
    const status = searchParams.get("status") || "";
    const deptTarget = searchParams.get("dept_target") || "";
    const sortBy = searchParams.get("sortBy") || "created_at";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Check if user is Ops - they should use masked view
    const isOps = [
      "EXIM Ops (operation)",
      "domestics Ops (operation)",
      "Import DTD Ops (operation)",
      "traffic & warehous (operation)",
    ].includes(profile.role_name);

    // Build query - use masked view for Ops on inquiry tariff
    let query;
    if (isOps && (!ticketType || ticketType === "inquiry tariff")) {
      // Use masked view for Ops
      query = supabase
        .from("v_ops_rfqs_masked")
        .select("*", { count: "exact" });
    } else {
      // Regular tickets query
      query = supabase
        .from("tickets")
        .select(`
          *,
          created_by_profile:profiles!tickets_created_by_fkey (full_name, role_name),
          assigned_to_profile:profiles!tickets_assigned_to_fkey (full_name, role_name),
          customers (company_name)
        `, { count: "exact" });
    }

    // Apply filters
    if (search) {
      query = query.or(`ticket_id.ilike.%${search}%,subject.ilike.%${search}%`);
    }
    if (ticketType) {
      query = query.eq("ticket_type", ticketType);
    }
    if (status) {
      // Handle both inquiry_status and ticket_status
      if (ticketType === "inquiry tariff") {
        query = query.eq("inquiry_status", status);
      } else {
        query = query.eq("ticket_status", status);
      }
    }
    if (deptTarget) {
      query = query.eq("dept_target", deptTarget);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching tickets:", error);
      // Return empty result if table doesn't exist (graceful degradation)
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return NextResponse.json({
          data: [],
          pagination: {
            page,
            pageSize,
            total: 0,
            totalPages: 0,
          },
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    console.error("Error in GET /api/tickets:", error);
    // Return empty result on any error (graceful degradation)
    return NextResponse.json({
      data: [],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      },
    });
  }
}

// POST /api/tickets - Create ticket
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Director is read-only
    if (profile.role_name === "Director") {
      return NextResponse.json({ error: "Director has read-only access" }, { status: 403 });
    }

    const body = await request.json();
    const {
      ticket_type,
      dept_target,
      service_code,
      subject,
      description,
      assigned_to,
      related_lead_id,
      related_customer_id,
      // RFQ specific fields
      origin_address,
      origin_city,
      origin_country,
      destination_address,
      destination_city,
      destination_country,
      cargo_category,
      cargo_qty,
      cargo_dimensions,
      cargo_weight,
      scope_of_work,
    } = body;

    // Validate required fields
    if (!ticket_type || !dept_target || !subject) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate ticket type
    const validTypes = ["inquiry tariff", "general request", "request pickup", "request delivery"];
    if (!validTypes.includes(ticket_type)) {
      return NextResponse.json({ error: "Invalid ticket type" }, { status: 400 });
    }

    // Create ticket
    // Note: Audit logging is now handled by database trigger (trg_audit_tickets)
    const { data: ticket, error } = await supabase
      .from("tickets")
      .insert({
        ticket_type,
        dept_target,
        service_code: service_code || null,
        created_by: profile.user_id,
        assigned_to: assigned_to || null,
        related_lead_id: related_lead_id || null,
        related_customer_id: related_customer_id || null,
        subject,
        description: description || null,
        origin_address: origin_address || null,
        origin_city: origin_city || null,
        origin_country: origin_country || null,
        destination_address: destination_address || null,
        destination_city: destination_city || null,
        destination_country: destination_country || null,
        cargo_category: cargo_category || null,
        cargo_qty: cargo_qty || null,
        cargo_dimensions: cargo_dimensions || null,
        cargo_weight: cargo_weight || null,
        scope_of_work: scope_of_work || null,
        need_customer_masking: related_lead_id ? true : false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating ticket:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create SLA event for ticket opened (keep this manual for now since SLA trigger is on messages)
    await supabase.from("sla_events").insert({
      ticket_id: ticket.ticket_id,
      event_type: "OPENED",
      metadata: { created_by: profile.user_id },
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/tickets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/tickets - Update ticket (status, assignment, close)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Director is read-only
    if (profile.role_name === "Director") {
      return NextResponse.json({ error: "Director has read-only access" }, { status: 403 });
    }

    const body = await request.json();
    const { ticket_id, ...updateData } = body;

    if (!ticket_id) {
      return NextResponse.json({ error: "ticket_id is required" }, { status: 400 });
    }

    // Get existing ticket for validation
    const { data: existingTicket, error: fetchError } = await supabase
      .from("tickets")
      .select("*")
      .eq("ticket_id", ticket_id)
      .single();

    if (fetchError || !existingTicket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Handle CLOSED LOST - require reason (also enforced by DB constraint)
    if (updateData.inquiry_status === "CLOSED LOST" && !updateData.close_reason) {
      return NextResponse.json({ error: "close_reason is required for CLOSED LOST" }, { status: 400 });
    }

    // Validate status transitions (optional enhancement)
    const validInquiryTransitions: Record<string, string[]> = {
      'OPEN': ['WAITING RESPON', 'CLOSED', 'CLOSED LOST'],
      'WAITING RESPON': ['WAITING CUSTOMER', 'CLOSED', 'CLOSED LOST'],
      'WAITING CUSTOMER': ['WAITING RESPON', 'CLOSED', 'CLOSED LOST'],
      'CLOSED': [], // Cannot transition from closed
      'CLOSED LOST': [], // Cannot transition from closed lost
    };

    const validTicketTransitions: Record<string, string[]> = {
      'OPEN': ['IN PROGRESS', 'CLOSED'],
      'IN PROGRESS': ['CLOSED'],
      'CLOSED': [], // Cannot transition from closed
    };

    // Check transition validity for inquiry tickets
    if (updateData.inquiry_status && existingTicket.inquiry_status) {
      const currentStatus = existingTicket.inquiry_status;
      const newStatus = updateData.inquiry_status;
      const allowedTransitions = validInquiryTransitions[currentStatus] || [];
      
      if (currentStatus !== newStatus && !allowedTransitions.includes(newStatus)) {
        return NextResponse.json({ 
          error: `Invalid status transition: ${currentStatus} → ${newStatus}` 
        }, { status: 400 });
      }
    }

    // Check transition validity for general tickets
    if (updateData.ticket_status && existingTicket.ticket_status) {
      const currentStatus = existingTicket.ticket_status;
      const newStatus = updateData.ticket_status;
      const allowedTransitions = validTicketTransitions[currentStatus] || [];
      
      if (currentStatus !== newStatus && !allowedTransitions.includes(newStatus)) {
        return NextResponse.json({ 
          error: `Invalid status transition: ${currentStatus} → ${newStatus}` 
        }, { status: 400 });
      }
    }

    // Update ticket (RLS will enforce permissions)
    // Note: Audit logging is now handled by database trigger (trg_audit_tickets)
    const { data: ticket, error } = await supabase
      .from("tickets")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("ticket_id", ticket_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating ticket:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create SLA event for status change
    const oldStatus = existingTicket.inquiry_status || existingTicket.ticket_status;
    const newStatus = ticket.inquiry_status || ticket.ticket_status;
    if (oldStatus !== newStatus) {
      await supabase.from("sla_events").insert({
        ticket_id: ticket.ticket_id,
        event_type: "STATUS_CHANGE",
        metadata: { from: oldStatus, to: newStatus, changed_by: profile.user_id },
      });
    }

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error("Error in PATCH /api/tickets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
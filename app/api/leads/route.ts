import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";

// GET /api/leads - List leads with filters
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
    const status = searchParams.get("status") || "";
    const channel = searchParams.get("channel") || "";
    const sortBy = searchParams.get("sortBy") || "lead_date";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Build query
    let query = supabase
      .from("leads")
      .select(`
        *,
        customers (customer_id, company_name, pic_name, pic_email),
        prospects (prospect_id, current_stage),
        created_by_profile:profiles!leads_created_by_fkey (full_name, role_name),
        owner_profile:profiles!leads_sales_owner_user_id_fkey (full_name, role_name)
      `, { count: "exact" });

    // Apply filters
    if (search) {
      query = query.or(`company_name.ilike.%${search}%,pic_name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (channel) {
      query = query.eq("primary_channel", channel);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching leads:", error);
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
    console.error("Error in GET /api/leads:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/leads - Create lead with auto-link customer/prospect + optional RFQ
// Uses atomic RPC crm_create_lead_bundle for transactional integrity
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check role permission
    const allowedRoles = [
      "super admin",
      "Marketing Manager",
      "Marcomm (marketing staff)",
      "DGO (Marketing staff)",
      "MACX (marketing staff)",
      "VSDO (marketing staff)",
      "sales manager",
      "salesperson",
      "sales support",
    ];

    if (!allowedRoles.includes(profile.role_name)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Validate required fields client-side first for better UX
    const requiredFields = ["company_name", "pic_name", "contact_phone", "email", "city_area", "service_code", "primary_channel"];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Build payload for atomic RPC
    const payload = {
      company_name: body.company_name,
      pic_name: body.pic_name,
      contact_phone: body.contact_phone,
      email: body.email,
      city_area: body.city_area,
      service_code: body.service_code,
      primary_channel: body.primary_channel,
      // Optional fields
      npwp: body.npwp || null,
      country: body.country || null,
      route: body.route || null,
      est_volume_value: body.est_volume_value || null,
      est_volume_unit: body.est_volume_unit || null,
      timeline: body.timeline || null,
      sourced_by: body.sourced_by || "Marketing",
      campaign_name: body.campaign_name || null,
      notes: body.notes || null,
      sales_owner_user_id: body.sales_owner_user_id || null,
      next_step: body.next_step || "Call",
      due_date: body.due_date || null,
      // RFQ fields
      need_rfq: body.need_rfq || false,
      rfq_dept_target: body.rfq_dept_target || null,
      rfq_origin_address: body.rfq_origin_address || null,
      rfq_origin_city: body.rfq_origin_city || null,
      rfq_origin_country: body.rfq_origin_country || null,
      rfq_destination_address: body.rfq_destination_address || null,
      rfq_destination_city: body.rfq_destination_city || null,
      rfq_destination_country: body.rfq_destination_country || null,
      rfq_cargo_category: body.rfq_cargo_category || null,
      rfq_cargo_qty: body.rfq_cargo_qty || null,
      rfq_cargo_dimensions: body.rfq_cargo_dimensions || null,
      rfq_cargo_weight: body.rfq_cargo_weight || null,
      rfq_scope_of_work: body.rfq_scope_of_work || null,
    };

    // Call atomic RPC - all operations in single transaction
    const { data: result, error: rpcError } = await supabase.rpc(
      "crm_create_lead_bundle",
      { payload }
    );

    if (rpcError) {
      console.error("Error in crm_create_lead_bundle:", rpcError);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    // Check RPC result
    if (!result.success) {
      console.error("RPC returned error:", result.error);
      return NextResponse.json({ error: result.error || "Failed to create lead bundle" }, { status: 500 });
    }

    // Note: Audit logging is now handled by database trigger (trg_audit_leads)

    return NextResponse.json({
      lead: result.lead,
      lead_id: result.lead_id,
      customer_id: result.customer_id,
      prospect_id: result.prospect_id,
      ticket_id: result.ticket_id,
    }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/leads:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/leads - Update lead
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { lead_id, ...updateData } = body;

    if (!lead_id) {
      return NextResponse.json({ error: "lead_id is required" }, { status: 400 });
    }

    // Update lead (RLS will enforce permissions)
    // Note: Audit logging is now handled by database trigger (trg_audit_leads)
    const { data: lead, error } = await supabase
      .from("leads")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("lead_id", lead_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating lead:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ lead });
  } catch (error) {
    console.error("Error in PATCH /api/leads:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
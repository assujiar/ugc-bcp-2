// app/api/leads/[lead_id]/route.ts
// Lead detail, update, and handover operations

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";

// GET /api/leads/[lead_id] - Get single lead with related data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lead_id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { lead_id } = await params;

    const { data, error } = await supabase
      .from("leads")
      .select(`
        *,
        customers (customer_id, company_name, pic_name, pic_email, pic_phone, city, country),
        prospects (prospect_id, current_stage, owner_user_id),
        created_by_profile:profiles!leads_created_by_fkey (user_id, full_name, role_name),
        owner_profile:profiles!leads_sales_owner_user_id_fkey (user_id, full_name, role_name),
        service:service_catalog!leads_service_code_fkey (service_code, service_name, scope_group)
      `)
      .eq("lead_id", lead_id)
      .single();

    if (error) {
      console.error("Error fetching lead:", error);
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also get any related tickets (RFQ)
    const { data: tickets } = await supabase
      .from("tickets")
      .select("ticket_id, ticket_type, inquiry_status, ticket_status, subject, created_at")
      .eq("related_lead_id", lead_id)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      lead: data,
      related_tickets: tickets || [],
    });
  } catch (error) {
    console.error("Error in GET /api/leads/[lead_id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/leads/[lead_id] - Update lead (including status, owner assignment)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ lead_id: string }> }
) {
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

    const { lead_id } = await params;
    const body = await request.json();

    // Get existing lead
    const { data: existingLead, error: fetchError } = await supabase
      .from("leads")
      .select("*")
      .eq("lead_id", lead_id)
      .single();

    if (fetchError || !existingLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Update lead (RLS enforces permissions)
    // Audit logging is handled by trigger
    const { data: lead, error } = await supabase
      .from("leads")
      .update({
        ...body,
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
    console.error("Error in PATCH /api/leads/[lead_id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/leads/[lead_id]/assign - Handover lead to new sales owner
// This is handled as a special case in the same route file
// The actual handover endpoint is at /api/leads/[lead_id]/assign
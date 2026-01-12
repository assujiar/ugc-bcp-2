import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";

// GET /api/crm/leads/[id] - Get single lead
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { data: lead, error } = await supabase
      .from("leads")
      .select(`
        *,
        owner:profiles!leads_sales_owner_user_id_fkey (user_id, full_name, role_name),
        created_by_profile:profiles!leads_created_by_fkey (full_name)
      `)
      .eq("lead_id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ lead });
  } catch (error) {
    console.error("Error in GET /api/crm/leads/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/crm/leads/[id] - Update lead
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Get existing lead for audit
    const { data: existingLead } = await supabase
      .from("leads")
      .select("*")
      .eq("lead_id", id)
      .single();

    const { data: lead, error } = await supabase
      .from("leads")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("lead_id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "leads",
      record_id: id,
      action: "UPDATE",
      changed_by: profile.user_id,
      before_data: existingLead,
      after_data: lead,
    });

    return NextResponse.json({ lead });
  } catch (error) {
    console.error("Error in PATCH /api/crm/leads/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

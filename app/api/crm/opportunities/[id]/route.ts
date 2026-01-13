import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";

// GET /api/crm/opportunities/[id] - Get opportunity with stage history
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

    // Get opportunity with related data
    const { data: opportunity, error: oppError } = await supabase
      .from("opportunities")
      .select(`
        *,
        account:accounts!opportunities_account_id_fkey (account_id, company_name, city),
        owner:profiles!opportunities_owner_user_id_fkey (user_id, full_name, role_name)
      `)
      .eq("opportunity_id", id)
      .single();

    if (oppError || !opportunity) {
      console.error("Error fetching opportunity:", oppError);
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    // PR5.2: Get stage history from audit_logs
    const { data: stageHistory } = await supabase
      .from("audit_logs")
      .select(`
        audit_id,
        action,
        before_data,
        after_data,
        changed_at,
        changed_by,
        changer:profiles!audit_logs_changed_by_fkey (full_name)
      `)
      .eq("table_name", "opportunities")
      .eq("record_id", id)
      .order("changed_at", { ascending: false });

    // Process stage history to extract stage changes
    const stageChanges = (stageHistory || [])
      .filter((log) => {
        const before = log.before_data as Record<string, unknown> | null;
        const after = log.after_data as Record<string, unknown> | null;
        // Include INSERT and stage changes
        if (log.action === "INSERT") return true;
        if (!before || !after) return false;
        return before.stage !== after.stage;
      })
      .map((log) => {
        const before = log.before_data as Record<string, unknown> | null;
        const after = log.after_data as Record<string, unknown> | null;

        return {
          id: log.audit_id,
          timestamp: log.changed_at,
          action: log.action,
          fromStage: log.action === "INSERT" ? null : before?.stage,
          toStage: after?.stage || (log.action === "INSERT" ? "Created" : "Unknown"),
          nextStep: after?.next_step || null,
          nextStepDueDate: after?.next_step_due_date || null,
          changedBy: (log.changer as unknown as { full_name: string } | null)?.full_name || "System",
        };
      });

    // Get related activities
    const { data: activities } = await supabase
      .from("activities")
      .select(`
        *,
        owner:profiles!activities_owner_user_id_fkey (full_name)
      `)
      .eq("related_opportunity_id", id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Get related quotes
    const { data: quotes } = await supabase
      .from("quotes")
      .select("*")
      .eq("opportunity_id", id)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      opportunity,
      stageHistory: stageChanges,
      activities: activities || [],
      quotes: quotes || [],
    });
  } catch (error) {
    console.error("Error in GET /api/crm/opportunities/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/crm/opportunities/[id] - Update opportunity
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

    // Get existing opportunity for audit
    const { data: existingOpp, error: fetchError } = await supabase
      .from("opportunities")
      .select("*")
      .eq("opportunity_id", id)
      .single();

    if (fetchError || !existingOpp) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    // For stage changes, use the dedicated /stage endpoint
    if (body.stage && body.stage !== existingOpp.stage) {
      return NextResponse.json({
        error: "Stage changes must use POST /api/crm/opportunities/[id]/stage endpoint",
      }, { status: 400 });
    }

    const { data: opportunity, error } = await supabase
      .from("opportunities")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("opportunity_id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating opportunity:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "opportunities",
      record_id: id,
      action: "UPDATE",
      changed_by: profile.user_id,
      before_data: existingOpp,
      after_data: opportunity,
    });

    return NextResponse.json({ opportunity });
  } catch (error) {
    console.error("Error in PATCH /api/crm/opportunities/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

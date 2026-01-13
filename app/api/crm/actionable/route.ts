import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { apiSuccess, apiErrors } from "@/lib/api/error";

/**
 * GET /api/crm/actionable
 *
 * "No Record Left Behind" view - returns a union of all actionable items:
 * 1. Qualified leads not yet claimed (orphaned in handover)
 * 2. Open opportunities missing next_step_due_date (SSOT smoke test)
 * 3. Planned activities by time bucket (overdue, today, upcoming)
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return apiErrors.unauthorized();
    }

    const today = new Date().toISOString().split("T")[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // 1. Unclaimed Qualified Leads
    // These are leads that qualified through triage but haven't been claimed yet
    // This catches:
    // - triage_status = 'Qualified' with handover_eligible = true (ready but not sent)
    // - triage_status = 'Handed Over' with sales_owner_user_id IS NULL (sent but not claimed)
    const { data: unclaimedLeads, error: leadsError } = await supabase
      .from("leads")
      .select(`
        lead_id,
        company_name,
        pic_name,
        contact_phone,
        email,
        service_code,
        triage_status,
        qualified_at,
        sla_deadline,
        created_at
      `)
      .or(
        `and(triage_status.eq.Qualified,handover_eligible.eq.true),` +
        `and(triage_status.eq.Handed Over,sales_owner_user_id.is.null)`
      )
      .order("sla_deadline", { ascending: true, nullsFirst: false });

    if (leadsError) {
      console.error("Error fetching unclaimed leads:", leadsError);
      return apiErrors.internal(leadsError.message);
    }

    // 2. Open Opportunities Missing next_step_due_date
    // This should be 0 due to guardrails, but serves as a smoke test
    const { data: missingDueDateOpps, error: oppsError } = await supabase
      .from("opportunities")
      .select(`
        opportunity_id,
        name,
        stage,
        next_step,
        next_step_due_date,
        account:accounts!opportunities_account_id_fkey (account_id, company_name),
        owner:profiles!opportunities_owner_user_id_fkey (user_id, full_name),
        created_at
      `)
      .not("stage", "in", '("Closed Won","Closed Lost")')
      .is("next_step_due_date", null)
      .order("created_at", { ascending: true });

    if (oppsError) {
      console.error("Error fetching opps missing due date:", oppsError);
      return apiErrors.internal(oppsError.message);
    }

    // 3. Planned Activities - Overdue (due_date < today)
    const { data: overdueActivities, error: overdueError } = await supabase
      .from("activities")
      .select(`
        activity_id,
        activity_type,
        subject,
        due_date,
        scheduled_at,
        account:accounts!activities_related_account_id_fkey (account_id, company_name),
        opportunity:opportunities!activities_related_opportunity_id_fkey (opportunity_id, name, stage),
        lead:leads!activities_related_lead_id_fkey (lead_id, company_name),
        owner:profiles!activities_owner_user_id_fkey (user_id, full_name),
        created_at
      `)
      .eq("status", "Planned")
      .lt("due_date", today)
      .order("due_date", { ascending: true });

    if (overdueError) {
      console.error("Error fetching overdue activities:", overdueError);
      return apiErrors.internal(overdueError.message);
    }

    // 4. Planned Activities - Today (due_date = today)
    const { data: todayActivities, error: todayError } = await supabase
      .from("activities")
      .select(`
        activity_id,
        activity_type,
        subject,
        due_date,
        scheduled_at,
        account:accounts!activities_related_account_id_fkey (account_id, company_name),
        opportunity:opportunities!activities_related_opportunity_id_fkey (opportunity_id, name, stage),
        lead:leads!activities_related_lead_id_fkey (lead_id, company_name),
        owner:profiles!activities_owner_user_id_fkey (user_id, full_name),
        created_at
      `)
      .eq("status", "Planned")
      .eq("due_date", today)
      .order("scheduled_at", { ascending: true, nullsFirst: false });

    if (todayError) {
      console.error("Error fetching today activities:", todayError);
      return apiErrors.internal(todayError.message);
    }

    // 5. Planned Activities - Upcoming (today < due_date <= next 7 days)
    const { data: upcomingActivities, error: upcomingError } = await supabase
      .from("activities")
      .select(`
        activity_id,
        activity_type,
        subject,
        due_date,
        scheduled_at,
        account:accounts!activities_related_account_id_fkey (account_id, company_name),
        opportunity:opportunities!activities_related_opportunity_id_fkey (opportunity_id, name, stage),
        lead:leads!activities_related_lead_id_fkey (lead_id, company_name),
        owner:profiles!activities_owner_user_id_fkey (user_id, full_name),
        created_at
      `)
      .eq("status", "Planned")
      .gt("due_date", today)
      .lte("due_date", nextWeek)
      .order("due_date", { ascending: true });

    if (upcomingError) {
      console.error("Error fetching upcoming activities:", upcomingError);
      return apiErrors.internal(upcomingError.message);
    }

    // Build response with counts for summary
    const actionableData = {
      leads: {
        unclaimed: unclaimedLeads || [],
        count: unclaimedLeads?.length || 0,
      },
      opportunities: {
        missing_due_date: missingDueDateOpps || [],
        count: missingDueDateOpps?.length || 0,
      },
      activities: {
        overdue: overdueActivities || [],
        today: todayActivities || [],
        upcoming: upcomingActivities || [],
        overdue_count: overdueActivities?.length || 0,
        today_count: todayActivities?.length || 0,
        upcoming_count: upcomingActivities?.length || 0,
      },
      summary: {
        total_actionable:
          (unclaimedLeads?.length || 0) +
          (missingDueDateOpps?.length || 0) +
          (overdueActivities?.length || 0) +
          (todayActivities?.length || 0) +
          (upcomingActivities?.length || 0),
        leads_unclaimed: unclaimedLeads?.length || 0,
        opps_missing_due_date: missingDueDateOpps?.length || 0,
        activities_overdue: overdueActivities?.length || 0,
        activities_today: todayActivities?.length || 0,
        activities_upcoming: upcomingActivities?.length || 0,
      },
    };

    return apiSuccess({ data: actionableData });
  } catch (error) {
    console.error("Error in GET /api/crm/actionable:", error);
    return apiErrors.internal();
  }
}

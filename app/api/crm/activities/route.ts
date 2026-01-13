import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { z } from "zod";

const ACTIVITY_TYPES = [
  "Call", "Email", "Visit", "Online Meeting", "WhatsApp",
  "LinkedIn Message", "Send Proposal", "Send Quote", "Follow Up",
  "Internal Meeting", "Other"
] as const;

const ACTIVITY_STATUSES = ["Planned", "Done", "Cancelled"] as const;

const createActivitySchema = z.object({
  activity_type: z.enum(ACTIVITY_TYPES),
  status: z.enum(ACTIVITY_STATUSES).optional(),
  subject: z.string().min(1),
  description: z.string().optional(),
  related_account_id: z.string().optional(),
  related_contact_id: z.string().optional(),
  related_opportunity_id: z.string().optional(),
  related_lead_id: z.string().optional(),
  related_target_id: z.string().optional(),
  scheduled_at: z.string().optional(),
  due_date: z.string().optional(),
  outcome: z.string().optional(),
  duration_minutes: z.number().optional(),
  evidence_url: z.string().optional(),
  gps_lat: z.number().optional(),
  gps_lng: z.number().optional(),
});

// GET /api/crm/activities - List activities
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "50", 10);
    const status = searchParams.get("status");
    const ownerId = searchParams.get("owner_id");
    const accountId = searchParams.get("account_id");
    const opportunityId = searchParams.get("opportunity_id");
    const view = searchParams.get("view"); // inbox, planner, all

    let query = supabase
      .from("activities")
      .select(`
        *,
        account:accounts!activities_related_account_id_fkey (account_id, company_name),
        opportunity:opportunities!activities_related_opportunity_id_fkey (opportunity_id, name, stage),
        contact:contacts!activities_related_contact_id_fkey (contact_id, first_name, last_name),
        owner:profiles!activities_owner_user_id_fkey (user_id, full_name)
      `, { count: "exact" });

    // PR4.1: Apply view filters for Work Queue buckets
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    if (view === "inbox") {
      // Sales inbox: planned activities that are overdue or due today
      query = query
        .eq("owner_user_id", profile.user_id)
        .eq("status", "Planned")
        .lte("due_date", today);
    } else if (view === "overdue") {
      // PR4.1: Overdue activities (past due)
      query = query
        .eq("owner_user_id", profile.user_id)
        .eq("status", "Planned")
        .lt("due_date", today);
    } else if (view === "today") {
      // PR4.1: Due today activities
      query = query
        .eq("owner_user_id", profile.user_id)
        .eq("status", "Planned")
        .eq("due_date", today);
    } else if (view === "upcoming") {
      // PR4.1: Upcoming activities (1-7 days)
      query = query
        .eq("owner_user_id", profile.user_id)
        .eq("status", "Planned")
        .gt("due_date", today)
        .lte("due_date", nextWeek);
    } else if (view === "all_planned") {
      // PR4.1: All planned activities for the user
      query = query
        .eq("owner_user_id", profile.user_id)
        .eq("status", "Planned");
    } else if (view === "planner") {
      // Activity planner: all planned activities for the user
      query = query
        .eq("owner_user_id", profile.user_id)
        .eq("status", "Planned");
    } else if (view === "history") {
      // Completed/cancelled activities for history view
      query = query
        .eq("owner_user_id", profile.user_id)
        .in("status", ["Done", "Cancelled"]);
    }

    // Apply filters
    if (status) {
      query = query.eq("status", status);
    }
    if (ownerId) {
      query = query.eq("owner_user_id", ownerId);
    }
    if (accountId) {
      query = query.eq("related_account_id", accountId);
    }
    if (opportunityId) {
      query = query.eq("related_opportunity_id", opportunityId);
    }

    // Order by due date (soonest first), then scheduled_at
    query = query
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("scheduled_at", { ascending: true, nullsFirst: false });

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching activities:", error);
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
    console.error("Error in GET /api/crm/activities:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/crm/activities - Create activity
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createActivitySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: "Validation error",
        details: validation.error.issues
      }, { status: 400 });
    }

    const activityData = validation.data;

    // GUARDRAIL: Planned activities require a due_date (SSOT requirement)
    const effectiveStatus = activityData.status || "Planned";
    if (effectiveStatus === "Planned" && !activityData.due_date) {
      return NextResponse.json({
        error: "Planned activities require a due_date (SSOT guardrail: every active item needs owner + due_date)"
      }, { status: 400 });
    }

    // Visit type requires evidence and GPS
    if (activityData.activity_type === "Visit" && activityData.status === "Done") {
      if (!activityData.evidence_url || !activityData.gps_lat || !activityData.gps_lng) {
        return NextResponse.json({
          error: "Visit activities require evidence_url, gps_lat, and gps_lng when marked as Done"
        }, { status: 400 });
      }
    }

    const { data: activity, error } = await supabase
      .from("activities")
      .insert({
        ...activityData,
        status: activityData.status || "Planned",
        owner_user_id: profile.user_id,
        created_by: profile.user_id,
        completed_at: activityData.status === "Done" ? new Date().toISOString() : null,
        cancelled_at: activityData.status === "Cancelled" ? new Date().toISOString() : null,
      })
      .select(`
        *,
        account:accounts!activities_related_account_id_fkey (account_id, company_name),
        opportunity:opportunities!activities_related_opportunity_id_fkey (opportunity_id, name)
      `)
      .single();

    if (error) {
      console.error("Error creating activity:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "activities",
      record_id: activity.activity_id,
      action: "INSERT",
      changed_by: profile.user_id,
      after_data: activity,
    });

    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/crm/activities:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

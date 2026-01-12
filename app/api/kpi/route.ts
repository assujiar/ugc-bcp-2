import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";

// GET /api/kpi - Get KPI data (targets, metrics, actuals)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "targets"; // targets, metrics, my, team
    const periodStart = searchParams.get("period_start");
    const periodEnd = searchParams.get("period_end");
    const metricKey = searchParams.get("metric_key");

    if (type === "metrics") {
      // Get KPI metric definitions
      const { data, error } = await supabase
        .from("kpi_metric_definitions")
        .select("*")
        .order("metric_key");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data });
    }

    if (type === "targets") {
      // Get KPI targets
      let query = supabase
        .from("kpi_targets")
        .select(`
          *,
          metric:kpi_metric_definitions (metric_key, owner_role, unit, calc_method, direction, description),
          assignee:profiles!kpi_targets_assignee_user_id_fkey (full_name, role_name)
        `)
        .order("period_start", { ascending: false });

      if (periodStart) {
        query = query.gte("period_start", periodStart);
      }
      if (periodEnd) {
        query = query.lte("period_end", periodEnd);
      }
      if (metricKey) {
        query = query.eq("metric_key", metricKey);
      }

      const { data, error } = await query;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data });
    }

    if (type === "my") {
      // Get current user's KPI targets
      const { data, error } = await supabase
        .from("kpi_targets")
        .select(`
          *,
          metric:kpi_metric_definitions (metric_key, owner_role, unit, calc_method, direction, description)
        `)
        .eq("assignee_user_id", profile.user_id)
        .order("period_start", { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data });
    }

    if (type === "team") {
      // Get team KPI targets (for managers)
      const allowedRoles = ["super admin", "Director", "Marketing Manager", "sales manager"];
      if (!allowedRoles.includes(profile.role_name)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Get team members
      const { data: teamMembers, error: teamError } = await supabase
        .from("profiles")
        .select("user_id, full_name, role_name")
        .eq("manager_user_id", profile.user_id);

      if (teamError) {
        return NextResponse.json({ error: teamError.message }, { status: 500 });
      }

      const teamUserIds = teamMembers?.map((m) => m.user_id) || [];

      // Get targets for team
      const { data, error } = await supabase
        .from("kpi_targets")
        .select(`
          *,
          metric:kpi_metric_definitions (metric_key, owner_role, unit, calc_method, direction, description),
          assignee:profiles!kpi_targets_assignee_user_id_fkey (full_name, role_name)
        `)
        .in("assignee_user_id", teamUserIds)
        .order("period_start", { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data, team: teamMembers });
    }

    // Get aggregated KPI views
    if (type === "sales_revenue") {
      const { data, error } = await supabase
        .from("v_sales_revenue_daily")
        .select("*")
        .order("day", { ascending: false })
        .limit(30);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data });
    }

    if (type === "marketing_leads") {
      const { data, error } = await supabase
        .from("v_marketing_leads_by_channel_daily")
        .select("*")
        .order("day", { ascending: false })
        .limit(30);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
  } catch (error) {
    console.error("Error in GET /api/kpi:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/kpi - Create KPI target or manual input
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type } = body;

    if (type === "target") {
      // Create KPI target (managers only)
      const allowedRoles = ["super admin", "Marketing Manager", "sales manager"];
      if (!allowedRoles.includes(profile.role_name)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const { metric_key, period_start, period_end, assignee_user_id, target_value } = body;

      if (!metric_key || !period_start || !period_end || !target_value) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("kpi_targets")
        .insert({
          metric_key,
          period_start,
          period_end,
          assignee_user_id: assignee_user_id || null,
          target_value,
          created_by: profile.user_id,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data }, { status: 201 });
    }

    if (type === "activity") {
      // Create marketing activity event (manual input)
      const allowedRoles = [
        "super admin",
        "Marketing Manager",
        "Marcomm (marketing staff)",
        "DGO (Marketing staff)",
        "MACX (marketing staff)",
        "VSDO (marketing staff)",
      ];
      if (!allowedRoles.includes(profile.role_name)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const { activity_name, channel, activity_date, quantity, notes } = body;

      if (!activity_name || !activity_date || quantity === undefined) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("marketing_activity_events")
        .insert({
          activity_name,
          channel: channel || null,
          activity_date,
          quantity,
          notes: notes || null,
          created_by: profile.user_id,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data }, { status: 201 });
    }

    if (type === "spend") {
      // Create marketing spend entry
      const allowedRoles = [
        "super admin",
        "Marketing Manager",
        "Marcomm (marketing staff)",
        "DGO (Marketing staff)",
        "MACX (marketing staff)",
        "VSDO (marketing staff)",
      ];
      if (!allowedRoles.includes(profile.role_name)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const { channel, spend_date, amount, campaign_name, notes } = body;

      if (!channel || !spend_date || amount === undefined) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("marketing_spend")
        .insert({
          channel,
          spend_date,
          amount,
          campaign_name: campaign_name || null,
          notes: notes || null,
          created_by: profile.user_id,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
  } catch (error) {
    console.error("Error in POST /api/kpi:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/kpi - Update KPI target
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowedRoles = ["super admin", "Marketing Manager", "sales manager"];
    if (!allowedRoles.includes(profile.role_name)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("kpi_targets")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error in PATCH /api/kpi:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/kpi - Delete KPI target
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (profile.role_name !== "super admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("kpi_targets")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/kpi:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";

// GET /api/dashboard - Get dashboard data based on role
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30"; // days

    const periodDays = parseInt(period, 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);
    const startDateStr = startDate.toISOString().split("T")[0];

    // Build dashboard data based on role
    const dashboardData: Record<string, unknown> = {
      role: profile.role_name,
      period_days: periodDays,
    };

    // Get leads count
    const { count: totalLeads } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("lead_date", startDateStr);

    dashboardData.total_leads = totalLeads || 0;

    // Get leads by channel
    const { data: leadsByChannel } = await supabase
      .from("v_marketing_leads_by_channel_daily")
      .select("*")
      .gte("day", startDateStr);

    // Aggregate by channel
    const channelMap = new Map<string, number>();
    leadsByChannel?.forEach((row) => {
      const current = channelMap.get(row.primary_channel) || 0;
      channelMap.set(row.primary_channel, current + (row.leads_count || 0));
    });
    dashboardData.leads_by_channel = Object.fromEntries(channelMap);

    // Get tickets stats
    const { count: openTickets } = await supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .or("inquiry_status.eq.OPEN,inquiry_status.eq.WAITING RESPON,inquiry_status.eq.WAITING CUSTOMER,ticket_status.eq.OPEN,ticket_status.eq.IN PROGRESS");

    dashboardData.open_tickets = openTickets || 0;

    // Get response time median
    const { data: responseTimeData } = await supabase
      .from("v_ticket_first_response_median_daily")
      .select("*")
      .gte("day", startDateStr)
      .limit(30);

    const avgResponseTime = responseTimeData && responseTimeData.length > 0
      ? responseTimeData.reduce((sum, r) => sum + (r.median_first_response_minutes || 0), 0) / responseTimeData.length
      : null;
    dashboardData.avg_response_time_minutes = avgResponseTime;

    // Role-specific data
    const isMarketing = [
      "Marketing Manager",
      "Marcomm (marketing staff)",
      "DGO (Marketing staff)",
      "MACX (marketing staff)",
      "VSDO (marketing staff)",
    ].includes(profile.role_name);

    const isSales = [
      "sales manager",
      "salesperson",
      "sales support",
    ].includes(profile.role_name);

    const isOps = [
      "EXIM Ops (operation)",
      "domestics Ops (operation)",
      "Import DTD Ops (operation)",
      "traffic & warehous (operation)",
    ].includes(profile.role_name);

    const isFinance = profile.role_name === "finance";
    const isDirector = profile.role_name === "Director";
    const isSuperAdmin = profile.role_name === "super admin";

    // Marketing specific
    if (isMarketing || isDirector || isSuperAdmin) {
      // Get spend data
      const { data: spendData } = await supabase
        .from("v_marketing_spend_daily")
        .select("*")
        .gte("day", startDateStr);

      const totalSpend = spendData?.reduce((sum, s) => sum + parseFloat(s.spend_idr || "0"), 0) || 0;
      dashboardData.total_marketing_spend = totalSpend;

      // Calculate CPL
      if (totalLeads && totalLeads > 0 && totalSpend > 0) {
        dashboardData.avg_cpl = totalSpend / totalLeads;
      }
    }

    // Sales specific
    if (isSales || isDirector || isSuperAdmin) {
      // Get revenue data
      const { data: revenueData } = await supabase
        .from("v_sales_revenue_daily")
        .select("*")
        .gte("day", startDateStr);

      const totalRevenue = revenueData?.reduce((sum, r) => sum + parseFloat(r.revenue_idr || "0"), 0) || 0;
      const activeCustomers = new Set(revenueData?.flatMap((r) => r.active_customers ? [r.active_customers] : [])).size;

      dashboardData.total_revenue = totalRevenue;
      dashboardData.active_customers = activeCustomers;

      // Get new logos
      const { data: newLogosData } = await supabase
        .from("v_sales_new_logos_daily")
        .select("*")
        .gte("day", startDateStr);

      const newLogos = newLogosData?.reduce((sum, n) => sum + (n.new_logos || 0), 0) || 0;
      dashboardData.new_logos = newLogos;

      // Get activities count
      const { data: activitiesData } = await supabase
        .from("v_sales_activities_daily")
        .select("*")
        .gte("day", startDateStr);

      // Aggregate by type
      const activityMap = new Map<string, number>();
      activitiesData?.forEach((row) => {
        const current = activityMap.get(row.activity_type) || 0;
        activityMap.set(row.activity_type, current + (row.activity_count || 0));
      });
      dashboardData.activities_by_type = Object.fromEntries(activityMap);
      dashboardData.total_activities = activitiesData?.reduce((sum, a) => sum + (a.activity_count || 0), 0) || 0;
    }

    // Ops specific - ticket SLA
    if (isOps || isDirector || isSuperAdmin) {
      // Get tickets by department
      const { data: ticketsByDept } = await supabase
        .from("tickets")
        .select("dept_target, ticket_type, inquiry_status, ticket_status")
        .gte("created_at", startDateStr);

      // Count by status
      const statusCounts = {
        open: 0,
        in_progress: 0,
        closed: 0,
        closed_lost: 0,
      };

      ticketsByDept?.forEach((t) => {
        if (t.inquiry_status === "OPEN" || t.ticket_status === "OPEN") {
          statusCounts.open++;
        } else if (t.inquiry_status === "WAITING RESPON" || t.inquiry_status === "WAITING CUSTOMER" || t.ticket_status === "IN PROGRESS") {
          statusCounts.in_progress++;
        } else if (t.inquiry_status === "CLOSED" || t.ticket_status === "CLOSED") {
          statusCounts.closed++;
        } else if (t.inquiry_status === "CLOSED LOST") {
          statusCounts.closed_lost++;
        }
      });

      dashboardData.ticket_status_counts = statusCounts;
    }

    // Finance specific - DSO/AR
    if (isFinance || isDirector || isSuperAdmin) {
      // Get DSO rolling 30
      const { data: dsoData } = await supabase
        .from("v_dso_rolling_30")
        .select("*")
        .single();

      dashboardData.dso_days = dsoData?.dso_days_rolling_30 || null;
      dashboardData.ar_outstanding = dsoData?.ar_outstanding || 0;

      // Get AR aging summary
      const { data: agingData } = await supabase
        .from("v_ar_aging")
        .select("*");

      const agingTotals = {
        bucket_1_30: agingData?.reduce((sum, a) => sum + parseFloat(a.bucket_1_30 || "0"), 0) || 0,
        bucket_31_60: agingData?.reduce((sum, a) => sum + parseFloat(a.bucket_31_60 || "0"), 0) || 0,
        bucket_61_90: agingData?.reduce((sum, a) => sum + parseFloat(a.bucket_61_90 || "0"), 0) || 0,
        bucket_90_plus: agingData?.reduce((sum, a) => sum + parseFloat(a.bucket_90_plus || "0"), 0) || 0,
      };

      dashboardData.ar_aging = agingTotals;
    }

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error("Error in GET /api/dashboard:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

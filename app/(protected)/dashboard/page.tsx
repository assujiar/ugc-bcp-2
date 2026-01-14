"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Ticket,
  DollarSign,
  Clock,
  ArrowUpRight,
  ArrowRight,
  Activity,
  FileText,
  ChevronRight,
  Sparkles,
  Target,
  MoreHorizontal,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RevenueChart } from "@/components/charts/revenue-chart";

interface DashboardStats {
  totalLeads: number;
  leadsChange: number;
  activeTickets: number;
  ticketsChange: number;
  revenueMTD: number;
  revenueChange: number;
  dsoDays: number;
  dsoChange: number;
  newLeadsToday: number;
  pendingRFQ: number;
  overdueInvoices: number;
  activeCustomers: number;
  winRate: number;
  winRateChange: number;
  responseTime: number;
  responseTimeChange: number;
  leadSources: { label: string; value: string; count: number; color: string }[];
}

interface RecentActivity {
  id: string;
  type: "lead" | "ticket" | "invoice" | "activity";
  title: string;
  description: string;
  time: string;
  status: string;
}

interface LeadRow {
  primary_channel: string | null;
}

interface InvoiceRow {
  invoice_amount: number;
}

interface ResponseTimeRow {
  median_first_response_minutes: number | null;
}

interface DsoRow {
  dso_days_rolling_30: number | null;
}

interface RecentLeadRow {
  lead_id: string;
  company_name: string;
  primary_channel: string;
  status: string;
  created_at: string;
}

interface RecentTicketRow {
  ticket_id: string;
  subject: string;
  ticket_type: string;
  inquiry_status: string | null;
  ticket_status: string | null;
  created_at: string;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  return `${diffDays} days ago`;
}

const CHANNEL_COLORS: Record<string, string> = {
  "LinkedIn": "bg-primary",
  "SEM": "bg-info",
  "Paid Social": "bg-warning",
  "Website (Direct/Referral)": "bg-success",
  "Webinar & Live": "bg-secondary",
  "Event Offline": "bg-primary/70",
  "Trade Show": "bg-info/70",
  "Partnership/Referral": "bg-success/70",
  "Sales Outbound": "bg-warning/70",
  "Sales Referral": "bg-secondary/70",
  "Other": "bg-muted-foreground",
};

// Stat Card Menu Component
function StatCardMenu({ 
  viewHref, 
  onRefresh,
  label 
}: { 
  viewHref: string; 
  onRefresh?: () => void;
  label: string;
}) {
  const router = useRouter();
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="btn-ghost h-8 w-8 p-0 hover:bg-muted rounded-lg">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => router.push(viewHref)}>
          <ExternalLink className="h-4 w-4 mr-2" />
          View {label}
        </DropdownMenuItem>
        {onRefresh && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Data
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = React.useState<DashboardStats>({
    totalLeads: 0,
    leadsChange: 0,
    activeTickets: 0,
    ticketsChange: 0,
    revenueMTD: 0,
    revenueChange: 0,
    dsoDays: 0,
    dsoChange: 0,
    newLeadsToday: 0,
    pendingRFQ: 0,
    overdueInvoices: 0,
    activeCustomers: 0,
    winRate: 0,
    winRateChange: 0,
    responseTime: 0,
    responseTimeChange: 0,
    leadSources: [],
  });
  const [activities, setActivities] = React.useState<RecentActivity[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [mounted, setMounted] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleRefresh = React.useCallback(() => {
    setLoading(true);
    setRefreshKey(prev => prev + 1);
  }, []);

  React.useEffect(() => {
    async function fetchDashboardData() {
      const supabase = createClient();

      // Helper function to safely execute Supabase queries
      const safeQuery = async <T,>(queryFn: () => PromiseLike<{ data: T | null; error: unknown; count?: number | null }>): Promise<{ data: T | null; count: number | null }> => {
        try {
          const result = await queryFn();
          if (result.error) {
            console.error("Supabase query error:", result.error);
            return { data: null, count: null };
          }
          return { data: result.data, count: result.count ?? null };
        } catch (e) {
          console.error("Supabase query exception:", e);
          return { data: null, count: null };
        }
      };

      try {
        const today = new Date();
        const todayStr = today.toISOString().split("T")[0];

        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

        const sixtyDaysAgo = new Date(today);
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split("T")[0];

        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const startOfMonthStr = startOfMonth.toISOString().split("T")[0];

        const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const startOfLastMonthStr = startOfLastMonth.toISOString().split("T")[0];
        const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        const endOfLastMonthStr = endOfLastMonth.toISOString().split("T")[0];

        // === LEADS ===
        const { count: totalLeads } = await safeQuery(() =>
          supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .gte("lead_date", startOfMonthStr)
        );

        const { count: leadsLastMonth } = await safeQuery(() =>
          supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .gte("lead_date", startOfLastMonthStr)
            .lte("lead_date", endOfLastMonthStr)
        );

        const leadsChange = leadsLastMonth && leadsLastMonth > 0
          ? ((totalLeads || 0) - leadsLastMonth) / leadsLastMonth * 100
          : 0;

        const { count: newLeadsToday } = await safeQuery(() =>
          supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .gte("lead_date", todayStr)
        );

        // === LEADS BY CHANNEL ===
        const { data: leadsRaw } = await safeQuery<LeadRow[]>(() =>
          supabase
            .from("leads")
            .select("primary_channel")
            .gte("lead_date", thirtyDaysAgoStr)
        );

        const channelCounts = new Map<string, number>();
        ((leadsRaw || []) as LeadRow[]).forEach((lead) => {
          const channel = lead.primary_channel || "Other";
          channelCounts.set(channel, (channelCounts.get(channel) || 0) + 1);
        });

        const totalChannelLeads = Array.from(channelCounts.values()).reduce((a, b) => a + b, 0);
        const leadSources = Array.from(channelCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([label, count]) => ({
            label,
            count,
            value: totalChannelLeads > 0 ? `${Math.round(count / totalChannelLeads * 100)}%` : "0%",
            color: CHANNEL_COLORS[label] || "bg-muted-foreground",
          }));

        // === TICKETS ===
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString();

        const fourteenDaysAgo = new Date(today);
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        const fourteenDaysAgoStr = fourteenDaysAgo.toISOString();

        const { count: activeInquiry } = await safeQuery(() =>
          supabase
            .from("tickets")
            .select("*", { count: "exact", head: true })
            .eq("ticket_type", "inquiry tariff")
            .not("inquiry_status", "in", '("CLOSED","CLOSED LOST")')
        );

        const { count: activeNonInquiry } = await safeQuery(() =>
          supabase
            .from("tickets")
            .select("*", { count: "exact", head: true })
            .neq("ticket_type", "inquiry tariff")
            .neq("ticket_status", "CLOSED")
        );

        const activeTickets = (activeInquiry || 0) + (activeNonInquiry || 0);

        const { count: ticketsLastWeek } = await safeQuery(() =>
          supabase
            .from("tickets")
            .select("*", { count: "exact", head: true })
            .gte("created_at", fourteenDaysAgoStr)
            .lt("created_at", sevenDaysAgoStr)
        );

        const { count: ticketsThisWeek } = await safeQuery(() =>
          supabase
            .from("tickets")
            .select("*", { count: "exact", head: true })
            .gte("created_at", sevenDaysAgoStr)
        );

        const ticketsChange = ticketsLastWeek && ticketsLastWeek > 0
          ? ((ticketsThisWeek || 0) - ticketsLastWeek) / ticketsLastWeek * 100
          : 0;

        const { count: pendingRFQ } = await safeQuery(() =>
          supabase
            .from("tickets")
            .select("*", { count: "exact", head: true })
            .eq("ticket_type", "inquiry tariff")
            .in("inquiry_status", ["OPEN", "WAITING RESPON", "WAITING CUSTOMER"])
        );

        // === WIN RATE ===
        const { count: closedWon } = await safeQuery(() =>
          supabase
            .from("prospects")
            .select("*", { count: "exact", head: true })
            .eq("current_stage", "Closed Won")
        );

        const { count: closedLost } = await safeQuery(() =>
          supabase
            .from("prospects")
            .select("*", { count: "exact", head: true })
            .eq("current_stage", "Closed Lost")
        );

        const totalClosed = (closedWon || 0) + (closedLost || 0);
        const winRate = totalClosed > 0 ? (closedWon || 0) / totalClosed * 100 : 0;

        // === RESPONSE TIME ===
        const { data: responseData } = await safeQuery<ResponseTimeRow[]>(() =>
          supabase
            .from("v_ticket_first_response_median_daily")
            .select("median_first_response_minutes")
            .gte("day", thirtyDaysAgoStr)
            .not("median_first_response_minutes", "is", null)
        );

        const responseRows = (responseData || []) as ResponseTimeRow[];
        const avgResponseMinutes = responseRows.length > 0
          ? responseRows.reduce((sum, r) => sum + (r.median_first_response_minutes || 0), 0) / responseRows.length
          : 0;
        const responseTimeHours = avgResponseMinutes / 60;

        const { data: prevResponseData } = await safeQuery<ResponseTimeRow[]>(() =>
          supabase
            .from("v_ticket_first_response_median_daily")
            .select("median_first_response_minutes")
            .gte("day", sixtyDaysAgoStr)
            .lt("day", thirtyDaysAgoStr)
            .not("median_first_response_minutes", "is", null)
        );

        const prevResponseRows = (prevResponseData || []) as ResponseTimeRow[];
        const prevAvgResponseMinutes = prevResponseRows.length > 0
          ? prevResponseRows.reduce((sum, r) => sum + (r.median_first_response_minutes || 0), 0) / prevResponseRows.length
          : 0;

        const responseTimeChange = prevAvgResponseMinutes > 0
          ? ((avgResponseMinutes - prevAvgResponseMinutes) / prevAvgResponseMinutes) * 100
          : 0;

        // === REVENUE ===
        const { data: revenueDataRaw } = await safeQuery<InvoiceRow[]>(() =>
          supabase
            .from("invoices")
            .select("invoice_amount")
            .gte("invoice_date", startOfMonthStr)
        );

        const revenueRows = (revenueDataRaw || []) as InvoiceRow[];
        const revenueMTD = revenueRows.reduce((sum, inv) => sum + (Number(inv.invoice_amount) || 0), 0);

        const { data: lastMonthRevenueRaw } = await safeQuery<InvoiceRow[]>(() =>
          supabase
            .from("invoices")
            .select("invoice_amount")
            .gte("invoice_date", startOfLastMonthStr)
            .lte("invoice_date", endOfLastMonthStr)
        );

        const lastMonthRows = (lastMonthRevenueRaw || []) as InvoiceRow[];
        const lastMonthRevenue = lastMonthRows.reduce((sum, inv) => sum + (Number(inv.invoice_amount) || 0), 0);

        const revenueChange = lastMonthRevenue > 0
          ? ((revenueMTD - lastMonthRevenue) / lastMonthRevenue) * 100
          : 0;

        // === DSO ===
        const { data: dsoDataRaw } = await safeQuery<DsoRow>(() =>
          supabase
            .from("v_dso_rolling_30")
            .select("dso_days_rolling_30")
            .single()
        );

        const dsoData = dsoDataRaw as DsoRow | null;
        const dsoDays = Math.round(Number(dsoData?.dso_days_rolling_30) || 0);

        // === OVERDUE INVOICES ===
        const { count: overdueInvoices } = await safeQuery(() =>
          supabase
            .from("v_invoice_outstanding")
            .select("*", { count: "exact", head: true })
            .eq("is_overdue", true)
        );

        // === ACTIVE CUSTOMERS ===
        const { count: activeCustomers } = await safeQuery(() =>
          supabase
            .from("customers")
            .select("*", { count: "exact", head: true })
        );

        // === RECENT ACTIVITIES ===
        const { data: recentLeadsRaw } = await safeQuery<RecentLeadRow[]>(() =>
          supabase
            .from("leads")
            .select("lead_id, company_name, primary_channel, status, created_at")
            .order("created_at", { ascending: false })
            .limit(3)
        );

        const recentLeads = (recentLeadsRaw || []) as RecentLeadRow[];

        const { data: recentTicketsRaw } = await safeQuery<RecentTicketRow[]>(() =>
          supabase
            .from("tickets")
            .select("ticket_id, subject, ticket_type, inquiry_status, ticket_status, created_at")
            .order("created_at", { ascending: false })
            .limit(3)
        );

        const recentTickets = (recentTicketsRaw || []) as RecentTicketRow[];

        const formattedActivities: RecentActivity[] = [
          ...recentLeads.map((lead) => ({
            id: lead.lead_id,
            type: "lead" as const,
            title: `Lead: ${lead.company_name}`,
            description: `Via ${lead.primary_channel}`,
            time: formatTimeAgo(lead.created_at),
            status: lead.status,
          })),
          ...recentTickets.map((ticket) => ({
            id: ticket.ticket_id,
            type: "ticket" as const,
            title: ticket.ticket_id,
            description: ticket.subject,
            time: formatTimeAgo(ticket.created_at),
            status: ticket.inquiry_status || ticket.ticket_status || "OPEN",
          })),
        ].slice(0, 5);

        setStats({
          totalLeads: totalLeads || 0,
          leadsChange: Math.round(leadsChange * 10) / 10,
          activeTickets,
          ticketsChange: Math.round(ticketsChange * 10) / 10,
          revenueMTD,
          revenueChange: Math.round(revenueChange * 10) / 10,
          dsoDays,
          dsoChange: 0,
          newLeadsToday: newLeadsToday || 0,
          pendingRFQ: pendingRFQ || 0,
          overdueInvoices: overdueInvoices || 0,
          activeCustomers: activeCustomers || 0,
          winRate: Math.round(winRate * 10) / 10,
          winRateChange: 0,
          responseTime: Math.round(responseTimeHours * 10) / 10,
          responseTimeChange: Math.round(responseTimeChange * 10) / 10,
          leadSources,
        });

        setActivities(formattedActivities);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [refreshKey]);

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000_000) {
      return `Rp ${(value / 1_000_000_000).toFixed(1)}B`;
    } else if (value >= 1_000_000) {
      return `Rp ${(value / 1_000_000).toFixed(0)}M`;
    }
    return `Rp ${value.toLocaleString("id-ID")}`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 skeleton" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 h-64 skeleton rounded-xl" />
          <div className="lg:col-span-4 space-y-4">
            <div className="h-28 skeleton rounded-xl" />
            <div className="h-28 skeleton rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s what&apos;s happening today.
        </p>
      </div>

      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8">
          <div className="hero-card h-full">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-5 w-5 text-white/80" />
                  <span className="text-sm font-medium text-white/80">Good Morning!</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  Your Dashboard Overview
                </h2>
                <p className="text-white/70 mb-4 max-w-lg">
                  Track your team&apos;s performance, manage leads, and monitor DSO all in one place.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link 
                    href="/kpi"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-medium transition-colors backdrop-blur-sm"
                  >
                    <Target className="h-4 w-4" />
                    View KPIs
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link 
                    href="/crm/leads/new"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-primary text-sm font-medium hover:bg-white/90 transition-colors"
                  >
                    Create Lead
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">{stats.newLeadsToday}</p>
                  <p className="text-sm text-white/70">Today&apos;s Leads</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">{stats.pendingRFQ}</p>
                  <p className="text-sm text-white/70">Pending RFQ</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-4">
          <Link href="/dso/invoices?status=overdue" className="card flex items-center gap-4 hover:border-warning/50 transition-colors">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
              <FileText className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.overdueInvoices}</p>
              <p className="text-sm text-muted-foreground">Overdue Invoices</p>
            </div>
          </Link>
          <Link href="/crm/accounts" className="card flex items-center gap-4 hover:border-success/50 transition-colors">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
              <Users className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.activeCustomers}</p>
              <p className="text-sm text-muted-foreground">Active Customers</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-start justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            {mounted && (
              <StatCardMenu viewHref="/crm/leads" onRefresh={handleRefresh} label="Leads" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">Total Leads</p>
          <p className="text-2xl font-bold text-foreground">{stats.totalLeads}</p>
          <div className={cn(
            "flex items-center gap-1 mt-2 text-xs font-medium",
            stats.leadsChange >= 0 ? "text-success" : "text-destructive"
          )}>
            {stats.leadsChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {stats.leadsChange >= 0 ? "+" : ""}{stats.leadsChange}% vs last month
          </div>
        </div>

        <div className="card">
          <div className="flex items-start justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <Ticket className="h-5 w-5 text-muted-foreground" />
            </div>
            {mounted && (
              <StatCardMenu viewHref="/ticketing" onRefresh={handleRefresh} label="Tickets" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">Active Tickets</p>
          <p className="text-2xl font-bold text-foreground">{stats.activeTickets}</p>
          <div className={cn(
            "flex items-center gap-1 mt-2 text-xs font-medium",
            stats.ticketsChange <= 0 ? "text-success" : "text-destructive"
          )}>
            {stats.ticketsChange <= 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
            {stats.ticketsChange}% vs last week
          </div>
        </div>

        <div className="card">
          <div className="flex items-start justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
            </div>
            {mounted && (
              <StatCardMenu viewHref="/dso" onRefresh={handleRefresh} label="Revenue" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">Revenue MTD</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.revenueMTD)}</p>
          <div className={cn(
            "flex items-center gap-1 mt-2 text-xs font-medium",
            stats.revenueChange >= 0 ? "text-success" : "text-destructive"
          )}>
            {stats.revenueChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {stats.revenueChange >= 0 ? "+" : ""}{stats.revenueChange}% vs last month
          </div>
        </div>

        <div className="card">
          <div className="flex items-start justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            {mounted && (
              <StatCardMenu viewHref="/dso" onRefresh={handleRefresh} label="DSO" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">DSO Days</p>
          <p className="text-2xl font-bold text-foreground">{stats.dsoDays}</p>
          <div className="flex items-center gap-1 mt-2 text-xs font-medium text-muted-foreground">
            Rolling 30-day average
          </div>
        </div>
      </div>

      {/* KPI Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/crm/targets" className="card hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Win Rate</p>
              <p className="text-2xl font-bold text-foreground">{stats.winRate}%</p>
            </div>
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              stats.winRate >= 50 ? "bg-success/10" : "bg-warning/10"
            )}>
              <Target className={cn("h-5 w-5", stats.winRate >= 50 ? "text-success" : "text-warning")} />
            </div>
          </div>
        </Link>
        <Link href="/ticketing" className="card hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Response Time</p>
              <p className="text-2xl font-bold text-foreground">{stats.responseTime}h</p>
            </div>
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              stats.responseTime <= 4 ? "bg-success/10" : "bg-warning/10"
            )}>
              <Clock className={cn("h-5 w-5", stats.responseTime <= 4 ? "text-success" : "text-warning")} />
            </div>
          </div>
          {stats.responseTimeChange !== 0 && (
            <div className={cn(
              "flex items-center gap-1 mt-2 text-xs font-medium",
              stats.responseTimeChange <= 0 ? "text-success" : "text-destructive"
            )}>
              {stats.responseTimeChange <= 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
              {stats.responseTimeChange}% vs last period
            </div>
          )}
        </Link>
        <Link href="/ticketing?type=inquiry+tariff" className="card hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending RFQ</p>
              <p className="text-2xl font-bold text-foreground">{stats.pendingRFQ}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10">
              <Ticket className="h-5 w-5 text-info" />
            </div>
          </div>
        </Link>
      </div>

      {/* Charts & Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Revenue Overview</h3>
                <p className="text-sm text-muted-foreground">Monthly revenue trend (last 12 months)</p>
              </div>
              <Link href="/dso" className="btn-outline btn-sm">
                View Report
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </div>
            <RevenueChart />
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="card h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Lead Sources</h3>
              <Link href="/crm/leads" className="btn-ghost h-8 w-8 p-0">
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="space-y-3">
              {stats.leadSources.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No lead data</p>
              ) : (
                stats.leadSources.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-3 w-3 rounded-full", item.color)} />
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                    </div>
                    <span className="font-medium text-foreground">{item.value}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="card-flush">
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Recent Activities</h3>
            <p className="text-sm text-muted-foreground">Latest updates across modules</p>
          </div>
          <Link href="/crm/leads" className="btn-outline btn-sm">
            View All
            <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-y border-border bg-muted/30">
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Details</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activities.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    No recent activities
                  </td>
                </tr>
              ) : (
                activities.map((activity) => (
                  <tr key={activity.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                    <td className="px-6 py-4">
                      <div className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg",
                        activity.type === "lead" && "bg-primary/10",
                        activity.type === "ticket" && "bg-info/10",
                        activity.type === "invoice" && "bg-warning/10",
                        activity.type === "activity" && "bg-success/10"
                      )}>
                        {activity.type === "lead" && <Users className="h-4 w-4 text-primary" />}
                        {activity.type === "ticket" && <Ticket className="h-4 w-4 text-info" />}
                        {activity.type === "invoice" && <FileText className="h-4 w-4 text-warning" />}
                        {activity.type === "activity" && <Activity className="h-4 w-4 text-success" />}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-foreground">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">{activity.description}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "badge text-xs",
                        activity.status === "New" && "badge-primary",
                        (activity.status === "OPEN" || activity.status === "IN PROGRESS") && "badge-info",
                        (activity.status === "CLOSED" || activity.status === "Closed Won") && "badge-success",
                        (activity.status === "CLOSED LOST" || activity.status === "Closed Lost") && "badge-destructive"
                      )}>
                        {activity.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground">{activity.time}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

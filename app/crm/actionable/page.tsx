"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  Phone,
  Mail,
  Video,
  Users,
  Briefcase,
  ArrowRight,
  Loader2,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CalendarDays,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchJson, isSuccess } from "@/lib/api/fetchJson";
import { toastSuccess, toastError, toast } from "@/lib/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

// Types for actionable items
interface UnclaimedLead {
  lead_id: string;
  company_name: string;
  pic_name: string;
  contact_phone: string;
  email: string;
  service_code: string;
  triage_status: string;
  qualified_at: string | null;
  sla_deadline: string | null;
  created_at: string;
}

interface MissingDueDateOpp {
  opportunity_id: string;
  name: string;
  stage: string;
  next_step: string | null;
  next_step_due_date: string | null;
  account: { account_id: string; company_name: string } | null;
  owner: { user_id: string; full_name: string } | null;
  created_at: string;
}

interface ActionableActivity {
  activity_id: string;
  activity_type: string;
  subject: string;
  due_date: string | null;
  scheduled_at: string | null;
  account: { account_id: string; company_name: string } | null;
  opportunity: { opportunity_id: string; name: string; stage: string } | null;
  lead: { lead_id: string; company_name: string } | null;
  owner: { user_id: string; full_name: string } | null;
  created_at: string;
}

interface ActionableData {
  leads: {
    unclaimed: UnclaimedLead[];
    count: number;
  };
  opportunities: {
    missing_due_date: MissingDueDateOpp[];
    count: number;
  };
  activities: {
    overdue: ActionableActivity[];
    today: ActionableActivity[];
    upcoming: ActionableActivity[];
    overdue_count: number;
    today_count: number;
    upcoming_count: number;
  };
  summary: {
    total_actionable: number;
    leads_unclaimed: number;
    opps_missing_due_date: number;
    activities_overdue: number;
    activities_today: number;
    activities_upcoming: number;
  };
}

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  Call: Phone,
  Email: Mail,
  "Online Meeting": Video,
  Visit: Calendar,
  default: Clock,
};

type TabType = "leads" | "opportunities" | "overdue" | "today" | "upcoming";

export default function ActionablePage() {
  const router = useRouter();
  const [data, setData] = React.useState<ActionableData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<TabType>("overdue");
  const [claiming, setClaiming] = React.useState<string | null>(null);
  const [completing, setCompleting] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchJson<ActionableData>("/api/crm/actionable", {
        showErrorToast: true,
      });

      if (isSuccess(result)) {
        setData(result.data);
        // Auto-select first non-empty tab
        if (result.data.activities.overdue_count > 0) {
          setActiveTab("overdue");
        } else if (result.data.activities.today_count > 0) {
          setActiveTab("today");
        } else if (result.data.activities.upcoming_count > 0) {
          setActiveTab("upcoming");
        } else if (result.data.leads.count > 0) {
          setActiveTab("leads");
        } else if (result.data.opportunities.count > 0) {
          setActiveTab("opportunities");
        }
      }
    } catch (err) {
      console.error("Error fetching actionable data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleClaimLead = async (leadId: string, companyName: string) => {
    setClaiming(leadId);
    try {
      const result = await fetchJson<{
        success: boolean;
        lead_id: string;
        account_id: string;
        opportunity_id: string;
        activity_id: string;
      }>(`/api/crm/leads/${leadId}/claim`, {
        method: "POST",
        showErrorToast: true,
        showSuccessToast: false,
      });

      if (isSuccess(result) && result.data.success) {
        const { opportunity_id } = result.data;
        toast({
          variant: "success",
          title: "Lead Claimed Successfully",
          description: `${companyName} is now assigned to you.`,
          action: (
            <ToastAction
              altText="View Opportunity"
              onClick={() => router.push(`/crm/opportunities/${opportunity_id}`)}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View
            </ToastAction>
          ),
        });
        fetchData();
      }
    } catch (err) {
      console.error("Error claiming lead:", err);
      toastError("Error", "Failed to claim lead");
    } finally {
      setClaiming(null);
    }
  };

  const handleCompleteActivity = async (activityId: string) => {
    setCompleting(activityId);
    try {
      const res = await fetch(`/api/crm/activities/${activityId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: "Completed",
          create_next: false,
        }),
      });

      if (res.ok) {
        toastSuccess("Activity Completed", "Activity marked as done");
        fetchData();
      } else {
        const resData = await res.json();
        toastError("Error", resData.error?.message || "Failed to complete activity");
      }
    } catch (err) {
      console.error("Error completing activity:", err);
      toastError("Error", "Failed to complete activity");
    } finally {
      setCompleting(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getDaysOverdue = (dateStr: string | null) => {
    if (!dateStr) return 0;
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 skeleton" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 skeleton rounded-xl" />
          ))}
        </div>
        <div className="h-96 skeleton rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load data</p>
      </div>
    );
  }

  const isAllClear =
    data.summary.total_actionable === 0 ||
    (data.summary.leads_unclaimed === 0 &&
      data.summary.opps_missing_due_date === 0 &&
      data.summary.activities_overdue === 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Actionable Items</h1>
          <p className="text-muted-foreground">
            No record left behind - all items requiring attention
          </p>
        </div>
        <button
          onClick={() => fetchData()}
          disabled={loading}
          className="btn-outline h-10"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Overdue Activities */}
        <button
          onClick={() => setActiveTab("overdue")}
          className={cn(
            "card flex flex-col items-center justify-center p-4 text-center transition-all",
            activeTab === "overdue" && "ring-2 ring-destructive",
            data.summary.activities_overdue > 0 && "bg-destructive/5"
          )}
        >
          <AlertTriangle
            className={cn(
              "h-6 w-6 mb-2",
              data.summary.activities_overdue > 0 ? "text-destructive" : "text-muted-foreground"
            )}
          />
          <p className="text-2xl font-bold">{data.summary.activities_overdue}</p>
          <p className="text-xs text-muted-foreground">Overdue</p>
        </button>

        {/* Today Activities */}
        <button
          onClick={() => setActiveTab("today")}
          className={cn(
            "card flex flex-col items-center justify-center p-4 text-center transition-all",
            activeTab === "today" && "ring-2 ring-warning",
            data.summary.activities_today > 0 && "bg-warning/5"
          )}
        >
          <CalendarDays
            className={cn(
              "h-6 w-6 mb-2",
              data.summary.activities_today > 0 ? "text-warning" : "text-muted-foreground"
            )}
          />
          <p className="text-2xl font-bold">{data.summary.activities_today}</p>
          <p className="text-xs text-muted-foreground">Due Today</p>
        </button>

        {/* Upcoming Activities */}
        <button
          onClick={() => setActiveTab("upcoming")}
          className={cn(
            "card flex flex-col items-center justify-center p-4 text-center transition-all",
            activeTab === "upcoming" && "ring-2 ring-info"
          )}
        >
          <CalendarClock className="h-6 w-6 mb-2 text-info" />
          <p className="text-2xl font-bold">{data.summary.activities_upcoming}</p>
          <p className="text-xs text-muted-foreground">Upcoming (7d)</p>
        </button>

        {/* Unclaimed Leads */}
        <button
          onClick={() => setActiveTab("leads")}
          className={cn(
            "card flex flex-col items-center justify-center p-4 text-center transition-all",
            activeTab === "leads" && "ring-2 ring-primary",
            data.summary.leads_unclaimed > 0 && "bg-primary/5"
          )}
        >
          <Users
            className={cn(
              "h-6 w-6 mb-2",
              data.summary.leads_unclaimed > 0 ? "text-primary" : "text-muted-foreground"
            )}
          />
          <p className="text-2xl font-bold">{data.summary.leads_unclaimed}</p>
          <p className="text-xs text-muted-foreground">Unclaimed Leads</p>
        </button>

        {/* Opportunities Missing Due Date */}
        <button
          onClick={() => setActiveTab("opportunities")}
          className={cn(
            "card flex flex-col items-center justify-center p-4 text-center transition-all",
            activeTab === "opportunities" && "ring-2 ring-orange-500",
            data.summary.opps_missing_due_date > 0 && "bg-orange-500/5"
          )}
        >
          <AlertCircle
            className={cn(
              "h-6 w-6 mb-2",
              data.summary.opps_missing_due_date > 0 ? "text-orange-500" : "text-muted-foreground"
            )}
          />
          <p className="text-2xl font-bold">{data.summary.opps_missing_due_date}</p>
          <p className="text-xs text-muted-foreground">Opps Missing Date</p>
        </button>

        {/* Total Summary */}
        <div
          className={cn(
            "card flex flex-col items-center justify-center p-4 text-center",
            isAllClear && "bg-success/5"
          )}
        >
          <CheckCircle
            className={cn(
              "h-6 w-6 mb-2",
              isAllClear ? "text-success" : "text-muted-foreground"
            )}
          />
          <p className="text-2xl font-bold">{data.summary.total_actionable}</p>
          <p className="text-xs text-muted-foreground">Total Items</p>
        </div>
      </div>

      {/* All Clear Message */}
      {isAllClear && (
        <div className="card bg-success/10 border-success/20 p-6 text-center">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 text-success" />
          <h3 className="text-lg font-semibold text-success">All Clear!</h3>
          <p className="text-muted-foreground mt-2">
            No urgent items require attention. Great job keeping everything on track!
          </p>
        </div>
      )}

      {/* Content Tabs */}
      {!isAllClear && (
        <div className="card-flush">
          {/* Overdue Activities Tab */}
          {activeTab === "overdue" && (
            <>
              <div className="p-4 border-b border-border">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Overdue Activities ({data.activities.overdue_count})
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Activities past their due date that need immediate attention
                </p>
              </div>
              <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {data.activities.overdue.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-success" />
                    <p>No overdue activities. You&apos;re on top of things!</p>
                  </div>
                ) : (
                  data.activities.overdue.map((activity) => (
                    <ActivityRow
                      key={activity.activity_id}
                      activity={activity}
                      variant="overdue"
                      completing={completing}
                      onComplete={handleCompleteActivity}
                      getDaysOverdue={getDaysOverdue}
                      formatDate={formatDate}
                    />
                  ))
                )}
              </div>
            </>
          )}

          {/* Today Activities Tab */}
          {activeTab === "today" && (
            <>
              <div className="p-4 border-b border-border">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-warning" />
                  Due Today ({data.activities.today_count})
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Activities scheduled for today
                </p>
              </div>
              <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {data.activities.today.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p>No activities due today</p>
                  </div>
                ) : (
                  data.activities.today.map((activity) => (
                    <ActivityRow
                      key={activity.activity_id}
                      activity={activity}
                      variant="today"
                      completing={completing}
                      onComplete={handleCompleteActivity}
                      getDaysOverdue={getDaysOverdue}
                      formatDate={formatDate}
                    />
                  ))
                )}
              </div>
            </>
          )}

          {/* Upcoming Activities Tab */}
          {activeTab === "upcoming" && (
            <>
              <div className="p-4 border-b border-border">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <CalendarClock className="h-5 w-5 text-info" />
                  Upcoming (7 Days) ({data.activities.upcoming_count})
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Planned activities for the next week
                </p>
              </div>
              <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {data.activities.upcoming.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p>No upcoming activities in the next 7 days</p>
                  </div>
                ) : (
                  data.activities.upcoming.map((activity) => (
                    <ActivityRow
                      key={activity.activity_id}
                      activity={activity}
                      variant="upcoming"
                      completing={completing}
                      onComplete={handleCompleteActivity}
                      getDaysOverdue={getDaysOverdue}
                      formatDate={formatDate}
                    />
                  ))
                )}
              </div>
            </>
          )}

          {/* Unclaimed Leads Tab */}
          {activeTab === "leads" && (
            <>
              <div className="p-4 border-b border-border">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Unclaimed Qualified Leads ({data.leads.count})
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Leads qualified but not yet claimed by sales - these need attention!
                </p>
              </div>
              <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {data.leads.unclaimed.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-success" />
                    <p>All qualified leads have been claimed</p>
                  </div>
                ) : (
                  data.leads.unclaimed.map((lead) => (
                    <div
                      key={lead.lead_id}
                      className="p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-medium">
                            {lead.company_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{lead.company_name}</p>
                            <p className="text-sm text-muted-foreground">{lead.pic_name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {lead.service_code}
                              </span>
                              <span className="text-xs text-muted-foreground">&bull;</span>
                              <span className="text-xs text-muted-foreground">
                                {lead.contact_phone}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                  lead.triage_status === "Qualified"
                                    ? "bg-success/10 text-success"
                                    : "bg-warning/10 text-warning"
                                )}
                              >
                                {lead.triage_status === "Handed Over"
                                  ? "In Sales Pool"
                                  : lead.triage_status}
                              </span>
                              {lead.sla_deadline && (
                                <span className="text-xs text-muted-foreground">
                                  SLA: {formatDate(lead.sla_deadline)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {lead.triage_status === "Handed Over" ? (
                            <button
                              onClick={() => handleClaimLead(lead.lead_id, lead.company_name)}
                              disabled={claiming === lead.lead_id}
                              className="btn-primary h-8 px-3 text-sm"
                            >
                              {claiming === lead.lead_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <ArrowRight className="h-4 w-4 mr-1" />
                                  Claim
                                </>
                              )}
                            </button>
                          ) : (
                            <Link
                              href="/crm/lead-inbox"
                              className="btn-outline h-8 px-3 text-sm"
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              Send to Pool
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* Opportunities Missing Due Date Tab */}
          {activeTab === "opportunities" && (
            <>
              <div className="p-4 border-b border-border">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  Opportunities Missing Due Date ({data.opportunities.count})
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Open opportunities without next_step_due_date - SSOT violation smoke test
                </p>
              </div>
              <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {data.opportunities.missing_due_date.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-success" />
                    <p>All opportunities have due dates set. SSOT guardrails working!</p>
                  </div>
                ) : (
                  data.opportunities.missing_due_date.map((opp) => (
                    <div
                      key={opp.opportunity_id}
                      className="p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                            <Briefcase className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{opp.name}</p>
                            {opp.account && (
                              <Link
                                href={`/crm/accounts/${opp.account.account_id}`}
                                className="text-sm text-primary hover:underline"
                              >
                                {opp.account.company_name}
                              </Link>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                                {opp.stage}
                              </span>
                              {opp.owner && (
                                <span className="text-xs text-muted-foreground">
                                  Owner: {opp.owner.full_name}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-destructive mt-1">
                              Missing: next_step_due_date
                            </p>
                          </div>
                        </div>
                        <Link
                          href={`/crm/opportunities/${opp.opportunity_id}`}
                          className="btn-outline h-8 px-3 text-sm"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Fix
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Quick Links Footer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/crm/lead-inbox" className="card p-4 hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <span className="font-medium">Lead Triage Queue</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Qualify & handover leads</p>
        </Link>
        <Link href="/crm/sales-inbox" className="card p-4 hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-warning" />
            <span className="font-medium">My Work Queue</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Daily follow-ups</p>
        </Link>
        <Link href="/crm/pipeline" className="card p-4 hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-3">
            <Briefcase className="h-5 w-5 text-info" />
            <span className="font-medium">Sales Pipeline</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Track opportunities</p>
        </Link>
        <Link href="/crm/activities" className="card p-4 hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-success" />
            <span className="font-medium">Activity Planner</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Schedule activities</p>
        </Link>
      </div>
    </div>
  );
}

// Activity Row Component
function ActivityRow({
  activity,
  variant,
  completing,
  onComplete,
  getDaysOverdue,
  formatDate,
}: {
  activity: ActionableActivity;
  variant: "overdue" | "today" | "upcoming";
  completing: string | null;
  onComplete: (id: string) => void;
  getDaysOverdue: (date: string | null) => number;
  formatDate: (date: string | null) => string;
}) {
  const Icon = ACTIVITY_ICONS[activity.activity_type] || ACTIVITY_ICONS.default;
  const daysOverdue = getDaysOverdue(activity.due_date);

  // Determine link destination based on related entity
  const getDestinationLink = () => {
    if (activity.opportunity) {
      return `/crm/opportunities/${activity.opportunity.opportunity_id}`;
    }
    if (activity.account) {
      return `/crm/accounts/${activity.account.account_id}`;
    }
    return "/crm/activities";
  };

  const getRelatedName = () => {
    if (activity.opportunity) return activity.opportunity.name;
    if (activity.account) return activity.account.company_name;
    if (activity.lead) return activity.lead.company_name;
    return null;
  };

  return (
    <div className="p-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              variant === "overdue" && "bg-destructive/10",
              variant === "today" && "bg-warning/10",
              variant === "upcoming" && "bg-info/10"
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5",
                variant === "overdue" && "text-destructive",
                variant === "today" && "text-warning",
                variant === "upcoming" && "text-info"
              )}
            />
          </div>
          <div>
            <p className="font-medium text-foreground">{activity.subject}</p>
            {getRelatedName() && (
              <Link
                href={getDestinationLink()}
                className="text-sm text-primary hover:underline"
              >
                {getRelatedName()}
              </Link>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">{activity.activity_type}</span>
              {activity.due_date && (
                <>
                  <span className="text-xs text-muted-foreground">&bull;</span>
                  <span
                    className={cn(
                      "text-xs",
                      variant === "overdue" && "text-destructive font-medium"
                    )}
                  >
                    {variant === "overdue"
                      ? `${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue`
                      : `Due: ${formatDate(activity.due_date)}`}
                  </span>
                </>
              )}
            </div>
            {activity.owner && (
              <p className="text-xs text-muted-foreground mt-1">
                Owner: {activity.owner.full_name}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={getDestinationLink()} className="btn-ghost h-8 px-3 text-sm">
            <ExternalLink className="h-4 w-4 mr-1" />
            View
          </Link>
          <button
            onClick={() => onComplete(activity.activity_id)}
            disabled={completing === activity.activity_id}
            className="btn-primary h-8 px-3 text-sm"
          >
            {completing === activity.activity_id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                Done
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

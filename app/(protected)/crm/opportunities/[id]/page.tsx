"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  TrendingUp,
  Users,
  Calendar,
  Activity,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Briefcase,
  Target,
  FileText,
  ExternalLink,
  History,
  Edit3,
  PhoneCall,
  AlertCircle,
  Loader2,
  ArrowRight,
  User,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toastError, toastSuccess } from "@/lib/hooks/use-toast";
import { cn } from "@/lib/utils";
import { fetchJson, isSuccess } from "@/lib/api/fetchJson";
import { toastMessages } from "@/lib/terminology/labels";

interface Opportunity {
  opportunity_id: string;
  name: string;
  stage: string;
  estimated_value: number | null;
  currency: string;
  probability: number | null;
  expected_close_date: string | null;
  service_codes: string[] | null;
  route: string | null;
  next_step: string;
  next_step_due_date: string;
  notes: string | null;
  lost_reason: string | null;
  competitor: string | null;
  created_at: string;
  closed_at: string | null;
  account: {
    account_id: string;
    company_name: string;
    domain: string | null;
    city: string | null;
    pic_name: string;
    pic_phone: string;
    pic_email: string;
    tenure_status: string;
    activity_status: string;
  } | null;
  owner: {
    user_id: string;
    full_name: string;
    role_name: string;
  } | null;
  source_lead: {
    lead_id: string;
    company_name: string;
    pic_name: string;
    service_code: string;
    primary_channel: string;
    campaign_name: string | null;
  } | null;
}

interface ActivityItem {
  activity_id: string;
  activity_type: string;
  status: string;
  subject: string;
  description: string | null;
  due_date: string | null;
  completed_at: string | null;
  outcome: string | null;
  owner: { user_id: string; full_name: string } | null;
}

interface Contact {
  contact_id: string;
  first_name: string;
  last_name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  is_decision_maker: boolean;
}

interface StageHistoryItem {
  id: string;
  action: string;
  action_label: string | null;
  from_state: { stage?: string } | null;
  to_state: { stage?: string } | null;
  changed_fields: string[] | null;
  actor_name: string | null;
  actor_role: string | null;
  created_at: string;
  correlation_id: string | null;
}

const STAGE_ORDER = [
  "Prospecting",
  "Discovery",
  "Proposal Sent",
  "Quote Sent",
  "Negotiation",
  "Verbal Commit",
  "Closed Won",
  "Closed Lost",
];

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  Call: Phone,
  Email: Mail,
  "Online Meeting": Calendar,
  Visit: MapPin,
  default: Activity,
};

export default function OpportunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const opportunityId = params.id as string;

  const [data, setData] = React.useState<{
    opportunity: Opportunity | null;
    activities: ActivityItem[];
    contacts: Contact[];
    stageHistory: StageHistoryItem[];
  }>({
    opportunity: null,
    activities: [],
    contacts: [],
    stageHistory: [],
  });
  const [loading, setLoading] = React.useState(true);

  // Quick action modals state
  const [showNextStepModal, setShowNextStepModal] = React.useState(false);
  const [showStageModal, setShowStageModal] = React.useState(false);
  const [showLogCallModal, setShowLogCallModal] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const [nextStepData, setNextStepData] = React.useState({
    next_step: "",
    next_step_due_date: "",
  });

  const [stageData, setStageData] = React.useState({
    new_stage: "",
    next_step: "",
    next_step_due_date: "",
    lost_reason: "",
    outcome: "",
  });

  const [logCallData, setLogCallData] = React.useState({
    subject: "",
    outcome: "",
    duration_minutes: "",
  });

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    const result = await fetchJson<{
      opportunity: Opportunity;
      activities: ActivityItem[];
      contacts: Contact[];
      stageHistory: StageHistoryItem[];
    }>(`/api/crm/opportunities/${opportunityId}`, {
      showErrorToast: true,
      errorMessage: toastMessages.errorLoading,
    });

    if (isSuccess(result)) {
      setData(result.data);
    }
    setLoading(false);
  }, [opportunityId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (value: number | null | undefined, currency = "IDR") => {
    if (!value) return "-";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStageColor = (stage: string) => {
    if (stage === "Closed Won") return "bg-success text-white";
    if (stage === "Closed Lost") return "bg-destructive text-white";
    if (stage === "On Hold") return "bg-muted text-muted-foreground";
    if (["Negotiation", "Verbal Commit"].includes(stage)) return "bg-primary text-white";
    if (["Quote Sent", "Proposal Sent"].includes(stage)) return "bg-warning text-white";
    return "bg-info text-white";
  };

  const getStageProgress = (stage: string) => {
    const index = STAGE_ORDER.indexOf(stage);
    if (index === -1) return 0;
    if (stage === "Closed Won") return 100;
    if (stage === "Closed Lost") return 0;
    return Math.round(((index + 1) / (STAGE_ORDER.length - 2)) * 100);
  };

  const getActivityStatusColor = (status: string) => {
    switch (status) {
      case "Done": return "text-success bg-success/10";
      case "Cancelled": return "text-muted-foreground bg-muted";
      default: return "text-primary bg-primary/10";
    }
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const formatDateTime = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActionLabel = (action: string, actionLabel: string | null, fromState: StageHistoryItem["from_state"], toState: StageHistoryItem["to_state"]) => {
    if (actionLabel) return actionLabel;

    switch (action) {
      case "OPPORTUNITY_CREATED":
        return "Opportunity created";
      case "OPPORTUNITY_STAGE_CHANGED":
        return `Stage: ${fromState?.stage || "?"} → ${toState?.stage || "?"}`;
      case "OPPORTUNITY_WON":
        return "Closed Won";
      case "OPPORTUNITY_LOST":
        return "Closed Lost";
      case "OPPORTUNITY_UPDATED":
        return "Details updated";
      default:
        return action.replace(/_/g, " ").toLowerCase();
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "OPPORTUNITY_CREATED":
        return <Target className="h-4 w-4" />;
      case "OPPORTUNITY_STAGE_CHANGED":
        return <ArrowRight className="h-4 w-4" />;
      case "OPPORTUNITY_WON":
        return <CheckCircle className="h-4 w-4" />;
      case "OPPORTUNITY_LOST":
        return <XCircle className="h-4 w-4" />;
      case "OPPORTUNITY_UPDATED":
        return <Edit3 className="h-4 w-4" />;
      default:
        return <History className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "OPPORTUNITY_CREATED":
        return "bg-info/10 text-info border-info/20";
      case "OPPORTUNITY_STAGE_CHANGED":
        return "bg-primary/10 text-primary border-primary/20";
      case "OPPORTUNITY_WON":
        return "bg-success/10 text-success border-success/20";
      case "OPPORTUNITY_LOST":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "OPPORTUNITY_UPDATED":
        return "bg-muted text-muted-foreground border-border";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  // Quick action handlers
  const handleUpdateNextStep = async () => {
    if (!nextStepData.next_step || !nextStepData.next_step_due_date) {
      setActionError("Next step and due date are required");
      return;
    }

    setSubmitting(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/crm/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          next_step: nextStepData.next_step,
          next_step_due_date: nextStepData.next_step_due_date,
        }),
      });

      if (res.ok) {
        toastSuccess("Updated", "Next step updated successfully");
        setShowNextStepModal(false);
        fetchData();
      } else {
        const data = await res.json();
        setActionError(data.error?.message || "Failed to update");
        toastError("Error", data.error?.message || "Failed to update");
      }
    } catch {
      toastError("Error", "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStageChange = async () => {
    if (!stageData.next_step || !stageData.next_step_due_date) {
      setActionError("Next step and due date are required");
      return;
    }

    if (stageData.new_stage === "Closed Lost" && !stageData.lost_reason) {
      setActionError("Lost reason is required");
      return;
    }

    if (stageData.new_stage === "Closed Won" && !stageData.outcome) {
      setActionError("Win reason is required");
      return;
    }

    setSubmitting(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/crm/opportunities/${opportunityId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          new_stage: stageData.new_stage,
          next_step: stageData.next_step,
          next_step_due_date: stageData.next_step_due_date,
          lost_reason: stageData.lost_reason || null,
          outcome: stageData.outcome || null,
        }),
      });

      const responseData = await res.json();

      if (res.ok) {
        toastSuccess("Stage Updated", `Moved to ${stageData.new_stage}`);
        setShowStageModal(false);
        fetchData();
      } else if (res.status === 409) {
        const missingFields = responseData.error?.details?.field_labels as Array<{ field: string; label: string }> | undefined;
        if (missingFields && missingFields.length > 0) {
          const fieldList = missingFields.map((f) => f.label).join(", ");
          setActionError(`Missing required: ${fieldList}`);
        } else {
          setActionError(responseData.error?.message || "Stage transition blocked");
        }
      } else {
        setActionError(responseData.error?.message || "Failed to change stage");
      }
    } catch {
      toastError("Error", "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogCall = async () => {
    if (!logCallData.subject) {
      setActionError("Subject is required");
      return;
    }

    setSubmitting(true);
    setActionError(null);

    try {
      const res = await fetch("/api/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_type: "Call",
          status: "Done",
          subject: logCallData.subject,
          outcome: logCallData.outcome || null,
          duration_minutes: logCallData.duration_minutes ? parseInt(logCallData.duration_minutes, 10) : null,
          related_opportunity_id: opportunityId,
          related_account_id: data.opportunity?.account?.account_id,
          completed_at: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        toastSuccess("Call Logged", "Activity recorded successfully");
        setShowLogCallModal(false);
        setLogCallData({ subject: "", outcome: "", duration_minutes: "" });
        fetchData();
      } else {
        const responseData = await res.json();
        setActionError(responseData.error?.message || "Failed to log call");
        toastError("Error", responseData.error?.message || "Failed to log call");
      }
    } catch {
      toastError("Error", "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const openNextStepModal = () => {
    setNextStepData({
      next_step: data.opportunity?.next_step || "",
      next_step_due_date: data.opportunity?.next_step_due_date?.split("T")[0] || new Date().toISOString().split("T")[0],
    });
    setActionError(null);
    setShowNextStepModal(true);
  };

  const openStageModal = (targetStage?: string) => {
    const defaultNextSteps: Record<string, string> = {
      Prospecting: "Initial contact call",
      Discovery: "Discovery meeting",
      "Proposal Sent": "Follow up on proposal",
      "Quote Sent": "Follow up on quote",
      Negotiation: "Final negotiation meeting",
      "Verbal Commit": "Contract signing",
      "Closed Won": "Onboarding",
      "Closed Lost": "Closed",
    };

    const stage = targetStage || STAGE_ORDER[STAGE_ORDER.indexOf(data.opportunity?.stage || "") + 1] || "Discovery";

    setStageData({
      new_stage: stage,
      next_step: defaultNextSteps[stage] || "Follow up",
      next_step_due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      lost_reason: "",
      outcome: "",
    });
    setActionError(null);
    setShowStageModal(true);
  };

  const openLogCallModal = () => {
    setLogCallData({
      subject: `Call with ${data.opportunity?.account?.company_name || "prospect"}`,
      outcome: "",
      duration_minutes: "",
    });
    setActionError(null);
    setShowLogCallModal(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 skeleton" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 skeleton rounded-xl" />
          <div className="h-96 skeleton rounded-xl" />
        </div>
      </div>
    );
  }

  const { opportunity, activities, contacts } = data;

  if (!opportunity) {
    return (
      <div className="text-center py-12">
        <Briefcase className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">Opportunity not found</p>
        <Link href="/crm/pipeline" className="btn-outline mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Pipeline
        </Link>
      </div>
    );
  }

  const plannedActivities = activities.filter((a) => a.status === "Planned");
  const completedActivities = activities.filter((a) => a.status === "Done");

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Back */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/crm/pipeline" className="hover:text-foreground transition-colors">
          Sales Pipeline
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{opportunity.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-2xl">
            <Target className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{opportunity.name}</h1>
            {opportunity.account && (
              <Link
                href={`/crm/accounts/${opportunity.account.account_id}`}
                className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <Building2 className="h-4 w-4" />
                {opportunity.account.company_name}
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className={cn("px-3 py-1 rounded-full text-sm font-medium", getStageColor(opportunity.stage))}>
                {opportunity.stage}
              </span>
              {opportunity.probability !== null && (
                <span className="text-sm text-muted-foreground">
                  {opportunity.probability}% probability
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={openLogCallModal} className="btn-outline h-9">
            <PhoneCall className="h-4 w-4 mr-2" />
            Log Call
          </button>
          <button onClick={openNextStepModal} className="btn-outline h-9">
            <Edit3 className="h-4 w-4 mr-2" />
            Update Next Step
          </button>
          {!["Closed Won", "Closed Lost"].includes(opportunity.stage) && (
            <button onClick={() => openStageModal()} className="btn-primary h-9">
              <ArrowRight className="h-4 w-4 mr-2" />
              Move Stage
            </button>
          )}
        </div>
      </div>

      {/* Stage Progress */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-foreground">Stage Progress</h3>
          <span className="text-sm text-muted-foreground">{getStageProgress(opportunity.stage)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              opportunity.stage === "Closed Won" ? "bg-success" :
              opportunity.stage === "Closed Lost" ? "bg-destructive" : "bg-primary"
            )}
            style={{ width: `${getStageProgress(opportunity.stage)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          {STAGE_ORDER.slice(0, -2).map((stage) => (
            <span
              key={stage}
              className={cn(
                STAGE_ORDER.indexOf(opportunity.stage) >= STAGE_ORDER.indexOf(stage)
                  ? "text-primary font-medium"
                  : ""
              )}
            >
              {stage}
            </span>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Key Details */}
          <div className="card">
            <h2 className="font-semibold text-foreground mb-4">Opportunity Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Estimated Value:</span>
                <span className="text-foreground font-medium">
                  {formatCurrency(opportunity.estimated_value, opportunity.currency)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Expected Close:</span>
                <span className="text-foreground">{formatDate(opportunity.expected_close_date)}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Next Step:</span>
                <span className="text-foreground">{opportunity.next_step}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Due Date:</span>
                <span className={cn(
                  "text-foreground",
                  isOverdue(opportunity.next_step_due_date) && "text-destructive font-medium"
                )}>
                  {formatDate(opportunity.next_step_due_date)}
                </span>
              </div>
              {opportunity.service_codes && opportunity.service_codes.length > 0 && (
                <div className="flex items-center gap-3 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Services:</span>
                  <span className="text-foreground">{opportunity.service_codes.join(", ")}</span>
                </div>
              )}
              {opportunity.route && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Route:</span>
                  <span className="text-foreground">{opportunity.route}</span>
                </div>
              )}
              {opportunity.owner && (
                <div className="flex items-center gap-3 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Owner:</span>
                  <span className="text-foreground">{opportunity.owner.full_name}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Created:</span>
                <span className="text-foreground">{formatDate(opportunity.created_at)}</span>
              </div>
            </div>
            {opportunity.notes && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">Notes:</p>
                <p className="text-sm text-foreground mt-1">{opportunity.notes}</p>
              </div>
            )}
            {opportunity.stage === "Closed Lost" && opportunity.lost_reason && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-destructive font-medium">Lost Reason:</p>
                <p className="text-sm text-foreground mt-1">{opportunity.lost_reason}</p>
                {opportunity.competitor && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Competitor: {opportunity.competitor}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Activities */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Activities</h2>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  {plannedActivities.length} planned
                </span>
                <span className="text-muted-foreground">
                  {completedActivities.length} completed
                </span>
              </div>
            </div>
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No activities yet</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {activities.map((activity) => {
                  const Icon = ACTIVITY_ICONS[activity.activity_type] || ACTIVITY_ICONS.default;
                  return (
                    <div
                      key={activity.activity_id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg",
                        activity.status === "Done" ? "bg-muted/30" : "bg-card border border-border"
                      )}
                    >
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg",
                        getActivityStatusColor(activity.status)
                      )}>
                        {activity.status === "Done" ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : activity.status === "Cancelled" ? (
                          <XCircle className="h-4 w-4" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            "font-medium text-sm",
                            activity.status === "Done" ? "text-muted-foreground" : "text-foreground"
                          )}>
                            {activity.subject}
                          </p>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-xs font-medium shrink-0",
                            getActivityStatusColor(activity.status)
                          )}>
                            {activity.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {activity.status === "Done"
                              ? `Completed ${formatDate(activity.completed_at)}`
                              : `Due ${formatDate(activity.due_date)}`}
                          </span>
                          {activity.owner && (
                            <span>{activity.owner.full_name}</span>
                          )}
                        </div>
                        {activity.outcome && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Outcome: {activity.outcome}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Source Lead Info */}
          {opportunity.source_lead && (
            <div className="card">
              <h2 className="font-semibold text-foreground mb-4">Source Lead</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Company:</span>
                  <span className="text-foreground ml-2">{opportunity.source_lead.company_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Contact:</span>
                  <span className="text-foreground ml-2">{opportunity.source_lead.pic_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Service:</span>
                  <span className="text-foreground ml-2">{opportunity.source_lead.service_code}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Channel:</span>
                  <span className="text-foreground ml-2">{opportunity.source_lead.primary_channel}</span>
                </div>
                {opportunity.source_lead.campaign_name && (
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Campaign:</span>
                    <span className="text-foreground ml-2">{opportunity.source_lead.campaign_name}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Account Card */}
          {opportunity.account && (
            <div className="card">
              <h2 className="font-semibold text-foreground mb-4">Account</h2>
              <div className="space-y-3">
                <Link
                  href={`/crm/accounts/${opportunity.account.account_id}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-medium">
                    {opportunity.account.company_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {opportunity.account.company_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {opportunity.account.city || "No location"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{opportunity.account.pic_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{opportunity.account.pic_phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground truncate">{opportunity.account.pic_email}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Contacts */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Contacts</h2>
              <span className="text-sm text-muted-foreground">{contacts.length}</span>
            </div>
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No contacts</p>
            ) : (
              <div className="space-y-3">
                {contacts.slice(0, 5).map((contact) => (
                  <div key={contact.contact_id} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-medium">
                      {contact.first_name.charAt(0)}
                      {contact.last_name?.charAt(0) || ""}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground text-sm">
                          {contact.first_name} {contact.last_name}
                        </p>
                        {contact.is_primary && (
                          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs">
                            Primary
                          </span>
                        )}
                        {contact.is_decision_maker && (
                          <span className="px-1.5 py-0.5 rounded bg-warning/10 text-warning text-xs">
                            DM
                          </span>
                        )}
                      </div>
                      {contact.title && (
                        <p className="text-xs text-muted-foreground">{contact.title}</p>
                      )}
                      {contact.phone && (
                        <p className="text-xs text-muted-foreground">{contact.phone}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="card">
            <h2 className="font-semibold text-foreground mb-4">Quick Stats</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Activities</span>
                <span className="text-foreground font-medium">{activities.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Planned Activities</span>
                <span className="text-foreground font-medium">{plannedActivities.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Completed</span>
                <span className="text-foreground font-medium">{completedActivities.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Days in Pipeline</span>
                <span className="text-foreground font-medium">
                  {Math.floor((Date.now() - new Date(opportunity.created_at).getTime()) / (1000 * 60 * 60 * 24))}
                </span>
              </div>
            </div>
          </div>

          {/* Stage History Timeline */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <History className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">Stage History</h2>
            </div>
            {data.stageHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No history yet</p>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

                <div className="space-y-4">
                  {data.stageHistory.map((item, index) => (
                    <div key={item.id} className="relative flex gap-4">
                      {/* Timeline dot */}
                      <div className={cn(
                        "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                        getActionColor(item.action)
                      )}>
                        {getActionIcon(item.action)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pb-4">
                        <p className="text-sm font-medium text-foreground">
                          {getActionLabel(item.action, item.action_label, item.from_state, item.to_state)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(item.created_at)}
                          </span>
                          {item.actor_name && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {item.actor_name}
                            </span>
                          )}
                        </div>
                        {item.changed_fields && item.changed_fields.length > 0 && item.action === "OPPORTUNITY_UPDATED" && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Changed: {item.changed_fields.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Update Next Step Modal */}
      <Dialog open={showNextStepModal} onOpenChange={(open) => {
        setShowNextStepModal(open);
        if (!open) setActionError(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Next Step</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {actionError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{actionError}</p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Next Step *</label>
              <input
                type="text"
                value={nextStepData.next_step}
                onChange={(e) => setNextStepData({ ...nextStepData, next_step: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date *</label>
              <input
                type="date"
                value={nextStepData.next_step_due_date}
                onChange={(e) => setNextStepData({ ...nextStepData, next_step_due_date: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowNextStepModal(false)} className="btn-outline" disabled={submitting}>
              Cancel
            </button>
            <button onClick={handleUpdateNextStep} className="btn-primary" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage Change Modal */}
      <Dialog open={showStageModal} onOpenChange={(open) => {
        setShowStageModal(open);
        if (!open) setActionError(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Stage</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {actionError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{actionError}</p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">New Stage</label>
              <select
                value={stageData.new_stage}
                onChange={(e) => setStageData({ ...stageData, new_stage: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {STAGE_ORDER.map((stage) => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Next Step *</label>
              <input
                type="text"
                value={stageData.next_step}
                onChange={(e) => setStageData({ ...stageData, next_step: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date *</label>
              <input
                type="date"
                value={stageData.next_step_due_date}
                onChange={(e) => setStageData({ ...stageData, next_step_due_date: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            {stageData.new_stage === "Closed Won" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Win Reason *</label>
                <input
                  type="text"
                  value={stageData.outcome}
                  onChange={(e) => setStageData({ ...stageData, outcome: e.target.value })}
                  placeholder="e.g., Best price, Strong relationship"
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            )}
            {stageData.new_stage === "Closed Lost" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Lost Reason *</label>
                <input
                  type="text"
                  value={stageData.lost_reason}
                  onChange={(e) => setStageData({ ...stageData, lost_reason: e.target.value })}
                  placeholder="e.g., Price, Competitor, No budget"
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <button onClick={() => setShowStageModal(false)} className="btn-outline" disabled={submitting}>
              Cancel
            </button>
            <button onClick={handleStageChange} className="btn-primary" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Stage"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Call Modal */}
      <Dialog open={showLogCallModal} onOpenChange={(open) => {
        setShowLogCallModal(open);
        if (!open) setActionError(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log Call</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {actionError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{actionError}</p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject *</label>
              <input
                type="text"
                value={logCallData.subject}
                onChange={(e) => setLogCallData({ ...logCallData, subject: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Outcome / Notes</label>
              <textarea
                value={logCallData.outcome}
                onChange={(e) => setLogCallData({ ...logCallData, outcome: e.target.value })}
                placeholder="What was the result of the call?"
                className="w-full h-20 px-3 py-2 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Duration (minutes)</label>
              <input
                type="number"
                value={logCallData.duration_minutes}
                onChange={(e) => setLogCallData({ ...logCallData, duration_minutes: e.target.value })}
                placeholder="e.g., 15"
                min="1"
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowLogCallModal(false)} className="btn-outline" disabled={submitting}>
              Cancel
            </button>
            <button onClick={handleLogCall} className="btn-primary" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log Call"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

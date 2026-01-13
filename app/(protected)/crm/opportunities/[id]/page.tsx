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
} from "lucide-react";
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
    stageHistory: unknown[];
  }>({
    opportunity: null,
    activities: [],
    contacts: [],
    stageHistory: [],
  });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const result = await fetchJson<{
        opportunity: Opportunity;
        activities: ActivityItem[];
        contacts: Contact[];
        stageHistory: unknown[];
      }>(`/api/crm/opportunities/${opportunityId}`, {
        showErrorToast: true,
        errorMessage: toastMessages.errorLoading,
      });

      if (isSuccess(result)) {
        setData(result.data);
      }
      setLoading(false);
    };
    fetchData();
  }, [opportunityId]);

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
        <div className="flex gap-2">
          <Link href={`/crm/pipeline?highlight=${opportunityId}`} className="btn-outline h-9">
            View in Pipeline
          </Link>
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
        </div>
      </div>
    </div>
  );
}

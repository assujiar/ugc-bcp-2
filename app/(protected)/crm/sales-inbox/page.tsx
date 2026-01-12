"use client";

import * as React from "react";
import Link from "next/link";
import {
  Inbox,
  Clock,
  AlertTriangle,
  CheckCircle,
  Phone,
  Mail,
  Video,
  Calendar,
  ArrowRight,
  Loader2,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Activity {
  activity_id: string;
  activity_type: string;
  status: string;
  subject: string;
  due_date: string | null;
  scheduled_at: string | null;
  account?: { account_id: string; company_name: string } | null;
  opportunity?: { opportunity_id: string; name: string; stage: string } | null;
  owner?: { user_id: string; full_name: string } | null;
}

interface HandoverLead {
  lead_id: string;
  company_name: string;
  pic_name: string;
  contact_phone: string;
  service_code: string;
}

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  Call: Phone,
  Email: Mail,
  "Online Meeting": Video,
  Visit: Calendar,
  default: Clock,
};

export default function SalesInboxPage() {
  const [overdueActivities, setOverdueActivities] = React.useState<Activity[]>([]);
  const [handoverLeads, setHandoverLeads] = React.useState<HandoverLead[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [claiming, setClaiming] = React.useState<string | null>(null);
  const [completing, setCompleting] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      // Fetch overdue activities
      const activitiesRes = await fetch("/api/crm/activities?view=inbox&pageSize=50");
      if (activitiesRes.ok) {
        const data = await activitiesRes.json();
        setOverdueActivities(data.data || []);
      }

      // Fetch handover pool (available leads to claim)
      const leadsRes = await fetch("/api/crm/leads?view=handover_pool&pageSize=10");
      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setHandoverLeads(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleClaimLead = async (leadId: string) => {
    setClaiming(leadId);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Lead claimed! Opportunity created: ${data.opportunity_id}`);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to claim lead");
      }
    } catch (err) {
      console.error("Error claiming lead:", err);
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
          create_next: true,
        }),
      });

      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to complete activity");
      }
    } catch (err) {
      console.error("Error completing activity:", err);
    } finally {
      setCompleting(null);
    }
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 skeleton" />
        <div className="grid grid-cols-2 gap-6">
          <div className="h-96 skeleton rounded-xl" />
          <div className="h-96 skeleton rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales Inbox</h1>
          <p className="text-muted-foreground">Your daily tasks and new handovers</p>
        </div>
        <Link href="/crm/pipeline" className="btn-primary h-10">
          <Plus className="h-4 w-4 mr-2" />
          Quick Add Prospect
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{overdueActivities.length}</p>
            <p className="text-sm text-muted-foreground">Overdue Activities</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Inbox className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{handoverLeads.length}</p>
            <p className="text-sm text-muted-foreground">Leads to Claim</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
            <CheckCircle className="h-6 w-6 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">-</p>
            <p className="text-sm text-muted-foreground">Completed Today</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue Activities */}
        <div className="card-flush">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Overdue Activities
            </h2>
          </div>
          <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
            {overdueActivities.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-success" />
                <p>All caught up! No overdue activities.</p>
              </div>
            ) : (
              overdueActivities.map((activity) => {
                const Icon = ACTIVITY_ICONS[activity.activity_type] || ACTIVITY_ICONS.default;
                return (
                  <div key={activity.activity_id} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-lg",
                          isOverdue(activity.due_date) ? "bg-destructive/10" : "bg-primary/10"
                        )}>
                          <Icon className={cn(
                            "h-5 w-5",
                            isOverdue(activity.due_date) ? "text-destructive" : "text-primary"
                          )} />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{activity.subject}</p>
                          {activity.account && (
                            <p className="text-sm text-muted-foreground">{activity.account.company_name}</p>
                          )}
                          {activity.due_date && (
                            <p className={cn(
                              "text-xs mt-1",
                              isOverdue(activity.due_date) ? "text-destructive" : "text-muted-foreground"
                            )}>
                              Due: {new Date(activity.due_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleCompleteActivity(activity.activity_id)}
                        disabled={completing === activity.activity_id}
                        className="btn-ghost h-8 px-3 text-sm"
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
                );
              })
            )}
          </div>
        </div>

        {/* Handover Pool */}
        <div className="card-flush">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" />
              Available Leads (Get Lead)
            </h2>
          </div>
          <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
            {handoverLeads.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Inbox className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>No leads available to claim</p>
              </div>
            ) : (
              handoverLeads.map((lead) => (
                <div key={lead.lead_id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-medium">
                        {lead.company_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{lead.company_name}</p>
                        <p className="text-sm text-muted-foreground">{lead.pic_name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {lead.service_code} &bull; {lead.contact_phone}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleClaimLead(lead.lead_id)}
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
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

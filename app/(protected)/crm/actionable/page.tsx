"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Target,
  Briefcase,
  Calendar,
  Clock,
  ArrowRight,
  RefreshCw,
  Loader2,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { pageLabels } from "@/lib/terminology/labels";

// PR2.2: Actionable Debug Page
// Shows union of items needing action across leads, opportunities, and activities

interface ActionableItem {
  id: string;
  type: "lead" | "opportunity" | "activity";
  title: string;
  subtitle: string;
  status: string;
  dueDate?: string;
  daysOverdue?: number;
  actionNeeded: string;
  linkHref: string;
}

interface ActionableSummary {
  leads: {
    needsHandover: number;
    needsConversion: number;
    total: number;
  };
  opportunities: {
    overdue: number;
    total: number;
  };
  activities: {
    overdue: number;
    dueToday: number;
    upcoming: number;
    total: number;
  };
}

export default function ActionablePage() {
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<ActionableItem[]>([]);
  const [summary, setSummary] = React.useState<ActionableSummary>({
    leads: { needsHandover: 0, needsConversion: 0, total: 0 },
    opportunities: { overdue: 0, total: 0 },
    activities: { overdue: 0, dueToday: 0, upcoming: 0, total: 0 },
  });
  const [activeFilter, setActiveFilter] = React.useState<"all" | "leads" | "opportunities" | "activities">("all");

  const fetchActionableItems = React.useCallback(async () => {
    setLoading(true);
    try {
      // Fetch in parallel
      const [leadsRes, oppsRes, activitiesRes] = await Promise.all([
        fetch("/api/crm/leads?view=qualified&pageSize=100"),
        fetch("/api/crm/opportunities?view=my_overdue&pageSize=100"),
        fetch("/api/crm/activities?view=inbox&pageSize=100"),
      ]);

      const actionableItems: ActionableItem[] = [];
      const newSummary: ActionableSummary = {
        leads: { needsHandover: 0, needsConversion: 0, total: 0 },
        opportunities: { overdue: 0, total: 0 },
        activities: { overdue: 0, dueToday: 0, upcoming: 0, total: 0 },
      };

      // Process leads
      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        const leads = leadsData.data || [];

        leads.forEach((lead: Record<string, unknown>) => {
          const triageStatus = lead.triage_status as string;
          const hasOwner = !!lead.sales_owner_user_id;

          if (triageStatus === "Qualified" && !hasOwner) {
            newSummary.leads.needsHandover++;
            actionableItems.push({
              id: lead.lead_id as string,
              type: "lead",
              title: lead.company_name as string,
              subtitle: `${lead.pic_name || "Unknown"} - ${lead.service_code || "N/A"}`,
              status: "Needs Handover",
              actionNeeded: "Handover to sales team",
              linkHref: `/crm/lead-inbox`,
            });
          } else if (triageStatus === "Handed Over" || (triageStatus === "Qualified" && hasOwner)) {
            newSummary.leads.needsConversion++;
            actionableItems.push({
              id: lead.lead_id as string,
              type: "lead",
              title: lead.company_name as string,
              subtitle: `${lead.pic_name || "Unknown"} - ${lead.service_code || "N/A"}`,
              status: "Ready to Convert",
              actionNeeded: "Convert to opportunity",
              linkHref: `/crm/sales-inbox`,
            });
          }
        });
        newSummary.leads.total = leads.length;
      }

      // Process opportunities
      if (oppsRes.ok) {
        const oppsData = await oppsRes.json();
        const opps = oppsData.data || [];

        opps.forEach((opp: Record<string, unknown>) => {
          const dueDate = opp.next_step_due_date as string;
          const daysOverdue = Math.ceil(
            (new Date().getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)
          );

          newSummary.opportunities.overdue++;
          actionableItems.push({
            id: opp.opportunity_id as string,
            type: "opportunity",
            title: opp.name as string,
            subtitle: (opp.account as Record<string, unknown>)?.company_name as string || "Unknown",
            status: opp.stage as string,
            dueDate,
            daysOverdue,
            actionNeeded: `${opp.next_step} (${daysOverdue} days overdue)`,
            linkHref: `/crm/pipeline`,
          });
        });
        newSummary.opportunities.total = opps.length;
      }

      // Process activities
      if (activitiesRes.ok) {
        const activitiesData = await activitiesRes.json();
        const activities = activitiesData.data || [];
        const today = new Date().toISOString().split("T")[0];

        activities.forEach((activity: Record<string, unknown>) => {
          const dueDate = activity.due_date as string;
          const isOverdue = dueDate < today;
          const isDueToday = dueDate === today;

          if (isOverdue) {
            newSummary.activities.overdue++;
          } else if (isDueToday) {
            newSummary.activities.dueToday++;
          } else {
            newSummary.activities.upcoming++;
          }

          const daysOverdue = isOverdue
            ? Math.ceil((new Date().getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

          actionableItems.push({
            id: activity.activity_id as string,
            type: "activity",
            title: activity.subject as string,
            subtitle: `${activity.activity_type} - ${(activity.account as Record<string, unknown>)?.company_name || "N/A"}`,
            status: activity.status as string,
            dueDate,
            daysOverdue: isOverdue ? daysOverdue : undefined,
            actionNeeded: isOverdue
              ? `${daysOverdue} days overdue`
              : isDueToday
              ? "Due today"
              : `Due ${new Date(dueDate).toLocaleDateString()}`,
            linkHref: `/crm/work-queue`,
          });
        });
        newSummary.activities.total = activities.length;
      }

      // Sort by urgency (overdue first, then by days overdue)
      actionableItems.sort((a, b) => {
        if (a.daysOverdue && b.daysOverdue) return b.daysOverdue - a.daysOverdue;
        if (a.daysOverdue) return -1;
        if (b.daysOverdue) return 1;
        return 0;
      });

      setItems(actionableItems);
      setSummary(newSummary);
    } catch (err) {
      console.error("Error fetching actionable items:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchActionableItems();
  }, [fetchActionableItems]);

  const filteredItems = React.useMemo(() => {
    if (activeFilter === "all") return items;
    // Map plural filter names to singular types
    const typeMap: Record<string, string> = {
      leads: "lead",
      opportunities: "opportunity",
      activities: "activity",
    };
    const targetType = typeMap[activeFilter] || activeFilter;
    return items.filter((item) => item.type === targetType);
  }, [items, activeFilter]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "lead":
        return <Target className="h-4 w-4 text-primary" />;
      case "opportunity":
        return <Briefcase className="h-4 w-4 text-warning" />;
      case "activity":
        return <Calendar className="h-4 w-4 text-info" />;
      default:
        return <ListTodo className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "lead":
        return "bg-primary/10 border-primary/20";
      case "opportunity":
        return "bg-warning/10 border-warning/20";
      case "activity":
        return "bg-info/10 border-info/20";
      default:
        return "bg-muted/10 border-muted/20";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 skeleton" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 skeleton rounded-xl" />
          ))}
        </div>
        <div className="h-96 skeleton rounded-xl" />
      </div>
    );
  }

  const totalActionable =
    summary.leads.needsHandover +
    summary.leads.needsConversion +
    summary.opportunities.overdue +
    summary.activities.overdue +
    summary.activities.dueToday;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Actionable Items</h1>
          <p className="text-muted-foreground">
            {totalActionable} items need attention across leads, opportunities, and activities
          </p>
        </div>
        <button
          onClick={fetchActionableItems}
          className="btn-outline h-10"
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Leads Summary */}
        <div className="card">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {summary.leads.needsHandover + summary.leads.needsConversion}
              </p>
              <p className="text-sm text-muted-foreground">Leads Need Action</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Needs Handover</span>
              <span className="font-medium text-foreground">{summary.leads.needsHandover}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ready to Convert</span>
              <span className="font-medium text-foreground">{summary.leads.needsConversion}</span>
            </div>
          </div>
        </div>

        {/* Opportunities Summary */}
        <div className="card">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
              <AlertTriangle className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{summary.opportunities.overdue}</p>
              <p className="text-sm text-muted-foreground">Overdue Opportunities</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Past Due Date</span>
              <span className="font-medium text-destructive">{summary.opportunities.overdue}</span>
            </div>
          </div>
        </div>

        {/* Activities Summary */}
        <div className="card">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-info/10">
              <Clock className="h-6 w-6 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {summary.activities.overdue + summary.activities.dueToday}
              </p>
              <p className="text-sm text-muted-foreground">Activities Due</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Overdue</span>
              <span className="font-medium text-destructive">{summary.activities.overdue}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due Today</span>
              <span className="font-medium text-warning">{summary.activities.dueToday}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Upcoming (7 days)</span>
              <span className="font-medium text-foreground">{summary.activities.upcoming}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-border">
        {[
          { id: "all" as const, label: "All Items", count: items.length },
          { id: "leads" as const, label: "Leads", count: items.filter((i) => i.type === "lead").length },
          { id: "opportunities" as const, label: "Opportunities", count: items.filter((i) => i.type === "opportunity").length },
          { id: "activities" as const, label: "Activities", count: items.filter((i) => i.type === "activity").length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              activeFilter === tab.id
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Actionable Items List */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <ListTodo className="h-8 w-8 text-success" />
              </div>
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">All caught up!</h3>
            <p className="text-muted-foreground">No actionable items at the moment.</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className={cn(
                "flex items-center justify-between p-4 rounded-xl border transition-colors hover:bg-muted/30",
                getTypeColor(item.type)
              )}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background">
                  {getTypeIcon(item.type)}
                </div>
                <div>
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      item.daysOverdue ? "text-destructive" : "text-foreground"
                    )}
                  >
                    {item.actionNeeded}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{item.type}</p>
                </div>
                <Link href={item.linkHref} className="btn-ghost h-9 px-3">
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

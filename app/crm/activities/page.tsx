"use client";

import * as React from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  CheckCircle,
  Phone,
  Mail,
  Video,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  pageLabels,
  actionLabels,
} from "@/lib/terminology/labels";
import { CompleteActivityModal } from "@/components/crm/complete-activity-modal";
import { toastSuccess, toast } from "@/lib/hooks/use-toast";

interface Activity {
  activity_id: string;
  activity_type: string;
  status: string;
  subject: string;
  description: string | null;
  due_date: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  account?: { account_id: string; company_name: string } | null;
  opportunity?: { opportunity_id: string; name: string; stage: string } | null;
  owner?: { user_id: string; full_name: string } | null;
}

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  Call: Phone,
  Email: Mail,
  "Online Meeting": Video,
  Visit: MapPin,
  WhatsApp: MessageSquare,
  default: Calendar,
};

const STATUS_COLORS = {
  Planned: "bg-primary/10 text-primary",
  Done: "bg-success/10 text-success",
  Cancelled: "bg-muted text-muted-foreground",
};

const ACTIVITY_TYPES = [
  "Call", "Email", "Visit", "Online Meeting", "WhatsApp",
  "LinkedIn Message", "Send Proposal", "Send Quote", "Follow Up",
  "Internal Meeting", "Other"
];

export default function ActivitiesPage() {
  const [activities, setActivities] = React.useState<Activity[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [view, setView] = React.useState<"list" | "day">("list");
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [addData, setAddData] = React.useState({
    activity_type: "Call" as string,
    subject: "",
    description: "",
    due_date: new Date().toISOString().split("T")[0],
    scheduled_at: "",
  });
  const [submitting, setSubmitting] = React.useState(false);
  // Complete Activity Modal state
  const [showCompleteModal, setShowCompleteModal] = React.useState(false);
  const [selectedActivity, setSelectedActivity] = React.useState<Activity | null>(null);

  const fetchActivities = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        view: "planner",
        pageSize: "100",
      });
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/crm/activities?${params}`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching activities:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  React.useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleAddActivity = async () => {
    if (!addData.subject) {
      alert("Subject is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...addData,
          status: "Planned",
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setAddData({
          activity_type: "Call",
          subject: "",
          description: "",
          due_date: new Date().toISOString().split("T")[0],
          scheduled_at: "",
        });
        fetchActivities();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create activity");
      }
    } catch (err) {
      console.error("Error creating activity:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenCompleteModal = (activity: Activity) => {
    setSelectedActivity(activity);
    setShowCompleteModal(true);
  };

  const handleCompleteResult = (result: { success: boolean; action: "complete" | "cancel"; next_activity_id?: string }) => {
    if (result.success) {
      const actionText = result.action === "complete" ? "completed" : "cancelled";

      if (result.next_activity_id) {
        toast({
          variant: "success",
          title: "Activity Completed",
          description: `Activity ${actionText}. Follow-up activity created.`,
        });
      } else {
        toastSuccess("Success", `Activity ${actionText} successfully`);
      }

      fetchActivities();
    }
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (date: string | null) => {
    if (!date) return "";
    return new Date(date).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredActivities = activities.filter((a) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      a.subject.toLowerCase().includes(searchLower) ||
      a.account?.company_name.toLowerCase().includes(searchLower)
    );
  });

  // Group by date for day view
  const groupedByDate = filteredActivities.reduce((acc, activity) => {
    const date = activity.due_date || activity.scheduled_at?.split("T")[0] || "No Date";
    if (!acc[date]) acc[date] = [];
    acc[date].push(activity);
    return acc;
  }, {} as Record<string, Activity[]>);

  const stats = {
    planned: activities.filter((a) => a.status === "Planned").length,
    overdue: activities.filter((a) => a.status === "Planned" && isOverdue(a.due_date)).length,
    doneToday: activities.filter((a) => {
      if (a.status !== "Done" || !a.completed_at) return false;
      const completed = new Date(a.completed_at);
      const today = new Date();
      return completed.toDateString() === today.toDateString();
    }).length,
  };

  if (loading && activities.length === 0) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 skeleton" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 skeleton rounded-xl" />
          ))}
        </div>
        <div className="h-96 skeleton rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{pageLabels.activityPlanner.title}</h1>
          <p className="text-muted-foreground">{pageLabels.activityPlanner.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView("list")}
            className={cn("btn-ghost h-9 px-3", view === "list" && "bg-muted")}
          >
            List
          </button>
          <button
            onClick={() => setView("day")}
            className={cn("btn-ghost h-9 px-3", view === "day" && "bg-muted")}
          >
            By Day
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary h-9">
            <Plus className="h-4 w-4 mr-2" />
            {actionLabels.scheduleActivity}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.planned}</p>
            <p className="text-sm text-muted-foreground">Planned</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
            <Clock className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.overdue}</p>
            <p className="text-sm text-muted-foreground">Overdue</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
            <CheckCircle className="h-6 w-6 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.doneToday}</p>
            <p className="text-sm text-muted-foreground">Done Today</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search activities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-xl bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">All Status</option>
          <option value="Planned">Planned</option>
          <option value="Done">Done</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {/* Activity List */}
      {view === "list" && (
        <div className="card-flush overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Activity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Account</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Due Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredActivities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                    No activities found
                  </td>
                </tr>
              ) : (
                filteredActivities.map((activity) => {
                  const Icon = ACTIVITY_ICONS[activity.activity_type] || ACTIVITY_ICONS.default;
                  return (
                    <tr key={activity.activity_id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-lg",
                            activity.status === "Planned" && isOverdue(activity.due_date)
                              ? "bg-destructive/10"
                              : "bg-primary/10"
                          )}>
                            <Icon className={cn(
                              "h-5 w-5",
                              activity.status === "Planned" && isOverdue(activity.due_date)
                                ? "text-destructive"
                                : "text-primary"
                            )} />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{activity.subject}</p>
                            <p className="text-xs text-muted-foreground">{activity.activity_type}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {activity.account ? (
                          <Link
                            href={`/crm/accounts/${activity.account.account_id}`}
                            className="text-sm text-primary hover:underline"
                          >
                            {activity.account.company_name}
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "text-sm",
                          activity.status === "Planned" && isOverdue(activity.due_date)
                            ? "text-destructive font-medium"
                            : "text-foreground"
                        )}>
                          {formatDate(activity.due_date)}
                          {activity.scheduled_at && ` ${formatTime(activity.scheduled_at)}`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          STATUS_COLORS[activity.status as keyof typeof STATUS_COLORS] || "bg-muted text-muted-foreground"
                        )}>
                          {activity.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {activity.status === "Planned" && (
                          <button
                            onClick={() => handleOpenCompleteModal(activity)}
                            className="btn-ghost h-8 px-3 text-sm"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Complete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Day View */}
      {view === "day" && (
        <div className="space-y-6">
          {Object.entries(groupedByDate)
            .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
            .map(([date, dayActivities]) => (
              <div key={date} className="card">
                <h3 className="font-semibold text-foreground mb-4">
                  {date === "No Date" ? "No Date" : formatDate(date)}
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({dayActivities.length} activities)
                  </span>
                </h3>
                <div className="space-y-3">
                  {dayActivities.map((activity) => {
                    const Icon = ACTIVITY_ICONS[activity.activity_type] || ACTIVITY_ICONS.default;
                    return (
                      <div key={activity.activity_id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full",
                          activity.status === "Done" ? "bg-success/10" : "bg-primary/10"
                        )}>
                          <Icon className={cn("h-4 w-4", activity.status === "Done" ? "text-success" : "text-primary")} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm">{activity.subject}</p>
                          {activity.account && (
                            <p className="text-xs text-muted-foreground">{activity.account.company_name}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-medium",
                            STATUS_COLORS[activity.status as keyof typeof STATUS_COLORS]
                          )}>
                            {activity.status}
                          </span>
                          {activity.status === "Planned" && (
                            <button
                              onClick={() => handleOpenCompleteModal(activity)}
                              className="btn-ghost h-7 px-2 text-xs"
                            >
                              <CheckCircle className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Add Activity Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Activity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Activity Type</label>
              <select
                value={addData.activity_type}
                onChange={(e) => setAddData({ ...addData, activity_type: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {ACTIVITY_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject *</label>
              <input
                type="text"
                value={addData.subject}
                onChange={(e) => setAddData({ ...addData, subject: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date</label>
              <input
                type="date"
                value={addData.due_date}
                onChange={(e) => setAddData({ ...addData, due_date: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                value={addData.description}
                onChange={(e) => setAddData({ ...addData, description: e.target.value })}
                className="w-full h-20 px-3 py-2 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowAddModal(false)} className="btn-outline" disabled={submitting}>
              Cancel
            </button>
            <button onClick={handleAddActivity} className="btn-primary" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Activity"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Activity Modal */}
      <CompleteActivityModal
        open={showCompleteModal}
        onOpenChange={setShowCompleteModal}
        activity={selectedActivity}
        onComplete={handleCompleteResult}
      />
    </div>
  );
}

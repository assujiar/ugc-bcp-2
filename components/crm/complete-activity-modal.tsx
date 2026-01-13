"use client";

import * as React from "react";
import { Loader2, CheckCircle, XCircle, CalendarPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Activity {
  activity_id: string;
  activity_type: string;
  subject: string;
  account?: { account_id: string; company_name: string } | null;
  opportunity?: { opportunity_id: string; name: string } | null;
}

interface CompleteActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: Activity | null;
  onComplete: (result: CompleteResult) => void;
}

interface CompleteResult {
  success: boolean;
  action: "complete" | "cancel";
  next_activity_id?: string;
}

const ACTIVITY_TYPES = [
  "Call", "Email", "Visit", "Online Meeting", "WhatsApp",
  "LinkedIn Message", "Send Proposal", "Send Quote", "Follow Up",
  "Internal Meeting", "Other"
] as const;

type ActionType = "complete" | "cancel";

export function CompleteActivityModal({
  open,
  onOpenChange,
  activity,
  onComplete,
}: CompleteActivityModalProps) {
  const [action, setAction] = React.useState<ActionType>("complete");
  const [outcome, setOutcome] = React.useState("");
  const [durationMinutes, setDurationMinutes] = React.useState<string>("");
  const [cancelReason, setCancelReason] = React.useState("");
  const [createNext, setCreateNext] = React.useState(true);
  const [nextActivityType, setNextActivityType] = React.useState<string>("Follow Up");
  const [nextSubject, setNextSubject] = React.useState("");
  const [nextDueDate, setNextDueDate] = React.useState(() => {
    // Default to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset form when modal opens/closes or activity changes
  React.useEffect(() => {
    if (open && activity) {
      setAction("complete");
      setOutcome("");
      setDurationMinutes("");
      setCancelReason("");
      setCreateNext(true);
      setNextActivityType("Follow Up");
      setNextSubject(`Follow up: ${activity.subject}`);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setNextDueDate(tomorrow.toISOString().split("T")[0]);
      setError(null);
    }
  }, [open, activity]);

  const handleSubmit = async () => {
    if (!activity) return;

    // Validation
    if (action === "complete" && createNext && !nextDueDate) {
      setError("Due date is required for next activity");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const body = action === "complete"
        ? {
            action: "complete" as const,
            outcome: outcome || undefined,
            duration_minutes: durationMinutes ? parseInt(durationMinutes, 10) : undefined,
            create_next_activity: createNext
              ? {
                  activity_type: nextActivityType,
                  subject: nextSubject || undefined,
                  due_date: nextDueDate,
                }
              : undefined,
          }
        : {
            action: "cancel" as const,
            cancel_reason: cancelReason || undefined,
          };

      const res = await fetch(`/api/crm/activities/${activity.activity_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error?.message || "Failed to update activity");
        return;
      }

      onComplete({
        success: true,
        action,
        next_activity_id: data.data?.next_activity_id,
      });
      onOpenChange(false);
    } catch (err) {
      console.error("Error updating activity:", err);
      setError("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (!activity) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Complete Activity</DialogTitle>
          <DialogDescription>
            {activity.subject}
            {activity.account && (
              <span className="block text-primary mt-1">
                {activity.account.company_name}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Action Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Status</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAction("complete")}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border-2 transition-all",
                  action === "complete"
                    ? "border-success bg-success/10 text-success"
                    : "border-border hover:border-muted-foreground"
                )}
              >
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Done</span>
              </button>
              <button
                type="button"
                onClick={() => setAction("cancel")}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border-2 transition-all",
                  action === "cancel"
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-border hover:border-muted-foreground"
                )}
              >
                <XCircle className="h-5 w-5" />
                <span className="font-medium">Cancelled</span>
              </button>
            </div>
          </div>

          {/* Done-specific fields */}
          {action === "complete" && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Outcome / Notes</label>
                <textarea
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  placeholder="What was the result of this activity?"
                  className="w-full h-20 px-3 py-2 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Duration (minutes)</label>
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  placeholder="e.g., 30"
                  min="1"
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Create Next Activity */}
              <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="createNext"
                    checked={createNext}
                    onChange={(e) => setCreateNext(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="createNext" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <CalendarPlus className="h-4 w-4 text-primary" />
                    Create Follow-up Activity
                  </label>
                </div>

                {createNext && (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Type</label>
                        <select
                          value={nextActivityType}
                          onChange={(e) => setNextActivityType(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                          {ACTIVITY_TYPES.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Due Date *</label>
                        <input
                          type="date"
                          value={nextDueDate}
                          onChange={(e) => setNextDueDate(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Subject</label>
                      <input
                        type="text"
                        value={nextSubject}
                        onChange={(e) => setNextSubject(e.target.value)}
                        placeholder="Follow up subject"
                        className="w-full h-10 px-3 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Cancel-specific fields */}
          {action === "cancel" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for Cancellation</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Why is this activity being cancelled?"
                className="w-full h-20 px-3 py-2 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="btn-outline"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className={cn(
              "btn-primary",
              action === "cancel" && "bg-destructive hover:bg-destructive/90"
            )}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : action === "complete" ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark as Done
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 mr-2" />
                Cancel Activity
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

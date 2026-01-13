"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Target,
  Search,
  Plus,
  Upload,
  Phone,
  ArrowRight,
  Loader2,
  Globe,
  Calendar,
  MessageSquare,
  CheckCircle2,
  XCircle,
  ChevronRight,
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
  emptyStateMessages,
  modalTitles,
} from "@/lib/terminology/labels";
import { TargetStatus, TARGET_STATUS_TRANSITIONS, TARGET_TERMINAL_STATES } from "@/lib/types/database";

interface ProspectingTarget {
  target_id: string;
  company_name: string;
  domain: string | null;
  industry: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  city: string | null;
  status: TargetStatus;
  next_outreach_at: string | null;
  last_contacted_at: string | null;
  drop_reason: string | null;
  owner?: { user_id: string; full_name: string } | null;
}

// SSOT-aligned status colors
const STATUS_COLORS: Record<TargetStatus, string> = {
  new_target: "bg-primary/10 text-primary",
  contacted: "bg-warning/10 text-warning",
  engaged: "bg-info/10 text-info",
  qualified: "bg-success/10 text-success",
  dropped: "bg-muted text-muted-foreground",
  converted: "bg-success/10 text-success border border-success/30",
};

// Status display labels
const STATUS_LABELS: Record<TargetStatus, string> = {
  new_target: "New",
  contacted: "Contacted",
  engaged: "Engaged",
  qualified: "Qualified",
  dropped: "Dropped",
  converted: "Converted",
};

export default function TargetsPage() {
  const router = useRouter();
  const [targets, setTargets] = React.useState<ProspectingTarget[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [showStatusModal, setShowStatusModal] = React.useState(false);
  const [showDropModal, setShowDropModal] = React.useState(false);
  const [selectedTarget, setSelectedTarget] = React.useState<ProspectingTarget | null>(null);
  const [dropReason, setDropReason] = React.useState("");
  const [addData, setAddData] = React.useState({
    company_name: "",
    domain: "",
    industry: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    city: "",
    notes: "",
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [converting, setConverting] = React.useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = React.useState<string | null>(null);
  const [toastMessage, setToastMessage] = React.useState<{ message: string; link?: string } | null>(null);

  const fetchTargets = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: "100" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/crm/targets?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTargets(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching targets:", err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  React.useEffect(() => {
    const debounce = setTimeout(fetchTargets, 300);
    return () => clearTimeout(debounce);
  }, [fetchTargets]);

  const handleAddTarget = async () => {
    if (!addData.company_name) {
      alert("Company name is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/crm/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addData),
      });

      if (res.ok) {
        setShowAddModal(false);
        setAddData({
          company_name: "",
          domain: "",
          industry: "",
          contact_name: "",
          contact_email: "",
          contact_phone: "",
          city: "",
          notes: "",
        });
        fetchTargets();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create target");
      }
    } catch (err) {
      console.error("Error creating target:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConvert = async (targetId: string) => {
    setConverting(targetId);
    try {
      const res = await fetch(`/api/crm/targets/${targetId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (res.ok && data.data?.success) {
        // Show toast with deep link
        setToastMessage({
          message: data.data.message || "Target converted successfully!",
          link: data.data.deep_link,
        });
        fetchTargets();

        // Auto-dismiss toast after 5 seconds
        setTimeout(() => setToastMessage(null), 5000);
      } else {
        // Show error with context (e.g., "Must be qualified first")
        const errorMsg = data.error || data.data?.error || "Failed to convert target";
        alert(errorMsg);
      }
    } catch (err) {
      console.error("Error converting target:", err);
      alert("Network error. Please try again.");
    } finally {
      setConverting(null);
    }
  };

  const handleStatusUpdate = async (targetId: string, newStatus: TargetStatus, reason?: string) => {
    setUpdatingStatus(targetId);
    try {
      const res = await fetch(`/api/crm/targets/${targetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          drop_reason: reason,
        }),
      });

      const data = await res.json();

      if (res.ok && data.data) {
        setToastMessage({
          message: `Status updated to ${STATUS_LABELS[newStatus]}`,
        });
        fetchTargets();
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        alert(data.error || "Failed to update status");
      }
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Network error. Please try again.");
    } finally {
      setUpdatingStatus(null);
      setShowStatusModal(false);
      setShowDropModal(false);
      setSelectedTarget(null);
      setDropReason("");
    }
  };

  const getNextStatus = (currentStatus: TargetStatus): TargetStatus | null => {
    // Get the primary progression (non-dropped) transition
    const transitions = TARGET_STATUS_TRANSITIONS[currentStatus];
    return transitions.find(s => s !== "dropped") || null;
  };

  const canAdvance = (status: TargetStatus): boolean => {
    return !TARGET_TERMINAL_STATES.includes(status) && getNextStatus(status) !== null;
  };

  const canDrop = (status: TargetStatus): boolean => {
    return !TARGET_TERMINAL_STATES.includes(status);
  };

  const canConvert = (status: TargetStatus): boolean => {
    return status === "qualified";
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
    });
  };

  const stats = {
    new: targets.filter((t: ProspectingTarget) => t.status === "new_target").length,
    engaged: targets.filter((t: ProspectingTarget) => t.status === "engaged").length,
    qualified: targets.filter((t: ProspectingTarget) => t.status === "qualified").length,
    converted: targets.filter((t: ProspectingTarget) => t.status === "converted").length,
  };

  if (loading && targets.length === 0) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 skeleton" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
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
          <h1 className="text-2xl font-bold text-foreground">{pageLabels.prospectingTargets.title}</h1>
          <p className="text-muted-foreground">{pageLabels.prospectingTargets.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline h-10">
            <Upload className="h-4 w-4 mr-2" />
            {actionLabels.import}
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary h-10">
            <Plus className="h-4 w-4 mr-2" />
            {actionLabels.add} Target
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.new}</p>
            <p className="text-sm text-muted-foreground">New Targets</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-info/10">
            <MessageSquare className="h-6 w-6 text-info" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.engaged}</p>
            <p className="text-sm text-muted-foreground">Engaged</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
            <CheckCircle2 className="h-6 w-6 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.qualified}</p>
            <p className="text-sm text-muted-foreground">Qualified</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10 border border-success/30">
            <ArrowRight className="h-6 w-6 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.converted}</p>
            <p className="text-sm text-muted-foreground">Converted</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search targets..."
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
          <option value="new_target">New</option>
          <option value="contacted">Contacted</option>
          <option value="engaged">Engaged</option>
          <option value="qualified">Qualified</option>
          <option value="converted">Converted</option>
          <option value="dropped">Dropped</option>
        </select>
      </div>

      {/* Target List */}
      <div className="card-flush overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Company</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Next Outreach</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {targets.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                  No targets found
                </td>
              </tr>
            ) : (
              targets.map((target) => (
                <tr key={target.target_id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-medium">
                        {target.company_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{target.company_name}</p>
                        {target.domain && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {target.domain}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {target.contact_name ? (
                      <div>
                        <p className="text-sm text-foreground">{target.contact_name}</p>
                        {target.contact_email && (
                          <p className="text-xs text-muted-foreground">{target.contact_email}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("px-2 py-1 rounded-full text-xs font-medium", STATUS_COLORS[target.status] || "bg-muted text-muted-foreground")}>
                      {STATUS_LABELS[target.status] || target.status}
                    </span>
                    {target.status === "dropped" && target.drop_reason && (
                      <p className="text-xs text-muted-foreground mt-1 truncate max-w-[120px]" title={target.drop_reason}>
                        {target.drop_reason}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-foreground">{formatDate(target.next_outreach_at)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {/* Advance to next status button */}
                      {canAdvance(target.status) && (
                        <button
                          onClick={() => {
                            const nextStatus = getNextStatus(target.status);
                            if (nextStatus) {
                              handleStatusUpdate(target.target_id, nextStatus);
                            }
                          }}
                          disabled={updatingStatus === target.target_id}
                          className="btn-outline h-8 px-3 text-sm"
                          title={`Advance to ${STATUS_LABELS[getNextStatus(target.status) || "new_target"]}`}
                        >
                          {updatingStatus === target.target_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <ChevronRight className="h-4 w-4 mr-1" />
                              {STATUS_LABELS[getNextStatus(target.status) || "new_target"]}
                            </>
                          )}
                        </button>
                      )}

                      {/* Convert button - only for qualified targets */}
                      {canConvert(target.status) && (
                        <button
                          onClick={() => handleConvert(target.target_id)}
                          disabled={converting === target.target_id}
                          className="btn-primary h-8 px-3 text-sm"
                        >
                          {converting === target.target_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <ArrowRight className="h-4 w-4 mr-1" />
                              Convert
                            </>
                          )}
                        </button>
                      )}

                      {/* Drop button */}
                      {canDrop(target.status) && (
                        <button
                          onClick={() => {
                            setSelectedTarget(target);
                            setShowDropModal(true);
                          }}
                          className="btn-ghost h-8 px-2 text-sm text-muted-foreground hover:text-destructive"
                          title="Drop target"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Target Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{modalTitles.addTarget}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Company Name *</label>
              <input
                type="text"
                value={addData.company_name}
                onChange={(e) => setAddData({ ...addData, company_name: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Domain</label>
                <input
                  type="text"
                  value={addData.domain}
                  onChange={(e) => setAddData({ ...addData, domain: e.target.value })}
                  placeholder="example.com"
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Industry</label>
                <input
                  type="text"
                  value={addData.industry}
                  onChange={(e) => setAddData({ ...addData, industry: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Contact Name</label>
              <input
                type="text"
                value={addData.contact_name}
                onChange={(e) => setAddData({ ...addData, contact_name: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={addData.contact_email}
                  onChange={(e) => setAddData({ ...addData, contact_email: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <input
                  type="tel"
                  value={addData.contact_phone}
                  onChange={(e) => setAddData({ ...addData, contact_phone: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">City</label>
              <input
                type="text"
                value={addData.city}
                onChange={(e) => setAddData({ ...addData, city: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowAddModal(false)} className="btn-outline" disabled={submitting}>
              Cancel
            </button>
            <button onClick={handleAddTarget} className="btn-primary" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Target"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drop Target Modal */}
      <Dialog open={showDropModal} onOpenChange={(open) => {
        setShowDropModal(open);
        if (!open) {
          setSelectedTarget(null);
          setDropReason("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Drop Target</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to drop <strong>{selectedTarget?.company_name}</strong>?
              This action marks the target as no longer viable and cannot be undone.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason *</label>
              <textarea
                value={dropReason}
                onChange={(e) => setDropReason(e.target.value)}
                placeholder="e.g., Not interested, Wrong contact, Budget constraints..."
                className="w-full h-24 px-3 py-2 rounded-lg bg-muted/50 border border-border text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => {
                setShowDropModal(false);
                setSelectedTarget(null);
                setDropReason("");
              }}
              className="btn-outline"
              disabled={updatingStatus !== null}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (selectedTarget && dropReason.trim()) {
                  handleStatusUpdate(selectedTarget.target_id, "dropped", dropReason);
                }
              }}
              className="btn-destructive"
              disabled={!dropReason.trim() || updatingStatus !== null}
            >
              {updatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : "Drop Target"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5">
          <div className="bg-background border border-border rounded-xl shadow-lg p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{toastMessage.message}</p>
                {toastMessage.link && (
                  <button
                    onClick={() => router.push(toastMessage.link!)}
                    className="text-sm text-primary hover:underline mt-1 inline-flex items-center gap-1"
                  >
                    View Opportunity
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setToastMessage(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

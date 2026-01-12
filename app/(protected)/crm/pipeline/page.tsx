"use client";

import * as React from "react";
import Link from "next/link";
import {
  Kanban,
  List,
  Plus,
  Search,
  DollarSign,
  Calendar,
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
  fieldLabels,
  modalTitles,
  getOpportunityStageLabel,
} from "@/lib/terminology/labels";

interface Opportunity {
  opportunity_id: string;
  name: string;
  stage: string;
  estimated_value: number | null;
  next_step: string;
  next_step_due_date: string;
  account?: { account_id: string; company_name: string; city: string | null } | null;
  owner?: { user_id: string; full_name: string } | null;
}

interface PipelineSummary {
  stage: string;
  opportunity_count: number;
  total_value: number;
}

const STAGES = [
  { key: "Prospecting", label: "Prospecting", color: "bg-info" },
  { key: "Discovery", label: "Discovery", color: "bg-info" },
  { key: "Proposal Sent", label: "Proposal Sent", color: "bg-warning" },
  { key: "Quote Sent", label: "Quote Sent", color: "bg-warning" },
  { key: "Negotiation", label: "Negotiation", color: "bg-primary" },
  { key: "Verbal Commit", label: "Verbal Commit", color: "bg-primary" },
  { key: "Closed Won", label: "Won", color: "bg-success" },
  { key: "Closed Lost", label: "Lost", color: "bg-destructive" },
];

export default function PipelinePage() {
  const [opportunities, setOpportunities] = React.useState<Opportunity[]>([]);
  const [_pipelineSummary, setPipelineSummary] = React.useState<PipelineSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [view, setView] = React.useState<"kanban" | "list">("kanban");
  const [search, setSearch] = React.useState("");
  const [showQuickAddModal, setShowQuickAddModal] = React.useState(false);
  const [quickAddData, setQuickAddData] = React.useState({
    company_name: "",
    contact_first_name: "",
    contact_email: "",
    contact_phone: "",
    estimated_value: "",
    notes: "",
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [showStageModal, setShowStageModal] = React.useState(false);
  const [stageChangeData, setStageChangeData] = React.useState({
    opportunityId: "",
    newStage: "",
    nextStep: "",
    nextStepDueDate: "",
    lostReason: "",
  });

  const fetchOpportunities = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/opportunities?view=pipeline&pageSize=200");
      if (res.ok) {
        const data = await res.json();
        setOpportunities(data.data || []);
        setPipelineSummary(data.pipelineSummary || []);
      }
    } catch (err) {
      console.error("Error fetching opportunities:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const handleQuickAdd = async () => {
    if (!quickAddData.company_name || !quickAddData.contact_first_name) {
      alert("Company name and contact name are required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/crm/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quick_add: true,
          ...quickAddData,
          estimated_value: quickAddData.estimated_value ? parseFloat(quickAddData.estimated_value) : null,
        }),
      });

      if (res.ok) {
        setShowQuickAddModal(false);
        setQuickAddData({
          company_name: "",
          contact_first_name: "",
          contact_email: "",
          contact_phone: "",
          estimated_value: "",
          notes: "",
        });
        fetchOpportunities();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create opportunity");
      }
    } catch (err) {
      console.error("Error creating opportunity:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStageChange = async (opportunityId: string, newStage: string) => {
    // If moving to closed stages, require additional info
    if (newStage === "Closed Lost") {
      setStageChangeData({
        opportunityId,
        newStage,
        nextStep: "Closed",
        nextStepDueDate: new Date().toISOString().split("T")[0],
        lostReason: "",
      });
      setShowStageModal(true);
      return;
    }

    if (newStage === "Quote Sent") {
      // TODO: Check if quote exists
      setStageChangeData({
        opportunityId,
        newStage,
        nextStep: "Follow up on quote",
        nextStepDueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        lostReason: "",
      });
      setShowStageModal(true);
      return;
    }

    // For other stages, show the modal to set next step
    const defaultNextSteps: Record<string, string> = {
      Prospecting: "Initial contact call",
      Discovery: "Discovery meeting",
      "Proposal Sent": "Follow up on proposal",
      Negotiation: "Final negotiation meeting",
      "Verbal Commit": "Contract signing",
      "Closed Won": "Onboarding",
    };

    setStageChangeData({
      opportunityId,
      newStage,
      nextStep: defaultNextSteps[newStage] || "Follow up",
      nextStepDueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      lostReason: "",
    });
    setShowStageModal(true);
  };

  const confirmStageChange = async () => {
    if (!stageChangeData.nextStep || !stageChangeData.nextStepDueDate) {
      alert("Next step and due date are required");
      return;
    }

    if (stageChangeData.newStage === "Closed Lost" && !stageChangeData.lostReason) {
      alert("Lost reason is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/crm/opportunities/${stageChangeData.opportunityId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          new_stage: stageChangeData.newStage,
          next_step: stageChangeData.nextStep,
          next_step_due_date: stageChangeData.nextStepDueDate,
          lost_reason: stageChangeData.lostReason || null,
        }),
      });

      if (res.ok) {
        setShowStageModal(false);
        fetchOpportunities();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to change stage");
      }
    } catch (err) {
      console.error("Error changing stage:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredOpportunities = opportunities.filter((o) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      o.name.toLowerCase().includes(searchLower) ||
      o.account?.company_name.toLowerCase().includes(searchLower)
    );
  });

  const getOpportunitiesByStage = (stage: string) =>
    filteredOpportunities.filter((o) => o.stage === stage);

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const totalPipelineValue = opportunities
    .filter((o) => !["Closed Won", "Closed Lost"].includes(o.stage))
    .reduce((sum, o) => sum + (o.estimated_value || 0), 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 skeleton" />
        <div className="h-24 skeleton rounded-xl" />
        <div className="flex gap-4 overflow-x-auto">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-96 w-72 flex-shrink-0 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{pageLabels.salesPipeline.title}</h1>
          <p className="text-muted-foreground">
            {opportunities.length} opportunities &bull; {formatCurrency(totalPipelineValue)} total value
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("kanban")}
            className={cn("btn-ghost h-9 px-3", view === "kanban" && "bg-muted")}
          >
            <Kanban className="h-4 w-4 mr-2" />
            Kanban
          </button>
          <button
            onClick={() => setView("list")}
            className={cn("btn-ghost h-9 px-3", view === "list" && "bg-muted")}
          >
            <List className="h-4 w-4 mr-2" />
            List
          </button>
          <button
            onClick={() => setShowQuickAddModal(true)}
            className="btn-primary h-9"
          >
            <Plus className="h-4 w-4 mr-2" />
            {actionLabels.quickCreate}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search opportunities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Kanban Board */}
      {view === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.filter((s) => !["Closed Won", "Closed Lost"].includes(s.key)).map((stage) => {
            const stageOpps = getOpportunitiesByStage(stage.key);
            const stageValue = stageOpps.reduce((sum, o) => sum + (o.estimated_value || 0), 0);

            return (
              <div key={stage.key} className="flex-shrink-0 w-72 bg-muted/30 rounded-xl p-3">
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", stage.color)} />
                    <h3 className="font-medium text-foreground text-sm">{stage.label}</h3>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {stageOpps.length}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground px-1 mb-3">
                  {formatCurrency(stageValue)}
                </div>

                {/* Cards */}
                <div className="space-y-2 min-h-[200px]">
                  {stageOpps.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No opportunities
                    </p>
                  ) : (
                    stageOpps.map((opp) => (
                      <div
                        key={opp.opportunity_id}
                        className="p-3 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-medium">
                              {opp.account?.company_name?.charAt(0) || "?"}
                            </div>
                            <div>
                              <Link
                                href={`/crm/accounts/${opp.account?.account_id}`}
                                className="text-sm font-medium text-foreground hover:text-primary truncate block max-w-[140px]"
                              >
                                {opp.account?.company_name || "Unknown"}
                              </Link>
                              <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                                {opp.name}
                              </p>
                            </div>
                          </div>
                        </div>

                        {opp.estimated_value && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                            <DollarSign className="h-3 w-3" />
                            {formatCurrency(opp.estimated_value)}
                          </div>
                        )}

                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                          <Calendar className="h-3 w-3" />
                          {opp.next_step} ({new Date(opp.next_step_due_date).toLocaleDateString()})
                        </div>

                        <div className="pt-2 border-t border-border">
                          <select
                            value={opp.stage}
                            onChange={(e) => handleStageChange(opp.opportunity_id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-xs bg-muted/50 border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            {STAGES.map((s) => (
                              <option key={s.key} value={s.key}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {view === "list" && (
        <div className="card-flush overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Opportunity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Account</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Stage</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Next Step</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredOpportunities.map((opp) => {
                const stageConfig = STAGES.find((s) => s.key === opp.stage);
                return (
                  <tr key={opp.opportunity_id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-foreground">{opp.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/crm/accounts/${opp.account?.account_id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {opp.account?.company_name || "-"}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex px-2 py-1 rounded-full text-xs font-medium text-white",
                        stageConfig?.color || "bg-muted"
                      )}>
                        {stageConfig?.label || opp.stage}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-foreground">{formatCurrency(opp.estimated_value)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm text-foreground">{opp.next_step}</p>
                        <p className="text-xs text-muted-foreground">
                          Due: {new Date(opp.next_step_due_date).toLocaleDateString()}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground">{opp.owner?.full_name || "-"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick Add Modal */}
      <Dialog open={showQuickAddModal} onOpenChange={setShowQuickAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Add Prospect</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Company Name *</label>
              <input
                type="text"
                value={quickAddData.company_name}
                onChange={(e) => setQuickAddData({ ...quickAddData, company_name: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Contact Name *</label>
              <input
                type="text"
                value={quickAddData.contact_first_name}
                onChange={(e) => setQuickAddData({ ...quickAddData, contact_first_name: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={quickAddData.contact_email}
                  onChange={(e) => setQuickAddData({ ...quickAddData, contact_email: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <input
                  type="tel"
                  value={quickAddData.contact_phone}
                  onChange={(e) => setQuickAddData({ ...quickAddData, contact_phone: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Estimated Value (IDR)</label>
              <input
                type="number"
                value={quickAddData.estimated_value}
                onChange={(e) => setQuickAddData({ ...quickAddData, estimated_value: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <textarea
                value={quickAddData.notes}
                onChange={(e) => setQuickAddData({ ...quickAddData, notes: e.target.value })}
                className="w-full h-20 px-3 py-2 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowQuickAddModal(false)} className="btn-outline" disabled={submitting}>
              Cancel
            </button>
            <button onClick={handleQuickAdd} className="btn-primary" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage Change Modal */}
      <Dialog open={showStageModal} onOpenChange={setShowStageModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Stage</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Moving to:</p>
              <p className="font-medium text-foreground">{stageChangeData.newStage}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Next Step *</label>
              <input
                type="text"
                value={stageChangeData.nextStep}
                onChange={(e) => setStageChangeData({ ...stageChangeData, nextStep: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date *</label>
              <input
                type="date"
                value={stageChangeData.nextStepDueDate}
                onChange={(e) => setStageChangeData({ ...stageChangeData, nextStepDueDate: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            {stageChangeData.newStage === "Closed Lost" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Lost Reason *</label>
                <input
                  type="text"
                  value={stageChangeData.lostReason}
                  onChange={(e) => setStageChangeData({ ...stageChangeData, lostReason: e.target.value })}
                  placeholder="e.g., Price, Competitor, No budget"
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <button onClick={() => setShowStageModal(false)} className="btn-outline" disabled={submitting}>
              Cancel
            </button>
            <button onClick={confirmStageChange} className="btn-primary" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Stage"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import * as React from "react";
import {
  ListTodo,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  Search,
  AlertTriangle,
  Building2,
  Phone,
  Mail,
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
  emptyStateMessages,
  modalTitles,
  getLeadStatusLabel,
} from "@/lib/terminology/labels";

interface Lead {
  lead_id: string;
  company_name: string;
  pic_name: string;
  contact_phone: string;
  email: string;
  city_area: string;
  service_code: string;
  primary_channel: string;
  triage_status: string;
  sla_deadline: string | null;
  created_at: string;
  notes: string | null;
}

const TRIAGE_ACTIONS = [
  { value: "Qualified", label: "Qualify", icon: CheckCircle, color: "text-success" },
  { value: "Nurture", label: "Nurture", icon: Clock, color: "text-warning" },
  { value: "Disqualified", label: "Disqualify", icon: XCircle, color: "text-destructive" },
];

export default function LeadInboxPage() {
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null);
  const [showTriageModal, setShowTriageModal] = React.useState(false);
  const [triageAction, setTriageAction] = React.useState("");
  const [triageNotes, setTriageNotes] = React.useState("");
  const [disqualifyReason, setDisqualifyReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [handingOver, setHandingOver] = React.useState(false);

  const fetchLeads = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/leads?view=inbox&pageSize=100");
      if (res.ok) {
        const data = await res.json();
        setLeads(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching leads:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleTriage = async () => {
    if (!selectedLead || !triageAction) return;

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        triage_status: triageAction,
        notes: triageNotes,
      };

      if (triageAction === "Disqualified") {
        if (!disqualifyReason) {
          alert("Please provide a reason for disqualification");
          setSubmitting(false);
          return;
        }
        body.disqualified_reason = disqualifyReason;
      }

      const res = await fetch(`/api/crm/leads/${selectedLead.lead_id}/triage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowTriageModal(false);
        setSelectedLead(null);
        setTriageAction("");
        setTriageNotes("");
        setDisqualifyReason("");
        fetchLeads();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to triage lead");
      }
    } catch (err) {
      console.error("Error triaging lead:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleHandover = async (lead: Lead) => {
    setHandingOver(true);
    try {
      const res = await fetch(`/api/crm/leads/${lead.lead_id}/handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Qualified and ready for sales" }),
      });

      if (res.ok) {
        fetchLeads();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to handover lead");
      }
    } catch (err) {
      console.error("Error handing over lead:", err);
    } finally {
      setHandingOver(false);
    }
  };

  const filteredLeads = leads.filter((l) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      l.company_name.toLowerCase().includes(searchLower) ||
      l.pic_name.toLowerCase().includes(searchLower) ||
      l.email.toLowerCase().includes(searchLower)
    );
  });

  const isSlaBreach = (deadline: string | null) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  const getTimeToSla = (deadline: string | null) => {
    if (!deadline) return null;
    const diff = new Date(deadline).getTime() - new Date().getTime();
    const hours = Math.round(diff / (1000 * 60 * 60));
    if (hours < 0) return `${Math.abs(hours)}h ${fieldLabels.pastDue.toLowerCase()}`;
    return `${hours}h remaining`;
  };

  const stats = {
    new: leads.filter((l) => l.triage_status === "New").length,
    inReview: leads.filter((l) => l.triage_status === "In Review").length,
    slaBreached: leads.filter((l) => isSlaBreach(l.sla_deadline)).length,
  };

  if (loading) {
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
          <h1 className="text-2xl font-bold text-foreground">{pageLabels.leadTriageQueue.title}</h1>
          <p className="text-muted-foreground">{pageLabels.leadTriageQueue.subtitle}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <ListTodo className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.new}</p>
            <p className="text-sm text-muted-foreground">New Leads</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
            <Clock className="h-6 w-6 text-warning" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.inReview}</p>
            <p className="text-sm text-muted-foreground">In Review</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.slaBreached}</p>
            <p className="text-sm text-muted-foreground">{fieldLabels.responseSla} {fieldLabels.pastDue}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Lead List */}
      <div className="card-flush overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Company</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Channel</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{fieldLabels.responseSla}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{fieldLabels.status}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{fieldLabels.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                  {emptyStateMessages.leadTriageQueue.title}
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead) => (
                <tr key={lead.lead_id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-medium">
                        {lead.company_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{lead.company_name}</p>
                        <p className="text-xs text-muted-foreground">{lead.city_area}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-foreground">{lead.pic_name}</p>
                    <p className="text-xs text-muted-foreground">{lead.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-foreground">{lead.primary_channel}</span>
                  </td>
                  <td className="px-6 py-4">
                    {lead.sla_deadline ? (
                      <span className={cn(
                        "text-sm font-medium",
                        isSlaBreach(lead.sla_deadline) ? "text-destructive" : "text-warning"
                      )}>
                        {getTimeToSla(lead.sla_deadline)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex px-2 py-1 rounded-full text-xs font-medium",
                      lead.triage_status === "New" ? "bg-primary/10 text-primary" :
                      lead.triage_status === "In Review" ? "bg-warning/10 text-warning" :
                      lead.triage_status === "Qualified" ? "bg-success/10 text-success" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {getLeadStatusLabel(lead.triage_status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedLead(lead);
                          setShowTriageModal(true);
                        }}
                        className="btn-ghost h-8 px-3 text-sm"
                      >
                        {actionLabels.triageLead}
                      </button>
                      {lead.triage_status === "Qualified" && (
                        <button
                          onClick={() => handleHandover(lead)}
                          disabled={handingOver}
                          className="btn-primary h-8 px-3 text-sm"
                        >
                          {handingOver ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <ArrowRight className="h-4 w-4 mr-1" />
                              {actionLabels.sendToSalesPool}
                            </>
                          )}
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

      {/* Triage Modal */}
      <Dialog open={showTriageModal} onOpenChange={setShowTriageModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{modalTitles.triageLead}</DialogTitle>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium text-foreground">{selectedLead.company_name}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{selectedLead.contact_phone}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>{selectedLead.email}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Action</label>
                <div className="grid grid-cols-3 gap-2">
                  {TRIAGE_ACTIONS.map((action) => (
                    <button
                      key={action.value}
                      onClick={() => setTriageAction(action.value)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors",
                        triageAction === action.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <action.icon className={cn("h-5 w-5", action.color)} />
                      <span className="text-sm font-medium">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {triageAction === "Disqualified" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Reason for Disqualification</label>
                  <input
                    type="text"
                    value={disqualifyReason}
                    onChange={(e) => setDisqualifyReason(e.target.value)}
                    placeholder="e.g., Not a fit, duplicate, invalid contact"
                    className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Notes (optional)</label>
                <textarea
                  value={triageNotes}
                  onChange={(e) => setTriageNotes(e.target.value)}
                  placeholder="Add any notes about this lead..."
                  className="w-full h-20 px-3 py-2 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <button
              onClick={() => setShowTriageModal(false)}
              className="btn-outline"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              onClick={handleTriage}
              className="btn-primary"
              disabled={submitting || !triageAction}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

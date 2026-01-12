"use client";

import * as React from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ProspectingTarget {
  target_id: string;
  company_name: string;
  domain: string | null;
  industry: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  city: string | null;
  status: string;
  next_outreach_at: string | null;
  last_contacted_at: string | null;
  owner?: { user_id: string; full_name: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  New: "bg-primary/10 text-primary",
  Contacted: "bg-warning/10 text-warning",
  Converted: "bg-success/10 text-success",
  "Not Interested": "bg-muted text-muted-foreground",
  Invalid: "bg-destructive/10 text-destructive",
};

export default function TargetsPage() {
  const [targets, setTargets] = React.useState<ProspectingTarget[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [showAddModal, setShowAddModal] = React.useState(false);
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

      if (res.ok) {
        const data = await res.json();
        alert(`Target converted! Opportunity created: ${data.opportunity_id}`);
        fetchTargets();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to convert target");
      }
    } catch (err) {
      console.error("Error converting target:", err);
    } finally {
      setConverting(null);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
    });
  };

  const stats = {
    new: targets.filter((t) => t.status === "New").length,
    contacted: targets.filter((t) => t.status === "Contacted").length,
    converted: targets.filter((t) => t.status === "Converted").length,
    dueToday: targets.filter((t) => {
      if (!t.next_outreach_at) return false;
      const due = new Date(t.next_outreach_at);
      const today = new Date();
      return due.toDateString() === today.toDateString();
    }).length,
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
          <h1 className="text-2xl font-bold text-foreground">Prospecting Targets</h1>
          <p className="text-muted-foreground">{targets.length} targets</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline h-10">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary h-10">
            <Plus className="h-4 w-4 mr-2" />
            Add Target
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
            <p className="text-sm text-muted-foreground">New</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
            <Phone className="h-6 w-6 text-warning" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.contacted}</p>
            <p className="text-sm text-muted-foreground">Contacted</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
            <ArrowRight className="h-6 w-6 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.converted}</p>
            <p className="text-sm text-muted-foreground">Converted</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-info/10">
            <Calendar className="h-6 w-6 text-info" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.dueToday}</p>
            <p className="text-sm text-muted-foreground">Due Today</p>
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
          <option value="New">New</option>
          <option value="Contacted">Contacted</option>
          <option value="Converted">Converted</option>
          <option value="Not Interested">Not Interested</option>
          <option value="Invalid">Invalid</option>
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
                      {target.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-foreground">{formatDate(target.next_outreach_at)}</span>
                  </td>
                  <td className="px-6 py-4">
                    {target.status !== "Converted" && target.status !== "Invalid" && (
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
            <DialogTitle>Add Prospecting Target</DialogTitle>
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
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  TrendingUp,
  UserX,
  RefreshCw,
  Search,
  Filter,
  Plus,
  LayoutGrid,
  List,
  X,
  Loader2,
  Building2,
  Phone,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const STAGES = [
  { value: "Prospect Created", label: "New", color: "bg-info" },
  { value: "Initial Contact", label: "Initial Contact", color: "bg-warning" },
  { value: "Need Analysis", label: "Need Analysis", color: "bg-warning" },
  { value: "Proposal Sent", label: "Proposal", color: "bg-primary" },
  { value: "Negotiation", label: "Negotiation", color: "bg-primary" },
  { value: "Closed Won", label: "Closed Won", color: "bg-success" },
  { value: "Closed Lost", label: "Closed Lost", color: "bg-destructive" },
  { value: "Nurturing", label: "Nurturing", color: "bg-secondary" },
];

interface Prospect {
  prospect_id: string;
  customer_id: string;
  current_stage: string;
  created_at: string;
  customers?: {
    customer_id: string;
    company_name: string;
    pic_name: string;
    pic_email: string;
    pic_phone: string;
  };
  owner?: {
    user_id: string;
    full_name: string;
    role_name: string;
  };
}

interface Customer {
  customer_id: string;
  company_name: string;
  pic_name: string;
  pic_email: string;
  pic_phone: string;
}

export default function ProspectsPage() {
  const [prospects, setProspects] = React.useState<Prospect[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [view, setView] = React.useState<"kanban" | "list">("kanban");
  const [search, setSearch] = React.useState("");
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [addMode, setAddMode] = React.useState<"existing" | "new">("new");
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = React.useState("");
  const [newCustomer, setNewCustomer] = React.useState({
    company_name: "",
    pic_name: "",
    pic_email: "",
    pic_phone: "",
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");

  const fetchProspects = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/prospects?pageSize=100");
      if (res.ok) {
        const data = await res.json();
        setProspects(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching prospects:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCustomers = React.useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("customers")
      .select("customer_id, company_name, pic_name, pic_email, pic_phone")
      .order("company_name")
      .limit(100);
    setCustomers(data || []);
  }, []);

  React.useEffect(() => {
    fetchProspects();
    fetchCustomers();
  }, [fetchProspects, fetchCustomers]);

  const handleAddProspect = async () => {
    setError("");
    setSubmitting(true);

    try {
      const body: Record<string, unknown> = {};

      if (addMode === "existing") {
        if (!selectedCustomerId) {
          setError("Please select a customer");
          setSubmitting(false);
          return;
        }
        body.customer_id = selectedCustomerId;
      } else {
        if (!newCustomer.company_name || !newCustomer.pic_name || !newCustomer.pic_email || !newCustomer.pic_phone) {
          setError("Please fill all customer fields");
          setSubmitting(false);
          return;
        }
        body.company_name = newCustomer.company_name;
        body.pic_name = newCustomer.pic_name;
        body.pic_email = newCustomer.pic_email;
        body.pic_phone = newCustomer.pic_phone;
      }

      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create prospect");
      }

      setShowAddModal(false);
      setSelectedCustomerId("");
      setNewCustomer({ company_name: "", pic_name: "", pic_email: "", pic_phone: "" });
      fetchProspects();
      fetchCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStageChange = async (prospectId: string, newStage: string) => {
    try {
      const res = await fetch("/api/prospects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospect_id: prospectId, current_stage: newStage }),
      });

      if (res.ok) {
        setProspects((prev) =>
          prev.map((p) =>
            p.prospect_id === prospectId ? { ...p, current_stage: newStage } : p
          )
        );
      }
    } catch (err) {
      console.error("Error updating prospect stage:", err);
    }
  };

  const filteredProspects = prospects.filter((p) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      p.prospect_id.toLowerCase().includes(searchLower) ||
      p.customers?.company_name.toLowerCase().includes(searchLower) ||
      p.customers?.pic_name.toLowerCase().includes(searchLower)
    );
  });

  const getProspectsByStage = (stage: string) =>
    filteredProspects.filter((p) => p.current_stage === stage);

  const stats = {
    active: filteredProspects.filter(
      (p) => !["Closed Won", "Closed Lost", "Nurturing"].includes(p.current_stage)
    ).length,
    won: filteredProspects.filter((p) => p.current_stage === "Closed Won").length,
    lost: filteredProspects.filter((p) => p.current_stage === "Closed Lost").length,
    nurturing: filteredProspects.filter((p) => p.current_stage === "Nurturing").length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 skeleton" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 skeleton rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-96 skeleton rounded-xl" />
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
          <h1 className="text-2xl font-bold text-foreground">Prospects</h1>
          <p className="text-muted-foreground">Track your sales pipeline opportunities</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("kanban")}
            className={cn(
              "btn-ghost h-9 px-3",
              view === "kanban" && "bg-muted"
            )}
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Kanban
          </button>
          <button
            onClick={() => setView("list")}
            className={cn(
              "btn-ghost h-9 px-3",
              view === "list" && "bg-muted"
            )}
          >
            <List className="h-4 w-4 mr-2" />
            List
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.active}</p>
            <p className="text-sm text-muted-foreground">Active</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
            <TrendingUp className="h-6 w-6 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.won}</p>
            <p className="text-sm text-muted-foreground">Won</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
            <UserX className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.lost}</p>
            <p className="text-sm text-muted-foreground">Lost</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10">
            <RefreshCw className="h-6 w-6 text-secondary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.nurturing}</p>
            <p className="text-sm text-muted-foreground">Nurturing</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search prospects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <button className="btn-outline h-10">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </button>
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogTrigger asChild>
            <button className="btn-primary h-10">
              <Plus className="h-4 w-4 mr-2" />
              Add Prospect
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Prospect</DialogTitle>
              <DialogDescription>
                Create a new prospect from an existing customer or add a new one.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Mode Selection */}
              <div className="flex gap-2">
                <button
                  onClick={() => setAddMode("new")}
                  className={cn(
                    "flex-1 h-10 rounded-lg border text-sm font-medium transition-colors",
                    addMode === "new"
                      ? "bg-primary text-white border-primary"
                      : "bg-transparent border-border text-foreground hover:bg-muted"
                  )}
                >
                  New Customer
                </button>
                <button
                  onClick={() => setAddMode("existing")}
                  className={cn(
                    "flex-1 h-10 rounded-lg border text-sm font-medium transition-colors",
                    addMode === "existing"
                      ? "bg-primary text-white border-primary"
                      : "bg-transparent border-border text-foreground hover:bg-muted"
                  )}
                >
                  Existing Customer
                </button>
              </div>

              {addMode === "existing" ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Select Customer
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">Select a customer...</option>
                    {customers.map((c) => (
                      <option key={c.customer_id} value={c.customer_id}>
                        {c.company_name} - {c.pic_name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Company Name
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={newCustomer.company_name}
                        onChange={(e) =>
                          setNewCustomer((prev) => ({ ...prev, company_name: e.target.value }))
                        }
                        placeholder="Enter company name"
                        className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Contact Person
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={newCustomer.pic_name}
                        onChange={(e) =>
                          setNewCustomer((prev) => ({ ...prev, pic_name: e.target.value }))
                        }
                        placeholder="Enter contact name"
                        className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="email"
                        value={newCustomer.pic_email}
                        onChange={(e) =>
                          setNewCustomer((prev) => ({ ...prev, pic_email: e.target.value }))
                        }
                        placeholder="Enter email"
                        className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Phone
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="tel"
                        value={newCustomer.pic_phone}
                        onChange={(e) =>
                          setNewCustomer((prev) => ({ ...prev, pic_phone: e.target.value }))
                        }
                        placeholder="Enter phone number"
                        className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}
            </div>

            <DialogFooter>
              <button
                onClick={() => setShowAddModal(false)}
                className="btn-outline"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleAddProspect}
                className="btn-primary"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Prospect
                  </>
                )}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban Board */}
      {view === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => (
            <div key={stage.value} className="card-flush min-w-[280px]">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", stage.color)} />
                  <h3 className="font-medium text-foreground">{stage.label}</h3>
                </div>
                <span className="text-sm text-muted-foreground">
                  {getProspectsByStage(stage.value).length}
                </span>
              </div>
              <div className="p-2 space-y-2 min-h-[200px]">
                {getProspectsByStage(stage.value).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No prospects
                  </p>
                ) : (
                  getProspectsByStage(stage.value).map((prospect) => (
                    <div
                      key={prospect.prospect_id}
                      className="p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/50 transition-colors cursor-pointer"
                    >
                      <p className="text-sm font-medium text-foreground truncate">
                        {prospect.customers?.company_name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {prospect.customers?.pic_name}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                          {prospect.prospect_id}
                        </span>
                        <select
                          value={prospect.current_stage}
                          onChange={(e) =>
                            handleStageChange(prospect.prospect_id, e.target.value)
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs bg-transparent border-none focus:outline-none text-primary cursor-pointer"
                        >
                          {STAGES.map((s) => (
                            <option key={s.value} value={s.value}>
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
          ))}
        </div>
      )}

      {/* List View */}
      {view === "list" && (
        <div className="card-flush overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Prospect ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Stage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Owner
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProspects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                    No prospects found
                  </td>
                </tr>
              ) : (
                filteredProspects.map((prospect) => {
                  const stage = STAGES.find((s) => s.value === prospect.current_stage);
                  return (
                    <tr
                      key={prospect.prospect_id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-foreground">
                          {prospect.prospect_id}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-foreground">
                          {prospect.customers?.company_name || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm text-foreground">
                            {prospect.customers?.pic_name || "-"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {prospect.customers?.pic_email}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
                            stage?.color,
                            "text-white"
                          )}
                        >
                          {stage?.label || prospect.current_stage}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-muted-foreground">
                          {prospect.owner?.full_name || "-"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

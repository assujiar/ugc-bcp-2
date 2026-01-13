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
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Ban,
  ListTodo,
  MoreHorizontal,
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

// PR3.2: Status tabs configuration
type TargetTab = "all" | "new" | "contacted" | "converted" | "not_interested" | "invalid";

const TARGET_TABS: { id: TargetTab; label: string; icon: React.ElementType; status: string | null }[] = [
  { id: "all", label: "All Targets", icon: ListTodo, status: null },
  { id: "new", label: "New", icon: Target, status: "New" },
  { id: "contacted", label: "Contacted", icon: Phone, status: "Contacted" },
  { id: "converted", label: "Converted", icon: CheckCircle, status: "Converted" },
  { id: "not_interested", label: "Not Interested", icon: Ban, status: "Not Interested" },
  { id: "invalid", label: "Invalid", icon: XCircle, status: "Invalid" },
];

const TARGET_STATUSES = ["New", "Contacted", "Converted", "Not Interested", "Invalid"] as const;

const STATUS_COLORS: Record<string, string> = {
  New: "bg-primary/10 text-primary",
  Contacted: "bg-warning/10 text-warning",
  Converted: "bg-success/10 text-success",
  "Not Interested": "bg-muted text-muted-foreground",
  Invalid: "bg-destructive/10 text-destructive",
};

// PR3.1: CSV Import types
interface CSVRow {
  company_name: string;
  domain?: string;
  industry?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  city?: string;
  notes?: string;
}

export default function TargetsPage() {
  const [targets, setTargets] = React.useState<ProspectingTarget[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<TargetTab>("all");
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
  const [updatingStatus, setUpdatingStatus] = React.useState<string | null>(null);

  // PR3.1: CSV Import state
  const [showImportModal, setShowImportModal] = React.useState(false);
  const [csvData, setCsvData] = React.useState<CSVRow[]>([]);
  const [csvError, setCsvError] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<{ imported: number; total: number } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // PR3.2: Fetch based on active tab
  const fetchTargets = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: "100" });
      if (search) params.set("search", search);

      // Get status filter from active tab
      const tabConfig = TARGET_TABS.find((t) => t.id === activeTab);
      if (tabConfig?.status) {
        params.set("status", tabConfig.status);
      }

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
  }, [search, activeTab]);

  React.useEffect(() => {
    const debounce = setTimeout(fetchTargets, 300);
    return () => clearTimeout(debounce);
  }, [fetchTargets]);

  // PR3.2: Handle status update
  const handleStatusChange = async (targetId: string, newStatus: string) => {
    setUpdatingStatus(targetId);
    try {
      const res = await fetch(`/api/crm/targets/${targetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        fetchTargets();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update status");
      }
    } catch (err) {
      console.error("Error updating status:", err);
    } finally {
      setUpdatingStatus(null);
    }
  };

  // PR3.1: Parse CSV file
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvError(null);
    setCsvData([]);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter((line) => line.trim());

        if (lines.length < 2) {
          setCsvError("CSV file must have a header row and at least one data row");
          return;
        }

        // Parse header
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[^a-z_]/g, "_"));

        // Map common variations
        const headerMap: Record<string, string> = {
          company: "company_name",
          name: "company_name",
          website: "domain",
          email: "contact_email",
          phone: "contact_phone",
          contact: "contact_name",
        };

        const normalizedHeaders = headers.map((h) => headerMap[h] || h);

        // Check for required field
        if (!normalizedHeaders.includes("company_name")) {
          setCsvError("CSV must have a 'company_name' or 'company' column");
          return;
        }

        // Parse data rows
        const rows: CSVRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
          const row: Record<string, string> = {};

          normalizedHeaders.forEach((header, index) => {
            if (values[index]) {
              row[header] = values[index];
            }
          });

          if (row.company_name) {
            rows.push(row as unknown as CSVRow);
          }
        }

        if (rows.length === 0) {
          setCsvError("No valid data rows found in CSV");
          return;
        }

        setCsvData(rows);
      } catch (err) {
        setCsvError("Failed to parse CSV file");
        console.error("CSV parse error:", err);
      }
    };

    reader.readAsText(file);
  };

  // PR3.1: Import CSV data
  const handleImportCSV = async () => {
    if (csvData.length === 0) return;

    setImporting(true);
    try {
      const res = await fetch("/api/crm/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets: csvData }),
      });

      if (res.ok) {
        const data = await res.json();
        setImportResult({ imported: data.imported, total: data.total });
        fetchTargets();
      } else {
        const data = await res.json();
        setCsvError(data.error || "Failed to import targets");
      }
    } catch (err) {
      setCsvError("Failed to import targets");
      console.error("Import error:", err);
    } finally {
      setImporting(false);
    }
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setCsvData([]);
    setCsvError(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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
          <h1 className="text-2xl font-bold text-foreground">{pageLabels.prospectingTargets.title}</h1>
          <p className="text-muted-foreground">{pageLabels.prospectingTargets.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImportModal(true)} className="btn-outline h-10">
            <Upload className="h-4 w-4 mr-2" />
            {actionLabels.import}
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary h-10">
            <Plus className="h-4 w-4 mr-2" />
            {actionLabels.add} Target
          </button>
        </div>
      </div>

      {/* PR3.2: Status Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TARGET_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
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

      {/* Search */}
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
                    {/* PR3.2: Status dropdown for updates */}
                    <select
                      value={target.status}
                      onChange={(e) => handleStatusChange(target.target_id, e.target.value)}
                      disabled={updatingStatus === target.target_id || target.status === "Converted" || target.status === "Invalid"}
                      className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50",
                        STATUS_COLORS[target.status] || "bg-muted text-muted-foreground",
                        (target.status === "Converted" || target.status === "Invalid") && "cursor-not-allowed opacity-70"
                      )}
                    >
                      {TARGET_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    {updatingStatus === target.target_id && (
                      <Loader2 className="inline-block ml-2 h-3 w-3 animate-spin" />
                    )}
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
                            {actionLabels.convertToLeadOpportunity}
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

      {/* PR3.1: CSV Import Modal */}
      <Dialog open={showImportModal} onOpenChange={closeImportModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Import Targets from CSV
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* File Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select CSV File</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="w-full h-10 px-3 py-2 rounded-lg bg-muted/50 border border-border text-foreground file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
              <p className="text-xs text-muted-foreground">
                Required column: company_name (or company). Optional: domain, industry, contact_name, contact_email, contact_phone, city
              </p>
            </div>

            {/* Error Display */}
            {csvError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {csvError}
              </div>
            )}

            {/* Success Display */}
            {importResult && (
              <div className="p-3 rounded-lg bg-success/10 text-success text-sm">
                Successfully imported {importResult.imported} of {importResult.total} targets
              </div>
            )}

            {/* Preview Table */}
            {csvData.length > 0 && !importResult && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Preview ({csvData.length} rows)</p>
                <div className="max-h-64 overflow-auto border border-border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Company</th>
                        <th className="px-3 py-2 text-left">Domain</th>
                        <th className="px-3 py-2 text-left">Contact</th>
                        <th className="px-3 py-2 text-left">City</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {csvData.slice(0, 10).map((row, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2">{row.company_name}</td>
                          <td className="px-3 py-2">{row.domain || "-"}</td>
                          <td className="px-3 py-2">{row.contact_name || "-"}</td>
                          <td className="px-3 py-2">{row.city || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {csvData.length > 10 && (
                  <p className="text-xs text-muted-foreground">
                    Showing first 10 of {csvData.length} rows
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <button onClick={closeImportModal} className="btn-outline" disabled={importing}>
              {importResult ? "Close" : "Cancel"}
            </button>
            {!importResult && (
              <button
                onClick={handleImportCSV}
                className="btn-primary"
                disabled={importing || csvData.length === 0}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Importing...
                  </>
                ) : (
                  `Import ${csvData.length} Targets`
                )}
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

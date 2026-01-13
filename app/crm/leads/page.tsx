"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useUser } from "@/lib/contexts/user-context";
import { fetchLeads, Lead, PaginatedResponse } from "@/lib/api";
import { DataTable, Column } from "@/components/table";
import { FilterField } from "@/components/filter";
import {
  Users,
  Plus,
  Download,
  Building2,
  Mail,
  ExternalLink,
  MoreHorizontal,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Status badge styling
function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    New: "badge-info",
    Contacted: "badge-warning",
    Qualified: "badge-success",
    Proposal: "badge-primary",
    Negotiation: "badge-primary",
    "Closed Won": "badge-success",
    "Closed Lost": "badge-destructive",
    Disqualified: "badge-destructive",
  };
  return styles[status] || "badge";
}

// Filter fields
const filterFields: FilterField[] = [
  {
    key: "search",
    label: "Search",
    type: "search",
    placeholder: "Search leads...",
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "New", label: "New" },
      { value: "Contacted", label: "Contacted" },
      { value: "Qualified", label: "Qualified" },
      { value: "Proposal", label: "Proposal" },
      { value: "Negotiation", label: "Negotiation" },
      { value: "Closed Won", label: "Closed Won" },
      { value: "Closed Lost", label: "Closed Lost" },
    ],
  },
  {
    key: "channel",
    label: "Channel",
    type: "select",
    options: [
      { value: "LinkedIn", label: "LinkedIn" },
      { value: "SEM", label: "SEM" },
      { value: "Paid Social", label: "Paid Social" },
      { value: "Website (Direct/Referral)", label: "Website" },
      { value: "Sales Outbound", label: "Sales Outbound" },
      { value: "Sales Referral", label: "Sales Referral" },
    ],
  },
];

// Table columns
const columns: Column<Lead>[] = [
  {
    key: "company_name",
    header: "Lead",
    sortable: true,
    render: (_, row) => (
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-muted text-muted-foreground font-medium">
          {row.company_name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-medium text-foreground">{row.company_name}</p>
          <p className="text-xs text-muted-foreground">{row.lead_id}</p>
        </div>
      </div>
    ),
  },
  {
    key: "pic_name",
    header: "Contact",
    render: (_, row) => (
      <div className="flex items-center gap-2">
        <div>
          <p className="text-sm text-foreground">{row.pic_name}</p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Mail className="h-3 w-3" />
            {row.email}
          </div>
        </div>
      </div>
    ),
  },
  {
    key: "primary_channel",
    header: "Channel",
    render: (value) => (
      <span className="text-sm text-muted-foreground">{value as string}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    render: (value) => (
      <span className={cn("badge text-xs", getStatusBadge(value as string))}>
        {value as string}
      </span>
    ),
  },
  {
    key: "owner_profile",
    header: "Owner",
    render: (_, row) => (
      <span className="text-sm text-muted-foreground">
        {row.owner_profile?.full_name || "-"}
      </span>
    ),
  },
  {
    key: "lead_date",
    header: "Date",
    sortable: true,
    render: (value) => (
      <span className="text-sm text-muted-foreground">
        {new Date(value as string).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}
      </span>
    ),
  },
  {
    key: "actions",
    header: "Actions",
    align: "right",
    render: (_, row) => (
      <div className="flex items-center justify-end gap-1">
        <Link
          href={`/crm/leads/${row.lead_id}`}
          className="p-2 hover:bg-muted rounded-[8px] transition-colors"
        >
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
        </Link>
        <button className="p-2 hover:bg-muted rounded-[8px] transition-colors">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    ),
  },
];

export default function CrmLeadsPage() {
  const { user, isDirector } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = React.useState<Lead[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [pagination, setPagination] = React.useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  // Pipeline stats
  const [pipelineStats, setPipelineStats] = React.useState({
    new: 0,
    contacted: 0,
    qualified: 0,
    proposal: 0,
    negotiation: 0,
  });

  // Load data on mount and when filters change
  React.useEffect(() => {
    async function loadLeads() {
      setLoading(true);
      setError(null);

      const params = {
        page: parseInt(searchParams.get("page") || "1", 10),
        pageSize: parseInt(searchParams.get("pageSize") || "20", 10),
        search: searchParams.get("search") || undefined,
        status: searchParams.get("status") || undefined,
        channel: searchParams.get("channel") || undefined,
        sortBy: searchParams.get("sortBy") || "lead_date",
        sortOrder: (searchParams.get("sortOrder") || "desc") as "asc" | "desc",
      };

      const result = await fetchLeads(params);

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        const response = result.data as PaginatedResponse<Lead>;
        setData(response.data || []);
        setPagination(response.pagination);

        // Calculate pipeline stats from all leads
        const stats = { new: 0, contacted: 0, qualified: 0, proposal: 0, negotiation: 0 };
        (response.data || []).forEach((lead) => {
          const status = lead.status.toLowerCase();
          if (status === "new") stats.new++;
          else if (status === "contacted") stats.contacted++;
          else if (status === "qualified") stats.qualified++;
          else if (status === "proposal") stats.proposal++;
          else if (status === "negotiation") stats.negotiation++;
        });
        setPipelineStats(stats);
      }

      setLoading(false);
    }

    loadLeads();
  }, [searchParams]);

  const totalLeads = pagination.total;

  return (
    <>
      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CRM - Leads</h1>
          <p className="text-muted-foreground">Manage your sales pipeline</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-outline inline-flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export
          </button>
          {!isDirector && (
            <Link href="/crm/leads/new" className="btn-primary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Lead
            </Link>
          )}
        </div>
      </div>

      {/* Pipeline Overview */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground">Pipeline Overview</h3>
            <p className="text-sm text-muted-foreground">Lead stages breakdown</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground">{totalLeads}</p>
              <p className="text-xs text-muted-foreground">Total Leads</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 rounded-[12px] bg-info/10 border border-info/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-info" />
              <span className="text-sm font-medium text-info">New</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{pipelineStats.new}</p>
          </div>
          <div className="p-4 rounded-[12px] bg-warning/10 border border-warning/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-warning" />
              <span className="text-sm font-medium text-warning">Contacted</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{pipelineStats.contacted}</p>
          </div>
          <div className="p-4 rounded-[12px] bg-success/10 border border-success/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-success" />
              <span className="text-sm font-medium text-success">Qualified</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{pipelineStats.qualified}</p>
          </div>
          <div className="p-4 rounded-[12px] bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-sm font-medium text-primary">Proposal</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{pipelineStats.proposal}</p>
          </div>
          <div className="p-4 rounded-[12px] bg-secondary/10 border border-secondary/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-secondary" />
              <span className="text-sm font-medium text-secondary">Negotiation</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{pipelineStats.negotiation}</p>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 rounded-[14px] bg-destructive/10 border border-destructive/20 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Data Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading leads...</span>
        </div>
      ) : (
        <DataTable
          data={data}
          columns={columns}
          total={pagination.total}
          pageSize={pagination.pageSize}
          page={pagination.page}/>
      )}
    </>
  );
}



"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useUser } from "@/lib/contexts/user-context";
import { fetchTickets, Ticket, PaginatedResponse } from "@/lib/api";
import { DataTable, Column } from "@/components/table";
import { FilterField } from "@/components/filter";
import {
  Plus,
  Ticket as TicketIcon,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Status badge styling
function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    OPEN: "badge-warning",
    "WAITING RESPON": "badge-info",
    "WAITING CUSTOMER": "badge-info",
    "IN PROGRESS": "badge-info",
    CLOSED: "badge-success",
    "CLOSED LOST": "badge-destructive",
  };
  return styles[status] || "badge";
}

// Filter fields
const filterFields: FilterField[] = [
  {
    key: "search",
    label: "Search",
    type: "search",
    placeholder: "Search tickets...",
  },
  {
    key: "ticket_type",
    label: "Type",
    type: "select",
    options: [
      { value: "inquiry tariff", label: "Inquiry Tariff (RFQ)" },
      { value: "general request", label: "General Request" },
      { value: "request pickup", label: "Request Pickup" },
      { value: "request delivery", label: "Request Delivery" },
    ],
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "OPEN", label: "Open" },
      { value: "WAITING RESPON", label: "Waiting Response" },
      { value: "WAITING CUSTOMER", label: "Waiting Customer" },
      { value: "IN PROGRESS", label: "In Progress" },
      { value: "CLOSED", label: "Closed" },
      { value: "CLOSED LOST", label: "Closed Lost" },
    ],
  },
  {
    key: "dept_target",
    label: "Department",
    type: "select",
    options: [
      { value: "DOM", label: "Domestics Ops" },
      { value: "EXI", label: "EXIM Ops" },
      { value: "DTD", label: "Import DTD Ops" },
      { value: "TRF", label: "Warehouse & Traffic" },
    ],
  },
];

// Table columns
const columns: Column<Ticket>[] = [
  {
    key: "ticket_id",
    header: "Ticket",
    sortable: true,
    render: (_, row) => (
      <div>
        <p className="font-medium text-foreground">{row.ticket_id}</p>
        <p className="text-xs text-muted-foreground capitalize">{row.ticket_type}</p>
      </div>
    ),
  },
  {
    key: "subject",
    header: "Subject",
    render: (value, row) => (
      <div className="max-w-[300px]">
        <p className="text-sm text-foreground truncate">{value as string}</p>
        {row.description && (
          <p className="text-xs text-muted-foreground truncate">{row.description}</p>
        )}
      </div>
    ),
  },
  {
    key: "dept_target",
    header: "Dept",
    render: (value) => {
      const deptLabels: Record<string, string> = {
        DOM: "Domestics",
        EXI: "EXIM",
        DTD: "Import DTD",
        TRF: "Traffic",
        MKT: "Marketing",
        SAL: "Sales",
      };
      return (
        <span className="text-sm text-muted-foreground">
          {String(deptLabels[value as string] || value)}
        </span>
      );
    },
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    render: (_, row) => {
      const status = row.inquiry_status || row.ticket_status || "OPEN";
      return (
        <span className={cn("badge text-xs", getStatusBadge(status))}>
          {status}
        </span>
      );
    },
  },
  {
    key: "assigned_to_profile",
    header: "Assignee",
    render: (_, row) => (
      <span className="text-sm text-muted-foreground">
        {row.assigned_to_profile?.full_name || "-"}
      </span>
    ),
  },
  {
    key: "created_at",
    header: "Created",
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
          href={`/ticketing/${row.ticket_id}`}
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

export default function TicketingPage() {
  const { user, isDirector, isOps } = useUser();
  const searchParams = useSearchParams();

  const [data, setData] = React.useState<Ticket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [pagination, setPagination] = React.useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  // Status counts
  const [statusCounts, setStatusCounts] = React.useState({
    open: 0,
    in_progress: 0,
    closed: 0,
    closed_lost: 0,
  });

  // Ops-specific metrics
  const [opsMetrics, setOpsMetrics] = React.useState({
    avgResponseTime: 0,
    ticketsNeedingResponse: 0,
    slaBreached: 0,
  });

  // Load data
  React.useEffect(() => {
    async function loadTickets() {
      setLoading(true);
      setError(null);

      const params = {
        page: parseInt(searchParams.get("page") || "1", 10),
        pageSize: parseInt(searchParams.get("pageSize") || "20", 10),
        search: searchParams.get("search") || undefined,
        ticket_type: searchParams.get("ticket_type") || undefined,
        status: searchParams.get("status") || undefined,
        dept_target: searchParams.get("dept_target") || undefined,
        sortBy: searchParams.get("sortBy") || "created_at",
        sortOrder: (searchParams.get("sortOrder") || "desc") as "asc" | "desc",
      };

      const result = await fetchTickets(params);

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        const response = result.data as PaginatedResponse<Ticket>;
        setData(response.data || []);
        setPagination(response.pagination);

        // Calculate status counts
        const counts = { open: 0, in_progress: 0, closed: 0, closed_lost: 0 };
        let ticketsNeedingResponse = 0;
        let slaBreached = 0;

        (response.data || []).forEach((ticket) => {
          const status = ticket.inquiry_status || ticket.ticket_status || "";
          if (status === "OPEN") {
            counts.open++;
            // Tickets needing response: Open for more than 4 hours
            const createdAt = new Date(ticket.created_at);
            const hoursOpen = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
            if (hoursOpen > 4 && status === "OPEN") {
              ticketsNeedingResponse++;
            }
            if (hoursOpen > 24 && status === "OPEN") {
              slaBreached++;
            }
          } else if (["WAITING RESPON", "WAITING CUSTOMER", "IN PROGRESS"].includes(status)) {
            counts.in_progress++;
          } else if (status === "CLOSED") {
            counts.closed++;
          } else if (status === "CLOSED LOST") {
            counts.closed_lost++;
          }
        });
        setStatusCounts(counts);
        setOpsMetrics({
          avgResponseTime: 0, // This would come from API v_ticket_first_response_median
          ticketsNeedingResponse,
          slaBreached,
        });
      }

      setLoading(false);
    }

    loadTickets();
  }, [searchParams]);

  return (
    <>
      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ticketing</h1>
          <p className="text-muted-foreground">Manage RFQ and service requests</p>
        </div>
        {!isDirector && (
          <Link href="/ticketing/create" className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Ticket
          </Link>
        )}
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-[12px] bg-warning/10">
            <Clock className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{statusCounts.open}</p>
            <p className="text-sm text-muted-foreground">Open</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-[12px] bg-info/10">
            <TicketIcon className="h-5 w-5 text-info" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{statusCounts.in_progress}</p>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-[12px] bg-success/10">
            <CheckCircle className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{statusCounts.closed}</p>
            <p className="text-sm text-muted-foreground">Closed</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-[12px] bg-destructive/10">
            <XCircle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{statusCounts.closed_lost}</p>
            <p className="text-sm text-muted-foreground">Closed Lost</p>
          </div>
        </div>
      </div>

      {/* Ops Response Time Monitoring - Only shown to Ops roles */}
      {isOps && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-foreground mb-3">Response Time Monitoring</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card border-l-4 border-l-warning">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[10px] bg-warning/10">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{opsMetrics.ticketsNeedingResponse}</p>
                  <p className="text-sm text-muted-foreground">Needs Response (&gt;4h)</p>
                </div>
              </div>
              {opsMetrics.ticketsNeedingResponse > 0 && (
                <p className="text-xs text-warning mt-2">⚠️ Action required</p>
              )}
            </div>
            <div className={cn(
              "card border-l-4",
              opsMetrics.slaBreached > 0 ? "border-l-destructive" : "border-l-success"
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-[10px]",
                  opsMetrics.slaBreached > 0 ? "bg-destructive/10" : "bg-success/10"
                )}>
                  <AlertCircle className={cn(
                    "h-5 w-5",
                    opsMetrics.slaBreached > 0 ? "text-destructive" : "text-success"
                  )} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{opsMetrics.slaBreached}</p>
                  <p className="text-sm text-muted-foreground">SLA Breached (&gt;24h)</p>
                </div>
              </div>
              {opsMetrics.slaBreached > 0 && (
                <p className="text-xs text-destructive mt-2">🚨 Escalation needed</p>
              )}
            </div>
            <div className="card border-l-4 border-l-info">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[10px] bg-info/10">
                  <CheckCircle className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {statusCounts.open === 0 ? "100%" : 
                      `${Math.round(((statusCounts.open - opsMetrics.ticketsNeedingResponse) / Math.max(statusCounts.open, 1)) * 100)}%`
                    }
                  </p>
                  <p className="text-sm text-muted-foreground">SLA Compliance</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
          <span className="ml-3 text-muted-foreground">Loading tickets...</span>
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




"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useUser } from "@/lib/contexts/user-context";
import { fetchInvoices, Invoice, PaginatedResponse } from "@/lib/api";
import { DataTable, Column } from "@/components/table";
import { FilterField } from "@/components/filter";
import {
  FileText,
  Plus,
  ExternalLink,
  MoreHorizontal,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatCurrency(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

// Filter fields
const filterFields: FilterField[] = [
  {
    key: "search",
    label: "Search",
    type: "search",
    placeholder: "Search invoices...",
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "paid", label: "Paid" },
      { value: "outstanding", label: "Outstanding" },
      { value: "overdue", label: "Overdue" },
    ],
  },
];

// Table columns
const columns: Column<Invoice>[] = [
  {
    key: "invoice_id",
    header: "Invoice",
    sortable: true,
    render: (_, row) => (
      <div>
        <p className="font-medium text-foreground">{row.invoice_id}</p>
        <p className="text-xs text-muted-foreground">{row.company_name || row.customer_id}</p>
      </div>
    ),
  },
  {
    key: "invoice_date",
    header: "Invoice Date",
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
    key: "due_date",
    header: "Due Date",
    sortable: true,
    render: (value, row) => (
      <span className={cn(
        "text-sm",
        row.is_overdue ? "text-destructive font-medium" : "text-muted-foreground"
      )}>
        {new Date(value as string).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}
      </span>
    ),
  },
  {
    key: "invoice_amount",
    header: "Amount",
    align: "right",
    render: (value) => (
      <span className="text-sm font-medium text-foreground">
        {formatCurrency(value as number)}
      </span>
    ),
  },
  {
    key: "outstanding_amount",
    header: "Outstanding",
    align: "right",
    render: (value, row) => {
      const outstanding = value as number;
      return (
        <span className={cn(
          "text-sm font-medium",
          outstanding > 0 ? (row.is_overdue ? "text-destructive" : "text-warning") : "text-success"
        )}>
          {formatCurrency(outstanding)}
        </span>
      );
    },
  },
  {
    key: "status",
    header: "Status",
    render: (_, row) => {
      const outstanding = row.outstanding_amount || 0;
      if (outstanding === 0) {
        return (
          <span className="badge badge-success text-xs inline-flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Paid
          </span>
        );
      }
      if (row.is_overdue) {
        return (
          <span className="badge badge-destructive text-xs inline-flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Overdue ({row.days_past_due}d)
          </span>
        );
      }
      return (
        <span className="badge badge-warning text-xs inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Outstanding
        </span>
      );
    },
  },
  {
    key: "actions",
    header: "Actions",
    align: "right",
    render: (_, row) => (
      <div className="flex items-center justify-end gap-1">
        <button className="p-2 hover:bg-muted rounded-[8px] transition-colors">
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
        </button>
        <button className="p-2 hover:bg-muted rounded-[8px] transition-colors">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    ),
  },
];

export default function InvoicesPage() {
  const { user, isFinance } = useUser();
  const searchParams = useSearchParams();

  const [data, setData] = React.useState<Invoice[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [pagination, setPagination] = React.useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  // Stats
  const [stats, setStats] = React.useState({
    totalAmount: 0,
    paidAmount: 0,
    overdueCount: 0,
  });

  React.useEffect(() => {
    async function loadInvoices() {
      setLoading(true);
      setError(null);

      const params = {
        page: parseInt(searchParams.get("page") || "1", 10),
        pageSize: parseInt(searchParams.get("pageSize") || "20", 10),
        search: searchParams.get("search") || undefined,
        status: searchParams.get("status") || undefined,
        sortBy: searchParams.get("sortBy") || "invoice_date",
        sortOrder: (searchParams.get("sortOrder") || "desc") as "asc" | "desc",
      };

      const result = await fetchInvoices(params);

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        const response = result.data as PaginatedResponse<Invoice>;
        setData(response.data || []);
        setPagination(response.pagination);

        // Calculate stats
        const invoices = response.data || [];
        const totalAmount = invoices.reduce((sum, inv) => sum + (inv.invoice_amount || 0), 0);
        const paidAmount = invoices.reduce((sum, inv) => sum + ((inv.invoice_amount || 0) - (inv.outstanding_amount || 0)), 0);
        const overdueCount = invoices.filter(inv => inv.is_overdue).length;
        setStats({ totalAmount, paidAmount, overdueCount });
      }

      setLoading(false);
    }

    loadInvoices();
  }, [searchParams]);

  const canCreate = isFinance || user?.role_name === "super admin";

  return (
    <>
      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
          <p className="text-muted-foreground">Manage customer invoices</p>
        </div>
        {canCreate && (
          <Link href="/dso/invoices/new" className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Invoice
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card">
          <p className="text-sm text-muted-foreground mb-1">Total Invoices</p>
          <p className="text-2xl font-bold text-foreground">{pagination.total}</p>
        </div>
        <div className="card">
          <p className="text-sm text-muted-foreground mb-1">This Page Total</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalAmount)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-muted-foreground mb-1">Overdue</p>
          <p className="text-2xl font-bold text-destructive">{stats.overdueCount}</p>
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
          <span className="ml-3 text-muted-foreground">Loading invoices...</span>
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



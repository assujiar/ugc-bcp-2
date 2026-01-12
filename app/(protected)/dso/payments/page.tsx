"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DataTable, Column } from "@/components/table";
import { Payment, fetchAllPayments } from "@/lib/api/client";
import { formatCurrency } from "@/lib/utils";
import { useUser } from "@/lib/contexts/user-context";
import { 
  CreditCard, 
  Plus,
  TrendingUp,
  DollarSign,
  Search
} from "lucide-react";
import Link from "next/link";

export default function PaymentsPage() {
  const router = useRouter();
  const { isFinance, isSuperAdmin } = useUser();
  const [data, setData] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
  });

  const canCreate = isFinance || isSuperAdmin;

  useEffect(() => {
    loadData();
  }, [pagination.page, searchQuery]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchAllPayments({
        page: pagination.page,
        pageSize: pagination.pageSize,
        search: searchQuery,
      });

      if (result.data) {
        setData(result.data.data);
        setPagination(prev => ({
          ...prev,
          total: result.data?.pagination.total || 0,
        }));
      }
    } catch (error) {
      console.error("Error loading payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = data.reduce((sum, p) => sum + p.amount, 0);

  const columns: Column<Payment>[] = [
    {
      key: "invoice_id",
      header: "Invoice",
      sortable: true,
      render: (_value, row) => (
        <div>
          <p className="font-medium text-foreground">{row.invoice_id}</p>
          <p className="text-xs text-muted-foreground">
            {row.invoice?.customer?.company_name || "-"}
          </p>
        </div>
      ),
    },
    {
      key: "payment_date",
      header: "Date",
      sortable: true,
      render: (_value, row) => new Date(row.payment_date).toLocaleDateString("id-ID"),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      render: (_value, row) => (
        <span className="font-medium text-green-600">
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    {
      key: "payment_method",
      header: "Method",
      render: (_value, row) => (
        <span className="text-sm">{row.payment_method || "-"}</span>
      ),
    },
    {
      key: "reference_no",
      header: "Reference",
      render: (_value, row) => (
        <span className="text-sm text-muted-foreground">{row.reference_no || "-"}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Payments</h1>
          <p className="text-muted-foreground">View all payment records</p>
        </div>
        {canCreate && (
          <Link
            href="/dso/payments/new"
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Record Payment
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Payments</p>
              <p className="text-xl font-semibold">{formatCurrency(totalAmount)}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <CreditCard className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Payment Count</p>
              <p className="text-xl font-semibold">{pagination.total}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg. Payment</p>
              <p className="text-xl font-semibold">
                {data.length > 0 ? formatCurrency(totalAmount / data.length) : "-"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search payments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <DataTable
          data={data}
          columns={columns}
          loading={loading}
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
          onRowClick={(row) => router.push(`/dso/invoices/${row.invoice_id}`)}
        />
      </div>
    </div>
  );
}


"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Search,
  ChevronDown,
  Building2,
  DollarSign,
  AlertTriangle,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface CustomerAR {
  customer_id: string;
  company_name: string;
  ar_total: number;
  bucket_1_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
}

interface ARStats {
  customerCount: number;
  totalAR: number;
  overdue: number;
  overduePercent: number;
}

export default function MyCustomersARPage() {
  const [customers, setCustomers] = React.useState<CustomerAR[]>([]);
  const [stats, setStats] = React.useState<ARStats>({
    customerCount: 0,
    totalAR: 0,
    overdue: 0,
    overduePercent: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [agingFilter, setAgingFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const pageSize = 20;

  React.useEffect(() => {
    async function fetchARData() {
      const supabase = createClient();

      try {
        // Fetch AR aging data from view
        const { data: arData, error } = await supabase
          .from("v_my_customers_ar")
          .select("*")
          .order("ar_total", { ascending: false });

        if (error) throw error;

        const typedData = (arData || []) as CustomerAR[];
        setCustomers(typedData);

        // Calculate stats
        const totalAR = typedData.reduce((sum, c) => sum + (c.ar_total || 0), 0);
        const overdue = typedData.reduce(
          (sum, c) =>
            sum +
            (c.bucket_1_30 || 0) +
            (c.bucket_31_60 || 0) +
            (c.bucket_61_90 || 0) +
            (c.bucket_90_plus || 0),
          0
        );

        setStats({
          customerCount: typedData.length,
          totalAR,
          overdue,
          overduePercent: totalAR > 0 ? (overdue / totalAR) * 100 : 0,
        });
      } catch (error) {
        console.error("Error fetching AR data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchARData();
  }, []);

  const filteredCustomers = React.useMemo(() => {
    return customers.filter((c) => {
      const matchesSearch =
        searchQuery === "" ||
        c.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.customer_id.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [customers, searchQuery]);

  const paginatedCustomers = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, page]);

  const totalPages = Math.ceil(filteredCustomers.length / pageSize);

  const formatCurrency = (value: number) => {
    return `Rp ${value.toLocaleString("id-ID")}`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 skeleton" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 skeleton rounded-xl" />
          ))}
        </div>
        <div className="h-64 skeleton rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dso" className="hover:text-foreground">
          DSO
        </Link>
        <span>/</span>
        <span className="text-foreground">My Customers AR</span>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Customers AR</h1>
          <p className="text-muted-foreground">Accounts receivable for customers you own</p>
        </div>
        <Link href="/dso" className="btn-outline">
          <ChevronLeft className="h-4 w-4" />
          Back to DSO
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-compact flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.customerCount}</p>
            <p className="text-sm text-muted-foreground">Customers</p>
          </div>
        </div>
        <div className="card-compact flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10">
            <DollarSign className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(stats.totalAR)}</p>
            <p className="text-sm text-muted-foreground">Total AR</p>
          </div>
        </div>
        <div className="card-compact flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-xl font-bold text-destructive">{formatCurrency(stats.overdue)}</p>
            <p className="text-sm text-muted-foreground">Overdue</p>
          </div>
        </div>
        <div className="card-compact flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
            <Percent className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-2xl font-bold text-warning">{stats.overduePercent.toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground">Overdue %</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>
        <div className="relative">
          <select
            value={agingFilter}
            onChange={(e) => setAgingFilter(e.target.value)}
            className="input pr-8 appearance-none cursor-pointer"
          >
            <option value="all">All Aging</option>
            <option value="current">Current</option>
            <option value="1-30">1-30 Days</option>
            <option value="31-60">31-60 Days</option>
            <option value="61-90">61-90 Days</option>
            <option value="90+">90+ Days</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input pr-8 appearance-none cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="overdue">Overdue Only</option>
            <option value="current">Current Only</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* AR Table */}
      <div className="card-flush overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Total AR
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-success uppercase">
                  Current
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-info uppercase">
                  1-30 Days
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-warning uppercase">
                  31-60 Days
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-orange-500 uppercase">
                  61-90 Days
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-destructive uppercase">
                  90+ Days
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <DollarSign className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No AR Data</h3>
                    <p className="text-muted-foreground">
                      No accounts receivable data found for your customers.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((customer) => {
                  const current =
                    customer.ar_total -
                    customer.bucket_1_30 -
                    customer.bucket_31_60 -
                    customer.bucket_61_90 -
                    customer.bucket_90_plus;

                  return (
                    <tr key={customer.customer_id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{customer.company_name}</p>
                            <p className="text-xs text-muted-foreground">{customer.customer_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-medium text-foreground">
                        {formatCurrency(customer.ar_total)}
                      </td>
                      <td className="px-4 py-4 text-success">
                        {formatCurrency(Math.max(0, current))}
                      </td>
                      <td className="px-4 py-4 text-info">
                        {formatCurrency(customer.bucket_1_30)}
                      </td>
                      <td className="px-4 py-4 text-warning">
                        {formatCurrency(customer.bucket_31_60)}
                      </td>
                      <td className="px-4 py-4 text-orange-500">
                        {formatCurrency(customer.bucket_61_90)}
                      </td>
                      <td className="px-4 py-4 text-destructive">
                        {formatCurrency(customer.bucket_90_plus)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredCustomers.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <div className="text-sm text-muted-foreground">
              Showing {(page - 1) * pageSize + 1} to{" "}
              {Math.min(page * pageSize, filteredCustomers.length)} of {filteredCustomers.length}{" "}
              results
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows per page:</span>
              <select className="input h-8 w-16 text-sm">
                <option>20</option>
                <option>50</option>
                <option>100</option>
              </select>
              <div className="flex items-center gap-1 ml-4">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="btn-ghost h-8 w-8 p-0 disabled:opacity-50"
                >
                  «
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-ghost h-8 w-8 p-0 disabled:opacity-50"
                >
                  ‹
                </button>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white text-sm font-medium">
                  {page}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-ghost h-8 w-8 p-0 disabled:opacity-50"
                >
                  ›
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="btn-ghost h-8 w-8 p-0 disabled:opacity-50"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

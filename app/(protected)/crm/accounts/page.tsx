"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  Search,
  Plus,
  MapPin,
  Users,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { pageLabels, actionLabels, emptyStateMessages } from "@/lib/terminology/labels";

interface Account {
  account_id: string;
  company_name: string;
  domain: string | null;
  industry: string | null;
  pic_name: string;
  pic_phone: string;
  pic_email: string;
  city: string | null;
  tenure_status?: string;
  activity_status?: string;
  lifetime_value?: number;
  total_invoices?: number;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [pagination, setPagination] = React.useState({ page: 1, pageSize: 50, total: 0 });

  const fetchAccounts = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        view: "enriched",
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/crm/accounts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.data || []);
        setPagination((prev) => ({ ...prev, total: data.pagination.total }));
      }
    } catch (err) {
      console.error("Error fetching accounts:", err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search]);

  React.useEffect(() => {
    const debounce = setTimeout(fetchAccounts, 300);
    return () => clearTimeout(debounce);
  }, [fetchAccounts]);

  const formatCurrency = (value: number | undefined) => {
    if (!value) return "-";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getTenureColor = (status: string | undefined) => {
    switch (status) {
      case "Active Customer": return "bg-success/10 text-success";
      case "New Customer": return "bg-primary/10 text-primary";
      case "Winback Target": return "bg-warning/10 text-warning";
      case "Prospect": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getActivityColor = (status: string | undefined) => {
    switch (status) {
      case "Active": return "bg-success/10 text-success";
      case "Passive": return "bg-warning/10 text-warning";
      case "Inactive": return "bg-destructive/10 text-destructive";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (loading && accounts.length === 0) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 skeleton" />
        <div className="h-12 max-w-sm skeleton rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 skeleton rounded-xl" />
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
          <h1 className="text-2xl font-bold text-foreground">{pageLabels.accounts.title}</h1>
          <p className="text-muted-foreground">{pageLabels.accounts.subtitle}</p>
        </div>
        <Link href="/crm/pipeline" className="btn-primary h-10">
          <Plus className="h-4 w-4 mr-2" />
          {actionLabels.add} Account
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search accounts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 rounded-xl bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((account) => (
          <Link
            key={account.account_id}
            href={`/crm/accounts/${account.account_id}`}
            className="card hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary font-semibold text-lg">
                {account.company_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">{account.company_name}</h3>
                {account.industry && (
                  <p className="text-sm text-muted-foreground">{account.industry}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", getTenureColor(account.tenure_status))}>
                    {account.tenure_status || "Unknown"}
                  </span>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", getActivityColor(account.activity_status))}>
                    {account.activity_status || "Unknown"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="truncate">{account.pic_name}</span>
              </div>
              {account.city && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{account.city}</span>
                </div>
              )}
              {account.lifetime_value !== undefined && account.lifetime_value > 0 && (
                <div className="flex items-center gap-2 text-sm text-success">
                  <DollarSign className="h-4 w-4" />
                  <span>{formatCurrency(account.lifetime_value)}</span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Empty State */}
      {accounts.length === 0 && !loading && (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No accounts found</p>
        </div>
      )}

      {/* Pagination */}
      {pagination.total > pagination.pageSize && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
            disabled={pagination.page === 1}
            className="btn-outline h-9 px-3"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {Math.ceil(pagination.total / pagination.pageSize)}
          </span>
          <button
            onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
            disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
            className="btn-outline h-9 px-3"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

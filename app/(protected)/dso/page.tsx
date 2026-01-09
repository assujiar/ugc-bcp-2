"use client";

import * as React from "react";
import Link from "next/link";
import { useUser } from "@/lib/contexts/user-context";
import { fetchDsoSummary, fetchArAging, fetchDsoRolling } from "@/lib/api";
import {
  DollarSign,
  Clock,
  AlertTriangle,
  TrendingDown,
  FileText,
  CreditCard,
  Users,
  Loader2,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ArAgingChart, AgingSummaryBars } from "@/components/charts/ar-aging-chart";

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `Rp ${(amount / 1_000_000_000).toFixed(2)}B`;
  }
  if (amount >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toFixed(1)}M`;
  }
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

interface DsoSummary {
  total_ar: number;
  total_overdue: number;
  overdue_count: number;
  total_invoices: number;
}

interface ArAgingData {
  customer_id: string;
  company_name: string;
  ar_total: number;
  bucket_1_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
}

interface ArAgingTotals {
  bucket_1_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
}

interface DsoRolling {
  as_of_date: string;
  ar_outstanding: number;
  revenue_30: number;
  dso_days_rolling_30: number;
}

export default function DsoPage() {
  const { user, isFinance, isDirector } = useUser();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  const [summary, setSummary] = React.useState<DsoSummary | null>(null);
  const [agingData, setAgingData] = React.useState<ArAgingData[]>([]);
  const [agingTotals, setAgingTotals] = React.useState<ArAgingTotals | null>(null);
  const [dsoRolling, setDsoRolling] = React.useState<DsoRolling | null>(null);

  React.useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        // Fetch all DSO data in parallel
        const [summaryResult, agingResult, rollingResult] = await Promise.all([
          fetchDsoSummary(),
          fetchArAging(),
          fetchDsoRolling(),
        ]);

        if (summaryResult.error) throw new Error(summaryResult.error);
        if (agingResult.error) throw new Error(agingResult.error);
        if (rollingResult.error) throw new Error(rollingResult.error);

        setSummary(summaryResult.data as DsoSummary);
        
        const agingResponse = agingResult.data as { data: ArAgingData[]; totals: ArAgingTotals };
        setAgingData(agingResponse.data || []);
        setAgingTotals(agingResponse.totals || null);
        
        const rollingResponse = rollingResult.data as { data: DsoRolling };
        setDsoRolling(rollingResponse.data || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load DSO data");
      }

      setLoading(false);
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading DSO data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-medium text-foreground mb-2">Failed to load DSO data</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  const overduePercentage = summary && summary.total_ar > 0
    ? ((summary.total_overdue / summary.total_ar) * 100).toFixed(1)
    : "0";

  return (
    <>
      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">DSO & AR Controlling</h1>
          <p className="text-muted-foreground">Monitor accounts receivable and days sales outstanding</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dso/invoices" className="btn-outline inline-flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Invoices
          </Link>
          <Link href="/dso/payments" className="btn-outline inline-flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payments
          </Link>
          {(isFinance || user?.role_name === "super admin") && (
            <Link href="/dso/invoices/new" className="btn-primary inline-flex items-center gap-2">
              + New Invoice
            </Link>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total AR</p>
              <p className="text-2xl font-bold text-foreground">
                {summary ? formatCurrency(summary.total_ar) : "-"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary?.total_invoices || 0} invoices
              </p>
            </div>
            <div className="p-3 rounded-[12px] bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Overdue</p>
              <p className="text-2xl font-bold text-destructive">
                {summary ? formatCurrency(summary.total_overdue) : "-"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {overduePercentage}% of AR
              </p>
            </div>
            <div className="p-3 rounded-[12px] bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">DSO (Rolling 30d)</p>
              <p className="text-2xl font-bold text-foreground">
                {dsoRolling?.dso_days_rolling_30 
                  ? `${Math.round(dsoRolling.dso_days_rolling_30)} days`
                  : "-"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Target: &lt;45 days
              </p>
            </div>
            <div className="p-3 rounded-[12px] bg-info/10">
              <Clock className="h-5 w-5 text-info" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Overdue Invoices</p>
              <p className="text-2xl font-bold text-warning">
                {summary?.overdue_count || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Requires attention
              </p>
            </div>
            <div className="p-3 rounded-[12px] bg-warning/10">
              <FileText className="h-5 w-5 text-warning" />
            </div>
          </div>
        </div>
      </div>

      {/* AR Aging Buckets */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">AR Aging Summary</h3>
          {agingTotals && (
            <AgingSummaryBars totals={agingTotals} className="w-64 hidden md:block" />
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-[12px] bg-success/10 border border-success/20">
            <p className="text-sm font-medium text-success mb-1">1-30 Days</p>
            <p className="text-xl font-bold text-foreground">
              {agingTotals ? formatCurrency(agingTotals.bucket_1_30) : "-"}
            </p>
          </div>
          <div className="p-4 rounded-[12px] bg-warning/10 border border-warning/20">
            <p className="text-sm font-medium text-warning mb-1">31-60 Days</p>
            <p className="text-xl font-bold text-foreground">
              {agingTotals ? formatCurrency(agingTotals.bucket_31_60) : "-"}
            </p>
          </div>
          <div className="p-4 rounded-[12px] bg-orange-500/10 border border-orange-500/20">
            <p className="text-sm font-medium text-orange-500 mb-1">61-90 Days</p>
            <p className="text-xl font-bold text-foreground">
              {agingTotals ? formatCurrency(agingTotals.bucket_61_90) : "-"}
            </p>
          </div>
          <div className="p-4 rounded-[12px] bg-destructive/10 border border-destructive/20">
            <p className="text-sm font-medium text-destructive mb-1">&gt;90 Days</p>
            <p className="text-xl font-bold text-foreground">
              {agingTotals ? formatCurrency(agingTotals.bucket_90_plus) : "-"}
            </p>
          </div>
        </div>
      </div>

      {/* AR Aging Chart by Customer */}
      {agingData.length > 0 && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Aging by Customer (Top 8)</h3>
            </div>
          </div>
          <ArAgingChart data={agingData} maxItems={8} />
        </div>
      )}

      {/* AR by Customer */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">AR by Customer</h3>
          <Link href="/dso/my-customers" className="text-sm text-primary hover:underline">
            View All →
          </Link>
        </div>
        
        {agingData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Customer</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Total AR</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">1-30d</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">31-60d</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">61-90d</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">&gt;90d</th>
                </tr>
              </thead>
              <tbody>
                {agingData.slice(0, 10).map((row) => (
                  <tr key={row.customer_id} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-muted text-muted-foreground text-sm font-medium">
                          {row.company_name.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-foreground">{row.company_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm font-medium text-foreground">{formatCurrency(row.ar_total)}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm text-muted-foreground">{formatCurrency(row.bucket_1_30)}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={cn("text-sm", row.bucket_31_60 > 0 ? "text-warning" : "text-muted-foreground")}>
                        {formatCurrency(row.bucket_31_60)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={cn("text-sm", row.bucket_61_90 > 0 ? "text-orange-500" : "text-muted-foreground")}>
                        {formatCurrency(row.bucket_61_90)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={cn("text-sm font-medium", row.bucket_90_plus > 0 ? "text-destructive" : "text-muted-foreground")}>
                        {formatCurrency(row.bucket_90_plus)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No AR data available</p>
          </div>
        )}
      </div>
    </>
  );
}
"use client";

import * as React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { createClient } from "@/lib/supabase/client";

interface RevenueData {
  month: string;
  revenue: number;
  target?: number;
}

interface InvoiceRow {
  invoice_amount: number;
}

interface RevenueChartProps {
  className?: string;
}

export function RevenueChart({ className }: RevenueChartProps) {
  const [data, setData] = React.useState<RevenueData[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchRevenueData() {
      const supabase = createClient();

      try {
        // Get last 12 months of revenue data
        const today = new Date();
        const months: RevenueData[] = [];

        for (let i = 11; i >= 0; i--) {
          const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const startOfMonth = date.toISOString().split("T")[0];
          const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)
            .toISOString()
            .split("T")[0];

          const monthName = date.toLocaleDateString("en-US", { month: "short" });

          const { data: invoices } = await supabase
            .from("invoices")
            .select("invoice_amount")
            .gte("invoice_date", startOfMonth)
            .lte("invoice_date", endOfMonth);

          const invoiceRows = (invoices || []) as InvoiceRow[];
          const revenue = invoiceRows.reduce(
            (sum, inv) => sum + (Number(inv.invoice_amount) || 0),
            0
          );

          months.push({
            month: monthName,
            revenue,
            target: revenue * 1.1, // Placeholder target (10% above actual)
          });
        }

        setData(months);
      } catch (error) {
        console.error("Error fetching revenue data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchRevenueData();
  }, []);

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(1)}B`;
    } else if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(0)}M`;
    } else if (value >= 1_000) {
      return `${(value / 1_000).toFixed(0)}K`;
    }
    return value.toString();
  };

  if (loading) {
    return (
      <div className={`h-64 flex items-center justify-center ${className}`}>
        <div className="animate-pulse text-muted-foreground">Loading chart...</div>
      </div>
    );
  }

  if (data.length === 0 || data.every((d) => d.revenue === 0)) {
    return (
      <div className={`h-64 flex items-center justify-center ${className}`}>
        <p className="text-muted-foreground">No revenue data available</p>
      </div>
    );
  }

  return (
    <div className={`h-64 ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.2} />
              <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickFormatter={formatCurrency}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
            formatter={(value, name) => [
              typeof value === "number" ? `Rp ${value.toLocaleString("id-ID")}` : "Rp 0",
              name === "revenue" ? "Revenue" : "Target",
            ]}
          />
          <Legend
            wrapperStyle={{ paddingTop: "10px" }}
            formatter={(value) => (
              <span style={{ color: "hsl(var(--muted-foreground))", fontSize: "12px" }}>
                {value === "revenue" ? "Revenue" : "Target"}
              </span>
            )}
          />
          <Area
            type="monotone"
            dataKey="target"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1}
            strokeDasharray="5 5"
            fillOpacity={1}
            fill="url(#colorTarget)"
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRevenue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

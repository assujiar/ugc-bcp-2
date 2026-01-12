"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";

interface AgingData {
  customer_id: string;
  company_name: string;
  ar_total: number;
  bucket_1_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
}

interface ArAgingChartProps {
  data: AgingData[];
  className?: string;
  maxItems?: number;
}

const COLORS = {
  bucket_1_30: "hsl(142, 76%, 36%)", // Success green
  bucket_31_60: "hsl(38, 92%, 50%)", // Warning yellow
  bucket_61_90: "hsl(21, 90%, 48%)", // Orange
  bucket_90_plus: "hsl(0, 72%, 51%)", // Destructive red
};

const LABELS = {
  bucket_1_30: "1-30 Days",
  bucket_31_60: "31-60 Days",
  bucket_61_90: "61-90 Days",
  bucket_90_plus: ">90 Days",
};

export function ArAgingChart({ data, className, maxItems = 8 }: ArAgingChartProps) {
  const chartData = React.useMemo(() => {
    // Sort by total AR descending and take top items
    return [...data]
      .sort((a, b) => b.ar_total - a.ar_total)
      .slice(0, maxItems)
      .map((item) => ({
        name: item.company_name.length > 15 
          ? item.company_name.substring(0, 15) + "..." 
          : item.company_name,
        fullName: item.company_name,
        bucket_1_30: item.bucket_1_30,
        bucket_31_60: item.bucket_31_60,
        bucket_61_90: item.bucket_61_90,
        bucket_90_plus: item.bucket_90_plus,
        total: item.ar_total,
      }));
  }, [data, maxItems]);

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

  if (data.length === 0) {
    return (
      <div className={`h-72 flex items-center justify-center ${className}`}>
        <p className="text-muted-foreground">No aging data available</p>
      </div>
    );
  }

  return (
    <div className={`h-72 ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 80, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            horizontal={true}
            vertical={false}
          />
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            tickFormatter={formatCurrency}
          />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
            width={80}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "12px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              padding: "12px",
            }}
            labelStyle={{ 
              color: "hsl(var(--foreground))", 
              fontWeight: 600,
              marginBottom: "8px",
            }}
            formatter={(value: number, name: string) => [
              `Rp ${value.toLocaleString("id-ID")}`,
              LABELS[name as keyof typeof LABELS] || name,
            ]}
            labelFormatter={(label, payload) => {
              if (payload && payload[0]) {
                return payload[0].payload.fullName;
              }
              return label;
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: "16px" }}
            formatter={(value) => (
              <span style={{ color: "hsl(var(--muted-foreground))", fontSize: "11px" }}>
                {LABELS[value as keyof typeof LABELS] || value}
              </span>
            )}
          />
          <Bar 
            dataKey="bucket_1_30" 
            stackId="aging" 
            fill={COLORS.bucket_1_30}
            radius={[0, 0, 0, 0]}
          />
          <Bar 
            dataKey="bucket_31_60" 
            stackId="aging" 
            fill={COLORS.bucket_31_60}
            radius={[0, 0, 0, 0]}
          />
          <Bar 
            dataKey="bucket_61_90" 
            stackId="aging" 
            fill={COLORS.bucket_61_90}
            radius={[0, 0, 0, 0]}
          />
          <Bar 
            dataKey="bucket_90_plus" 
            stackId="aging" 
            fill={COLORS.bucket_90_plus}
            radius={[4, 4, 4, 4]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Summary donut/pie alternative for totals
interface AgingTotals {
  bucket_1_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
}

interface AgingSummaryChartProps {
  totals: AgingTotals;
  className?: string;
}

export function AgingSummaryBars({ totals, className }: AgingSummaryChartProps) {
  const total = totals.bucket_1_30 + totals.bucket_31_60 + totals.bucket_61_90 + totals.bucket_90_plus;
  
  if (total === 0) {
    return (
      <div className={`${className}`}>
        <p className="text-muted-foreground text-sm text-center py-4">No AR data</p>
      </div>
    );
  }

  const buckets = [
    { key: "1-30d", value: totals.bucket_1_30, color: COLORS.bucket_1_30 },
    { key: "31-60d", value: totals.bucket_31_60, color: COLORS.bucket_31_60 },
    { key: "61-90d", value: totals.bucket_61_90, color: COLORS.bucket_61_90 },
    { key: ">90d", value: totals.bucket_90_plus, color: COLORS.bucket_90_plus },
  ];

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Stacked horizontal bar */}
      <div className="h-6 rounded-full overflow-hidden flex">
        {buckets.map((bucket) => {
          const pct = (bucket.value / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={bucket.key}
              className="h-full transition-all"
              style={{ 
                width: `${pct}%`, 
                backgroundColor: bucket.color,
                minWidth: pct > 0 ? "2px" : 0,
              }}
              title={`${bucket.key}: ${pct.toFixed(1)}%`}
            />
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center">
        {buckets.map((bucket) => {
          const pct = (bucket.value / total) * 100;
          return (
            <div key={bucket.key} className="flex items-center gap-1.5 text-xs">
              <div 
                className="w-2.5 h-2.5 rounded-full" 
                style={{ backgroundColor: bucket.color }}
              />
              <span className="text-muted-foreground">{bucket.key}</span>
              <span className="font-medium text-foreground">{pct.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
"use client";

import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";
import { cn } from "@/lib/utils";

interface DataPoint {
  date: string;
  actual: number;
  target?: number;
  label?: string;
}

interface KpiTrendChartProps {
  data: DataPoint[];
  title: string;
  unit?: string;
  type?: "line" | "area" | "bar";
  showTarget?: boolean;
  color?: string;
  height?: number;
}

const COLORS = {
  primary: "#FF4600",
  secondary: "#082567",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#DC2F02",
};

export function KpiTrendChart({
  data,
  title,
  unit = "",
  type = "line",
  showTarget = true,
  color = COLORS.primary,
  height = 300,
}: KpiTrendChartProps) {
  const formatValue = (value: number) => {
    if (unit === "IDR") {
      if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
      return value.toLocaleString();
    }
    if (unit === "%") return `${value.toFixed(1)}%`;
    if (unit === "days") return `${value}d`;
    return value.toLocaleString();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-[10px] shadow-lg p-3">
          <p className="text-sm font-medium text-foreground mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatValue(entry.value)} {unit}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    switch (type) {
      case "area":
        return (
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={formatValue}
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${title})`}
            />
            {showTarget && (
              <Line
                type="monotone"
                dataKey="target"
                name="Target"
                stroke={COLORS.secondary}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            )}
          </AreaChart>
        );

      case "bar":
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={formatValue}
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar
              dataKey="actual"
              name="Actual"
              fill={color}
              radius={[4, 4, 0, 0]}
            />
            {showTarget && (
              <Bar
                dataKey="target"
                name="Target"
                fill={COLORS.secondary}
                radius={[4, 4, 0, 0]}
                opacity={0.5}
              />
            )}
          </BarChart>
        );

      default:
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={formatValue}
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
            {showTarget && (
              <Line
                type="monotone"
                dataKey="target"
                name="Target"
                stroke={COLORS.secondary}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            )}
          </LineChart>
        );
    }
  };

  return (
    <div className="card">
      <h3 className="font-semibold text-foreground mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}

// Multi-series chart
interface MultiSeriesData {
  date: string;
  [key: string]: string | number;
}

interface KpiMultiSeriesChartProps {
  data: MultiSeriesData[];
  title: string;
  series: { key: string; name: string; color: string }[];
  unit?: string;
  height?: number;
}

export function KpiMultiSeriesChart({
  data,
  title,
  series,
  unit = "",
  height = 300,
}: KpiMultiSeriesChartProps) {
  const formatValue = (value: number) => {
    if (unit === "IDR") {
      if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
      return value.toLocaleString();
    }
    return value.toLocaleString();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-[10px] shadow-lg p-3">
          <p className="text-sm font-medium text-foreground mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatValue(entry.value)} {unit}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card">
      <h3 className="font-semibold text-foreground mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={formatValue}
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={{ fill: s.color, strokeWidth: 2, r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

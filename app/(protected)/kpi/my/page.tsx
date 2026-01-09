"use client";

import * as React from "react";
import Link from "next/link";
import { useUser } from "@/lib/contexts/user-context";
import { fetchKpiTargets } from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Target,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Upload,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiTarget {
  id: number;
  metric_key: string;
  period_start: string;
  period_end: string;
  target_value: number;
  assignee_user_id: string | null;
  created_at: string;
}

// Sample achievement data (would come from API)
const SAMPLE_ACHIEVEMENTS: Record<string, number> = {
  SALES_REVENUE: 2500000000,
  SALES_NEW_LOGOS: 12,
  SALES_ACTIVITY_VISIT: 45,
  SALES_ACTIVITY_CALL: 180,
  MKT_LEADS_BY_CHANNEL: 85,
  DGO_SOCIAL_POSTS: 25,
  VSDO_DIGITAL_ASSETS_DELIVERED: 18,
};

function getProgressColor(percentage: number): string {
  if (percentage >= 100) return "bg-success";
  if (percentage >= 75) return "bg-success/70";
  if (percentage >= 50) return "bg-warning";
  if (percentage >= 25) return "bg-warning/70";
  return "bg-destructive";
}

function getStatusLabel(percentage: number): { label: string; color: string } {
  if (percentage >= 100) return { label: "Achieved", color: "text-success" };
  if (percentage >= 75) return { label: "On Track", color: "text-success" };
  if (percentage >= 50) return { label: "At Risk", color: "text-warning" };
  return { label: "Behind", color: "text-destructive" };
}

export default function MyKpiPage() {
  const { user } = useUser();
  
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [targets, setTargets] = React.useState<KpiTarget[]>([]);

  React.useEffect(() => {
    async function loadTargets() {
      setLoading(true);
      const result = await fetchKpiTargets({
        assignee_user_id: user?.user_id || undefined,
      });
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setTargets((result.data as { data: KpiTarget[] }).data || []);
      }
      setLoading(false);
    }
    loadTargets();
  }, [user?.user_id]);

  // Calculate summary stats
  const summaryStats = React.useMemo(() => {
    let achieved = 0;
    let onTrack = 0;
    let atRisk = 0;
    let behind = 0;

    targets.forEach((target) => {
      const achievement = SAMPLE_ACHIEVEMENTS[target.metric_key] || 0;
      const percentage = target.target_value > 0 
        ? (achievement / target.target_value) * 100 
        : 0;

      if (percentage >= 100) achieved++;
      else if (percentage >= 75) onTrack++;
      else if (percentage >= 50) atRisk++;
      else behind++;
    });

    return { achieved, onTrack, atRisk, behind, total: targets.length };
  }, [targets]);

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <Link
          href="/kpi"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to KPI
        </Link>
        <h1 className="text-2xl font-bold text-foreground">My KPI</h1>
        <p className="text-muted-foreground">Track your personal KPI progress</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{summaryStats.total}</p>
              <p className="text-xs text-muted-foreground">Total KPIs</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-success/10">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{summaryStats.achieved}</p>
              <p className="text-xs text-muted-foreground">Achieved</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-success/10">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{summaryStats.onTrack}</p>
              <p className="text-xs text-muted-foreground">On Track</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-warning/10">
              <AlertCircle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{summaryStats.atRisk}</p>
              <p className="text-xs text-muted-foreground">At Risk</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-destructive/10">
              <TrendingDown className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{summaryStats.behind}</p>
              <p className="text-xs text-muted-foreground">Behind</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-[14px] bg-destructive/10 border border-destructive/20 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* KPI List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading KPIs...</span>
        </div>
      ) : targets.length > 0 ? (
        <div className="space-y-4">
          {targets.map((target) => {
            const achievement = SAMPLE_ACHIEVEMENTS[target.metric_key] || 0;
            const percentage = target.target_value > 0 
              ? Math.round((achievement / target.target_value) * 100) 
              : 0;
            const status = getStatusLabel(percentage);

            return (
              <div key={target.id} className="card">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Target className="h-5 w-5 text-muted-foreground" />
                      <h3 className="font-semibold text-foreground">{target.metric_key}</h3>
                      <span className={cn("text-sm font-medium", status.color)}>
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(target.period_start).toLocaleDateString("id-ID")} -{" "}
                        {new Date(target.period_end).toLocaleDateString("id-ID")}
                      </span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium text-foreground">
                          {achievement.toLocaleString()} / {target.target_value.toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", getProgressColor(percentage))}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                      <div className="text-right mt-1">
                        <span className={cn("text-sm font-medium", status.color)}>
                          {percentage}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="btn-outline text-sm">
                      <Upload className="h-4 w-4 mr-1" />
                      Evidence
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card text-center py-12">
          <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-medium text-foreground mb-1">No KPI Targets Assigned</p>
          <p className="text-sm text-muted-foreground">
            Contact your manager to set KPI targets for you
          </p>
        </div>
      )}
    </>
  );
}

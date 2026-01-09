"use client";

import * as React from "react";
import { useUser } from "@/lib/contexts/user-context";
import { fetchKpiTargets, createKpiTarget } from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Target,
  Plus,
  Users,
  Calendar,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// KPI Metrics for assignment
const KPI_METRICS = {
  sales: [
    { key: "SALES_REVENUE", name: "Revenue", unit: "IDR" },
    { key: "SALES_NEW_LOGOS", name: "New Logos", unit: "count" },
    { key: "SALES_ACTIVE_CUSTOMERS", name: "Active Customers", unit: "count" },
    { key: "SALES_ACTIVITY_VISIT", name: "Visits", unit: "count" },
    { key: "SALES_ACTIVITY_CALL", name: "Calls", unit: "count" },
    { key: "SALES_ACTIVITY_EMAIL", name: "Emails", unit: "count" },
  ],
  marketing: [
    { key: "MKT_LEADS_BY_CHANNEL", name: "Leads Generated", unit: "count" },
    { key: "MARCOMM_SEM_SPEND", name: "SEM Spend Budget", unit: "IDR" },
    { key: "DGO_PAID_SOCIAL_SPEND", name: "Social Spend Budget", unit: "IDR" },
    { key: "DGO_SOCIAL_POSTS", name: "Social Posts", unit: "count" },
    { key: "VSDO_DIGITAL_ASSETS_DELIVERED", name: "Digital Assets", unit: "count" },
    { key: "MACX_SURVEYS_LAUNCHED", name: "Surveys Launched", unit: "count" },
  ],
};

interface KpiTarget {
  id: number;
  metric_key: string;
  period_start: string;
  period_end: string;
  target_value: number;
  assignee_user_id: string | null;
  created_at: string;
}

export default function KpiTargetsPage() {
  const { user } = useUser();

  const [loading, setLoading] = React.useState(true);
  const [targets, setTargets] = React.useState<KpiTarget[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = React.useState(false);
  const [formLoading, setFormLoading] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formSuccess, setFormSuccess] = React.useState(false);

  const [formData, setFormData] = React.useState({
    metric_key: "",
    period_start: new Date().toISOString().split("T")[0],
    period_end: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split("T")[0],
    target_value: "",
    assignee_user_id: "", // Empty = org-level
  });

  const isManager = ["sales manager", "Marketing Manager", "super admin"].includes(user?.role_name || "");

  // Load targets
  React.useEffect(() => {
    async function loadTargets() {
      setLoading(true);
      const result = await fetchKpiTargets();
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setTargets((result.data as { data: KpiTarget[] }).data || []);
      }
      setLoading(false);
    }
    loadTargets();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    if (!formData.metric_key || !formData.target_value) {
      setFormError("Please fill in all required fields");
      setFormLoading(false);
      return;
    }

    const result = await createKpiTarget({
      metric_key: formData.metric_key,
      period_start: formData.period_start,
      period_end: formData.period_end,
      target_value: parseFloat(formData.target_value),
      assignee_user_id: formData.assignee_user_id || undefined,
    });

    if (result.error) {
      setFormError(result.error);
    } else {
      setFormSuccess(true);
      // Reload targets
      const reloadResult = await fetchKpiTargets();
      if (reloadResult.data) {
        setTargets((reloadResult.data as { data: KpiTarget[] }).data || []);
      }
      // Reset form
      setTimeout(() => {
        setShowForm(false);
        setFormSuccess(false);
        setFormData({
          metric_key: "",
          period_start: new Date().toISOString().split("T")[0],
          period_end: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split("T")[0],
          target_value: "",
          assignee_user_id: "",
        });
      }, 1500);
    }
    setFormLoading(false);
  };

  // Determine which metrics to show based on role
  const availableMetrics =
    user?.role_name === "sales manager"
      ? KPI_METRICS.sales
      : user?.role_name === "Marketing Manager"
      ? KPI_METRICS.marketing
      : [...KPI_METRICS.sales, ...KPI_METRICS.marketing];

  return (
    <>
      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/kpi"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to KPI
          </Link>
          <h1 className="text-2xl font-bold text-foreground">KPI Targets</h1>
          <p className="text-muted-foreground">Manage and assign KPI targets</p>
        </div>
        {isManager && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Set New Target
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-[14px] bg-destructive/10 border border-destructive/20 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Target Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-[16px] p-6 w-full max-w-lg mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Set KPI Target
            </h3>

            {formError && (
              <div className="mb-4 p-3 rounded-[10px] bg-destructive/10 border border-destructive/20 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <p className="text-sm text-destructive">{formError}</p>
              </div>
            )}

            {formSuccess ? (
              <div className="py-8 text-center">
                <CheckCircle className="h-12 w-12 text-success mx-auto mb-3" />
                <p className="text-lg font-medium text-foreground">Target Set Successfully!</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Metric <span className="text-destructive">*</span>
                  </label>
                  <select
                    name="metric_key"
                    value={formData.metric_key}
                    onChange={handleChange}
                    className="input w-full"
                    required
                  >
                    <option value="">Select Metric</option>
                    {availableMetrics.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.name} ({m.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Period Start <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="date"
                      name="period_start"
                      value={formData.period_start}
                      onChange={handleChange}
                      className="input w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Period End <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="date"
                      name="period_end"
                      value={formData.period_end}
                      onChange={handleChange}
                      className="input w-full"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Target Value <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    name="target_value"
                    value={formData.target_value}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="100"
                    min="0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Assignee (leave empty for org-level)
                  </label>
                  <input
                    type="text"
                    name="assignee_user_id"
                    value={formData.assignee_user_id}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="User ID (UUID)"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty for team/organization target
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="btn-outline"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={formLoading}>
                    {formLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      "Set Target"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Targets List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading targets...</span>
        </div>
      ) : targets.length > 0 ? (
        <div className="space-y-4">
          {targets.map((target) => (
            <div key={target.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-[12px] bg-primary/10">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{target.metric_key}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(target.period_start).toLocaleDateString()} -{" "}
                    {new Date(target.period_end).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-foreground">
                  {target.target_value.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {target.assignee_user_id ? "Individual" : "Organization"}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-medium text-foreground mb-1">No Targets Set</p>
          <p className="text-sm text-muted-foreground mb-4">
            Start by setting KPI targets for your team
          </p>
          {isManager && (
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Set First Target
            </button>
          )}
        </div>
      )}
    </>
  );
}

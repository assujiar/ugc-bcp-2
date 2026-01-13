"use client";

import * as React from "react";
import { useUser } from "@/lib/contexts/user-context";
import { createMarketingActivity, createMarketingSpend } from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Activity,
  DollarSign,
  Calendar,
  FileText,
  Plus,
} from "lucide-react";
import Link from "next/link";

const PRIMARY_CHANNELS = [
  "LinkedIn",
  "SEM",
  "Paid Social",
  "Website (Direct/Referral)",
  "Webinar & Live",
  "Event Offline",
  "Trade Show",
  "Partnership/Referral",
  "Other",
];

const ACTIVITY_TYPES = [
  { value: "social_post", label: "Social Media Post", role: "DGO" },
  { value: "short_form_video", label: "Short Form Video", role: "DGO" },
  { value: "long_form_video", label: "Long Form Video", role: "DGO" },
  { value: "live_session", label: "Live Session", role: "DGO" },
  { value: "community_reply", label: "Community Reply", role: "DGO" },
  { value: "linkedin_post", label: "LinkedIn Post", role: "Marcomm" },
  { value: "website_update", label: "Website Update", role: "Marcomm" },
  { value: "seo_content", label: "SEO Content", role: "Marcomm" },
  { value: "sem_campaign", label: "SEM Campaign Launch", role: "Marcomm" },
  { value: "pr_event", label: "PR/Event Executed", role: "Marcomm" },
  { value: "partner_meeting", label: "Partner Meeting", role: "Marcomm" },
  { value: "collateral_release", label: "Collateral Release", role: "Marcomm" },
  { value: "digital_asset", label: "Digital Asset Delivered", role: "VSDO" },
  { value: "motion_video", label: "Motion/Video Delivered", role: "VSDO" },
  { value: "print_asset", label: "Print Asset", role: "VSDO" },
  { value: "event_branding", label: "Event Branding Pack", role: "VSDO" },
  { value: "photoshoot", label: "Photoshoot Support", role: "VSDO" },
  { value: "dashboard_release", label: "Dashboard Released", role: "MACX" },
  { value: "tracking_change", label: "Tracking Change Deployed", role: "MACX" },
  { value: "survey_launch", label: "Survey Launched", role: "MACX" },
  { value: "customer_interview", label: "Customer Interview", role: "MACX" },
  { value: "journey_audit", label: "Journey Audit", role: "MACX" },
  { value: "intel_report", label: "Intelligence Report", role: "MACX" },
];

export default function KpiInputPage() {
  const { user, isMarketing } = useUser();

  const [activeTab, setActiveTab] = React.useState<"activity" | "spend">("activity");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  // Activity form
  const [activityForm, setActivityForm] = React.useState({
    activity_name: "",
    channel: "LinkedIn",
    activity_date: new Date().toISOString().split("T")[0],
    quantity: "1",
    notes: "",
  });

  // Spend form
  const [spendForm, setSpendForm] = React.useState({
    channel: "SEM",
    spend_date: new Date().toISOString().split("T")[0],
    amount: "",
    campaign_name: "",
    notes: "",
  });

  const handleActivityChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setActivityForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSpendChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setSpendForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!activityForm.activity_name) {
      setError("Please select an activity type");
      setLoading(false);
      return;
    }

    const result = await createMarketingActivity({
      activity_name: activityForm.activity_name,
      channel: activityForm.channel,
      activity_date: activityForm.activity_date,
      quantity: parseInt(activityForm.quantity, 10) || 1,
      notes: activityForm.notes || undefined,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess("Activity logged successfully!");
      setActivityForm({
        activity_name: "",
        channel: "LinkedIn",
        activity_date: new Date().toISOString().split("T")[0],
        quantity: "1",
        notes: "",
      });
    }
    setLoading(false);
  };

  const handleSpendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!spendForm.amount || parseFloat(spendForm.amount) <= 0) {
      setError("Please enter a valid amount");
      setLoading(false);
      return;
    }

    const result = await createMarketingSpend({
      channel: spendForm.channel,
      spend_date: spendForm.spend_date,
      amount: parseFloat(spendForm.amount),
      campaign_name: spendForm.campaign_name || undefined,
      notes: spendForm.notes || undefined,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess("Spend recorded successfully!");
      setSpendForm({
        channel: "SEM",
        spend_date: new Date().toISOString().split("T")[0],
        amount: "",
        campaign_name: "",
        notes: "",
      });
    }
    setLoading(false);
  };

  if (!isMarketing && user?.role_name !== "super admin") {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-warning mb-4" />
        <p className="text-lg font-medium text-foreground mb-2">Access Denied</p>
        <p className="text-sm text-muted-foreground">Only marketing users can enter performance data</p>
        <Link href="/kpi" className="btn-primary mt-4">
          Back to Performance
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <Link
          href="/kpi"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Performance
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Performance Updates</h1>
        <p className="text-muted-foreground">Log marketing activities and spend manually</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 rounded-[14px] bg-destructive/10 border border-destructive/20 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 rounded-[14px] bg-success/10 border border-success/20 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
          <p className="text-sm text-success">{success}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("activity")}
          className={`px-4 py-2 rounded-[10px] text-sm font-medium transition-colors ${
            activeTab === "activity"
              ? "bg-primary text-white"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <Activity className="h-4 w-4 inline-block mr-2" />
          Log Activity
        </button>
        <button
          onClick={() => setActiveTab("spend")}
          className={`px-4 py-2 rounded-[10px] text-sm font-medium transition-colors ${
            activeTab === "spend"
              ? "bg-primary text-white"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <DollarSign className="h-4 w-4 inline-block mr-2" />
          Record Spend
        </button>
      </div>

      {/* Activity Form */}
      {activeTab === "activity" && (
        <form onSubmit={handleActivitySubmit} className="space-y-6 max-w-2xl">
          <div className="card">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              Activity Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">
                  Activity Type <span className="text-destructive">*</span>
                </label>
                <select
                  name="activity_name"
                  value={activityForm.activity_name}
                  onChange={handleActivityChange}
                  className="input w-full"
                  required
                >
                  <option value="">Select Activity Type</option>
                  {ACTIVITY_TYPES.map((a) => (
                    <option key={a.value} value={a.value}>
                      [{a.role}] {a.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Channel</label>
                <select
                  name="channel"
                  value={activityForm.channel}
                  onChange={handleActivityChange}
                  className="input w-full"
                >
                  {PRIMARY_CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  name="activity_date"
                  value={activityForm.activity_date}
                  onChange={handleActivityChange}
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Quantity <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={activityForm.quantity}
                  onChange={handleActivityChange}
                  className="input w-full"
                  min="1"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                <textarea
                  name="notes"
                  value={activityForm.notes}
                  onChange={handleActivityChange}
                  className="input w-full"
                  rows={3}
                  placeholder="Additional notes..."
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Log Activity
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Spend Form */}
      {activeTab === "spend" && (
        <form onSubmit={handleSpendSubmit} className="space-y-6 max-w-2xl">
          <div className="card">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              Spend Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Channel <span className="text-destructive">*</span>
                </label>
                <select
                  name="channel"
                  value={spendForm.channel}
                  onChange={handleSpendChange}
                  className="input w-full"
                  required
                >
                  {PRIMARY_CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  name="spend_date"
                  value={spendForm.spend_date}
                  onChange={handleSpendChange}
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Amount (IDR) <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  name="amount"
                  value={spendForm.amount}
                  onChange={handleSpendChange}
                  className="input w-full"
                  placeholder="1000000"
                  min="0"
                  step="1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Campaign Name
                </label>
                <input
                  type="text"
                  name="campaign_name"
                  value={spendForm.campaign_name}
                  onChange={handleSpendChange}
                  className="input w-full"
                  placeholder="Q1 2025 LinkedIn Ads"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                <textarea
                  name="notes"
                  value={spendForm.notes}
                  onChange={handleSpendChange}
                  className="input w-full"
                  rows={3}
                  placeholder="Additional notes..."
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Record Spend
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

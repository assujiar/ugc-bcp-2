"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/lib/contexts/user-context";
import { logSalesActivity, fetchProspects, Prospect, PaginatedResponse } from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Activity,
  MapPin,
  Camera,
  Phone,
  Mail,
  Video,
  MessageSquare,
  Search,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const ACTIVITY_TYPES = [
  { value: "Visit", label: "Visit", icon: MapPin, requiresEvidence: true },
  { value: "Call", label: "Call", icon: Phone, requiresEvidence: false },
  { value: "Online Meeting", label: "Online Meeting", icon: Video, requiresEvidence: false },
  { value: "Email", label: "Email", icon: Mail, requiresEvidence: false },
  { value: "WhatsApp/Chat Outbound", label: "WhatsApp/Chat", icon: MessageSquare, requiresEvidence: false },
];

export default function LogActivityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isSales } = useUser();

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  // Prospect selection
  const [prospects, setProspects] = React.useState<Prospect[]>([]);
  const [prospectSearch, setProspectSearch] = React.useState("");
  const [loadingProspects, setLoadingProspects] = React.useState(false);

  // Form state
  const [formData, setFormData] = React.useState({
    prospect_id: searchParams.get("prospect_id") || "",
    prospect_name: "",
    activity_type: "Call",
    notes: "",
    evidence_photo_url: "",
    gps_lat: "",
    gps_lng: "",
  });

  // GPS state
  const [gettingLocation, setGettingLocation] = React.useState(false);
  const [locationError, setLocationError] = React.useState<string | null>(null);

  const canLog = isSales || user?.role_name === "super admin";

  // Search prospects
  React.useEffect(() => {
    async function searchProspects() {
      if (prospectSearch.length < 2) {
        setProspects([]);
        return;
      }

      setLoadingProspects(true);
      const result = await fetchProspects({ search: prospectSearch, pageSize: 10 });
      if (result.data) {
        const response = result.data as PaginatedResponse<Prospect>;
        setProspects(response.data || []);
      }
      setLoadingProspects(false);
    }

    const debounce = setTimeout(searchProspects, 300);
    return () => clearTimeout(debounce);
  }, [prospectSearch]);

  const handleSelectProspect = (prospect: Prospect) => {
    setFormData((prev) => ({
      ...prev,
      prospect_id: prospect.prospect_id,
      prospect_name: prospect.customer?.company_name || prospect.prospect_id,
    }));
    setProspects([]);
    setProspectSearch("");
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    setGettingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          gps_lat: position.coords.latitude.toString(),
          gps_lng: position.coords.longitude.toString(),
        }));
        setGettingLocation(false);
      },
      (error) => {
        setLocationError("Unable to get your location. Please enable location services.");
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.prospect_id) {
      setError("Please select a prospect");
      setLoading(false);
      return;
    }

    if (!formData.notes) {
      setError("Please enter activity notes");
      setLoading(false);
      return;
    }

    // Validate Visit requirements
    if (formData.activity_type === "Visit") {
      if (!formData.evidence_photo_url) {
        setError("Visit activity requires photo evidence");
        setLoading(false);
        return;
      }
      if (!formData.gps_lat || !formData.gps_lng) {
        setError("Visit activity requires GPS location");
        setLoading(false);
        return;
      }
    }

    const result = await logSalesActivity({
      prospect_id: formData.prospect_id,
      activity_type: formData.activity_type as "Visit" | "Call" | "Online Meeting" | "Email" | "WhatsApp/Chat Outbound",
      notes: formData.notes,
      evidence_photo_url: formData.evidence_photo_url || undefined,
      gps_lat: formData.gps_lat ? parseFloat(formData.gps_lat) : undefined,
      gps_lng: formData.gps_lng ? parseFloat(formData.gps_lng) : undefined,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => {
        router.push("/crm/targets");
      }, 1500);
    }
  };

  const selectedType = ACTIVITY_TYPES.find((t) => t.value === formData.activity_type);
  const requiresEvidence = selectedType?.requiresEvidence || false;

  if (!canLog) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-warning mb-4" />
        <p className="text-lg font-medium text-foreground mb-2">Access Denied</p>
        <p className="text-sm text-muted-foreground">Only sales users can log activities</p>
        <Link href="/crm/targets" className="btn-primary mt-4">
          Back to Targets
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <CheckCircle className="h-16 w-16 text-success mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Activity Logged Successfully!</h2>
        <p className="text-muted-foreground">Redirecting to targets...</p>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <Link
          href="/crm/targets"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Targets
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Log Sales Activity</h1>
        <p className="text-muted-foreground">Record your sales activities with targets</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 rounded-[14px] bg-destructive/10 border border-destructive/20 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {/* Prospect Selection */}
        <div className="card">
          <h3 className="font-semibold text-foreground mb-4">Select Prospect</h3>

          {formData.prospect_id ? (
            <div className="flex items-center justify-between p-4 rounded-[12px] bg-muted">
              <div>
                <p className="font-medium text-foreground">{formData.prospect_name}</p>
                <p className="text-sm text-muted-foreground">{formData.prospect_id}</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, prospect_id: "", prospect_name: "" }))}
                className="text-sm text-primary hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={prospectSearch}
                  onChange={(e) => setProspectSearch(e.target.value)}
                  className="input w-full pl-10"
                  placeholder="Search prospect by company name..."
                />
                {loadingProspects && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {prospects.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-[12px] shadow-lg max-h-60 overflow-auto">
                  {prospects.map((prospect) => (
                    <button
                      key={prospect.prospect_id}
                      type="button"
                      onClick={() => handleSelectProspect(prospect)}
                      className="w-full px-4 py-3 text-left hover:bg-muted transition-colors first:rounded-t-[12px] last:rounded-b-[12px]"
                    >
                      <p className="font-medium text-foreground">
                        {prospect.customer?.company_name || "Unknown"}
                      </p>
                      <p className="text-sm text-muted-foreground">{prospect.prospect_id}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Activity Type Selection */}
        <div className="card">
          <h3 className="font-semibold text-foreground mb-4">Activity Type</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {ACTIVITY_TYPES.map((type) => {
              const Icon = type.icon;
              const isSelected = formData.activity_type === type.value;
              return (
                <label
                  key={type.value}
                  className={cn(
                    "flex flex-col items-center p-4 rounded-[12px] border-2 cursor-pointer transition-all",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <input
                    type="radio"
                    name="activity_type"
                    value={type.value}
                    checked={isSelected}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <Icon
                    className={cn(
                      "h-6 w-6 mb-2",
                      isSelected ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm font-medium text-center",
                      isSelected ? "text-primary" : "text-foreground"
                    )}
                  >
                    {type.label}
                  </span>
                  {type.requiresEvidence && (
                    <span className="text-xs text-muted-foreground mt-1">📸 Required</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <h3 className="font-semibold text-foreground mb-4">Activity Details</h3>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Notes <span className="text-destructive">*</span>
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="input w-full"
              rows={4}
              placeholder="Describe what was discussed or accomplished..."
              required
            />
          </div>
        </div>

        {/* Evidence (for Visit) */}
        {requiresEvidence && (
          <div className="card">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Camera className="h-5 w-5 text-muted-foreground" />
              Evidence (Required for Visit)
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Photo URL <span className="text-destructive">*</span>
                </label>
                <input
                  type="url"
                  name="evidence_photo_url"
                  value={formData.evidence_photo_url}
                  onChange={handleChange}
                  className="input w-full"
                  placeholder="https://storage.example.com/photo.jpg"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Upload photo to storage first, then paste the URL here
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  GPS Location <span className="text-destructive">*</span>
                </label>

                {formData.gps_lat && formData.gps_lng ? (
                  <div className="flex items-center gap-4 p-3 rounded-[10px] bg-success/10 border border-success/20">
                    <MapPin className="h-5 w-5 text-success" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Location Captured</p>
                      <p className="text-xs text-muted-foreground">
                        {formData.gps_lat}, {formData.gps_lng}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleGetLocation}
                      className="text-sm text-primary hover:underline ml-auto"
                    >
                      Refresh
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={gettingLocation}
                    className="btn-outline w-full"
                  >
                    {gettingLocation ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Getting Location...
                      </>
                    ) : (
                      <>
                        <MapPin className="h-4 w-4 mr-2" />
                        Get Current Location
                      </>
                    )}
                  </button>
                )}

                {locationError && (
                  <p className="text-sm text-destructive mt-2">{locationError}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/crm/targets" className="btn-outline">
            Cancel
          </Link>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Activity className="h-4 w-4 mr-2" />
                Log Activity
              </>
            )}
          </button>
        </div>
      </form>
    </>
  );
}

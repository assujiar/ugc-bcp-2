"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Calendar,
  Tag,
  Route,
  Package,
  Clock,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { fetchJson, isSuccess } from "@/lib/api/fetchJson";
import { toastError, toastSuccess } from "@/lib/hooks/use-toast";

// Enums matching database exactly
const PRIMARY_CHANNELS = [
  { value: "LinkedIn", label: "LinkedIn" },
  { value: "SEM", label: "SEM (Search Engine Marketing)" },
  { value: "Paid Social", label: "Paid Social" },
  { value: "Website (Direct/Referral)", label: "Website (Direct/Referral)" },
  { value: "Webinar & Live", label: "Webinar & Live" },
  { value: "Event Offline", label: "Event Offline" },
  { value: "Trade Show", label: "Trade Show" },
  { value: "Partnership/Referral", label: "Partnership/Referral" },
  { value: "Sales Outbound", label: "Sales Outbound" },
  { value: "Sales Referral", label: "Sales Referral" },
  { value: "Other", label: "Other" },
] as const;

const NEXT_STEPS = [
  { value: "Call", label: "Call" },
  { value: "Email", label: "Email" },
  { value: "Visit", label: "Visit" },
  { value: "Online Meeting", label: "Online Meeting" },
  { value: "Send Proposal", label: "Send Proposal" },
  { value: "Follow Up", label: "Follow Up" },
] as const;

const SOURCED_BY = [
  { value: "Marketing", label: "Marketing" },
  { value: "Sales", label: "Sales" },
] as const;

const TIMELINES = [
  { value: "Immediate", label: "Immediate" },
  { value: "1 Week", label: "1 Week" },
  { value: "2 Weeks", label: "2 Weeks" },
  { value: "1 Month", label: "1 Month" },
  { value: "3 Months", label: "3 Months" },
  { value: "6 Months", label: "6 Months" },
  { value: "Exploring", label: "Just Exploring" },
] as const;

const VOLUME_UNITS = [
  { value: "kg", label: "kg" },
  { value: "cbm", label: "CBM" },
  { value: "TEU", label: "TEU" },
  { value: "shipment", label: "Shipment" },
  { value: "pcs", label: "Pcs" },
  { value: "container", label: "Container" },
] as const;

interface ServiceCatalog {
  service_code: string;
  service_name: string;
  scope_group: string;
}

interface FormData {
  // Required
  company_name: string;
  pic_name: string;
  contact_phone: string;
  email: string;
  city_area: string;
  service_code: string;
  sourced_by: "Marketing" | "Sales";
  primary_channel: string;
  next_step: string;
  due_date: string;
  // Optional
  lead_date: string;
  route: string;
  est_volume_value: string;
  est_volume_unit: string;
  timeline: string;
  campaign_name: string;
  notes: string;
}

interface FormErrors {
  [key: string]: string;
}

export default function NewLeadPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [services, setServices] = React.useState<ServiceCatalog[]>([]);
  const [loadingServices, setLoadingServices] = React.useState(true);
  const [errors, setErrors] = React.useState<FormErrors>({});

  // Default due date: 7 days from now
  const defaultDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // Default lead date: today
  const today = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = React.useState<FormData>({
    // Required fields
    company_name: "",
    pic_name: "",
    contact_phone: "",
    email: "",
    city_area: "",
    service_code: "",
    sourced_by: "Marketing",
    primary_channel: "Website (Direct/Referral)",
    next_step: "Call",
    due_date: defaultDueDate,
    // Optional fields
    lead_date: today,
    route: "",
    est_volume_value: "",
    est_volume_unit: "",
    timeline: "",
    campaign_name: "",
    notes: "",
  });

  // Fetch services on mount
  React.useEffect(() => {
    async function fetchServices() {
      setLoadingServices(true);
      const result = await fetchJson<{ data: ServiceCatalog[] }>("/api/services");
      if (isSuccess(result) && result.data?.data) {
        setServices(result.data.data);
      } else {
        toastError("Error", "Failed to load services");
      }
      setLoadingServices(false);
    }
    fetchServices();
  }, []);

  // Group services by scope_group
  const groupedServices = React.useMemo(() => {
    const groups: Record<string, ServiceCatalog[]> = {};
    services.forEach((service) => {
      const group = service.scope_group || "Other";
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(service);
    });
    return groups;
  }, [services]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when field is modified
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Required field validation
    if (!formData.company_name.trim()) {
      newErrors.company_name = "Company name is required";
    }
    if (!formData.pic_name.trim()) {
      newErrors.pic_name = "PIC name is required";
    }
    if (!formData.contact_phone.trim()) {
      newErrors.contact_phone = "Phone number is required";
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    if (!formData.city_area.trim()) {
      newErrors.city_area = "City/Area is required";
    }
    if (!formData.service_code) {
      newErrors.service_code = "Service is required";
    }
    if (!formData.due_date) {
      newErrors.due_date = "Due date is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toastError("Validation Error", "Please fill in all required fields correctly");
      return;
    }

    setSubmitting(true);

    // Prepare payload - only send non-empty optional fields
    const payload: Record<string, unknown> = {
      company_name: formData.company_name.trim(),
      pic_name: formData.pic_name.trim(),
      contact_phone: formData.contact_phone.trim(),
      email: formData.email.trim().toLowerCase(),
      city_area: formData.city_area.trim(),
      service_code: formData.service_code,
      sourced_by: formData.sourced_by,
      primary_channel: formData.primary_channel,
      next_step: formData.next_step,
      due_date: formData.due_date,
    };

    // Add optional fields only if they have values
    if (formData.lead_date) {
      payload.lead_date = formData.lead_date;
    }
    if (formData.route.trim()) {
      payload.route = formData.route.trim();
    }
    if (formData.est_volume_value) {
      payload.est_volume_value = parseFloat(formData.est_volume_value);
    }
    if (formData.est_volume_unit) {
      payload.est_volume_unit = formData.est_volume_unit;
    }
    if (formData.timeline) {
      payload.timeline = formData.timeline;
    }
    if (formData.campaign_name.trim()) {
      payload.campaign_name = formData.campaign_name.trim();
    }
    if (formData.notes.trim()) {
      payload.notes = formData.notes.trim();
    }

    const result = await fetchJson<{
      data: {
        lead: { lead_id: string };
        hasDuplicates: boolean;
        duplicates: Array<{ lead_id: string; company_name: string }>;
      };
    }>("/api/crm/leads", {
      method: "POST",
      body: payload,
    });

    if (isSuccess(result) && result.data?.data) {
      const { lead, hasDuplicates, duplicates } = result.data.data;

      if (hasDuplicates && duplicates.length > 0) {
        toastSuccess(
          "Lead Created with Warning",
          `Lead ${lead.lead_id} created. ${duplicates.length} potential duplicate(s) found.`
        );
      } else {
        toastSuccess("Lead Created", `Lead ${lead.lead_id} has been created successfully`);
      }

      router.push("/crm/lead-inbox");
    } else {
      const errorResult = result as { error?: { message?: string } };
      const errorMessage =
        errorResult.error?.message || "Failed to create lead. Please try again.";
      toastError("Error", errorMessage);
    }

    setSubmitting(false);
  };

  const inputClassName = (fieldName: string) =>
    `w-full h-10 px-3 rounded-[14px] bg-muted/50 border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${
      errors[fieldName] ? "border-destructive" : "border-border"
    }`;

  const selectClassName = (fieldName: string) =>
    `w-full h-10 px-3 rounded-[14px] bg-muted/50 border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${
      errors[fieldName] ? "border-destructive" : "border-border"
    }`;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/crm/lead-inbox"
          className="flex items-center justify-center h-10 w-10 rounded-[14px] bg-muted/50 border border-border hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create New Lead</h1>
          <p className="text-muted-foreground">
            Enter lead details to add to triage queue
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Lead Date */}
        <div className="card p-6 rounded-[18px] border border-border bg-card/50 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Lead Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Lead Date</label>
              <input
                type="date"
                name="lead_date"
                value={formData.lead_date}
                onChange={handleChange}
                className={inputClassName("lead_date")}
              />
              <p className="text-xs text-muted-foreground">
                Date when the lead was captured
              </p>
            </div>
          </div>
        </div>

        {/* Company Information */}
        <div className="card p-6 rounded-[18px] border border-border bg-card/50 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Company Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Company Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                className={inputClassName("company_name")}
                placeholder="PT Example Indonesia"
              />
              {errors.company_name && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {errors.company_name}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                City/Area <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                name="city_area"
                value={formData.city_area}
                onChange={handleChange}
                className={inputClassName("city_area")}
                placeholder="Jakarta Selatan"
              />
              {errors.city_area && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {errors.city_area}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="card p-6 rounded-[18px] border border-border bg-card/50 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Contact Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                PIC Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                name="pic_name"
                value={formData.pic_name}
                onChange={handleChange}
                className={inputClassName("pic_name")}
                placeholder="John Doe"
              />
              {errors.pic_name && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {errors.pic_name}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone <span className="text-destructive">*</span>
              </label>
              <input
                type="tel"
                name="contact_phone"
                value={formData.contact_phone}
                onChange={handleChange}
                className={inputClassName("contact_phone")}
                placeholder="+62 812 3456 7890"
              />
              {errors.contact_phone && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {errors.contact_phone}
                </p>
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email <span className="text-destructive">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={inputClassName("email")}
                placeholder="john.doe@example.com"
              />
              {errors.email && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {errors.email}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Service Requirements */}
        <div className="card p-6 rounded-[18px] border border-border bg-card/50 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Service Requirements
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Service <span className="text-destructive">*</span>
              </label>
              {loadingServices ? (
                <div className="flex items-center gap-2 h-10 px-3 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading services...
                </div>
              ) : (
                <select
                  name="service_code"
                  value={formData.service_code}
                  onChange={handleChange}
                  className={selectClassName("service_code")}
                >
                  <option value="">Select a service</option>
                  {Object.entries(groupedServices).map(([group, services]) => (
                    <optgroup key={group} label={group}>
                      {services.map((service) => (
                        <option key={service.service_code} value={service.service_code}>
                          {service.service_name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
              {errors.service_code && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {errors.service_code}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Route className="h-4 w-4" />
                Route
              </label>
              <input
                type="text"
                name="route"
                value={formData.route}
                onChange={handleChange}
                className={inputClassName("route")}
                placeholder="Jakarta → Surabaya"
              />
              <p className="text-xs text-muted-foreground">
                Origin → Destination (e.g., JKT → SBY)
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Package className="h-4 w-4" />
                Estimated Volume
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  name="est_volume_value"
                  value={formData.est_volume_value}
                  onChange={handleChange}
                  className={`flex-1 ${inputClassName("est_volume_value")}`}
                  placeholder="100"
                  min="0"
                  step="0.01"
                />
                <select
                  name="est_volume_unit"
                  value={formData.est_volume_unit}
                  onChange={handleChange}
                  className="w-28 h-10 px-3 rounded-[14px] bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">Unit</option>
                  {VOLUME_UNITS.map((unit) => (
                    <option key={unit.value} value={unit.value}>
                      {unit.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Timeline
              </label>
              <select
                name="timeline"
                value={formData.timeline}
                onChange={handleChange}
                className={selectClassName("timeline")}
              >
                <option value="">Select timeline</option>
                {TIMELINES.map((timeline) => (
                  <option key={timeline.value} value={timeline.value}>
                    {timeline.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Attribution */}
        <div className="card p-6 rounded-[18px] border border-border bg-card/50 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Attribution
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Sourced By <span className="text-destructive">*</span>
              </label>
              <select
                name="sourced_by"
                value={formData.sourced_by}
                onChange={handleChange}
                className={selectClassName("sourced_by")}
              >
                {SOURCED_BY.map((source) => (
                  <option key={source.value} value={source.value}>
                    {source.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Department that generated this lead
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Primary Channel <span className="text-destructive">*</span>
              </label>
              <select
                name="primary_channel"
                value={formData.primary_channel}
                onChange={handleChange}
                className={selectClassName("primary_channel")}
              >
                {PRIMARY_CHANNELS.map((channel) => (
                  <option key={channel.value} value={channel.value}>
                    {channel.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Marketing/sales channel that captured this lead
              </p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-foreground">Campaign Name</label>
              <input
                type="text"
                name="campaign_name"
                value={formData.campaign_name}
                onChange={handleChange}
                className={inputClassName("campaign_name")}
                placeholder="Q1 2026 LinkedIn Campaign"
              />
              <p className="text-xs text-muted-foreground">
                Specific campaign or initiative (optional)
              </p>
            </div>
          </div>
        </div>

        {/* Next Action */}
        <div className="card p-6 rounded-[18px] border border-border bg-card/50 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Next Action
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Next Step <span className="text-destructive">*</span>
              </label>
              <select
                name="next_step"
                value={formData.next_step}
                onChange={handleChange}
                className={selectClassName("next_step")}
              >
                {NEXT_STEPS.map((step) => (
                  <option key={step.value} value={step.value}>
                    {step.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Due Date <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                name="due_date"
                value={formData.due_date}
                onChange={handleChange}
                className={inputClassName("due_date")}
              />
              {errors.due_date && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {errors.due_date}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card p-6 rounded-[18px] border border-border bg-card/50 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Notes
          </h2>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={4}
            className="w-full px-3 py-3 rounded-[14px] bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            placeholder="Additional notes about the lead, special requirements, initial conversation summary..."
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Link
            href="/crm/lead-inbox"
            className="px-6 py-2.5 rounded-[14px] border border-border bg-muted/50 text-foreground font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-[14px] bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Lead"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

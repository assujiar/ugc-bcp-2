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
} from "lucide-react";
import { fetchJson, isSuccess } from "@/lib/api/fetchJson";
import { toastError, toastSuccess } from "@/lib/hooks/use-toast";

const PRIMARY_CHANNELS = [
  "LinkedIn",
  "SEM",
  "Paid Social",
  "Website (Direct/Referral)",
  "Webinar & Live",
  "Event Offline",
  "Trade Show",
  "Partnership/Referral",
  "Sales Outbound",
  "Sales Referral",
  "Other",
];

const NEXT_STEPS = [
  "Call",
  "Email",
  "Visit",
  "Online Meeting",
  "Send Proposal",
  "Follow Up",
];

const SOURCED_BY = ["Marketing", "Sales"];

interface ServiceCatalog {
  service_code: string;
  service_name: string;
}

export default function NewLeadPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [services, setServices] = React.useState<ServiceCatalog[]>([]);

  const [formData, setFormData] = React.useState({
    company_name: "",
    pic_name: "",
    contact_phone: "",
    email: "",
    city_area: "",
    service_code: "",
    route: "",
    est_volume_value: "",
    est_volume_unit: "",
    timeline: "",
    sourced_by: "Marketing" as "Marketing" | "Sales",
    primary_channel: "Website (Direct/Referral)",
    campaign_name: "",
    notes: "",
    next_step: "Call",
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  });

  React.useEffect(() => {
    async function fetchServices() {
      const result = await fetchJson<{ data: ServiceCatalog[] }>("/api/services");
      if (isSuccess(result) && result.data?.data) {
        setServices(result.data.data);
        if (result.data.data.length > 0) {
          setFormData((prev) => ({ ...prev, service_code: result.data.data[0].service_code }));
        }
      }
    }
    fetchServices();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.company_name || !formData.pic_name || !formData.contact_phone || !formData.email || !formData.city_area || !formData.service_code) {
      toastError("Validation Error", "Please fill in all required fields");
      return;
    }

    setSubmitting(true);

    const payload = {
      ...formData,
      est_volume_value: formData.est_volume_value ? parseFloat(formData.est_volume_value) : undefined,
    };

    const result = await fetchJson("/api/crm/leads", {
      method: "POST",
      body: payload,
    });

    if (isSuccess(result)) {
      toastSuccess("Lead Created", "The lead has been created successfully");
      router.push("/crm/lead-inbox");
    } else {
      toastError("Error", result.error || "Failed to create lead");
    }

    setSubmitting(false);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/crm/lead-inbox" className="btn-ghost h-10 w-10 p-0">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create New Lead</h1>
          <p className="text-muted-foreground">Enter lead details to add to triage queue</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Information */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Company Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Company Name *</label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                required
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="PT Example Indonesia"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                City/Area *
              </label>
              <input
                type="text"
                name="city_area"
                value={formData.city_area}
                onChange={handleChange}
                required
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Jakarta"
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Contact Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">PIC Name *</label>
              <input
                type="text"
                name="pic_name"
                value={formData.pic_name}
                onChange={handleChange}
                required
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone *
              </label>
              <input
                type="tel"
                name="contact_phone"
                value={formData.contact_phone}
                onChange={handleChange}
                required
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="+62 812 3456 7890"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="john@example.com"
              />
            </div>
          </div>
        </div>

        {/* Service Requirements */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Service Requirements
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Service *</label>
              <select
                name="service_code"
                value={formData.service_code}
                onChange={handleChange}
                required
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Select a service</option>
                {services.map((service) => (
                  <option key={service.service_code} value={service.service_code}>
                    {service.service_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Route</label>
              <input
                type="text"
                name="route"
                value={formData.route}
                onChange={handleChange}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Jakarta → Surabaya"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Est. Volume</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  name="est_volume_value"
                  value={formData.est_volume_value}
                  onChange={handleChange}
                  className="flex-1 h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="100"
                />
                <select
                  name="est_volume_unit"
                  value={formData.est_volume_unit}
                  onChange={handleChange}
                  className="w-24 h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">Unit</option>
                  <option value="kg">kg</option>
                  <option value="cbm">cbm</option>
                  <option value="TEU">TEU</option>
                  <option value="shipment">shipment</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Timeline</label>
              <select
                name="timeline"
                value={formData.timeline}
                onChange={handleChange}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Select timeline</option>
                <option value="Immediate">Immediate</option>
                <option value="1 Week">1 Week</option>
                <option value="1 Month">1 Month</option>
                <option value="3 Months">3 Months</option>
                <option value="Exploring">Just Exploring</option>
              </select>
            </div>
          </div>
        </div>

        {/* Attribution */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Attribution</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Sourced By *</label>
              <select
                name="sourced_by"
                value={formData.sourced_by}
                onChange={handleChange}
                required
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {SOURCED_BY.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Primary Channel *</label>
              <select
                name="primary_channel"
                value={formData.primary_channel}
                onChange={handleChange}
                required
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {PRIMARY_CHANNELS.map((channel) => (
                  <option key={channel} value={channel}>
                    {channel}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Campaign Name</label>
              <input
                type="text"
                name="campaign_name"
                value={formData.campaign_name}
                onChange={handleChange}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Q1 2026 Campaign"
              />
            </div>
          </div>
        </div>

        {/* Next Action */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Next Action</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Next Step *</label>
              <select
                name="next_step"
                value={formData.next_step}
                onChange={handleChange}
                required
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {NEXT_STEPS.map((step) => (
                  <option key={step} value={step}>
                    {step}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Due Date *</label>
              <input
                type="date"
                name="due_date"
                value={formData.due_date}
                onChange={handleChange}
                required
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Notes</h2>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={4}
            className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            placeholder="Additional notes about the lead..."
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/crm/lead-inbox" className="btn-outline">
            Cancel
          </Link>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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

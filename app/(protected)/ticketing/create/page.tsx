"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/contexts/user-context";
import { createTicket } from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Ticket,
  FileText,
  Truck,
  Package,
  MapPin,
} from "lucide-react";
import Link from "next/link";

const TICKET_TYPES = [
  {
    value: "inquiry tariff",
    label: "Inquiry Tariff (RFQ)",
    description: "Request rate quote from operations",
    icon: FileText,
  },
  {
    value: "general request",
    label: "General Request",
    description: "General operational request",
    icon: Ticket,
  },
  {
    value: "request pickup",
    label: "Request Pickup",
    description: "Schedule cargo pickup",
    icon: Truck,
  },
  {
    value: "request delivery",
    label: "Request Delivery",
    description: "Schedule cargo delivery",
    icon: Package,
  },
];

const DEPARTMENTS = [
  { code: "DOM", name: "Domestics Ops" },
  { code: "EXI", name: "EXIM Ops" },
  { code: "DTD", name: "Import DTD Ops" },
  { code: "TRF", name: "Warehouse & Traffic" },
];

const SERVICES = [
  { code: "DOM_LTL", name: "Domestics - LTL", dept: "DOM" },
  { code: "DOM_FTL", name: "Domestics - FTL (Charter)", dept: "DOM" },
  { code: "DOM_LCL", name: "Domestics - LCL", dept: "DOM" },
  { code: "DOM_FCL", name: "Domestics - FCL", dept: "DOM" },
  { code: "DOM_AF", name: "Domestics - Air Freight", dept: "DOM" },
  { code: "DOM_WHF", name: "Domestics - Warehouse & Fulfillment", dept: "DOM" },
  { code: "EXI_LCL_EXPORT", name: "EXIM - LCL Export", dept: "EXI" },
  { code: "EXI_LCL_IMPORT", name: "EXIM - LCL Import", dept: "EXI" },
  { code: "EXI_FCL_EXPORT", name: "EXIM - FCL Export", dept: "EXI" },
  { code: "EXI_FCL_IMPORT", name: "EXIM - FCL Import", dept: "EXI" },
  { code: "EXI_AF", name: "EXIM - Air Freight", dept: "EXI" },
  { code: "EXI_CUSTOMS", name: "EXIM - Customs Clearance", dept: "EXI" },
  { code: "DTD_LCL", name: "Import DTD - LCL", dept: "DTD" },
  { code: "DTD_FCL", name: "Import DTD - FCL", dept: "DTD" },
  { code: "DTD_AF", name: "Import DTD - Air Freight", dept: "DTD" },
  { code: "TRF_WHF", name: "Warehouse & Fulfillment", dept: "TRF" },
  { code: "TRF_REQPU", name: "Request Pickup", dept: "TRF" },
  { code: "TRF_REQDVR", name: "Request Delivery", dept: "TRF" },
];

export default function CreateTicketPage() {
  const router = useRouter();
  const { user, isDirector } = useUser();

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const [formData, setFormData] = React.useState({
    ticket_type: "general request",
    dept_target: "DOM",
    service_code: "",
    subject: "",
    description: "",
    // RFQ / Pickup / Delivery fields
    origin_address: "",
    origin_city: "",
    origin_country: "Indonesia",
    destination_address: "",
    destination_city: "",
    destination_country: "Indonesia",
    cargo_category: "",
    cargo_qty: "",
    cargo_dimensions: "",
    cargo_weight: "",
    scope_of_work: "",
  });

  // Filter services by selected department
  const filteredServices = SERVICES.filter((s) => s.dept === formData.dept_target);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      // Reset service when dept changes
      ...(name === "dept_target" ? { service_code: "" } : {}),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.subject) {
      setError("Please enter a subject");
      setLoading(false);
      return;
    }

    const result = await createTicket({
      ticket_type: formData.ticket_type as "inquiry tariff" | "general request" | "request pickup" | "request delivery",
      dept_target: formData.dept_target,
      service_code: formData.service_code || undefined,
      subject: formData.subject,
      description: formData.description || undefined,
      origin_address: formData.origin_address || undefined,
      origin_city: formData.origin_city || undefined,
      origin_country: formData.origin_country || undefined,
      destination_address: formData.destination_address || undefined,
      destination_city: formData.destination_city || undefined,
      destination_country: formData.destination_country || undefined,
      cargo_category: formData.cargo_category || undefined,
      cargo_qty: formData.cargo_qty ? parseFloat(formData.cargo_qty) : undefined,
      cargo_dimensions: formData.cargo_dimensions || undefined,
      cargo_weight: formData.cargo_weight ? parseFloat(formData.cargo_weight) : undefined,
      scope_of_work: formData.scope_of_work || undefined,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => {
        router.push("/ticketing");
      }, 1500);
    }
  };

  // Director can't create tickets
  if (isDirector) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-warning mb-4" />
        <p className="text-lg font-medium text-foreground mb-2">Read-Only Access</p>
        <p className="text-sm text-muted-foreground">Director role cannot create tickets</p>
        <Link href="/ticketing" className="btn-primary mt-4">
          Back to Ticketing
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <CheckCircle className="h-16 w-16 text-success mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Ticket Created Successfully!</h2>
        <p className="text-muted-foreground">Redirecting to tickets list...</p>
      </div>
    );
  }

  const showLocationFields = ["inquiry tariff", "request pickup", "request delivery"].includes(
    formData.ticket_type
  );
  const showCargoFields = ["inquiry tariff", "request pickup", "request delivery"].includes(
    formData.ticket_type
  );

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <Link
          href="/ticketing"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Ticketing
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Create New Ticket</h1>
        <p className="text-muted-foreground">Submit a request to the operations team</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 rounded-[14px] bg-destructive/10 border border-destructive/20 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Ticket Type Selection */}
        <div className="card">
          <h3 className="font-semibold text-foreground mb-4">Select Ticket Type</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {TICKET_TYPES.map((type) => {
              const Icon = type.icon;
              const isSelected = formData.ticket_type === type.value;
              return (
                <label
                  key={type.value}
                  className={`flex flex-col items-center p-4 rounded-[14px] border-2 cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="ticket_type"
                    value={type.value}
                    checked={isSelected}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <Icon
                    className={`h-8 w-8 mb-2 ${isSelected ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span className={`text-sm font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>
                    {type.label}
                  </span>
                  <span className="text-xs text-muted-foreground text-center mt-1">
                    {type.description}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Basic Info */}
        <div className="card">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Ticket className="h-5 w-5 text-muted-foreground" />
            Ticket Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Department Target <span className="text-destructive">*</span>
              </label>
              <select
                name="dept_target"
                value={formData.dept_target}
                onChange={handleChange}
                className="input w-full"
                required
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Service</label>
              <select
                name="service_code"
                value={formData.service_code}
                onChange={handleChange}
                className="input w-full"
              >
                <option value="">Select Service (Optional)</option>
                {filteredServices.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">
                Subject <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                className="input w-full"
                placeholder="Brief description of your request"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="input w-full"
                rows={4}
                placeholder="Detailed description of your request..."
              />
            </div>
          </div>
        </div>

        {/* Location Fields */}
        {showLocationFields && (
          <div className="card">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              Origin & Destination
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">Origin</h4>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">City</label>
                  <input
                    type="text"
                    name="origin_city"
                    value={formData.origin_city}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="Jakarta"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Address</label>
                  <input
                    type="text"
                    name="origin_address"
                    value={formData.origin_address}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="Jl. Example No. 123"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Country</label>
                  <input
                    type="text"
                    name="origin_country"
                    value={formData.origin_country}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="Indonesia"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">Destination</h4>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">City</label>
                  <input
                    type="text"
                    name="destination_city"
                    value={formData.destination_city}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="Surabaya"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Address</label>
                  <input
                    type="text"
                    name="destination_address"
                    value={formData.destination_address}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="Jl. Example No. 456"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Country</label>
                  <input
                    type="text"
                    name="destination_country"
                    value={formData.destination_country}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="Indonesia"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cargo Fields */}
        {showCargoFields && (
          <div className="card">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              Cargo Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Cargo Category
                </label>
                <input
                  type="text"
                  name="cargo_category"
                  value={formData.cargo_category}
                  onChange={handleChange}
                  className="input w-full"
                  placeholder="General Cargo, Electronics, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Quantity</label>
                <input
                  type="number"
                  name="cargo_qty"
                  value={formData.cargo_qty}
                  onChange={handleChange}
                  className="input w-full"
                  placeholder="10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  name="cargo_weight"
                  value={formData.cargo_weight}
                  onChange={handleChange}
                  className="input w-full"
                  placeholder="1000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Dimensions (LxWxH cm)
                </label>
                <input
                  type="text"
                  name="cargo_dimensions"
                  value={formData.cargo_dimensions}
                  onChange={handleChange}
                  className="input w-full"
                  placeholder="100x50x50"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">
                  Scope of Work
                </label>
                <textarea
                  name="scope_of_work"
                  value={formData.scope_of_work}
                  onChange={handleChange}
                  className="input w-full"
                  rows={3}
                  placeholder="Door-to-door, include customs clearance, etc."
                />
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/ticketing" className="btn-outline">
            Cancel
          </Link>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              "Create Ticket"
            )}
          </button>
        </div>
      </form>
    </>
  );
}

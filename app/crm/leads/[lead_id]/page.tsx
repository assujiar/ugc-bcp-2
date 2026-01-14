"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/lib/contexts/user-context";
import { fetchLeads, updateLead, Lead } from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Truck,
  Calendar,
  Tag,
  UserPlus,
  Save,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SERVICE_OPTIONS = [
  { value: "DOM_LTL", label: "Domestics - LTL", dept: "DOM" },
  { value: "DOM_FTL", label: "Domestics - FTL (Charter)", dept: "DOM" },
  { value: "DOM_LCL", label: "Domestics - LCL", dept: "DOM" },
  { value: "DOM_FCL", label: "Domestics - FCL", dept: "DOM" },
  { value: "DOM_AF", label: "Domestics - Air Freight", dept: "DOM" },
  { value: "DOM_WHF", label: "Domestics - Warehouse & Fulfillment", dept: "DOM" },
  { value: "EXI_LCL_EXPORT", label: "EXIM - LCL Export", dept: "EXI" },
  { value: "EXI_LCL_IMPORT", label: "EXIM - LCL Import", dept: "EXI" },
  { value: "EXI_FCL_EXPORT", label: "EXIM - FCL Export", dept: "EXI" },
  { value: "EXI_FCL_IMPORT", label: "EXIM - FCL Import", dept: "EXI" },
  { value: "EXI_AF", label: "EXIM - Air Freight", dept: "EXI" },
  { value: "EXI_CUSTOMS", label: "EXIM - Customs Clearance", dept: "EXI" },
  { value: "DTD_LCL", label: "Import DTD - LCL", dept: "DTD" },
  { value: "DTD_FCL", label: "Import DTD - FCL", dept: "DTD" },
  { value: "DTD_AF", label: "Import DTD - Air Freight", dept: "DTD" },
  { value: "TRF_WHF", label: "Warehouse & Traffic - Fulfillment", dept: "TRF" },
];

const STATUS_OPTIONS = [
  { value: "New", label: "New", color: "bg-info/10 text-info" },
  { value: "Contacted", label: "Contacted", color: "bg-primary/10 text-primary" },
  { value: "Qualified", label: "Qualified", color: "bg-success/10 text-success" },
  { value: "Proposal", label: "Proposal", color: "bg-warning/10 text-warning" },
  { value: "Negotiation", label: "Negotiation", color: "bg-secondary/10 text-secondary" },
  { value: "Closed Won", label: "Closed Won", color: "bg-success/10 text-success" },
  { value: "Closed Lost", label: "Closed Lost", color: "bg-destructive/10 text-destructive" },
  { value: "Disqualified", label: "Disqualified", color: "bg-muted text-muted-foreground" },
];

const NEXT_STEP_OPTIONS = [
  { value: "Call", label: "Call" },
  { value: "Email", label: "Email" },
  { value: "Visit", label: "Visit" },
  { value: "Online Meeting", label: "Online Meeting" },
  { value: "Send Proposal", label: "Send Proposal" },
  { value: "Follow Up", label: "Follow Up" },
];

interface Salesperson {
  user_id: string;
  full_name: string;
  role_name: string;
}

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const leadId = params.lead_id as string;
  const { user, isMarketing, isSales, isDirector } = useUser();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [lead, setLead] = React.useState<Lead | null>(null);

  // Salesperson list for assignment
  const [salespersons, setSalespersons] = React.useState<Salesperson[]>([]);
  const [showAssignModal, setShowAssignModal] = React.useState(false);
  const [selectedSalesperson, setSelectedSalesperson] = React.useState("");

  // Form state
  const [formData, setFormData] = React.useState({
    status: "",
    next_step: "",
    due_date: "",
    notes: "",
    service_code: "",
    route: "",
    est_volume_value: "",
    est_volume_unit: "",
    timeline: "",
  });

  // Load lead data
  React.useEffect(() => {
    async function loadLead() {
      setLoading(true);
      const result = await fetchLeads({ search: leadId, pageSize: 1 });
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        const leads = (result.data as { data: Lead[] }).data || [];
        const foundLead = leads.find((l) => l.lead_id === leadId);
        if (foundLead) {
          setLead(foundLead);
          setFormData({
            status: foundLead.status || "",
            next_step: foundLead.next_step || "",
            due_date: foundLead.due_date || "",
            notes: foundLead.notes || "",
            service_code: foundLead.service_code || "",
            route: foundLead.route || "",
            est_volume_value: foundLead.est_volume_value?.toString() || "",
            est_volume_unit: foundLead.est_volume_unit || "",
            timeline: foundLead.timeline || "",
          });
        } else {
          setError("Lead not found");
        }
      }
      setLoading(false);
    }
    loadLead();
  }, [leadId]);

  // Load salespersons for assignment
  React.useEffect(() => {
    async function loadSalespersons() {
      try {
        const response = await fetch("/api/users?role=salesperson");
        const data = await response.json();
        if (data.data) {
          setSalespersons(data.data);
        }
      } catch (err) {
        console.error("Failed to load salespersons");
      }
    }
    if (isMarketing || user?.role_name === "sales manager" || user?.role_name === "super admin") {
      loadSalespersons();
    }
  }, [isMarketing, user?.role_name]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const result = await updateLead(leadId, {
      status: formData.status,
      next_step: formData.next_step,
      due_date: formData.due_date,
      notes: formData.notes,
      service_code: formData.service_code,
      route: formData.route,
      est_volume_value: formData.est_volume_value ? parseFloat(formData.est_volume_value) : undefined,
      est_volume_unit: formData.est_volume_unit,
      timeline: formData.timeline,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
    setSaving(false);
  };

  const handleAssign = async () => {
    if (!selectedSalesperson) return;

    setSaving(true);
    setError(null);

    const result = await updateLead(leadId, {
      sales_owner_user_id: selectedSalesperson,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setShowAssignModal(false);
      // Reload lead data
      const reloadResult = await fetchLeads({ search: leadId, pageSize: 1 });
      if (reloadResult.data) {
        const leads = (reloadResult.data as { data: Lead[] }).data || [];
        const foundLead = leads.find((l) => l.lead_id === leadId);
        if (foundLead) setLead(foundLead);
      }
    }
    setSaving(false);
  };

  const canEdit = !isDirector && (
    isMarketing ||
    isSales ||
    user?.role_name === "super admin" ||
    lead?.sales_owner_user_id === user?.user_id ||
    lead?.created_by === user?.user_id
  );

  const canAssign = isMarketing || user?.role_name === "sales manager" || user?.role_name === "super admin";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading lead...</span>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-medium text-foreground">Lead Not Found</p>
        <Link href="/crm/leads" className="btn-primary mt-4">
          Back to Leads
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <Link
          href="/crm/leads"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Leads
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{lead.lead_id}</h1>
            <p className="text-muted-foreground">{lead.company_name}</p>
          </div>
          <div className="flex items-center gap-2">
            {canAssign && !lead.sales_owner_user_id && (
              <button
                onClick={() => setShowAssignModal(true)}
                className="btn-outline inline-flex items-center gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Assign to Sales
              </button>
            )}
            {canEdit && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary inline-flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 rounded-[14px] bg-destructive/10 border border-destructive/20 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 rounded-[14px] bg-success/10 border border-success/20 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-success" />
          <p className="text-sm text-success">Changes saved successfully!</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company Info (Read-only) */}
          <div className="card">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              Company Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Company</p>
                <p className="font-medium text-foreground">{lead.company_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">PIC</p>
                <p className="font-medium text-foreground">{lead.pic_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Phone
                </p>
                <p className="font-medium text-foreground">{lead.contact_phone}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Email
                </p>
                <p className="font-medium text-foreground">{lead.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> City
                </p>
                <p className="font-medium text-foreground">{lead.city_area}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Channel</p>
                <p className="font-medium text-foreground">{lead.primary_channel}</p>
              </div>
            </div>
          </div>

          {/* Service Requirements (Editable) */}
          <div className="card">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Truck className="h-5 w-5 text-muted-foreground" />
              Service Requirements
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Service
                </label>
                <select
                  name="service_code"
                  value={formData.service_code}
                  onChange={handleChange}
                  className="input w-full"
                  disabled={!canEdit}
                >
                  <option value="">Select service...</option>
                  {SERVICE_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Route
                </label>
                <input
                  type="text"
                  name="route"
                  value={formData.route}
                  onChange={handleChange}
                  className="input w-full"
                  placeholder="JKT → SBY"
                  disabled={!canEdit}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Est. Volume
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="est_volume_value"
                    value={formData.est_volume_value}
                    onChange={handleChange}
                    className="input flex-1"
                    placeholder="100"
                    disabled={!canEdit}
                  />
                  <select
                    name="est_volume_unit"
                    value={formData.est_volume_unit}
                    onChange={handleChange}
                    className="input w-24"
                    disabled={!canEdit}
                  >
                    <option value="">Unit</option>
                    <option value="kg">kg</option>
                    <option value="cbm">cbm</option>
                    <option value="TEU">TEU</option>
                    <option value="shipment">shipment</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Timeline
                </label>
                <select
                  name="timeline"
                  value={formData.timeline}
                  onChange={handleChange}
                  className="input w-full"
                  disabled={!canEdit}
                >
                  <option value="">Select timeline...</option>
                  <option value="Immediate">Immediate</option>
                  <option value="1 Week">1 Week</option>
                  <option value="1 Month">1 Month</option>
                  <option value="3 Months">3 Months</option>
                  <option value="Unknown">Unknown</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="card">
            <h3 className="font-semibold text-foreground mb-4">Notes</h3>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="input w-full"
              rows={4}
              placeholder="Add notes..."
              disabled={!canEdit}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status & Follow-up */}
          <div className="card">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Tag className="h-5 w-5 text-muted-foreground" />
              Status & Follow-up
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="input w-full"
                  disabled={!canEdit}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Next Step
                </label>
                <select
                  name="next_step"
                  value={formData.next_step}
                  onChange={handleChange}
                  className="input w-full"
                  disabled={!canEdit}
                >
                  {NEXT_STEP_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  name="due_date"
                  value={formData.due_date}
                  onChange={handleChange}
                  className="input w-full"
                  disabled={!canEdit}
                />
              </div>
            </div>
          </div>

          {/* Ownership */}
          <div className="card">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              Ownership
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Created By</p>
                <p className="font-medium text-foreground">
                  {lead.creator?.full_name || "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sales Owner</p>
                <p className="font-medium text-foreground">
                  {lead.sales_owner?.full_name || (
                    <span className="text-warning">Unassigned</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created At</p>
                <p className="font-medium text-foreground">
                  {new Date(lead.created_at).toLocaleString("id-ID")}
                </p>
              </div>
            </div>
            {canAssign && lead.sales_owner_user_id && (
              <button
                onClick={() => setShowAssignModal(true)}
                className="btn-outline w-full mt-4 text-sm"
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Reassign
              </button>
            )}
          </div>

          {/* Related */}
          <div className="card">
            <h3 className="font-semibold text-foreground mb-4">Related</h3>
            <div className="space-y-2">
              {lead.customer_id && (
                <Link
                  href={`/crm/accounts/${lead.customer_id}`}
                  className="block p-3 rounded-[10px] bg-muted hover:bg-muted/80 transition-colors"
                >
                  <p className="text-sm font-medium text-foreground">Account</p>
                  <p className="text-xs text-muted-foreground">{lead.customer_id}</p>
                </Link>
              )}
              {lead.prospect_id && (
                <Link
                  href={`/crm/targets/${lead.prospect_id}`}
                  className="block p-3 rounded-[10px] bg-muted hover:bg-muted/80 transition-colors"
                >
                  <p className="text-sm font-medium text-foreground">Target</p>
                  <p className="text-xs text-muted-foreground">{lead.prospect_id}</p>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-[16px] p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Assign Lead to Salesperson
            </h3>
            <select
              value={selectedSalesperson}
              onChange={(e) => setSelectedSalesperson(e.target.value)}
              className="input w-full mb-4"
            >
              <option value="">Select salesperson...</option>
              {salespersons.map((sp) => (
                <option key={sp.user_id} value={sp.user_id}>
                  {sp.full_name}
                </option>
              ))}
            </select>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowAssignModal(false)}
                className="btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={!selectedSalesperson || saving}
                className="btn-primary"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Assign"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

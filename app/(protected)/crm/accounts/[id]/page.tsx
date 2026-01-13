"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  Globe,
  DollarSign,
  TrendingUp,
  Users,
  FileText,
  Activity,
  ChevronRight,
  Plus,
  Clock,
  Loader2,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { modalTitles } from "@/lib/terminology/labels";

interface Account {
  account_id: string;
  company_name: string;
  domain: string | null;
  industry: string | null;
  pic_name: string;
  pic_phone: string;
  pic_email: string;
  address: string | null;
  city: string | null;
  country: string | null;
  npwp: string | null;
  tenure_status: string;
  activity_status: string;
  lifetime_value: number;
  total_invoices: number;
  first_invoice_at: string | null;
  last_invoice_at: string | null;
  created_at: string;
}

interface Contact {
  contact_id: string;
  first_name: string;
  last_name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  is_decision_maker: boolean;
}

interface Opportunity {
  opportunity_id: string;
  name: string;
  stage: string;
  estimated_value: number | null;
  next_step: string;
  owner?: { full_name: string } | null;
}

interface ActivityItem {
  activity_id: string;
  activity_type: string;
  status: string;
  subject: string;
  due_date: string | null;
  completed_at: string | null;
  owner?: { full_name: string } | null;
}

interface InvoiceSummary {
  ar_total: number;
  bucket_1_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
}

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;

  const [data, setData] = React.useState<{
    account: Account | null;
    contacts: Contact[];
    opportunities: Opportunity[];
    activities: ActivityItem[];
    invoiceSummary: InvoiceSummary | null;
  }>({
    account: null,
    contacts: [],
    opportunities: [],
    activities: [],
    invoiceSummary: null,
  });
  const [loading, setLoading] = React.useState(true);
  const [showAddContactModal, setShowAddContactModal] = React.useState(false);
  const [showEditAccountModal, setShowEditAccountModal] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [addContactData, setAddContactData] = React.useState({
    first_name: "",
    last_name: "",
    title: "",
    email: "",
    phone: "",
    is_primary: false,
    is_decision_maker: false,
  });
  const [editAccountData, setEditAccountData] = React.useState({
    company_name: "",
    domain: "",
    industry: "",
    pic_name: "",
    pic_phone: "",
    pic_email: "",
    address: "",
    city: "",
    country: "",
    npwp: "",
  });

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/crm/accounts/${accountId}`);
        if (res.ok) {
          const result = await res.json();
          setData(result);
        }
      } catch (err) {
        console.error("Error fetching account:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [accountId]);

  const handleAddContact = async () => {
    if (!addContactData.first_name || !addContactData.phone) {
      alert("First name and phone are required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...addContactData,
          account_id: accountId,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        // Add new contact to local state
        setData((prev) => ({
          ...prev,
          contacts: addContactData.is_primary
            ? [result.contact, ...prev.contacts.map((c) => ({ ...c, is_primary: false }))]
            : [...prev.contacts, result.contact],
        }));
        setShowAddContactModal(false);
        setAddContactData({
          first_name: "",
          last_name: "",
          title: "",
          email: "",
          phone: "",
          is_primary: false,
          is_decision_maker: false,
        });
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to create contact");
      }
    } catch (err) {
      console.error("Error creating contact:", err);
      alert("An error occurred while creating the contact");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = () => {
    if (data.account) {
      setEditAccountData({
        company_name: data.account.company_name || "",
        domain: data.account.domain || "",
        industry: data.account.industry || "",
        pic_name: data.account.pic_name || "",
        pic_phone: data.account.pic_phone || "",
        pic_email: data.account.pic_email || "",
        address: data.account.address || "",
        city: data.account.city || "",
        country: data.account.country || "",
        npwp: data.account.npwp || "",
      });
      setShowEditAccountModal(true);
    }
  };

  const handleEditAccount = async () => {
    if (!editAccountData.company_name) {
      alert("Company name is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/crm/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editAccountData),
      });

      if (res.ok) {
        const result = await res.json();
        setData((prev) => ({
          ...prev,
          account: { ...prev.account!, ...result.account },
        }));
        setShowEditAccountModal(false);
      } else {
        const errorData = await res.json();
        alert(errorData.error?.message || errorData.error || "Failed to update account");
      }
    } catch (err) {
      console.error("Error updating account:", err);
      alert("An error occurred while updating the account");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return "-";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getTenureColor = (status: string) => {
    switch (status) {
      case "Active Customer": return "bg-success text-white";
      case "New Customer": return "bg-primary text-white";
      case "Winback Target": return "bg-warning text-white";
      case "Prospect": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getActivityColor = (status: string) => {
    switch (status) {
      case "Active": return "bg-success text-white";
      case "Passive": return "bg-warning text-white";
      case "Inactive": return "bg-destructive text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStageColor = (stage: string) => {
    if (stage === "Closed Won") return "bg-success/10 text-success";
    if (stage === "Closed Lost") return "bg-destructive/10 text-destructive";
    if (["Negotiation", "Verbal Commit"].includes(stage)) return "bg-primary/10 text-primary";
    return "bg-warning/10 text-warning";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 skeleton" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64 skeleton rounded-xl" />
          <div className="h-64 skeleton rounded-xl" />
        </div>
      </div>
    );
  }

  const { account, contacts, opportunities, activities, invoiceSummary } = data;

  if (!account) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">Account not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-2xl">
            {account.company_name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{account.company_name}</h1>
            <p className="text-muted-foreground">{account.industry || "No industry set"}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", getTenureColor(account.tenure_status))}>
                {account.tenure_status}
              </span>
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", getActivityColor(account.activity_status))}>
                {account.activity_status}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={openEditModal} className="btn-ghost h-9">
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </button>
          <Link href={`/crm/pipeline?account_id=${accountId}`} className="btn-outline h-9">
            <Plus className="h-4 w-4 mr-2" />
            Add Opportunity
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Account Details */}
          <div className="card">
            <h2 className="font-semibold text-foreground mb-4">Account Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Primary Contact:</span>
                <span className="text-foreground">{account.pic_name}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Phone:</span>
                <span className="text-foreground">{account.pic_phone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Email:</span>
                <span className="text-foreground">{account.pic_email}</span>
              </div>
              {account.city && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Location:</span>
                  <span className="text-foreground">{account.city}{account.country ? `, ${account.country}` : ""}</span>
                </div>
              )}
              {account.domain && (
                <div className="flex items-center gap-3 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Website:</span>
                  <span className="text-foreground">{account.domain}</span>
                </div>
              )}
              {account.npwp && (
                <div className="flex items-center gap-3 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">NPWP:</span>
                  <span className="text-foreground">{account.npwp}</span>
                </div>
              )}
            </div>
          </div>

          {/* Opportunities */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Opportunities</h2>
              <span className="text-sm text-muted-foreground">{opportunities.length} total</span>
            </div>
            {opportunities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No opportunities yet</p>
            ) : (
              <div className="space-y-3">
                {opportunities.slice(0, 5).map((opp) => (
                  <div key={opp.opportunity_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="font-medium text-foreground text-sm">{opp.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", getStageColor(opp.stage))}>
                          {opp.stage}
                        </span>
                        {opp.estimated_value && (
                          <span className="text-xs text-muted-foreground">{formatCurrency(opp.estimated_value)}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activities Timeline */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Recent Activities</h2>
              <span className="text-sm text-muted-foreground">{activities.length} total</span>
            </div>
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No activities recorded</p>
            ) : (
              <div className="space-y-3">
                {activities.slice(0, 5).map((activity) => (
                  <div key={activity.activity_id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full",
                      activity.status === "Done" ? "bg-success/10" : "bg-primary/10"
                    )}>
                      <Activity className={cn("h-4 w-4", activity.status === "Done" ? "text-success" : "text-primary")} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground text-sm">{activity.subject}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{activity.activity_type}</span>
                        <span>&bull;</span>
                        <span>{activity.status === "Done" ? `Completed ${formatDate(activity.completed_at)}` : `Due ${formatDate(activity.due_date)}`}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
          {/* Financial Summary */}
          <div className="card">
            <h2 className="font-semibold text-foreground mb-4">Financial Summary</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Lifetime Value</span>
                <span className="font-semibold text-foreground">{formatCurrency(account.lifetime_value)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Invoices</span>
                <span className="font-semibold text-foreground">{account.total_invoices}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">First Invoice</span>
                <span className="text-foreground">{formatDate(account.first_invoice_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last Invoice</span>
                <span className="text-foreground">{formatDate(account.last_invoice_at)}</span>
              </div>
              {invoiceSummary && invoiceSummary.ar_total > 0 && (
                <>
                  <hr className="border-border" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Outstanding AR</span>
                    <span className="font-semibold text-destructive">{formatCurrency(invoiceSummary.ar_total)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Contacts */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Contacts</h2>
              <button onClick={() => setShowAddContactModal(true)} className="btn-ghost h-8 px-2">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No contacts</p>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact) => (
                  <div key={contact.contact_id} className="p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground text-sm">
                        {contact.first_name} {contact.last_name}
                      </p>
                      {contact.is_primary && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-primary/10 text-primary">Primary</span>
                      )}
                      {contact.is_decision_maker && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-warning/10 text-warning">DM</span>
                      )}
                    </div>
                    {contact.title && (
                      <p className="text-xs text-muted-foreground">{contact.title}</p>
                    )}
                    {contact.email && (
                      <p className="text-xs text-muted-foreground mt-1">{contact.email}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="card">
            <h2 className="font-semibold text-foreground mb-4">Quick Stats</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{opportunities.filter((o) => !["Closed Won", "Closed Lost"].includes(o.stage)).length}</p>
                  <p className="text-xs text-muted-foreground">Open Opportunities</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <DollarSign className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{opportunities.filter((o) => o.stage === "Closed Won").length}</p>
                  <p className="text-xs text-muted-foreground">Won Deals</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{activities.filter((a) => a.status === "Planned").length}</p>
                  <p className="text-xs text-muted-foreground">Pending Activities</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Contact Modal */}
      <Dialog open={showAddContactModal} onOpenChange={setShowAddContactModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{modalTitles.addContact}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">First Name *</label>
                <input
                  type="text"
                  value={addContactData.first_name}
                  onChange={(e) => setAddContactData({ ...addContactData, first_name: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Last Name</label>
                <input
                  type="text"
                  value={addContactData.last_name}
                  onChange={(e) => setAddContactData({ ...addContactData, last_name: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Job Title</label>
              <input
                type="text"
                value={addContactData.title}
                onChange={(e) => setAddContactData({ ...addContactData, title: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={addContactData.email}
                  onChange={(e) => setAddContactData({ ...addContactData, email: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone *</label>
                <input
                  type="tel"
                  value={addContactData.phone}
                  onChange={(e) => setAddContactData({ ...addContactData, phone: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={addContactData.is_primary}
                  onChange={(e) => setAddContactData({ ...addContactData, is_primary: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                Primary Contact
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={addContactData.is_decision_maker}
                  onChange={(e) => setAddContactData({ ...addContactData, is_decision_maker: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                Decision Maker
              </label>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowAddContactModal(false)} className="btn-outline" disabled={submitting}>
              Cancel
            </button>
            <button onClick={handleAddContact} className="btn-primary" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Contact"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Account Modal */}
      <Dialog open={showEditAccountModal} onOpenChange={setShowEditAccountModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <label className="text-sm font-medium">Company Name *</label>
              <input
                type="text"
                value={editAccountData.company_name}
                onChange={(e) => setEditAccountData({ ...editAccountData, company_name: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Domain</label>
                <input
                  type="text"
                  value={editAccountData.domain}
                  onChange={(e) => setEditAccountData({ ...editAccountData, domain: e.target.value })}
                  placeholder="company.com"
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Industry</label>
                <input
                  type="text"
                  value={editAccountData.industry}
                  onChange={(e) => setEditAccountData({ ...editAccountData, industry: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Primary Contact Name</label>
              <input
                type="text"
                value={editAccountData.pic_name}
                onChange={(e) => setEditAccountData({ ...editAccountData, pic_name: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <input
                  type="tel"
                  value={editAccountData.pic_phone}
                  onChange={(e) => setEditAccountData({ ...editAccountData, pic_phone: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={editAccountData.pic_email}
                  onChange={(e) => setEditAccountData({ ...editAccountData, pic_email: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Address</label>
              <input
                type="text"
                value={editAccountData.address}
                onChange={(e) => setEditAccountData({ ...editAccountData, address: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">City</label>
                <input
                  type="text"
                  value={editAccountData.city}
                  onChange={(e) => setEditAccountData({ ...editAccountData, city: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Country</label>
                <input
                  type="text"
                  value={editAccountData.country}
                  onChange={(e) => setEditAccountData({ ...editAccountData, country: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">NPWP (Tax ID)</label>
              <input
                type="text"
                value={editAccountData.npwp}
                onChange={(e) => setEditAccountData({ ...editAccountData, npwp: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowEditAccountModal(false)} className="btn-outline" disabled={submitting}>
              Cancel
            </button>
            <button onClick={handleEditAccount} className="btn-primary" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

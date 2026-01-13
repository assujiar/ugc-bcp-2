"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UserCheck,
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  Loader2,
  Briefcase,
  Clock,
  CheckCircle,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { pageLabels, actionLabels } from "@/lib/terminology/labels";
import { fetchJson, isSuccess } from "@/lib/api/fetchJson";
import { toastSuccess, toastError, toast } from "@/lib/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

interface MyLead {
  lead_id: string;
  company_name: string;
  pic_name: string;
  contact_phone: string;
  email: string;
  city_area: string | null;
  service_code: string | null;
  next_step: string | null;
  due_date: string | null;
  status: string;
  triage_status: string;
  opportunity_id: string | null;
  created_at: string;
  updated_at: string;
  owner?: { full_name: string } | null;
  service_catalog?: { service_name: string } | null;
}

interface OpportunityInfo {
  opportunity_id: string;
  name: string;
  stage: string;
  estimated_value: number | null;
}

export default function MyLeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = React.useState<MyLead[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [converting, setConverting] = React.useState<string | null>(null);

  const fetchLeads = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/leads?view=my_leads&pageSize=100");
      if (res.ok) {
        const data = await res.json();
        setLeads(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching my leads:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleConvertLead = async (lead: MyLead) => {
    setConverting(lead.lead_id);
    try {
      const result = await fetchJson<{
        success: boolean;
        lead_id: string;
        opportunity_id: string;
        account_id: string;
        activities_created: number;
        already_converted?: boolean;
        message: string;
      }>(`/api/crm/leads/${lead.lead_id}/convert`, {
        method: "POST",
        body: {
          next_step: "Initial contact call",
          next_step_due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        },
        showErrorToast: true,
        showSuccessToast: false,
      });

      if (isSuccess(result) && result.data.success) {
        const { opportunity_id, activities_created, already_converted } = result.data;

        toast({
          variant: "success",
          title: already_converted ? "Already Converted" : "Lead Converted Successfully",
          description: already_converted
            ? `${lead.company_name} was already converted. Redirecting to opportunity.`
            : `${lead.company_name} converted with ${activities_created} cadence activities.`,
          action: (
            <ToastAction
              altText="View Opportunity"
              onClick={() => router.push(`/crm/opportunities/${opportunity_id}`)}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View
            </ToastAction>
          ),
        });

        // Navigate to opportunity detail page
        router.push(`/crm/opportunities/${opportunity_id}`);
      }
    } catch (err) {
      console.error("Error converting lead:", err);
      toastError("Error", "Failed to convert lead");
    } finally {
      setConverting(null);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 skeleton" />
        <div className="h-24 skeleton rounded-xl" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Leads</h1>
          <p className="text-muted-foreground">
            Leads assigned to you that are being worked on
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLeads()}
            className="btn-outline h-9"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <Link href="/crm/sales-inbox" className="btn-primary h-9">
            <UserCheck className="h-4 w-4 mr-2" />
            Claim More Leads
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <UserCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{leads.length}</p>
            <p className="text-sm text-muted-foreground">Total Leads</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
            <Clock className="h-6 w-6 text-warning" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {leads.filter((l) => !l.opportunity_id).length}
            </p>
            <p className="text-sm text-muted-foreground">Awaiting Conversion</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
            <CheckCircle className="h-6 w-6 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {leads.filter((l) => l.opportunity_id).length}
            </p>
            <p className="text-sm text-muted-foreground">With Opportunity</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
            <Briefcase className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {leads.filter((l) => l.due_date && isOverdue(l.due_date)).length}
            </p>
            <p className="text-sm text-muted-foreground">Overdue</p>
          </div>
        </div>
      </div>

      {/* Leads List */}
      <div className="card-flush">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Your Assigned Leads
          </h2>
        </div>
        <div className="divide-y divide-border">
          {leads.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>No leads assigned to you</p>
              <p className="text-sm mt-2">
                <Link href="/crm/sales-inbox" className="text-primary hover:underline">
                  Claim leads from the Sales Pool
                </Link>{" "}
                to start working
              </p>
            </div>
          ) : (
            leads.map((lead) => (
              <div
                key={lead.lead_id}
                className="p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Lead Info */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary font-semibold text-lg">
                      {lead.company_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">
                          {lead.company_name}
                        </h3>
                        {lead.opportunity_id && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-success/10 text-success">
                            Has Opportunity
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{lead.pic_name}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                        {lead.contact_phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {lead.contact_phone}
                          </span>
                        )}
                        {lead.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {lead.email}
                          </span>
                        )}
                        {lead.city_area && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {lead.city_area}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Service & Next Step */}
                  <div className="flex-shrink-0 lg:text-right">
                    {lead.service_catalog?.service_name && (
                      <p className="text-sm font-medium text-foreground">
                        {lead.service_catalog.service_name}
                      </p>
                    )}
                    {lead.next_step && (
                      <p className="text-sm text-muted-foreground">
                        Next: {lead.next_step}
                      </p>
                    )}
                    {lead.due_date && (
                      <p
                        className={cn(
                          "text-xs mt-1",
                          isOverdue(lead.due_date)
                            ? "text-destructive"
                            : "text-muted-foreground"
                        )}
                      >
                        Due: {formatDate(lead.due_date)}
                        {isOverdue(lead.due_date) && " (Overdue)"}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {lead.opportunity_id ? (
                      <Link
                        href={`/crm/opportunities/${lead.opportunity_id}`}
                        className="btn-outline h-9 px-3"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Opportunity
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleConvertLead(lead)}
                        disabled={converting === lead.lead_id}
                        className="btn-primary h-9 px-3"
                      >
                        {converting === lead.lead_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <ArrowRight className="h-4 w-4 mr-2" />
                            Convert to Opportunity
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Supabase Database Types
 *
 * This file is generated from Supabase schema.
 * To regenerate: npx supabase gen types typescript --project-id <project-id>
 *
 * Updated for CRM Rebuild v3.0 - Account/Opportunity/Activity model
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// =========================
// ENUM TYPES
// =========================

export type DeptCode = "MKT" | "SAL" | "DOM" | "EXI" | "DTD" | "FIN" | "TRF" | "DIR";
export type LeadSourceBy = "Marketing" | "Sales";
export type PrimaryChannel =
  | "LinkedIn"
  | "SEM"
  | "Paid Social"
  | "Website (Direct/Referral)"
  | "Webinar & Live"
  | "Event Offline"
  | "Trade Show"
  | "Partnership/Referral"
  | "Sales Outbound"
  | "Sales Referral"
  | "Other";

// New CRM Enums
export type OpportunityStage =
  | "Prospecting"
  | "Discovery"
  | "Proposal Sent"
  | "Quote Sent"
  | "Negotiation"
  | "Verbal Commit"
  | "Closed Won"
  | "Closed Lost"
  | "On Hold";

export type LeadTriageStatus =
  | "New"
  | "In Review"
  | "Qualified"
  | "Nurture"
  | "Disqualified"
  | "Handed Over";

export type ActivityStatus = "Planned" | "Done" | "Cancelled";

export type ActivityTypeV2 =
  | "Call"
  | "Email"
  | "Visit"
  | "Online Meeting"
  | "WhatsApp"
  | "LinkedIn Message"
  | "Send Proposal"
  | "Send Quote"
  | "Follow Up"
  | "Internal Meeting"
  | "Other";

// Target status aligned with SSOT
export type TargetStatus =
  | "new_target"
  | "contacted"
  | "engaged"
  | "qualified"
  | "dropped"
  | "converted";

// Valid target status transitions (from -> to[])
export const TARGET_STATUS_TRANSITIONS: Record<TargetStatus, TargetStatus[]> = {
  new_target: ["contacted", "dropped"],
  contacted: ["engaged", "dropped"],
  engaged: ["qualified", "dropped"],
  qualified: ["converted", "dropped"],
  dropped: [], // Terminal state
  converted: [], // Terminal state
};

// Terminal states that cannot be changed
export const TARGET_TERMINAL_STATES: TargetStatus[] = ["dropped", "converted"];

export type TenureStatus =
  | "Prospect"
  | "New Customer"
  | "Active Customer"
  | "Winback Target";

export type AccountActivityStatus = "Active" | "Passive" | "Inactive";

// Legacy enums (kept for backward compatibility)
export type LeadStatus =
  | "New"
  | "Contacted"
  | "Qualified"
  | "Proposal"
  | "Negotiation"
  | "Closed Won"
  | "Closed Lost"
  | "Disqualified";
export type NextStep =
  | "Call"
  | "Email"
  | "Visit"
  | "Online Meeting"
  | "Send Proposal"
  | "Follow Up";

// Ticketing enums (unchanged)
export type TicketType =
  | "inquiry tariff"
  | "general request"
  | "request pickup"
  | "request delivery";
export type InquiryStatus =
  | "OPEN"
  | "WAITING RESPON"
  | "WAITING CUSTOMER"
  | "CLOSED"
  | "CLOSED LOST";
export type TicketStatus = "OPEN" | "IN PROGRESS" | "CLOSED";
export type ImportStatus = "UPLOADED" | "PROCESSING" | "COMPLETED" | "FAILED";
export type KpiCalcMethod = "AUTO" | "MANUAL" | "IMPORTED";
export type KpiDirection = "HIGHER_BETTER" | "LOWER_BETTER";

// =========================
// TABLE INTERFACES
// =========================

export interface Account {
  account_id: string;
  company_name: string;
  npwp: string | null;
  pic_name: string;
  pic_phone: string;
  pic_email: string;
  address: string | null;
  city: string | null;
  country: string | null;
  domain: string | null;
  industry: string | null;
  employee_count: string | null;
  annual_revenue: number | null;
  owner_user_id: string | null;
  parent_account_id: string | null;
  is_active: boolean;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  contact_id: string;
  account_id: string;
  first_name: string;
  last_name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  is_primary: boolean;
  is_decision_maker: boolean;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProspectingTarget {
  target_id: string;
  company_name: string;
  domain: string | null;
  industry: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  linkedin_url: string | null;
  city: string | null;
  notes: string | null;
  status: TargetStatus;
  owner_user_id: string | null;
  last_contacted_at: string | null;
  next_outreach_at: string | null;
  dedupe_key: string;
  converted_to_lead_id: string | null;
  converted_to_account_id: string | null;
  source: string | null;
  drop_reason: string | null;
  dropped_at: string | null;
  converted_at: string | null;
  import_batch_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ImportBatch {
  batch_id: string;
  source_name: string;
  file_hash: string;
  row_count: number;
  inserted: number;
  updated: number;
  failed: number;
  failed_rows: ImportFailedRow[];
  entity_type: string;
  created_by: string;
  created_at: string;
}

export interface ImportFailedRow {
  row_number: number;
  reason: string;
  data: Record<string, string>;
}

export interface Opportunity {
  opportunity_id: string;
  account_id: string;
  name: string;
  stage: OpportunityStage;
  owner_user_id: string;
  estimated_value: number | null;
  currency: string;
  probability: number | null;
  expected_close_date: string | null;
  service_codes: string[] | null;
  route: string | null;
  next_step: string;
  next_step_due_date: string;
  source_lead_id: string | null;
  source_target_id: string | null;
  lost_reason: string | null;
  competitor: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface OpportunityStageHistory {
  id: number;
  opportunity_id: string;
  from_stage: OpportunityStage | null;
  to_stage: OpportunityStage;
  changed_by: string;
  changed_at: string;
  notes: string | null;
}

export interface ShipmentProfile {
  profile_id: string;
  account_id: string;
  opportunity_id: string | null;
  name: string;
  origin_address: string | null;
  origin_city: string | null;
  origin_country: string;
  destination_address: string | null;
  destination_city: string | null;
  destination_country: string;
  cargo_type: string | null;
  avg_weight: number | null;
  avg_dimensions: string | null;
  frequency: string | null;
  special_requirements: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  activity_id: string;
  activity_type: ActivityTypeV2;
  status: ActivityStatus;
  subject: string;
  description: string | null;
  related_account_id: string | null;
  related_contact_id: string | null;
  related_opportunity_id: string | null;
  related_lead_id: string | null;
  related_target_id: string | null;
  scheduled_at: string | null;
  due_date: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  owner_user_id: string;
  outcome: string | null;
  duration_minutes: number | null;
  evidence_url: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  cadence_enrollment_id: number | null;
  cadence_step_number: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Cadence {
  cadence_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  owner_user_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CadenceStep {
  step_id: number;
  cadence_id: number;
  step_number: number;
  activity_type: ActivityTypeV2;
  subject_template: string;
  description_template: string | null;
  delay_days: number;
  created_at: string;
}

export interface CadenceEnrollment {
  enrollment_id: number;
  cadence_id: number;
  account_id: string | null;
  contact_id: string | null;
  opportunity_id: string | null;
  target_id: string | null;
  current_step: number;
  status: string;
  enrolled_by: string;
  enrolled_at: string;
  completed_at: string | null;
  stopped_at: string | null;
}

export interface Quote {
  quote_id: string;
  opportunity_id: string;
  account_id: string;
  version: number;
  status: string;
  valid_until: string | null;
  total_amount: number | null;
  currency: string;
  terms: string | null;
  notes: string | null;
  file_url: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLedger {
  ledger_id: number;
  account_id: string;
  invoice_id: string | null;
  invoice_date: string;
  amount: number;
  currency: string;
  status: string;
  paid_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadHandoverPool {
  handover_id: number;
  lead_id: string;
  handed_over_by: string;
  handed_over_at: string;
  claimed_by: string | null;
  claimed_at: string | null;
  notes: string | null;
  priority: number;
  expires_at: string | null;
}

export interface Lead {
  lead_id: string;
  lead_date: string;
  company_name: string;
  pic_name: string;
  contact_phone: string;
  email: string;
  city_area: string;
  service_code: string;
  route: string | null;
  est_volume_value: number | null;
  est_volume_unit: string | null;
  timeline: string | null;
  sourced_by: LeadSourceBy;
  primary_channel: PrimaryChannel;
  campaign_name: string | null;
  notes: string | null;
  sales_owner_user_id: string | null;
  customer_id: string | null; // Legacy, points to account_id
  prospect_id: string | null; // Legacy
  opportunity_id: string | null;
  status: LeadStatus;
  next_step: NextStep;
  due_date: string;
  triage_status: LeadTriageStatus;
  handover_eligible: boolean;
  handover_notes: string | null;
  dedupe_key: string | null;
  dedupe_suggestions: Json | null;
  sla_deadline: string | null;
  qualified_at: string | null;
  disqualified_at: string | null;
  disqualified_reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// =========================
// DATABASE INTERFACE
// =========================

export interface Database {
  public: {
    Tables: {
      roles: {
        Row: {
          role_name: string;
          created_at: string;
        };
        Insert: {
          role_name: string;
          created_at?: string;
        };
        Update: {
          role_name?: string;
          created_at?: string;
        };
      };
      departments: {
        Row: {
          dept_code: DeptCode;
          dept_name: string;
          created_at: string;
        };
        Insert: {
          dept_code: DeptCode;
          dept_name: string;
          created_at?: string;
        };
        Update: {
          dept_code?: DeptCode;
          dept_name?: string;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          user_id: string;
          user_code: string;
          full_name: string;
          role_name: string;
          dept_code: DeptCode;
          manager_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          user_code: string;
          full_name: string;
          role_name: string;
          dept_code: DeptCode;
          manager_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          user_code?: string;
          full_name?: string;
          role_name?: string;
          dept_code?: DeptCode;
          manager_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      accounts: {
        Row: Account;
        Insert: Partial<Account> & { company_name: string; pic_name: string; pic_phone: string; pic_email: string };
        Update: Partial<Account>;
      };
      contacts: {
        Row: Contact;
        Insert: Partial<Contact> & { account_id: string; first_name: string; created_by: string };
        Update: Partial<Contact>;
      };
      prospecting_targets: {
        Row: ProspectingTarget;
        Insert: Partial<ProspectingTarget> & { company_name: string; dedupe_key: string; created_by: string };
        Update: Partial<ProspectingTarget>;
      };
      opportunities: {
        Row: Opportunity;
        Insert: Partial<Opportunity> & { account_id: string; name: string; owner_user_id: string; next_step: string; next_step_due_date: string; created_by: string };
        Update: Partial<Opportunity>;
      };
      activities: {
        Row: Activity;
        Insert: Partial<Activity> & { activity_type: ActivityTypeV2; subject: string; owner_user_id: string; created_by: string };
        Update: Partial<Activity>;
      };
      cadences: {
        Row: Cadence;
        Insert: Partial<Cadence> & { name: string; created_by: string };
        Update: Partial<Cadence>;
      };
      cadence_steps: {
        Row: CadenceStep;
        Insert: Partial<CadenceStep> & { cadence_id: number; step_number: number; activity_type: ActivityTypeV2; subject_template: string };
        Update: Partial<CadenceStep>;
      };
      cadence_enrollments: {
        Row: CadenceEnrollment;
        Insert: Partial<CadenceEnrollment> & { cadence_id: number; enrolled_by: string };
        Update: Partial<CadenceEnrollment>;
      };
      quotes: {
        Row: Quote;
        Insert: Partial<Quote> & { opportunity_id: string; account_id: string; created_by: string };
        Update: Partial<Quote>;
      };
      invoice_ledger: {
        Row: InvoiceLedger;
        Insert: Partial<InvoiceLedger> & { account_id: string; invoice_date: string; amount: number };
        Update: Partial<InvoiceLedger>;
      };
      lead_handover_pool: {
        Row: LeadHandoverPool;
        Insert: Partial<LeadHandoverPool> & { lead_id: string; handed_over_by: string };
        Update: Partial<LeadHandoverPool>;
      };
      leads: {
        Row: Lead;
        Insert: Partial<Lead> & {
          company_name: string;
          pic_name: string;
          contact_phone: string;
          email: string;
          city_area: string;
          service_code: string;
          sourced_by: LeadSourceBy;
          primary_channel: PrimaryChannel;
          next_step: NextStep;
          due_date: string;
          created_by: string;
        };
        Update: Partial<Lead>;
      };
      tickets: {
        Row: {
          ticket_id: string;
          ticket_type: TicketType;
          inquiry_status: InquiryStatus | null;
          ticket_status: TicketStatus | null;
          dept_target: DeptCode;
          service_code: string | null;
          created_by: string;
          assigned_to: string | null;
          related_lead_id: string | null;
          related_account_id: string | null;
          subject: string;
          description: string | null;
          origin_address: string | null;
          origin_city: string | null;
          origin_country: string | null;
          destination_address: string | null;
          destination_city: string | null;
          destination_country: string | null;
          cargo_category: string | null;
          cargo_qty: number | null;
          cargo_dimensions: string | null;
          cargo_weight: number | null;
          scope_of_work: string | null;
          need_customer_masking: boolean;
          close_reason: string | null;
          competitor_rate: number | null;
          customer_budget: number | null;
          created_at: string;
          updated_at: string;
          closed_at: string | null;
        };
        Insert: {
          ticket_id?: string;
          ticket_type: TicketType;
          inquiry_status?: InquiryStatus | null;
          ticket_status?: TicketStatus | null;
          dept_target: DeptCode;
          service_code?: string | null;
          created_by: string;
          assigned_to?: string | null;
          related_lead_id?: string | null;
          related_account_id?: string | null;
          subject: string;
          description?: string | null;
          origin_address?: string | null;
          origin_city?: string | null;
          origin_country?: string | null;
          destination_address?: string | null;
          destination_city?: string | null;
          destination_country?: string | null;
          cargo_category?: string | null;
          cargo_qty?: number | null;
          cargo_dimensions?: string | null;
          cargo_weight?: number | null;
          scope_of_work?: string | null;
          need_customer_masking?: boolean;
          close_reason?: string | null;
          competitor_rate?: number | null;
          customer_budget?: number | null;
          created_at?: string;
          updated_at?: string;
          closed_at?: string | null;
        };
        Update: {
          ticket_id?: string;
          ticket_type?: TicketType;
          inquiry_status?: InquiryStatus | null;
          ticket_status?: TicketStatus | null;
          dept_target?: DeptCode;
          service_code?: string | null;
          created_by?: string;
          assigned_to?: string | null;
          related_lead_id?: string | null;
          related_account_id?: string | null;
          subject?: string;
          description?: string | null;
          origin_address?: string | null;
          origin_city?: string | null;
          origin_country?: string | null;
          destination_address?: string | null;
          destination_city?: string | null;
          destination_country?: string | null;
          cargo_category?: string | null;
          cargo_qty?: number | null;
          cargo_dimensions?: string | null;
          cargo_weight?: number | null;
          scope_of_work?: string | null;
          need_customer_masking?: boolean;
          close_reason?: string | null;
          competitor_rate?: number | null;
          customer_budget?: number | null;
          created_at?: string;
          updated_at?: string;
          closed_at?: string | null;
        };
      };
      invoices: {
        Row: {
          invoice_id: string;
          account_id: string;
          invoice_date: string;
          due_date: string;
          invoice_amount: number;
          currency: string;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          invoice_id?: string;
          account_id: string;
          invoice_date: string;
          due_date: string;
          invoice_amount: number;
          currency?: string;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          invoice_id?: string;
          account_id?: string;
          invoice_date?: string;
          due_date?: string;
          invoice_amount?: number;
          currency?: string;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      payments: {
        Row: {
          payment_id: number;
          invoice_id: string;
          payment_date: string;
          amount: number;
          payment_method: string | null;
          reference_no: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          payment_id?: number;
          invoice_id: string;
          payment_date: string;
          amount: number;
          payment_method?: string | null;
          reference_no?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          payment_id?: number;
          invoice_id?: string;
          payment_date?: string;
          amount?: number;
          payment_method?: string | null;
          reference_no?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      v_accounts_enriched: {
        Row: Account & {
          first_invoice_at: string | null;
          last_invoice_at: string | null;
          total_invoices: number;
          lifetime_value: number;
          tenure_status: TenureStatus;
          activity_status: AccountActivityStatus;
          winback_start_at: string | null;
        };
      };
      v_pipeline_summary: {
        Row: {
          stage: OpportunityStage;
          opportunity_count: number;
          total_value: number;
          avg_probability: number;
        };
      };
      v_sales_inbox: {
        Row: Activity & {
          opportunity_name: string | null;
          opportunity_stage: OpportunityStage | null;
          account_name: string | null;
        };
      };
      v_lead_inbox: {
        Row: Lead & {
          is_sla_breached: boolean;
          hours_to_sla: number;
        };
      };
      v_ops_rfqs_masked: {
        Row: {
          ticket_id: string;
          ticket_type: TicketType;
          inquiry_status: InquiryStatus | null;
          dept_target: DeptCode;
          created_by: string;
          assigned_to: string | null;
          related_lead_id: string | null;
          related_account_id: string | null;
          subject: string;
          description: string | null;
          service_code: string | null;
          created_at: string;
          closed_at: string | null;
          is_masked: boolean;
          customer_company_name: string;
          customer_pic_name: string;
          customer_pic_phone: string;
          customer_pic_email: string;
        };
      };
      v_invoice_outstanding: {
        Row: {
          invoice_id: string;
          account_id: string;
          invoice_date: string;
          due_date: string;
          invoice_amount: number;
          paid_amount: number;
          outstanding_amount: number;
          is_overdue: boolean;
          days_past_due: number;
        };
      };
      v_ar_aging: {
        Row: {
          account_id: string;
          ar_total: number;
          bucket_1_30: number;
          bucket_31_60: number;
          bucket_61_90: number;
          bucket_90_plus: number;
        };
      };
    };
    Functions: {
      rpc_sales_quick_add_prospect: {
        Args: {
          p_idempotency_key: string;
          p_company_name: string;
          p_contact_first_name: string;
          p_contact_last_name?: string | null;
          p_contact_email?: string | null;
          p_contact_phone?: string | null;
          p_service_codes?: string[] | null;
          p_route?: string | null;
          p_estimated_value?: number | null;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      rpc_target_convert_to_lead: {
        Args: {
          p_idempotency_key: string;
          p_target_id: string;
          p_service_code?: string | null;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      rpc_lead_handover_to_sales_pool: {
        Args: {
          p_idempotency_key: string;
          p_lead_id: string;
          p_notes?: string | null;
          p_priority?: number;
        };
        Returns: Json;
      };
      rpc_sales_claim_lead: {
        Args: {
          p_idempotency_key: string;
          p_lead_id?: string | null;
        };
        Returns: Json;
      };
      rpc_opportunity_change_stage: {
        Args: {
          p_idempotency_key: string;
          p_opportunity_id: string;
          p_new_stage: OpportunityStage;
          p_next_step: string;
          p_next_step_due_date: string;
          p_lost_reason?: string | null;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      rpc_activity_complete_and_next: {
        Args: {
          p_idempotency_key: string;
          p_activity_id: string;
          p_outcome?: string | null;
          p_duration_minutes?: number | null;
          p_create_next?: boolean;
          p_next_activity_type?: ActivityTypeV2;
          p_next_subject?: string | null;
          p_next_due_date?: string | null;
        };
        Returns: Json;
      };
      rpc_account_merge: {
        Args: {
          p_idempotency_key: string;
          p_source_account_id: string;
          p_target_account_id: string;
          p_notes?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      dept_code: DeptCode;
      lead_source_by: LeadSourceBy;
      primary_channel: PrimaryChannel;
      opportunity_stage: OpportunityStage;
      lead_triage_status: LeadTriageStatus;
      activity_status: ActivityStatus;
      activity_type_v2: ActivityTypeV2;
      target_status: TargetStatus;
      tenure_status: TenureStatus;
      account_activity_status: AccountActivityStatus;
      lead_status: LeadStatus;
      next_step: NextStep;
      ticket_type: TicketType;
      inquiry_status: InquiryStatus;
      ticket_status: TicketStatus;
      import_status: ImportStatus;
      kpi_calc_method: KpiCalcMethod;
      kpi_direction: KpiDirection;
    };
  };
}

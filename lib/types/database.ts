/**
 * Supabase Database Types
 * 
 * This file is generated from Supabase schema.
 * To regenerate: npx supabase gen types typescript --project-id <project-id>
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Enum Types (LOCKED - DO NOT MODIFY)
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
export type ProspectStage =
  | "Prospect Created"
  | "Initial Contact"
  | "Need Analysis"
  | "Proposal Sent"
  | "Negotiation"
  | "Closed Won"
  | "Closed Lost"
  | "Nurturing";
export type ActivityType =
  | "Visit"
  | "Call"
  | "Online Meeting"
  | "Email"
  | "WhatsApp/Chat Outbound";
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
      customers: {
        Row: {
          customer_id: string;
          company_name: string;
          npwp: string | null;
          pic_name: string;
          pic_phone: string;
          pic_email: string;
          address: string | null;
          city: string | null;
          country: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          customer_id?: string;
          company_name: string;
          npwp?: string | null;
          pic_name: string;
          pic_phone: string;
          pic_email: string;
          address?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          customer_id?: string;
          company_name?: string;
          npwp?: string | null;
          pic_name?: string;
          pic_phone?: string;
          pic_email?: string;
          address?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      leads: {
        Row: {
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
          customer_id: string | null;
          prospect_id: string | null;
          status: LeadStatus;
          next_step: NextStep;
          due_date: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          lead_id?: string;
          lead_date?: string;
          company_name: string;
          pic_name: string;
          contact_phone: string;
          email: string;
          city_area: string;
          service_code: string;
          route?: string | null;
          est_volume_value?: number | null;
          est_volume_unit?: string | null;
          timeline?: string | null;
          sourced_by: LeadSourceBy;
          primary_channel: PrimaryChannel;
          campaign_name?: string | null;
          notes?: string | null;
          sales_owner_user_id?: string | null;
          customer_id?: string | null;
          prospect_id?: string | null;
          status?: LeadStatus;
          next_step: NextStep;
          due_date: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          lead_id?: string;
          lead_date?: string;
          company_name?: string;
          pic_name?: string;
          contact_phone?: string;
          email?: string;
          city_area?: string;
          service_code?: string;
          route?: string | null;
          est_volume_value?: number | null;
          est_volume_unit?: string | null;
          timeline?: string | null;
          sourced_by?: LeadSourceBy;
          primary_channel?: PrimaryChannel;
          campaign_name?: string | null;
          notes?: string | null;
          sales_owner_user_id?: string | null;
          customer_id?: string | null;
          prospect_id?: string | null;
          status?: LeadStatus;
          next_step?: NextStep;
          due_date?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
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
          related_customer_id: string | null;
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
          related_customer_id?: string | null;
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
          related_customer_id?: string | null;
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
          customer_id: string;
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
          customer_id: string;
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
          customer_id?: string;
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
      v_ops_rfqs_masked: {
        Row: {
          ticket_id: string;
          ticket_type: TicketType;
          inquiry_status: InquiryStatus | null;
          dept_target: DeptCode;
          created_by: string;
          assigned_to: string | null;
          related_lead_id: string | null;
          related_customer_id: string | null;
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
          customer_id: string;
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
          customer_id: string;
          ar_total: number;
          bucket_1_30: number;
          bucket_31_60: number;
          bucket_61_90: number;
          bucket_90_plus: number;
        };
      };
    };
    Functions: {
      find_or_create_customer: {
        Args: {
          p_company_name: string;
          p_npwp: string | null;
          p_pic_name: string;
          p_pic_phone: string;
          p_pic_email: string;
          p_city?: string | null;
          p_country?: string | null;
        };
        Returns: string;
      };
      find_or_create_prospect: {
        Args: {
          p_customer_id: string;
          p_owner_user_id: string;
        };
        Returns: string;
      };
    };
    Enums: {
      dept_code: DeptCode;
      lead_source_by: LeadSourceBy;
      primary_channel: PrimaryChannel;
      lead_status: LeadStatus;
      next_step: NextStep;
      prospect_stage: ProspectStage;
      activity_type: ActivityType;
      ticket_type: TicketType;
      inquiry_status: InquiryStatus;
      ticket_status: TicketStatus;
      import_status: ImportStatus;
      kpi_calc_method: KpiCalcMethod;
      kpi_direction: KpiDirection;
    };
  };
}

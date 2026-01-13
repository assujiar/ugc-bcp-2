import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { z } from "zod";
import { apiSuccess, apiErrors } from "@/lib/api/error";

// Enum values matching database exactly
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
] as const;

const NEXT_STEPS = [
  "Call",
  "Email",
  "Visit",
  "Online Meeting",
  "Send Proposal",
  "Follow Up",
] as const;

const SOURCED_BY = ["Marketing", "Sales"] as const;

const createLeadSchema = z.object({
  // Required fields
  company_name: z.string().min(1, "Company name is required"),
  pic_name: z.string().min(1, "PIC name is required"),
  contact_phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Invalid email format"),
  city_area: z.string().min(1, "City/Area is required"),
  service_code: z.string().min(1, "Service is required"),
  sourced_by: z.enum(SOURCED_BY),
  primary_channel: z.enum(PRIMARY_CHANNELS),
  next_step: z.enum(NEXT_STEPS),
  due_date: z.string().min(1, "Due date is required"),

  // Optional fields
  lead_date: z.string().optional(),
  route: z.string().optional().nullable(),
  est_volume_value: z.number().optional().nullable(),
  est_volume_unit: z.string().optional().nullable(),
  timeline: z.string().optional().nullable(),
  campaign_name: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET /api/crm/leads - List leads with triage status
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return apiErrors.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "50", 10);
    const triageStatus = searchParams.get("triage_status");
    const search = searchParams.get("search");
    const view = searchParams.get("view"); // inbox, all, handover_pool

    let query = supabase
      .from("leads")
      .select(
        `
        *,
        service:service_catalog(service_code, service_name, scope_group),
        owner:profiles!leads_sales_owner_user_id_fkey (user_id, full_name, role_name),
        created_by_profile:profiles!leads_created_by_fkey (full_name)
      `,
        { count: "exact" }
      );

    // Apply view filters (SSOT-aligned state→destination mapping)
    if (view === "inbox") {
      // Lead Inbox (Triage Queue): Shows New & In Review leads
      query = query.in("triage_status", ["New", "In Review"]);
    } else if (view === "handover_pool") {
      // Sales Pool: Handed over leads awaiting claim (sales_owner IS NULL)
      query = query.eq("triage_status", "Handed Over");
      query = query.is("sales_owner_user_id", null);
    } else if (view === "my_leads") {
      // My Leads: Claimed leads assigned to current user (not yet fully converted)
      query = query.eq("sales_owner_user_id", profile.user_id);
      query = query.not("status", "in", '("Closed Won","Closed Lost")');
    } else if (view === "nurture") {
      // Nurture leads: available in Lead Inbox nurture tab
      query = query.eq("triage_status", "Nurture");
    } else if (view === "disqualified") {
      // Disqualified leads: available for reference
      query = query.eq("triage_status", "Disqualified");
    } else if (view === "qualified") {
      // Qualified but not yet handed over (edge case fallback)
      query = query.eq("triage_status", "Qualified");
      query = query.eq("handover_eligible", true);
    } else if (view === "all") {
      // All leads visible to user (for admin/reporting)
      // No additional filter - RLS handles access
    }

    // Apply triage status filter
    if (triageStatus) {
      query = query.eq("triage_status", triageStatus);
    }

    // Apply search
    if (search) {
      query = query.or(
        `company_name.ilike.%${search}%,pic_name.ilike.%${search}%,email.ilike.%${search}%,lead_id.ilike.%${search}%`
      );
    }

    // Order by SLA deadline (urgent first), then created_at
    query = query.order("sla_deadline", { ascending: true, nullsFirst: false });
    query = query.order("created_at", { ascending: false });

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching leads:", error);
      return apiErrors.internal(error.message);
    }

    return apiSuccess({
      data,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    console.error("Error in GET /api/crm/leads:", error);
    return apiErrors.internal();
  }
}

// POST /api/crm/leads - Create new lead (intake)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return apiErrors.unauthorized();
    }

    const body = await request.json();
    const validation = createLeadSchema.safeParse(body);

    if (!validation.success) {
      console.error("Validation errors:", validation.error.issues);
      return apiErrors.validation("Validation error", validation.error.issues);
    }

    const leadData = validation.data;

    // Calculate SLA deadline (24 hours for new leads)
    const slaDeadline = new Date();
    slaDeadline.setHours(slaDeadline.getHours() + 24);

    // Generate dedupe key: normalized company name + phone digits
    const normalizedCompany = leadData.company_name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const phoneDigits = leadData.contact_phone.replace(/\D/g, "");
    const dedupeKey = `${normalizedCompany}-${phoneDigits}`;

    // Check for duplicates
    const { data: existingLeads } = await supabase
      .from("leads")
      .select("lead_id, company_name, pic_name, email, created_at")
      .eq("dedupe_key", dedupeKey)
      .limit(5);

    // Prepare insert data - only include non-null optional fields
    const insertData: Record<string, unknown> = {
      company_name: leadData.company_name,
      pic_name: leadData.pic_name,
      contact_phone: leadData.contact_phone,
      email: leadData.email,
      city_area: leadData.city_area,
      service_code: leadData.service_code,
      sourced_by: leadData.sourced_by,
      primary_channel: leadData.primary_channel,
      next_step: leadData.next_step,
      due_date: leadData.due_date,
      created_by: profile.user_id,
      triage_status: "New",
      status: "New",
      sla_deadline: slaDeadline.toISOString(),
      dedupe_key: dedupeKey,
    };

    // Add optional fields only if they have values
    if (leadData.lead_date) {
      insertData.lead_date = leadData.lead_date;
    }
    if (leadData.route) {
      insertData.route = leadData.route;
    }
    if (leadData.est_volume_value !== null && leadData.est_volume_value !== undefined) {
      insertData.est_volume_value = leadData.est_volume_value;
    }
    if (leadData.est_volume_unit) {
      insertData.est_volume_unit = leadData.est_volume_unit;
    }
    if (leadData.timeline) {
      insertData.timeline = leadData.timeline;
    }
    if (leadData.campaign_name) {
      insertData.campaign_name = leadData.campaign_name;
    }
    if (leadData.notes) {
      insertData.notes = leadData.notes;
    }

    // Add dedupe suggestions if duplicates found
    if (existingLeads && existingLeads.length > 0) {
      insertData.dedupe_suggestions = existingLeads;
    }

    const { data: lead, error } = await supabase
      .from("leads")
      .insert(insertData)
      .select(
        `
        *,
        service:service_catalog(service_code, service_name)
      `
      )
      .single();

    if (error) {
      console.error("Error creating lead:", error);
      // Check for specific constraint errors
      if (error.code === "23503") {
        // Foreign key violation
        if (error.message.includes("service_code")) {
          return apiErrors.validation("Invalid service code", [
            { path: ["service_code"], message: "Selected service does not exist" },
          ]);
        }
      }
      return apiErrors.internal(error.message);
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "leads",
      record_id: lead.lead_id,
      action: "INSERT",
      changed_by: profile.user_id,
      after_data: lead,
    });

    return apiSuccess({
      data: {
        lead,
        hasDuplicates: existingLeads && existingLeads.length > 0,
        duplicates: existingLeads || [],
      },
      status: 201,
    });
  } catch (error) {
    console.error("Error in POST /api/crm/leads:", error);
    return apiErrors.internal();
  }
}

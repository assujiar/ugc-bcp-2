import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { z } from "zod";

const createLeadSchema = z.object({
  company_name: z.string().min(1),
  pic_name: z.string().min(1),
  contact_phone: z.string().min(1),
  email: z.string().email(),
  city_area: z.string().min(1),
  service_code: z.string().min(1),
  route: z.string().optional(),
  est_volume_value: z.number().optional(),
  est_volume_unit: z.string().optional(),
  timeline: z.string().optional(),
  sourced_by: z.enum(["Marketing", "Sales"]),
  primary_channel: z.enum([
    "LinkedIn", "SEM", "Paid Social", "Website (Direct/Referral)",
    "Webinar & Live", "Event Offline", "Trade Show", "Partnership/Referral",
    "Sales Outbound", "Sales Referral", "Other"
  ]),
  campaign_name: z.string().optional(),
  notes: z.string().optional(),
  next_step: z.enum(["Call", "Email", "Visit", "Online Meeting", "Send Proposal", "Follow Up"]),
  due_date: z.string(),
});

// GET /api/crm/leads - List leads with triage status
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "50", 10);
    const triageStatus = searchParams.get("triage_status");
    const search = searchParams.get("search");
    const view = searchParams.get("view"); // inbox, all, handover_pool

    let query = supabase
      .from("leads")
      .select(`
        *,
        owner:profiles!leads_sales_owner_user_id_fkey (user_id, full_name, role_name),
        created_by_profile:profiles!leads_created_by_fkey (full_name)
      `, { count: "exact" });

    // Apply view filters (SSOT-aligned state→destination mapping)
    if (view === "inbox") {
      // Lead Inbox (Triage Queue): Shows New & In Review leads
      query = query.in("triage_status", ["New", "In Review"]);
    } else if (view === "handover_pool") {
      // Sales Pool: Handed over leads awaiting claim (sales_owner IS NULL)
      query = query.eq("triage_status", "Handed Over");
      query = query.is("sales_owner_user_id", null);
    } else if (view === "my_leads") {
      // My Leads: Claimed leads assigned to current user (not yet converted)
      query = query.eq("sales_owner_user_id", profile.user_id);
      query = query.neq("status", "converted");
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
      query = query.or(`company_name.ilike.%${search}%,pic_name.ilike.%${search}%,email.ilike.%${search}%`);
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/crm/leads - Create new lead (intake)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createLeadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: "Validation error",
        details: validation.error.issues
      }, { status: 400 });
    }

    const leadData = validation.data;

    // Calculate SLA deadline (24 hours for new leads)
    const slaDeadline = new Date();
    slaDeadline.setHours(slaDeadline.getHours() + 24);

    // Generate dedupe key
    const dedupeKey = `${leadData.company_name.toLowerCase().replace(/\s+/g, '')}-${leadData.contact_phone.replace(/\D/g, '')}`;

    // Check for duplicates
    const { data: existingLeads } = await supabase
      .from("leads")
      .select("lead_id, company_name, pic_name")
      .eq("dedupe_key", dedupeKey)
      .limit(5);

    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        ...leadData,
        created_by: profile.user_id,
        triage_status: "New",
        sla_deadline: slaDeadline.toISOString(),
        dedupe_key: dedupeKey,
        dedupe_suggestions: existingLeads && existingLeads.length > 0 ? existingLeads : null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating lead:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "leads",
      record_id: lead.lead_id,
      action: "INSERT",
      changed_by: profile.user_id,
      after_data: lead,
    });

    return NextResponse.json({
      lead,
      hasDuplicates: existingLeads && existingLeads.length > 0,
      duplicates: existingLeads
    }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/crm/leads:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

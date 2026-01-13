import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { apiSuccess, apiErrors } from "@/lib/api/error";

const OPPORTUNITY_STAGES = [
  "Prospecting", "Discovery", "Proposal Sent", "Quote Sent",
  "Negotiation", "Verbal Commit", "Closed Won", "Closed Lost", "On Hold"
] as const;

const createOpportunitySchema = z.object({
  account_id: z.string(),
  name: z.string().min(1),
  stage: z.enum(OPPORTUNITY_STAGES).optional(),
  estimated_value: z.number().optional(),
  currency: z.string().optional(),
  probability: z.number().min(0).max(100).optional(),
  expected_close_date: z.string().optional(),
  service_codes: z.array(z.string()).optional(),
  route: z.string().optional(),
  next_step: z.string().min(1),
  next_step_due_date: z.string(),
  notes: z.string().optional(),
});

// GET /api/crm/opportunities - List opportunities (pipeline)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return apiErrors.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "100", 10);
    const stage = searchParams.get("stage");
    const ownerId = searchParams.get("owner_id");
    const accountId = searchParams.get("account_id");
    const view = searchParams.get("view"); // pipeline, my_overdue

    let query = supabase
      .from("opportunities")
      .select(`
        *,
        account:accounts!opportunities_account_id_fkey (account_id, company_name, city),
        owner:profiles!opportunities_owner_user_id_fkey (user_id, full_name, role_name)
      `, { count: "exact" });

    // Apply view filters
    if (view === "pipeline") {
      query = query.not("stage", "in", "(\"Closed Won\",\"Closed Lost\")");
    } else if (view === "my_overdue") {
      query = query
        .eq("owner_user_id", profile.user_id)
        .lt("next_step_due_date", new Date().toISOString().split("T")[0])
        .not("stage", "in", "(\"Closed Won\",\"Closed Lost\")");
    }

    // Apply filters
    if (stage) {
      query = query.eq("stage", stage);
    }
    if (ownerId) {
      query = query.eq("owner_user_id", ownerId);
    }
    if (accountId) {
      query = query.eq("account_id", accountId);
    }

    // Order by next step due date
    query = query.order("next_step_due_date", { ascending: true });

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching opportunities:", error);
      // Return empty result if table doesn't exist (graceful degradation)
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return apiSuccess({
          data: [],
          pagination: {
            page,
            pageSize,
            total: 0,
            totalPages: 0,
          },
        });
      }
      return apiErrors.internal(error.message);
    }

    // Get pipeline summary if requesting pipeline view
    let pipelineSummary = null;
    if (view === "pipeline") {
      const { data: summary } = await supabase
        .from("v_pipeline_summary")
        .select("*");
      pipelineSummary = summary;
    }

    return apiSuccess({
      data,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
      meta: pipelineSummary ? { pipelineSummary } : undefined,
    });
  } catch (error) {
    console.error("Error in GET /api/crm/opportunities:", error);
    // Return empty result on any error (graceful degradation)
    return apiSuccess({
      data: [],
      pagination: {
        page: 1,
        pageSize: 100,
        total: 0,
        totalPages: 0,
      },
    });
  }
}

// POST /api/crm/opportunities - Create opportunity (via quick add)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return apiErrors.unauthorized();
    }

    const body = await request.json();

    // Check if this is a quick add (creates account + opportunity)
    if (body.quick_add) {
      const idempotencyKey = `quick-add-${uuidv4()}`;

      const { data, error } = await supabase.rpc("rpc_sales_quick_add_prospect", {
        p_idempotency_key: idempotencyKey,
        p_company_name: body.company_name,
        p_contact_first_name: body.contact_first_name,
        p_contact_last_name: body.contact_last_name,
        p_contact_email: body.contact_email,
        p_contact_phone: body.contact_phone,
        p_service_codes: body.service_codes,
        p_route: body.route,
        p_estimated_value: body.estimated_value,
        p_notes: body.notes,
      });

      if (error) {
        console.error("Error in quick add RPC:", error);
        return apiErrors.internal(error.message);
      }

      return apiSuccess({ data, status: 201 });
    }

    // Standard opportunity creation
    const validation = createOpportunitySchema.safeParse(body);

    if (!validation.success) {
      return apiErrors.validation("Validation error", validation.error.issues);
    }

    const oppData = validation.data;

    const { data: opportunity, error } = await supabase
      .from("opportunities")
      .insert({
        ...oppData,
        stage: oppData.stage || "Prospecting",
        owner_user_id: profile.user_id,
        created_by: profile.user_id,
      })
      .select(`
        *,
        account:accounts!opportunities_account_id_fkey (account_id, company_name)
      `)
      .single();

    if (error) {
      console.error("Error creating opportunity:", error);
      return apiErrors.internal(error.message);
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "opportunities",
      record_id: opportunity.opportunity_id,
      action: "INSERT",
      changed_by: profile.user_id,
      after_data: opportunity,
    });

    return apiSuccess({ data: { opportunity }, status: 201 });
  } catch (error) {
    console.error("Error in POST /api/crm/opportunities:", error);
    return apiErrors.internal();
  }
}

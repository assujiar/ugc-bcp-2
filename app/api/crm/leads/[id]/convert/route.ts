import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import {
  generateCorrelationId,
  apiSuccess,
  unauthorizedError,
  notFoundError,
  rbacDenyError,
  zodValidationError,
  conflictError,
  databaseError,
  internalError,
  ERROR_CODES,
} from "@/lib/api/error";
import { hasRole, ALL_SALES_ROLES, ROLE_GROUPS } from "@/lib/api/validation";

// Validation schema for conversion
const convertLeadSchema = z.object({
  next_step: z.string().min(1, "Next step is required"),
  next_step_due_date: z.string().min(1, "Due date is required"),
  estimated_value: z.number().optional(),
  notes: z.string().optional(),
});

// POST /api/crm/leads/[id]/convert - Convert claimed lead to opportunity + seed cadence
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = generateCorrelationId();

  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return unauthorizedError("Authentication required", correlationId);
    }

    // Check if user is sales team
    if (!hasRole(profile, [...ALL_SALES_ROLES, ...ROLE_GROUPS.SUPER_ADMIN])) {
      return rbacDenyError(
        "Only sales team can convert leads to opportunities",
        correlationId
      );
    }

    const { id } = await params;
    const body = await request.json();
    const validation = convertLeadSchema.safeParse(body);

    if (!validation.success) {
      return zodValidationError(validation.error, correlationId);
    }

    const { next_step, next_step_due_date, estimated_value, notes } = validation.data;

    // ==========================================
    // Fetch the lead and validate state
    // ==========================================

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("lead_id", id)
      .single();

    if (leadError || !lead) {
      return notFoundError("Lead", correlationId);
    }

    // Check if lead is claimed by current user
    if (lead.sales_owner_user_id !== profile.user_id && !hasRole(profile, ROLE_GROUPS.SUPER_ADMIN)) {
      return rbacDenyError(
        "You can only convert leads that you have claimed",
        correlationId
      );
    }

    // Check if already converted (idempotency)
    if (lead.status === "converted" && lead.linked_opportunity_id) {
      // Return existing opportunity info (idempotent)
      return apiSuccess({
        data: {
          success: true,
          idempotent: true,
          lead_id: lead.lead_id,
          opportunity_id: lead.linked_opportunity_id,
          account_id: lead.linked_account_id,
          message: "Lead was already converted",
        },
        correlationId,
      });
    }

    // Check if lead is in a valid state for conversion
    const validConversionStates = ["Handed Over", "Qualified"];
    if (!validConversionStates.includes(lead.triage_status) && lead.status !== "claimed") {
      return conflictError(
        `Lead must be claimed or qualified before conversion. Current status: ${lead.triage_status}`,
        ERROR_CODES.INVALID_STATE_TRANSITION,
        correlationId
      );
    }

    // ==========================================
    // Generate idempotency key for atomic operation
    // ==========================================

    const idempotencyKey = `convert-${id}-${profile.user_id}-${uuidv4()}`;

    // ==========================================
    // Create or get account
    // ==========================================

    let accountId = lead.linked_account_id;

    if (!accountId) {
      // Check if account already exists (by company name)
      const { data: existingAccount } = await supabase
        .from("accounts")
        .select("account_id")
        .ilike("company_name", lead.company_name)
        .limit(1)
        .single();

      if (existingAccount) {
        accountId = existingAccount.account_id;
      } else {
        // Create new account
        const { data: newAccount, error: accountError } = await supabase
          .from("accounts")
          .insert({
            company_name: lead.company_name,
            pic_name: lead.pic_name,
            pic_phone: lead.contact_phone,
            pic_email: lead.email,
            city: lead.city_area,
            tenure_status: "Prospect",
            activity_status: "Active",
            created_by: profile.user_id,
          })
          .select()
          .single();

        if (accountError) {
          console.error(`[${correlationId}] Error creating account:`, accountError);
          return databaseError("Failed to create account", correlationId);
        }

        accountId = newAccount.account_id;

        // Create primary contact for the account
        await supabase.from("contacts").insert({
          account_id: accountId,
          first_name: lead.pic_name.split(" ")[0],
          last_name: lead.pic_name.split(" ").slice(1).join(" ") || null,
          phone: lead.contact_phone,
          email: lead.email,
          is_primary: true,
          is_decision_maker: true,
          created_by: profile.user_id,
        });
      }
    }

    // ==========================================
    // Create opportunity
    // ==========================================

    const { data: opportunity, error: oppError } = await supabase
      .from("opportunities")
      .insert({
        account_id: accountId,
        name: `${lead.company_name} - ${lead.service_code}`,
        stage: "Discovery",
        estimated_value: estimated_value || lead.est_volume_value || 0,
        service_codes: lead.service_code ? [lead.service_code] : [],
        route: lead.route,
        next_step: next_step,
        next_step_due_date: next_step_due_date,
        owner_user_id: profile.user_id,
        created_by: profile.user_id,
        notes: notes || lead.notes,
        source_lead_id: lead.lead_id,
      })
      .select()
      .single();

    if (oppError) {
      console.error(`[${correlationId}] Error creating opportunity:`, oppError);
      return databaseError("Failed to create opportunity", correlationId);
    }

    // ==========================================
    // Create initial activity (seed cadence - PR1.1)
    // ==========================================

    const { data: activity, error: activityError } = await supabase
      .from("activities")
      .insert({
        activity_type: "Call",
        status: "Planned",
        subject: `Initial contact: ${lead.company_name}`,
        description: `Follow up on converted lead. Next step: ${next_step}`,
        related_account_id: accountId,
        related_opportunity_id: opportunity.opportunity_id,
        related_lead_id: lead.lead_id,
        due_date: next_step_due_date,
        owner_user_id: profile.user_id,
        created_by: profile.user_id,
      })
      .select()
      .single();

    if (activityError) {
      console.error(`[${correlationId}] Warning: Failed to create initial activity:`, activityError);
      // Don't fail the conversion, just log the warning
    }

    // ==========================================
    // Update lead status to converted
    // ==========================================

    const { error: updateError } = await supabase
      .from("leads")
      .update({
        status: "converted",
        linked_opportunity_id: opportunity.opportunity_id,
        linked_account_id: accountId,
        updated_at: new Date().toISOString(),
      })
      .eq("lead_id", id);

    if (updateError) {
      console.error(`[${correlationId}] Warning: Failed to update lead status:`, updateError);
    }

    // ==========================================
    // Log audit event
    // ==========================================

    await supabase.from("audit_logs").insert({
      table_name: "leads",
      record_id: id,
      action: "CONVERT",
      changed_by: profile.user_id,
      before_data: lead,
      after_data: {
        status: "converted",
        linked_opportunity_id: opportunity.opportunity_id,
        linked_account_id: accountId,
      },
    });

    return apiSuccess({
      data: {
        success: true,
        lead_id: lead.lead_id,
        account_id: accountId,
        opportunity_id: opportunity.opportunity_id,
        activity_id: activity?.activity_id || null,
        message: "Lead converted to opportunity successfully",
      },
      status: 201,
      correlationId,
    });
  } catch (error) {
    console.error(`[${correlationId}] Error in POST /api/crm/leads/[id]/convert:`, error);
    return internalError("Failed to convert lead", correlationId);
  }
}

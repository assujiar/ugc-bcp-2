import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import {
  generateCorrelationId,
  apiSuccess,
  unauthorizedError,
  notFoundError,
  rbacDenyError,
  validationError,
  databaseError,
  internalError,
  ERROR_CODES,
  apiError,
} from "@/lib/api/error";
import {
  hasRole,
  ALL_MARKETING_ROLES,
  ALL_SALES_ROLES,
  ROLE_GROUPS,
} from "@/lib/api/validation";

// ==========================================
// Field Whitelists by Role (PR0.2 Security)
// ==========================================

// State fields that can ONLY be updated via dedicated endpoints (triage/handover/claim/convert)
const STATE_FIELDS = [
  "triage_status",
  "handover_eligible",
  "handover_at",
  "sales_owner_user_id",
  "linked_opportunity_id",
  "linked_account_id",
  "status",
  "sla_deadline",
  "dedupe_key",
  "dedupe_suggestions",
];

// Fields that any authorized user can update
const COMMON_EDITABLE_FIELDS = [
  "notes",
  "next_step",
  "due_date",
];

// Fields that marketing roles can update
const MARKETING_EDITABLE_FIELDS = [
  ...COMMON_EDITABLE_FIELDS,
  "company_name",
  "pic_name",
  "contact_phone",
  "email",
  "city_area",
  "service_code",
  "route",
  "est_volume_value",
  "est_volume_unit",
  "timeline",
  "primary_channel",
  "campaign_name",
];

// Fields that sales roles can update
const SALES_EDITABLE_FIELDS = [
  ...COMMON_EDITABLE_FIELDS,
  "contact_phone",
  "email",
];

// Fields that admins can update (everything except state fields)
const ADMIN_EDITABLE_FIELDS = [
  ...MARKETING_EDITABLE_FIELDS,
  "sourced_by",
];

// GET /api/crm/leads/[id] - Get single lead
export async function GET(
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

    const { id } = await params;

    const { data: lead, error } = await supabase
      .from("leads")
      .select(`
        *,
        owner:profiles!leads_sales_owner_user_id_fkey (user_id, full_name, role_name),
        created_by_profile:profiles!leads_created_by_fkey (full_name)
      `)
      .eq("lead_id", id)
      .single();

    if (error) {
      console.error(`[${correlationId}] Error fetching lead:`, error);
      return notFoundError("Lead", correlationId);
    }

    return apiSuccess({ data: { lead }, correlationId });
  } catch (error) {
    console.error(`[${correlationId}] Error in GET /api/crm/leads/[id]:`, error);
    return internalError("Failed to fetch lead", correlationId);
  }
}

// PATCH /api/crm/leads/[id] - Update lead (with role-based field whitelist)
export async function PATCH(
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

    const { id } = await params;
    const body = await request.json();

    // ==========================================
    // PR0.2: Role Check - Determine allowed fields
    // ==========================================

    let allowedFields: string[];

    if (hasRole(profile, ROLE_GROUPS.SUPER_ADMIN)) {
      allowedFields = ADMIN_EDITABLE_FIELDS;
    } else if (hasRole(profile, ALL_MARKETING_ROLES)) {
      allowedFields = MARKETING_EDITABLE_FIELDS;
    } else if (hasRole(profile, ALL_SALES_ROLES)) {
      allowedFields = SALES_EDITABLE_FIELDS;
    } else {
      return rbacDenyError(
        "Your role does not have permission to update leads",
        correlationId
      );
    }

    // ==========================================
    // PR0.2: Block State Fields - Must use dedicated endpoints
    // ==========================================

    const attemptedStateFields = Object.keys(body).filter((key) =>
      STATE_FIELDS.includes(key)
    );

    if (attemptedStateFields.length > 0) {
      return apiError({
        code: ERROR_CODES.FIELD_UPDATE_DENIED,
        message: `State fields cannot be updated via PATCH. Use dedicated endpoints (triage, handover, claim, convert).`,
        status: 403,
        details: attemptedStateFields.map((field) => ({
          field,
          message: `Field '${field}' is a state field. Use the appropriate action endpoint instead.`,
        })),
        correlationId,
      });
    }

    // ==========================================
    // PR0.2: Validate Fields Against Whitelist
    // ==========================================

    const disallowedFields = Object.keys(body).filter(
      (key) => !allowedFields.includes(key)
    );

    if (disallowedFields.length > 0) {
      return apiError({
        code: ERROR_CODES.RBAC_DENY,
        message: `Your role cannot update these fields: ${disallowedFields.join(", ")}`,
        status: 403,
        details: disallowedFields.map((field) => ({
          field,
          message: `Field '${field}' is not editable by your role (${profile.role_name})`,
        })),
        correlationId,
      });
    }

    // ==========================================
    // Get existing lead for audit and ownership check
    // ==========================================

    const { data: existingLead, error: fetchError } = await supabase
      .from("leads")
      .select("*")
      .eq("lead_id", id)
      .single();

    if (fetchError || !existingLead) {
      return notFoundError("Lead", correlationId);
    }

    // Sales users can only update leads they own or unassigned leads
    if (hasRole(profile, ALL_SALES_ROLES) && !hasRole(profile, ROLE_GROUPS.SUPER_ADMIN)) {
      const isOwner = existingLead.sales_owner_user_id === profile.user_id;
      const isUnassigned = !existingLead.sales_owner_user_id;

      if (!isOwner && !isUnassigned) {
        return rbacDenyError(
          "Sales users can only update leads they own",
          correlationId
        );
      }
    }

    // ==========================================
    // Build sanitized update payload
    // ==========================================

    const sanitizedUpdate: Record<string, unknown> = {};
    for (const key of Object.keys(body)) {
      if (allowedFields.includes(key)) {
        sanitizedUpdate[key] = body[key];
      }
    }

    if (Object.keys(sanitizedUpdate).length === 0) {
      return validationError(
        "No valid fields to update",
        [{ field: "body", message: "Request body contains no updatable fields" }],
        correlationId
      );
    }

    // ==========================================
    // Perform update
    // ==========================================

    const { data: lead, error } = await supabase
      .from("leads")
      .update({
        ...sanitizedUpdate,
        updated_at: new Date().toISOString(),
      })
      .eq("lead_id", id)
      .select()
      .single();

    if (error) {
      console.error(`[${correlationId}] Error updating lead:`, error);
      return databaseError(error.message, correlationId);
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "leads",
      record_id: id,
      action: "UPDATE",
      changed_by: profile.user_id,
      before_data: existingLead,
      after_data: lead,
    });

    return apiSuccess({ data: { lead }, correlationId });
  } catch (error) {
    console.error(`[${correlationId}] Error in PATCH /api/crm/leads/[id]:`, error);
    return internalError("Failed to update lead", correlationId);
  }
}

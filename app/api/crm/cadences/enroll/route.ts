import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { apiSuccess, apiErrors } from "@/lib/api/error";

const enrollSchema = z.object({
  account_id: z.string().min(1, "Account ID is required"),
  cadence_type: z.enum(["winback", "default"]),
  notes: z.string().optional(),
});

/**
 * POST /api/crm/cadences/enroll - Enroll an account in a cadence
 *
 * This endpoint allows sales to enroll an account in a cadence (e.g., winback cadence for inactive accounts).
 * It calls the appropriate RPC function to create the enrollment and seed activities.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return apiErrors.unauthorized();
    }

    // Check if user is sales team
    const salesRoles = [
      "Director",
      "super admin",
      "sales manager",
      "salesperson",
      "sales support",
    ];
    if (!salesRoles.includes(profile.role_name)) {
      return apiErrors.forbidden("Only sales team can enroll accounts in cadences");
    }

    const body = await request.json();
    const validation = enrollSchema.safeParse(body);

    if (!validation.success) {
      return apiErrors.validation("Validation error", validation.error.issues);
    }

    const { account_id, cadence_type, notes } = validation.data;

    // Generate idempotency key
    const idempotencyKey = `enroll-${cadence_type}-${account_id}-${uuidv4()}`;

    let result;
    let error;

    if (cadence_type === "winback") {
      // Call winback enrollment RPC
      const { data, error: rpcError } = await supabase.rpc(
        "rpc_enroll_winback_cadence",
        {
          p_idempotency_key: idempotencyKey,
          p_account_id: account_id,
          p_notes: notes || null,
        }
      );
      result = data;
      error = rpcError;
    } else {
      // For default cadence, we would need a different RPC
      // For now, return not implemented
      return apiErrors.badRequest("Default cadence enrollment not yet implemented");
    }

    if (error) {
      console.error("Error in cadence enrollment RPC:", error);
      return apiErrors.internal(error.message);
    }

    const rpcResult = result as {
      success: boolean;
      error?: string;
      account_id?: string;
      opportunity_id?: string;
      enrollment_id?: number;
      activities_created?: number;
    };

    if (!rpcResult.success) {
      return apiErrors.badRequest(rpcResult.error || "Failed to enroll account in cadence");
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "cadence_enrollments",
      record_id: rpcResult.enrollment_id?.toString() || account_id,
      action: "INSERT",
      changed_by: profile.user_id,
      after_data: {
        cadence_type,
        account_id,
        opportunity_id: rpcResult.opportunity_id,
        activities_created: rpcResult.activities_created,
      },
    });

    return apiSuccess({
      data: {
        ...rpcResult,
        message: `Account enrolled in ${cadence_type} cadence with ${rpcResult.activities_created} activities`,
      },
    });
  } catch (error) {
    console.error("Error in POST /api/crm/cadences/enroll:", error);
    return apiErrors.internal();
  }
}

/**
 * GET /api/crm/cadences/enroll - List active enrollments for an account
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return apiErrors.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("account_id");
    const opportunityId = searchParams.get("opportunity_id");

    if (!accountId && !opportunityId) {
      return apiErrors.badRequest("Either account_id or opportunity_id is required");
    }

    let query = supabase
      .from("cadence_enrollments")
      .select(
        `
        *,
        cadence:cadences(cadence_id, name, description),
        activities:activities(activity_id, activity_type, subject, status, due_date)
      `
      )
      .eq("status", "Active");

    if (accountId) {
      query = query.eq("account_id", accountId);
    }
    if (opportunityId) {
      query = query.eq("opportunity_id", opportunityId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching enrollments:", error);
      return apiErrors.internal(error.message);
    }

    return apiSuccess({ data });
  } catch (error) {
    console.error("Error in GET /api/crm/cadences/enroll:", error);
    return apiErrors.internal();
  }
}

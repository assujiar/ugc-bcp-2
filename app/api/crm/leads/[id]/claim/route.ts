import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { v4 as uuidv4 } from "uuid";
import { apiSuccess, apiErrors } from "@/lib/api/error";

// POST /api/crm/leads/[id]/claim - Claim lead from handover pool (Get Lead)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return apiErrors.unauthorized();
    }

    // Check if user is sales team
    const salesRoles = [
      "Director", "super admin", "sales manager", "salesperson", "sales support"
    ];
    if (!salesRoles.includes(profile.role_name)) {
      return apiErrors.forbidden("Only sales team can claim leads");
    }

    const { id } = await params;

    // Generate idempotency key
    const idempotencyKey = `claim-${id}-${profile.user_id}-${uuidv4()}`;

    // Call RPC function
    const { data, error } = await supabase.rpc("rpc_sales_claim_lead", {
      p_idempotency_key: idempotencyKey,
      p_lead_id: id === "next" ? null : id, // "next" means get any available lead
    });

    if (error) {
      console.error("Error in claim RPC:", error);
      return apiErrors.internal(error.message);
    }

    const result = data as {
      success: boolean;
      error?: string;
      lead_id?: string;
      account_id?: string;
      opportunity_id?: string;
      activity_id?: string;
    };

    if (!result.success) {
      return apiErrors.conflict(result.error || "Failed to claim lead. It may have been claimed by another user.");
    }

    return apiSuccess({ data: result });
  } catch (error) {
    console.error("Error in POST /api/crm/leads/[id]/claim:", error);
    return apiErrors.internal();
  }
}

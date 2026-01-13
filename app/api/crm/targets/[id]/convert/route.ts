import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { v4 as uuidv4 } from "uuid";
import { apiSuccess, apiErrors } from "@/lib/api/error";
import { z } from "zod";

// Schema for convert request
const convertSchema = z.object({
  service_code: z.string().optional(),
  notes: z.string().optional(),
});

// POST /api/crm/targets/[id]/convert - Convert target to lead/account/opportunity
// Requires target to be in "qualified" status (enforced by RPC)
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

    const { id } = await params;
    const body = await request.json();

    // Validate input
    const parsed = convertSchema.safeParse(body);
    if (!parsed.success) {
      return apiErrors.badRequest(parsed.error.errors[0].message);
    }

    const { service_code, notes } = parsed.data;

    // Generate idempotency key
    const idempotencyKey = `convert-${id}-${uuidv4()}`;

    // Call RPC function (now includes gating: only qualified targets can convert)
    const { data, error } = await supabase.rpc("rpc_target_convert_to_lead", {
      p_idempotency_key: idempotencyKey,
      p_target_id: id,
      p_service_code: service_code,
      p_notes: notes,
    });

    if (error) {
      console.error("Error in convert target RPC:", error);
      return apiErrors.internal(error.message);
    }

    const result = data as {
      success: boolean;
      error?: string;
      required_status?: string;
      current_status?: string;
      account_id?: string;
      contact_id?: string;
      opportunity_id?: string;
      first_activity_id?: string;
      deep_link?: string;
      message?: string;
    };

    if (!result.success) {
      // Return detailed error for gating failures
      if (result.required_status) {
        return apiErrors.badRequest(
          result.error || "Failed to convert target",
          {
            required_status: result.required_status,
            current_status: result.current_status,
          }
        );
      }
      return apiErrors.badRequest(result.error || "Failed to convert target");
    }

    // Return success with deep link for UI navigation
    return apiSuccess({
      data: {
        success: true,
        account_id: result.account_id,
        contact_id: result.contact_id,
        opportunity_id: result.opportunity_id,
        first_activity_id: result.first_activity_id,
        deep_link: result.deep_link || `/crm/opportunities/${result.opportunity_id}`,
        message: result.message || "Target converted successfully",
      },
    });
  } catch (error) {
    console.error("Error in POST /api/crm/targets/[id]/convert:", error);
    return apiErrors.internal();
  }
}

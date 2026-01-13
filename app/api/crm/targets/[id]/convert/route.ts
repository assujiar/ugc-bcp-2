import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { v4 as uuidv4 } from "uuid";
import { apiSuccess, apiErrors } from "@/lib/api/error";

// POST /api/crm/targets/[id]/convert - Convert target to lead/account/opportunity
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
    const { service_code, notes } = body;

    // Generate idempotency key
    const idempotencyKey = `convert-${id}-${uuidv4()}`;

    // Call RPC function
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
      account_id?: string;
      contact_id?: string;
      opportunity_id?: string;
    };

    if (!result.success) {
      return apiErrors.badRequest(result.error || "Failed to convert target");
    }

    return apiSuccess({ data: result });
  } catch (error) {
    console.error("Error in POST /api/crm/targets/[id]/convert:", error);
    return apiErrors.internal();
  }
}

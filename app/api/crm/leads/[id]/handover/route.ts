import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { v4 as uuidv4 } from "uuid";
import { apiSuccess, apiErrors } from "@/lib/api/error";

// POST /api/crm/leads/[id]/handover - Handover lead to sales pool
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

    // Check if user is marketing team
    const marketingRoles = [
      "Director", "super admin", "Marketing Manager",
      "Marcomm (marketing staff)", "DGO (Marketing staff)",
      "MACX (marketing staff)", "VSDO (marketing staff)"
    ];
    if (!marketingRoles.includes(profile.role_name)) {
      return apiErrors.forbidden("Only marketing team can handover leads");
    }

    const { id } = await params;
    const body = await request.json();
    const { notes, priority = 0 } = body;

    // Generate idempotency key
    const idempotencyKey = `handover-${id}-${uuidv4()}`;

    // Call RPC function
    const { data, error } = await supabase.rpc("rpc_lead_handover_to_sales_pool", {
      p_idempotency_key: idempotencyKey,
      p_lead_id: id,
      p_notes: notes,
      p_priority: priority,
    });

    if (error) {
      console.error("Error in handover RPC:", error);
      return apiErrors.internal(error.message);
    }

    const result = data as { success: boolean; error?: string; lead_id?: string; message?: string };

    if (!result.success) {
      return apiErrors.badRequest(result.error || "Failed to handover lead");
    }

    return apiSuccess({ data: result });
  } catch (error) {
    console.error("Error in POST /api/crm/leads/[id]/handover:", error);
    return apiErrors.internal();
  }
}

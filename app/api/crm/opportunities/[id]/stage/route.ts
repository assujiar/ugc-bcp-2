import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { apiSuccess, apiErrors } from "@/lib/api/error";

const OPPORTUNITY_STAGES = [
  "Prospecting", "Discovery", "Proposal Sent", "Quote Sent",
  "Negotiation", "Verbal Commit", "Closed Won", "Closed Lost", "On Hold"
] as const;

const stageChangeSchema = z.object({
  new_stage: z.enum(OPPORTUNITY_STAGES),
  next_step: z.string().min(1),
  next_step_due_date: z.string(),
  lost_reason: z.string().optional(),
  notes: z.string().optional(),
});

// POST /api/crm/opportunities/[id]/stage - Change opportunity stage (atomic)
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
    const validation = stageChangeSchema.safeParse(body);

    if (!validation.success) {
      return apiErrors.validation("Validation error", validation.error.issues);
    }

    const { new_stage, next_step, next_step_due_date, lost_reason, notes } = validation.data;

    // Generate idempotency key
    const idempotencyKey = `stage-change-${id}-${new_stage}-${uuidv4()}`;

    // Call RPC function for atomic stage change
    const { data, error } = await supabase.rpc("rpc_opportunity_change_stage", {
      p_idempotency_key: idempotencyKey,
      p_opportunity_id: id,
      p_new_stage: new_stage,
      p_next_step: next_step,
      p_next_step_due_date: next_step_due_date,
      p_lost_reason: lost_reason,
      p_notes: notes,
    });

    if (error) {
      console.error("Error in stage change RPC:", error);
      return apiErrors.internal(error.message);
    }

    const result = data as { success: boolean; error?: string; opportunity_id?: string; new_stage?: string };

    if (!result.success) {
      return apiErrors.badRequest(result.error || "Failed to change stage");
    }

    return apiSuccess({ data: result });
  } catch (error) {
    console.error("Error in POST /api/crm/opportunities/[id]/stage:", error);
    return apiErrors.internal();
  }
}

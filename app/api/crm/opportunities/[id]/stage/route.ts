import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { apiSuccess, apiErrors, apiError } from "@/lib/api/error";

const OPPORTUNITY_STAGES = [
  "Prospecting", "Discovery", "Proposal Sent", "Quote Sent",
  "Negotiation", "Verbal Commit", "Closed Won", "Closed Lost", "On Hold"
] as const;

const stageChangeSchema = z.object({
  new_stage: z.enum(OPPORTUNITY_STAGES),
  next_step: z.string().min(1),
  next_step_due_date: z.string(),
  lost_reason: z.string().optional(),
  outcome: z.string().optional(),
  notes: z.string().optional(),
});

// Human-readable field labels for error messages
const FIELD_LABELS: Record<string, string> = {
  owner_user_id: "Sales Owner",
  next_step: "Next Step",
  next_step_due_date: "Due Date",
  quote_record: "Quote Record",
  outcome: "Win Reason",
  lost_reason: "Lost Reason",
};

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

    const { new_stage, next_step, next_step_due_date, lost_reason, outcome, notes } = validation.data;

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
      p_outcome: outcome,
      p_notes: notes,
    });

    if (error) {
      console.error("Error in stage change RPC:", error);
      return apiErrors.internal(error.message);
    }

    interface StageChangeResult {
      success: boolean;
      error?: string;
      error_code?: string;
      missing_fields?: string[];
      target_stage?: string;
      opportunity_id?: string;
      new_stage?: string;
      old_stage?: string;
    }

    const result = data as StageChangeResult;

    if (!result.success) {
      // Handle exit criteria violations with 409 Conflict
      if (result.error_code === "EXIT_CRITERIA_NOT_MET" && result.missing_fields) {
        const missingFieldLabels = result.missing_fields
          .map((f) => FIELD_LABELS[f] || f)
          .join(", ");

        return apiError("CONFLICT", `Cannot move to ${result.target_stage}: missing ${missingFieldLabels}`, {
          missing_fields: result.missing_fields,
          target_stage: result.target_stage,
          field_labels: result.missing_fields.map((f) => ({
            field: f,
            label: FIELD_LABELS[f] || f,
          })),
        });
      }

      // Handle not found
      if (result.error_code === "NOT_FOUND") {
        return apiErrors.notFound("Opportunity");
      }

      return apiErrors.badRequest(result.error || "Failed to change stage");
    }

    return apiSuccess({ data: result });
  } catch (error) {
    console.error("Error in POST /api/crm/opportunities/[id]/stage:", error);
    return apiErrors.internal();
  }
}

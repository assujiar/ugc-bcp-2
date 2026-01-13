import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { apiSuccess, apiErrors } from "@/lib/api/error";

const ACTIVITY_TYPES = [
  "Call", "Email", "Visit", "Online Meeting", "WhatsApp",
  "LinkedIn Message", "Send Proposal", "Send Quote", "Follow Up",
  "Internal Meeting", "Other"
] as const;

// Schema for completing an activity (status -> Done)
const completeActivitySchema = z.object({
  action: z.literal("complete"),
  outcome: z.string().optional(),
  duration_minutes: z.number().optional(),
  create_next_activity: z.object({
    activity_type: z.enum(ACTIVITY_TYPES).optional().default("Follow Up"),
    subject: z.string().optional(),
    due_date: z.string(), // Required for new planned activities
    description: z.string().optional(),
  }).optional(),
});

// Schema for cancelling an activity (status -> Cancelled)
const cancelActivitySchema = z.object({
  action: z.literal("cancel"),
  cancel_reason: z.string().optional(),
});

// Combined schema using discriminated union
const updateActivitySchema = z.discriminatedUnion("action", [
  completeActivitySchema,
  cancelActivitySchema,
]);

// GET /api/crm/activities/[id] - Get single activity
export async function GET(
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

    const { data, error } = await supabase
      .from("activities")
      .select(`
        *,
        account:accounts!related_account_id(account_id, company_name),
        opportunity:opportunities!related_opportunity_id(opportunity_id, name, stage),
        contact:contacts!related_contact_id(contact_id, first_name, last_name),
        owner:profiles!owner_user_id(user_id, full_name)
      `)
      .eq("activity_id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return apiErrors.notFound("Activity");
      }
      console.error("Error fetching activity:", error);
      return apiErrors.internal(error.message);
    }

    return apiSuccess({ data });
  } catch (error) {
    console.error("Error in GET /api/crm/activities/[id]:", error);
    return apiErrors.internal();
  }
}

// PATCH /api/crm/activities/[id] - Update activity status (complete/cancel)
export async function PATCH(
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
    const validation = updateActivitySchema.safeParse(body);

    if (!validation.success) {
      return apiErrors.validation("Validation error", validation.error.issues);
    }

    const payload = validation.data;

    if (payload.action === "complete") {
      // Handle completion - mark as Done and optionally create next activity
      const idempotencyKey = `complete-${id}-${uuidv4()}`;

      // Determine if we should create next activity
      const createNext = !!payload.create_next_activity;
      const nextActivityType = payload.create_next_activity?.activity_type || "Follow Up";
      const nextSubject = payload.create_next_activity?.subject;
      const nextDueDate = payload.create_next_activity?.due_date;

      // Call RPC function
      const { data, error } = await supabase.rpc("rpc_activity_complete_and_next", {
        p_idempotency_key: idempotencyKey,
        p_activity_id: id,
        p_outcome: payload.outcome,
        p_duration_minutes: payload.duration_minutes,
        p_create_next: createNext,
        p_next_activity_type: nextActivityType,
        p_next_subject: nextSubject,
        p_next_due_date: nextDueDate,
      });

      if (error) {
        console.error("Error in complete activity RPC:", error);
        return apiErrors.internal(error.message);
      }

      const result = data as {
        success: boolean;
        error?: string;
        completed_activity_id?: string;
        next_activity_id?: string;
      };

      if (!result.success) {
        return apiErrors.badRequest(result.error || "Failed to complete activity");
      }

      return apiSuccess({ data: result });

    } else if (payload.action === "cancel") {
      // Handle cancellation
      const idempotencyKey = `cancel-${id}-${uuidv4()}`;

      const { data, error } = await supabase.rpc("rpc_activity_cancel", {
        p_idempotency_key: idempotencyKey,
        p_activity_id: id,
        p_cancel_reason: payload.cancel_reason,
      });

      if (error) {
        console.error("Error in cancel activity RPC:", error);
        return apiErrors.internal(error.message);
      }

      const result = data as {
        success: boolean;
        error?: string;
        cancelled_activity_id?: string;
      };

      if (!result.success) {
        return apiErrors.badRequest(result.error || "Failed to cancel activity");
      }

      return apiSuccess({ data: result });
    }

    return apiErrors.badRequest("Invalid action");
  } catch (error) {
    console.error("Error in PATCH /api/crm/activities/[id]:", error);
    return apiErrors.internal();
  }
}

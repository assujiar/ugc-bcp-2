import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const ACTIVITY_TYPES = [
  "Call", "Email", "Visit", "Online Meeting", "WhatsApp",
  "LinkedIn Message", "Send Proposal", "Send Quote", "Follow Up",
  "Internal Meeting", "Other"
] as const;

const completeActivitySchema = z.object({
  outcome: z.string().optional(),
  duration_minutes: z.number().optional(),
  create_next: z.boolean().optional(),
  next_activity_type: z.enum(ACTIVITY_TYPES).optional(),
  next_subject: z.string().optional(),
  next_due_date: z.string().optional(),
});

// POST /api/crm/activities/[id]/complete - Complete activity and optionally create next
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validation = completeActivitySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: "Validation error",
        details: validation.error.issues
      }, { status: 400 });
    }

    const {
      outcome,
      duration_minutes,
      create_next = true,
      next_activity_type = "Follow Up",
      next_subject,
      next_due_date,
    } = validation.data;

    // Generate idempotency key
    const idempotencyKey = `complete-${id}-${uuidv4()}`;

    // Call RPC function
    const { data, error } = await supabase.rpc("rpc_activity_complete_and_next", {
      p_idempotency_key: idempotencyKey,
      p_activity_id: id,
      p_outcome: outcome,
      p_duration_minutes: duration_minutes,
      p_create_next: create_next,
      p_next_activity_type: next_activity_type,
      p_next_subject: next_subject,
      p_next_due_date: next_due_date,
    });

    if (error) {
      console.error("Error in complete activity RPC:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = data as {
      success: boolean;
      error?: string;
      completed_activity_id?: string;
      next_activity_id?: string;
    };

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in POST /api/crm/activities/[id]/complete:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

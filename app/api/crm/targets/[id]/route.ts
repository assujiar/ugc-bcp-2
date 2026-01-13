import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { z } from "zod";

// PR3.2: Valid status transitions
const TARGET_STATUSES = ["New", "Contacted", "Converted", "Not Interested", "Invalid"] as const;

const updateTargetSchema = z.object({
  status: z.enum(TARGET_STATUSES).optional(),
  company_name: z.string().min(1).optional(),
  domain: z.string().optional(),
  industry: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal("")),
  contact_phone: z.string().optional(),
  linkedin_url: z.string().url().optional().or(z.literal("")),
  city: z.string().optional(),
  notes: z.string().optional(),
  next_outreach_at: z.string().optional(),
  last_contacted_at: z.string().optional(),
});

// GET /api/crm/targets/[id] - Get single target
export async function GET(
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

    const { data: target, error } = await supabase
      .from("prospecting_targets")
      .select(`
        *,
        owner:profiles!prospecting_targets_owner_user_id_fkey (user_id, full_name)
      `)
      .eq("target_id", id)
      .single();

    if (error) {
      console.error("Error fetching target:", error);
      return NextResponse.json({ error: "Target not found" }, { status: 404 });
    }

    return NextResponse.json({ target });
  } catch (error) {
    console.error("Error in GET /api/crm/targets/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/crm/targets/[id] - Update target (PR3.2: Status transitions)
export async function PATCH(
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
    const validation = updateTargetSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: "Validation error",
        details: validation.error.issues,
      }, { status: 400 });
    }

    // Get existing target
    const { data: existingTarget, error: fetchError } = await supabase
      .from("prospecting_targets")
      .select("*")
      .eq("target_id", id)
      .single();

    if (fetchError || !existingTarget) {
      return NextResponse.json({ error: "Target not found" }, { status: 404 });
    }

    const updateData = validation.data;

    // PR3.2: Handle status transition side effects
    if (updateData.status) {
      const oldStatus = existingTarget.status;
      const newStatus = updateData.status;

      // If transitioning to "Contacted", update last_contacted_at
      if (newStatus === "Contacted" && oldStatus !== "Contacted") {
        updateData.last_contacted_at = new Date().toISOString();
      }

      // Validate state machine (optional - can be more strict)
      const invalidTransitions: Record<string, string[]> = {
        Converted: ["New", "Contacted"], // Can't go back from Converted
        Invalid: ["New", "Contacted", "Not Interested"], // Can't go back from Invalid
      };

      if (invalidTransitions[oldStatus]?.includes(newStatus)) {
        return NextResponse.json({
          error: `Cannot transition from ${oldStatus} to ${newStatus}`,
        }, { status: 400 });
      }
    }

    // Perform update
    const { data: target, error } = await supabase
      .from("prospecting_targets")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("target_id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating target:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "prospecting_targets",
      record_id: id,
      action: "UPDATE",
      changed_by: profile.user_id,
      before_data: existingTarget,
      after_data: target,
    });

    return NextResponse.json({ target });
  } catch (error) {
    console.error("Error in PATCH /api/crm/targets/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/crm/targets/[id] - Delete target
export async function DELETE(
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

    // Get existing target for audit
    const { data: existingTarget } = await supabase
      .from("prospecting_targets")
      .select("*")
      .eq("target_id", id)
      .single();

    const { error } = await supabase
      .from("prospecting_targets")
      .delete()
      .eq("target_id", id);

    if (error) {
      console.error("Error deleting target:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit
    if (existingTarget) {
      await supabase.from("audit_logs").insert({
        table_name: "prospecting_targets",
        record_id: id,
        action: "DELETE",
        changed_by: profile.user_id,
        before_data: existingTarget,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/crm/targets/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

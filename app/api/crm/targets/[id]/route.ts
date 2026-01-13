import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { v4 as uuidv4 } from "uuid";
import { apiSuccess, apiErrors } from "@/lib/api/error";
import { z } from "zod";
import {
  TargetStatus,
  TARGET_STATUS_TRANSITIONS,
  TARGET_TERMINAL_STATES,
} from "@/lib/types/database";

// Schema for status update
const updateStatusSchema = z.object({
  status: z.enum([
    "new_target",
    "contacted",
    "engaged",
    "qualified",
    "dropped",
    "converted",
  ] as const),
  notes: z.string().optional(),
  drop_reason: z.string().optional(),
});

// Schema for general update
const updateTargetSchema = z.object({
  company_name: z.string().optional(),
  domain: z.string().optional(),
  industry: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().email().optional().nullable(),
  contact_phone: z.string().optional(),
  linkedin_url: z.string().url().optional().nullable(),
  city: z.string().optional(),
  notes: z.string().optional(),
  next_outreach_at: z.string().datetime().optional().nullable(),
  status: z.enum([
    "new_target",
    "contacted",
    "engaged",
    "qualified",
    "dropped",
    "converted",
  ] as const).optional(),
  drop_reason: z.string().optional(),
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
      return apiErrors.unauthorized();
    }

    const { id } = await params;

    const { data, error } = await supabase
      .from("prospecting_targets")
      .select(
        `
        *,
        owner:profiles!prospecting_targets_owner_user_id_fkey(user_id, full_name),
        created_by_profile:profiles!prospecting_targets_created_by_fkey(user_id, full_name)
      `
      )
      .eq("target_id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return apiErrors.notFound("Target not found");
      }
      console.error("Error fetching target:", error);
      return apiErrors.internal(error.message);
    }

    return apiSuccess({ data });
  } catch (error) {
    console.error("Error in GET /api/crm/targets/[id]:", error);
    return apiErrors.internal();
  }
}

// PATCH /api/crm/targets/[id] - Update target with status transition validation
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

    // Validate input
    const parsed = updateTargetSchema.safeParse(body);
    if (!parsed.success) {
      return apiErrors.badRequest(parsed.error.errors[0].message);
    }

    const updateData = parsed.data;

    // If status is being updated, validate transition
    if (updateData.status) {
      // Get current target
      const { data: currentTarget, error: fetchError } = await supabase
        .from("prospecting_targets")
        .select("status")
        .eq("target_id", id)
        .single();

      if (fetchError || !currentTarget) {
        return apiErrors.notFound("Target not found");
      }

      const currentStatus = currentTarget.status as TargetStatus;
      const newStatus = updateData.status as TargetStatus;

      // Validate transition using RPC for full validation including reason check
      const idempotencyKey = `status-${id}-${uuidv4()}`;
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "rpc_target_update_status",
        {
          p_idempotency_key: idempotencyKey,
          p_target_id: id,
          p_new_status: newStatus,
          p_notes: updateData.notes,
          p_drop_reason: updateData.drop_reason,
        }
      );

      if (rpcError) {
        console.error("Error in status update RPC:", rpcError);
        return apiErrors.internal(rpcError.message);
      }

      const result = rpcResult as {
        success: boolean;
        error?: string;
        target_id?: string;
        old_status?: string;
        new_status?: string;
      };

      if (!result.success) {
        return apiErrors.badRequest(result.error || "Failed to update status");
      }

      return apiSuccess({
        data: {
          target_id: id,
          old_status: result.old_status,
          new_status: result.new_status,
          message: `Status updated from ${result.old_status} to ${result.new_status}`,
        },
      });
    }

    // For non-status updates, update directly
    const { data, error } = await supabase
      .from("prospecting_targets")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("target_id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return apiErrors.notFound("Target not found");
      }
      console.error("Error updating target:", error);
      return apiErrors.internal(error.message);
    }

    return apiSuccess({ data });
  } catch (error) {
    console.error("Error in PATCH /api/crm/targets/[id]:", error);
    return apiErrors.internal();
  }
}

// POST /api/crm/targets/[id]/status - Update status with transition validation (alternative endpoint)
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
    const parsed = updateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return apiErrors.badRequest(parsed.error.errors[0].message);
    }

    const { status, notes, drop_reason } = parsed.data;

    // Use RPC for atomic status update with validation
    const idempotencyKey = `status-${id}-${uuidv4()}`;
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "rpc_target_update_status",
      {
        p_idempotency_key: idempotencyKey,
        p_target_id: id,
        p_new_status: status,
        p_notes: notes,
        p_drop_reason: drop_reason,
      }
    );

    if (rpcError) {
      console.error("Error in status update RPC:", rpcError);
      return apiErrors.internal(rpcError.message);
    }

    const result = rpcResult as {
      success: boolean;
      error?: string;
      target_id?: string;
      old_status?: string;
      new_status?: string;
    };

    if (!result.success) {
      return apiErrors.badRequest(result.error || "Failed to update status");
    }

    return apiSuccess({
      data: {
        target_id: id,
        old_status: result.old_status,
        new_status: result.new_status,
        message: `Status updated from ${result.old_status} to ${result.new_status}`,
      },
    });
  } catch (error) {
    console.error("Error in POST /api/crm/targets/[id]:", error);
    return apiErrors.internal();
  }
}

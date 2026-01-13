import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { apiSuccess, apiErrors } from "@/lib/api/error";

const triageSchema = z.object({
  triage_status: z.enum(["In Review", "Qualified", "Nurture", "Disqualified"]),
  disqualified_reason: z.string().optional(),
  notes: z.string().optional(),
  auto_handover: z.boolean().optional().default(true), // Auto-send to Sales Pool when Qualified
});

// PATCH /api/crm/leads/[id]/triage - Triage a lead
// FIX: When triaged to "Qualified", automatically handover to Sales Pool
// to prevent leads from vanishing (SSOT requirement: no record disappears)
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

    // Check if user is marketing team
    const marketingRoles = [
      "Director", "super admin", "Marketing Manager",
      "Marcomm (marketing staff)", "DGO (Marketing staff)",
      "MACX (marketing staff)", "VSDO (marketing staff)"
    ];
    if (!marketingRoles.includes(profile.role_name)) {
      return apiErrors.forbidden("Only marketing team can triage leads");
    }

    const { id } = await params;
    const body = await request.json();
    const validation = triageSchema.safeParse(body);

    if (!validation.success) {
      return apiErrors.validation("Validation error", validation.error.issues);
    }

    const { triage_status, disqualified_reason, notes, auto_handover } = validation.data;

    // Build update object
    const updateData: Record<string, unknown> = {
      triage_status,
      updated_at: new Date().toISOString(),
    };

    if (triage_status === "Qualified") {
      updateData.qualified_at = new Date().toISOString();
      updateData.handover_eligible = true;
    } else if (triage_status === "Disqualified") {
      if (!disqualified_reason) {
        return apiErrors.validation("Disqualified reason is required");
      }
      updateData.disqualified_at = new Date().toISOString();
      updateData.disqualified_reason = disqualified_reason;
    }

    if (notes) {
      updateData.handover_notes = notes;
    }

    const { data: lead, error } = await supabase
      .from("leads")
      .update(updateData)
      .eq("lead_id", id)
      .select()
      .single();

    if (error) {
      return apiErrors.internal(error.message);
    }

    // AUTO-HANDOVER FIX: When qualified, automatically send to Sales Pool
    // This prevents the "qualified leads vanish" bug identified in audit
    let handoverResult = null;
    if (triage_status === "Qualified" && auto_handover !== false) {
      const idempotencyKey = `auto-handover-${id}-${uuidv4()}`;

      const { data: handoverData, error: handoverError } = await supabase.rpc(
        "rpc_lead_handover_to_sales_pool",
        {
          p_idempotency_key: idempotencyKey,
          p_lead_id: id,
          p_notes: notes || "Auto-handover on qualification",
          p_priority: 0,
        }
      );

      if (handoverError) {
        console.error("Auto-handover error:", handoverError);
        // Don't fail the triage, just log the warning
        handoverResult = { success: false, error: handoverError.message };
      } else {
        handoverResult = handoverData;
        // Update local lead object to reflect handover status
        lead.triage_status = "Handed Over";
      }
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "leads",
      record_id: id,
      action: "TRIAGE",
      changed_by: profile.user_id,
      after_data: { triage_status, disqualified_reason, notes, auto_handover_triggered: !!handoverResult },
    });

    return apiSuccess({
      data: {
        lead,
        handover: handoverResult,
        message: handoverResult?.success
          ? "Lead qualified and sent to Sales Pool"
          : "Lead triaged successfully",
      },
    });
  } catch (error) {
    console.error("Error in PATCH /api/crm/leads/[id]/triage:", error);
    return apiErrors.internal();
  }
}

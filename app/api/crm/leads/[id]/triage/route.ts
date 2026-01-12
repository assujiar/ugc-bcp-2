import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { z } from "zod";

const triageSchema = z.object({
  triage_status: z.enum(["In Review", "Qualified", "Nurture", "Disqualified"]),
  disqualified_reason: z.string().optional(),
  notes: z.string().optional(),
});

// PATCH /api/crm/leads/[id]/triage - Triage a lead
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

    // Check if user is marketing team
    const marketingRoles = [
      "Director", "super admin", "Marketing Manager",
      "Marcomm (marketing staff)", "DGO (Marketing staff)",
      "MACX (marketing staff)", "VSDO (marketing staff)"
    ];
    if (!marketingRoles.includes(profile.role_name)) {
      return NextResponse.json({ error: "Only marketing team can triage leads" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validation = triageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: "Validation error",
        details: validation.error.issues
      }, { status: 400 });
    }

    const { triage_status, disqualified_reason, notes } = validation.data;

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
        return NextResponse.json({ error: "Disqualified reason is required" }, { status: 400 });
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "leads",
      record_id: id,
      action: "TRIAGE",
      changed_by: profile.user_id,
      after_data: { triage_status, disqualified_reason, notes },
    });

    return NextResponse.json({ lead });
  } catch (error) {
    console.error("Error in PATCH /api/crm/leads/[id]/triage:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

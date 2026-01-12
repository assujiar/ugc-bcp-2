import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { v4 as uuidv4 } from "uuid";

// POST /api/crm/leads/[id]/handover - Handover lead to sales pool
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

    // Check if user is marketing team
    const marketingRoles = [
      "Director", "super admin", "Marketing Manager",
      "Marcomm (marketing staff)", "DGO (Marketing staff)",
      "MACX (marketing staff)", "VSDO (marketing staff)"
    ];
    if (!marketingRoles.includes(profile.role_name)) {
      return NextResponse.json({ error: "Only marketing team can handover leads" }, { status: 403 });
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = data as { success: boolean; error?: string; lead_id?: string; message?: string };

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in POST /api/crm/leads/[id]/handover:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

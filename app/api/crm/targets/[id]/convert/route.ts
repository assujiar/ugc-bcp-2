import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { v4 as uuidv4 } from "uuid";

// POST /api/crm/targets/[id]/convert - Convert target to lead/account/opportunity
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
    const { service_code, notes } = body;

    // Generate idempotency key
    const idempotencyKey = `convert-${id}-${uuidv4()}`;

    // Call RPC function
    const { data, error } = await supabase.rpc("rpc_target_convert_to_lead", {
      p_idempotency_key: idempotencyKey,
      p_target_id: id,
      p_service_code: service_code,
      p_notes: notes,
    });

    if (error) {
      console.error("Error in convert target RPC:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = data as {
      success: boolean;
      error?: string;
      account_id?: string;
      contact_id?: string;
      opportunity_id?: string;
    };

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in POST /api/crm/targets/[id]/convert:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

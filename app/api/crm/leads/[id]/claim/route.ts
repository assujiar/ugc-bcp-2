import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { v4 as uuidv4 } from "uuid";

// POST /api/crm/leads/[id]/claim - Claim lead from handover pool (Get Lead)
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

    // Check if user is sales team
    const salesRoles = [
      "Director", "super admin", "sales manager", "salesperson", "sales support"
    ];
    if (!salesRoles.includes(profile.role_name)) {
      return NextResponse.json({ error: "Only sales team can claim leads" }, { status: 403 });
    }

    const { id } = await params;

    // Generate idempotency key
    const idempotencyKey = `claim-${id}-${profile.user_id}-${uuidv4()}`;

    // Call RPC function
    const { data, error } = await supabase.rpc("rpc_sales_claim_lead", {
      p_idempotency_key: idempotencyKey,
      p_lead_id: id === "next" ? null : id, // "next" means get any available lead
    });

    if (error) {
      console.error("Error in claim RPC:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = data as {
      success: boolean;
      error?: string;
      lead_id?: string;
      account_id?: string;
      opportunity_id?: string;
      activity_id?: string;
    };

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in POST /api/crm/leads/[id]/claim:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

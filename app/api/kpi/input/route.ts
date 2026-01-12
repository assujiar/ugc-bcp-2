import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";

// GET /api/kpi/input - Get manual input data
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "activity"; // activity, spend
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    if (type === "activity") {
      let query = supabase
        .from("marketing_activity_events")
        .select("*")
        .eq("created_by", profile.user_id)
        .order("activity_date", { ascending: false });

      if (startDate) query = query.gte("activity_date", startDate);
      if (endDate) query = query.lte("activity_date", endDate);

      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json({ data });
    }

    if (type === "spend") {
      let query = supabase
        .from("marketing_spend")
        .select("*")
        .eq("created_by", profile.user_id)
        .order("spend_date", { ascending: false });

      if (startDate) query = query.gte("spend_date", startDate);
      if (endDate) query = query.lte("spend_date", endDate);

      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error: any) {
    console.error("Error in GET /api/kpi/input:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/kpi/input - Create manual input
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is marketing role
    const marketingRoles = [
      "super admin",
      "Marketing Manager",
      "Marcomm (marketing staff)",
      "DGO (Marketing staff)",
      "MACX (marketing staff)",
      "VSDO (marketing staff)",
    ];

    if (!marketingRoles.includes(profile.role_name)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { type, ...inputData } = body;

    if (type === "activity") {
      const { activity_name, channel, activity_date, quantity, notes } = inputData;

      if (!activity_name || !activity_date || quantity === undefined) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("marketing_activity_events")
        .insert({
          activity_name,
          channel: channel || null,
          activity_date,
          quantity,
          notes: notes || null,
          created_by: profile.user_id,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ data }, { status: 201 });
    }

    if (type === "spend") {
      const { channel, spend_date, amount, campaign_name, notes } = inputData;

      if (!channel || !spend_date || amount === undefined) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("marketing_spend")
        .insert({
          channel,
          spend_date,
          amount,
          campaign_name: campaign_name || null,
          notes: notes || null,
          created_by: profile.user_id,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ data }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error: any) {
    console.error("Error in POST /api/kpi/input:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/kpi/input - Delete manual input
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const id = searchParams.get("id");

    if (!type || !id) {
      return NextResponse.json({ error: "type and id are required" }, { status: 400 });
    }

    const table = type === "activity" ? "marketing_activity_events" : "marketing_spend";

    // Verify ownership
    const { data: existing } = await supabase
      .from(table)
      .select("created_by")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (existing.created_by !== profile.user_id && profile.role_name !== "super admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in DELETE /api/kpi/input:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

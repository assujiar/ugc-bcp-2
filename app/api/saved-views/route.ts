// app/api/saved-views/route.ts
// Saved Views API - CRUD operations

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// GET /api/saved-views - List saved views for a module
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const module = searchParams.get("module");

    let query = supabase
      .from("saved_views")
      .select("*")
      .eq("created_by", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (module) {
      query = query.eq("module", module);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching saved views:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err) {
    console.error("Saved views API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/saved-views - Create a new saved view
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { module, view_name, filter_json, is_default } = body;

    if (!module || !view_name) {
      return NextResponse.json(
        { error: "Module and view_name are required" },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults first
    if (is_default) {
      await supabase
        .from("saved_views")
        .update({ is_default: false })
        .eq("created_by", user.id)
        .eq("module", module);
    }

    const { data, error } = await supabase
      .from("saved_views")
      .insert({
        module,
        view_name,
        filter_json: filter_json || {},
        is_default: is_default || false,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating saved view:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Saved views POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

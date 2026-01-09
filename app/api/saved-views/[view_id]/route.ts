// app/api/saved-views/[view_id]/route.ts
// Saved Views API - Update/Delete individual view

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// PATCH /api/saved-views/[view_id] - Update a saved view
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ view_id: string }> }
) {
  try {
    const { view_id } = await params;
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { view_name, filter_json, is_default } = body;

    // Get the view first to check ownership and module
    const { data: existingView, error: fetchError } = await supabase
      .from("saved_views")
      .select("*")
      .eq("view_id", parseInt(view_id))
      .eq("created_by", user.id)
      .single();

    if (fetchError || !existingView) {
      return NextResponse.json({ error: "View not found" }, { status: 404 });
    }

    // If setting as default, unset other defaults first
    if (is_default) {
      await supabase
        .from("saved_views")
        .update({ is_default: false })
        .eq("created_by", user.id)
        .eq("module", existingView.module)
        .neq("view_id", parseInt(view_id));
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (view_name !== undefined) updateData.view_name = view_name;
    if (filter_json !== undefined) updateData.filter_json = filter_json;
    if (is_default !== undefined) updateData.is_default = is_default;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("saved_views")
      .update(updateData)
      .eq("view_id", parseInt(view_id))
      .eq("created_by", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating saved view:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Saved views PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/saved-views/[view_id] - Delete a saved view
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ view_id: string }> }
) {
  try {
    const { view_id } = await params;
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("saved_views")
      .delete()
      .eq("view_id", parseInt(view_id))
      .eq("created_by", user.id);

    if (error) {
      console.error("Error deleting saved view:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Saved views DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// app/api/users/manage/[user_id]/route.ts
// User Management API - Update user

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// PATCH /api/users/manage/[user_id] - Update a user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ user_id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user profile to check permissions
    const { data: profile } = await supabase
      .from("profiles")
      .select("role_name, dept_code")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    // Only super admin and Marketing Manager can update users
    const allowedRoles = ["super admin", "Marketing Manager"];
    if (!allowedRoles.includes(profile.role_name)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { user_id } = await params;
    const body = await request.json();

    const { full_name, role_name, dept_code } = body;

    // Marketing Manager can only update marketing roles
    if (profile.role_name === "Marketing Manager") {
      const marketingRoles = [
        "Marketing Manager",
        "Marcomm (marketing staff)",
        "DGO (Marketing staff)",
        "MACX (marketing staff)",
        "VSDO (marketing staff)",
      ];

      // Check if target user is in marketing
      const { data: targetUser } = await supabase
        .from("profiles")
        .select("role_name")
        .eq("user_id", user_id)
        .single();

      if (!targetUser || !marketingRoles.includes(targetUser.role_name)) {
        return NextResponse.json(
          { error: "Can only update marketing team members" },
          { status: 403 }
        );
      }

      // Check if new role is also marketing
      if (role_name && !marketingRoles.includes(role_name)) {
        return NextResponse.json(
          { error: "Can only assign marketing roles" },
          { status: 403 }
        );
      }
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (full_name !== undefined) updateData.full_name = full_name;
    if (role_name !== undefined) updateData.role_name = role_name;
    if (dept_code !== undefined) updateData.dept_code = dept_code;

    const { data, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("user_id", user_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating user:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log to audit
    await supabase.from("audit_logs").insert({
      table_name: "profiles",
      record_id: user_id,
      action: "UPDATE",
      changed_by: user.id,
      after_data: updateData,
    });

    return NextResponse.json({ data });
  } catch (err) {
    console.error("User management API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

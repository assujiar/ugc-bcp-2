// app/api/users/manage/route.ts
// User Management API - List all users (for admins)

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// GET /api/users/manage - List all users (admin only)
export async function GET(request: NextRequest) {
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

    // Only super admin and Marketing Manager can list all users
    const allowedRoles = ["super admin", "Marketing Manager"];
    if (!allowedRoles.includes(profile.role_name)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const role = searchParams.get("role");
    const dept = searchParams.get("dept");

    let query = supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    // Marketing Manager can only see marketing roles
    if (profile.role_name === "Marketing Manager") {
      query = query.in("role_name", [
        "Marketing Manager",
        "Marcomm (marketing staff)",
        "DGO (Marketing staff)",
        "MACX (marketing staff)",
        "VSDO (marketing staff)",
      ]);
    }

    // Apply filters
    if (role) {
      query = query.eq("role_name", role);
    }
    if (dept) {
      query = query.eq("dept_code", dept);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching users:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err) {
    console.error("User management API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

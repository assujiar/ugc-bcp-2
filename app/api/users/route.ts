// app/api/users/route.ts
// Users API - List users by role

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// GET /api/users - List users (optionally by role)
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

    // Only certain roles can list users
    const allowedRoles = [
      "super admin",
      "Marketing Manager",
      "sales manager",
      "Director",
    ];
    if (!allowedRoles.includes(profile.role_name)) {
      return NextResponse.json({ error: "Not authorized to list users" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const role = searchParams.get("role");
    const dept = searchParams.get("dept");

    let query = supabase
      .from("profiles")
      .select("user_id, user_code, full_name, role_name, dept_code")
      .order("full_name");

    // Filter by role
    if (role) {
      if (role === "salesperson") {
        query = query.in("role_name", ["salesperson", "sales support"]);
      } else if (role === "marketing") {
        query = query.in("role_name", [
          "Marketing Manager",
          "Marcomm (marketing staff)",
          "DGO (Marketing staff)",
          "MACX (marketing staff)",
          "VSDO (marketing staff)",
        ]);
      } else {
        query = query.eq("role_name", role);
      }
    }

    // Filter by department
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
    console.error("Users API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

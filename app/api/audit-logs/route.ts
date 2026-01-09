// app/api/audit-logs/route.ts
// Audit Logs API - List audit logs (super admin only)

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// GET /api/audit-logs - List audit logs
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
      .select("role_name")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role_name !== "super admin") {
      return NextResponse.json(
        { error: "Only super admin can view audit logs" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");
    const tableName = searchParams.get("table_name");
    const action = searchParams.get("action");
    const search = searchParams.get("search");

    const offset = (page - 1) * pageSize;

    let query = supabase
      .from("audit_logs")
      .select(`
        *,
        changer:profiles!audit_logs_changed_by_fkey(full_name, role_name)
      `)
      .order("changed_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (tableName) {
      query = query.eq("table_name", tableName);
    }
    if (action) {
      query = query.eq("action", action);
    }
    if (search) {
      query = query.ilike("record_id", `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching audit logs:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err) {
    console.error("Audit logs API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

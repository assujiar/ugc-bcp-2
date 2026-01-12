// app/api/invoices/[invoice_id]/route.ts
// Invoice API - Get individual invoice

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// GET /api/invoices/[invoice_id] - Get a single invoice with customer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoice_id: string }> }
) {
  try {
    const { invoice_id } = await params;
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("invoices")
      .select(`
        *,
        customer:customers(customer_id, company_name, pic_name, pic_email)
      `)
      .eq("invoice_id", invoice_id)
      .single();

    if (error) {
      console.error("Error fetching invoice:", error);
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Invoice GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/invoices/[invoice_id] - Update invoice (finance only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ invoice_id: string }> }
) {
  try {
    const { invoice_id } = await params;
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role_name")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    // Only finance and super admin can update invoices
    if (profile.role_name !== "finance" && profile.role_name !== "super admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await request.json();
    const { due_date, notes } = body;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    if (due_date !== undefined) updateData.due_date = due_date;
    if (notes !== undefined) updateData.notes = notes || null;

    const { data, error } = await supabase
      .from("invoices")
      .update(updateData)
      .eq("invoice_id", invoice_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating invoice:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Invoice PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

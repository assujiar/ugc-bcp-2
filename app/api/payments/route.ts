// app/api/payments/route.ts
// Payments list & create API - BFF/Proxy layer

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";

// GET /api/payments - List all payments
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only finance, super admin, director, and sales can view payments
    const allowedRoles = [
      "finance",
      "super admin",
      "Director",
      "sales manager",
      "salesperson",
    ];
    if (!allowedRoles.includes(profile.role_name)) {
      return NextResponse.json({ error: "Not authorized to view payments" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

    let query = supabase
      .from("payments")
      .select(
        `
        *,
        invoice:invoices(
          invoice_id,
          invoice_amount,
          customer:customers(customer_id, company_name)
        )
      `,
        { count: "exact" }
      )
      .order("payment_date", { ascending: false });

    // Search by invoice_id or reference_no
    if (search) {
      query = query.or(`invoice_id.ilike.%${search}%,reference_no.ilike.%${search}%`);
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching payments:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (err) {
    console.error("Payments API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/payments - Create payment
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only finance and super admin can create payments
    if (profile.role_name !== "finance" && profile.role_name !== "super admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { invoice_id, payment_date, amount, payment_method, reference_no, notes } = body;

    // Validate required fields
    if (!invoice_id || !payment_date || !amount) {
      return NextResponse.json({ error: "Missing required fields: invoice_id, payment_date, amount" }, { status: 400 });
    }

    // Verify invoice exists
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("invoice_id, invoice_amount")
      .eq("invoice_id", invoice_id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Create payment
    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        invoice_id,
        payment_date,
        amount: parseFloat(amount),
        payment_method: payment_method || null,
        reference_no: reference_no || null,
        notes: notes || null,
        created_by: profile.user_id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating payment:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "payments",
      record_id: payment.payment_id.toString(),
      action: "INSERT",
      changed_by: profile.user_id,
      after_data: payment,
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (err) {
    console.error("Payments API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

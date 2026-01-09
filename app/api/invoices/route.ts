import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";

// GET /api/invoices - List invoices with AR data
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || ""; // paid, outstanding, overdue
    const customerId = searchParams.get("customer_id") || "";
    const sortBy = searchParams.get("sortBy") || "invoice_date";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Use outstanding view for AR data
    let query = supabase
      .from("v_invoice_outstanding")
      .select("*", { count: "exact" });

    // Join with customers for company name
    // Note: v_invoice_outstanding already has customer_id

    // Apply filters
    if (search) {
      query = query.or(`invoice_id.ilike.%${search}%,customer_id.ilike.%${search}%`);
    }
    if (status === "paid") {
      query = query.eq("outstanding_amount", 0);
    } else if (status === "outstanding") {
      query = query.gt("outstanding_amount", 0).eq("is_overdue", false);
    } else if (status === "overdue") {
      query = query.eq("is_overdue", true);
    }
    if (customerId) {
      query = query.eq("customer_id", customerId);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: invoices, error, count } = await query;

    if (error) {
      console.error("Error fetching invoices:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get customer names for the invoices
    const customerIds = [...new Set(invoices?.map((inv) => inv.customer_id) || [])];
    const { data: customers } = await supabase
      .from("customers")
      .select("customer_id, company_name")
      .in("customer_id", customerIds);

    const customerMap = new Map(customers?.map((c) => [c.customer_id, c.company_name]) || []);

    // Enrich invoices with customer names
    const enrichedInvoices = invoices?.map((inv) => ({
      ...inv,
      company_name: customerMap.get(inv.customer_id) || "Unknown",
    }));

    return NextResponse.json({
      data: enrichedInvoices,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    console.error("Error in GET /api/invoices:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/invoices - Create invoice
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only finance and super admin can create invoices
    if (profile.role_name !== "finance" && profile.role_name !== "super admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { customer_id, invoice_date, due_date, invoice_amount, currency, notes } = body;

    // Validate required fields
    if (!customer_id || !invoice_date || !due_date || !invoice_amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Create invoice
    const { data: invoice, error } = await supabase
      .from("invoices")
      .insert({
        customer_id,
        invoice_date,
        due_date,
        invoice_amount: parseFloat(invoice_amount),
        currency: currency || "IDR",
        notes: notes || null,
        created_by: profile.user_id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating invoice:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "invoices",
      record_id: invoice.invoice_id,
      action: "INSERT",
      changed_by: profile.user_id,
      after_data: invoice,
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/invoices:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/invoices - Update invoice
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only finance and super admin can update invoices
    if (profile.role_name !== "finance" && profile.role_name !== "super admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { invoice_id, ...updateData } = body;

    if (!invoice_id) {
      return NextResponse.json({ error: "invoice_id is required" }, { status: 400 });
    }

    // Get existing invoice for audit
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("*")
      .eq("invoice_id", invoice_id)
      .single();

    // Update invoice
    const { data: invoice, error } = await supabase
      .from("invoices")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("invoice_id", invoice_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating invoice:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "invoices",
      record_id: invoice_id,
      action: "UPDATE",
      changed_by: profile.user_id,
      before_data: existingInvoice,
      after_data: invoice,
    });

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error("Error in PATCH /api/invoices:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/invoices - Delete invoice (super admin only)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (profile.role_name !== "super admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get("invoice_id");

    if (!invoiceId) {
      return NextResponse.json({ error: "invoice_id is required" }, { status: 400 });
    }

    // Get invoice for audit
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("*")
      .eq("invoice_id", invoiceId)
      .single();

    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("invoice_id", invoiceId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "invoices",
      record_id: invoiceId,
      action: "DELETE",
      changed_by: profile.user_id,
      before_data: existingInvoice,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/invoices:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

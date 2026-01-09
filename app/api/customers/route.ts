import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";

// GET /api/customers - List customers
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
    const sortBy = searchParams.get("sortBy") || "created_at";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    let query = supabase
      .from("customers")
      .select("*", { count: "exact" });

    // Apply search filter
    if (search) {
      query = query.or(`company_name.ilike.%${search}%,pic_name.ilike.%${search}%,pic_email.ilike.%${search}%,npwp.ilike.%${search}%`);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching customers:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    console.error("Error in GET /api/customers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/customers - Create customer
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check role permission
    const allowedRoles = [
      "super admin",
      "Marketing Manager",
      "sales manager",
      "salesperson",
      "sales support",
    ];

    if (!allowedRoles.includes(profile.role_name)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      company_name,
      npwp,
      pic_name,
      pic_phone,
      pic_email,
      address,
      city,
      country,
    } = body;

    // Validate required fields
    if (!company_name || !pic_name || !pic_phone || !pic_email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Create customer
    const { data: customer, error } = await supabase
      .from("customers")
      .insert({
        company_name,
        npwp: npwp || null,
        pic_name,
        pic_phone,
        pic_email,
        address: address || null,
        city: city || null,
        country: country || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating customer:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "customers",
      record_id: customer.customer_id,
      action: "INSERT",
      changed_by: profile.user_id,
      after_data: customer,
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/customers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/customers - Update customer
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { customer_id, ...updateData } = body;

    if (!customer_id) {
      return NextResponse.json({ error: "customer_id is required" }, { status: 400 });
    }

    // Get existing customer for audit
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("*")
      .eq("customer_id", customer_id)
      .single();

    // Update customer (RLS will enforce permissions)
    const { data: customer, error } = await supabase
      .from("customers")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("customer_id", customer_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating customer:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "customers",
      record_id: customer_id,
      action: "UPDATE",
      changed_by: profile.user_id,
      before_data: existingCustomer,
      after_data: customer,
    });

    return NextResponse.json({ customer });
  } catch (error) {
    console.error("Error in PATCH /api/customers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

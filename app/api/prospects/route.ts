import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";

// GET /api/prospects - List prospects
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "50", 10);
    const search = searchParams.get("search") || "";
    const stage = searchParams.get("stage") || "";
    const ownerId = searchParams.get("owner_id") || "";

    let query = supabase
      .from("prospects")
      .select(`
        *,
        customers (customer_id, company_name, pic_name, pic_email, pic_phone),
        owner:profiles!prospects_owner_user_id_fkey (user_id, full_name, role_name)
      `, { count: "exact" });

    // Apply filters
    if (stage) {
      query = query.eq("current_stage", stage);
    }
    if (ownerId) {
      query = query.eq("owner_user_id", ownerId);
    }
    if (search) {
      // Search in related customer company name
      query = query.or(`prospect_id.ilike.%${search}%`);
    }

    // Apply sorting
    query = query.order("created_at", { ascending: false });

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching prospects:", error);
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
    console.error("Error in GET /api/prospects:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/prospects - Create new prospect
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
      "Marcomm (marketing staff)",
      "DGO (Marketing staff)",
      "MACX (marketing staff)",
      "VSDO (marketing staff)",
      "sales manager",
      "salesperson",
      "sales support",
    ];

    if (!allowedRoles.includes(profile.role_name)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      customer_id,
      company_name,
      pic_name,
      pic_email,
      pic_phone,
      owner_user_id,
      current_stage,
    } = body;

    let finalCustomerId = customer_id;

    // If no customer_id, create a new customer first
    if (!finalCustomerId && company_name && pic_name && pic_email && pic_phone) {
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          company_name,
          pic_name,
          pic_email,
          pic_phone,
        })
        .select()
        .single();

      if (customerError) {
        console.error("Error creating customer:", customerError);
        return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
      }

      finalCustomerId = newCustomer.customer_id;
    }

    if (!finalCustomerId) {
      return NextResponse.json({ error: "customer_id or customer details required" }, { status: 400 });
    }

    // Create prospect
    const { data: prospect, error } = await supabase
      .from("prospects")
      .insert({
        customer_id: finalCustomerId,
        owner_user_id: owner_user_id || profile.user_id,
        current_stage: current_stage || "Prospect Created",
      })
      .select(`
        *,
        customers (customer_id, company_name, pic_name, pic_email, pic_phone),
        owner:profiles!prospects_owner_user_id_fkey (user_id, full_name, role_name)
      `)
      .single();

    if (error) {
      console.error("Error creating prospect:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "prospects",
      record_id: prospect.prospect_id,
      action: "INSERT",
      changed_by: profile.user_id,
      after_data: prospect,
    });

    return NextResponse.json({ prospect }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/prospects:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/prospects - Update prospect (stage change, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { prospect_id, current_stage, owner_user_id } = body;

    if (!prospect_id) {
      return NextResponse.json({ error: "prospect_id is required" }, { status: 400 });
    }

    // Get existing prospect for audit
    const { data: existingProspect } = await supabase
      .from("prospects")
      .select("*")
      .eq("prospect_id", prospect_id)
      .single();

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (current_stage) {
      updateData.current_stage = current_stage;
    }
    if (owner_user_id) {
      updateData.owner_user_id = owner_user_id;
    }

    // Update prospect (RLS will enforce permissions)
    const { data: prospect, error } = await supabase
      .from("prospects")
      .update(updateData)
      .eq("prospect_id", prospect_id)
      .select(`
        *,
        customers (customer_id, company_name, pic_name, pic_email, pic_phone),
        owner:profiles!prospects_owner_user_id_fkey (user_id, full_name, role_name)
      `)
      .single();

    if (error) {
      console.error("Error updating prospect:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "prospects",
      record_id: prospect_id,
      action: "UPDATE",
      changed_by: profile.user_id,
      before_data: existingProspect,
      after_data: prospect,
    });

    return NextResponse.json({ prospect });
  } catch (error) {
    console.error("Error in PATCH /api/prospects:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

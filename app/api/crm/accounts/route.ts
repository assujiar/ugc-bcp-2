import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { z } from "zod";

const createAccountSchema = z.object({
  company_name: z.string().min(1),
  npwp: z.string().optional(),
  pic_name: z.string().min(1),
  pic_phone: z.string().min(1),
  pic_email: z.string().email(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  domain: z.string().optional(),
  industry: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// GET /api/crm/accounts - List accounts
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
    const search = searchParams.get("search");
    const view = searchParams.get("view"); // enriched, all

    // Use enriched view if requested
    const table = view === "enriched" ? "v_accounts_enriched" : "accounts";

    let query = supabase
      .from(table)
      .select("*", { count: "exact" })
      .eq("is_active", true);

    // Apply search
    if (search) {
      query = query.or(`company_name.ilike.%${search}%,pic_name.ilike.%${search}%,domain.ilike.%${search}%`);
    }

    // Order by company name
    query = query.order("company_name", { ascending: true });

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching accounts:", error);
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
    console.error("Error in GET /api/crm/accounts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/crm/accounts - Create new account
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createAccountSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: "Validation error",
        details: validation.error.issues
      }, { status: 400 });
    }

    const accountData = validation.data;

    const { data: account, error } = await supabase
      .from("accounts")
      .insert({
        ...accountData,
        owner_user_id: profile.user_id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating account:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "accounts",
      record_id: account.account_id,
      action: "INSERT",
      changed_by: profile.user_id,
      after_data: account,
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/crm/accounts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { z } from "zod";

const createQuoteSchema = z.object({
  opportunity_id: z.string(),
  account_id: z.string(),
  valid_until: z.string().optional(),
  total_amount: z.number().optional(),
  currency: z.string().optional(),
  terms: z.string().optional(),
  notes: z.string().optional(),
  file_url: z.string().optional(),
});

// GET /api/crm/quotes - List quotes
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const opportunityId = searchParams.get("opportunity_id");
    const accountId = searchParams.get("account_id");
    const status = searchParams.get("status");

    let query = supabase
      .from("quotes")
      .select(`
        *,
        opportunity:opportunities!quotes_opportunity_id_fkey (opportunity_id, name, stage),
        account:accounts!quotes_account_id_fkey (account_id, company_name)
      `);

    if (opportunityId) {
      query = query.eq("opportunity_id", opportunityId);
    }
    if (accountId) {
      query = query.eq("account_id", accountId);
    }
    if (status) {
      query = query.eq("status", status);
    }

    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching quotes:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error in GET /api/crm/quotes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/crm/quotes - Create quote (with auto-versioning)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createQuoteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: "Validation error",
        details: validation.error.issues
      }, { status: 400 });
    }

    const quoteData = validation.data;

    // Get the latest version for this opportunity
    const { data: latestQuote } = await supabase
      .from("quotes")
      .select("version")
      .eq("opportunity_id", quoteData.opportunity_id)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    const nextVersion = (latestQuote?.version || 0) + 1;

    const { data: quote, error } = await supabase
      .from("quotes")
      .insert({
        ...quoteData,
        version: nextVersion,
        status: "Draft",
        created_by: profile.user_id,
      })
      .select(`
        *,
        opportunity:opportunities!quotes_opportunity_id_fkey (opportunity_id, name),
        account:accounts!quotes_account_id_fkey (account_id, company_name)
      `)
      .single();

    if (error) {
      console.error("Error creating quote:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "quotes",
      record_id: quote.quote_id,
      action: "INSERT",
      changed_by: profile.user_id,
      after_data: quote,
    });

    return NextResponse.json({ quote }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/crm/quotes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

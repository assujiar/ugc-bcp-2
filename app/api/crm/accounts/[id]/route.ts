import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { apiSuccess, apiErrors } from "@/lib/api/error";

// GET /api/crm/accounts/[id] - Get account 360 view
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return apiErrors.unauthorized();
    }

    const { id } = await params;

    // Get account with enriched data
    const { data: account, error: accountError } = await supabase
      .from("v_accounts_enriched")
      .select("*")
      .eq("account_id", id)
      .single();

    if (accountError) {
      return apiErrors.notFound("Account");
    }

    // Get contacts
    const { data: contacts } = await supabase
      .from("contacts")
      .select("*")
      .eq("account_id", id)
      .order("is_primary", { ascending: false });

    // Get opportunities
    const { data: opportunities } = await supabase
      .from("opportunities")
      .select(`
        *,
        owner:profiles!opportunities_owner_user_id_fkey (full_name)
      `)
      .eq("account_id", id)
      .order("created_at", { ascending: false });

    // Get recent activities
    const { data: activities } = await supabase
      .from("activities")
      .select(`
        *,
        owner:profiles!activities_owner_user_id_fkey (full_name)
      `)
      .eq("related_account_id", id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Get quotes
    const { data: quotes } = await supabase
      .from("quotes")
      .select("*")
      .eq("account_id", id)
      .order("created_at", { ascending: false });

    // Get invoice summary
    const { data: invoiceSummary } = await supabase
      .from("v_ar_aging")
      .select("*")
      .eq("account_id", id)
      .single();

    // Get shipment profiles
    const { data: shipmentProfiles } = await supabase
      .from("shipment_profiles")
      .select("*")
      .eq("account_id", id)
      .eq("is_active", true);

    return apiSuccess({
      data: {
        account,
        contacts: contacts || [],
        opportunities: opportunities || [],
        activities: activities || [],
        quotes: quotes || [],
        invoiceSummary: invoiceSummary || null,
        shipmentProfiles: shipmentProfiles || [],
      },
    });
  } catch (error) {
    console.error("Error in GET /api/crm/accounts/[id]:", error);
    return apiErrors.internal();
  }
}

// PATCH /api/crm/accounts/[id] - Update account
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return apiErrors.unauthorized();
    }

    const { id } = await params;
    const body = await request.json();

    // Get existing account for audit
    const { data: existingAccount } = await supabase
      .from("accounts")
      .select("*")
      .eq("account_id", id)
      .single();

    const { data: account, error } = await supabase
      .from("accounts")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("account_id", id)
      .select()
      .single();

    if (error) {
      return apiErrors.internal(error.message);
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "accounts",
      record_id: id,
      action: "UPDATE",
      changed_by: profile.user_id,
      before_data: existingAccount,
      after_data: account,
    });

    return apiSuccess({ data: { account } });
  } catch (error) {
    console.error("Error in PATCH /api/crm/accounts/[id]:", error);
    return apiErrors.internal();
  }
}

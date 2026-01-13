import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { apiSuccess, apiErrors } from "@/lib/api/error";

// GET /api/crm/opportunities/[id] - Get single opportunity with related data
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

    // Fetch opportunity with account and owner
    const { data: opportunity, error: oppError } = await supabase
      .from("opportunities")
      .select(`
        *,
        account:accounts!opportunities_account_id_fkey (
          account_id,
          company_name,
          domain,
          city,
          pic_name,
          pic_phone,
          pic_email,
          tenure_status,
          activity_status
        ),
        owner:profiles!opportunities_owner_user_id_fkey (
          user_id,
          full_name,
          role_name
        ),
        source_lead:leads!opportunities_source_lead_id_fkey (
          lead_id,
          company_name,
          pic_name,
          service_code,
          primary_channel,
          campaign_name
        )
      `)
      .eq("opportunity_id", id)
      .single();

    if (oppError || !opportunity) {
      console.error("Error fetching opportunity:", oppError);
      return apiErrors.notFound("Opportunity");
    }

    // Fetch related activities
    const { data: activities } = await supabase
      .from("activities")
      .select(`
        activity_id,
        activity_type,
        status,
        subject,
        description,
        due_date,
        completed_at,
        outcome,
        owner:profiles!activities_owner_user_id_fkey (user_id, full_name)
      `)
      .eq("related_opportunity_id", id)
      .order("due_date", { ascending: true })
      .limit(50);

    // Fetch contacts for the account
    const { data: contacts } = await supabase
      .from("contacts")
      .select(`
        contact_id,
        first_name,
        last_name,
        title,
        email,
        phone,
        is_primary,
        is_decision_maker
      `)
      .eq("account_id", opportunity.account_id)
      .order("is_primary", { ascending: false })
      .limit(20);

    // Fetch stage history (from crm_transition_logs with actor info)
    const { data: stageHistory } = await supabase
      .from("crm_transition_logs")
      .select(`
        id,
        action,
        action_label,
        from_state,
        to_state,
        changed_fields,
        actor_name,
        actor_role,
        created_at,
        correlation_id
      `)
      .eq("entity", "opportunities")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(20);

    return apiSuccess({
      data: {
        opportunity,
        activities: activities || [],
        contacts: contacts || [],
        stageHistory: stageHistory || [],
      },
    });
  } catch (error) {
    console.error("Error in GET /api/crm/opportunities/[id]:", error);
    return apiErrors.internal();
  }
}

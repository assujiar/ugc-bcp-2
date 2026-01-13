import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { apiSuccess, apiErrors } from "@/lib/api/error";

const convertLeadSchema = z.object({
  next_step: z.string().optional(),
  next_step_due_date: z.string().optional(),
});

// Standard sales cadence template (activities to seed)
const CADENCE_TEMPLATE = [
  { dayOffset: 0, type: "Call", subject: "Initial contact call" },
  { dayOffset: 2, type: "Email", subject: "Follow-up email with proposal" },
  { dayOffset: 5, type: "Call", subject: "Check-in call" },
  { dayOffset: 10, type: "Email", subject: "Value proposition follow-up" },
  { dayOffset: 14, type: "Call", subject: "Decision timeline discussion" },
];

// POST /api/crm/leads/[id]/convert - Convert lead to opportunity with cadence
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return apiErrors.unauthorized();
    }

    // Check if user is sales team
    const salesRoles = [
      "Director", "super admin", "sales manager", "salesperson", "sales support"
    ];
    if (!salesRoles.includes(profile.role_name)) {
      return apiErrors.forbidden("Only sales team can convert leads");
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const validation = convertLeadSchema.safeParse(body);

    if (!validation.success) {
      return apiErrors.validation("Invalid request body", validation.error.issues);
    }

    // Fetch lead with account info
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(`
        *,
        owner:profiles!leads_sales_owner_user_id_fkey (user_id, full_name)
      `)
      .eq("lead_id", id)
      .single();

    if (leadError || !lead) {
      return apiErrors.notFound("Lead");
    }

    // Verify ownership - must be claimed by current user
    if (lead.sales_owner_user_id !== profile.user_id) {
      return apiErrors.forbidden("You can only convert leads assigned to you");
    }

    // Check if already converted (has opportunity and status is Closed Won)
    if (lead.status === "Closed Won" && lead.opportunity_id) {
      return apiSuccess({
        data: {
          success: true,
          already_converted: true,
          lead_id: lead.lead_id,
          opportunity_id: lead.opportunity_id,
          message: "Lead was already converted",
        },
      });
    }

    let opportunityId = lead.opportunity_id;
    let accountId: string | null = null;

    // If no opportunity exists, create one
    if (!opportunityId) {
      // Find or create account
      const { data: existingAccount } = await supabase
        .from("accounts")
        .select("account_id")
        .ilike("company_name", lead.company_name)
        .limit(1)
        .single();

      if (existingAccount) {
        accountId = existingAccount.account_id;
      } else {
        // Create account
        const { data: newAccount, error: accountError } = await supabase
          .from("accounts")
          .insert({
            company_name: lead.company_name,
            pic_name: lead.pic_name,
            pic_email: lead.email,
            pic_phone: lead.contact_phone,
            owner_user_id: profile.user_id,
            city: lead.city_area,
          })
          .select("account_id")
          .single();

        if (accountError) {
          console.error("Error creating account:", accountError);
          return apiErrors.internal("Failed to create account");
        }
        accountId = newAccount.account_id;
      }

      // Create opportunity
      const { data: newOpp, error: oppError } = await supabase
        .from("opportunities")
        .insert({
          account_id: accountId,
          name: `${lead.company_name} - ${lead.service_code || "Opportunity"}`,
          owner_user_id: profile.user_id,
          source_lead_id: lead.lead_id,
          service_codes: lead.service_code ? [lead.service_code] : [],
          route: lead.route,
          next_step: validation.data.next_step || "Initial contact",
          next_step_due_date: validation.data.next_step_due_date ||
            new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          stage: "Prospecting",
          created_by: profile.user_id,
        })
        .select("opportunity_id, account_id")
        .single();

      if (oppError) {
        console.error("Error creating opportunity:", oppError);
        return apiErrors.internal("Failed to create opportunity");
      }

      opportunityId = newOpp.opportunity_id;
      accountId = newOpp.account_id;
    } else {
      // Get account from existing opportunity
      const { data: existingOpp } = await supabase
        .from("opportunities")
        .select("account_id")
        .eq("opportunity_id", opportunityId)
        .single();

      accountId = existingOpp?.account_id || null;
    }

    // Seed cadence activities
    const today = new Date();
    const activities = CADENCE_TEMPLATE.map((template) => {
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + template.dayOffset);

      return {
        activity_type: template.type,
        status: "Planned",
        subject: `${template.subject}: ${lead.company_name}`,
        related_account_id: accountId,
        related_opportunity_id: opportunityId,
        related_lead_id: lead.lead_id,
        due_date: dueDate.toISOString().split("T")[0],
        owner_user_id: profile.user_id,
        created_by: profile.user_id,
      };
    });

    // Insert activities (skip if already exists with same subject for today)
    const { data: insertedActivities, error: actError } = await supabase
      .from("activities")
      .insert(activities)
      .select("activity_id");

    if (actError) {
      console.error("Error seeding activities:", actError);
      // Continue anyway - activities are secondary
    }

    // Update lead status to Closed Won and link opportunity
    const { error: updateError } = await supabase
      .from("leads")
      .update({
        status: "Closed Won",
        opportunity_id: opportunityId,
        updated_at: new Date().toISOString(),
      })
      .eq("lead_id", lead.lead_id);

    if (updateError) {
      console.error("Error updating lead:", updateError);
      return apiErrors.internal("Failed to update lead status");
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "leads",
      record_id: lead.lead_id,
      action: "UPDATE",
      changed_by: profile.user_id,
      before_data: { status: lead.status, opportunity_id: lead.opportunity_id },
      after_data: { status: "Closed Won", opportunity_id: opportunityId },
    });

    // Log CRM transition audit (ignore if table doesn't exist)
    try {
      await supabase.from("crm_audit_log").insert({
        action: "LEAD_CONVERTED",
        entity_type: "lead",
        entity_id: lead.lead_id,
        changed_by: profile.user_id,
        old_values: { status: lead.status },
        new_values: {
          status: "Closed Won",
          opportunity_id: opportunityId,
          activities_seeded: insertedActivities?.length || 0,
        },
      });
    } catch {
      // Ignore if crm_audit_log doesn't exist
    }

    return apiSuccess({
      data: {
        success: true,
        lead_id: lead.lead_id,
        opportunity_id: opportunityId,
        account_id: accountId,
        activities_created: insertedActivities?.length || 0,
        message: "Lead converted successfully",
      },
    });
  } catch (error) {
    console.error("Error in POST /api/crm/leads/[id]/convert:", error);
    return apiErrors.internal();
  }
}

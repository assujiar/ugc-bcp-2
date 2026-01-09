// app/api/leads/[lead_id]/assign/route.ts
// Lead Handover/Assignment API
// Marketing Manager or sales manager can assign/reassign lead ownership

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";

// POST /api/leads/[lead_id]/assign - Assign lead to a new sales owner (handover)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lead_id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only Marketing Manager, sales manager, super admin can do handover
    const allowedRoles = [
      "super admin",
      "Marketing Manager",
      "sales manager",
    ];

    if (!allowedRoles.includes(profile.role_name)) {
      return NextResponse.json({ 
        error: "Only Marketing Manager or sales manager can assign leads" 
      }, { status: 403 });
    }

    const { lead_id } = await params;
    const body = await request.json();
    const { new_owner_user_id, notes } = body;

    if (!new_owner_user_id) {
      return NextResponse.json({ error: "new_owner_user_id is required" }, { status: 400 });
    }

    // Get existing lead
    const { data: existingLead, error: fetchError } = await supabase
      .from("leads")
      .select(`
        *,
        customers (customer_id, company_name)
      `)
      .eq("lead_id", lead_id)
      .single();

    if (fetchError || !existingLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Validate new owner is a valid sales role
    const { data: newOwner, error: ownerError } = await supabase
      .from("profiles")
      .select("user_id, full_name, role_name")
      .eq("user_id", new_owner_user_id)
      .single();

    if (ownerError || !newOwner) {
      return NextResponse.json({ error: "New owner not found" }, { status: 400 });
    }

    const validSalesRoles = ["sales manager", "salesperson"];
    if (!validSalesRoles.includes(newOwner.role_name) && newOwner.role_name !== "super admin") {
      return NextResponse.json({ 
        error: "New owner must be a sales role (sales manager or salesperson)" 
      }, { status: 400 });
    }

    // Start handover transaction
    const previousOwner = existingLead.sales_owner_user_id;
    const customerId = existingLead.customer_id;

    // 1. Update lead with new owner
    const { data: updatedLead, error: updateError } = await supabase
      .from("leads")
      .update({
        sales_owner_user_id: new_owner_user_id,
        updated_at: new Date().toISOString(),
        notes: notes 
          ? `${existingLead.notes || ""}\n[Handover ${new Date().toISOString()}]: ${notes}`.trim()
          : existingLead.notes,
      })
      .eq("lead_id", lead_id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating lead owner:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 2. Find or create prospect for new owner + customer combination
    let newProspectId = null;
    if (customerId) {
      const { data: prospectResult, error: prospectError } = await supabase.rpc(
        "find_or_create_prospect",
        {
          p_customer_id: customerId,
          p_owner_user_id: new_owner_user_id,
        }
      );

      if (prospectError) {
        console.error("Error creating prospect for new owner:", prospectError);
        // Don't fail the handover, just log
      } else {
        newProspectId = prospectResult;

        // Update lead's prospect_id to new prospect
        await supabase
          .from("leads")
          .update({ prospect_id: newProspectId })
          .eq("lead_id", lead_id);
      }
    }

    // 3. If there are related RFQ tickets, optionally update assignee
    // (This is optional - tickets stay with creator, but can be reassigned)
    const { data: relatedTickets } = await supabase
      .from("tickets")
      .select("ticket_id")
      .eq("related_lead_id", lead_id);

    // Note: We don't auto-reassign tickets. The new owner should claim them manually
    // or the ticket workflow handles this through dept_target routing.

    return NextResponse.json({
      success: true,
      lead: updatedLead,
      previous_owner_user_id: previousOwner,
      new_owner_user_id: new_owner_user_id,
      new_owner_name: newOwner.full_name,
      new_prospect_id: newProspectId,
      related_tickets_count: relatedTickets?.length || 0,
    }, { status: 200 });
  } catch (error) {
    console.error("Error in POST /api/leads/[lead_id]/assign:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
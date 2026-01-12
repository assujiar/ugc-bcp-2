// app/api/tickets/messages/route.ts
// Ticket Messages API - Create messages and track first response for SLA

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";

// GET /api/tickets/messages - Get messages for a ticket
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get("ticket_id");

    if (!ticketId) {
      return NextResponse.json({ error: "ticket_id is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("ticket_messages")
      .select(`
        *,
        creator:profiles!ticket_messages_created_by_fkey(full_name, role_name)
      `)
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err) {
    console.error("Messages API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/tickets/messages - Create message
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Director is read-only
    if (profile.role_name === "Director") {
      return NextResponse.json({ error: "Director has read-only access" }, { status: 403 });
    }

    const body = await request.json();
    const { ticket_id, message } = body;

    if (!ticket_id || !message) {
      return NextResponse.json({ error: "ticket_id and message are required" }, { status: 400 });
    }

    // Get ticket to check if this is first response
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("ticket_id, created_by, created_at")
      .eq("ticket_id", ticket_id)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Check if there are existing messages from non-creator
    const { data: existingMessages } = await supabase
      .from("ticket_messages")
      .select("message_id, created_by")
      .eq("ticket_id", ticket_id)
      .neq("created_by", ticket.created_by)
      .limit(1);

    const isFirstResponse = 
      existingMessages?.length === 0 && 
      profile.user_id !== ticket.created_by;

    // Create message
    // Note: SLA FIRST_RESPONSE event is now also handled by trigger (trg_sla_first_response_on_message)
    // We keep the API logic as a fallback/double-check
    const { data: newMessage, error } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id,
        message,
        created_by: profile.user_id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating message:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If this is first response, create SLA event (trigger will also try, but has dedup logic)
    if (isFirstResponse) {
      supabase.from("sla_events").insert({
        ticket_id,
        event_type: "FIRST_RESPONSE",
        metadata: { 
          responder_user_id: profile.user_id,
          response_time_minutes: Math.round(
            (new Date().getTime() - new Date(ticket.created_at).getTime()) / 60000
          ),
          source: "api",
        },
      }).then(() => {}, () => {
        // Ignore duplicate key errors - trigger may have already inserted
      });
    }

    return NextResponse.json({ 
      message: newMessage,
      is_first_response: isFirstResponse,
    }, { status: 201 });
  } catch (err) {
    console.error("Messages API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
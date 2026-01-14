// app/api/search/route.ts
// Global Search API - Search across leads, customers, tickets, invoices

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

interface SearchResult {
  type: "lead" | "account" | "ticket" | "invoice";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim();

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const results: SearchResult[] = [];
    const searchPattern = `%${query}%`;

    // Search leads
    const { data: leads } = await supabase
      .from("leads")
      .select("lead_id, company_name, pic_name, primary_channel")
      .or(`lead_id.ilike.${searchPattern},company_name.ilike.${searchPattern},pic_name.ilike.${searchPattern}`)
      .limit(5);

    if (leads) {
      leads.forEach((lead) => {
        results.push({
          type: "lead",
          id: lead.lead_id,
          title: lead.company_name,
          subtitle: `${lead.lead_id} • ${lead.primary_channel}`,
          href: `/crm/leads/${lead.lead_id}`,
        });
      });
    }

    // Search accounts (formerly customers)
    const { data: accounts } = await supabase
      .from("accounts")
      .select("account_id, company_name, pic_name, pic_email")
      .or(`account_id.ilike.${searchPattern},company_name.ilike.${searchPattern},pic_name.ilike.${searchPattern}`)
      .limit(5);

    if (accounts) {
      accounts.forEach((account) => {
        results.push({
          type: "account",
          id: account.account_id,
          title: account.company_name,
          subtitle: `${account.account_id} • ${account.pic_name}`,
          href: `/crm/accounts/${account.account_id}`,
        });
      });
    }

    // Search tickets
    const { data: tickets } = await supabase
      .from("tickets")
      .select("ticket_id, subject, ticket_type, dept_target")
      .or(`ticket_id.ilike.${searchPattern},subject.ilike.${searchPattern}`)
      .limit(5);

    if (tickets) {
      tickets.forEach((ticket) => {
        results.push({
          type: "ticket",
          id: ticket.ticket_id,
          title: ticket.subject,
          subtitle: `${ticket.ticket_id} • ${ticket.ticket_type}`,
          href: `/ticketing/${ticket.ticket_id}`,
        });
      });
    }

    // Search invoices
    const { data: invoices } = await supabase
      .from("invoices")
      .select("invoice_id, customer_id, invoice_amount, currency")
      .or(`invoice_id.ilike.${searchPattern},customer_id.ilike.${searchPattern}`)
      .limit(5);

    if (invoices) {
      invoices.forEach((invoice) => {
        results.push({
          type: "invoice",
          id: invoice.invoice_id,
          title: invoice.invoice_id,
          subtitle: `${invoice.customer_id} • ${invoice.currency} ${invoice.invoice_amount.toLocaleString()}`,
          href: `/dso/invoices/${invoice.invoice_id}`,
        });
      });
    }

    // Sort results by relevance (exact matches first)
    results.sort((a, b) => {
      const aExact = a.id.toLowerCase().includes(query.toLowerCase()) ? 0 : 1;
      const bExact = b.id.toLowerCase().includes(query.toLowerCase()) ? 0 : 1;
      return aExact - bExact;
    });

    return NextResponse.json({ results: results.slice(0, 15) });
  } catch (err) {
    console.error("Search API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

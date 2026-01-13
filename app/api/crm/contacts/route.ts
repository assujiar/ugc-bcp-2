import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { z } from "zod";
import { apiSuccess, apiErrors } from "@/lib/api/error";

const createContactSchema = z.object({
  account_id: z.string().min(1, "Account ID is required"),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().optional(),
  title: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  is_primary: z.boolean().optional().default(false),
  is_decision_maker: z.boolean().optional().default(false),
  notes: z.string().optional(),
});

// GET /api/crm/contacts - List contacts (optionally by account)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return apiErrors.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("account_id");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "50", 10);
    const search = searchParams.get("search");

    let query = supabase
      .from("contacts")
      .select(`
        *,
        account:accounts!contacts_account_id_fkey (account_id, company_name)
      `, { count: "exact" });

    // Filter by account if specified
    if (accountId) {
      query = query.eq("account_id", accountId);
    }

    // Apply search
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Order by primary first, then name
    query = query.order("is_primary", { ascending: false });
    query = query.order("first_name", { ascending: true });

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching contacts:", error);
      return apiErrors.internal(error.message);
    }

    return apiSuccess({
      data,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    console.error("Error in GET /api/crm/contacts:", error);
    return apiErrors.internal();
  }
}

// POST /api/crm/contacts - Create new contact
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return apiErrors.unauthorized();
    }

    const body = await request.json();
    const validation = createContactSchema.safeParse(body);

    if (!validation.success) {
      return apiErrors.validation("Validation error", validation.error.issues);
    }

    const contactData = validation.data;

    // If this contact is set as primary, unset other primary contacts for this account
    if (contactData.is_primary) {
      await supabase
        .from("contacts")
        .update({ is_primary: false })
        .eq("account_id", contactData.account_id)
        .eq("is_primary", true);
    }

    const { data: contact, error } = await supabase
      .from("contacts")
      .insert({
        ...contactData,
        email: contactData.email || null, // Convert empty string to null
        created_by: profile.user_id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating contact:", error);
      return apiErrors.internal(error.message);
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "contacts",
      record_id: contact.contact_id,
      action: "INSERT",
      changed_by: profile.user_id,
      after_data: contact,
    });

    return apiSuccess({ data: { contact }, status: 201 });
  } catch (error) {
    console.error("Error in POST /api/crm/contacts:", error);
    return apiErrors.internal();
  }
}

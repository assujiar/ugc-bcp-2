import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { z } from "zod";
import crypto from "crypto";

const createTargetSchema = z.object({
  company_name: z.string().min(1),
  domain: z.string().optional(),
  industry: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().optional(),
  linkedin_url: z.string().url().optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
  next_outreach_at: z.string().optional(),
});

const importTargetsSchema = z.object({
  targets: z.array(createTargetSchema),
});

// Generate dedupe key from company name and domain/email
function generateDedupeKey(companyName: string, domain?: string, email?: string): string {
  const normalized = [
    companyName.toLowerCase().replace(/\s+/g, ""),
    domain?.toLowerCase() || "",
    email?.toLowerCase()?.split("@")[1] || "",
  ].filter(Boolean).join("-");
  return crypto.createHash("md5").update(normalized).digest("hex");
}

// GET /api/crm/targets - List prospecting targets
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
    const status = searchParams.get("status");
    const ownerId = searchParams.get("owner_id");
    const search = searchParams.get("search");

    let query = supabase
      .from("prospecting_targets")
      .select(`
        *,
        owner:profiles!prospecting_targets_owner_user_id_fkey (user_id, full_name)
      `, { count: "exact" });

    // Apply filters
    if (status) {
      query = query.eq("status", status);
    }
    if (ownerId) {
      query = query.eq("owner_user_id", ownerId);
    }
    if (search) {
      query = query.or(`company_name.ilike.%${search}%,contact_name.ilike.%${search}%,domain.ilike.%${search}%`);
    }

    // Order by next outreach date (soonest first)
    query = query
      .order("next_outreach_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching targets:", error);
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
    console.error("Error in GET /api/crm/targets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/crm/targets - Create target(s) or import batch
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Check if this is a batch import
    if (body.targets && Array.isArray(body.targets)) {
      const validation = importTargetsSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json({
          error: "Validation error",
          details: validation.error.issues
        }, { status: 400 });
      }

      const targetsToInsert = validation.data.targets.map((t) => ({
        ...t,
        dedupe_key: generateDedupeKey(t.company_name, t.domain, t.contact_email),
        owner_user_id: profile.user_id,
        created_by: profile.user_id,
      }));

      const { data: targets, error } = await supabase
        .from("prospecting_targets")
        .upsert(targetsToInsert, {
          onConflict: "dedupe_key",
          ignoreDuplicates: true,
        })
        .select();

      if (error) {
        console.error("Error importing targets:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        imported: targets?.length || 0,
        total: targetsToInsert.length,
        targets,
      }, { status: 201 });
    }

    // Single target creation
    const validation = createTargetSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: "Validation error",
        details: validation.error.issues
      }, { status: 400 });
    }

    const targetData = validation.data;
    const dedupeKey = generateDedupeKey(
      targetData.company_name,
      targetData.domain,
      targetData.contact_email
    );

    const { data: target, error } = await supabase
      .from("prospecting_targets")
      .insert({
        ...targetData,
        dedupe_key: dedupeKey,
        owner_user_id: profile.user_id,
        created_by: profile.user_id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating target:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "prospecting_targets",
      record_id: target.target_id,
      action: "INSERT",
      changed_by: profile.user_id,
      after_data: target,
    });

    return NextResponse.json({ target }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/crm/targets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";

// GET /api/imports - List imports
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const module = searchParams.get("module") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

    let query = supabase
      .from("imports")
      .select(`
        *,
        uploaded_by_profile:profiles!imports_uploaded_by_fkey (full_name, role_name)
      `, { count: "exact" })
      .order("uploaded_at", { ascending: false });

    if (module) {
      query = query.eq("module", module);
    }
    if (status) {
      query = query.eq("status", status);
    }

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
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
    console.error("Error in GET /api/imports:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/imports - Create import record and process data
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check allowed roles
    const allowedRoles = [
      "super admin",
      "Marketing Manager",
      "Marcomm (marketing staff)",
      "DGO (Marketing staff)",
      "MACX (marketing staff)",
      "VSDO (marketing staff)",
      "sales support",
    ];
    if (!allowedRoles.includes(profile.role_name)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { module, file_name, file_url, rows } = body;

    if (!module || !file_name || !rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Create import record
    const { data: importRecord, error: importError } = await supabase
      .from("imports")
      .insert({
        module,
        file_name,
        file_url: file_url || null,
        total_rows: rows.length,
        status: "PROCESSING",
        uploaded_by: profile.user_id,
      })
      .select()
      .single();

    if (importError) {
      return NextResponse.json({ error: importError.message }, { status: 500 });
    }

    // Process rows based on module
    let successCount = 0;
    let errorCount = 0;
    const errorRows: { row_number: number; row_data: Record<string, unknown>; error_message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;

      try {
        if (module === "leads") {
          // Validate required lead fields
          if (!row.company_name || !row.pic_name || !row.contact_phone || !row.email || !row.city_area || !row.service_code || !row.primary_channel) {
            throw new Error("Missing required fields: company_name, pic_name, contact_phone, email, city_area, service_code, primary_channel");
          }

          // Find or create customer
          const { data: customerId } = await supabase.rpc("find_or_create_customer", {
            p_company_name: row.company_name,
            p_npwp: row.npwp || null,
            p_pic_name: row.pic_name,
            p_pic_phone: row.contact_phone,
            p_pic_email: row.email,
            p_city: row.city_area,
            p_country: row.country || null,
          });

          // Create lead
          const { error: leadError } = await supabase.from("leads").insert({
            lead_date: row.lead_date || new Date().toISOString().split("T")[0],
            company_name: row.company_name,
            pic_name: row.pic_name,
            contact_phone: row.contact_phone,
            email: row.email,
            city_area: row.city_area,
            service_code: row.service_code,
            route: row.route || null,
            sourced_by: row.sourced_by || "Marketing",
            primary_channel: row.primary_channel,
            campaign_name: row.campaign_name || null,
            notes: row.notes || null,
            customer_id: customerId,
            status: "New",
            next_step: row.next_step || "Call",
            due_date: row.due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            created_by: profile.user_id,
          });

          if (leadError) throw leadError;
          successCount++;
        } else if (module === "customers") {
          // Validate required customer fields
          if (!row.company_name || !row.pic_name || !row.pic_phone || !row.pic_email) {
            throw new Error("Missing required fields: company_name, pic_name, pic_phone, pic_email");
          }

          const { error: customerError } = await supabase.from("customers").insert({
            company_name: row.company_name,
            npwp: row.npwp || null,
            pic_name: row.pic_name,
            pic_phone: row.pic_phone,
            pic_email: row.pic_email,
            address: row.address || null,
            city: row.city || null,
            country: row.country || null,
          });

          if (customerError) throw customerError;
          successCount++;
        } else if (module === "spend") {
          // Marketing spend import
          if (!row.channel || !row.spend_date || row.amount === undefined) {
            throw new Error("Missing required fields: channel, spend_date, amount");
          }

          const { error: spendError } = await supabase.from("marketing_spend").insert({
            channel: row.channel,
            spend_date: row.spend_date,
            amount: parseFloat(row.amount),
            campaign_name: row.campaign_name || null,
            notes: row.notes || null,
            created_by: profile.user_id,
          });

          if (spendError) throw spendError;
          successCount++;
        } else if (module === "activities") {
          // Marketing activities import
          if (!row.activity_name || !row.activity_date || row.quantity === undefined) {
            throw new Error("Missing required fields: activity_name, activity_date, quantity");
          }

          const { error: activityError } = await supabase.from("marketing_activity_events").insert({
            activity_name: row.activity_name,
            channel: row.channel || null,
            activity_date: row.activity_date,
            quantity: parseFloat(row.quantity),
            notes: row.notes || null,
            created_by: profile.user_id,
          });

          if (activityError) throw activityError;
          successCount++;
        } else {
          throw new Error(`Unsupported module: ${module}`);
        }
      } catch (err) {
        errorCount++;
        errorRows.push({
          row_number: rowNumber,
          row_data: row,
          error_message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // Insert error rows
    if (errorRows.length > 0) {
      await supabase.from("import_rows").insert(
        errorRows.map((r) => ({
          import_id: importRecord.import_id,
          row_number: r.row_number,
          row_data: r.row_data,
          error_message: r.error_message,
        }))
      );
    }

    // Update import record status
    const finalStatus = errorCount === rows.length ? "FAILED" : "COMPLETED";
    await supabase
      .from("imports")
      .update({
        status: finalStatus,
        success_rows: successCount,
        error_rows: errorCount,
        processed_at: new Date().toISOString(),
      })
      .eq("import_id", importRecord.import_id);

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "imports",
      record_id: importRecord.import_id.toString(),
      action: "INSERT",
      changed_by: profile.user_id,
      after_data: {
        module,
        total_rows: rows.length,
        success_rows: successCount,
        error_rows: errorCount,
      },
    });

    return NextResponse.json({
      import_id: importRecord.import_id,
      status: finalStatus,
      total_rows: rows.length,
      success_rows: successCount,
      error_rows: errorCount,
      errors: errorRows,
    }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/imports:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/imports/[id]/errors - Get error rows for an import
export async function getImportErrors(importId: number, supabase: ReturnType<typeof createServerClient> extends Promise<infer T> ? T : never) {
  const { data, error } = await supabase
    .from("import_rows")
    .select("*")
    .eq("import_id", importId)
    .order("row_number");

  if (error) {
    throw error;
  }

  return data;
}

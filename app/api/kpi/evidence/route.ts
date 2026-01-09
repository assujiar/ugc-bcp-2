// app/api/kpi/evidence/route.ts
// KPI Evidence Upload API

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// POST /api/kpi/evidence - Upload evidence file
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const metricKey = formData.get("metric_key") as string | null;
    const targetId = formData.get("target_id") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!metricKey) {
      return NextResponse.json({ error: "metric_key is required" }, { status: 400 });
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 });
    }

    // Generate unique filename
    const ext = file.name.split(".").pop() || "";
    const filename = `${metricKey}/${user.id}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("kpi-evidence")
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("kpi-evidence")
      .getPublicUrl(filename);

    // Log to audit
    await supabase.from("audit_logs").insert({
      table_name: "kpi_evidence",
      record_id: filename,
      action: "INSERT",
      changed_by: user.id,
      after_data: {
        metric_key: metricKey,
        target_id: targetId,
        filename: file.name,
        size: file.size,
        type: file.type,
      },
    });

    return NextResponse.json({
      id: filename,
      url: urlData.publicUrl,
      filename: file.name,
      size: file.size,
      type: file.type,
    });
  } catch (err) {
    console.error("Evidence upload error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/kpi/evidence - List evidence files for a metric/target
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
    const metricKey = searchParams.get("metric_key");

    if (!metricKey) {
      return NextResponse.json({ error: "metric_key is required" }, { status: 400 });
    }

    const path = `${metricKey}/${user.id}`;

    const { data, error } = await supabase.storage
      .from("kpi-evidence")
      .list(path, {
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) {
      console.error("Storage list error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get public URLs for each file
    const files = (data || []).map((file) => {
      const { data: urlData } = supabase.storage
        .from("kpi-evidence")
        .getPublicUrl(`${path}/${file.name}`);

      return {
        id: `${path}/${file.name}`,
        name: file.name,
        size: file.metadata?.size || 0,
        type: file.metadata?.mimetype || "",
        url: urlData.publicUrl,
        uploadedAt: file.created_at,
      };
    });

    return NextResponse.json({ data: files });
  } catch (err) {
    console.error("Evidence list error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

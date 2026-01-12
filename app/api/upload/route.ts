// app/api/upload/route.ts
// File Upload API - Handle file uploads to Supabase Storage

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const ALLOWED_BUCKETS = [
  "kpi-evidence",
  "prospect-evidence",
  "ticket-attachments",
  "customer-documents",
  "import-files",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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
    const bucket = formData.get("bucket") as string | null;
    const entityId = formData.get("entity_id") as string | null;
    const entityType = formData.get("entity_type") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!bucket || !ALLOWED_BUCKETS.includes(bucket)) {
      return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split(".").pop() || "";
    const safeName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .substring(0, 50);
    
    // Build path: entity_type/entity_id/timestamp_random_filename.ext
    const filePath = entityType && entityId
      ? `${entityType}/${entityId}/${timestamp}_${randomString}_${safeName}`
      : `uploads/${user.id}/${timestamp}_${randomString}_${safeName}`;

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("Storage upload error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return NextResponse.json({
      url: urlData.publicUrl,
      path: data.path,
      name: file.name,
      size: file.size,
      type: file.type,
    });
  } catch (err) {
    console.error("Upload API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { z } from "zod";
import crypto from "crypto";
import { apiSuccess, apiErrors } from "@/lib/api/error";

// =========================
// Types
// =========================

interface ParsedRow {
  rowNumber: number;
  data: Record<string, string>;
}

interface FailedRow {
  row_number: number;
  reason: string;
  data: Record<string, string>;
}

interface ImportResult {
  batch_id: string;
  source_name: string;
  file_hash: string;
  row_count: number;
  inserted: number;
  updated: number;
  failed: number;
  failed_rows: FailedRow[];
  is_duplicate_file: boolean;
  previous_batch_id?: string;
}

// =========================
// CSV Parser
// =========================

function parseCSV(content: string): ParsedRow[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  // Parse header row
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map((h) => h.trim().toLowerCase());

  // Parse data rows
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const rowData: Record<string, string> = {};

    headers.forEach((header, index) => {
      rowData[header] = (values[index] || "").trim();
    });

    rows.push({
      rowNumber: i + 1, // 1-indexed, accounting for header
      data: rowData,
    });
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else if (char === '"') {
        // End of quoted field
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
      } else if (char === ",") {
        // Field separator
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }

  // Don't forget the last field
  result.push(current);

  return result;
}

// =========================
// Field Mapping
// =========================

// Maps CSV column names to database field names
const COLUMN_MAPPING: Record<string, string> = {
  // Company fields
  "company_name": "company_name",
  "company name": "company_name",
  "company": "company_name",
  "nama perusahaan": "company_name",

  // Domain
  "domain": "domain",
  "website": "domain",
  "url": "domain",

  // Industry
  "industry": "industry",
  "industri": "industry",
  "sektor": "industry",

  // Contact name
  "contact_name": "contact_name",
  "contact name": "contact_name",
  "contact": "contact_name",
  "nama kontak": "contact_name",
  "pic": "contact_name",
  "pic_name": "contact_name",
  "pic name": "contact_name",

  // Contact email
  "contact_email": "contact_email",
  "contact email": "contact_email",
  "email": "contact_email",

  // Contact phone
  "contact_phone": "contact_phone",
  "contact phone": "contact_phone",
  "phone": "contact_phone",
  "telepon": "contact_phone",
  "no_telp": "contact_phone",
  "no telp": "contact_phone",

  // LinkedIn
  "linkedin_url": "linkedin_url",
  "linkedin url": "linkedin_url",
  "linkedin": "linkedin_url",

  // City
  "city": "city",
  "kota": "city",
  "location": "city",
  "lokasi": "city",

  // Notes
  "notes": "notes",
  "catatan": "notes",
  "note": "notes",

  // Source
  "source": "source",
  "sumber": "source",

  // Next outreach
  "next_outreach_at": "next_outreach_at",
  "next outreach": "next_outreach_at",
  "next_outreach": "next_outreach_at",
  "outreach date": "next_outreach_at",
};

function mapRowToTarget(row: Record<string, string>): Record<string, string | undefined> {
  const mapped: Record<string, string | undefined> = {};

  for (const [csvColumn, value] of Object.entries(row)) {
    const dbField = COLUMN_MAPPING[csvColumn.toLowerCase()];
    if (dbField && value) {
      mapped[dbField] = value;
    }
  }

  return mapped;
}

// =========================
// Validation
// =========================

const targetRowSchema = z.object({
  company_name: z.string().min(1, "Company name is required"),
  domain: z.string().optional(),
  industry: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().email("Invalid email format").optional().or(z.literal("")),
  contact_phone: z.string().optional(),
  linkedin_url: z.string().url("Invalid URL format").optional().or(z.literal("")),
  city: z.string().optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
  next_outreach_at: z.string().optional(),
});

function validateRow(data: Record<string, string | undefined>): { valid: boolean; errors: string[] } {
  // Clean empty strings to undefined
  const cleaned: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(data)) {
    cleaned[key] = value && value.trim() ? value.trim() : undefined;
  }

  const result = targetRowSchema.safeParse(cleaned);

  if (!result.success) {
    // Zod v4 uses .issues instead of .errors
    const issues = result.error.issues || [];
    return {
      valid: false,
      errors: issues.map((e) => `${e.path.join(".")}: ${e.message}`),
    };
  }

  return { valid: true, errors: [] };
}

// =========================
// Dedupe Key Generation
// =========================

function generateDedupeKey(companyName: string, domain?: string, email?: string): string {
  const normalized = [
    companyName.toLowerCase().replace(/\s+/g, ""),
    domain?.toLowerCase() || "",
    email?.toLowerCase()?.split("@")[1] || "",
  ].filter(Boolean).join("-");
  return crypto.createHash("md5").update(normalized).digest("hex");
}

function generateBatchId(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `IMP-${dateStr}-${random}`;
}

function generateFileHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

// =========================
// POST /api/crm/targets/import
// =========================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return apiErrors.unauthorized();
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return apiErrors.badRequest("No file provided");
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".csv")) {
      return apiErrors.badRequest("Only CSV files are supported");
    }

    // Read file content
    const content = await file.text();
    if (!content.trim()) {
      return apiErrors.badRequest("File is empty");
    }

    // Generate file hash for idempotency
    const fileHash = generateFileHash(content);

    // Check for duplicate file upload
    const { data: existingBatch } = await supabase
      .from("import_batches")
      .select("batch_id, inserted, updated, failed, row_count")
      .eq("file_hash", fileHash)
      .eq("entity_type", "prospecting_targets")
      .maybeSingle();

    if (existingBatch) {
      // File was already imported - return the previous batch info
      return apiSuccess({
        data: {
          batch_id: existingBatch.batch_id,
          source_name: file.name,
          file_hash: fileHash,
          row_count: existingBatch.row_count,
          inserted: 0,
          updated: 0,
          failed: 0,
          failed_rows: [],
          is_duplicate_file: true,
          previous_batch_id: existingBatch.batch_id,
          message: `This file was already imported in batch ${existingBatch.batch_id}. Original results: ${existingBatch.inserted} inserted, ${existingBatch.updated} updated, ${existingBatch.failed} failed.`,
        } satisfies ImportResult & { message: string },
      });
    }

    // Parse CSV
    const parsedRows = parseCSV(content);
    if (parsedRows.length === 0) {
      return apiErrors.badRequest("No valid data rows found in CSV");
    }

    // Generate batch ID
    const batchId = generateBatchId();

    // Process rows
    const validTargets: Array<{
      company_name: string;
      domain?: string;
      industry?: string;
      contact_name?: string;
      contact_email?: string;
      contact_phone?: string;
      linkedin_url?: string;
      city?: string;
      notes?: string;
      source?: string;
      next_outreach_at?: string;
      dedupe_key: string;
      owner_user_id: string;
      created_by: string;
      import_batch_id: string;
    }> = [];
    const failedRows: FailedRow[] = [];

    for (const row of parsedRows) {
      const mappedData = mapRowToTarget(row.data);
      const validation = validateRow(mappedData);

      if (!validation.valid) {
        failedRows.push({
          row_number: row.rowNumber,
          reason: validation.errors.join("; "),
          data: row.data,
        });
        continue;
      }

      // Clean data - remove empty strings
      const cleanedData: Record<string, string | undefined> = {};
      for (const [key, value] of Object.entries(mappedData)) {
        if (value && value.trim()) {
          cleanedData[key] = value.trim();
        }
      }

      const companyName = cleanedData.company_name!;
      const dedupeKey = generateDedupeKey(
        companyName,
        cleanedData.domain,
        cleanedData.contact_email
      );

      validTargets.push({
        company_name: companyName,
        domain: cleanedData.domain,
        industry: cleanedData.industry,
        contact_name: cleanedData.contact_name,
        contact_email: cleanedData.contact_email,
        contact_phone: cleanedData.contact_phone,
        linkedin_url: cleanedData.linkedin_url,
        city: cleanedData.city,
        notes: cleanedData.notes,
        source: cleanedData.source || file.name, // Default source to filename
        next_outreach_at: cleanedData.next_outreach_at,
        dedupe_key: dedupeKey,
        owner_user_id: profile.user_id,
        created_by: profile.user_id,
        import_batch_id: batchId,
      });
    }

    // Track stats
    let inserted = 0;
    let updated = 0;

    if (validTargets.length > 0) {
      // Get existing targets by dedupe_key to determine insert vs update
      const dedupeKeys = validTargets.map((t) => t.dedupe_key);
      const { data: existingTargets } = await supabase
        .from("prospecting_targets")
        .select("dedupe_key, target_id")
        .in("dedupe_key", dedupeKeys);

      const existingKeysSet = new Set(existingTargets?.map((t) => t.dedupe_key) || []);

      // Upsert targets
      const { data: upsertedTargets, error } = await supabase
        .from("prospecting_targets")
        .upsert(validTargets, {
          onConflict: "dedupe_key",
        })
        .select("target_id, dedupe_key");

      if (error) {
        console.error("Error upserting targets:", error);
        return apiErrors.internal(`Database error: ${error.message}`);
      }

      // Calculate insert vs update counts
      for (const target of upsertedTargets || []) {
        if (existingKeysSet.has(target.dedupe_key)) {
          updated++;
        } else {
          inserted++;
        }
      }
    }

    // Create import batch record
    const { error: batchError } = await supabase.from("import_batches").insert({
      batch_id: batchId,
      source_name: file.name,
      file_hash: fileHash,
      row_count: parsedRows.length,
      inserted,
      updated,
      failed: failedRows.length,
      failed_rows: failedRows,
      entity_type: "prospecting_targets",
      created_by: profile.user_id,
    });

    if (batchError) {
      console.error("Error creating batch record:", batchError);
      // Continue anyway - the targets were imported
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "import_batches",
      record_id: batchId,
      action: "INSERT",
      changed_by: profile.user_id,
      after_data: {
        batch_id: batchId,
        source_name: file.name,
        row_count: parsedRows.length,
        inserted,
        updated,
        failed: failedRows.length,
      },
    });

    const result: ImportResult = {
      batch_id: batchId,
      source_name: file.name,
      file_hash: fileHash,
      row_count: parsedRows.length,
      inserted,
      updated,
      failed: failedRows.length,
      failed_rows: failedRows,
      is_duplicate_file: false,
    };

    return apiSuccess({
      data: result,
      status: 201,
    });
  } catch (error) {
    console.error("Error in POST /api/crm/targets/import:", error);
    return apiErrors.internal();
  }
}

// =========================
// GET /api/crm/targets/import
// List import batches
// =========================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return apiErrors.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

    const { data: batches, error, count } = await supabase
      .from("import_batches")
      .select(
        `
        batch_id,
        source_name,
        file_hash,
        row_count,
        inserted,
        updated,
        failed,
        entity_type,
        created_by,
        created_at,
        creator:profiles!import_batches_created_by_fkey (user_id, full_name)
      `,
        { count: "exact" }
      )
      .eq("entity_type", "prospecting_targets")
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      console.error("Error fetching import batches:", error);
      return apiErrors.internal(error.message);
    }

    return apiSuccess({
      data: batches,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    console.error("Error in GET /api/crm/targets/import:", error);
    return apiErrors.internal();
  }
}

-- =====================================================
-- Migration 17: Import Batches Table
-- Purpose: Track CSV imports for auditability and idempotency
-- Version: CRM v3.1 - Server-side CSV Import
-- =====================================================

-- Create import_batches table
CREATE TABLE IF NOT EXISTS import_batches (
  batch_id text PRIMARY KEY,
  source_name text NOT NULL,  -- Original filename
  file_hash text NOT NULL,    -- SHA-256 hash for idempotency check
  row_count integer NOT NULL DEFAULT 0,
  inserted integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  failed_rows jsonb DEFAULT '[]'::jsonb,  -- Array of {row_number, reason, data}
  entity_type text NOT NULL DEFAULT 'prospecting_targets',  -- For future: leads, accounts, etc.
  created_by uuid NOT NULL REFERENCES profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add comment
COMMENT ON TABLE import_batches IS 'Tracks CSV/Excel batch imports for audit trail and idempotency';
COMMENT ON COLUMN import_batches.file_hash IS 'SHA-256 hash of file content for duplicate detection';
COMMENT ON COLUMN import_batches.failed_rows IS 'JSON array of failed rows with reasons';

-- Add index on file_hash for fast duplicate lookups
CREATE INDEX IF NOT EXISTS idx_import_batches_file_hash ON import_batches(file_hash);

-- Add index on created_by for user-specific queries
CREATE INDEX IF NOT EXISTS idx_import_batches_created_by ON import_batches(created_by);

-- Add index on entity_type for filtering by import type
CREATE INDEX IF NOT EXISTS idx_import_batches_entity_type ON import_batches(entity_type);

-- RLS policies
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

-- Sales and Marketing can view all import batches
CREATE POLICY "import_batches_select_sales_marketing" ON import_batches
  FOR SELECT
  USING (app_is_sales() OR app_is_marketing());

-- Users can only create batches for themselves
CREATE POLICY "import_batches_insert_authenticated" ON import_batches
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Grant permissions
GRANT SELECT, INSERT ON import_batches TO authenticated;

-- Add optional import_batch_id to prospecting_targets for traceability
ALTER TABLE prospecting_targets
  ADD COLUMN IF NOT EXISTS import_batch_id text REFERENCES import_batches(batch_id);

-- Add index for batch queries
CREATE INDEX IF NOT EXISTS idx_prospecting_targets_import_batch
  ON prospecting_targets(import_batch_id)
  WHERE import_batch_id IS NOT NULL;

COMMENT ON COLUMN prospecting_targets.import_batch_id IS 'Reference to the import batch that created/updated this record';

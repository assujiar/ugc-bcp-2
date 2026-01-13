-- =====================================================
-- Migration 18: Targets Dedupe Index Enhancement
-- Purpose: Ensure unique constraint on dedupe_key for proper upsert behavior
-- Version: CRM v3.1 - Server-side CSV Import
-- =====================================================

-- Note: The unique constraint on dedupe_key should already exist from migration 09_crm_rebuild.sql
-- This migration ensures it exists and adds additional supportive indexes

-- Ensure unique constraint exists (will fail silently if already exists)
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'prospecting_targets_dedupe_key_key'
    AND conrelid = 'prospecting_targets'::regclass
  ) THEN
    ALTER TABLE prospecting_targets
      ADD CONSTRAINT prospecting_targets_dedupe_key_key UNIQUE (dedupe_key);
  END IF;
END $$;

-- Add composite index for common lookup patterns during import
-- This helps with the upsert operation performance
CREATE INDEX IF NOT EXISTS idx_prospecting_targets_dedupe_lookup
  ON prospecting_targets(dedupe_key, target_id);

-- Add index on company_name + domain for alternative lookups
CREATE INDEX IF NOT EXISTS idx_prospecting_targets_company_domain
  ON prospecting_targets(lower(company_name), lower(domain))
  WHERE domain IS NOT NULL;

-- Add index on contact_email for email-based lookups
CREATE INDEX IF NOT EXISTS idx_prospecting_targets_contact_email
  ON prospecting_targets(lower(contact_email))
  WHERE contact_email IS NOT NULL;

COMMENT ON INDEX idx_prospecting_targets_dedupe_lookup IS 'Optimizes upsert operations during CSV import';
COMMENT ON INDEX idx_prospecting_targets_company_domain IS 'Supports company+domain lookup queries';
COMMENT ON INDEX idx_prospecting_targets_contact_email IS 'Supports email-based duplicate detection';

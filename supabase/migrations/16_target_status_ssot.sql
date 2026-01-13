-- =========================
-- Migration: Target Status SSOT
-- Aligns target_status enum with SSOT: new_target, contacted, engaged, qualified, dropped, converted
-- Implements state machine transition rules with gating
-- =========================

-- =========================
-- STEP 1: Create new enum type
-- =========================
DO $$ BEGIN
  CREATE TYPE target_status_v2 AS ENUM (
    'new_target',
    'contacted',
    'engaged',
    'qualified',
    'dropped',
    'converted'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================
-- STEP 2: Add new column and migrate data
-- =========================
ALTER TABLE prospecting_targets ADD COLUMN IF NOT EXISTS status_v2 target_status_v2;

-- Migrate existing data with mapping
UPDATE prospecting_targets SET status_v2 =
  CASE status::text
    WHEN 'New' THEN 'new_target'::target_status_v2
    WHEN 'Contacted' THEN 'contacted'::target_status_v2
    WHEN 'Converted' THEN 'converted'::target_status_v2
    WHEN 'Not Interested' THEN 'dropped'::target_status_v2
    WHEN 'Invalid' THEN 'dropped'::target_status_v2
    ELSE 'new_target'::target_status_v2
  END
WHERE status_v2 IS NULL;

-- Set default for new column
ALTER TABLE prospecting_targets ALTER COLUMN status_v2 SET DEFAULT 'new_target'::target_status_v2;
ALTER TABLE prospecting_targets ALTER COLUMN status_v2 SET NOT NULL;

-- =========================
-- STEP 3: Swap columns
-- =========================
ALTER TABLE prospecting_targets DROP COLUMN IF EXISTS status;
ALTER TABLE prospecting_targets RENAME COLUMN status_v2 TO status;

-- Drop old type and rename new one
DROP TYPE IF EXISTS target_status CASCADE;
ALTER TYPE target_status_v2 RENAME TO target_status;

-- =========================
-- STEP 4: Target Status Transition Rules
-- =========================
CREATE TABLE IF NOT EXISTS target_status_transitions (
  id serial PRIMARY KEY,
  from_status target_status NOT NULL,
  to_status target_status NOT NULL,
  requires_reason boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_status, to_status)
);

-- Insert valid transitions
INSERT INTO target_status_transitions (from_status, to_status, requires_reason)
VALUES
  -- new_target can go to contacted or dropped
  ('new_target', 'contacted', false),
  ('new_target', 'dropped', true),

  -- contacted can go to engaged or dropped
  ('contacted', 'engaged', false),
  ('contacted', 'dropped', true),

  -- engaged can go to qualified or dropped
  ('engaged', 'qualified', false),
  ('engaged', 'dropped', true),

  -- qualified can go to converted or dropped
  ('qualified', 'converted', false),
  ('qualified', 'dropped', true)
ON CONFLICT (from_status, to_status) DO NOTHING;

-- =========================
-- STEP 5: Add drop reason column to targets
-- =========================
ALTER TABLE prospecting_targets ADD COLUMN IF NOT EXISTS drop_reason text;
ALTER TABLE prospecting_targets ADD COLUMN IF NOT EXISTS dropped_at timestamptz;
ALTER TABLE prospecting_targets ADD COLUMN IF NOT EXISTS converted_at timestamptz;

-- Update converted_at for existing converted targets
UPDATE prospecting_targets
SET converted_at = updated_at
WHERE status = 'converted' AND converted_at IS NULL;

-- =========================
-- STEP 6: Validation function for target status transitions
-- =========================
CREATE OR REPLACE FUNCTION validate_target_status_transition(
  p_current_status target_status,
  p_new_status target_status,
  p_drop_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_valid boolean;
  v_requires_reason boolean;
BEGIN
  -- Terminal states cannot change
  IF p_current_status IN ('dropped', 'converted') THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', format('Cannot change status from terminal state: %s', p_current_status)
    );
  END IF;

  -- Check if transition exists
  SELECT true, requires_reason INTO v_valid, v_requires_reason
  FROM target_status_transitions
  WHERE from_status = p_current_status AND to_status = p_new_status;

  IF v_valid IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', format('Invalid transition from %s to %s', p_current_status, p_new_status)
    );
  END IF;

  -- Check if reason is required but not provided
  IF v_requires_reason AND (p_drop_reason IS NULL OR trim(p_drop_reason) = '') THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', format('Reason required for transition to %s', p_new_status)
    );
  END IF;

  RETURN jsonb_build_object('valid', true);
END $$;

-- =========================
-- STEP 7: RPC function to update target status with validation
-- =========================
CREATE OR REPLACE FUNCTION rpc_target_update_status(
  p_idempotency_key text,
  p_target_id text,
  p_new_status target_status,
  p_notes text DEFAULT NULL,
  p_drop_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cached jsonb;
  v_target record;
  v_validation jsonb;
  v_result jsonb;
BEGIN
  -- Check idempotency
  v_cached := check_idempotency(p_idempotency_key);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  -- Get target
  SELECT * INTO v_target FROM prospecting_targets WHERE target_id = p_target_id;
  IF v_target IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target not found');
  END IF;

  -- Validate transition
  v_validation := validate_target_status_transition(v_target.status, p_new_status, p_drop_reason);
  IF NOT (v_validation->>'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', v_validation->>'error');
  END IF;

  -- Update target
  UPDATE prospecting_targets
  SET
    status = p_new_status,
    notes = COALESCE(p_notes, notes),
    drop_reason = CASE WHEN p_new_status = 'dropped' THEN p_drop_reason ELSE drop_reason END,
    dropped_at = CASE WHEN p_new_status = 'dropped' THEN now() ELSE dropped_at END,
    last_contacted_at = CASE WHEN p_new_status = 'contacted' THEN now() ELSE last_contacted_at END,
    updated_at = now()
  WHERE target_id = p_target_id;

  v_result := jsonb_build_object(
    'success', true,
    'target_id', p_target_id,
    'old_status', v_target.status,
    'new_status', p_new_status
  );

  PERFORM store_idempotency(p_idempotency_key, 'target_update_status', v_result);

  RETURN v_result;
END $$;

-- =========================
-- STEP 8: Enhanced Target Convert with Gating + Activity Seeding
-- =========================
CREATE OR REPLACE FUNCTION rpc_target_convert_to_lead(
  p_idempotency_key text,
  p_target_id text,
  p_service_code text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cached jsonb;
  v_target record;
  v_account_id text;
  v_contact_id text;
  v_opportunity_id text;
  v_activity_id text;
  v_result jsonb;
BEGIN
  -- Check idempotency
  v_cached := check_idempotency(p_idempotency_key);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  -- Get target
  SELECT * INTO v_target FROM prospecting_targets WHERE target_id = p_target_id;
  IF v_target IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target not found');
  END IF;

  -- Gate: Only qualified targets can be converted
  IF v_target.status = 'converted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target already converted');
  END IF;

  IF v_target.status = 'dropped' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot convert dropped target');
  END IF;

  IF v_target.status != 'qualified' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Target must be qualified to convert. Current status: %s', v_target.status),
      'required_status', 'qualified',
      'current_status', v_target.status
    );
  END IF;

  -- Create or find account
  SELECT account_id INTO v_account_id
  FROM accounts
  WHERE lower(company_name) = lower(v_target.company_name)
     OR (domain IS NOT NULL AND domain = v_target.domain)
  LIMIT 1;

  IF v_account_id IS NULL THEN
    INSERT INTO accounts (company_name, domain, industry, owner_user_id, pic_name, pic_email, pic_phone)
    VALUES (v_target.company_name, v_target.domain, v_target.industry, auth.uid(),
            COALESCE(v_target.contact_name, 'Contact'), v_target.contact_email, v_target.contact_phone)
    RETURNING account_id INTO v_account_id;
  END IF;

  -- Create contact if target has contact info
  IF v_target.contact_name IS NOT NULL THEN
    INSERT INTO contacts (account_id, first_name, email, phone, is_primary, created_by)
    VALUES (v_account_id, v_target.contact_name, v_target.contact_email, v_target.contact_phone, true, auth.uid())
    ON CONFLICT DO NOTHING
    RETURNING contact_id INTO v_contact_id;
  END IF;

  -- Create opportunity
  INSERT INTO opportunities (
    account_id, name, owner_user_id, source_target_id,
    service_codes,
    next_step, next_step_due_date, notes, created_by
  )
  VALUES (
    v_account_id,
    v_target.company_name || ' - Converted from Target',
    auth.uid(),
    p_target_id,
    CASE WHEN p_service_code IS NOT NULL THEN ARRAY[p_service_code] ELSE NULL END,
    'Schedule discovery call',
    current_date + interval '3 days',
    COALESCE(p_notes, v_target.notes),
    auth.uid()
  )
  RETURNING opportunity_id INTO v_opportunity_id;

  -- Seed initial cadence activity: Discovery Call
  INSERT INTO activities (
    activity_type,
    status,
    subject,
    description,
    related_account_id,
    related_contact_id,
    related_opportunity_id,
    related_target_id,
    due_date,
    owner_user_id,
    created_by
  )
  VALUES (
    'Call',
    'Planned',
    'Discovery Call - ' || v_target.company_name,
    'Initial discovery call with converted target. Discuss requirements and next steps.',
    v_account_id,
    v_contact_id,
    v_opportunity_id,
    p_target_id,
    current_date + interval '3 days',
    auth.uid(),
    auth.uid()
  )
  RETURNING activity_id INTO v_activity_id;

  -- Seed follow-up activity: Send Intro Email
  INSERT INTO activities (
    activity_type,
    status,
    subject,
    description,
    related_account_id,
    related_contact_id,
    related_opportunity_id,
    related_target_id,
    due_date,
    owner_user_id,
    created_by
  )
  VALUES (
    'Email',
    'Planned',
    'Introduction Email - ' || v_target.company_name,
    'Send introduction email with company capabilities and service overview.',
    v_account_id,
    v_contact_id,
    v_opportunity_id,
    p_target_id,
    current_date + interval '1 day',
    auth.uid(),
    auth.uid()
  );

  -- Update target status to converted
  UPDATE prospecting_targets
  SET status = 'converted',
      converted_to_account_id = v_account_id,
      converted_at = now(),
      updated_at = now()
  WHERE target_id = p_target_id;

  -- Build result with deep link info
  v_result := jsonb_build_object(
    'success', true,
    'account_id', v_account_id,
    'contact_id', v_contact_id,
    'opportunity_id', v_opportunity_id,
    'first_activity_id', v_activity_id,
    'deep_link', '/crm/opportunities/' || v_opportunity_id,
    'message', 'Target converted successfully. Discovery call and intro email scheduled.'
  );

  PERFORM store_idempotency(p_idempotency_key, 'target_convert_to_lead', v_result);

  RETURN v_result;
END $$;

-- =========================
-- STEP 9: Grant execute permissions
-- =========================
GRANT EXECUTE ON FUNCTION rpc_target_update_status(text, text, target_status, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_target_status_transition(target_status, target_status, text) TO authenticated;

-- =========================
-- STEP 10: Recreate index on status
-- =========================
DROP INDEX IF EXISTS idx_targets_status;
CREATE INDEX idx_targets_status ON prospecting_targets(status);
CREATE INDEX idx_targets_dropped_at ON prospecting_targets(dropped_at) WHERE dropped_at IS NOT NULL;
CREATE INDEX idx_targets_converted_at ON prospecting_targets(converted_at) WHERE converted_at IS NOT NULL;

-- =========================
-- STEP 11: Update existing converted targets' converted_at if missing
-- =========================
UPDATE prospecting_targets
SET converted_at = updated_at
WHERE status = 'converted' AND converted_at IS NULL;

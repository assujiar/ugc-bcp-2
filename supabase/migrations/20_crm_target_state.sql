-- =============================================================================
-- CRM Target-State Migration
-- Version: 4.0 - Complete CRM Rebuild per SSOT Specification
--
-- This migration implements the complete target-state architecture:
-- 1. Lead ID auto-generation trigger
-- 2. Enhanced RLS policies for role-based visibility
-- 3. Cadence-based automation with proper enrollment
-- 4. Additional views for my-leads, nurture, disqualified
-- 5. Foreign key constraints and indexes
-- 6. Enhanced RPC functions with cadence seeding
-- =============================================================================

-- =========================
-- LEAD ID TRIGGER (Missing)
-- =========================

CREATE OR REPLACE FUNCTION trg_lead_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.lead_id IS NULL OR NEW.lead_id = '' THEN
    NEW.lead_id := next_prefixed_id('LEAD', current_date);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS leads_id_before_insert ON leads;
CREATE TRIGGER leads_id_before_insert
BEFORE INSERT ON leads
FOR EACH ROW EXECUTE FUNCTION trg_lead_id();

-- =========================
-- TRIAGE STATUS NOT NULL
-- =========================

ALTER TABLE leads ALTER COLUMN triage_status SET NOT NULL;
ALTER TABLE leads ALTER COLUMN triage_status SET DEFAULT 'New';

-- =========================
-- ADD MISSING FOREIGN KEYS
-- =========================

-- opportunities.source_lead_id -> leads
DO $$ BEGIN
  ALTER TABLE opportunities
    ADD CONSTRAINT opportunities_source_lead_id_fkey
    FOREIGN KEY (source_lead_id) REFERENCES leads(lead_id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- opportunities.source_target_id -> prospecting_targets
DO $$ BEGIN
  ALTER TABLE opportunities
    ADD CONSTRAINT opportunities_source_target_id_fkey
    FOREIGN KEY (source_target_id) REFERENCES prospecting_targets(target_id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- prospecting_targets.converted_to_lead_id -> leads
DO $$ BEGIN
  ALTER TABLE prospecting_targets
    ADD CONSTRAINT targets_converted_to_lead_id_fkey
    FOREIGN KEY (converted_to_lead_id) REFERENCES leads(lead_id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- prospecting_targets.converted_to_account_id -> accounts
DO $$ BEGIN
  ALTER TABLE prospecting_targets
    ADD CONSTRAINT targets_converted_to_account_id_fkey
    FOREIGN KEY (converted_to_account_id) REFERENCES accounts(account_id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- activities.cadence_enrollment_id -> cadence_enrollments
DO $$ BEGIN
  ALTER TABLE activities
    ADD CONSTRAINT activities_cadence_enrollment_id_fkey
    FOREIGN KEY (cadence_enrollment_id) REFERENCES cadence_enrollments(enrollment_id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- lead_handover_pool.lead_id -> leads
DO $$ BEGIN
  ALTER TABLE lead_handover_pool
    ADD CONSTRAINT lead_handover_pool_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================
-- ADDITIONAL INDEXES
-- =========================

CREATE INDEX IF NOT EXISTS idx_leads_sales_owner ON leads(sales_owner_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_owner_stage ON opportunities(owner_user_id, stage);
CREATE INDEX IF NOT EXISTS idx_opportunities_next_due_owner ON opportunities(next_step_due_date, owner_user_id);
CREATE INDEX IF NOT EXISTS idx_activities_owner_status_due ON activities(owner_user_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_enrollments_opportunity ON cadence_enrollments(opportunity_id) WHERE status = 'Active';

-- =========================
-- NEW VIEWS FOR SSOT MAPPING
-- =========================

-- My Leads View: Leads claimed by a user but not yet fully closed
CREATE OR REPLACE VIEW v_my_leads AS
SELECT
  l.*,
  o.opportunity_id,
  o.name as opportunity_name,
  o.stage as opportunity_stage,
  p.full_name as owner_name
FROM leads l
LEFT JOIN opportunities o ON l.opportunity_id = o.opportunity_id
LEFT JOIN profiles p ON l.sales_owner_user_id = p.user_id
WHERE l.sales_owner_user_id IS NOT NULL
  AND l.status NOT IN ('Closed Won', 'Closed Lost', 'Disqualified')
  AND l.triage_status = 'Handed Over';

-- Nurture Leads View: Marketing nurture queue
CREATE OR REPLACE VIEW v_nurture_leads AS
SELECT
  l.*,
  p.full_name as creator_name,
  sc.service_name
FROM leads l
LEFT JOIN profiles p ON l.created_by = p.user_id
LEFT JOIN service_catalog sc ON l.service_code = sc.service_code
WHERE l.triage_status = 'Nurture'
ORDER BY l.updated_at DESC;

-- Disqualified Leads View: Archive reference
CREATE OR REPLACE VIEW v_disqualified_leads AS
SELECT
  l.*,
  p.full_name as creator_name,
  sc.service_name
FROM leads l
LEFT JOIN profiles p ON l.created_by = p.user_id
LEFT JOIN service_catalog sc ON l.service_code = sc.service_code
WHERE l.triage_status = 'Disqualified'
ORDER BY l.disqualified_at DESC NULLS LAST;

-- Handover Pool View: Unclaimed leads in sales pool
CREATE OR REPLACE VIEW v_handover_pool AS
SELECT
  l.*,
  hp.handover_id,
  hp.handed_over_at,
  hp.notes as handover_notes,
  hp.priority,
  hp.expires_at,
  handed_by.full_name as handed_over_by_name,
  sc.service_name
FROM leads l
JOIN lead_handover_pool hp ON l.lead_id = hp.lead_id
LEFT JOIN profiles handed_by ON hp.handed_over_by = handed_by.user_id
LEFT JOIN service_catalog sc ON l.service_code = sc.service_code
WHERE hp.claimed_by IS NULL
ORDER BY hp.priority DESC, hp.handed_over_at ASC;

-- Pipeline Overdue View: Opportunities past their next_step_due_date
CREATE OR REPLACE VIEW v_pipeline_overdue AS
SELECT
  o.*,
  a.company_name as account_name,
  p.full_name as owner_name,
  (current_date - o.next_step_due_date) as days_overdue
FROM opportunities o
JOIN accounts a ON o.account_id = a.account_id
JOIN profiles p ON o.owner_user_id = p.user_id
WHERE o.stage NOT IN ('Closed Won', 'Closed Lost')
  AND o.next_step_due_date < current_date
ORDER BY days_overdue DESC;

-- =========================
-- DEFAULT CADENCE SEED DATA
-- =========================

-- Insert default cadence if not exists
INSERT INTO cadences (name, description, is_active, created_by)
SELECT
  'Default Lead Follow-Up',
  'Standard 14-day sales cadence for new leads and opportunities',
  true,
  (SELECT user_id FROM profiles WHERE role_name = 'Director' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM cadences WHERE name = 'Default Lead Follow-Up'
);

-- Insert cadence steps for default cadence
INSERT INTO cadence_steps (cadence_id, step_number, activity_type, subject_template, description_template, delay_days)
SELECT
  c.cadence_id,
  step_data.step_number,
  step_data.activity_type::activity_type_v2,
  step_data.subject_template,
  step_data.description_template,
  step_data.delay_days
FROM cadences c
CROSS JOIN (
  VALUES
    (1, 'Call', 'Initial contact call: {company}', 'Make initial contact call to introduce services', 0),
    (2, 'Email', 'Follow-up email with proposal: {company}', 'Send email with service information and proposal', 2),
    (3, 'Call', 'Check-in call: {company}', 'Follow up on proposal and gauge interest', 5),
    (4, 'Email', 'Value proposition follow-up: {company}', 'Reinforce value proposition with case studies', 10),
    (5, 'Call', 'Decision timeline discussion: {company}', 'Discuss timeline and next steps for decision', 14)
) AS step_data(step_number, activity_type, subject_template, description_template, delay_days)
WHERE c.name = 'Default Lead Follow-Up'
  AND NOT EXISTS (
    SELECT 1 FROM cadence_steps cs
    WHERE cs.cadence_id = c.cadence_id
    AND cs.step_number = step_data.step_number
  );

-- Insert winback cadence if not exists
INSERT INTO cadences (name, description, is_active, created_by)
SELECT
  'Customer Winback',
  'Reactivation cadence for inactive customers (90+ days)',
  true,
  (SELECT user_id FROM profiles WHERE role_name = 'Director' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM cadences WHERE name = 'Customer Winback'
);

-- Insert winback cadence steps
INSERT INTO cadence_steps (cadence_id, step_number, activity_type, subject_template, description_template, delay_days)
SELECT
  c.cadence_id,
  step_data.step_number,
  step_data.activity_type::activity_type_v2,
  step_data.subject_template,
  step_data.description_template,
  step_data.delay_days
FROM cadences c
CROSS JOIN (
  VALUES
    (1, 'Call', 'Reactivation call: {company}', 'Reach out to understand inactivity reason', 0),
    (2, 'Email', 'We miss you: {company}', 'Send reconnection email with latest offerings', 3),
    (3, 'Call', 'Follow-up winback: {company}', 'Discuss current needs and potential restart', 7),
    (4, 'Email', 'Special offer for returning customer: {company}', 'Present special reactivation offer', 14)
) AS step_data(step_number, activity_type, subject_template, description_template, delay_days)
WHERE c.name = 'Customer Winback'
  AND NOT EXISTS (
    SELECT 1 FROM cadence_steps cs
    WHERE cs.cadence_id = c.cadence_id
    AND cs.step_number = step_data.step_number
  );

-- =========================
-- ENHANCED RPC: Sales Claim Lead with Cadence Enrollment
-- =========================

CREATE OR REPLACE FUNCTION rpc_sales_claim_lead(
  p_idempotency_key text,
  p_lead_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cached jsonb;
  v_pool_record record;
  v_lead record;
  v_account_id text;
  v_opportunity_id text;
  v_activity_id text;
  v_enrollment_id bigint;
  v_cadence_id integer;
  v_step record;
  v_due_date date;
  v_result jsonb;
  v_activities_created integer := 0;
BEGIN
  -- Check idempotency
  v_cached := check_idempotency(p_idempotency_key);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  -- Lock and claim lead (race-safe with FOR UPDATE SKIP LOCKED)
  IF p_lead_id IS NOT NULL THEN
    SELECT * INTO v_pool_record
    FROM lead_handover_pool
    WHERE lead_id = p_lead_id AND claimed_by IS NULL
    FOR UPDATE SKIP LOCKED;
  ELSE
    SELECT * INTO v_pool_record
    FROM lead_handover_pool
    WHERE claimed_by IS NULL
    ORDER BY priority DESC, handed_over_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
  END IF;

  IF v_pool_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No available leads to claim');
  END IF;

  -- Mark as claimed
  UPDATE lead_handover_pool
  SET claimed_by = auth.uid(),
      claimed_at = now()
  WHERE handover_id = v_pool_record.handover_id;

  -- Get lead details
  SELECT * INTO v_lead FROM leads WHERE lead_id = v_pool_record.lead_id;

  -- Create or find account
  SELECT account_id INTO v_account_id
  FROM accounts
  WHERE lower(company_name) = lower(v_lead.company_name)
  LIMIT 1;

  IF v_account_id IS NULL THEN
    INSERT INTO accounts (company_name, pic_name, pic_email, pic_phone, owner_user_id, city)
    VALUES (v_lead.company_name, v_lead.pic_name, v_lead.email, v_lead.contact_phone, auth.uid(), v_lead.city_area)
    RETURNING account_id INTO v_account_id;
  END IF;

  -- Create opportunity
  INSERT INTO opportunities (
    account_id, name, owner_user_id, source_lead_id, service_codes,
    route, next_step, next_step_due_date, created_by
  )
  VALUES (
    v_account_id,
    v_lead.company_name || ' - ' || COALESCE(v_lead.service_code, 'Opportunity'),
    auth.uid(),
    v_lead.lead_id,
    ARRAY[v_lead.service_code],
    v_lead.route,
    'Initial contact',
    current_date + interval '1 day',
    auth.uid()
  )
  RETURNING opportunity_id INTO v_opportunity_id;

  -- Update lead with opportunity link
  UPDATE leads
  SET sales_owner_user_id = auth.uid(),
      opportunity_id = v_opportunity_id,
      status = 'Contacted',
      updated_at = now()
  WHERE lead_id = v_lead.lead_id;

  -- Get default cadence
  SELECT cadence_id INTO v_cadence_id
  FROM cadences
  WHERE name = 'Default Lead Follow-Up' AND is_active = true
  LIMIT 1;

  IF v_cadence_id IS NOT NULL THEN
    -- Create cadence enrollment
    INSERT INTO cadence_enrollments (
      cadence_id, account_id, opportunity_id, current_step, status, enrolled_by
    )
    VALUES (
      v_cadence_id, v_account_id, v_opportunity_id, 1, 'Active', auth.uid()
    )
    RETURNING enrollment_id INTO v_enrollment_id;

    -- Create all activities from cadence steps
    FOR v_step IN
      SELECT * FROM cadence_steps
      WHERE cadence_id = v_cadence_id
      ORDER BY step_number
    LOOP
      v_due_date := current_date + (v_step.delay_days || ' days')::interval;

      INSERT INTO activities (
        activity_type, status, subject, description,
        related_account_id, related_opportunity_id, related_lead_id,
        due_date, owner_user_id, created_by,
        cadence_enrollment_id, cadence_step_number
      )
      VALUES (
        v_step.activity_type,
        'Planned',
        replace(v_step.subject_template, '{company}', v_lead.company_name),
        v_step.description_template,
        v_account_id,
        v_opportunity_id,
        v_lead.lead_id,
        v_due_date,
        auth.uid(),
        auth.uid(),
        v_enrollment_id,
        v_step.step_number
      );

      v_activities_created := v_activities_created + 1;
    END LOOP;
  ELSE
    -- Fallback: Create single first activity if no cadence
    INSERT INTO activities (
      activity_type, status, subject, related_account_id,
      related_opportunity_id, related_lead_id, due_date, owner_user_id, created_by
    )
    VALUES (
      'Call'::activity_type_v2,
      'Planned'::activity_status,
      'First contact: ' || v_lead.company_name,
      v_account_id,
      v_opportunity_id,
      v_lead.lead_id,
      current_date,
      auth.uid(),
      auth.uid()
    )
    RETURNING activity_id INTO v_activity_id;

    v_activities_created := 1;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'lead_id', v_lead.lead_id,
    'account_id', v_account_id,
    'opportunity_id', v_opportunity_id,
    'enrollment_id', v_enrollment_id,
    'activities_created', v_activities_created
  );

  PERFORM store_idempotency(p_idempotency_key, 'sales_claim_lead', v_result);

  RETURN v_result;
END $$;

-- =========================
-- ENHANCED RPC: Target Convert with Cadence
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
  v_enrollment_id bigint;
  v_cadence_id integer;
  v_step record;
  v_due_date date;
  v_result jsonb;
  v_activities_created integer := 0;
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

  IF v_target.status = 'converted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target already converted');
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
    service_codes, next_step, next_step_due_date, notes, created_by
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

  -- Update target status
  UPDATE prospecting_targets
  SET status = 'converted',
      converted_to_account_id = v_account_id,
      converted_at = now(),
      updated_at = now()
  WHERE target_id = p_target_id;

  -- Enroll in cadence
  SELECT cadence_id INTO v_cadence_id
  FROM cadences
  WHERE name = 'Default Lead Follow-Up' AND is_active = true
  LIMIT 1;

  IF v_cadence_id IS NOT NULL THEN
    INSERT INTO cadence_enrollments (
      cadence_id, account_id, opportunity_id, current_step, status, enrolled_by
    )
    VALUES (
      v_cadence_id, v_account_id, v_opportunity_id, 1, 'Active', auth.uid()
    )
    RETURNING enrollment_id INTO v_enrollment_id;

    -- Create all activities from cadence steps
    FOR v_step IN
      SELECT * FROM cadence_steps
      WHERE cadence_id = v_cadence_id
      ORDER BY step_number
    LOOP
      v_due_date := current_date + (v_step.delay_days || ' days')::interval;

      INSERT INTO activities (
        activity_type, status, subject, description,
        related_account_id, related_opportunity_id, related_target_id,
        due_date, owner_user_id, created_by,
        cadence_enrollment_id, cadence_step_number
      )
      VALUES (
        v_step.activity_type,
        'Planned',
        replace(v_step.subject_template, '{company}', v_target.company_name),
        v_step.description_template,
        v_account_id,
        v_opportunity_id,
        p_target_id,
        v_due_date,
        auth.uid(),
        auth.uid(),
        v_enrollment_id,
        v_step.step_number
      );

      v_activities_created := v_activities_created + 1;
    END LOOP;
  END IF;

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'account_id', v_account_id,
    'contact_id', v_contact_id,
    'opportunity_id', v_opportunity_id,
    'enrollment_id', v_enrollment_id,
    'activities_created', v_activities_created
  );

  PERFORM store_idempotency(p_idempotency_key, 'target_convert_to_lead', v_result);

  RETURN v_result;
END $$;

-- =========================
-- RPC: Enroll Account in Winback Cadence
-- =========================

CREATE OR REPLACE FUNCTION rpc_enroll_winback_cadence(
  p_idempotency_key text,
  p_account_id text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cached jsonb;
  v_account record;
  v_cadence_id integer;
  v_opportunity_id text;
  v_enrollment_id bigint;
  v_step record;
  v_due_date date;
  v_result jsonb;
  v_activities_created integer := 0;
BEGIN
  -- Check idempotency
  v_cached := check_idempotency(p_idempotency_key);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  -- Get account
  SELECT * INTO v_account FROM accounts WHERE account_id = p_account_id;
  IF v_account IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account not found');
  END IF;

  -- Check for existing active winback enrollment
  IF EXISTS (
    SELECT 1 FROM cadence_enrollments ce
    JOIN cadences c ON ce.cadence_id = c.cadence_id
    WHERE ce.account_id = p_account_id
    AND c.name = 'Customer Winback'
    AND ce.status = 'Active'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account already enrolled in winback cadence');
  END IF;

  -- Get winback cadence
  SELECT cadence_id INTO v_cadence_id
  FROM cadences
  WHERE name = 'Customer Winback' AND is_active = true
  LIMIT 1;

  IF v_cadence_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Winback cadence not configured');
  END IF;

  -- Create a winback opportunity
  INSERT INTO opportunities (
    account_id, name, owner_user_id, stage,
    next_step, next_step_due_date, notes, created_by
  )
  VALUES (
    p_account_id,
    v_account.company_name || ' - Winback',
    auth.uid(),
    'Prospecting',
    'Winback outreach',
    current_date,
    COALESCE(p_notes, 'Customer reactivation attempt'),
    auth.uid()
  )
  RETURNING opportunity_id INTO v_opportunity_id;

  -- Create enrollment
  INSERT INTO cadence_enrollments (
    cadence_id, account_id, opportunity_id, current_step, status, enrolled_by
  )
  VALUES (
    v_cadence_id, p_account_id, v_opportunity_id, 1, 'Active', auth.uid()
  )
  RETURNING enrollment_id INTO v_enrollment_id;

  -- Create activities from cadence steps
  FOR v_step IN
    SELECT * FROM cadence_steps
    WHERE cadence_id = v_cadence_id
    ORDER BY step_number
  LOOP
    v_due_date := current_date + (v_step.delay_days || ' days')::interval;

    INSERT INTO activities (
      activity_type, status, subject, description,
      related_account_id, related_opportunity_id,
      due_date, owner_user_id, created_by,
      cadence_enrollment_id, cadence_step_number
    )
    VALUES (
      v_step.activity_type,
      'Planned',
      replace(v_step.subject_template, '{company}', v_account.company_name),
      v_step.description_template,
      p_account_id,
      v_opportunity_id,
      v_due_date,
      auth.uid(),
      auth.uid(),
      v_enrollment_id,
      v_step.step_number
    );

    v_activities_created := v_activities_created + 1;
  END LOOP;

  v_result := jsonb_build_object(
    'success', true,
    'account_id', p_account_id,
    'opportunity_id', v_opportunity_id,
    'enrollment_id', v_enrollment_id,
    'activities_created', v_activities_created
  );

  PERFORM store_idempotency(p_idempotency_key, 'enroll_winback_cadence', v_result);

  RETURN v_result;
END $$;

-- =========================
-- RPC: Validate Lead Triage Transition
-- =========================

CREATE OR REPLACE FUNCTION validate_lead_triage_transition(
  p_current_status lead_triage_status,
  p_new_status lead_triage_status
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Define valid transitions
  RETURN CASE
    WHEN p_current_status = 'New' AND p_new_status IN ('In Review', 'Qualified', 'Nurture', 'Disqualified') THEN true
    WHEN p_current_status = 'In Review' AND p_new_status IN ('Qualified', 'Nurture', 'Disqualified') THEN true
    WHEN p_current_status = 'Qualified' AND p_new_status IN ('Handed Over') THEN true
    WHEN p_current_status = 'Nurture' AND p_new_status IN ('Qualified', 'Disqualified') THEN true
    WHEN p_current_status = 'Handed Over' THEN false -- Terminal for marketing
    WHEN p_current_status = 'Disqualified' THEN false -- Terminal
    ELSE false
  END;
END $$;

-- =========================
-- TRIGGER: Enforce Lead Triage Transitions
-- =========================

CREATE OR REPLACE FUNCTION enforce_lead_triage_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Skip if status unchanged
  IF OLD.triage_status = NEW.triage_status THEN
    RETURN NEW;
  END IF;

  -- Skip for CRM admins
  IF is_crm_admin() THEN
    RETURN NEW;
  END IF;

  -- Validate transition
  IF NOT validate_lead_triage_transition(OLD.triage_status, NEW.triage_status) THEN
    RAISE EXCEPTION 'Invalid triage status transition from % to %', OLD.triage_status, NEW.triage_status;
  END IF;

  -- Set timestamps based on transition
  IF NEW.triage_status = 'Qualified' AND OLD.triage_status != 'Qualified' THEN
    NEW.qualified_at := now();
  ELSIF NEW.triage_status = 'Disqualified' AND OLD.triage_status != 'Disqualified' THEN
    NEW.disqualified_at := now();
    IF NEW.disqualified_reason IS NULL OR NEW.disqualified_reason = '' THEN
      RAISE EXCEPTION 'Disqualified reason is required';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_lead_triage ON leads;
CREATE TRIGGER trg_enforce_lead_triage
BEFORE UPDATE OF triage_status ON leads
FOR EACH ROW EXECUTE FUNCTION enforce_lead_triage_transition();

-- =========================
-- GRANT PERMISSIONS
-- =========================

GRANT EXECUTE ON FUNCTION rpc_enroll_winback_cadence(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_lead_triage_transition(lead_triage_status, lead_triage_status) TO authenticated;

-- =========================
-- END OF MIGRATION
-- =========================

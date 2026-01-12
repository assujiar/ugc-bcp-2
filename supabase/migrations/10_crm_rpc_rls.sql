-- =============================================================================
-- CRM RPC Functions and RLS Policies
-- Version: 3.0
--
-- Atomic operations with idempotency support
-- =============================================================================

-- =========================
-- RLS POLICIES FOR NEW TABLES
-- =========================

-- Enable RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospecting_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadences ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_handover_pool ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is director/super admin
CREATE OR REPLACE FUNCTION is_crm_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND role_name IN ('Director', 'super admin')
  );
$$;

-- Helper function to check if user is sales team
CREATE OR REPLACE FUNCTION is_sales_team()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND role_name IN ('Director', 'super admin', 'sales manager', 'salesperson', 'sales support')
  );
$$;

-- Helper function to check if user is marketing team
CREATE OR REPLACE FUNCTION is_marketing_team()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND role_name IN ('Director', 'super admin', 'Marketing Manager', 'Marcomm (marketing staff)', 'DGO (Marketing staff)', 'MACX (marketing staff)', 'VSDO (marketing staff)')
  );
$$;

-- =========================
-- CONTACTS POLICIES
-- =========================
CREATE POLICY contacts_select ON contacts FOR SELECT USING (
  is_crm_admin() OR is_sales_team() OR is_marketing_team()
);

CREATE POLICY contacts_insert ON contacts FOR INSERT WITH CHECK (
  is_crm_admin() OR is_sales_team()
);

CREATE POLICY contacts_update ON contacts FOR UPDATE USING (
  is_crm_admin() OR is_sales_team()
);

CREATE POLICY contacts_delete ON contacts FOR DELETE USING (
  is_crm_admin()
);

-- =========================
-- PROSPECTING TARGETS POLICIES
-- =========================
CREATE POLICY targets_select ON prospecting_targets FOR SELECT USING (
  is_crm_admin() OR owner_user_id = auth.uid() OR owner_user_id IS NULL
);

CREATE POLICY targets_insert ON prospecting_targets FOR INSERT WITH CHECK (
  is_crm_admin() OR is_sales_team()
);

CREATE POLICY targets_update ON prospecting_targets FOR UPDATE USING (
  is_crm_admin() OR owner_user_id = auth.uid()
);

CREATE POLICY targets_delete ON prospecting_targets FOR DELETE USING (
  is_crm_admin()
);

-- =========================
-- OPPORTUNITIES POLICIES
-- =========================
CREATE POLICY opportunities_select ON opportunities FOR SELECT USING (
  is_crm_admin() OR owner_user_id = auth.uid() OR is_marketing_team()
);

CREATE POLICY opportunities_insert ON opportunities FOR INSERT WITH CHECK (
  is_crm_admin() OR is_sales_team()
);

CREATE POLICY opportunities_update ON opportunities FOR UPDATE USING (
  is_crm_admin() OR owner_user_id = auth.uid()
);

CREATE POLICY opportunities_delete ON opportunities FOR DELETE USING (
  is_crm_admin()
);

-- =========================
-- OPPORTUNITY STAGE HISTORY POLICIES
-- =========================
CREATE POLICY opp_stage_history_select ON opportunity_stage_history FOR SELECT USING (
  is_crm_admin() OR is_sales_team() OR is_marketing_team()
);

CREATE POLICY opp_stage_history_insert ON opportunity_stage_history FOR INSERT WITH CHECK (
  is_crm_admin() OR is_sales_team()
);

-- =========================
-- SHIPMENT PROFILES POLICIES
-- =========================
CREATE POLICY shipment_profiles_select ON shipment_profiles FOR SELECT USING (
  is_crm_admin() OR is_sales_team()
);

CREATE POLICY shipment_profiles_insert ON shipment_profiles FOR INSERT WITH CHECK (
  is_crm_admin() OR is_sales_team()
);

CREATE POLICY shipment_profiles_update ON shipment_profiles FOR UPDATE USING (
  is_crm_admin() OR is_sales_team()
);

-- =========================
-- ACTIVITIES POLICIES
-- =========================
CREATE POLICY activities_select ON activities FOR SELECT USING (
  is_crm_admin() OR owner_user_id = auth.uid() OR is_marketing_team()
);

CREATE POLICY activities_insert ON activities FOR INSERT WITH CHECK (
  is_crm_admin() OR is_sales_team() OR is_marketing_team()
);

CREATE POLICY activities_update ON activities FOR UPDATE USING (
  is_crm_admin() OR owner_user_id = auth.uid()
);

CREATE POLICY activities_delete ON activities FOR DELETE USING (
  is_crm_admin()
);

-- =========================
-- CADENCES POLICIES
-- =========================
CREATE POLICY cadences_select ON cadences FOR SELECT USING (
  is_crm_admin() OR is_sales_team() OR is_marketing_team()
);

CREATE POLICY cadences_insert ON cadences FOR INSERT WITH CHECK (
  is_crm_admin()
);

CREATE POLICY cadences_update ON cadences FOR UPDATE USING (
  is_crm_admin()
);

-- =========================
-- CADENCE STEPS POLICIES
-- =========================
CREATE POLICY cadence_steps_select ON cadence_steps FOR SELECT USING (
  is_crm_admin() OR is_sales_team() OR is_marketing_team()
);

CREATE POLICY cadence_steps_insert ON cadence_steps FOR INSERT WITH CHECK (
  is_crm_admin()
);

-- =========================
-- CADENCE ENROLLMENTS POLICIES
-- =========================
CREATE POLICY enrollments_select ON cadence_enrollments FOR SELECT USING (
  is_crm_admin() OR enrolled_by = auth.uid()
);

CREATE POLICY enrollments_insert ON cadence_enrollments FOR INSERT WITH CHECK (
  is_crm_admin() OR is_sales_team()
);

CREATE POLICY enrollments_update ON cadence_enrollments FOR UPDATE USING (
  is_crm_admin() OR enrolled_by = auth.uid()
);

-- =========================
-- QUOTES POLICIES
-- =========================
CREATE POLICY quotes_select ON quotes FOR SELECT USING (
  is_crm_admin() OR is_sales_team()
);

CREATE POLICY quotes_insert ON quotes FOR INSERT WITH CHECK (
  is_crm_admin() OR is_sales_team()
);

CREATE POLICY quotes_update ON quotes FOR UPDATE USING (
  is_crm_admin() OR is_sales_team()
);

-- =========================
-- INVOICE LEDGER POLICIES
-- =========================
CREATE POLICY invoice_ledger_select ON invoice_ledger FOR SELECT USING (
  is_crm_admin() OR is_sales_team() OR EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND dept_code = 'FIN'
  )
);

CREATE POLICY invoice_ledger_insert ON invoice_ledger FOR INSERT WITH CHECK (
  is_crm_admin() OR EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND dept_code = 'FIN'
  )
);

-- =========================
-- CRM IDEMPOTENCY POLICIES
-- =========================
CREATE POLICY idempotency_all ON crm_idempotency FOR ALL USING (
  is_crm_admin() OR created_by = auth.uid()
);

-- =========================
-- LEAD HANDOVER POOL POLICIES
-- =========================
CREATE POLICY handover_pool_select ON lead_handover_pool FOR SELECT USING (
  is_crm_admin() OR is_sales_team() OR is_marketing_team()
);

CREATE POLICY handover_pool_insert ON lead_handover_pool FOR INSERT WITH CHECK (
  is_crm_admin() OR is_marketing_team()
);

CREATE POLICY handover_pool_update ON lead_handover_pool FOR UPDATE USING (
  is_crm_admin() OR is_sales_team()
);

-- =========================
-- RPC FUNCTIONS
-- =========================

-- Check idempotency and return cached result if exists
CREATE OR REPLACE FUNCTION check_idempotency(p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT response_data INTO v_result
  FROM crm_idempotency
  WHERE idempotency_key = p_key
    AND expires_at > now();

  RETURN v_result;
END $$;

-- Store idempotency result
CREATE OR REPLACE FUNCTION store_idempotency(p_key text, p_operation text, p_response jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO crm_idempotency (idempotency_key, operation, response_data, created_by)
  VALUES (p_key, p_operation, p_response, auth.uid())
  ON CONFLICT (idempotency_key) DO UPDATE
  SET response_data = p_response,
      created_at = now(),
      expires_at = now() + interval '24 hours';
END $$;

-- =========================
-- RPC: Sales Quick Add Prospect
-- Creates lead + account + contact + opportunity + first activity in one atomic operation
-- =========================
CREATE OR REPLACE FUNCTION rpc_sales_quick_add_prospect(
  p_idempotency_key text,
  p_company_name text,
  p_contact_first_name text,
  p_contact_last_name text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_service_codes text[] DEFAULT NULL,
  p_route text DEFAULT NULL,
  p_estimated_value numeric DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cached jsonb;
  v_account_id text;
  v_contact_id text;
  v_opportunity_id text;
  v_activity_id text;
  v_lead_id text;
  v_result jsonb;
BEGIN
  -- Check idempotency
  v_cached := check_idempotency(p_idempotency_key);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  -- Create or find account
  SELECT account_id INTO v_account_id
  FROM accounts
  WHERE lower(company_name) = lower(p_company_name)
  LIMIT 1;

  IF v_account_id IS NULL THEN
    INSERT INTO accounts (company_name, pic_name, pic_email, pic_phone, owner_user_id)
    VALUES (p_company_name, p_contact_first_name, p_contact_email, p_contact_phone, auth.uid())
    RETURNING account_id INTO v_account_id;
  END IF;

  -- Create contact
  INSERT INTO contacts (account_id, first_name, last_name, email, phone, is_primary, created_by)
  VALUES (v_account_id, p_contact_first_name, p_contact_last_name, p_contact_email, p_contact_phone, true, auth.uid())
  RETURNING contact_id INTO v_contact_id;

  -- Create opportunity
  INSERT INTO opportunities (
    account_id, name, owner_user_id, estimated_value,
    service_codes, route, next_step, next_step_due_date, notes, created_by
  )
  VALUES (
    v_account_id,
    p_company_name || ' - ' || COALESCE(array_to_string(p_service_codes, ', '), 'New Opportunity'),
    auth.uid(),
    p_estimated_value,
    p_service_codes,
    p_route,
    'Initial contact call/meeting',
    current_date + interval '2 days',
    p_notes,
    auth.uid()
  )
  RETURNING opportunity_id INTO v_opportunity_id;

  -- Create first planned activity
  INSERT INTO activities (
    activity_type, status, subject, related_account_id, related_contact_id,
    related_opportunity_id, due_date, owner_user_id, created_by
  )
  VALUES (
    'Call'::activity_type_v2,
    'Planned'::activity_status,
    'Initial contact: ' || p_company_name,
    v_account_id,
    v_contact_id,
    v_opportunity_id,
    current_date + interval '1 day',
    auth.uid(),
    auth.uid()
  )
  RETURNING activity_id INTO v_activity_id;

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'account_id', v_account_id,
    'contact_id', v_contact_id,
    'opportunity_id', v_opportunity_id,
    'activity_id', v_activity_id
  );

  -- Store idempotency
  PERFORM store_idempotency(p_idempotency_key, 'sales_quick_add_prospect', v_result);

  RETURN v_result;
END $$;

-- =========================
-- RPC: Target Convert to Lead
-- Converts a prospecting target to lead + account/contact + opportunity
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
  v_lead_id text;
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

  IF v_target.status = 'Converted' THEN
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
    next_step, next_step_due_date, notes, created_by
  )
  VALUES (
    v_account_id,
    v_target.company_name || ' - Converted from Target',
    auth.uid(),
    p_target_id,
    'Schedule discovery call',
    current_date + interval '3 days',
    COALESCE(p_notes, v_target.notes),
    auth.uid()
  )
  RETURNING opportunity_id INTO v_opportunity_id;

  -- Update target status
  UPDATE prospecting_targets
  SET status = 'Converted',
      converted_to_account_id = v_account_id,
      updated_at = now()
  WHERE target_id = p_target_id;

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'account_id', v_account_id,
    'contact_id', v_contact_id,
    'opportunity_id', v_opportunity_id
  );

  PERFORM store_idempotency(p_idempotency_key, 'target_convert_to_lead', v_result);

  RETURN v_result;
END $$;

-- =========================
-- RPC: Lead Handover to Sales Pool
-- Marketing hands over lead to sales pool
-- =========================
CREATE OR REPLACE FUNCTION rpc_lead_handover_to_sales_pool(
  p_idempotency_key text,
  p_lead_id text,
  p_notes text DEFAULT NULL,
  p_priority integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cached jsonb;
  v_lead record;
  v_result jsonb;
BEGIN
  -- Check idempotency
  v_cached := check_idempotency(p_idempotency_key);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  -- Get lead
  SELECT * INTO v_lead FROM leads WHERE lead_id = p_lead_id;
  IF v_lead IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead not found');
  END IF;

  -- Check if lead is qualified for handover (has minimum required fields)
  IF v_lead.company_name IS NULL OR v_lead.contact_phone IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead missing required fields for handover');
  END IF;

  -- Check if already in pool
  IF EXISTS (SELECT 1 FROM lead_handover_pool WHERE lead_id = p_lead_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead already in handover pool');
  END IF;

  -- Add to handover pool
  INSERT INTO lead_handover_pool (lead_id, handed_over_by, notes, priority)
  VALUES (p_lead_id, auth.uid(), p_notes, p_priority);

  -- Update lead status
  UPDATE leads
  SET triage_status = 'Handed Over',
      handover_eligible = true,
      handover_notes = p_notes,
      updated_at = now()
  WHERE lead_id = p_lead_id;

  v_result := jsonb_build_object(
    'success', true,
    'lead_id', p_lead_id,
    'message', 'Lead added to sales handover pool'
  );

  PERFORM store_idempotency(p_idempotency_key, 'lead_handover_to_sales_pool', v_result);

  RETURN v_result;
END $$;

-- =========================
-- RPC: Sales Claim Lead (Get Lead)
-- Race-safe assignment of lead from pool to sales
-- =========================
CREATE OR REPLACE FUNCTION rpc_sales_claim_lead(
  p_idempotency_key text,
  p_lead_id text DEFAULT NULL  -- NULL = get any unclaimed lead
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
  v_result jsonb;
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

  -- Create first activity
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

  v_result := jsonb_build_object(
    'success', true,
    'lead_id', v_lead.lead_id,
    'account_id', v_account_id,
    'opportunity_id', v_opportunity_id,
    'activity_id', v_activity_id
  );

  PERFORM store_idempotency(p_idempotency_key, 'sales_claim_lead', v_result);

  RETURN v_result;
END $$;

-- =========================
-- RPC: Opportunity Change Stage
-- Enforces next_step + due_date and Quote Sent requires quote
-- =========================
CREATE OR REPLACE FUNCTION rpc_opportunity_change_stage(
  p_idempotency_key text,
  p_opportunity_id text,
  p_new_stage opportunity_stage,
  p_next_step text,
  p_next_step_due_date date,
  p_lost_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cached jsonb;
  v_opp record;
  v_result jsonb;
BEGIN
  -- Check idempotency
  v_cached := check_idempotency(p_idempotency_key);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  -- Get opportunity
  SELECT * INTO v_opp FROM opportunities WHERE opportunity_id = p_opportunity_id;
  IF v_opp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Opportunity not found');
  END IF;

  -- Enforce Quote Sent requires quote
  IF p_new_stage = 'Quote Sent' THEN
    IF NOT EXISTS (SELECT 1 FROM quotes WHERE opportunity_id = p_opportunity_id AND status IN ('Draft', 'Sent')) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Quote Sent stage requires a quote record');
    END IF;
  END IF;

  -- Enforce lost reason for Closed Lost
  IF p_new_stage = 'Closed Lost' AND p_lost_reason IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lost reason is required for Closed Lost');
  END IF;

  -- Update opportunity
  UPDATE opportunities
  SET stage = p_new_stage,
      next_step = p_next_step,
      next_step_due_date = p_next_step_due_date,
      lost_reason = COALESCE(p_lost_reason, lost_reason),
      notes = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE opportunity_id = p_opportunity_id;

  v_result := jsonb_build_object(
    'success', true,
    'opportunity_id', p_opportunity_id,
    'new_stage', p_new_stage
  );

  PERFORM store_idempotency(p_idempotency_key, 'opportunity_change_stage', v_result);

  RETURN v_result;
END $$;

-- =========================
-- RPC: Activity Complete and Next
-- Marks activity as done and creates next planned activity
-- =========================
CREATE OR REPLACE FUNCTION rpc_activity_complete_and_next(
  p_idempotency_key text,
  p_activity_id text,
  p_outcome text DEFAULT NULL,
  p_duration_minutes integer DEFAULT NULL,
  p_create_next boolean DEFAULT true,
  p_next_activity_type activity_type_v2 DEFAULT 'Follow Up',
  p_next_subject text DEFAULT NULL,
  p_next_due_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cached jsonb;
  v_activity record;
  v_next_activity_id text;
  v_result jsonb;
BEGIN
  -- Check idempotency
  v_cached := check_idempotency(p_idempotency_key);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  -- Get activity
  SELECT * INTO v_activity FROM activities WHERE activity_id = p_activity_id;
  IF v_activity IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Activity not found');
  END IF;

  IF v_activity.status != 'Planned' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Activity is not in Planned status');
  END IF;

  -- Mark as done
  UPDATE activities
  SET status = 'Done',
      completed_at = now(),
      outcome = COALESCE(p_outcome, outcome),
      duration_minutes = COALESCE(p_duration_minutes, duration_minutes),
      updated_at = now()
  WHERE activity_id = p_activity_id;

  -- Create next activity if requested
  IF p_create_next THEN
    INSERT INTO activities (
      activity_type, status, subject, description,
      related_account_id, related_contact_id, related_opportunity_id, related_lead_id,
      due_date, owner_user_id, created_by
    )
    VALUES (
      p_next_activity_type,
      'Planned',
      COALESCE(p_next_subject, 'Follow up: ' || v_activity.subject),
      'Follow up from activity ' || p_activity_id,
      v_activity.related_account_id,
      v_activity.related_contact_id,
      v_activity.related_opportunity_id,
      v_activity.related_lead_id,
      COALESCE(p_next_due_date, current_date + interval '3 days'),
      v_activity.owner_user_id,
      auth.uid()
    )
    RETURNING activity_id INTO v_next_activity_id;

    -- Update opportunity next_step if linked
    IF v_activity.related_opportunity_id IS NOT NULL THEN
      UPDATE opportunities
      SET next_step = COALESCE(p_next_subject, 'Follow up'),
          next_step_due_date = COALESCE(p_next_due_date, current_date + interval '3 days'),
          updated_at = now()
      WHERE opportunity_id = v_activity.related_opportunity_id;
    END IF;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'completed_activity_id', p_activity_id,
    'next_activity_id', v_next_activity_id
  );

  PERFORM store_idempotency(p_idempotency_key, 'activity_complete_and_next', v_result);

  RETURN v_result;
END $$;

-- =========================
-- RPC: Account Merge (Restricted)
-- Merges two accounts - admin only
-- =========================
CREATE OR REPLACE FUNCTION rpc_account_merge(
  p_idempotency_key text,
  p_source_account_id text,
  p_target_account_id text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cached jsonb;
  v_result jsonb;
BEGIN
  -- Check if user is admin
  IF NOT is_crm_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can merge accounts');
  END IF;

  -- Check idempotency
  v_cached := check_idempotency(p_idempotency_key);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  -- Move all related records to target account
  UPDATE contacts SET account_id = p_target_account_id WHERE account_id = p_source_account_id;
  UPDATE opportunities SET account_id = p_target_account_id WHERE account_id = p_source_account_id;
  UPDATE activities SET related_account_id = p_target_account_id WHERE related_account_id = p_source_account_id;
  UPDATE shipment_profiles SET account_id = p_target_account_id WHERE account_id = p_source_account_id;
  UPDATE quotes SET account_id = p_target_account_id WHERE account_id = p_source_account_id;
  UPDATE invoice_ledger SET account_id = p_target_account_id WHERE account_id = p_source_account_id;
  UPDATE invoices SET account_id = p_target_account_id WHERE account_id = p_source_account_id;
  UPDATE tickets SET related_account_id = p_target_account_id WHERE related_account_id = p_source_account_id;

  -- Log audit
  INSERT INTO audit_logs (table_name, record_id, action, changed_by, before_data, after_data)
  VALUES (
    'accounts',
    p_source_account_id,
    'MERGE',
    auth.uid(),
    jsonb_build_object('source_account_id', p_source_account_id),
    jsonb_build_object('target_account_id', p_target_account_id, 'notes', p_notes)
  );

  -- Mark source as inactive (don't delete to preserve history)
  UPDATE accounts
  SET is_active = false,
      company_name = company_name || ' [MERGED INTO ' || p_target_account_id || ']',
      updated_at = now()
  WHERE account_id = p_source_account_id;

  v_result := jsonb_build_object(
    'success', true,
    'source_account_id', p_source_account_id,
    'target_account_id', p_target_account_id,
    'message', 'Accounts merged successfully'
  );

  PERFORM store_idempotency(p_idempotency_key, 'account_merge', v_result);

  RETURN v_result;
END $$;

-- =========================
-- CLEANUP: Remove old functions
-- =========================
DROP FUNCTION IF EXISTS find_or_create_prospect(text, uuid);

-- =========================
-- END OF MIGRATION
-- =========================

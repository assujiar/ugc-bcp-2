-- =============================================================================
-- CRM RLS Alignment Migration
-- PR0.3: DB/RLS Alignment + Transition Audit Log
--
-- Purpose: Standardize RLS for all CRM core tables with consistent policies
-- Tables: leads, lead_handover_pool, opportunities, activities, accounts,
--         contacts, prospecting_targets, audit_logs
-- =============================================================================

-- =========================
-- HELPER FUNCTIONS (Enhanced)
-- =========================

-- Check if user is finance team
CREATE OR REPLACE FUNCTION is_finance_team()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND (role_name = 'finance' OR dept_code = 'FIN')
  );
$$;

-- Check if user owns or manages an account
CREATE OR REPLACE FUNCTION can_access_account(p_account_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM accounts a
    WHERE a.account_id = p_account_id
    AND (
      is_crm_admin()
      OR a.owner_user_id = auth.uid()
      OR is_sales_team()
      OR is_marketing_team()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = auth.uid()
        AND p.manager_user_id = a.owner_user_id
      )
    )
  );
$$;

-- Check if user can access lead
CREATE OR REPLACE FUNCTION can_access_lead(p_lead_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM leads l
    WHERE l.lead_id = p_lead_id
    AND (
      is_crm_admin()
      OR l.created_by = auth.uid()
      OR l.sales_owner_user_id = auth.uid()
      OR is_marketing_team()
      OR (is_sales_team() AND (l.sales_owner_user_id IS NOT NULL OR l.sourced_by = 'Sales'))
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = auth.uid()
        AND p.manager_user_id = l.sales_owner_user_id
      )
    )
  );
$$;

-- =========================
-- ACCOUNTS RLS
-- =========================
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate
DROP POLICY IF EXISTS accounts_select ON accounts;
DROP POLICY IF EXISTS accounts_insert ON accounts;
DROP POLICY IF EXISTS accounts_update ON accounts;
DROP POLICY IF EXISTS accounts_delete ON accounts;

-- SELECT: CRM admin, owner, sales team, marketing team, finance for invoicing
CREATE POLICY accounts_select ON accounts FOR SELECT USING (
  is_crm_admin()
  OR owner_user_id = auth.uid()
  OR is_sales_team()
  OR is_marketing_team()
  OR is_finance_team()
  -- Sales manager can see team members' accounts
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = owner_user_id
    AND p.manager_user_id = auth.uid()
  )
);

-- INSERT: CRM admin, sales team, marketing team
CREATE POLICY accounts_insert ON accounts FOR INSERT WITH CHECK (
  is_crm_admin() OR is_sales_team() OR is_marketing_team()
);

-- UPDATE: CRM admin, owner, sales manager for team
CREATE POLICY accounts_update ON accounts FOR UPDATE USING (
  is_crm_admin()
  OR owner_user_id = auth.uid()
  OR (is_sales_team() AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = owner_user_id
    AND p.manager_user_id = auth.uid()
  ))
) WITH CHECK (
  is_crm_admin()
  OR owner_user_id = auth.uid()
  OR (is_sales_team() AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = owner_user_id
    AND p.manager_user_id = auth.uid()
  ))
);

-- DELETE: CRM admin only
CREATE POLICY accounts_delete ON accounts FOR DELETE USING (
  is_crm_admin()
);

-- =========================
-- LEADS RLS (Enhanced)
-- =========================
-- Keep existing RLS enabled from 02_rls.sql, enhance policies

DROP POLICY IF EXISTS leads_select_scoped ON leads;
DROP POLICY IF EXISTS leads_insert_allowed ON leads;
DROP POLICY IF EXISTS leads_update_allowed ON leads;
DROP POLICY IF EXISTS leads_delete_super ON leads;

-- SELECT: Director, super admin, marketing manager, creator, owner, team
CREATE POLICY leads_select_enhanced ON leads FOR SELECT USING (
  is_crm_admin()
  OR created_by = auth.uid()
  OR sales_owner_user_id = auth.uid()
  OR is_marketing_team()
  OR (is_sales_team() AND (
    sales_owner_user_id IS NOT NULL
    OR sourced_by = 'Sales'::lead_source_by
  ))
  -- Sales manager can see team's leads
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = sales_owner_user_id
    AND p.manager_user_id = auth.uid()
  )
);

-- INSERT: Marketing, sales teams
CREATE POLICY leads_insert_enhanced ON leads FOR INSERT WITH CHECK (
  is_crm_admin() OR is_marketing_team() OR is_sales_team()
);

-- UPDATE: Restricted columns enforcement via trigger, allow by owner/team
CREATE POLICY leads_update_enhanced ON leads FOR UPDATE USING (
  is_crm_admin()
  OR created_by = auth.uid()
  OR sales_owner_user_id = auth.uid()
  OR app_is_role('Marketing Manager')
  OR app_is_role('sales support')
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = sales_owner_user_id
    AND p.manager_user_id = auth.uid()
  )
) WITH CHECK (
  is_crm_admin()
  OR created_by = auth.uid()
  OR sales_owner_user_id = auth.uid()
  OR app_is_role('Marketing Manager')
  OR app_is_role('sales support')
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = sales_owner_user_id
    AND p.manager_user_id = auth.uid()
  )
);

-- DELETE: CRM admin only
CREATE POLICY leads_delete_enhanced ON leads FOR DELETE USING (
  is_crm_admin()
);

-- =========================
-- LEAD HANDOVER POOL RLS (Enhanced)
-- =========================
DROP POLICY IF EXISTS handover_pool_select ON lead_handover_pool;
DROP POLICY IF EXISTS handover_pool_insert ON lead_handover_pool;
DROP POLICY IF EXISTS handover_pool_update ON lead_handover_pool;
DROP POLICY IF EXISTS handover_pool_delete ON lead_handover_pool;

-- SELECT: CRM admin, sales, marketing
CREATE POLICY handover_pool_select_enhanced ON lead_handover_pool FOR SELECT USING (
  is_crm_admin() OR is_sales_team() OR is_marketing_team()
);

-- INSERT: CRM admin, marketing (for handover)
CREATE POLICY handover_pool_insert_enhanced ON lead_handover_pool FOR INSERT WITH CHECK (
  is_crm_admin() OR is_marketing_team()
);

-- UPDATE: CRM admin, sales (for claiming)
CREATE POLICY handover_pool_update_enhanced ON lead_handover_pool FOR UPDATE USING (
  is_crm_admin() OR is_sales_team()
) WITH CHECK (
  is_crm_admin() OR is_sales_team()
);

-- DELETE: CRM admin only
CREATE POLICY handover_pool_delete_enhanced ON lead_handover_pool FOR DELETE USING (
  is_crm_admin()
);

-- =========================
-- OPPORTUNITIES RLS (Enhanced)
-- =========================
DROP POLICY IF EXISTS opportunities_select ON opportunities;
DROP POLICY IF EXISTS opportunities_insert ON opportunities;
DROP POLICY IF EXISTS opportunities_update ON opportunities;
DROP POLICY IF EXISTS opportunities_delete ON opportunities;

-- SELECT: CRM admin, owner, marketing (readonly), sales team, finance
CREATE POLICY opportunities_select_enhanced ON opportunities FOR SELECT USING (
  is_crm_admin()
  OR owner_user_id = auth.uid()
  OR is_marketing_team()
  OR is_sales_team()
  OR is_finance_team()
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = owner_user_id
    AND p.manager_user_id = auth.uid()
  )
);

-- INSERT: CRM admin, sales team
CREATE POLICY opportunities_insert_enhanced ON opportunities FOR INSERT WITH CHECK (
  is_crm_admin() OR is_sales_team()
);

-- UPDATE: CRM admin, owner, sales manager for team - Stage changes via RPC only
CREATE POLICY opportunities_update_enhanced ON opportunities FOR UPDATE USING (
  is_crm_admin()
  OR owner_user_id = auth.uid()
  OR (is_sales_team() AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = owner_user_id
    AND p.manager_user_id = auth.uid()
  ))
) WITH CHECK (
  is_crm_admin()
  OR owner_user_id = auth.uid()
  OR (is_sales_team() AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = owner_user_id
    AND p.manager_user_id = auth.uid()
  ))
);

-- DELETE: CRM admin only
CREATE POLICY opportunities_delete_enhanced ON opportunities FOR DELETE USING (
  is_crm_admin()
);

-- =========================
-- ACTIVITIES RLS (Enhanced)
-- =========================
DROP POLICY IF EXISTS activities_select ON activities;
DROP POLICY IF EXISTS activities_insert ON activities;
DROP POLICY IF EXISTS activities_update ON activities;
DROP POLICY IF EXISTS activities_delete ON activities;

-- SELECT: CRM admin, owner, marketing, related account access
CREATE POLICY activities_select_enhanced ON activities FOR SELECT USING (
  is_crm_admin()
  OR owner_user_id = auth.uid()
  OR is_marketing_team()
  OR is_sales_team()
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = owner_user_id
    AND p.manager_user_id = auth.uid()
  )
);

-- INSERT: CRM admin, sales, marketing
CREATE POLICY activities_insert_enhanced ON activities FOR INSERT WITH CHECK (
  is_crm_admin() OR is_sales_team() OR is_marketing_team()
);

-- UPDATE: CRM admin, owner only (status transitions via RPC)
CREATE POLICY activities_update_enhanced ON activities FOR UPDATE USING (
  is_crm_admin()
  OR owner_user_id = auth.uid()
  OR (is_sales_team() AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = owner_user_id
    AND p.manager_user_id = auth.uid()
  ))
) WITH CHECK (
  is_crm_admin()
  OR owner_user_id = auth.uid()
  OR (is_sales_team() AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = owner_user_id
    AND p.manager_user_id = auth.uid()
  ))
);

-- DELETE: CRM admin only
CREATE POLICY activities_delete_enhanced ON activities FOR DELETE USING (
  is_crm_admin()
);

-- =========================
-- CONTACTS RLS (Already defined in 10, enhance with finance access)
-- =========================
DROP POLICY IF EXISTS contacts_select ON contacts;

CREATE POLICY contacts_select_enhanced ON contacts FOR SELECT USING (
  is_crm_admin()
  OR is_sales_team()
  OR is_marketing_team()
  OR is_finance_team()
  OR EXISTS (
    SELECT 1 FROM accounts a
    WHERE a.account_id = contacts.account_id
    AND (
      a.owner_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = a.owner_user_id
        AND p.manager_user_id = auth.uid()
      )
    )
  )
);

-- =========================
-- PROSPECTING TARGETS RLS (Enhanced)
-- =========================
DROP POLICY IF EXISTS targets_select ON prospecting_targets;
DROP POLICY IF EXISTS targets_insert ON prospecting_targets;
DROP POLICY IF EXISTS targets_update ON prospecting_targets;
DROP POLICY IF EXISTS targets_delete ON prospecting_targets;

-- SELECT: CRM admin, owner, unowned targets visible to sales
CREATE POLICY targets_select_enhanced ON prospecting_targets FOR SELECT USING (
  is_crm_admin()
  OR owner_user_id = auth.uid()
  OR owner_user_id IS NULL
  OR is_sales_team()
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = owner_user_id
    AND p.manager_user_id = auth.uid()
  )
);

-- INSERT: CRM admin, sales team
CREATE POLICY targets_insert_enhanced ON prospecting_targets FOR INSERT WITH CHECK (
  is_crm_admin() OR is_sales_team()
);

-- UPDATE: CRM admin, owner
CREATE POLICY targets_update_enhanced ON prospecting_targets FOR UPDATE USING (
  is_crm_admin()
  OR owner_user_id = auth.uid()
  OR (is_sales_team() AND owner_user_id IS NULL)
) WITH CHECK (
  is_crm_admin()
  OR owner_user_id = auth.uid()
  OR (is_sales_team() AND owner_user_id IS NULL)
);

-- DELETE: CRM admin only
CREATE POLICY targets_delete_enhanced ON prospecting_targets FOR DELETE USING (
  is_crm_admin()
);

-- =========================
-- AUDIT LOGS RLS (Enhanced for director access)
-- =========================
DROP POLICY IF EXISTS audit_select_super ON audit_logs;
DROP POLICY IF EXISTS audit_insert_auth ON audit_logs;
DROP POLICY IF EXISTS audit_delete_super ON audit_logs;

-- SELECT: Super admin and director can view audit logs
CREATE POLICY audit_logs_select_enhanced ON audit_logs FOR SELECT USING (
  app_is_super_admin() OR app_is_director()
);

-- INSERT: Authenticated users (via SECURITY DEFINER functions)
CREATE POLICY audit_logs_insert_enhanced ON audit_logs FOR INSERT WITH CHECK (
  app_is_authenticated()
);

-- UPDATE: No updates allowed to audit logs
-- (No UPDATE policy = no updates possible)

-- DELETE: Super admin only (for compliance cleanup)
CREATE POLICY audit_logs_delete_enhanced ON audit_logs FOR DELETE USING (
  app_is_super_admin()
);

-- =========================
-- COLUMN-LEVEL RESTRICTIONS VIA TRIGGER
-- Prevent sales from updating certain lead columns
-- =========================

CREATE OR REPLACE FUNCTION enforce_lead_column_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Skip for CRM admins
  IF is_crm_admin() THEN
    RETURN NEW;
  END IF;

  -- Sales cannot change source attribution fields
  IF is_sales_team() AND NOT is_crm_admin() THEN
    IF OLD.sourced_by IS DISTINCT FROM NEW.sourced_by THEN
      RAISE EXCEPTION 'Sales team cannot modify sourced_by field';
    END IF;
    IF OLD.primary_channel IS DISTINCT FROM NEW.primary_channel THEN
      RAISE EXCEPTION 'Sales team cannot modify primary_channel field';
    END IF;
    IF OLD.campaign_name IS DISTINCT FROM NEW.campaign_name THEN
      RAISE EXCEPTION 'Sales team cannot modify campaign_name field';
    END IF;
    IF OLD.created_by IS DISTINCT FROM NEW.created_by THEN
      RAISE EXCEPTION 'Cannot modify created_by field';
    END IF;
  END IF;

  -- Marketing cannot change sales ownership fields (unless handover)
  IF is_marketing_team() AND NOT is_crm_admin() THEN
    IF OLD.sales_owner_user_id IS NOT NULL AND
       OLD.sales_owner_user_id IS DISTINCT FROM NEW.sales_owner_user_id THEN
      -- Allow clearing (NULL) but not reassigning
      IF NEW.sales_owner_user_id IS NOT NULL THEN
        RAISE EXCEPTION 'Marketing cannot reassign sales ownership';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_lead_restrictions ON leads;
CREATE TRIGGER trg_enforce_lead_restrictions
BEFORE UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION enforce_lead_column_restrictions();

-- =========================
-- COLUMN-LEVEL RESTRICTIONS FOR OPPORTUNITIES
-- Only stage transitions allowed via RPC
-- =========================

CREATE OR REPLACE FUNCTION enforce_opportunity_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_context text;
BEGIN
  -- Skip for CRM admins
  IF is_crm_admin() THEN
    RETURN NEW;
  END IF;

  -- Check if called from RPC context (pg_backend_pid check or session var)
  v_caller_context := current_setting('app.rpc_context', true);

  -- If not from RPC and stage is changing, reject
  IF OLD.stage IS DISTINCT FROM NEW.stage AND (v_caller_context IS NULL OR v_caller_context != 'rpc_allowed') THEN
    -- Allow stage changes only via RPC functions
    -- RPC functions should set: SET LOCAL app.rpc_context = 'rpc_allowed';
    IF NOT is_crm_admin() THEN
      RAISE EXCEPTION 'Stage changes must be done via official RPC functions';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_opportunity_restrictions ON opportunities;
CREATE TRIGGER trg_enforce_opportunity_restrictions
BEFORE UPDATE ON opportunities
FOR EACH ROW EXECUTE FUNCTION enforce_opportunity_restrictions();

-- Update RPC to set context
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
  -- Set RPC context to allow stage change
  SET LOCAL app.rpc_context = 'rpc_allowed';

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
    'old_stage', v_opp.stage,
    'new_stage', p_new_stage
  );

  PERFORM store_idempotency(p_idempotency_key, 'opportunity_change_stage', v_result);

  RETURN v_result;
END $$;

-- =========================
-- ACTIVITY STATUS RESTRICTIONS
-- =========================

CREATE OR REPLACE FUNCTION enforce_activity_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_context text;
BEGIN
  -- Skip for CRM admins
  IF is_crm_admin() THEN
    RETURN NEW;
  END IF;

  v_caller_context := current_setting('app.rpc_context', true);

  -- Status transitions must be via RPC
  IF OLD.status IS DISTINCT FROM NEW.status AND (v_caller_context IS NULL OR v_caller_context != 'rpc_allowed') THEN
    IF NOT is_crm_admin() THEN
      RAISE EXCEPTION 'Activity status changes must be done via official RPC functions';
    END IF;
  END IF;

  -- Cannot change completed/cancelled activities
  IF OLD.status IN ('Done', 'Cancelled') THEN
    RAISE EXCEPTION 'Cannot modify completed or cancelled activities';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_activity_restrictions ON activities;
CREATE TRIGGER trg_enforce_activity_restrictions
BEFORE UPDATE ON activities
FOR EACH ROW EXECUTE FUNCTION enforce_activity_restrictions();

-- Update activity RPC to set context
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
  -- Set RPC context to allow status change
  SET LOCAL app.rpc_context = 'rpc_allowed';

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
-- RPC: Activity Cancel
-- =========================
CREATE OR REPLACE FUNCTION rpc_activity_cancel(
  p_idempotency_key text,
  p_activity_id text,
  p_cancel_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cached jsonb;
  v_activity record;
  v_result jsonb;
BEGIN
  -- Set RPC context to allow status change
  SET LOCAL app.rpc_context = 'rpc_allowed';

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
    RETURN jsonb_build_object('success', false, 'error', 'Only planned activities can be cancelled');
  END IF;

  -- Check ownership
  IF NOT is_crm_admin() AND v_activity.owner_user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only activity owner can cancel');
  END IF;

  -- Mark as cancelled
  UPDATE activities
  SET status = 'Cancelled',
      cancelled_at = now(),
      outcome = COALESCE(p_cancel_reason, 'Cancelled'),
      updated_at = now()
  WHERE activity_id = p_activity_id;

  v_result := jsonb_build_object(
    'success', true,
    'activity_id', p_activity_id,
    'status', 'Cancelled'
  );

  PERFORM store_idempotency(p_idempotency_key, 'activity_cancel', v_result);

  RETURN v_result;
END $$;

-- =========================
-- GRANT EXECUTE ON NEW FUNCTIONS
-- =========================
GRANT EXECUTE ON FUNCTION rpc_activity_cancel(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION is_finance_team() TO authenticated;
GRANT EXECUTE ON FUNCTION can_access_account(text) TO authenticated;
GRANT EXECUTE ON FUNCTION can_access_lead(text) TO authenticated;

-- =========================
-- END OF MIGRATION
-- =========================

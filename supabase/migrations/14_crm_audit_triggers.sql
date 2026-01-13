-- =============================================================================
-- CRM Audit Triggers Migration
-- PR0.3: DB/RLS Alignment + Transition Audit Log
--
-- Purpose: Universal audit triggers for all CRM transitions:
-- - Lead triage, handover, claim, convert
-- - Opportunity stage move
-- - Activity complete/cancel
-- - Target convert/status update
-- =============================================================================

-- =========================
-- ENSURE DEPENDENCIES EXIST
-- =========================

-- Create CRM action type enum if not exists (dependency from 12_crm_audit_logs.sql)
DO $$ BEGIN
  CREATE TYPE crm_audit_action AS ENUM (
    -- Lead actions
    'LEAD_CREATED',
    'LEAD_UPDATED',
    'LEAD_TRIAGE',
    'LEAD_QUALIFIED',
    'LEAD_DISQUALIFIED',
    'LEAD_HANDED_OVER',
    'LEAD_CLAIMED',
    'LEAD_CONVERTED',

    -- Opportunity actions
    'OPPORTUNITY_CREATED',
    'OPPORTUNITY_UPDATED',
    'OPPORTUNITY_STAGE_CHANGED',
    'OPPORTUNITY_WON',
    'OPPORTUNITY_LOST',

    -- Activity actions
    'ACTIVITY_CREATED',
    'ACTIVITY_UPDATED',
    'ACTIVITY_COMPLETED',
    'ACTIVITY_CANCELLED',

    -- Account actions
    'ACCOUNT_CREATED',
    'ACCOUNT_UPDATED',
    'ACCOUNT_MERGED',

    -- Contact actions
    'CONTACT_CREATED',
    'CONTACT_UPDATED',

    -- Target actions
    'TARGET_CREATED',
    'TARGET_UPDATED',
    'TARGET_CONVERTED',
    'TARGET_STATUS_CHANGED',

    -- Generic actions (fallback)
    'INSERT',
    'UPDATE',
    'DELETE',
    'MERGE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================
-- LEADS AUDIT TRIGGER
-- =========================

CREATE OR REPLACE FUNCTION trg_audit_leads_transitions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action crm_audit_action;
  v_from_state jsonb;
  v_to_state jsonb;
BEGIN
  -- Build state snapshots
  IF TG_OP = 'INSERT' THEN
    v_from_state := NULL;
    v_to_state := row_to_json(NEW)::jsonb;
    v_action := 'LEAD_CREATED'::crm_audit_action;

    PERFORM log_crm_transition(
      'leads',
      NEW.lead_id,
      v_action,
      v_from_state,
      v_to_state,
      NULL,
      NULL,
      'trigger'
    );

  ELSIF TG_OP = 'UPDATE' THEN
    v_from_state := row_to_json(OLD)::jsonb;
    v_to_state := row_to_json(NEW)::jsonb;

    -- Detect triage status changes
    IF OLD.triage_status IS DISTINCT FROM NEW.triage_status THEN
      v_action := CASE NEW.triage_status
        WHEN 'Qualified' THEN 'LEAD_QUALIFIED'::crm_audit_action
        WHEN 'Disqualified' THEN 'LEAD_DISQUALIFIED'::crm_audit_action
        WHEN 'Handed Over' THEN 'LEAD_HANDED_OVER'::crm_audit_action
        ELSE 'LEAD_TRIAGE'::crm_audit_action
      END;

      PERFORM log_crm_transition(
        'leads',
        NEW.lead_id,
        v_action,
        v_from_state,
        v_to_state,
        NULL,
        NULL,
        'trigger'
      );
    END IF;

    -- Detect sales owner assignment (claim)
    IF OLD.sales_owner_user_id IS NULL AND NEW.sales_owner_user_id IS NOT NULL THEN
      PERFORM log_crm_transition(
        'leads',
        NEW.lead_id,
        'LEAD_CLAIMED'::crm_audit_action,
        v_from_state,
        v_to_state,
        NULL,
        NULL,
        'trigger'
      );
    END IF;

    -- Detect opportunity link (conversion)
    IF OLD.opportunity_id IS NULL AND NEW.opportunity_id IS NOT NULL THEN
      PERFORM log_crm_transition(
        'leads',
        NEW.lead_id,
        'LEAD_CONVERTED'::crm_audit_action,
        v_from_state,
        v_to_state,
        'opportunities',
        NEW.opportunity_id,
        'trigger'
      );
    END IF;

    -- General update if no specific transition detected
    IF OLD.triage_status IS NOT DISTINCT FROM NEW.triage_status
       AND (OLD.sales_owner_user_id IS NOT DISTINCT FROM NEW.sales_owner_user_id OR OLD.sales_owner_user_id IS NOT NULL)
       AND (OLD.opportunity_id IS NOT DISTINCT FROM NEW.opportunity_id OR OLD.opportunity_id IS NOT NULL)
       AND v_from_state IS DISTINCT FROM v_to_state
    THEN
      PERFORM log_crm_transition(
        'leads',
        NEW.lead_id,
        'LEAD_UPDATED'::crm_audit_action,
        v_from_state,
        v_to_state,
        NULL,
        NULL,
        'trigger'
      );
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_from_state := row_to_json(OLD)::jsonb;
    v_to_state := NULL;

    PERFORM log_crm_transition(
      'leads',
      OLD.lead_id,
      'DELETE'::crm_audit_action,
      v_from_state,
      v_to_state,
      NULL,
      NULL,
      'trigger'
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_leads_audit ON leads;
CREATE TRIGGER trg_leads_audit
AFTER INSERT OR UPDATE OR DELETE ON leads
FOR EACH ROW EXECUTE FUNCTION trg_audit_leads_transitions();

-- =========================
-- OPPORTUNITIES AUDIT TRIGGER
-- =========================

CREATE OR REPLACE FUNCTION trg_audit_opportunities_transitions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action crm_audit_action;
  v_from_state jsonb;
  v_to_state jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_from_state := NULL;
    v_to_state := row_to_json(NEW)::jsonb;

    PERFORM log_crm_transition(
      'opportunities',
      NEW.opportunity_id,
      'OPPORTUNITY_CREATED'::crm_audit_action,
      v_from_state,
      v_to_state,
      'accounts',
      NEW.account_id,
      'trigger'
    );

  ELSIF TG_OP = 'UPDATE' THEN
    v_from_state := row_to_json(OLD)::jsonb;
    v_to_state := row_to_json(NEW)::jsonb;

    -- Stage change detection
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
      v_action := CASE NEW.stage
        WHEN 'Closed Won' THEN 'OPPORTUNITY_WON'::crm_audit_action
        WHEN 'Closed Lost' THEN 'OPPORTUNITY_LOST'::crm_audit_action
        ELSE 'OPPORTUNITY_STAGE_CHANGED'::crm_audit_action
      END;

      PERFORM log_crm_transition(
        'opportunities',
        NEW.opportunity_id,
        v_action,
        v_from_state,
        v_to_state,
        'accounts',
        NEW.account_id,
        'trigger'
      );
    ELSE
      -- General update
      IF v_from_state IS DISTINCT FROM v_to_state THEN
        PERFORM log_crm_transition(
          'opportunities',
          NEW.opportunity_id,
          'OPPORTUNITY_UPDATED'::crm_audit_action,
          v_from_state,
          v_to_state,
          'accounts',
          NEW.account_id,
          'trigger'
        );
      END IF;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_from_state := row_to_json(OLD)::jsonb;

    PERFORM log_crm_transition(
      'opportunities',
      OLD.opportunity_id,
      'DELETE'::crm_audit_action,
      v_from_state,
      NULL,
      'accounts',
      OLD.account_id,
      'trigger'
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_opportunities_audit ON opportunities;
CREATE TRIGGER trg_opportunities_audit
AFTER INSERT OR UPDATE OR DELETE ON opportunities
FOR EACH ROW EXECUTE FUNCTION trg_audit_opportunities_transitions();

-- =========================
-- ACTIVITIES AUDIT TRIGGER
-- =========================

CREATE OR REPLACE FUNCTION trg_audit_activities_transitions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action crm_audit_action;
  v_from_state jsonb;
  v_to_state jsonb;
  v_related_entity text;
  v_related_entity_id text;
BEGIN
  -- Determine related entity
  IF NEW IS NOT NULL THEN
    v_related_entity := CASE
      WHEN NEW.related_opportunity_id IS NOT NULL THEN 'opportunities'
      WHEN NEW.related_account_id IS NOT NULL THEN 'accounts'
      WHEN NEW.related_lead_id IS NOT NULL THEN 'leads'
      WHEN NEW.related_target_id IS NOT NULL THEN 'prospecting_targets'
      ELSE NULL
    END;
    v_related_entity_id := COALESCE(
      NEW.related_opportunity_id,
      NEW.related_account_id,
      NEW.related_lead_id,
      NEW.related_target_id
    );
  ELSE
    v_related_entity := CASE
      WHEN OLD.related_opportunity_id IS NOT NULL THEN 'opportunities'
      WHEN OLD.related_account_id IS NOT NULL THEN 'accounts'
      WHEN OLD.related_lead_id IS NOT NULL THEN 'leads'
      WHEN OLD.related_target_id IS NOT NULL THEN 'prospecting_targets'
      ELSE NULL
    END;
    v_related_entity_id := COALESCE(
      OLD.related_opportunity_id,
      OLD.related_account_id,
      OLD.related_lead_id,
      OLD.related_target_id
    );
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_from_state := NULL;
    v_to_state := row_to_json(NEW)::jsonb;

    PERFORM log_crm_transition(
      'activities',
      NEW.activity_id,
      'ACTIVITY_CREATED'::crm_audit_action,
      v_from_state,
      v_to_state,
      v_related_entity,
      v_related_entity_id,
      'trigger'
    );

  ELSIF TG_OP = 'UPDATE' THEN
    v_from_state := row_to_json(OLD)::jsonb;
    v_to_state := row_to_json(NEW)::jsonb;

    -- Status change detection
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := CASE NEW.status
        WHEN 'Done' THEN 'ACTIVITY_COMPLETED'::crm_audit_action
        WHEN 'Cancelled' THEN 'ACTIVITY_CANCELLED'::crm_audit_action
        ELSE 'ACTIVITY_UPDATED'::crm_audit_action
      END;

      PERFORM log_crm_transition(
        'activities',
        NEW.activity_id,
        v_action,
        v_from_state,
        v_to_state,
        v_related_entity,
        v_related_entity_id,
        'trigger'
      );
    ELSE
      -- General update
      IF v_from_state IS DISTINCT FROM v_to_state THEN
        PERFORM log_crm_transition(
          'activities',
          NEW.activity_id,
          'ACTIVITY_UPDATED'::crm_audit_action,
          v_from_state,
          v_to_state,
          v_related_entity,
          v_related_entity_id,
          'trigger'
        );
      END IF;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_from_state := row_to_json(OLD)::jsonb;

    PERFORM log_crm_transition(
      'activities',
      OLD.activity_id,
      'DELETE'::crm_audit_action,
      v_from_state,
      NULL,
      v_related_entity,
      v_related_entity_id,
      'trigger'
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_activities_audit ON activities;
CREATE TRIGGER trg_activities_audit
AFTER INSERT OR UPDATE OR DELETE ON activities
FOR EACH ROW EXECUTE FUNCTION trg_audit_activities_transitions();

-- =========================
-- PROSPECTING TARGETS AUDIT TRIGGER
-- =========================

CREATE OR REPLACE FUNCTION trg_audit_targets_transitions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action crm_audit_action;
  v_from_state jsonb;
  v_to_state jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_from_state := NULL;
    v_to_state := row_to_json(NEW)::jsonb;

    PERFORM log_crm_transition(
      'prospecting_targets',
      NEW.target_id,
      'TARGET_CREATED'::crm_audit_action,
      v_from_state,
      v_to_state,
      NULL,
      NULL,
      'trigger'
    );

  ELSIF TG_OP = 'UPDATE' THEN
    v_from_state := row_to_json(OLD)::jsonb;
    v_to_state := row_to_json(NEW)::jsonb;

    -- Status change detection
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := CASE NEW.status
        WHEN 'Converted' THEN 'TARGET_CONVERTED'::crm_audit_action
        ELSE 'TARGET_STATUS_CHANGED'::crm_audit_action
      END;

      PERFORM log_crm_transition(
        'prospecting_targets',
        NEW.target_id,
        v_action,
        v_from_state,
        v_to_state,
        CASE WHEN NEW.converted_to_account_id IS NOT NULL THEN 'accounts' ELSE NULL END,
        NEW.converted_to_account_id,
        'trigger'
      );
    ELSE
      -- General update
      IF v_from_state IS DISTINCT FROM v_to_state THEN
        PERFORM log_crm_transition(
          'prospecting_targets',
          NEW.target_id,
          'TARGET_UPDATED'::crm_audit_action,
          v_from_state,
          v_to_state,
          NULL,
          NULL,
          'trigger'
        );
      END IF;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_from_state := row_to_json(OLD)::jsonb;

    PERFORM log_crm_transition(
      'prospecting_targets',
      OLD.target_id,
      'DELETE'::crm_audit_action,
      v_from_state,
      NULL,
      NULL,
      NULL,
      'trigger'
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_targets_audit ON prospecting_targets;
CREATE TRIGGER trg_targets_audit
AFTER INSERT OR UPDATE OR DELETE ON prospecting_targets
FOR EACH ROW EXECUTE FUNCTION trg_audit_targets_transitions();

-- =========================
-- ACCOUNTS AUDIT TRIGGER
-- =========================

CREATE OR REPLACE FUNCTION trg_audit_accounts_transitions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action crm_audit_action;
  v_from_state jsonb;
  v_to_state jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_from_state := NULL;
    v_to_state := row_to_json(NEW)::jsonb;

    PERFORM log_crm_transition(
      'accounts',
      NEW.account_id,
      'ACCOUNT_CREATED'::crm_audit_action,
      v_from_state,
      v_to_state,
      NULL,
      NULL,
      'trigger'
    );

  ELSIF TG_OP = 'UPDATE' THEN
    v_from_state := row_to_json(OLD)::jsonb;
    v_to_state := row_to_json(NEW)::jsonb;

    -- Check for merge (company_name contains MERGED)
    IF NEW.company_name LIKE '%[MERGED INTO%' THEN
      PERFORM log_crm_transition(
        'accounts',
        NEW.account_id,
        'ACCOUNT_MERGED'::crm_audit_action,
        v_from_state,
        v_to_state,
        NULL,
        NULL,
        'trigger'
      );
    ELSIF v_from_state IS DISTINCT FROM v_to_state THEN
      PERFORM log_crm_transition(
        'accounts',
        NEW.account_id,
        'ACCOUNT_UPDATED'::crm_audit_action,
        v_from_state,
        v_to_state,
        NULL,
        NULL,
        'trigger'
      );
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_from_state := row_to_json(OLD)::jsonb;

    PERFORM log_crm_transition(
      'accounts',
      OLD.account_id,
      'DELETE'::crm_audit_action,
      v_from_state,
      NULL,
      NULL,
      NULL,
      'trigger'
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_accounts_audit ON accounts;
CREATE TRIGGER trg_accounts_audit
AFTER INSERT OR UPDATE OR DELETE ON accounts
FOR EACH ROW EXECUTE FUNCTION trg_audit_accounts_transitions();

-- =========================
-- CONTACTS AUDIT TRIGGER
-- =========================

CREATE OR REPLACE FUNCTION trg_audit_contacts_transitions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_from_state jsonb;
  v_to_state jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_from_state := NULL;
    v_to_state := row_to_json(NEW)::jsonb;

    PERFORM log_crm_transition(
      'contacts',
      NEW.contact_id,
      'CONTACT_CREATED'::crm_audit_action,
      v_from_state,
      v_to_state,
      'accounts',
      NEW.account_id,
      'trigger'
    );

  ELSIF TG_OP = 'UPDATE' THEN
    v_from_state := row_to_json(OLD)::jsonb;
    v_to_state := row_to_json(NEW)::jsonb;

    IF v_from_state IS DISTINCT FROM v_to_state THEN
      PERFORM log_crm_transition(
        'contacts',
        NEW.contact_id,
        'CONTACT_UPDATED'::crm_audit_action,
        v_from_state,
        v_to_state,
        'accounts',
        NEW.account_id,
        'trigger'
      );
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_from_state := row_to_json(OLD)::jsonb;

    PERFORM log_crm_transition(
      'contacts',
      OLD.contact_id,
      'DELETE'::crm_audit_action,
      v_from_state,
      NULL,
      'accounts',
      OLD.account_id,
      'trigger'
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_contacts_audit ON contacts;
CREATE TRIGGER trg_contacts_audit
AFTER INSERT OR UPDATE OR DELETE ON contacts
FOR EACH ROW EXECUTE FUNCTION trg_audit_contacts_transitions();

-- =========================
-- LEAD HANDOVER POOL AUDIT TRIGGER
-- =========================

CREATE OR REPLACE FUNCTION trg_audit_handover_pool_transitions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_from_state jsonb;
  v_to_state jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_from_state := NULL;
    v_to_state := row_to_json(NEW)::jsonb;

    -- Log handover to pool
    PERFORM log_crm_transition(
      'lead_handover_pool',
      NEW.handover_id::text,
      'LEAD_HANDED_OVER'::crm_audit_action,
      v_from_state,
      v_to_state,
      'leads',
      NEW.lead_id,
      'trigger'
    );

  ELSIF TG_OP = 'UPDATE' THEN
    v_from_state := row_to_json(OLD)::jsonb;
    v_to_state := row_to_json(NEW)::jsonb;

    -- Detect claim
    IF OLD.claimed_by IS NULL AND NEW.claimed_by IS NOT NULL THEN
      PERFORM log_crm_transition(
        'lead_handover_pool',
        NEW.handover_id::text,
        'LEAD_CLAIMED'::crm_audit_action,
        v_from_state,
        v_to_state,
        'leads',
        NEW.lead_id,
        'trigger'
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_handover_pool_audit ON lead_handover_pool;
CREATE TRIGGER trg_handover_pool_audit
AFTER INSERT OR UPDATE ON lead_handover_pool
FOR EACH ROW EXECUTE FUNCTION trg_audit_handover_pool_transitions();

-- =========================
-- UPDATE RPC FUNCTIONS TO USE AUDIT LOGGING
-- =========================

-- Update rpc_lead_handover_to_sales_pool with audit logging
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
  v_correlation_id uuid;
  v_result jsonb;
BEGIN
  -- Generate correlation ID for this operation
  v_correlation_id := gen_random_uuid();

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
    'correlation_id', v_correlation_id,
    'message', 'Lead added to sales handover pool'
  );

  PERFORM store_idempotency(p_idempotency_key, 'lead_handover_to_sales_pool', v_result);

  RETURN v_result;
END $$;

-- Update rpc_sales_claim_lead with audit logging
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
  v_correlation_id uuid;
  v_result jsonb;
BEGIN
  -- Generate correlation ID for this operation
  v_correlation_id := gen_random_uuid();
  SET LOCAL app.rpc_context = 'rpc_allowed';

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
    'activity_id', v_activity_id,
    'correlation_id', v_correlation_id
  );

  PERFORM store_idempotency(p_idempotency_key, 'sales_claim_lead', v_result);

  RETURN v_result;
END $$;

-- Update rpc_target_convert_to_lead with audit logging
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
  v_correlation_id uuid;
  v_result jsonb;
BEGIN
  -- Generate correlation ID
  v_correlation_id := gen_random_uuid();
  SET LOCAL app.rpc_context = 'rpc_allowed';

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

  v_result := jsonb_build_object(
    'success', true,
    'account_id', v_account_id,
    'contact_id', v_contact_id,
    'opportunity_id', v_opportunity_id,
    'correlation_id', v_correlation_id
  );

  PERFORM store_idempotency(p_idempotency_key, 'target_convert_to_lead', v_result);

  RETURN v_result;
END $$;

-- =========================
-- REMOVE OLD AUDIT TRIGGERS (from 05_fix_atomic_rpc.sql)
-- These are replaced by the new transition-aware triggers
-- =========================

DROP TRIGGER IF EXISTS trg_audit_leads ON leads;
DROP TRIGGER IF EXISTS trg_audit_tickets ON tickets;
DROP TRIGGER IF EXISTS trg_audit_prospects ON prospects;
DROP TRIGGER IF EXISTS trg_audit_invoices ON invoices;
DROP TRIGGER IF EXISTS trg_audit_kpi_targets ON kpi_targets;

-- Re-create invoices audit trigger with new format
CREATE OR REPLACE FUNCTION trg_audit_invoices_simple()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (table_name, record_id, action, changed_by, after_data, entity, entity_id, action_type)
    VALUES ('invoices', NEW.invoice_id, 'INSERT', COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
            row_to_json(NEW)::jsonb, 'invoices', NEW.invoice_id, 'INSERT'::crm_audit_action);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (table_name, record_id, action, changed_by, before_data, after_data, entity, entity_id, action_type)
    VALUES ('invoices', NEW.invoice_id, 'UPDATE', COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
            row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, 'invoices', NEW.invoice_id, 'UPDATE'::crm_audit_action);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (table_name, record_id, action, changed_by, before_data, entity, entity_id, action_type)
    VALUES ('invoices', OLD.invoice_id, 'DELETE', COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
            row_to_json(OLD)::jsonb, 'invoices', OLD.invoice_id, 'DELETE'::crm_audit_action);
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_invoices_audit
AFTER INSERT OR UPDATE OR DELETE ON invoices
FOR EACH ROW EXECUTE FUNCTION trg_audit_invoices_simple();

-- Re-create kpi_targets audit trigger
CREATE OR REPLACE FUNCTION trg_audit_kpi_targets_simple()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (table_name, record_id, action, changed_by, after_data, entity, entity_id, action_type)
    VALUES ('kpi_targets', NEW.id::text, 'INSERT', COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
            row_to_json(NEW)::jsonb, 'kpi_targets', NEW.id::text, 'INSERT'::crm_audit_action);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (table_name, record_id, action, changed_by, before_data, after_data, entity, entity_id, action_type)
    VALUES ('kpi_targets', NEW.id::text, 'UPDATE', COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
            row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, 'kpi_targets', NEW.id::text, 'UPDATE'::crm_audit_action);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (table_name, record_id, action, changed_by, before_data, entity, entity_id, action_type)
    VALUES ('kpi_targets', OLD.id::text, 'DELETE', COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
            row_to_json(OLD)::jsonb, 'kpi_targets', OLD.id::text, 'DELETE'::crm_audit_action);
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_kpi_targets_audit
AFTER INSERT OR UPDATE OR DELETE ON kpi_targets
FOR EACH ROW EXECUTE FUNCTION trg_audit_kpi_targets_simple();

-- =========================
-- END OF MIGRATION
-- =========================

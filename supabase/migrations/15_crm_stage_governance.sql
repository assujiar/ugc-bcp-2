-- Migration: 15_crm_stage_governance.sql
-- Purpose: Implement proper stage exit criteria for opportunity transitions
-- Rules:
--   1. Open stages require: owner_user_id, next_step, next_step_due_date
--   2. Quote Sent requires: quote record attached
--   3. Closed Won requires: outcome (win reason)
--   4. Closed Lost requires: lost_reason
-- All transitions generate audit log events

-- =========================
-- ENHANCED STAGE TRANSITION RPC
-- =========================

CREATE OR REPLACE FUNCTION rpc_opportunity_change_stage(
  p_idempotency_key text,
  p_opportunity_id text,
  p_new_stage opportunity_stage,
  p_next_step text,
  p_next_step_due_date date,
  p_lost_reason text DEFAULT NULL,
  p_outcome text DEFAULT NULL,
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
  v_missing_fields text[] := '{}';
  v_closed_stages text[] := ARRAY['Closed Won', 'Closed Lost', 'On Hold'];
  v_quote_exists boolean;
BEGIN
  -- Set RPC context to allow stage change
  SET LOCAL app.rpc_context = 'rpc_allowed';

  -- Check idempotency
  v_cached := check_idempotency(p_idempotency_key);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  -- Get opportunity with owner info
  SELECT o.*,
         p.full_name as owner_name
  INTO v_opp
  FROM opportunities o
  LEFT JOIN profiles p ON p.user_id = o.owner_user_id
  WHERE o.opportunity_id = p_opportunity_id;

  IF v_opp IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Opportunity not found',
      'error_code', 'NOT_FOUND'
    );
  END IF;

  -- ========================================
  -- EXIT CRITERIA VALIDATION
  -- ========================================

  -- Rule 1: Open stages require owner_user_id, next_step, next_step_due_date
  IF NOT (p_new_stage::text = ANY(v_closed_stages)) THEN
    -- Check owner_user_id
    IF v_opp.owner_user_id IS NULL THEN
      v_missing_fields := array_append(v_missing_fields, 'owner_user_id');
    END IF;

    -- Check next_step (passed as parameter)
    IF p_next_step IS NULL OR p_next_step = '' THEN
      v_missing_fields := array_append(v_missing_fields, 'next_step');
    END IF;

    -- Check next_step_due_date (passed as parameter)
    IF p_next_step_due_date IS NULL THEN
      v_missing_fields := array_append(v_missing_fields, 'next_step_due_date');
    END IF;
  END IF;

  -- Rule 2: Quote Sent requires a quote record
  IF p_new_stage = 'Quote Sent' THEN
    SELECT EXISTS (
      SELECT 1 FROM quotes
      WHERE opportunity_id = p_opportunity_id
      AND status IN ('Draft', 'Sent')
    ) INTO v_quote_exists;

    IF NOT v_quote_exists THEN
      v_missing_fields := array_append(v_missing_fields, 'quote_record');
    END IF;
  END IF;

  -- Rule 3: Closed Won requires outcome (win reason)
  IF p_new_stage = 'Closed Won' THEN
    IF p_outcome IS NULL OR p_outcome = '' THEN
      v_missing_fields := array_append(v_missing_fields, 'outcome');
    END IF;
  END IF;

  -- Rule 4: Closed Lost requires lost_reason
  IF p_new_stage = 'Closed Lost' THEN
    IF p_lost_reason IS NULL OR p_lost_reason = '' THEN
      v_missing_fields := array_append(v_missing_fields, 'lost_reason');
    END IF;
  END IF;

  -- Return validation error if any fields are missing
  IF array_length(v_missing_fields, 1) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Stage transition blocked: missing required fields',
      'error_code', 'EXIT_CRITERIA_NOT_MET',
      'missing_fields', to_jsonb(v_missing_fields),
      'target_stage', p_new_stage::text
    );
  END IF;

  -- ========================================
  -- PERFORM STAGE TRANSITION
  -- ========================================

  -- Update opportunity
  UPDATE opportunities
  SET stage = p_new_stage,
      next_step = p_next_step,
      next_step_due_date = p_next_step_due_date,
      lost_reason = CASE
        WHEN p_new_stage = 'Closed Lost' THEN p_lost_reason
        ELSE lost_reason
      END,
      notes = COALESCE(p_notes, notes),
      updated_at = now(),
      closed_at = CASE
        WHEN p_new_stage IN ('Closed Won', 'Closed Lost') THEN now()
        ELSE NULL
      END
  WHERE opportunity_id = p_opportunity_id;

  -- Store outcome for Closed Won (using notes or a dedicated field if it exists)
  IF p_new_stage = 'Closed Won' AND p_outcome IS NOT NULL THEN
    UPDATE opportunities
    SET notes = COALESCE(notes || E'\n\nWin Reason: ' || p_outcome, 'Win Reason: ' || p_outcome)
    WHERE opportunity_id = p_opportunity_id;
  END IF;

  -- Log the transition to crm_transition_logs
  INSERT INTO crm_transition_logs (
    entity,
    entity_id,
    action,
    action_label,
    from_state,
    to_state,
    changed_fields,
    actor_user_id,
    source_rpc,
    metadata
  ) VALUES (
    'opportunity',
    p_opportunity_id,
    CASE
      WHEN p_new_stage = 'Closed Won' THEN 'OPPORTUNITY_WON'::crm_audit_action
      WHEN p_new_stage = 'Closed Lost' THEN 'OPPORTUNITY_LOST'::crm_audit_action
      ELSE 'OPPORTUNITY_STAGE_CHANGED'::crm_audit_action
    END,
    'Stage changed from ' || v_opp.stage::text || ' to ' || p_new_stage::text,
    v_opp.stage::text,
    p_new_stage::text,
    ARRAY['stage', 'next_step', 'next_step_due_date'],
    auth.uid(),
    'rpc_opportunity_change_stage',
    jsonb_build_object(
      'old_stage', v_opp.stage::text,
      'new_stage', p_new_stage::text,
      'next_step', p_next_step,
      'next_step_due_date', p_next_step_due_date,
      'lost_reason', p_lost_reason,
      'outcome', p_outcome
    )
  );

  v_result := jsonb_build_object(
    'success', true,
    'opportunity_id', p_opportunity_id,
    'old_stage', v_opp.stage::text,
    'new_stage', p_new_stage::text
  );

  PERFORM store_idempotency(p_idempotency_key, 'opportunity_change_stage', v_result);

  RETURN v_result;
END $$;

-- Add outcome column to opportunities table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'opportunities' AND column_name = 'outcome'
  ) THEN
    ALTER TABLE opportunities ADD COLUMN outcome text;
    COMMENT ON COLUMN opportunities.outcome IS 'Win reason for Closed Won or general outcome notes';
  END IF;
END $$;

-- Update the stage change to use outcome column properly
CREATE OR REPLACE FUNCTION rpc_opportunity_change_stage(
  p_idempotency_key text,
  p_opportunity_id text,
  p_new_stage opportunity_stage,
  p_next_step text,
  p_next_step_due_date date,
  p_lost_reason text DEFAULT NULL,
  p_outcome text DEFAULT NULL,
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
  v_missing_fields text[] := '{}';
  v_closed_stages text[] := ARRAY['Closed Won', 'Closed Lost', 'On Hold'];
  v_quote_exists boolean;
BEGIN
  -- Set RPC context to allow stage change
  SET LOCAL app.rpc_context = 'rpc_allowed';

  -- Check idempotency
  v_cached := check_idempotency(p_idempotency_key);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  -- Get opportunity with owner info
  SELECT o.*,
         p.full_name as owner_name
  INTO v_opp
  FROM opportunities o
  LEFT JOIN profiles p ON p.user_id = o.owner_user_id
  WHERE o.opportunity_id = p_opportunity_id;

  IF v_opp IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Opportunity not found',
      'error_code', 'NOT_FOUND'
    );
  END IF;

  -- ========================================
  -- EXIT CRITERIA VALIDATION
  -- ========================================

  -- Rule 1: Open stages require owner_user_id, next_step, next_step_due_date
  IF NOT (p_new_stage::text = ANY(v_closed_stages)) THEN
    -- Check owner_user_id
    IF v_opp.owner_user_id IS NULL THEN
      v_missing_fields := array_append(v_missing_fields, 'owner_user_id');
    END IF;

    -- Check next_step (passed as parameter)
    IF p_next_step IS NULL OR p_next_step = '' THEN
      v_missing_fields := array_append(v_missing_fields, 'next_step');
    END IF;

    -- Check next_step_due_date (passed as parameter)
    IF p_next_step_due_date IS NULL THEN
      v_missing_fields := array_append(v_missing_fields, 'next_step_due_date');
    END IF;
  END IF;

  -- Rule 2: Quote Sent requires a quote record
  IF p_new_stage = 'Quote Sent' THEN
    SELECT EXISTS (
      SELECT 1 FROM quotes
      WHERE opportunity_id = p_opportunity_id
      AND status IN ('Draft', 'Sent')
    ) INTO v_quote_exists;

    IF NOT v_quote_exists THEN
      v_missing_fields := array_append(v_missing_fields, 'quote_record');
    END IF;
  END IF;

  -- Rule 3: Closed Won requires outcome (win reason)
  IF p_new_stage = 'Closed Won' THEN
    IF p_outcome IS NULL OR p_outcome = '' THEN
      v_missing_fields := array_append(v_missing_fields, 'outcome');
    END IF;
  END IF;

  -- Rule 4: Closed Lost requires lost_reason
  IF p_new_stage = 'Closed Lost' THEN
    IF p_lost_reason IS NULL OR p_lost_reason = '' THEN
      v_missing_fields := array_append(v_missing_fields, 'lost_reason');
    END IF;
  END IF;

  -- Return validation error if any fields are missing
  IF array_length(v_missing_fields, 1) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Stage transition blocked: missing required fields',
      'error_code', 'EXIT_CRITERIA_NOT_MET',
      'missing_fields', to_jsonb(v_missing_fields),
      'target_stage', p_new_stage::text
    );
  END IF;

  -- ========================================
  -- PERFORM STAGE TRANSITION
  -- ========================================

  -- Update opportunity
  UPDATE opportunities
  SET stage = p_new_stage,
      next_step = p_next_step,
      next_step_due_date = p_next_step_due_date,
      lost_reason = CASE
        WHEN p_new_stage = 'Closed Lost' THEN p_lost_reason
        ELSE lost_reason
      END,
      outcome = CASE
        WHEN p_new_stage = 'Closed Won' THEN p_outcome
        ELSE outcome
      END,
      notes = COALESCE(p_notes, notes),
      updated_at = now(),
      closed_at = CASE
        WHEN p_new_stage IN ('Closed Won', 'Closed Lost') THEN now()
        ELSE NULL
      END
  WHERE opportunity_id = p_opportunity_id;

  -- Log the transition to crm_transition_logs
  INSERT INTO crm_transition_logs (
    entity,
    entity_id,
    action,
    action_label,
    from_state,
    to_state,
    changed_fields,
    actor_user_id,
    source_rpc,
    metadata
  ) VALUES (
    'opportunity',
    p_opportunity_id,
    CASE
      WHEN p_new_stage = 'Closed Won' THEN 'OPPORTUNITY_WON'::crm_audit_action
      WHEN p_new_stage = 'Closed Lost' THEN 'OPPORTUNITY_LOST'::crm_audit_action
      ELSE 'OPPORTUNITY_STAGE_CHANGED'::crm_audit_action
    END,
    'Stage changed from ' || v_opp.stage::text || ' to ' || p_new_stage::text,
    v_opp.stage::text,
    p_new_stage::text,
    ARRAY['stage', 'next_step', 'next_step_due_date'],
    auth.uid(),
    'rpc_opportunity_change_stage',
    jsonb_build_object(
      'old_stage', v_opp.stage::text,
      'new_stage', p_new_stage::text,
      'next_step', p_next_step,
      'next_step_due_date', p_next_step_due_date,
      'lost_reason', p_lost_reason,
      'outcome', p_outcome
    )
  );

  v_result := jsonb_build_object(
    'success', true,
    'opportunity_id', p_opportunity_id,
    'old_stage', v_opp.stage::text,
    'new_stage', p_new_stage::text
  );

  PERFORM store_idempotency(p_idempotency_key, 'opportunity_change_stage', v_result);

  RETURN v_result;
END $$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION rpc_opportunity_change_stage(text, text, opportunity_stage, text, date, text, text, text) TO authenticated;

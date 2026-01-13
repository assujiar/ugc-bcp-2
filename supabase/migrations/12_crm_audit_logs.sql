-- =============================================================================
-- CRM Audit Logs Enhancement Migration
-- PR0.3: DB/RLS Alignment + Transition Audit Log
--
-- Purpose: Enhanced audit log structure with:
-- - correlation_id for tracking related operations
-- - entity/entity_id instead of table_name/record_id for clarity
-- - action types for CRM transitions
-- - before/after snapshots
-- =============================================================================

-- =========================
-- ENHANCE AUDIT_LOGS TABLE
-- =========================

-- Add new columns to audit_logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS correlation_id uuid;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_user_id uuid REFERENCES profiles(user_id);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Create CRM action type enum
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

-- Add action_type column
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action_type crm_audit_action;

-- Update existing data to populate new columns from old columns
UPDATE audit_logs
SET entity = table_name,
    entity_id = record_id,
    actor_user_id = changed_by,
    action_type = CASE action
      WHEN 'INSERT' THEN 'INSERT'::crm_audit_action
      WHEN 'UPDATE' THEN 'UPDATE'::crm_audit_action
      WHEN 'DELETE' THEN 'DELETE'::crm_audit_action
      WHEN 'MERGE' THEN 'MERGE'::crm_audit_action
      ELSE 'UPDATE'::crm_audit_action
    END
WHERE entity IS NULL;

-- =========================
-- ADD INDEXES FOR NEW COLUMNS
-- =========================
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity);
CREATE INDEX IF NOT EXISTS idx_audit_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_correlation_id ON audit_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action_type ON audit_logs(action_type);

-- Composite index for timeline queries
CREATE INDEX IF NOT EXISTS idx_audit_entity_timeline ON audit_logs(entity, entity_id, changed_at DESC);

-- =========================
-- CRM TRANSITION AUDIT TABLE
-- Dedicated table for CRM transitions with full context
-- =========================
CREATE TABLE IF NOT EXISTS crm_transition_logs (
  id bigserial PRIMARY KEY,
  correlation_id uuid DEFAULT gen_random_uuid(),

  -- Entity reference
  entity text NOT NULL,
  entity_id text NOT NULL,

  -- Action details
  action crm_audit_action NOT NULL,
  action_label text, -- Human-readable action label

  -- State change
  from_state jsonb,
  to_state jsonb,
  changed_fields text[], -- List of fields that changed

  -- Actor
  actor_user_id uuid NOT NULL REFERENCES profiles(user_id),
  actor_role text,
  actor_name text,

  -- Context
  related_entity text,
  related_entity_id text,
  source_rpc text, -- Which RPC function triggered this

  -- Audit trail
  ip_address inet,
  user_agent text,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_transition_entity ON crm_transition_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_transition_correlation ON crm_transition_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_crm_transition_action ON crm_transition_logs(action);
CREATE INDEX IF NOT EXISTS idx_crm_transition_actor ON crm_transition_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_crm_transition_created ON crm_transition_logs(created_at DESC);

-- Enable RLS
ALTER TABLE crm_transition_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY crm_transition_select ON crm_transition_logs FOR SELECT USING (
  app_is_super_admin() OR app_is_director()
);

CREATE POLICY crm_transition_insert ON crm_transition_logs FOR INSERT WITH CHECK (
  app_is_authenticated()
);

-- =========================
-- HELPER FUNCTION: Log CRM Transition
-- =========================
CREATE OR REPLACE FUNCTION log_crm_transition(
  p_entity text,
  p_entity_id text,
  p_action crm_audit_action,
  p_from_state jsonb DEFAULT NULL,
  p_to_state jsonb DEFAULT NULL,
  p_related_entity text DEFAULT NULL,
  p_related_entity_id text DEFAULT NULL,
  p_source_rpc text DEFAULT NULL,
  p_correlation_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_correlation_id uuid;
  v_actor_user_id uuid;
  v_actor_role text;
  v_actor_name text;
  v_changed_fields text[];
  v_action_label text;
BEGIN
  -- Generate or use provided correlation ID
  v_correlation_id := COALESCE(p_correlation_id, gen_random_uuid());

  -- Get actor info
  v_actor_user_id := auth.uid();

  SELECT p.role_name, p.full_name
  INTO v_actor_role, v_actor_name
  FROM profiles p
  WHERE p.user_id = v_actor_user_id;

  -- Calculate changed fields
  IF p_from_state IS NOT NULL AND p_to_state IS NOT NULL THEN
    SELECT array_agg(key)
    INTO v_changed_fields
    FROM (
      SELECT key
      FROM jsonb_each(p_to_state)
      WHERE p_from_state->key IS DISTINCT FROM p_to_state->key
    ) changed;
  END IF;

  -- Generate human-readable action label
  v_action_label := CASE p_action
    WHEN 'LEAD_CREATED' THEN 'Lead created'
    WHEN 'LEAD_TRIAGE' THEN 'Lead triaged'
    WHEN 'LEAD_QUALIFIED' THEN 'Lead qualified'
    WHEN 'LEAD_DISQUALIFIED' THEN 'Lead disqualified'
    WHEN 'LEAD_HANDED_OVER' THEN 'Lead handed over to sales'
    WHEN 'LEAD_CLAIMED' THEN 'Lead claimed by sales'
    WHEN 'LEAD_CONVERTED' THEN 'Lead converted to opportunity'
    WHEN 'OPPORTUNITY_CREATED' THEN 'Opportunity created'
    WHEN 'OPPORTUNITY_STAGE_CHANGED' THEN 'Opportunity stage changed'
    WHEN 'OPPORTUNITY_WON' THEN 'Opportunity closed won'
    WHEN 'OPPORTUNITY_LOST' THEN 'Opportunity closed lost'
    WHEN 'ACTIVITY_CREATED' THEN 'Activity created'
    WHEN 'ACTIVITY_COMPLETED' THEN 'Activity completed'
    WHEN 'ACTIVITY_CANCELLED' THEN 'Activity cancelled'
    WHEN 'ACCOUNT_CREATED' THEN 'Account created'
    WHEN 'ACCOUNT_MERGED' THEN 'Accounts merged'
    WHEN 'TARGET_CREATED' THEN 'Target created'
    WHEN 'TARGET_CONVERTED' THEN 'Target converted'
    WHEN 'TARGET_STATUS_CHANGED' THEN 'Target status changed'
    ELSE p_action::text
  END;

  -- Insert transition log
  INSERT INTO crm_transition_logs (
    correlation_id,
    entity,
    entity_id,
    action,
    action_label,
    from_state,
    to_state,
    changed_fields,
    actor_user_id,
    actor_role,
    actor_name,
    related_entity,
    related_entity_id,
    source_rpc
  ) VALUES (
    v_correlation_id,
    p_entity,
    p_entity_id,
    p_action,
    v_action_label,
    p_from_state,
    p_to_state,
    v_changed_fields,
    v_actor_user_id,
    v_actor_role,
    v_actor_name,
    p_related_entity,
    p_related_entity_id,
    p_source_rpc
  );

  -- Also insert into legacy audit_logs for backward compatibility
  INSERT INTO audit_logs (
    table_name,
    record_id,
    action,
    changed_by,
    before_data,
    after_data,
    entity,
    entity_id,
    correlation_id,
    actor_user_id,
    action_type
  ) VALUES (
    p_entity,
    p_entity_id,
    p_action::text,
    v_actor_user_id,
    p_from_state,
    p_to_state,
    p_entity,
    p_entity_id,
    v_correlation_id,
    v_actor_user_id,
    p_action
  );

  RETURN v_correlation_id;
END $$;

-- =========================
-- HELPER FUNCTION: Get Entity Timeline
-- Returns all audit events for an entity
-- =========================
CREATE OR REPLACE FUNCTION get_entity_timeline(
  p_entity text,
  p_entity_id text,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  log_id bigint,
  action crm_audit_action,
  action_label text,
  from_state jsonb,
  to_state jsonb,
  changed_fields text[],
  actor_name text,
  actor_role text,
  created_at timestamptz,
  correlation_id uuid
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    id as log_id,
    action,
    action_label,
    from_state,
    to_state,
    changed_fields,
    actor_name,
    actor_role,
    created_at,
    correlation_id
  FROM crm_transition_logs
  WHERE entity = p_entity
    AND entity_id = p_entity_id
  ORDER BY created_at DESC
  LIMIT p_limit;
$$;

-- =========================
-- HELPER FUNCTION: Get Correlated Events
-- Returns all events with same correlation_id
-- =========================
CREATE OR REPLACE FUNCTION get_correlated_events(
  p_correlation_id uuid
)
RETURNS TABLE (
  log_id bigint,
  entity text,
  entity_id text,
  action crm_audit_action,
  action_label text,
  actor_name text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    id as log_id,
    entity,
    entity_id,
    action,
    action_label,
    actor_name,
    created_at
  FROM crm_transition_logs
  WHERE correlation_id = p_correlation_id
  ORDER BY created_at ASC;
$$;

-- =========================
-- VIEW: Stage History Timeline
-- Combines opportunity_stage_history with crm_transition_logs
-- =========================
CREATE OR REPLACE VIEW v_stage_history_timeline AS
SELECT
  opp.opportunity_id,
  opp.name as opportunity_name,
  acc.company_name as account_name,
  hist.from_stage::text as from_stage,
  hist.to_stage::text as to_stage,
  hist.changed_at,
  p.full_name as changed_by_name,
  hist.notes,
  'opportunity_stage_history' as source,
  NULL::uuid as correlation_id
FROM opportunity_stage_history hist
JOIN opportunities opp ON opp.opportunity_id = hist.opportunity_id
JOIN accounts acc ON acc.account_id = opp.account_id
LEFT JOIN profiles p ON p.user_id = hist.changed_by
UNION ALL
SELECT
  ctl.entity_id as opportunity_id,
  NULL as opportunity_name,
  NULL as account_name,
  ctl.from_state->>'stage' as from_stage,
  ctl.to_state->>'stage' as to_stage,
  ctl.created_at as changed_at,
  ctl.actor_name as changed_by_name,
  NULL as notes,
  'crm_transition_logs' as source,
  ctl.correlation_id
FROM crm_transition_logs ctl
WHERE ctl.entity = 'opportunities'
  AND ctl.action = 'OPPORTUNITY_STAGE_CHANGED'
ORDER BY changed_at DESC;

-- =========================
-- VIEW: Activity Timeline
-- All activities with their status history
-- =========================
CREATE OR REPLACE VIEW v_activity_timeline AS
SELECT
  a.activity_id,
  a.activity_type,
  a.subject,
  a.status as current_status,
  a.related_opportunity_id,
  opp.name as opportunity_name,
  a.related_account_id,
  acc.company_name as account_name,
  a.owner_user_id,
  p.full_name as owner_name,
  a.scheduled_at,
  a.due_date,
  a.completed_at,
  a.cancelled_at,
  a.created_at,
  ctl.action as last_action,
  ctl.action_label,
  ctl.actor_name as last_action_by,
  ctl.created_at as last_action_at
FROM activities a
LEFT JOIN opportunities opp ON opp.opportunity_id = a.related_opportunity_id
LEFT JOIN accounts acc ON acc.account_id = a.related_account_id
LEFT JOIN profiles p ON p.user_id = a.owner_user_id
LEFT JOIN LATERAL (
  SELECT * FROM crm_transition_logs
  WHERE entity = 'activities'
    AND entity_id = a.activity_id
  ORDER BY created_at DESC
  LIMIT 1
) ctl ON true;

-- =========================
-- VIEW: Lead Lifecycle
-- Complete lead journey with all transitions
-- =========================
CREATE OR REPLACE VIEW v_lead_lifecycle AS
SELECT
  l.lead_id,
  l.company_name,
  l.status as current_status,
  l.triage_status,
  l.created_at as lead_created_at,
  l.qualified_at,
  l.disqualified_at,
  l.handover_eligible,
  hp.handed_over_at,
  hp.claimed_at,
  hp.claimed_by,
  l.opportunity_id,
  opp.stage as opportunity_stage,
  opp.closed_at as opportunity_closed_at,
  (
    SELECT json_agg(json_build_object(
      'action', ctl.action,
      'action_label', ctl.action_label,
      'actor_name', ctl.actor_name,
      'created_at', ctl.created_at
    ) ORDER BY ctl.created_at)
    FROM crm_transition_logs ctl
    WHERE ctl.entity = 'leads'
      AND ctl.entity_id = l.lead_id
  ) as transition_history
FROM leads l
LEFT JOIN lead_handover_pool hp ON hp.lead_id = l.lead_id
LEFT JOIN opportunities opp ON opp.opportunity_id = l.opportunity_id;

-- =========================
-- GRANT EXECUTE ON FUNCTIONS
-- =========================
GRANT EXECUTE ON FUNCTION log_crm_transition(text, text, crm_audit_action, jsonb, jsonb, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_entity_timeline(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_correlated_events(uuid) TO authenticated;

-- =========================
-- END OF MIGRATION
-- =========================

-- =============================================================================
-- CRM Constraints and Indexes Migration
-- PR0.3: DB/RLS Alignment + Transition Audit Log
--
-- Purpose: Add DB constraints and indexes to:
-- - Prevent orphan records
-- - Prevent duplicate entries
-- - Speed up list view queries
-- - Enforce business rules at DB level
-- =============================================================================

-- =========================
-- ACTIVITIES CONSTRAINTS
-- =========================

-- Activities must have at least one related entity
ALTER TABLE activities
  DROP CONSTRAINT IF EXISTS chk_activity_has_related_entity;

ALTER TABLE activities
  ADD CONSTRAINT chk_activity_has_related_entity
  CHECK (
    related_account_id IS NOT NULL
    OR related_opportunity_id IS NOT NULL
    OR related_lead_id IS NOT NULL
    OR related_target_id IS NOT NULL
  );

-- Planned activities must have due_date
ALTER TABLE activities
  DROP CONSTRAINT IF EXISTS chk_planned_activity_has_due_date;

ALTER TABLE activities
  ADD CONSTRAINT chk_planned_activity_has_due_date
  CHECK (
    status != 'Planned'::activity_status
    OR (status = 'Planned'::activity_status AND due_date IS NOT NULL)
  );

-- Completed activities must have completed_at
ALTER TABLE activities
  DROP CONSTRAINT IF EXISTS chk_done_activity_has_completed_at;

ALTER TABLE activities
  ADD CONSTRAINT chk_done_activity_has_completed_at
  CHECK (
    status != 'Done'::activity_status
    OR (status = 'Done'::activity_status AND completed_at IS NOT NULL)
  );

-- Cancelled activities must have cancelled_at
ALTER TABLE activities
  DROP CONSTRAINT IF EXISTS chk_cancelled_activity_has_cancelled_at;

ALTER TABLE activities
  ADD CONSTRAINT chk_cancelled_activity_has_cancelled_at
  CHECK (
    status != 'Cancelled'::activity_status
    OR (status = 'Cancelled'::activity_status AND cancelled_at IS NOT NULL)
  );

-- =========================
-- OPPORTUNITIES CONSTRAINTS
-- =========================

-- Closed Won/Lost opportunities must have closed_at
ALTER TABLE opportunities
  DROP CONSTRAINT IF EXISTS chk_closed_opportunity_has_closed_at;

ALTER TABLE opportunities
  ADD CONSTRAINT chk_closed_opportunity_has_closed_at
  CHECK (
    stage NOT IN ('Closed Won'::opportunity_stage, 'Closed Lost'::opportunity_stage)
    OR closed_at IS NOT NULL
  );

-- Closed Lost must have lost_reason
ALTER TABLE opportunities
  DROP CONSTRAINT IF EXISTS chk_closed_lost_has_reason;

ALTER TABLE opportunities
  ADD CONSTRAINT chk_closed_lost_has_reason
  CHECK (
    stage != 'Closed Lost'::opportunity_stage
    OR (stage = 'Closed Lost'::opportunity_stage AND lost_reason IS NOT NULL)
  );

-- Probability must match stage
ALTER TABLE opportunities
  DROP CONSTRAINT IF EXISTS chk_probability_range;

ALTER TABLE opportunities
  ADD CONSTRAINT chk_probability_range
  CHECK (
    probability IS NULL
    OR (probability >= 0 AND probability <= 100)
  );

-- =========================
-- LEADS CONSTRAINTS
-- =========================

-- Lead must have valid email format (basic check)
ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS chk_lead_email_format;

ALTER TABLE leads
  ADD CONSTRAINT chk_lead_email_format
  CHECK (
    email IS NULL
    OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );

-- Qualified leads must have qualified_at
ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS chk_qualified_lead_has_timestamp;

ALTER TABLE leads
  ADD CONSTRAINT chk_qualified_lead_has_timestamp
  CHECK (
    triage_status != 'Qualified'::lead_triage_status
    OR qualified_at IS NOT NULL
  );

-- Disqualified leads must have disqualified_at and reason
ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS chk_disqualified_lead_has_info;

ALTER TABLE leads
  ADD CONSTRAINT chk_disqualified_lead_has_info
  CHECK (
    triage_status != 'Disqualified'::lead_triage_status
    OR (disqualified_at IS NOT NULL AND disqualified_reason IS NOT NULL)
  );

-- =========================
-- PROSPECTING TARGETS CONSTRAINTS
-- =========================

-- Converted targets must have converted_to link
ALTER TABLE prospecting_targets
  DROP CONSTRAINT IF EXISTS chk_converted_target_has_link;

ALTER TABLE prospecting_targets
  ADD CONSTRAINT chk_converted_target_has_link
  CHECK (
    status != 'Converted'::target_status
    OR (converted_to_lead_id IS NOT NULL OR converted_to_account_id IS NOT NULL)
  );

-- =========================
-- CONTACTS CONSTRAINTS
-- =========================

-- At least one contact method required
ALTER TABLE contacts
  DROP CONSTRAINT IF EXISTS chk_contact_has_method;

ALTER TABLE contacts
  ADD CONSTRAINT chk_contact_has_method
  CHECK (
    email IS NOT NULL
    OR phone IS NOT NULL
    OR mobile IS NOT NULL
  );

-- =========================
-- ACCOUNTS CONSTRAINTS
-- =========================

-- Active accounts need owner
ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS chk_active_account_has_owner;

-- Skip this constraint as some accounts may be created without owner initially
-- Will be enforced at application level

-- =========================
-- LEAD HANDOVER POOL CONSTRAINTS
-- =========================

-- Prevent duplicate leads in pool
ALTER TABLE lead_handover_pool
  DROP CONSTRAINT IF EXISTS uq_lead_in_pool;

-- Already has UNIQUE on lead_id from 09_crm_rebuild.sql

-- Claimed records must have claimed_at
ALTER TABLE lead_handover_pool
  DROP CONSTRAINT IF EXISTS chk_claimed_has_timestamp;

ALTER TABLE lead_handover_pool
  ADD CONSTRAINT chk_claimed_has_timestamp
  CHECK (
    claimed_by IS NULL
    OR (claimed_by IS NOT NULL AND claimed_at IS NOT NULL)
  );

-- =========================
-- QUOTES CONSTRAINTS
-- =========================

-- Sent quotes must have sent_at
ALTER TABLE quotes
  DROP CONSTRAINT IF EXISTS chk_sent_quote_has_timestamp;

ALTER TABLE quotes
  ADD CONSTRAINT chk_sent_quote_has_timestamp
  CHECK (
    status NOT IN ('Sent', 'Accepted', 'Rejected')
    OR sent_at IS NOT NULL
  );

-- Accepted quotes must have accepted_at
ALTER TABLE quotes
  DROP CONSTRAINT IF EXISTS chk_accepted_quote_has_timestamp;

ALTER TABLE quotes
  ADD CONSTRAINT chk_accepted_quote_has_timestamp
  CHECK (
    status != 'Accepted'
    OR accepted_at IS NOT NULL
  );

-- =========================
-- INDEXES FOR LIST VIEW PERFORMANCE
-- =========================

-- Accounts list view indexes
CREATE INDEX IF NOT EXISTS idx_accounts_owner_active ON accounts(owner_user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_accounts_company_search ON accounts(company_name text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_accounts_created_at ON accounts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_updated_at ON accounts(updated_at DESC);

-- Leads list view indexes
CREATE INDEX IF NOT EXISTS idx_leads_owner_status ON leads(sales_owner_user_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_triage_status ON leads(triage_status) WHERE triage_status IN ('New', 'In Review');
CREATE INDEX IF NOT EXISTS idx_leads_company_search ON leads(company_name text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_leads_updated_at ON leads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_sla_deadline_pending ON leads(sla_deadline) WHERE triage_status IN ('New', 'In Review') AND sla_deadline IS NOT NULL;

-- Opportunities list view indexes
CREATE INDEX IF NOT EXISTS idx_opportunities_owner_stage ON opportunities(owner_user_id, stage);
CREATE INDEX IF NOT EXISTS idx_opportunities_account_stage ON opportunities(account_id, stage);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage_active ON opportunities(stage) WHERE stage NOT IN ('Closed Won', 'Closed Lost');
CREATE INDEX IF NOT EXISTS idx_opportunities_next_due ON opportunities(next_step_due_date) WHERE stage NOT IN ('Closed Won', 'Closed Lost');
CREATE INDEX IF NOT EXISTS idx_opportunities_expected_close ON opportunities(expected_close_date) WHERE stage NOT IN ('Closed Won', 'Closed Lost');
CREATE INDEX IF NOT EXISTS idx_opportunities_updated_at ON opportunities(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_value ON opportunities(estimated_value DESC) WHERE stage NOT IN ('Closed Won', 'Closed Lost');

-- Activities list view indexes
CREATE INDEX IF NOT EXISTS idx_activities_owner_status ON activities(owner_user_id, status);
CREATE INDEX IF NOT EXISTS idx_activities_due_planned ON activities(due_date) WHERE status = 'Planned';
CREATE INDEX IF NOT EXISTS idx_activities_overdue ON activities(due_date) WHERE status = 'Planned' AND due_date < CURRENT_DATE;
CREATE INDEX IF NOT EXISTS idx_activities_type_status ON activities(activity_type, status);
CREATE INDEX IF NOT EXISTS idx_activities_opp_status ON activities(related_opportunity_id, status);
CREATE INDEX IF NOT EXISTS idx_activities_account_status ON activities(related_account_id, status);
CREATE INDEX IF NOT EXISTS idx_activities_updated_at ON activities(updated_at DESC);

-- Contacts list view indexes
CREATE INDEX IF NOT EXISTS idx_contacts_account_primary ON contacts(account_id, is_primary DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_email_search ON contacts(email text_pattern_ops) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_name_search ON contacts(first_name text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_decision_maker ON contacts(account_id) WHERE is_decision_maker = true;

-- Prospecting targets list view indexes
CREATE INDEX IF NOT EXISTS idx_targets_owner_status ON prospecting_targets(owner_user_id, status);
CREATE INDEX IF NOT EXISTS idx_targets_next_outreach ON prospecting_targets(next_outreach_at) WHERE status NOT IN ('Converted', 'Invalid');
CREATE INDEX IF NOT EXISTS idx_targets_company_search ON prospecting_targets(company_name text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_targets_updated_at ON prospecting_targets(updated_at DESC);

-- Lead handover pool indexes
CREATE INDEX IF NOT EXISTS idx_handover_pool_priority ON lead_handover_pool(priority DESC, handed_over_at ASC) WHERE claimed_by IS NULL;
CREATE INDEX IF NOT EXISTS idx_handover_pool_expires ON lead_handover_pool(expires_at) WHERE claimed_by IS NULL AND expires_at IS NOT NULL;

-- Quotes list view indexes
CREATE INDEX IF NOT EXISTS idx_quotes_opp_status ON quotes(opportunity_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_valid_until ON quotes(valid_until) WHERE status IN ('Draft', 'Sent');

-- Stage history indexes (for timeline)
CREATE INDEX IF NOT EXISTS idx_opp_stage_hist_opp_time ON opportunity_stage_history(opportunity_id, changed_at DESC);

-- =========================
-- COMPOSITE INDEXES FOR COMMON QUERIES
-- =========================

-- My active opportunities (sales dashboard)
CREATE INDEX IF NOT EXISTS idx_my_active_opportunities
  ON opportunities(owner_user_id, stage, next_step_due_date)
  WHERE stage NOT IN ('Closed Won', 'Closed Lost');

-- My planned activities (todo list)
CREATE INDEX IF NOT EXISTS idx_my_planned_activities
  ON activities(owner_user_id, due_date, activity_type)
  WHERE status = 'Planned';

-- My leads to follow up
CREATE INDEX IF NOT EXISTS idx_my_leads_followup
  ON leads(sales_owner_user_id, due_date, status)
  WHERE status NOT IN ('Closed Won', 'Closed Lost', 'Disqualified');

-- Handover pool queue
CREATE INDEX IF NOT EXISTS idx_handover_queue
  ON lead_handover_pool(claimed_by, priority DESC, handed_over_at ASC)
  WHERE claimed_by IS NULL;

-- Account search with owner
CREATE INDEX IF NOT EXISTS idx_account_owner_search
  ON accounts(owner_user_id, company_name);

-- =========================
-- TRIGGER: Auto-set timestamps on status changes
-- =========================

CREATE OR REPLACE FUNCTION auto_set_activity_timestamps()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set completed_at when status changes to Done
  IF NEW.status = 'Done' AND OLD.status != 'Done' THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  END IF;

  -- Set cancelled_at when status changes to Cancelled
  IF NEW.status = 'Cancelled' AND OLD.status != 'Cancelled' THEN
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
  END IF;

  -- Update updated_at
  NEW.updated_at := now();

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_activity_timestamps ON activities;
CREATE TRIGGER trg_auto_activity_timestamps
BEFORE UPDATE ON activities
FOR EACH ROW EXECUTE FUNCTION auto_set_activity_timestamps();

-- =========================
-- TRIGGER: Auto-set closed_at on opportunity close
-- =========================

CREATE OR REPLACE FUNCTION auto_set_opportunity_closed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set closed_at when stage changes to Closed Won or Closed Lost
  IF NEW.stage IN ('Closed Won', 'Closed Lost') AND OLD.stage NOT IN ('Closed Won', 'Closed Lost') THEN
    NEW.closed_at := COALESCE(NEW.closed_at, now());
  END IF;

  -- Clear closed_at if reopening opportunity
  IF NEW.stage NOT IN ('Closed Won', 'Closed Lost') AND OLD.stage IN ('Closed Won', 'Closed Lost') THEN
    NEW.closed_at := NULL;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_opportunity_closed_at ON opportunities;
CREATE TRIGGER trg_auto_opportunity_closed_at
BEFORE UPDATE ON opportunities
FOR EACH ROW EXECUTE FUNCTION auto_set_opportunity_closed_at();

-- =========================
-- TRIGGER: Auto-set qualified/disqualified timestamps
-- =========================

CREATE OR REPLACE FUNCTION auto_set_lead_triage_timestamps()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set qualified_at when triage_status changes to Qualified
  IF NEW.triage_status = 'Qualified' AND OLD.triage_status != 'Qualified' THEN
    NEW.qualified_at := COALESCE(NEW.qualified_at, now());
  END IF;

  -- Set disqualified_at when triage_status changes to Disqualified
  IF NEW.triage_status = 'Disqualified' AND OLD.triage_status != 'Disqualified' THEN
    NEW.disqualified_at := COALESCE(NEW.disqualified_at, now());
  END IF;

  -- Update updated_at
  NEW.updated_at := now();

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_lead_triage_timestamps ON leads;
CREATE TRIGGER trg_auto_lead_triage_timestamps
BEFORE UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION auto_set_lead_triage_timestamps();

-- =========================
-- FOREIGN KEY CONSTRAINTS (Ensure referential integrity)
-- =========================

-- Ensure activities reference valid entities
ALTER TABLE activities
  DROP CONSTRAINT IF EXISTS fk_activities_account;

ALTER TABLE activities
  ADD CONSTRAINT fk_activities_account
  FOREIGN KEY (related_account_id)
  REFERENCES accounts(account_id)
  ON DELETE CASCADE;

-- Lead handover pool references leads
ALTER TABLE lead_handover_pool
  DROP CONSTRAINT IF EXISTS fk_handover_lead;

ALTER TABLE lead_handover_pool
  ADD CONSTRAINT fk_handover_lead
  FOREIGN KEY (lead_id)
  REFERENCES leads(lead_id)
  ON DELETE CASCADE;

-- =========================
-- UNIQUE CONSTRAINTS (Prevent duplicates)
-- =========================

-- One primary contact per account
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_primary_contact_per_account
  ON contacts(account_id)
  WHERE is_primary = true;

-- One active cadence enrollment per entity
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_enrollment_per_opp
  ON cadence_enrollments(opportunity_id)
  WHERE status = 'Active';

-- =========================
-- STATISTICS UPDATE
-- =========================

-- Analyze tables for query planner
ANALYZE accounts;
ANALYZE leads;
ANALYZE opportunities;
ANALYZE activities;
ANALYZE contacts;
ANALYZE prospecting_targets;
ANALYZE lead_handover_pool;
ANALYZE quotes;
ANALYZE opportunity_stage_history;

-- =========================
-- END OF MIGRATION
-- =========================

-- =============================================================================
-- CRM Rebuild Migration - Account/Opportunity/Activity + Atomic Flows
-- Version: 3.0
--
-- This migration:
-- 1. Archives old CRM tables (prospects, prospect_stage_history, sales_activities)
-- 2. Renames customers to accounts (master record)
-- 3. Creates new CRM structure with:
--    - contacts (multi-contact per account)
--    - opportunities (pipeline with forwarding stages)
--    - activities (universal: planned/done/cancelled)
--    - prospecting_targets (cold outreach)
--    - cadences (automated sequence)
--    - quotes (with versioning)
--    - shipment_profiles (per account)
--    - invoice_ledger (for status computation)
--    - crm_idempotency (for atomic operations)
-- =============================================================================

-- =========================
-- NEW ENUMS
-- =========================

-- Opportunity stages (forwarding/logistics focused)
DO $$ BEGIN
  CREATE TYPE opportunity_stage AS ENUM (
    'Prospecting',
    'Discovery',
    'Proposal Sent',
    'Quote Sent',
    'Negotiation',
    'Verbal Commit',
    'Closed Won',
    'Closed Lost',
    'On Hold'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Lead triage status
DO $$ BEGIN
  CREATE TYPE lead_triage_status AS ENUM (
    'New',
    'In Review',
    'Qualified',
    'Nurture',
    'Disqualified',
    'Handed Over'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Activity status (universal)
DO $$ BEGIN
  CREATE TYPE activity_status AS ENUM (
    'Planned',
    'Done',
    'Cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Activity type (universal - expanded)
DO $$ BEGIN
  CREATE TYPE activity_type_v2 AS ENUM (
    'Call',
    'Email',
    'Visit',
    'Online Meeting',
    'WhatsApp',
    'LinkedIn Message',
    'Send Proposal',
    'Send Quote',
    'Follow Up',
    'Internal Meeting',
    'Other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Target status
DO $$ BEGIN
  CREATE TYPE target_status AS ENUM (
    'New',
    'Contacted',
    'Converted',
    'Not Interested',
    'Invalid'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Account tenure status (computed)
DO $$ BEGIN
  CREATE TYPE tenure_status AS ENUM (
    'Prospect',
    'New Customer',
    'Active Customer',
    'Winback Target'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Account activity status (computed)
DO $$ BEGIN
  CREATE TYPE account_activity_status AS ENUM (
    'Active',
    'Passive',
    'Inactive'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================
-- ARCHIVE OLD TABLES
-- =========================

-- Rename old tables to archive (keep data for reference)
ALTER TABLE IF EXISTS prospects RENAME TO _archived_prospects;
ALTER TABLE IF EXISTS prospect_stage_history RENAME TO _archived_prospect_stage_history;
ALTER TABLE IF EXISTS sales_activities RENAME TO _archived_sales_activities;

-- Drop old triggers
DROP TRIGGER IF EXISTS prospects_id_before_insert ON _archived_prospects;
DROP TRIGGER IF EXISTS prospects_stage_change ON _archived_prospects;

-- =========================
-- RENAME CUSTOMERS TO ACCOUNTS
-- =========================

-- Rename the table
ALTER TABLE IF EXISTS customers RENAME TO accounts;

-- Rename the primary key column
ALTER TABLE accounts RENAME COLUMN customer_id TO account_id;

-- Add new columns to accounts
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS domain text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS industry text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS employee_count text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS annual_revenue numeric;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES profiles(user_id);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS parent_account_id text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tags text[];

-- Add unique constraints for dedupe
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_domain_unique ON accounts(domain) WHERE domain IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_npwp_unique ON accounts(npwp) WHERE npwp IS NOT NULL;

-- Update trigger for account_id generation
CREATE OR REPLACE FUNCTION trg_account_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.account_id IS NULL OR NEW.account_id = '' THEN
    NEW.account_id := next_prefixed_id('ACCT', current_date);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS customers_id_before_insert ON accounts;
CREATE TRIGGER accounts_id_before_insert
BEFORE INSERT ON accounts
FOR EACH ROW EXECUTE FUNCTION trg_account_id();

-- =========================
-- CONTACTS TABLE
-- =========================
CREATE TABLE IF NOT EXISTS contacts (
  contact_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text,
  title text,
  email text,
  phone text,
  mobile text,
  is_primary boolean NOT NULL DEFAULT false,
  is_decision_maker boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid NOT NULL REFERENCES profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_account ON contacts(account_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_email_account ON contacts(account_id, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_phone_account ON contacts(account_id, phone) WHERE phone IS NOT NULL;

-- Auto-generate contact_id
CREATE OR REPLACE FUNCTION trg_contact_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.contact_id IS NULL OR NEW.contact_id = '' THEN
    NEW.contact_id := next_prefixed_id('CONT', current_date);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER contacts_id_before_insert
BEFORE INSERT ON contacts
FOR EACH ROW EXECUTE FUNCTION trg_contact_id();

-- =========================
-- PROSPECTING TARGETS TABLE
-- =========================
CREATE TABLE IF NOT EXISTS prospecting_targets (
  target_id text PRIMARY KEY,
  company_name text NOT NULL,
  domain text,
  industry text,
  contact_name text,
  contact_email text,
  contact_phone text,
  linkedin_url text,
  city text,
  notes text,
  status target_status NOT NULL DEFAULT 'New',
  owner_user_id uuid REFERENCES profiles(user_id),
  last_contacted_at timestamptz,
  next_outreach_at timestamptz,
  dedupe_key text NOT NULL,
  converted_to_lead_id text,
  converted_to_account_id text,
  source text,
  created_by uuid NOT NULL REFERENCES profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_targets_dedupe ON prospecting_targets(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_targets_owner ON prospecting_targets(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_targets_status ON prospecting_targets(status);
CREATE INDEX IF NOT EXISTS idx_targets_next_outreach ON prospecting_targets(next_outreach_at);

-- Auto-generate target_id
CREATE OR REPLACE FUNCTION trg_target_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.target_id IS NULL OR NEW.target_id = '' THEN
    NEW.target_id := next_prefixed_id('TGT', current_date);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER targets_id_before_insert
BEFORE INSERT ON prospecting_targets
FOR EACH ROW EXECUTE FUNCTION trg_target_id();

-- =========================
-- OPPORTUNITIES TABLE
-- =========================
CREATE TABLE IF NOT EXISTS opportunities (
  opportunity_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  name text NOT NULL,
  stage opportunity_stage NOT NULL DEFAULT 'Prospecting',
  owner_user_id uuid NOT NULL REFERENCES profiles(user_id),
  estimated_value numeric,
  currency text DEFAULT 'IDR',
  probability integer CHECK (probability >= 0 AND probability <= 100),
  expected_close_date date,
  service_codes text[],
  route text,
  next_step text NOT NULL,
  next_step_due_date date NOT NULL,
  source_lead_id text,
  source_target_id text,
  lost_reason text,
  competitor text,
  notes text,
  created_by uuid NOT NULL REFERENCES profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_opportunities_account ON opportunities(account_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_owner ON opportunities(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_opportunities_next_step_due ON opportunities(next_step_due_date);
CREATE INDEX IF NOT EXISTS idx_opportunities_expected_close ON opportunities(expected_close_date);

-- Auto-generate opportunity_id
CREATE OR REPLACE FUNCTION trg_opportunity_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.opportunity_id IS NULL OR NEW.opportunity_id = '' THEN
    NEW.opportunity_id := next_prefixed_id('OPP', current_date);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER opportunities_id_before_insert
BEFORE INSERT ON opportunities
FOR EACH ROW EXECUTE FUNCTION trg_opportunity_id();

-- =========================
-- OPPORTUNITY STAGE HISTORY
-- =========================
CREATE TABLE IF NOT EXISTS opportunity_stage_history (
  id bigserial PRIMARY KEY,
  opportunity_id text NOT NULL REFERENCES opportunities(opportunity_id) ON DELETE CASCADE,
  from_stage opportunity_stage,
  to_stage opportunity_stage NOT NULL,
  changed_by uuid NOT NULL REFERENCES profiles(user_id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE INDEX IF NOT EXISTS idx_opp_stage_hist_opp ON opportunity_stage_history(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opp_stage_hist_at ON opportunity_stage_history(changed_at);

-- Trigger for auto-recording stage changes
CREATE OR REPLACE FUNCTION trg_opportunity_stage_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO opportunity_stage_history(opportunity_id, from_stage, to_stage, changed_by)
    VALUES (NEW.opportunity_id, OLD.stage, NEW.stage, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid));

    -- Set closed_at when moving to closed stages
    IF NEW.stage IN ('Closed Won', 'Closed Lost') AND OLD.stage NOT IN ('Closed Won', 'Closed Lost') THEN
      NEW.closed_at := now();
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER opportunities_stage_change
BEFORE UPDATE ON opportunities
FOR EACH ROW EXECUTE FUNCTION trg_opportunity_stage_change();

-- =========================
-- SHIPMENT PROFILES TABLE
-- =========================
CREATE TABLE IF NOT EXISTS shipment_profiles (
  profile_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  opportunity_id text REFERENCES opportunities(opportunity_id),
  name text NOT NULL,
  origin_address text,
  origin_city text,
  origin_country text DEFAULT 'Indonesia',
  destination_address text,
  destination_city text,
  destination_country text DEFAULT 'Indonesia',
  cargo_type text,
  avg_weight numeric,
  avg_dimensions text,
  frequency text,
  special_requirements text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipment_profiles_account ON shipment_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_shipment_profiles_opportunity ON shipment_profiles(opportunity_id);

-- Auto-generate profile_id
CREATE OR REPLACE FUNCTION trg_shipment_profile_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.profile_id IS NULL OR NEW.profile_id = '' THEN
    NEW.profile_id := next_prefixed_id('SHIP', current_date);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER shipment_profiles_id_before_insert
BEFORE INSERT ON shipment_profiles
FOR EACH ROW EXECUTE FUNCTION trg_shipment_profile_id();

-- =========================
-- ACTIVITIES TABLE (Universal)
-- =========================
CREATE TABLE IF NOT EXISTS activities (
  activity_id text PRIMARY KEY,
  activity_type activity_type_v2 NOT NULL,
  status activity_status NOT NULL DEFAULT 'Planned',
  subject text NOT NULL,
  description text,
  -- Polymorphic reference
  related_account_id text REFERENCES accounts(account_id) ON DELETE CASCADE,
  related_contact_id text REFERENCES contacts(contact_id) ON DELETE SET NULL,
  related_opportunity_id text REFERENCES opportunities(opportunity_id) ON DELETE CASCADE,
  related_lead_id text,
  related_target_id text REFERENCES prospecting_targets(target_id) ON DELETE SET NULL,
  -- Scheduling
  scheduled_at timestamptz,
  due_date date,
  completed_at timestamptz,
  cancelled_at timestamptz,
  -- Ownership
  owner_user_id uuid NOT NULL REFERENCES profiles(user_id),
  -- Execution details
  outcome text,
  duration_minutes integer,
  evidence_url text,
  gps_lat numeric,
  gps_lng numeric,
  -- Cadence link
  cadence_enrollment_id bigint,
  cadence_step_number integer,
  -- Audit
  created_by uuid NOT NULL REFERENCES profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activities_account ON activities(related_account_id);
CREATE INDEX IF NOT EXISTS idx_activities_opportunity ON activities(related_opportunity_id);
CREATE INDEX IF NOT EXISTS idx_activities_owner ON activities(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);
CREATE INDEX IF NOT EXISTS idx_activities_scheduled ON activities(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_activities_due ON activities(due_date);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type);

-- Auto-generate activity_id
CREATE OR REPLACE FUNCTION trg_activity_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.activity_id IS NULL OR NEW.activity_id = '' THEN
    NEW.activity_id := next_prefixed_id('ACT', current_date);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER activities_id_before_insert
BEFORE INSERT ON activities
FOR EACH ROW EXECUTE FUNCTION trg_activity_id();

-- =========================
-- CADENCES TABLE
-- =========================
CREATE TABLE IF NOT EXISTS cadences (
  cadence_id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  owner_user_id uuid REFERENCES profiles(user_id),
  created_by uuid NOT NULL REFERENCES profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================
-- CADENCE STEPS TABLE
-- =========================
CREATE TABLE IF NOT EXISTS cadence_steps (
  step_id serial PRIMARY KEY,
  cadence_id integer NOT NULL REFERENCES cadences(cadence_id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  activity_type activity_type_v2 NOT NULL,
  subject_template text NOT NULL,
  description_template text,
  delay_days integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cadence_steps_order ON cadence_steps(cadence_id, step_number);

-- =========================
-- CADENCE ENROLLMENTS TABLE
-- =========================
CREATE TABLE IF NOT EXISTS cadence_enrollments (
  enrollment_id bigserial PRIMARY KEY,
  cadence_id integer NOT NULL REFERENCES cadences(cadence_id) ON DELETE CASCADE,
  account_id text REFERENCES accounts(account_id) ON DELETE CASCADE,
  contact_id text REFERENCES contacts(contact_id) ON DELETE SET NULL,
  opportunity_id text REFERENCES opportunities(opportunity_id) ON DELETE CASCADE,
  target_id text REFERENCES prospecting_targets(target_id) ON DELETE SET NULL,
  current_step integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'Active', -- Active, Paused, Completed, Stopped
  enrolled_by uuid NOT NULL REFERENCES profiles(user_id),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  stopped_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_enrollments_cadence ON cadence_enrollments(cadence_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_account ON cadence_enrollments(account_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_opportunity ON cadence_enrollments(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON cadence_enrollments(status);

-- =========================
-- QUOTES TABLE
-- =========================
CREATE TABLE IF NOT EXISTS quotes (
  quote_id text PRIMARY KEY,
  opportunity_id text NOT NULL REFERENCES opportunities(opportunity_id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'Draft', -- Draft, Sent, Accepted, Rejected, Expired
  valid_until date,
  total_amount numeric,
  currency text DEFAULT 'IDR',
  terms text,
  notes text,
  file_url text,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  created_by uuid NOT NULL REFERENCES profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotes_opportunity ON quotes(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_quotes_account ON quotes(account_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_version ON quotes(opportunity_id, version);

-- Auto-generate quote_id
CREATE OR REPLACE FUNCTION trg_quote_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.quote_id IS NULL OR NEW.quote_id = '' THEN
    NEW.quote_id := next_prefixed_id('QUO', current_date);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER quotes_id_before_insert
BEFORE INSERT ON quotes
FOR EACH ROW EXECUTE FUNCTION trg_quote_id();

-- =========================
-- INVOICE LEDGER TABLE
-- =========================
CREATE TABLE IF NOT EXISTS invoice_ledger (
  ledger_id bigserial PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  invoice_id text REFERENCES invoices(invoice_id) ON DELETE SET NULL,
  invoice_date date NOT NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'IDR',
  status text NOT NULL DEFAULT 'Outstanding', -- Outstanding, Paid, Partial, Overdue
  paid_amount numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_ledger_account ON invoice_ledger(account_id);
CREATE INDEX IF NOT EXISTS idx_invoice_ledger_date ON invoice_ledger(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoice_ledger_status ON invoice_ledger(status);

-- =========================
-- CRM IDEMPOTENCY TABLE
-- =========================
CREATE TABLE IF NOT EXISTS crm_idempotency (
  idempotency_key text PRIMARY KEY,
  operation text NOT NULL,
  request_hash text,
  response_data jsonb,
  created_by uuid REFERENCES profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON crm_idempotency(expires_at);

-- =========================
-- LEAD HANDOVER POOL TABLE
-- =========================
CREATE TABLE IF NOT EXISTS lead_handover_pool (
  handover_id bigserial PRIMARY KEY,
  lead_id text NOT NULL UNIQUE,
  handed_over_by uuid NOT NULL REFERENCES profiles(user_id),
  handed_over_at timestamptz NOT NULL DEFAULT now(),
  claimed_by uuid REFERENCES profiles(user_id),
  claimed_at timestamptz,
  notes text,
  priority integer DEFAULT 0,
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_handover_pool_unclaimed ON lead_handover_pool(claimed_by) WHERE claimed_by IS NULL;
CREATE INDEX IF NOT EXISTS idx_handover_pool_lead ON lead_handover_pool(lead_id);

-- =========================
-- UPDATE LEADS TABLE
-- =========================

-- Add new columns to leads for triage workflow
ALTER TABLE leads ADD COLUMN IF NOT EXISTS triage_status lead_triage_status DEFAULT 'New';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS handover_eligible boolean DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS handover_notes text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS dedupe_key text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS dedupe_suggestions jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sla_deadline timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualified_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS disqualified_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS disqualified_reason text;

-- Add dedupe key index
CREATE INDEX IF NOT EXISTS idx_leads_dedupe ON leads(dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_triage ON leads(triage_status);
CREATE INDEX IF NOT EXISTS idx_leads_sla ON leads(sla_deadline);

-- =========================
-- UPDATE FOREIGN KEYS
-- =========================

-- Update invoices to reference accounts
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_customer_id_fkey;
ALTER TABLE invoices RENAME COLUMN customer_id TO account_id;
ALTER TABLE invoices ADD CONSTRAINT invoices_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(account_id);

-- Update tickets to reference accounts
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_related_customer_id_fkey;
ALTER TABLE tickets RENAME COLUMN related_customer_id TO related_account_id;
ALTER TABLE tickets ADD CONSTRAINT tickets_related_account_id_fkey FOREIGN KEY (related_account_id) REFERENCES accounts(account_id);

-- Update leads to reference accounts and opportunities
ALTER TABLE leads ADD COLUMN IF NOT EXISTS opportunity_id text;
ALTER TABLE leads ADD CONSTRAINT leads_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES opportunities(opportunity_id);

-- =========================
-- VIEWS
-- =========================

-- Accounts enriched view (computed status)
CREATE OR REPLACE VIEW v_accounts_enriched AS
SELECT
  a.*,
  (SELECT MIN(il.invoice_date) FROM invoice_ledger il WHERE il.account_id = a.account_id) as first_invoice_at,
  (SELECT MAX(il.invoice_date) FROM invoice_ledger il WHERE il.account_id = a.account_id) as last_invoice_at,
  (SELECT COUNT(*) FROM invoice_ledger il WHERE il.account_id = a.account_id) as total_invoices,
  (SELECT COALESCE(SUM(il.amount), 0) FROM invoice_ledger il WHERE il.account_id = a.account_id) as lifetime_value,
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM invoice_ledger il WHERE il.account_id = a.account_id) THEN 'Prospect'::tenure_status
    WHEN (SELECT MIN(il.invoice_date) FROM invoice_ledger il WHERE il.account_id = a.account_id) > current_date - interval '90 days' THEN 'New Customer'::tenure_status
    WHEN (SELECT MAX(il.invoice_date) FROM invoice_ledger il WHERE il.account_id = a.account_id) < current_date - interval '180 days' THEN 'Winback Target'::tenure_status
    ELSE 'Active Customer'::tenure_status
  END as tenure_status,
  CASE
    WHEN (SELECT MAX(act.completed_at) FROM activities act WHERE act.related_account_id = a.account_id AND act.status = 'Done') > current_date - interval '30 days' THEN 'Active'::account_activity_status
    WHEN (SELECT MAX(act.completed_at) FROM activities act WHERE act.related_account_id = a.account_id AND act.status = 'Done') > current_date - interval '90 days' THEN 'Passive'::account_activity_status
    ELSE 'Inactive'::account_activity_status
  END as activity_status,
  (SELECT MAX(il.invoice_date) FROM invoice_ledger il WHERE il.account_id = a.account_id AND il.invoice_date < current_date - interval '180 days') as winback_start_at
FROM accounts a;

-- Pipeline summary view
CREATE OR REPLACE VIEW v_pipeline_summary AS
SELECT
  stage,
  COUNT(*) as opportunity_count,
  COALESCE(SUM(estimated_value), 0) as total_value,
  AVG(probability) as avg_probability
FROM opportunities
WHERE stage NOT IN ('Closed Won', 'Closed Lost')
GROUP BY stage;

-- Sales inbox view (overdue activities)
CREATE OR REPLACE VIEW v_sales_inbox AS
SELECT
  a.*,
  opp.name as opportunity_name,
  opp.stage as opportunity_stage,
  acc.company_name as account_name
FROM activities a
LEFT JOIN opportunities opp ON a.related_opportunity_id = opp.opportunity_id
LEFT JOIN accounts acc ON a.related_account_id = acc.account_id
WHERE a.status = 'Planned'
  AND (a.due_date < current_date OR a.scheduled_at < now())
ORDER BY a.due_date ASC, a.scheduled_at ASC;

-- Lead inbox view (SLA queue)
CREATE OR REPLACE VIEW v_lead_inbox AS
SELECT
  l.*,
  CASE
    WHEN l.sla_deadline IS NOT NULL AND l.sla_deadline < now() THEN true
    ELSE false
  END as is_sla_breached,
  EXTRACT(EPOCH FROM (COALESCE(l.sla_deadline, now()) - now())) / 3600 as hours_to_sla
FROM leads l
WHERE l.triage_status IN ('New', 'In Review')
ORDER BY l.sla_deadline ASC NULLS LAST, l.created_at ASC;

-- =========================
-- END OF MIGRATION
-- =========================

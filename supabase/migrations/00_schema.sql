-- =============================================================================
-- UGC Logistics Integrated Dashboard - Database Schema
-- Version: 2.0 (Complete)
-- 
-- EXECUTION ORDER:
-- 1. 00_schema.sql (this file) - DDL + Functions + Triggers
-- 2. 01_seed.sql - Seed data (roles, departments, services, KPI defs)
-- 3. 02_rls.sql - Row Level Security policies
-- 4. 03_views.sql - Reporting & masking views
-- 5. 04_tests.sql - RLS tests
-- =============================================================================

-- =========================
-- EXTENSIONS
-- =========================
create extension if not exists "uuid-ossp";

-- =========================
-- ENUMS (LOCKED - DO NOT MODIFY)
-- =========================

-- Department codes (8 fixed)
create type dept_code as enum (
  'MKT',  -- Marketing
  'SAL',  -- Sales
  'DOM',  -- Domestics Ops
  'EXI',  -- EXIM Ops
  'DTD',  -- Import DTD Ops
  'FIN',  -- Finance
  'TRF',  -- Warehouse & Traffic
  'DIR'   -- Director
);

-- Lead source
create type lead_source_by as enum ('Marketing', 'Sales');

-- Primary channel (11 options)
create type primary_channel as enum (
  'LinkedIn',
  'SEM',
  'Paid Social',
  'Website (Direct/Referral)',
  'Webinar & Live',
  'Event Offline',
  'Trade Show',
  'Partnership/Referral',
  'Sales Outbound',
  'Sales Referral',
  'Other'
);

-- Lead status
create type lead_status as enum (
  'New',
  'Contacted',
  'Qualified',
  'Proposal',
  'Negotiation',
  'Closed Won',
  'Closed Lost',
  'Disqualified'
);

-- Next step actions
create type next_step as enum (
  'Call',
  'Email',
  'Visit',
  'Online Meeting',
  'Send Proposal',
  'Follow Up'
);

-- Prospect stages
create type prospect_stage as enum (
  'Prospect Created',
  'Initial Contact',
  'Need Analysis',
  'Proposal Sent',
  'Negotiation',
  'Closed Won',
  'Closed Lost',
  'Nurturing'
);

-- Activity types (5 fixed)
create type activity_type as enum (
  'Visit',
  'Call',
  'Online Meeting',
  'Email',
  'WhatsApp/Chat Outbound'
);

-- Ticket types (4 fixed - LOCKED)
create type ticket_type as enum (
  'inquiry tariff',
  'general request',
  'request pickup',
  'request delivery'
);

-- Inquiry status (for inquiry tariff only)
create type inquiry_status as enum (
  'OPEN',
  'WAITING RESPON',
  'WAITING CUSTOMER',
  'CLOSED',
  'CLOSED LOST'
);

-- General ticket status (for non-inquiry tickets)
create type ticket_status as enum (
  'OPEN',
  'IN PROGRESS',
  'CLOSED'
);

-- Import status
create type import_status as enum (
  'UPLOADED',
  'PROCESSING',
  'COMPLETED',
  'FAILED'
);

-- KPI calculation method
create type kpi_calc_method as enum (
  'AUTO',
  'MANUAL',
  'IMPORTED'
);

-- KPI direction
create type kpi_direction as enum (
  'HIGHER_BETTER',
  'LOWER_BETTER'
);

-- =========================
-- ID SEQUENCE HELPER
-- =========================
create table if not exists id_sequences (
  prefix text not null,
  date_part text not null,
  last_seq int not null default 0,
  primary key (prefix, date_part)
);

-- Function to get next sequence number for a prefix+date
create or replace function next_seq(p_prefix text, p_date date)
returns int
language plpgsql
as $$
declare
  v_date_part text := to_char(p_date, 'DDMMYY');
  v_seq int;
begin
  insert into id_sequences(prefix, date_part, last_seq)
  values (p_prefix, v_date_part, 1)
  on conflict (prefix, date_part)
  do update set last_seq = id_sequences.last_seq + 1
  returning last_seq into v_seq;
  
  return v_seq;
end $$;

-- Function to generate prefixed ID: PREFIX + DDMMYY + SEQ(4 digit)
create or replace function next_prefixed_id(p_prefix text, p_date date)
returns text
language plpgsql
as $$
declare
  v_date_part text := to_char(p_date, 'DDMMYY');
  v_seq int;
begin
  v_seq := next_seq(p_prefix, p_date);
  return p_prefix || v_date_part || lpad(v_seq::text, 4, '0');
end $$;

-- =========================
-- ROLES (15 FIXED - LOCKED)
-- =========================
create table if not exists roles (
  role_name text primary key,
  created_at timestamptz not null default now()
);

-- =========================
-- DEPARTMENTS (8 FIXED)
-- =========================
create table if not exists departments (
  dept_code dept_code primary key,
  dept_name text not null,
  created_at timestamptz not null default now()
);

-- =========================
-- PROFILES (linked to auth.users)
-- =========================
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  user_code text unique not null, -- e.g., MKT010126001
  full_name text not null,
  role_name text not null references roles(role_name),
  dept_code dept_code not null references departments(dept_code),
  manager_user_id uuid references profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on profiles(role_name);
create index if not exists idx_profiles_dept on profiles(dept_code);
create index if not exists idx_profiles_manager on profiles(manager_user_id);

-- =========================
-- SERVICE CATALOG (Master Data)
-- =========================
create table if not exists service_catalog (
  service_code text primary key,
  service_name text not null,
  owner_dept dept_code not null references departments(dept_code),
  scope_group text not null, -- Domestics, EXIM, Import DTD, Warehouse & Traffic
  created_at timestamptz not null default now()
);

-- =========================
-- CUSTOMERS
-- =========================
create table if not exists customers (
  customer_id text primary key, -- CUSTddmmyyxxxx
  company_name text not null,
  npwp text,
  pic_name text not null,
  pic_phone text not null,
  pic_email text not null,
  address text,
  city text,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customers_company on customers(company_name);
create index if not exists idx_customers_npwp on customers(npwp) where npwp is not null;
create index if not exists idx_customers_email on customers(pic_email);

-- Auto-generate customer_id
create or replace function trg_customer_id()
returns trigger language plpgsql as $$
begin
  if new.customer_id is null or new.customer_id = '' then
    new.customer_id := next_prefixed_id('CUST', current_date);
  end if;
  return new;
end $$;

drop trigger if exists customers_id_before_insert on customers;
create trigger customers_id_before_insert
before insert on customers
for each row execute function trg_customer_id();

-- =========================
-- LEADS
-- =========================
create table if not exists leads (
  lead_id text primary key, -- LEADddmmyyxxxx or channel-specific
  lead_date date not null default current_date,
  
  -- Company info
  company_name text not null,
  pic_name text not null,
  contact_phone text not null,
  email text not null,
  city_area text not null,
  
  -- Service requirements
  service_code text not null references service_catalog(service_code),
  route text, -- e.g., "JKT -> SBY"
  est_volume_value numeric,
  est_volume_unit text, -- kg, cbm, shipment, etc.
  timeline text, -- Immediate, 1 Month, etc.
  
  -- Attribution
  sourced_by lead_source_by not null,
  primary_channel primary_channel not null,
  campaign_name text,
  notes text,
  
  -- Ownership
  sales_owner_user_id uuid references profiles(user_id),
  
  -- Auto-linked entities (populated by BFF/trigger)
  customer_id text references customers(customer_id),
  prospect_id text, -- Will reference prospects after it's created
  
  -- Status tracking
  status lead_status not null default 'New',
  next_step next_step not null,
  due_date date not null,
  
  -- Audit
  created_by uuid not null references profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_leads_date on leads(lead_date);
create index if not exists idx_leads_channel on leads(primary_channel);
create index if not exists idx_leads_owner on leads(sales_owner_user_id);
create index if not exists idx_leads_customer on leads(customer_id);
create index if not exists idx_leads_status on leads(status);
create index if not exists idx_leads_created_by on leads(created_by);

-- Auto-generate lead_id based on channel
create or replace function trg_lead_id()
returns trigger language plpgsql as $$
declare
  prefix text;
begin
  if new.lead_id is null or new.lead_id = '' then
    -- Determine prefix based on primary_channel
    case new.primary_channel
      when 'LinkedIn' then prefix := 'LEADLI';
      when 'SEM' then prefix := 'LEADSEM';
      when 'Paid Social' then prefix := 'LEADPS';
      when 'Website (Direct/Referral)' then prefix := 'LEADWEB';
      when 'Webinar & Live' then prefix := 'LEADWL';
      when 'Event Offline' then prefix := 'LEADEV';
      when 'Trade Show' then prefix := 'LEADTS';
      when 'Partnership/Referral' then prefix := 'LEADREF';
      when 'Sales Outbound' then prefix := 'LEADSO';
      when 'Sales Referral' then prefix := 'LEADSR';
      else prefix := 'LEAD';
    end case;
    
    new.lead_id := next_prefixed_id(prefix, new.lead_date);
  end if;
  return new;
end $$;

drop trigger if exists leads_id_before_insert on leads;
create trigger leads_id_before_insert
before insert on leads
for each row execute function trg_lead_id();

-- =========================
-- PROSPECTS
-- =========================
create table if not exists prospects (
  prospect_id text primary key, -- ACTddmmyyxxxx
  customer_id text not null references customers(customer_id),
  owner_user_id uuid not null references profiles(user_id),
  current_stage prospect_stage not null default 'Prospect Created',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prospects_owner on prospects(owner_user_id);
create index if not exists idx_prospects_customer on prospects(customer_id);
create index if not exists idx_prospects_stage on prospects(current_stage);

-- Auto-generate prospect_id
create or replace function trg_prospect_id()
returns trigger language plpgsql as $$
begin
  if new.prospect_id is null or new.prospect_id = '' then
    new.prospect_id := next_prefixed_id('ACT', current_date);
  end if;
  return new;
end $$;

drop trigger if exists prospects_id_before_insert on prospects;
create trigger prospects_id_before_insert
before insert on prospects
for each row execute function trg_prospect_id();

-- Add FK from leads to prospects (after prospects table exists)
alter table leads 
  drop constraint if exists leads_prospect_id_fkey;
alter table leads 
  add constraint leads_prospect_id_fkey 
  foreign key (prospect_id) references prospects(prospect_id);

-- =========================
-- PROSPECT STAGE HISTORY
-- =========================
create table if not exists prospect_stage_history (
  id bigserial primary key,
  prospect_id text not null references prospects(prospect_id) on delete cascade,
  from_stage prospect_stage,
  to_stage prospect_stage not null,
  changed_by uuid not null references profiles(user_id),
  changed_at timestamptz not null default now()
);

create index if not exists idx_stage_hist_prospect on prospect_stage_history(prospect_id);
create index if not exists idx_stage_hist_changed_at on prospect_stage_history(changed_at);

-- Trigger to auto-record stage changes
create or replace function trg_prospect_stage_change()
returns trigger language plpgsql as $$
begin
  if old.current_stage is distinct from new.current_stage then
    insert into prospect_stage_history(prospect_id, from_stage, to_stage, changed_by)
    values (new.prospect_id, old.current_stage, new.current_stage, coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid));
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists prospects_stage_change on prospects;
create trigger prospects_stage_change
before update on prospects
for each row execute function trg_prospect_stage_change();

-- =========================
-- SALES ACTIVITIES
-- =========================
create table if not exists sales_activities (
  activity_id bigserial primary key,
  prospect_id text not null references prospects(prospect_id),
  activity_type activity_type not null,
  notes text not null,
  evidence_photo_url text, -- Required for Visit type (enforced in app)
  gps_lat numeric,         -- Required for Visit type (enforced in app)
  gps_lng numeric,         -- Required for Visit type (enforced in app)
  created_by uuid not null references profiles(user_id),
  created_at timestamptz not null default now()
);

create index if not exists idx_sales_activities_prospect on sales_activities(prospect_id);
create index if not exists idx_sales_activities_type on sales_activities(activity_type);
create index if not exists idx_sales_activities_created_at on sales_activities(created_at);

-- =========================
-- TICKETS (4 TYPES FIXED - LOCKED)
-- =========================
create table if not exists tickets (
  ticket_id text primary key,
  ticket_type ticket_type not null,
  
  -- Status (mutually exclusive based on ticket_type)
  inquiry_status inquiry_status, -- For inquiry tariff only
  ticket_status ticket_status,   -- For general/pickup/delivery
  
  -- Routing
  dept_target dept_code not null,
  service_code text references service_catalog(service_code),
  
  -- Ownership
  created_by uuid not null references profiles(user_id),
  assigned_to uuid references profiles(user_id),
  
  -- Related entities (for RFQ from lead)
  related_lead_id text references leads(lead_id),
  related_customer_id text references customers(customer_id),
  
  -- Content
  subject text not null,
  description text,
  
  -- RFQ specific fields
  origin_address text,
  origin_city text,
  origin_country text,
  destination_address text,
  destination_city text,
  destination_country text,
  cargo_category text,
  cargo_qty numeric,
  cargo_dimensions text,
  cargo_weight numeric,
  scope_of_work text,
  
  -- Masking control (for Ops view)
  need_customer_masking boolean not null default false,
  
  -- Close reason (required for CLOSED LOST)
  close_reason text,
  competitor_rate numeric,
  customer_budget numeric,
  
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists idx_tickets_type on tickets(ticket_type);
create index if not exists idx_tickets_dept on tickets(dept_target);
create index if not exists idx_tickets_assigned on tickets(assigned_to);
create index if not exists idx_tickets_created_by on tickets(created_by);
create index if not exists idx_tickets_created_at on tickets(created_at);

-- Auto-generate ticket_id based on type and dept
create or replace function trg_ticket_id()
returns trigger language plpgsql as $$
declare
  prefix text;
begin
  if new.ticket_id is null or new.ticket_id = '' then
    case new.ticket_type
      when 'inquiry tariff' then
        prefix := 'RFQ' || new.dept_target::text;
      when 'general request' then
        prefix := 'GEN' || new.dept_target::text;
      when 'request pickup' then
        prefix := 'REQPU';
      when 'request delivery' then
        prefix := 'REQDVR';
    end case;
    new.ticket_id := next_prefixed_id(prefix, current_date);
  end if;
  
  -- Set default status based on ticket type
  if new.ticket_type = 'inquiry tariff' and new.inquiry_status is null then
    new.inquiry_status := 'OPEN';
  elsif new.ticket_type != 'inquiry tariff' and new.ticket_status is null then
    new.ticket_status := 'OPEN';
  end if;
  
  return new;
end $$;

drop trigger if exists tickets_id_before_insert on tickets;
create trigger tickets_id_before_insert
before insert on tickets
for each row execute function trg_ticket_id();

-- Update timestamp trigger
create or replace function trg_tickets_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  
  -- Set closed_at when status changes to closed
  if new.ticket_type = 'inquiry tariff' then
    if new.inquiry_status in ('CLOSED', 'CLOSED LOST') and old.inquiry_status not in ('CLOSED', 'CLOSED LOST') then
      new.closed_at := now();
    end if;
  else
    if new.ticket_status = 'CLOSED' and old.ticket_status != 'CLOSED' then
      new.closed_at := now();
    end if;
  end if;
  
  return new;
end $$;

drop trigger if exists tickets_updated_at on tickets;
create trigger tickets_updated_at
before update on tickets
for each row execute function trg_tickets_updated_at();

-- =========================
-- TICKET MESSAGES
-- =========================
create table if not exists ticket_messages (
  message_id bigserial primary key,
  ticket_id text not null references tickets(ticket_id) on delete cascade,
  message text not null,
  created_by uuid not null references profiles(user_id),
  created_at timestamptz not null default now()
);

create index if not exists idx_ticket_messages_ticket on ticket_messages(ticket_id);
create index if not exists idx_ticket_messages_created_at on ticket_messages(created_at);

-- =========================
-- TICKET ATTACHMENTS
-- =========================
create table if not exists ticket_attachments (
  attachment_id bigserial primary key,
  ticket_id text not null references tickets(ticket_id) on delete cascade,
  file_url text not null,
  file_name text,
  file_size bigint,
  uploaded_by uuid not null references profiles(user_id),
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_ticket_attachments_ticket on ticket_attachments(ticket_id);

-- =========================
-- SLA EVENTS
-- =========================
create table if not exists sla_events (
  id bigserial primary key,
  ticket_id text not null references tickets(ticket_id) on delete cascade,
  event_type text not null, -- FIRST_RESPONSE, STATUS_CHANGE, BREACH, RESOLVED
  event_at timestamptz not null default now(),
  metadata jsonb -- Additional event data
);

create index if not exists idx_sla_events_ticket on sla_events(ticket_id);
create index if not exists idx_sla_events_type on sla_events(event_type);

-- =========================
-- KPI METRIC DEFINITIONS
-- =========================
create table if not exists kpi_metric_definitions (
  metric_key text primary key,
  owner_role text not null references roles(role_name),
  unit text,
  calc_method kpi_calc_method not null,
  direction kpi_direction not null,
  description text,
  created_at timestamptz not null default now()
);

-- =========================
-- KPI TARGETS
-- =========================
create table if not exists kpi_targets (
  id bigserial primary key,
  metric_key text not null references kpi_metric_definitions(metric_key),
  period_start date not null,
  period_end date not null,
  assignee_user_id uuid references profiles(user_id), -- NULL = team/org level
  target_value numeric not null,
  created_by uuid references profiles(user_id),
  created_at timestamptz not null default now()
);

create index if not exists idx_kpi_targets_metric on kpi_targets(metric_key);
create index if not exists idx_kpi_targets_assignee on kpi_targets(assignee_user_id);
create index if not exists idx_kpi_targets_period on kpi_targets(period_start, period_end);

-- =========================
-- MARKETING ACTIVITY EVENTS (Manual Input)
-- =========================
create table if not exists marketing_activity_events (
  id bigserial primary key,
  activity_name text not null,
  channel primary_channel,
  activity_date date not null,
  quantity numeric not null,
  notes text,
  created_by uuid not null references profiles(user_id),
  created_at timestamptz not null default now()
);

create index if not exists idx_mkt_events_date on marketing_activity_events(activity_date);
create index if not exists idx_mkt_events_channel on marketing_activity_events(channel);

-- =========================
-- MARKETING SPEND (Manual/Imported)
-- =========================
create table if not exists marketing_spend (
  id bigserial primary key,
  channel primary_channel not null,
  spend_date date not null,
  amount numeric not null,
  campaign_name text,
  notes text,
  created_by uuid not null references profiles(user_id),
  created_at timestamptz not null default now()
);

create index if not exists idx_mkt_spend_date on marketing_spend(spend_date);
create index if not exists idx_mkt_spend_channel on marketing_spend(channel);

-- =========================
-- IMPORTS (Bulk Import Tracking)
-- =========================
create table if not exists imports (
  import_id bigserial primary key,
  module text not null, -- leads, customers, spend, kpi, etc.
  file_name text not null,
  file_url text,
  total_rows int,
  success_rows int default 0,
  error_rows int default 0,
  status import_status not null default 'UPLOADED',
  uploaded_by uuid not null references profiles(user_id),
  uploaded_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_imports_module on imports(module);
create index if not exists idx_imports_status on imports(status);

-- =========================
-- IMPORT ROWS (Error Tracking)
-- =========================
create table if not exists import_rows (
  id bigserial primary key,
  import_id bigint not null references imports(import_id) on delete cascade,
  row_number int not null,
  row_data jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_import_rows_import on import_rows(import_id);

-- =========================
-- INVOICES (DSO)
-- =========================
create table if not exists invoices (
  invoice_id text primary key, -- INVddmmyyxxxx
  customer_id text not null references customers(customer_id),
  invoice_date date not null,
  due_date date not null,
  invoice_amount numeric not null,
  currency text not null default 'IDR',
  notes text,
  created_by uuid not null references profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invoices_customer on invoices(customer_id);
create index if not exists idx_invoices_date on invoices(invoice_date);
create index if not exists idx_invoices_due on invoices(due_date);

-- Auto-generate invoice_id
create or replace function trg_invoice_id()
returns trigger language plpgsql as $$
begin
  if new.invoice_id is null or new.invoice_id = '' then
    new.invoice_id := next_prefixed_id('INV', new.invoice_date);
  end if;
  return new;
end $$;

drop trigger if exists invoices_id_before_insert on invoices;
create trigger invoices_id_before_insert
before insert on invoices
for each row execute function trg_invoice_id();

-- =========================
-- PAYMENTS
-- =========================
create table if not exists payments (
  payment_id bigserial primary key,
  invoice_id text not null references invoices(invoice_id) on delete cascade,
  payment_date date not null,
  amount numeric not null,
  payment_method text,
  reference_no text,
  notes text,
  created_by uuid references profiles(user_id),
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_invoice on payments(invoice_id);
create index if not exists idx_payments_date on payments(payment_date);

-- =========================
-- SAVED VIEWS (User Preferences)
-- =========================
create table if not exists saved_views (
  view_id bigserial primary key,
  module text not null, -- dashboard, kpi, crm, ticketing, dso
  view_name text not null,
  filter_json jsonb not null,
  is_default boolean not null default false,
  created_by uuid not null references profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_saved_views_module on saved_views(module);
create index if not exists idx_saved_views_user on saved_views(created_by);

-- =========================
-- AUDIT LOGS
-- =========================
create table if not exists audit_logs (
  id bigserial primary key,
  table_name text not null,
  record_id text,
  action text not null, -- INSERT, UPDATE, DELETE
  changed_by uuid not null references profiles(user_id),
  changed_at timestamptz not null default now(),
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  user_agent text
);

create index if not exists idx_audit_table on audit_logs(table_name);
create index if not exists idx_audit_record on audit_logs(record_id);
create index if not exists idx_audit_changed_at on audit_logs(changed_at);
create index if not exists idx_audit_changed_by on audit_logs(changed_by);

-- =========================
-- HELPER FUNCTIONS
-- =========================

-- Function to find or create customer (dedup by NPWP/email/phone/company)
create or replace function find_or_create_customer(
  p_company_name text,
  p_npwp text,
  p_pic_name text,
  p_pic_phone text,
  p_pic_email text,
  p_city text default null,
  p_country text default null
)
returns text
language plpgsql
as $$
declare
  v_customer_id text;
begin
  -- Try to find existing customer by NPWP first
  if p_npwp is not null and p_npwp != '' then
    select customer_id into v_customer_id
    from customers
    where npwp = p_npwp
    limit 1;
    
    if v_customer_id is not null then
      return v_customer_id;
    end if;
  end if;
  
  -- Try to find by email
  select customer_id into v_customer_id
  from customers
  where pic_email = p_pic_email
  limit 1;
  
  if v_customer_id is not null then
    return v_customer_id;
  end if;
  
  -- Try to find by phone
  select customer_id into v_customer_id
  from customers
  where pic_phone = p_pic_phone
  limit 1;
  
  if v_customer_id is not null then
    return v_customer_id;
  end if;
  
  -- Try to find by company name (exact match)
  select customer_id into v_customer_id
  from customers
  where lower(company_name) = lower(p_company_name)
  limit 1;
  
  if v_customer_id is not null then
    return v_customer_id;
  end if;
  
  -- Create new customer
  insert into customers(company_name, npwp, pic_name, pic_phone, pic_email, city, country)
  values (p_company_name, nullif(p_npwp, ''), p_pic_name, p_pic_phone, p_pic_email, p_city, p_country)
  returning customer_id into v_customer_id;
  
  return v_customer_id;
end $$;

-- Function to find or create prospect for customer+owner
create or replace function find_or_create_prospect(
  p_customer_id text,
  p_owner_user_id uuid
)
returns text
language plpgsql
as $$
declare
  v_prospect_id text;
begin
  -- Try to find existing prospect
  select prospect_id into v_prospect_id
  from prospects
  where customer_id = p_customer_id
    and owner_user_id = p_owner_user_id
  limit 1;
  
  if v_prospect_id is not null then
    return v_prospect_id;
  end if;
  
  -- Create new prospect
  insert into prospects(customer_id, owner_user_id)
  values (p_customer_id, p_owner_user_id)
  returning prospect_id into v_prospect_id;
  
  return v_prospect_id;
end $$;

-- =========================
-- STORAGE BUCKETS (Reference)
-- =========================
-- These should be created in Supabase dashboard or via API:
-- - ticket-attachments
-- - kpi-evidence
-- - prospect-evidence
-- - customer-documents
-- - import-files

-- =========================
-- END OF SCHEMA
-- =========================

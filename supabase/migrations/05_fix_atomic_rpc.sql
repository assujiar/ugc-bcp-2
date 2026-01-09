-- =============================================================================
-- UGC Logistics Integrated Dashboard - FIX Migrations
-- Version: 2.1 (Module Refinement)
-- 
-- FIX-01: Atomic RPC for Create Lead Bundle
-- FIX-02: Audit Trail Trigger
-- FIX-04: CHECK constraint for close_reason
-- FIX-05: Unique constraint for KPI targets
-- =============================================================================

-- =========================
-- FIX-01: ATOMIC RPC FOR LEAD BUNDLE
-- Wraps: find_or_create_customer + find_or_create_prospect + insert lead + optional RFQ
-- All in single transaction - if any step fails, everything rolls back
-- =========================

create or replace function crm_create_lead_bundle(payload jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_customer_id text;
  v_prospect_id text;
  v_lead_id text;
  v_ticket_id text;
  v_owner_user_id uuid;
  v_created_by uuid;
  v_lead record;
  v_ticket record;
begin
  -- Extract user info
  v_created_by := auth.uid();
  if v_created_by is null then
    raise exception 'Unauthorized: No authenticated user';
  end if;

  -- Validate required fields
  if payload->>'company_name' is null or payload->>'company_name' = '' then
    raise exception 'company_name is required';
  end if;
  if payload->>'pic_name' is null or payload->>'pic_name' = '' then
    raise exception 'pic_name is required';
  end if;
  if payload->>'contact_phone' is null or payload->>'contact_phone' = '' then
    raise exception 'contact_phone is required';
  end if;
  if payload->>'email' is null or payload->>'email' = '' then
    raise exception 'email is required';
  end if;
  if payload->>'city_area' is null or payload->>'city_area' = '' then
    raise exception 'city_area is required';
  end if;
  if payload->>'service_code' is null or payload->>'service_code' = '' then
    raise exception 'service_code is required';
  end if;
  if payload->>'primary_channel' is null or payload->>'primary_channel' = '' then
    raise exception 'primary_channel is required';
  end if;

  -- Step 1: Find or create customer (uses existing function)
  v_customer_id := find_or_create_customer(
    p_company_name := payload->>'company_name',
    p_npwp := nullif(payload->>'npwp', ''),
    p_pic_name := payload->>'pic_name',
    p_pic_phone := payload->>'contact_phone',
    p_pic_email := payload->>'email',
    p_city := payload->>'city_area',
    p_country := nullif(payload->>'country', '')
  );

  -- Step 2: Determine owner and find/create prospect
  v_owner_user_id := coalesce(
    (payload->>'sales_owner_user_id')::uuid,
    v_created_by
  );

  v_prospect_id := find_or_create_prospect(
    p_customer_id := v_customer_id,
    p_owner_user_id := v_owner_user_id
  );

  -- Step 3: Insert lead
  insert into leads (
    lead_date,
    company_name,
    pic_name,
    contact_phone,
    email,
    city_area,
    service_code,
    route,
    est_volume_value,
    est_volume_unit,
    timeline,
    sourced_by,
    primary_channel,
    campaign_name,
    notes,
    sales_owner_user_id,
    customer_id,
    prospect_id,
    status,
    next_step,
    due_date,
    created_by
  ) values (
    coalesce((payload->>'lead_date')::date, current_date),
    payload->>'company_name',
    payload->>'pic_name',
    payload->>'contact_phone',
    payload->>'email',
    payload->>'city_area',
    payload->>'service_code',
    nullif(payload->>'route', ''),
    (payload->>'est_volume_value')::numeric,
    nullif(payload->>'est_volume_unit', ''),
    nullif(payload->>'timeline', ''),
    coalesce((payload->>'sourced_by')::lead_source_by, 'Marketing'::lead_source_by),
    (payload->>'primary_channel')::primary_channel,
    nullif(payload->>'campaign_name', ''),
    nullif(payload->>'notes', ''),
    (payload->>'sales_owner_user_id')::uuid,
    v_customer_id,
    v_prospect_id,
    'New'::lead_status,
    coalesce((payload->>'next_step')::next_step, 'Call'::next_step),
    coalesce((payload->>'due_date')::date, current_date + interval '7 days'),
    v_created_by
  )
  returning * into v_lead;

  v_lead_id := v_lead.lead_id;

  -- Step 4: Create RFQ ticket if requested and required fields present
  if (payload->>'need_rfq')::boolean = true 
     and payload->>'rfq_dept_target' is not null 
     and payload->>'rfq_scope_of_work' is not null 
  then
    insert into tickets (
      ticket_type,
      dept_target,
      service_code,
      created_by,
      related_lead_id,
      related_customer_id,
      subject,
      description,
      origin_address,
      origin_city,
      origin_country,
      destination_address,
      destination_city,
      destination_country,
      cargo_category,
      cargo_qty,
      cargo_dimensions,
      cargo_weight,
      scope_of_work,
      need_customer_masking
    ) values (
      'inquiry tariff'::ticket_type,
      (payload->>'rfq_dept_target')::dept_code,
      payload->>'service_code',
      v_created_by,
      v_lead_id,
      v_customer_id,
      'RFQ: ' || (payload->>'company_name') || ' - ' || (payload->>'service_code'),
      coalesce(payload->>'notes', 'Rate quote request from ' || (payload->>'company_name')),
      nullif(payload->>'rfq_origin_address', ''),
      nullif(payload->>'rfq_origin_city', ''),
      nullif(payload->>'rfq_origin_country', ''),
      nullif(payload->>'rfq_destination_address', ''),
      nullif(payload->>'rfq_destination_city', ''),
      nullif(payload->>'rfq_destination_country', ''),
      nullif(payload->>'rfq_cargo_category', ''),
      (payload->>'rfq_cargo_qty')::numeric,
      nullif(payload->>'rfq_cargo_dimensions', ''),
      (payload->>'rfq_cargo_weight')::numeric,
      payload->>'rfq_scope_of_work',
      true  -- Always mask for RFQ from lead
    )
    returning * into v_ticket;

    v_ticket_id := v_ticket.ticket_id;

    -- Create SLA event for ticket opened
    insert into sla_events (ticket_id, event_type, metadata)
    values (v_ticket_id, 'OPENED', jsonb_build_object('created_by', v_created_by));
  end if;

  -- Return result
  return jsonb_build_object(
    'success', true,
    'lead_id', v_lead_id,
    'customer_id', v_customer_id,
    'prospect_id', v_prospect_id,
    'ticket_id', v_ticket_id,
    'lead', row_to_json(v_lead)
  );

exception
  when others then
    -- Transaction will automatically rollback
    return jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE
    );
end $$;

-- Grant execute to authenticated users
grant execute on function crm_create_lead_bundle(jsonb) to authenticated;

-- =========================
-- FIX-02: AUDIT TRAIL TRIGGER
-- Auto-logs changes to key tables (leads, tickets, invoices, payments, prospects)
-- This supplements manual audit logs in API routes
-- =========================

create or replace function audit_row_change()
returns trigger
language plpgsql
security definer
as $$
declare
  v_record_id text;
  v_changed_by uuid;
begin
  -- Get the user who made the change
  v_changed_by := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  -- Determine the record ID based on table
  case TG_TABLE_NAME
    when 'leads' then
      v_record_id := coalesce(NEW.lead_id, OLD.lead_id);
    when 'tickets' then
      v_record_id := coalesce(NEW.ticket_id, OLD.ticket_id);
    when 'customers' then
      v_record_id := coalesce(NEW.customer_id, OLD.customer_id);
    when 'prospects' then
      v_record_id := coalesce(NEW.prospect_id, OLD.prospect_id);
    when 'invoices' then
      v_record_id := coalesce(NEW.invoice_id, OLD.invoice_id);
    when 'kpi_targets' then
      v_record_id := coalesce(NEW.id::text, OLD.id::text);
    else
      v_record_id := null;
  end case;

  -- Insert audit log
  if TG_OP = 'INSERT' then
    insert into audit_logs (table_name, record_id, action, changed_by, after_data)
    values (TG_TABLE_NAME, v_record_id, 'INSERT', v_changed_by, row_to_json(NEW)::jsonb);
    return NEW;
  elsif TG_OP = 'UPDATE' then
    insert into audit_logs (table_name, record_id, action, changed_by, before_data, after_data)
    values (TG_TABLE_NAME, v_record_id, 'UPDATE', v_changed_by, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into audit_logs (table_name, record_id, action, changed_by, before_data)
    values (TG_TABLE_NAME, v_record_id, 'DELETE', v_changed_by, row_to_json(OLD)::jsonb);
    return OLD;
  end if;

  return null;
end $$;

-- Apply audit triggers to key tables
-- Note: Only apply if trigger doesn't exist to avoid duplicates
do $$
begin
  -- Leads
  if not exists (select 1 from pg_trigger where tgname = 'trg_audit_leads') then
    create trigger trg_audit_leads
    after insert or update or delete on leads
    for each row execute function audit_row_change();
  end if;

  -- Tickets
  if not exists (select 1 from pg_trigger where tgname = 'trg_audit_tickets') then
    create trigger trg_audit_tickets
    after insert or update or delete on tickets
    for each row execute function audit_row_change();
  end if;

  -- Prospects
  if not exists (select 1 from pg_trigger where tgname = 'trg_audit_prospects') then
    create trigger trg_audit_prospects
    after insert or update or delete on prospects
    for each row execute function audit_row_change();
  end if;

  -- Invoices
  if not exists (select 1 from pg_trigger where tgname = 'trg_audit_invoices') then
    create trigger trg_audit_invoices
    after insert or update or delete on invoices
    for each row execute function audit_row_change();
  end if;

  -- KPI Targets
  if not exists (select 1 from pg_trigger where tgname = 'trg_audit_kpi_targets') then
    create trigger trg_audit_kpi_targets
    after insert or update or delete on kpi_targets
    for each row execute function audit_row_change();
  end if;
end $$;

-- =========================
-- FIX-03: SLA FIRST RESPONSE TRIGGER (OPTIONAL)
-- Auto-creates FIRST_RESPONSE SLA event when first message by non-creator is added
-- This supplements the existing logic in API route
-- =========================

create or replace function trg_sla_first_response()
returns trigger
language plpgsql
security definer
as $$
declare
  v_ticket record;
  v_existing_response_count int;
begin
  -- Get ticket info
  select ticket_id, created_by, created_at
  into v_ticket
  from tickets
  where ticket_id = NEW.ticket_id;

  -- Check if this is first response (message by someone other than ticket creator)
  if NEW.created_by != v_ticket.created_by then
    -- Count existing responses from non-creators
    select count(*) into v_existing_response_count
    from ticket_messages
    where ticket_id = NEW.ticket_id
      and created_by != v_ticket.created_by
      and message_id != NEW.message_id;

    -- If this is the first response
    if v_existing_response_count = 0 then
      -- Check if FIRST_RESPONSE event already exists (avoid duplicate from API)
      if not exists (
        select 1 from sla_events 
        where ticket_id = NEW.ticket_id 
          and event_type = 'FIRST_RESPONSE'
      ) then
        insert into sla_events (ticket_id, event_type, metadata)
        values (
          NEW.ticket_id,
          'FIRST_RESPONSE',
          jsonb_build_object(
            'responder_user_id', NEW.created_by,
            'response_time_minutes', 
              extract(epoch from (NEW.created_at - v_ticket.created_at)) / 60,
            'source', 'trigger'
          )
        );
      end if;
    end if;
  end if;

  return NEW;
end $$;

-- Apply SLA trigger (only if doesn't exist)
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_sla_first_response_on_message') then
    create trigger trg_sla_first_response_on_message
    after insert on ticket_messages
    for each row execute function trg_sla_first_response();
  end if;
end $$;

-- =========================
-- FIX-04: CHECK CONSTRAINT FOR CLOSE_REASON
-- Ensures close_reason is provided when inquiry_status = 'CLOSED LOST'
-- =========================

-- Add check constraint (DROP IF EXISTS pattern for idempotency)
alter table tickets 
  drop constraint if exists chk_close_reason_required;

alter table tickets 
  add constraint chk_close_reason_required
  check (
    (inquiry_status != 'CLOSED LOST'::inquiry_status) 
    or (inquiry_status = 'CLOSED LOST'::inquiry_status and close_reason is not null and close_reason != '')
  );

-- =========================
-- FIX-05: UNIQUE CONSTRAINT FOR KPI TARGETS
-- Prevents duplicate targets for same metric + period + assignee
-- =========================

-- Add unique constraint (DROP IF EXISTS pattern for idempotency)
alter table kpi_targets
  drop constraint if exists uq_kpi_targets_metric_period_assignee;

alter table kpi_targets
  add constraint uq_kpi_targets_metric_period_assignee
  unique (metric_key, period_start, period_end, assignee_user_id);

-- =========================
-- END OF FIX MIGRATIONS
-- =========================

-- supabase/migrations/02_rls.sql
-- UGC Integrated Dashboard Ã¢â‚¬â€ RLS Policies (Default deny + role-based access)
-- Roles are FIX (exact match in roles table). Do NOT add roles.

-- =========================================================
-- Helper functions (stable) to read current user's role/dept
-- =========================================================
create or replace function app_current_role()
returns text
language sql
stable
as $$
  select p.role_name
  from profiles p
  where p.user_id = auth.uid()
$$;

create or replace function app_current_dept()
returns dept_code
language sql
stable
as $$
  select p.dept_code
  from profiles p
  where p.user_id = auth.uid()
$$;

create or replace function app_is_role(role_in text)
returns boolean
language sql
stable
as $$
  select coalesce(app_current_role() = role_in, false)
$$;

create or replace function app_is_any_role(roles_in text[])
returns boolean
language sql
stable
as $$
  select coalesce(app_current_role() = any(roles_in), false)
$$;

create or replace function app_is_authenticated()
returns boolean
language sql
stable
as $$
  select auth.uid() is not null
$$;

-- marketing roles (staff + manager)
create or replace function app_is_marketing()
returns boolean
language sql
stable
as $$
  select app_is_any_role(array[
    'Marketing Manager',
    'Marcomm (marketing staff)',
    'DGO (Marketing staff)',
    'MACX (marketing staff)',
    'VSDO (marketing staff)'
  ])
$$;

-- sales roles
create or replace function app_is_sales()
returns boolean
language sql
stable
as $$
  select app_is_any_role(array[
    'sales manager',
    'salesperson',
    'sales support'
  ])
$$;

-- ops roles
create or replace function app_is_ops()
returns boolean
language sql
stable
as $$
  select app_is_any_role(array[
    'EXIM Ops (operation)',
    'domestics Ops (operation)',
    'Import DTD Ops (operation)',
    'traffic & warehous (operation)'
  ])
$$;

create or replace function app_is_super_admin()
returns boolean
language sql
stable
as $$
  select app_is_role('super admin')
$$;

create or replace function app_is_director()
returns boolean
language sql
stable
as $$
  select app_is_role('Director')
$$;

-- Team helper: sales manager can see records owned by users who have manager_user_id = auth.uid()
create or replace function app_is_my_team_member(user_id_in uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from profiles m
    where m.user_id = user_id_in
      and m.manager_user_id = auth.uid()
  )
$$;

-- Lead helper: can current user see a lead?
create or replace function app_can_read_lead(l leads)
returns boolean
language sql
stable
as $$
  select
    -- super admin / director can read all
    app_is_super_admin()
    or app_is_director()

    -- marketing manager can read all leads
    or app_is_role('Marketing Manager')

    -- marketing staff can read leads they created
    or (app_is_any_role(array[
          'Marcomm (marketing staff)',
          'DGO (Marketing staff)',
          'MACX (marketing staff)',
          'VSDO (marketing staff)'
        ]) and l.created_by = auth.uid())

    -- sales manager can read leads assigned to their team OR self
    or (app_is_role('sales manager') and (
          l.sales_owner_user_id = auth.uid()
          or (l.sales_owner_user_id is not null and app_is_my_team_member(l.sales_owner_user_id))
        ))

    -- salesperson can read leads assigned to them or created by them
    or (app_is_role('salesperson') and (
          l.sales_owner_user_id = auth.uid()
          or l.created_by = auth.uid()
        ))

    -- sales support can read all sales leads (any lead that has sales_owner set OR sourced_by=Sales)
    or (app_is_role('sales support') and (
          l.sales_owner_user_id is not null
          or l.sourced_by = 'Sales'::lead_source_by
        ))

    -- finance and ops: no direct lead access (default deny) unless later through views (NA)
$$;

-- Customer helper: can current user see a customer?
create or replace function app_can_read_customer(c customers)
returns boolean
language sql
stable
as $$
  select
    app_is_super_admin()
    or app_is_director()

    -- marketing can read customer data for CRM/invoicing pre-work
    or app_is_marketing()

    -- finance can read customers for invoicing
    or app_is_role('finance')

    -- sales manager/team: read customers that have any lead assigned to team/self
    or (app_is_role('sales manager') and exists (
          select 1 from leads l
          where l.customer_id = c.customer_id
            and (
              l.sales_owner_user_id = auth.uid()
              or (l.sales_owner_user_id is not null and app_is_my_team_member(l.sales_owner_user_id))
            )
        ))

    -- salesperson: read customers with lead assigned to them
    or (app_is_role('salesperson') and exists (
          select 1 from leads l
          where l.customer_id = c.customer_id
            and l.sales_owner_user_id = auth.uid()
        ))

    -- sales support: read all customers that are related to sales pipeline (any lead has sales_owner set)
    or (app_is_role('sales support') and exists (
          select 1 from leads l
          where l.customer_id = c.customer_id
            and l.sales_owner_user_id is not null
        ))
$$;

-- Prospect helper: can current user read/write prospect?
create or replace function app_can_read_prospect(p prospects)
returns boolean
language sql
stable
as $$
  select
    app_is_super_admin()
    or app_is_director()
    or app_is_role('Marketing Manager') -- manager can view for handover monitoring
    or (app_is_any_role(array[
          'Marcomm (marketing staff)',
          'DGO (Marketing staff)',
          'MACX (marketing staff)',
          'VSDO (marketing staff)'
        ]) and p.owner_user_id = auth.uid())
    or (app_is_role('sales manager') and (
          p.owner_user_id = auth.uid()
          or app_is_my_team_member(p.owner_user_id)
        ))
    or (app_is_role('salesperson') and p.owner_user_id = auth.uid())
    or (app_is_role('sales support')) -- can read all sales prospects (operational assist)
$$;

-- Ticket helper: access by creator, assignee, dept target, plus director/super admin
create or replace function app_can_read_ticket(t tickets)
returns boolean
language sql
stable
as $$
  select
    app_is_super_admin()
    or app_is_director()
    or t.created_by = auth.uid()
    or (t.assigned_to = auth.uid())
    or (app_is_authenticated() and app_current_dept() = t.dept_target)
$$;

-- Ticket write helper:
create or replace function app_can_write_ticket(t tickets)
returns boolean
language sql
stable
as $$
  select
    app_is_super_admin()
    or (app_is_director() = false and (
        -- creator/assignee can update
        t.created_by = auth.uid()
        or t.assigned_to = auth.uid()
        -- dept target can update/respond
        or (app_is_authenticated() and app_current_dept() = t.dept_target)
    ))
$$;

-- Invoice helper: finance full RW, director read all, sales scoped by customer ownership via leads
create or replace function app_can_read_invoice(i invoices)
returns boolean
language sql
stable
as $$
  select
    app_is_super_admin()
    or app_is_director()
    or app_is_role('finance')
    or (app_is_role('sales manager') and exists (
          select 1 from leads l
          where l.customer_id = i.customer_id
            and (
              l.sales_owner_user_id = auth.uid()
              or (l.sales_owner_user_id is not null and app_is_my_team_member(l.sales_owner_user_id))
            )
        ))
    or (app_is_role('salesperson') and exists (
          select 1 from leads l
          where l.customer_id = i.customer_id
            and l.sales_owner_user_id = auth.uid()
        ))
$$;

-- =========================================================
-- Enable RLS (Default deny) on sensitive tables
-- =========================================================
alter table roles enable row level security;
alter table departments enable row level security;
alter table profiles enable row level security;
alter table customers enable row level security;
alter table leads enable row level security;
alter table prospects enable row level security;
alter table prospect_stage_history enable row level security;
alter table sales_activities enable row level security;
alter table tickets enable row level security;
alter table ticket_messages enable row level security;
alter table ticket_attachments enable row level security;
alter table sla_events enable row level security;
alter table kpi_metric_definitions enable row level security;
alter table kpi_targets enable row level security;
alter table marketing_activity_events enable row level security;
alter table marketing_spend enable row level security;
alter table imports enable row level security;
alter table import_rows enable row level security;
alter table invoices enable row level security;
alter table payments enable row level security;
alter table saved_views enable row level security;
alter table audit_logs enable row level security;
alter table service_catalog enable row level security;

-- NOTE: id_sequences intentionally not under RLS because generator functions rely on it.
-- It contains only prefix counters, not business data.

-- =========================================================
-- ROLES & DEPARTMENTS (read-only to authenticated; write only super admin)
-- =========================================================
drop policy if exists roles_select_auth on roles;
create policy roles_select_auth
on roles for select
using (app_is_authenticated());

drop policy if exists roles_write_super on roles;
create policy roles_write_super
on roles for all
using (app_is_super_admin())
with check (app_is_super_admin());

drop policy if exists departments_select_auth on departments;
create policy departments_select_auth
on departments for select
using (app_is_authenticated());

drop policy if exists departments_write_super on departments;
create policy departments_write_super
on departments for all
using (app_is_super_admin())
with check (app_is_super_admin());

-- =========================================================
-- PROFILES (user management)
-- - super admin: full
-- - user: read self, update self (limited by app layer)
-- - Marketing Manager: manage marketing roles only
-- =========================================================
drop policy if exists profiles_select_self on profiles;
create policy profiles_select_self
on profiles for select
using (user_id = auth.uid());

drop policy if exists profiles_select_super_director on profiles;
create policy profiles_select_super_director
on profiles for select
using (app_is_super_admin() or app_is_director());

drop policy if exists profiles_insert_super on profiles;
create policy profiles_insert_super
on profiles for insert
with check (app_is_super_admin());

drop policy if exists profiles_update_super on profiles;
create policy profiles_update_super
on profiles for update
using (app_is_super_admin())
with check (app_is_super_admin());

drop policy if exists profiles_delete_super on profiles;
create policy profiles_delete_super
on profiles for delete
using (app_is_super_admin());

-- Marketing Manager can create/update marketing profiles only
drop policy if exists profiles_mm_insert_mkt on profiles;
create policy profiles_mm_insert_mkt
on profiles for insert
with check (
  app_is_role('Marketing Manager')
  and role_name = any(array[
    'Marketing Manager',
    'Marcomm (marketing staff)',
    'DGO (Marketing staff)',
    'MACX (marketing staff)',
    'VSDO (marketing staff)'
  ])
  and dept_code = 'MKT'::dept_code
);

drop policy if exists profiles_mm_update_mkt on profiles;
create policy profiles_mm_update_mkt
on profiles for update
using (
  app_is_role('Marketing Manager')
  and role_name = any(array[
    'Marketing Manager',
    'Marcomm (marketing staff)',
    'DGO (Marketing staff)',
    'MACX (marketing staff)',
    'VSDO (marketing staff)'
  ])
  and dept_code = 'MKT'::dept_code
)
with check (
  app_is_role('Marketing Manager')
  and role_name = any(array[
    'Marketing Manager',
    'Marcomm (marketing staff)',
    'DGO (Marketing staff)',
    'MACX (marketing staff)',
    'VSDO (marketing staff)'
  ])
  and dept_code = 'MKT'::dept_code
);

-- User can update their own profile basics (app layer should restrict fields; RLS allows self-update)
drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self
on profiles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- =========================================================
-- SERVICE CATALOG
-- - all authenticated can read
-- - super admin can write
-- =========================================================
drop policy if exists service_select_auth on service_catalog;
create policy service_select_auth
on service_catalog for select
using (app_is_authenticated());

drop policy if exists service_write_super on service_catalog;
create policy service_write_super
on service_catalog for all
using (app_is_super_admin())
with check (app_is_super_admin());

-- =========================================================
-- CUSTOMERS
-- - read: by helper (marketing, finance, sales scoped, director, super admin)
-- - write: super admin; marketing manager; sales manager/sales support; salesperson own via link (app layer)
-- =========================================================
drop policy if exists customers_select_scoped on customers;
create policy customers_select_scoped
on customers for select
using (app_can_read_customer(customers));

-- Insert customers:
drop policy if exists customers_insert_allowed on customers;
create policy customers_insert_allowed
on customers for insert
with check (
  app_is_super_admin()
  or app_is_role('Marketing Manager')
  or app_is_any_role(array['sales manager','sales support','salesperson'])
);

-- Update customers:
drop policy if exists customers_update_allowed on customers;
create policy customers_update_allowed
on customers for update
using (
  app_is_super_admin()
  or app_is_role('Marketing Manager')
  or app_is_any_role(array['sales manager','sales support'])
  or (app_is_role('salesperson') and exists (
        select 1 from leads l
        where l.customer_id = customers.customer_id
          and l.sales_owner_user_id = auth.uid()
      ))
)
with check (
  app_is_super_admin()
  or app_is_role('Marketing Manager')
  or app_is_any_role(array['sales manager','sales support'])
  or (app_is_role('salesperson') and exists (
        select 1 from leads l
        where l.customer_id = customers.customer_id
          and l.sales_owner_user_id = auth.uid()
      ))
);

-- Delete customers: super admin only (avoid accidental data loss)
drop policy if exists customers_delete_super on customers;
create policy customers_delete_super
on customers for delete
using (app_is_super_admin());

-- =========================================================
-- LEADS
-- - read: app_can_read_lead
-- - insert: marketing roles + sales roles
-- - update: creator OR owner OR manager/team rules
-- =========================================================
drop policy if exists leads_select_scoped on leads;
create policy leads_select_scoped
on leads for select
using (app_can_read_lead(leads));

drop policy if exists leads_insert_allowed on leads;
create policy leads_insert_allowed
on leads for insert
with check (
  app_is_super_admin()
  or app_is_marketing()
  or app_is_sales()
);

drop policy if exists leads_update_allowed on leads;
create policy leads_update_allowed
on leads for update
using (
  app_is_super_admin()
  or app_is_role('Marketing Manager')
  or leads.created_by = auth.uid()
  or (leads.sales_owner_user_id = auth.uid())
  or (app_is_role('sales manager') and leads.sales_owner_user_id is not null and app_is_my_team_member(leads.sales_owner_user_id))
  or app_is_role('sales support')
)
with check (
  app_is_super_admin()
  or app_is_role('Marketing Manager')
  or leads.created_by = auth.uid()
  or (leads.sales_owner_user_id = auth.uid())
  or (app_is_role('sales manager') and leads.sales_owner_user_id is not null and app_is_my_team_member(leads.sales_owner_user_id))
  or app_is_role('sales support')
);

drop policy if exists leads_delete_super on leads;
create policy leads_delete_super
on leads for delete
using (app_is_super_admin());

-- =========================================================
-- PROSPECTS + STAGE HISTORY
-- =========================================================
drop policy if exists prospects_select_scoped on prospects;
create policy prospects_select_scoped
on prospects for select
using (app_can_read_prospect(prospects));

drop policy if exists prospects_insert_allowed on prospects;
create policy prospects_insert_allowed
on prospects for insert
with check (
  app_is_super_admin()
  or app_is_role('Marketing Manager')
  or app_is_any_role(array['sales manager','sales support','salesperson'])
  or app_is_any_role(array[
      'Marcomm (marketing staff)',
      'DGO (Marketing staff)',
      'MACX (marketing staff)',
      'VSDO (marketing staff)'
    ])
);

drop policy if exists prospects_update_allowed on prospects;
create policy prospects_update_allowed
on prospects for update
using (
  app_is_super_admin()
  or (app_is_role('sales manager') and (owner_user_id = auth.uid() or app_is_my_team_member(owner_user_id)))
  or (app_is_role('salesperson') and owner_user_id = auth.uid())
  or app_is_role('sales support')
  or app_is_role('Marketing Manager')
)
with check (
  app_is_super_admin()
  or (app_is_role('sales manager') and (owner_user_id = auth.uid() or app_is_my_team_member(owner_user_id)))
  or (app_is_role('salesperson') and owner_user_id = auth.uid())
  or app_is_role('sales support')
  or app_is_role('Marketing Manager')
);

drop policy if exists prospects_delete_super on prospects;
create policy prospects_delete_super
on prospects for delete
using (app_is_super_admin());

-- Stage history: read if can read prospect; insert if can update prospect
drop policy if exists stage_hist_select_scoped on prospect_stage_history;
create policy stage_hist_select_scoped
on prospect_stage_history for select
using (
  exists (select 1 from prospects p where p.prospect_id = prospect_stage_history.prospect_id and app_can_read_prospect(p))
);

drop policy if exists stage_hist_insert_allowed on prospect_stage_history;
create policy stage_hist_insert_allowed
on prospect_stage_history for insert
with check (
  exists (select 1 from prospects p where p.prospect_id = prospect_stage_history.prospect_id and (
    app_is_super_admin()
    or (app_is_role('sales manager') and (p.owner_user_id = auth.uid() or app_is_my_team_member(p.owner_user_id)))
    or (app_is_role('salesperson') and p.owner_user_id = auth.uid())
    or app_is_role('sales support')
    or app_is_role('Marketing Manager')
  ))
);

-- =========================================================
-- SALES ACTIVITIES
-- - read: if can read prospect
-- - insert: owner roles; visit requires photo+gps (enforced by app + validator; RLS cannot validate file existence)
-- =========================================================
drop policy if exists sales_activities_select_scoped on sales_activities;
create policy sales_activities_select_scoped
on sales_activities for select
using (
  exists (select 1 from prospects p where p.prospect_id = sales_activities.prospect_id and app_can_read_prospect(p))
);

drop policy if exists sales_activities_insert_allowed on sales_activities;
create policy sales_activities_insert_allowed
on sales_activities for insert
with check (
  app_is_super_admin()
  or sales_activities.created_by = auth.uid()
);

drop policy if exists sales_activities_update_super on sales_activities;
create policy sales_activities_update_super
on sales_activities for update
using (app_is_super_admin())
with check (app_is_super_admin());

drop policy if exists sales_activities_delete_super on sales_activities;
create policy sales_activities_delete_super
on sales_activities for delete
using (app_is_super_admin());

-- =========================================================
-- TICKETS + MESSAGES + ATTACHMENTS + SLA
-- =========================================================
drop policy if exists tickets_select_scoped on tickets;
create policy tickets_select_scoped
on tickets for select
using (app_can_read_ticket(tickets));

drop policy if exists tickets_insert_allowed on tickets;
create policy tickets_insert_allowed
on tickets for insert
with check (
  app_is_super_admin()
  or (app_is_director() = false and app_is_authenticated())
);

drop policy if exists tickets_update_allowed on tickets;
create policy tickets_update_allowed
on tickets for update
using (app_can_write_ticket(tickets))
with check (app_can_write_ticket(tickets));

drop policy if exists tickets_delete_super on tickets;
create policy tickets_delete_super
on tickets for delete
using (app_is_super_admin());

-- ticket_messages
drop policy if exists ticket_messages_select_scoped on ticket_messages;
create policy ticket_messages_select_scoped
on ticket_messages for select
using (
  exists (select 1 from tickets t where t.ticket_id = ticket_messages.ticket_id and app_can_read_ticket(t))
);

drop policy if exists ticket_messages_insert_allowed on ticket_messages;
create policy ticket_messages_insert_allowed
on ticket_messages for insert
with check (
  exists (select 1 from tickets t where t.ticket_id = ticket_messages.ticket_id and app_can_write_ticket(t))
  and ticket_messages.created_by = auth.uid()
);

drop policy if exists ticket_messages_delete_super on ticket_messages;
create policy ticket_messages_delete_super
on ticket_messages for delete
using (app_is_super_admin());

-- ticket_attachments
drop policy if exists ticket_attachments_select_scoped on ticket_attachments;
create policy ticket_attachments_select_scoped
on ticket_attachments for select
using (
  exists (select 1 from tickets t where t.ticket_id = ticket_attachments.ticket_id and app_can_read_ticket(t))
);

drop policy if exists ticket_attachments_insert_allowed on ticket_attachments;
create policy ticket_attachments_insert_allowed
on ticket_attachments for insert
with check (
  exists (select 1 from tickets t where t.ticket_id = ticket_attachments.ticket_id and app_can_write_ticket(t))
  and ticket_attachments.uploaded_by = auth.uid()
);

drop policy if exists ticket_attachments_delete_super on ticket_attachments;
create policy ticket_attachments_delete_super
on ticket_attachments for delete
using (app_is_super_admin());

-- sla_events
drop policy if exists sla_events_select_scoped on sla_events;
create policy sla_events_select_scoped
on sla_events for select
using (
  exists (select 1 from tickets t where t.ticket_id = sla_events.ticket_id and app_can_read_ticket(t))
);

drop policy if exists sla_events_insert_allowed on sla_events;
create policy sla_events_insert_allowed
on sla_events for insert
with check (
  exists (select 1 from tickets t where t.ticket_id = sla_events.ticket_id and app_can_write_ticket(t))
);

drop policy if exists sla_events_delete_super on sla_events;
create policy sla_events_delete_super
on sla_events for delete
using (app_is_super_admin());

-- =========================================================
-- KPI TABLES
-- - metric definitions: read all authenticated, write super admin
-- - targets: assignee can read; managers can read team; Marketing Manager can read marketing team; director read all; super admin full
-- =========================================================
drop policy if exists kpi_defs_select_auth on kpi_metric_definitions;
create policy kpi_defs_select_auth
on kpi_metric_definitions for select
using (app_is_authenticated());

drop policy if exists kpi_defs_write_super on kpi_metric_definitions;
create policy kpi_defs_write_super
on kpi_metric_definitions for all
using (app_is_super_admin())
with check (app_is_super_admin());

drop policy if exists kpi_targets_select_scoped on kpi_targets;
create policy kpi_targets_select_scoped
on kpi_targets for select
using (
  app_is_super_admin()
  or app_is_director()
  or (kpi_targets.assignee_user_id = auth.uid())
  or (app_is_role('sales manager') and kpi_targets.assignee_user_id is not null and app_is_my_team_member(kpi_targets.assignee_user_id))
  or (app_is_role('Marketing Manager') and kpi_targets.assignee_user_id is not null and exists (
        select 1 from profiles p
        where p.user_id = kpi_targets.assignee_user_id
          and p.role_name = any(array[
            'Marketing Manager',
            'Marcomm (marketing staff)',
            'DGO (Marketing staff)',
            'MACX (marketing staff)',
            'VSDO (marketing staff)'
          ])
  ))
);

drop policy if exists kpi_targets_insert_manager on kpi_targets;
create policy kpi_targets_insert_manager
on kpi_targets for insert
with check (
  app_is_super_admin()
  or app_is_role('sales manager')
  or app_is_role('Marketing Manager')
);

drop policy if exists kpi_targets_update_manager on kpi_targets;
create policy kpi_targets_update_manager
on kpi_targets for update
using (app_is_super_admin() or app_is_role('sales manager') or app_is_role('Marketing Manager'))
with check (app_is_super_admin() or app_is_role('sales manager') or app_is_role('Marketing Manager'));

drop policy if exists kpi_targets_delete_super on kpi_targets;
create policy kpi_targets_delete_super
on kpi_targets for delete
using (app_is_super_admin());

-- =========================================================
-- MARKETING MANUAL INPUT (activity/spend)
-- - marketing roles + marketing manager: RW own rows
-- - super admin RW all
-- - director read (optional) -> allow select for director for performance only
-- =========================================================
drop policy if exists mkt_activity_select_allowed on marketing_activity_events;
create policy mkt_activity_select_allowed
on marketing_activity_events for select
using (
  app_is_super_admin()
  or app_is_director()
  or app_is_marketing()
);

drop policy if exists mkt_activity_insert_allowed on marketing_activity_events;
create policy mkt_activity_insert_allowed
on marketing_activity_events for insert
with check (
  app_is_super_admin()
  or (app_is_marketing() and created_by = auth.uid())
);

drop policy if exists mkt_activity_update_allowed on marketing_activity_events;
create policy mkt_activity_update_allowed
on marketing_activity_events for update
using (
  app_is_super_admin()
  or (app_is_marketing() and created_by = auth.uid())
)
with check (
  app_is_super_admin()
  or (app_is_marketing() and created_by = auth.uid())
);

drop policy if exists mkt_activity_delete_allowed on marketing_activity_events;
create policy mkt_activity_delete_allowed
on marketing_activity_events for delete
using (
  app_is_super_admin()
  or (app_is_marketing() and created_by = auth.uid())
);

drop policy if exists mkt_spend_select_allowed on marketing_spend;
create policy mkt_spend_select_allowed
on marketing_spend for select
using (
  app_is_super_admin()
  or app_is_director()
  or app_is_marketing()
);

drop policy if exists mkt_spend_insert_allowed on marketing_spend;
create policy mkt_spend_insert_allowed
on marketing_spend for insert
with check (
  app_is_super_admin()
  or (app_is_marketing() and created_by = auth.uid())
);

drop policy if exists mkt_spend_update_allowed on marketing_spend;
create policy mkt_spend_update_allowed
on marketing_spend for update
using (
  app_is_super_admin()
  or (app_is_marketing() and created_by = auth.uid())
)
with check (
  app_is_super_admin()
  or (app_is_marketing() and created_by = auth.uid())
);

drop policy if exists mkt_spend_delete_allowed on marketing_spend;
create policy mkt_spend_delete_allowed
on marketing_spend for delete
using (
  app_is_super_admin()
  or (app_is_marketing() and created_by = auth.uid())
);

-- =========================================================
-- IMPORTS
-- - uploader RW their imports
-- - Marketing Manager + sales support + super admin can read (for ops support)
-- =========================================================
drop policy if exists imports_select_allowed on imports;
create policy imports_select_allowed
on imports for select
using (
  app_is_super_admin()
  or imports.uploaded_by = auth.uid()
  or app_is_role('Marketing Manager')
  or app_is_role('sales support')
);

drop policy if exists imports_insert_allowed on imports;
create policy imports_insert_allowed
on imports for insert
with check (
  app_is_super_admin()
  or imports.uploaded_by = auth.uid()
);

drop policy if exists imports_update_allowed on imports;
create policy imports_update_allowed
on imports for update
using (
  app_is_super_admin()
  or imports.uploaded_by = auth.uid()
  or app_is_role('Marketing Manager')
  or app_is_role('sales support')
)
with check (
  app_is_super_admin()
  or imports.uploaded_by = auth.uid()
  or app_is_role('Marketing Manager')
  or app_is_role('sales support')
);

drop policy if exists imports_delete_super on imports;
create policy imports_delete_super
on imports for delete
using (app_is_super_admin());

-- import_rows follow import_id visibility
drop policy if exists import_rows_select_allowed on import_rows;
create policy import_rows_select_allowed
on import_rows for select
using (
  exists (
    select 1
    from imports i
    where i.import_id = import_rows.import_id
      and (
        app_is_super_admin()
        or i.uploaded_by = auth.uid()
        or app_is_role('Marketing Manager')
        or app_is_role('sales support')
      )
  )
);

drop policy if exists import_rows_insert_allowed on import_rows;
create policy import_rows_insert_allowed
on import_rows for insert
with check (
  exists (
    select 1
    from imports i
    where i.import_id = import_rows.import_id
      and (
        app_is_super_admin()
        or i.uploaded_by = auth.uid()
        or app_is_role('Marketing Manager')
        or app_is_role('sales support')
      )
  )
);

drop policy if exists import_rows_delete_super on import_rows;
create policy import_rows_delete_super
on import_rows for delete
using (app_is_super_admin());

-- =========================================================
-- INVOICES & PAYMENTS (DSO)
-- =========================================================
drop policy if exists invoices_select_scoped on invoices;
create policy invoices_select_scoped
on invoices for select
using (app_can_read_invoice(invoices));

drop policy if exists invoices_insert_finance on invoices;
create policy invoices_insert_finance
on invoices for insert
with check (app_is_super_admin() or app_is_role('finance'));

drop policy if exists invoices_update_finance on invoices;
create policy invoices_update_finance
on invoices for update
using (app_is_super_admin() or app_is_role('finance'))
with check (app_is_super_admin() or app_is_role('finance'));

drop policy if exists invoices_delete_super on invoices;
create policy invoices_delete_super
on invoices for delete
using (app_is_super_admin());

-- payments follow invoice visibility; write finance
drop policy if exists payments_select_scoped on payments;
create policy payments_select_scoped
on payments for select
using (
  exists (select 1 from invoices i where i.invoice_id = payments.invoice_id and app_can_read_invoice(i))
);

drop policy if exists payments_insert_finance on payments;
create policy payments_insert_finance
on payments for insert
with check (
  app_is_super_admin()
  or app_is_role('finance')
);

drop policy if exists payments_update_finance on payments;
create policy payments_update_finance
on payments for update
using (app_is_super_admin() or app_is_role('finance'))
with check (app_is_super_admin() or app_is_role('finance'));

drop policy if exists payments_delete_super on payments;
create policy payments_delete_super
on payments for delete
using (app_is_super_admin());

-- =========================================================
-- SAVED VIEWS
-- - per-user ownership
-- - super admin can read all (optional), director no need
-- =========================================================
drop policy if exists saved_views_select_own on saved_views;
create policy saved_views_select_own
on saved_views for select
using (
  app_is_super_admin()
  or created_by = auth.uid()
);

drop policy if exists saved_views_insert_own on saved_views;
create policy saved_views_insert_own
on saved_views for insert
with check (
  created_by = auth.uid()
);

drop policy if exists saved_views_update_own on saved_views;
create policy saved_views_update_own
on saved_views for update
using (
  app_is_super_admin()
  or created_by = auth.uid()
)
with check (
  app_is_super_admin()
  or created_by = auth.uid()
);

drop policy if exists saved_views_delete_own on saved_views;
create policy saved_views_delete_own
on saved_views for delete
using (
  app_is_super_admin()
  or created_by = auth.uid()
);

-- =========================================================
-- AUDIT LOGS
-- - super admin read
-- - write: allow inserts by authenticated (via proxy/BFF) BUT strongly prefer server-side inserts
-- =========================================================
drop policy if exists audit_select_super on audit_logs;
create policy audit_select_super
on audit_logs for select
using (app_is_super_admin());

drop policy if exists audit_insert_auth on audit_logs;
create policy audit_insert_auth
on audit_logs for insert
with check (app_is_authenticated() and changed_by = auth.uid());

drop policy if exists audit_delete_super on audit_logs;
create policy audit_delete_super
on audit_logs for delete
using (app_is_super_admin());

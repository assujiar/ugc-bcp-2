-- supabase/migrations/04_tests.sql
-- RLS Tests + Smoke SQL
-- WARNING: Run in a test project or controlled environment.

create or replace function test_set_auth(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text,
    true
  );
end $$;

create or replace function test_clear_auth()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
end $$;

do $$
declare
  u_super uuid := '00000000-0000-0000-0000-000000000005';
  u_dir   uuid := '00000000-0000-0000-0000-000000000001';
  u_mm    uuid := '00000000-0000-0000-0000-000000000002';
  u_sm    uuid := '00000000-0000-0000-0000-000000000003';
  u_fin   uuid := '00000000-0000-0000-0000-000000000004';

  u_mkt_staff uuid := '00000000-0000-0000-0000-000000000006';
  u_salesperson_a uuid := '00000000-0000-0000-0000-000000000007';
  u_salesperson_b uuid := '00000000-0000-0000-0000-000000000008';
begin
  insert into profiles(user_id, user_code, full_name, role_name, dept_code)
  select u_mkt_staff, 'MKT010126003', 'MKT Staff A', 'Marcomm (marketing staff)', 'MKT'
  where exists (select 1 from auth.users where id = u_mkt_staff)
  on conflict do nothing;

  insert into profiles(user_id, user_code, full_name, role_name, dept_code, manager_user_id)
  select u_salesperson_a, 'SAL010126002', 'Sales A', 'salesperson', 'SAL', u_sm
  where exists (select 1 from auth.users where id = u_salesperson_a)
  on conflict do nothing;

  insert into profiles(user_id, user_code, full_name, role_name, dept_code, manager_user_id)
  select u_salesperson_b, 'SAL010126003', 'Sales B', 'salesperson', 'SAL', u_sm
  where exists (select 1 from auth.users where id = u_salesperson_b)
  on conflict do nothing;

exception when others then
  null;
end $$;

-- TEST 1: Marketing staff can only see leads they created
do $$
declare
  u_mkt_staff uuid := '00000000-0000-0000-0000-000000000006';
  lead_a text;
  lead_b text;
begin
  if not exists (select 1 from auth.users where id = u_mkt_staff) then
    raise notice 'SKIP TEST 1: auth.users fixture not found for marketing staff';
    return;
  end if;

  perform test_set_auth(u_mkt_staff);

  insert into customers(customer_id, company_name, pic_name, pic_phone, pic_email)
  values (next_prefixed_id('CUST', current_date), 'TEST CO MKT', 'PIC', '0812', 'pic@test.com')
  returning customer_id into strict lead_a;

  insert into leads(lead_id, lead_date, company_name, pic_name, contact_phone, email, city_area,
                    service_code, route, est_volume_value, est_volume_unit, timeline,
                    sourced_by, primary_channel, sales_owner_user_id, status, next_step, due_date, created_by)
  values (
    next_prefixed_id('LEADMKT', current_date),
    current_date,
    'TEST CO MKT',
    'PIC',
    '0812',
    'pic@test.com',
    'JKT',
    'DOM_LTL',
    'JKT -> BDG',
    10,
    'kg',
    'Immediate',
    'Marketing',
    'LinkedIn',
    null,
    'New',
    'Call',
    current_date + 1,
    auth.uid()
  ) returning lead_id into lead_a;

  perform test_set_auth('00000000-0000-0000-0000-000000000005'::uuid);
  insert into leads(lead_id, lead_date, company_name, pic_name, contact_phone, email, city_area,
                    service_code, route, est_volume_value, est_volume_unit, timeline,
                    sourced_by, primary_channel, sales_owner_user_id, status, next_step, due_date, created_by)
  values (
    next_prefixed_id('LEADMKT', current_date),
    current_date,
    'TEST CO OTHER',
    'PIC2',
    '0813',
    'pic2@test.com',
    'JKT',
    'DOM_FTL',
    'JKT -> SBY',
    1,
    'shipment',
    'Unknown',
    'Marketing',
    'Website (Direct/Referral)',
    null,
    'New',
    'Email',
    current_date + 2,
    auth.uid()
  ) returning lead_id into lead_b;

  perform test_set_auth(u_mkt_staff);

  if not exists (select 1 from leads where lead_id = lead_a) then
    raise exception 'TEST 1 FAIL: marketing staff cannot see own lead';
  end if;

  if exists (select 1 from leads where lead_id = lead_b) then
    raise exception 'TEST 1 FAIL: marketing staff can see other user lead';
  end if;

  raise notice 'TEST 1 PASS';
exception when others then
  raise exception 'TEST 1 ERROR: %', sqlerrm;
end $$;

-- TEST 4: Masking view correctness (v_ops_rfqs_masked)
do $$
declare
  u_ops uuid := '00000000-0000-0000-0000-000000000009';
  cust text;
  rfq text;
begin
  if exists (select 1 from auth.users where id = u_ops) then
    insert into profiles(user_id, user_code, full_name, role_name, dept_code)
    values (u_ops, 'EXI010126001', 'Ops EXI Seed', 'EXIM Ops (operation)', 'EXI')
    on conflict do nothing;
  else
    raise notice 'SKIP TEST 4: ops auth fixture not found';
    return;
  end if;

  if not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-000000000005'::uuid) then
    raise notice 'SKIP TEST 4: super admin auth fixture not found';
    return;
  end if;

  perform test_set_auth('00000000-0000-0000-0000-000000000005'::uuid);

  insert into customers(customer_id, company_name, pic_name, pic_phone, pic_email)
  values (next_prefixed_id('CUST', current_date), 'SENSITIVE CUSTOMER', 'PIC', '0820', 's@test.com')
  returning customer_id into cust;

  insert into tickets(ticket_id, ticket_type, inquiry_status, dept_target, created_by,
                      related_customer_id, subject, description, need_customer_masking, service_code)
  values (
    null,
    'inquiry tariff',
    'OPEN',
    'EXI',
    auth.uid(),
    cust,
    'RFQ masked test',
    'Test masking',
    true,
    'EXI_AF'
  )
  returning ticket_id into rfq;

  perform test_set_auth(u_ops);

  if not exists (
    select 1
    from v_ops_rfqs_masked v
    where v.ticket_id = rfq
      and v.customer_company_name = 'MASKED'
      and v.is_masked = true
  ) then
    raise exception 'TEST 4 FAIL: masking view does not mask as expected';
  end if;

  raise notice 'TEST 4 PASS';

exception when others then
  raise exception 'TEST 4 ERROR: %', sqlerrm;
end $$;

select test_clear_auth();

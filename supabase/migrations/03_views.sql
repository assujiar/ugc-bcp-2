-- supabase/migrations/03_views.sql
-- Masking views + reporting/aggregation views

-- =========================================================
-- 1) OPS MASKING VIEW FOR RFQ (inquiry tariff)
-- Rule:
-- - Untuk RFQ yang berasal dari lead/funnel tertentu, Ops tidak boleh lihat customer_name/PII.
-- - Kita gunakan tickets.need_customer_masking boolean sebagai gate (set true saat RFQ auto-created dari lead).
-- - Selain itu, untuk safety, bila related_lead_id not null => masking true.
-- =========================================================

create or replace view v_ops_rfqs_masked as
select
  t.ticket_id,
  t.ticket_type,
  t.inquiry_status,
  t.dept_target,
  t.created_by,
  t.assigned_to,
  t.related_lead_id,
  t.related_customer_id,
  t.subject,
  t.description,
  t.service_code,
  t.created_at,
  t.closed_at,

  -- Masking flags
  case
    when t.need_customer_masking = true or t.related_lead_id is not null then true
    else false
  end as is_masked,

  -- Customer fields masked
  case
    when t.need_customer_masking = true or t.related_lead_id is not null then 'MASKED'
    else c.company_name
  end as customer_company_name,

  -- Optionally mask PIC contacts (always masked for Ops in RFQ view)
  'MASKED'::text as customer_pic_name,
  'MASKED'::text as customer_pic_phone,
  'MASKED'::text as customer_pic_email

from tickets t
left join customers c on c.customer_id = t.related_customer_id
where t.ticket_type = 'inquiry tariff';

-- =========================================================
-- 2) RESPONSE TIME METRICS VIEW
-- We compute first response time based on:
-- - first message after ticket creation by ANY user != ticket.created_by
-- =========================================================

create or replace view v_ticket_first_response as
select
  t.ticket_id,
  t.ticket_type,
  t.dept_target,
  t.created_by,
  t.assigned_to,
  t.created_at as ticket_created_at,
  min(m.created_at) filter (where m.created_by <> t.created_by) as first_response_at,
  extract(epoch from (min(m.created_at) filter (where m.created_by <> t.created_by) - t.created_at))/60.0 as first_response_minutes
from tickets t
left join ticket_messages m on m.ticket_id = t.ticket_id
group by
  t.ticket_id, t.ticket_type, t.dept_target, t.created_by, t.assigned_to, t.created_at;

create or replace view v_ticket_first_response_median_daily as
select
  date_trunc('day', ticket_created_at)::date as day,
  ticket_type,
  dept_target,
  percentile_cont(0.5) within group (order by first_response_minutes) as median_first_response_minutes,
  count(*) as ticket_count
from v_ticket_first_response
where first_response_minutes is not null
group by 1,2,3;

-- =========================================================
-- 3) KPI Ã¢â‚¬â€ SALES AGGREGATIONS
-- Win rate / cycle length: NA (needs deal table)
-- =========================================================

create or replace view v_sales_revenue_daily as
select
  invoice_date as day,
  sum(invoice_amount) as revenue_idr,
  count(distinct customer_id) as active_customers
from invoices
group by invoice_date;

create or replace view v_sales_new_logos_daily as
with first_txn as (
  select customer_id, min(invoice_date) as first_invoice_date
  from invoices
  group by customer_id
)
select
  f.first_invoice_date as day,
  count(*) as new_logos
from first_txn f
group by f.first_invoice_date;

create or replace view v_sales_activities_daily as
select
  date_trunc('day', created_at)::date as day,
  created_by as user_id,
  activity_type,
  count(*) as activity_count
from sales_activities
group by 1,2,3;

-- =========================================================
-- 4) KPI Ã¢â‚¬â€ MARKETING LEADS BY CHANNEL
-- =========================================================
create or replace view v_marketing_leads_by_channel_daily as
select
  lead_date as day,
  primary_channel,
  count(*) as leads_count
from leads
group by lead_date, primary_channel;

-- =========================================================
-- 5) MARKETING SPEND DAILY + CPL
-- =========================================================
create or replace view v_marketing_spend_daily as
select
  spend_date as day,
  channel as primary_channel,
  sum(amount) as spend_idr
from marketing_spend
group by spend_date, channel;

create or replace view v_marketing_cpl_daily as
select
  s.day,
  s.primary_channel,
  s.spend_idr,
  coalesce(l.leads_count, 0) as leads_count,
  case when coalesce(l.leads_count, 0) = 0 then null else (s.spend_idr / l.leads_count) end as cpl_idr
from v_marketing_spend_daily s
left join v_marketing_leads_by_channel_daily l
  on l.day = s.day and l.primary_channel = s.primary_channel;

-- =========================================================
-- 6) DSO / AR AGING VIEWS
-- =========================================================

create or replace view v_invoice_outstanding as
select
  i.invoice_id,
  i.customer_id,
  i.invoice_date,
  i.due_date,
  i.invoice_amount,
  coalesce(sum(p.amount), 0) as paid_amount,
  (i.invoice_amount - coalesce(sum(p.amount), 0)) as outstanding_amount,
  (case when i.due_date < current_date and (i.invoice_amount - coalesce(sum(p.amount), 0)) > 0 then true else false end) as is_overdue,
  greatest((current_date - i.due_date), 0) as days_past_due
from invoices i
left join payments p on p.invoice_id = i.invoice_id
group by i.invoice_id, i.customer_id, i.invoice_date, i.due_date, i.invoice_amount;

create or replace view v_ar_aging as
select
  customer_id,
  sum(case when outstanding_amount > 0 then outstanding_amount else 0 end) as ar_total,
  sum(case when is_overdue and days_past_due between 1 and 30 then outstanding_amount else 0 end) as bucket_1_30,
  sum(case when is_overdue and days_past_due between 31 and 60 then outstanding_amount else 0 end) as bucket_31_60,
  sum(case when is_overdue and days_past_due between 61 and 90 then outstanding_amount else 0 end) as bucket_61_90,
  sum(case when is_overdue and days_past_due > 90 then outstanding_amount else 0 end) as bucket_90_plus
from v_invoice_outstanding
group by customer_id;

create or replace view v_dso_rolling_30 as
with rev as (
  select sum(invoice_amount) as revenue_30
  from invoices
  where invoice_date >= current_date - 30
),
ar as (
  select sum(outstanding_amount) as ar_outstanding
  from v_invoice_outstanding
)
select
  current_date as as_of_date,
  ar.ar_outstanding,
  rev.revenue_30,
  case when rev.revenue_30 = 0 then null else (ar.ar_outstanding / rev.revenue_30) * 30 end as dso_days_rolling_30
from ar, rev;

create or replace view v_my_customers_ar as
select
  c.customer_id,
  c.company_name,
  a.ar_total,
  a.bucket_1_30,
  a.bucket_31_60,
  a.bucket_61_90,
  a.bucket_90_plus
from customers c
join v_ar_aging a on a.customer_id = c.customer_id;

-- Notes:
-- - Sales Win Rate, Sales Cycle Length require deal/close dates not present. NA.
-- - Lead scoring coverage requires lead_score field/rules not present. NA.

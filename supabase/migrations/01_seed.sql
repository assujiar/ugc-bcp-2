-- supabase/migrations/01_seed.sql
-- Seed data (roles 15 fixed, departments, service catalog, KPI metric defs, minimal profiles conditional)

-- =========================
-- ROLES (15 FIX Ã¢â‚¬â€ exact match)
-- =========================
insert into roles(role_name) values
  ('Director'),
  ('super admin'),
  ('Marketing Manager'),
  ('Marcomm (marketing staff)'),
  ('DGO (Marketing staff)'),
  ('MACX (marketing staff)'),
  ('VSDO (marketing staff)'),
  ('sales manager'),
  ('salesperson'),
  ('sales support'),
  ('EXIM Ops (operation)'),
  ('domestics Ops (operation)'),
  ('Import DTD Ops (operation)'),
  ('traffic & warehous (operation)'),
  ('finance')
on conflict do nothing;

-- =========================
-- DEPARTMENTS (codes FIX)
-- =========================
insert into departments(dept_code, dept_name) values
  ('MKT','marketing'),
  ('SAL','sales'),
  ('DOM','Domestics Ops'),
  ('EXI','EXIM Ops'),
  ('DTD','Import DTD Ops'),
  ('FIN','finance'),
  ('TRF','warehouse & traffic'),
  ('DIR','director')
on conflict do nothing;

-- =========================
-- SERVICE CATALOG (DB MASTER)
-- Based on PRODUCT OWNER MAPPING (FIX)
-- Domestics: LTL, FTL (charter), LCL, FCL, AF, WAREHOUSE & FULFILLMENT
-- EXIM: LCL Export, LCL Import, FCL Export, FCL Import, AF, Customs clearance
-- Import DTD: LCL, FCL, AF
-- Warehouse & Traffic: warehouse & fulfillment, request pickup, request delivery
-- =========================

-- Domestics (owner_dept = DOM)
insert into service_catalog(service_code, service_name, owner_dept, scope_group) values
  ('DOM_LTL', 'LTL', 'DOM', 'Domestics'),
  ('DOM_FTL', 'FTL (charter)', 'DOM', 'Domestics'),
  ('DOM_LCL', 'LCL', 'DOM', 'Domestics'),
  ('DOM_FCL', 'FCL', 'DOM', 'Domestics'),
  ('DOM_AF',  'AF',  'DOM', 'Domestics'),
  ('DOM_WHF', 'WAREHOUSE & FULFILLMENT', 'DOM', 'Domestics')
on conflict do nothing;

-- EXIM (owner_dept = EXI)
insert into service_catalog(service_code, service_name, owner_dept, scope_group) values
  ('EXI_LCL_EXPORT', 'LCL Export', 'EXI', 'EXIM'),
  ('EXI_LCL_IMPORT', 'LCL Import', 'EXI', 'EXIM'),
  ('EXI_FCL_EXPORT', 'FCL Export', 'EXI', 'EXIM'),
  ('EXI_FCL_IMPORT', 'FCL Import', 'EXI', 'EXIM'),
  ('EXI_AF',         'AF',         'EXI', 'EXIM'),
  ('EXI_CUSTOMS',    'Customs clearance', 'EXI', 'EXIM')
on conflict do nothing;

-- Import DTD (owner_dept = DTD)
insert into service_catalog(service_code, service_name, owner_dept, scope_group) values
  ('DTD_LCL', 'LCL', 'DTD', 'Import DTD'),
  ('DTD_FCL', 'FCL', 'DTD', 'Import DTD'),
  ('DTD_AF',  'AF',  'DTD', 'Import DTD')
on conflict do nothing;

-- Warehouse & Traffic (owner_dept = TRF)
insert into service_catalog(service_code, service_name, owner_dept, scope_group) values
  ('TRF_WHF',   'warehouse & fulfillment', 'TRF', 'Warehouse & Traffic'),
  ('TRF_REQPU', 'request pickup',          'TRF', 'Warehouse & Traffic'),
  ('TRF_REQDVR','request delivery',        'TRF', 'Warehouse & Traffic')
on conflict do nothing;

-- =========================
-- KPI METRIC DEFINITIONS (CANONICAL)
-- calc_method: AUTO / MANUAL / IMPORTED
-- =========================

-- ---------
-- SALES KPI
-- ---------
insert into kpi_metric_definitions(metric_key, owner_role, unit, calc_method, direction, description) values
  ('SALES_REVENUE', 'sales manager', 'IDR', 'AUTO', 'HIGHER_BETTER', 'ÃŽÂ£ invoices.invoice_amount by invoice_date in period'),
  ('SALES_REVENUE_GROWTH_PCT', 'sales manager', '%', 'AUTO', 'HIGHER_BETTER', '(Rev_t - Rev_t-1)/Rev_t-1'),

  ('SALES_NEW_LOGOS', 'sales manager', 'count', 'AUTO', 'HIGHER_BETTER', '# customers first transaction in period; new if first txn within last 3 months'),
  ('SALES_NEW_LOGOS_GROWTH_PCT', 'sales manager', '%', 'AUTO', 'HIGHER_BETTER', 'Growth% New Logos period over period'),

  ('SALES_ACTIVE_CUSTOMERS', 'sales manager', 'count', 'AUTO', 'HIGHER_BETTER', '# customers with transaction in period'),

  ('SALES_RETENTION_RATE', 'sales manager', '%', 'AUTO', 'HIGHER_BETTER', '(# active in t and active in t-1)/(# active in t-1)'),
  ('SALES_CHURN_RATE', 'sales manager', '%', 'AUTO', 'LOWER_BETTER', '1 - retention'),

  ('SALES_WIN_RATE', 'sales manager', '%', 'AUTO', 'HIGHER_BETTER', '# Close Won / (# Won + # Lost), exclude hanging'),

  ('SALES_CYCLE_DAYS', 'sales manager', 'days', 'AUTO', 'LOWER_BETTER', 'avg(close_date - qualified_date) over won deals'),

  ('SALES_INQUIRY_FIRST_RESPONSE_MEDIAN_MIN', 'sales manager', 'minutes', 'AUTO', 'LOWER_BETTER', 'median inquiry ticket first response time'),

  ('SALES_DSO_DAYS', 'sales manager', 'days', 'AUTO', 'LOWER_BETTER', '(AR/Revenue)*#days'),
  ('SALES_OVERDUE_AR', 'sales manager', 'IDR', 'AUTO', 'LOWER_BETTER', 'sum overdue receivables'),

  ('SALES_LEADS_ASSIGNED', 'sales manager', 'count', 'AUTO', 'HIGHER_BETTER', 'count leads where sales_owner assigned in period'),
  ('SALES_LEADS_ACCEPTED', 'sales manager', 'count', 'AUTO', 'HIGHER_BETTER', 'accepted leads with initial action'),
  ('SALES_LAR', 'sales manager', '%', 'AUTO', 'HIGHER_BETTER', 'accepted/assigned'),

  ('SALES_LEADS_CREATED_OUTBOUND', 'sales manager', 'count', 'AUTO', 'HIGHER_BETTER', 'leads sourced_by=Sales and primary_channel=Sales Outbound'),

  ('SALES_FIRST_CONTACT_RATE', 'sales manager', '%', 'AUTO', 'HIGHER_BETTER', 'leads contacted / assigned'),
  ('SALES_ASSIGNED_TO_FIRST_RESPONSE_MEDIAN_MIN', 'sales manager', 'minutes', 'AUTO', 'LOWER_BETTER', 'median assigned->first response'),

  ('SALES_ACTIVITY_VISIT', 'salesperson', 'count', 'AUTO', 'HIGHER_BETTER', '# Visit activities logged (visit requires photo+gps)'),
  ('SALES_ACTIVITY_CALL', 'salesperson', 'count', 'AUTO', 'HIGHER_BETTER', '# Call activities logged'),
  ('SALES_ACTIVITY_ONLINE_MEETING', 'salesperson', 'count', 'AUTO', 'HIGHER_BETTER', '# Online meeting activities logged'),
  ('SALES_ACTIVITY_EMAIL', 'salesperson', 'count', 'AUTO', 'HIGHER_BETTER', '# Email activities logged'),
  ('SALES_ACTIVITY_WA_OUTBOUND', 'salesperson', 'count', 'AUTO', 'HIGHER_BETTER', '# WhatsApp/chat outbound logged')
on conflict (metric_key) do nothing;

-- -------------------
-- MARKETING KPI (by role ownership)
-- -------------------
insert into kpi_metric_definitions(metric_key, owner_role, unit, calc_method, direction, description) values
  ('MKT_LEADS_BY_CHANNEL', 'Marketing Manager', 'count', 'AUTO', 'HIGHER_BETTER', 'Auto-calc from leads.primary_channel in period'),
  ('MKT_REVENUE_ATTRIBUTED', 'Marketing Manager', 'IDR', 'AUTO', 'HIGHER_BETTER', 'Revenue attribution join invoice->customer->lead mapping'),
  ('MKT_ATTRIBUTION_COMPLETENESS_PCT', 'MACX (marketing staff)', '%', 'AUTO', 'HIGHER_BETTER', '% leads with valid source/medium/campaign'),
  ('MKT_DEDUP_ACCURACY_PCT', 'MACX (marketing staff)', '%', 'MANUAL', 'HIGHER_BETTER', 'Manual audit sampling result'),
  ('MKT_TRACKING_COVERAGE_PCT', 'MACX (marketing staff)', '%', 'MANUAL', 'HIGHER_BETTER', 'Manual checklist result'),
  ('MKT_REPORTING_FRESHNESS_SLA_PCT', 'MACX (marketing staff)', '%', 'AUTO', 'HIGHER_BETTER', 'Derived from audit_logs where action=KPI_RECALC events'),

  ('MARCOMM_SEM_SPEND', 'Marcomm (marketing staff)', 'IDR', 'MANUAL', 'LOWER_BETTER', 'Manual/Imported spend input'),
  ('MARCOMM_SEM_CPL', 'Marcomm (marketing staff)', 'IDR/lead', 'AUTO', 'LOWER_BETTER', 'SEM Spend / SEM Leads (primary_channel=SEM)'),
  ('MARCOMM_ROAS', 'Marcomm (marketing staff)', 'ratio', 'AUTO', 'HIGHER_BETTER', 'Attributed Revenue / Spend'),

  ('MARCOMM_LINKEDIN_POSTS', 'Marcomm (marketing staff)', 'count', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported LinkedIn posts'),
  ('MARCOMM_WEBSITE_UPDATES', 'Marcomm (marketing staff)', 'count', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported website updates'),
  ('MARCOMM_SEO_CONTENT', 'Marcomm (marketing staff)', 'count', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported SEO content'),
  ('MARCOMM_SEM_CAMPAIGNS_LAUNCHED', 'Marcomm (marketing staff)', 'count', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported SEM launches'),
  ('MARCOMM_PR_EVENTS_EXECUTED', 'Marcomm (marketing staff)', 'count', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported PR/events'),
  ('MARCOMM_PARTNER_MEETINGS', 'Marcomm (marketing staff)', 'count', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported partner meetings'),
  ('MARCOMM_OFFLINE_COLLATERAL_RELEASES', 'Marcomm (marketing staff)', 'count', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported collateral releases'),

  ('DGO_PAID_SOCIAL_SPEND', 'DGO (Marketing staff)', 'IDR', 'MANUAL', 'LOWER_BETTER', 'Manual/Imported paid social spend'),
  ('DGO_PAID_SOCIAL_CPL', 'DGO (Marketing staff)', 'IDR/lead', 'AUTO', 'LOWER_BETTER', 'Paid spend / paid social leads'),
  ('DGO_ROAS', 'DGO (Marketing staff)', 'ratio', 'AUTO', 'HIGHER_BETTER', 'Attributed Revenue / Spend'),

  ('DGO_SOCIAL_POSTS', 'DGO (Marketing staff)', 'count', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported posts'),
  ('DGO_SHORT_FORM_VIDEO', 'DGO (Marketing staff)', 'count', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported short form'),
  ('DGO_LONG_FORM_VIDEO', 'DGO (Marketing staff)', 'count', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported long form'),
  ('DGO_LIVE_SESSIONS', 'DGO (Marketing staff)', 'count', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported live sessions'),
  ('DGO_COMMUNITY_REPLIES', 'DGO (Marketing staff)', 'count', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported replies'),
  ('DGO_REACH', 'DGO (Marketing staff)', 'count', 'IMPORTED', 'HIGHER_BETTER', 'Manual import metric (no API)'),
  ('DGO_ENGAGEMENT_RATE_PCT', 'DGO (Marketing staff)', '%', 'IMPORTED', 'HIGHER_BETTER', 'Manual import metric (no API)'),

  ('MACX_VOC_COVERAGE_PCT', 'MACX (marketing staff)', '%', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported VOC coverage'),
  ('MACX_CSAT_RESPONSE_RATE_PCT', 'MACX (marketing staff)', '%', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported CSAT/NPS response rate'),
  ('MACX_CLOSE_THE_LOOP_SLA_PCT', 'MACX (marketing staff)', '%', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported close-the-loop SLA'),
  ('MACX_DASHBOARDS_RELEASED', 'MACX (marketing staff)', 'count', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported dashboards released'),
  ('MACX_TRACKING_CHANGES_DEPLOYED', 'MACX (marketing staff)', 'count', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported tracking changes'),
  ('MACX_SURVEYS_LAUNCHED', 'MACX (marketing staff)', 'count', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported surveys launched'),
  ('MACX_CUSTOMER_INTERVIEWS', 'MACX (marketing staff)', 'count', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported interviews'),
  ('MACX_JOURNEY_AUDITS', 'MACX (marketing staff)', 'count', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported journey audits'),
  ('MACX_INTELLIGENCE_REPORTS', 'MACX (marketing staff)', 'count', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported intelligence reports'),

  ('VSDO_ON_TIME_DELIVERY_PCT', 'VSDO (marketing staff)', '%', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported on-time delivery'),
  ('VSDO_MEDIAN_TAT_DAYS', 'VSDO (marketing staff)', 'days', 'MANUAL', 'LOWER_BETTER', 'Manual/Imported median TAT'),
  ('VSDO_FIRST_PASS_APPROVAL_PCT', 'VSDO (marketing staff)', '%', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported first-pass approval'),
  ('VSDO_REVISION_RATE_PCT', 'VSDO (marketing staff)', '%', 'MANUAL', 'LOWER_BETTER', 'Manual/Imported revision rate'),
  ('VSDO_BRAND_COMPLIANCE_SCORE', 'VSDO (marketing staff)', 'score', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported brand compliance'),
  ('VSDO_DIGITAL_ASSETS_DELIVERED', 'VSDO (marketing staff)', 'count', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported digital assets'),
  ('VSDO_MOTION_VIDEO_DELIVERED', 'VSDO (marketing staff)', 'count', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported motion/video'),
  ('VSDO_PRINT_ASSETS', 'VSDO (marketing staff)', 'count', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported print assets'),
  ('VSDO_EVENT_BRANDING_PACKS', 'VSDO (marketing staff)', 'count', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported event packs'),
  ('VSDO_PHOTOSHOOT_SUPPORT_SESSIONS', 'VSDO (marketing staff)', 'count', 'MANUAL', 'HIGHER_BETTER', 'Manual/Imported photoshoot support')
on conflict (metric_key) do nothing;

-- =========================
-- MINIMAL USERS (CONDITIONAL PROFILES)
-- Profiles FK -> auth.users(id), so only insert if exists in auth.users.
-- =========================
with candidate_users as (
  select * from (values
    ('00000000-0000-0000-0000-000000000001'::uuid, 'DIR010126001', 'Director Seed', 'Director', 'DIR'::dept_code, null::uuid),
    ('00000000-0000-0000-0000-000000000002'::uuid, 'MKT010126001', 'Marketing Manager Seed', 'Marketing Manager', 'MKT'::dept_code, null::uuid),
    ('00000000-0000-0000-0000-000000000003'::uuid, 'SAL010126001', 'Sales Manager Seed', 'sales manager', 'SAL'::dept_code, null::uuid),
    ('00000000-0000-0000-0000-000000000004'::uuid, 'FIN010126001', 'Finance Seed', 'finance', 'FIN'::dept_code, null::uuid),
    ('00000000-0000-0000-0000-000000000005'::uuid, 'MKT010126002', 'Super Admin Seed', 'super admin', 'MKT'::dept_code, null::uuid)
  ) as t(user_id, user_code, full_name, role_name, dept_code, manager_user_id)
),
existing_auth as (
  select id as user_id from auth.users
)
insert into profiles(user_id, user_code, full_name, role_name, dept_code, manager_user_id)
select c.user_id, c.user_code, c.full_name, c.role_name, c.dept_code, c.manager_user_id
from candidate_users c
join existing_auth a using(user_id)
on conflict (user_id) do nothing;

-- =========================
-- SANITY CHECK (comments for validator)
-- roles=15, departments=8, services>0, KPI defs>0
-- =========================

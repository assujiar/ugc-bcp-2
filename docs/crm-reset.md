# CRM Reset Guide

This document explains how to reset the CRM module to a clean state for development, testing, or troubleshooting.

## Quick Reset (Seed Data Only)

To reload seed data without dropping tables:

```bash
# Connect to your database and run the seed file
psql $DATABASE_URL -f supabase/seed.sql
```

## Full Reset (Schema + Data)

### Option 1: Using Supabase CLI

```bash
# Reset database to clean state (runs all migrations + seed)
supabase db reset

# Or if using a linked project:
supabase db reset --linked
```

### Option 2: Manual SQL Reset

Connect to your database and run these commands in order:

```sql
-- 1. Clear all CRM data (preserves schema)
TRUNCATE
  activities,
  quotes,
  opportunity_stage_history,
  opportunities,
  contacts,
  leads,
  lead_handover_pool,
  prospecting_targets,
  invoice_ledger,
  accounts,
  crm_idempotency
CASCADE;

-- 2. Reload seed data
\i supabase/seed.sql
```

### Option 3: Drop and Recreate Tables

For a complete schema reset (useful when schema changes are made):

```bash
# Drop existing tables (run in psql)
psql $DATABASE_URL << 'EOF'
-- Drop views first
DROP VIEW IF EXISTS v_lead_inbox CASCADE;
DROP VIEW IF EXISTS v_sales_inbox CASCADE;
DROP VIEW IF EXISTS v_pipeline_summary CASCADE;
DROP VIEW IF EXISTS v_accounts_enriched CASCADE;

-- Drop tables
DROP TABLE IF EXISTS crm_idempotency CASCADE;
DROP TABLE IF EXISTS lead_handover_pool CASCADE;
DROP TABLE IF EXISTS quotes CASCADE;
DROP TABLE IF EXISTS invoice_ledger CASCADE;
DROP TABLE IF EXISTS cadence_enrollments CASCADE;
DROP TABLE IF EXISTS cadence_steps CASCADE;
DROP TABLE IF EXISTS cadences CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS shipment_profiles CASCADE;
DROP TABLE IF EXISTS opportunity_stage_history CASCADE;
DROP TABLE IF EXISTS opportunities CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS prospecting_targets CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;

-- Drop enums
DROP TYPE IF EXISTS opportunity_stage CASCADE;
DROP TYPE IF EXISTS lead_triage_status CASCADE;
DROP TYPE IF EXISTS activity_status CASCADE;
DROP TYPE IF EXISTS activity_type_v2 CASCADE;
DROP TYPE IF EXISTS target_status CASCADE;
DROP TYPE IF EXISTS tenure_status CASCADE;
DROP TYPE IF EXISTS account_activity_status CASCADE;
EOF

# Re-run migrations
supabase db push
# Or manually:
psql $DATABASE_URL -f supabase/migrations/09_crm_rebuild.sql
psql $DATABASE_URL -f supabase/migrations/10_crm_rpc_rls.sql

# Load seed data
psql $DATABASE_URL -f supabase/seed.sql
```

## Resetting Specific Tables

### Reset Leads Only

```sql
TRUNCATE leads, lead_handover_pool CASCADE;
-- Then insert sample leads from seed.sql
```

### Reset Opportunities Only

```sql
TRUNCATE opportunities, opportunity_stage_history, quotes CASCADE;
-- Then insert sample opportunities from seed.sql
```

### Reset Activities Only

```sql
TRUNCATE activities CASCADE;
-- Then insert sample activities from seed.sql
```

## Development Tips

### Viewing Current Data

```sql
-- Check record counts
SELECT 'accounts' as table_name, COUNT(*) FROM accounts
UNION ALL SELECT 'contacts', COUNT(*) FROM contacts
UNION ALL SELECT 'leads', COUNT(*) FROM leads
UNION ALL SELECT 'opportunities', COUNT(*) FROM opportunities
UNION ALL SELECT 'activities', COUNT(*) FROM activities
UNION ALL SELECT 'targets', COUNT(*) FROM prospecting_targets
UNION ALL SELECT 'quotes', COUNT(*) FROM quotes;
```

### Checking Views

```sql
-- Verify enriched views work
SELECT * FROM v_accounts_enriched LIMIT 5;
SELECT * FROM v_pipeline_summary;
SELECT * FROM v_lead_inbox LIMIT 5;
SELECT * FROM v_sales_inbox LIMIT 5;
```

### Testing RPC Functions

```sql
-- Test opportunity stage change (replace IDs with real values)
SELECT rpc_opportunity_change_stage(
  'opp-001'::uuid,
  'Proposal',
  'Moving to proposal stage',
  'test-idem-key-001'
);

-- Test lead handover
SELECT rpc_lead_handover_to_sales_pool('lead-003'::uuid);

-- Test lead claiming (replace user_id)
SELECT rpc_sales_claim_lead('lead-003'::uuid, 'your-user-id'::uuid);
```

## Troubleshooting

### "relation does not exist" errors

Run migrations in order:
```bash
psql $DATABASE_URL -f supabase/migrations/09_crm_rebuild.sql
psql $DATABASE_URL -f supabase/migrations/10_crm_rpc_rls.sql
```

### "duplicate key" errors in seed

The seed file uses `ON CONFLICT DO NOTHING` - this is safe to re-run. If you need fresh data, truncate first:
```sql
TRUNCATE accounts, contacts, leads, opportunities, activities, prospecting_targets, quotes CASCADE;
```

### RLS blocking queries

Check your user role and ensure RLS policies are correctly applied:
```sql
-- Check current user
SELECT current_user, current_setting('request.jwt.claims', true);

-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```

### Foreign key constraint errors

Delete in reverse dependency order:
```sql
-- Delete opportunities before accounts
DELETE FROM opportunities WHERE account_id = 'acc-xxx';
DELETE FROM accounts WHERE account_id = 'acc-xxx';
```

## Environment Variables

Ensure these are set:

```bash
# Database connection
DATABASE_URL=postgresql://...

# Or Supabase-specific
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

## Migration History

| Migration | Description |
|-----------|-------------|
| `09_crm_rebuild.sql` | New CRM schema (accounts, contacts, opportunities, etc.) |
| `10_crm_rpc_rls.sql` | RLS policies and RPC atomic functions |

## Related Documentation

- [CRM QA Checklist](./crm-qa.md) - Testing procedures
- Supabase CLI docs: https://supabase.com/docs/reference/cli

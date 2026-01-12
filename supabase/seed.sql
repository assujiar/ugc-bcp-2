-- CRM Seed Data
-- Run: psql $DATABASE_URL -f supabase/seed.sql
-- Or via Supabase CLI: supabase db reset (will run migrations + seed)

-- Clear existing test data (optional, comment out if you want to preserve data)
-- TRUNCATE accounts, contacts, leads, opportunities, activities, prospecting_targets, quotes CASCADE;

-- ============================================================================
-- ACCOUNTS (formerly customers)
-- ============================================================================
INSERT INTO accounts (account_id, company_name, domain, industry, segment, owner_user_id, billing_address, country, tags, created_at)
VALUES
  ('acc-001', 'Acme Logistics Corp', 'acmelogistics.com', 'Logistics', 'Enterprise', NULL, '123 Main St, Chicago, IL 60601', 'USA', ARRAY['key-account', 'high-value'], NOW() - INTERVAL '18 months'),
  ('acc-002', 'Global Shipping Inc', 'globalshipping.io', 'Shipping', 'Mid-Market', NULL, '456 Harbor Blvd, Los Angeles, CA 90001', 'USA', ARRAY['growth'], NOW() - INTERVAL '8 months'),
  ('acc-003', 'FastFreight Ltd', 'fastfreight.co.uk', 'Freight', 'SMB', NULL, '789 Dock Road, London', 'UK', ARRAY['new'], NOW() - INTERVAL '2 months'),
  ('acc-004', 'Pacific Trade Partners', 'pacifictrade.com', 'Trading', 'Enterprise', NULL, '321 Marina Way, Singapore', 'Singapore', ARRAY['key-account', 'apac'], NOW() - INTERVAL '24 months'),
  ('acc-005', 'EuroFreight GmbH', 'eurofreight.de', 'Freight', 'Mid-Market', NULL, 'Hafen Str. 45, Hamburg', 'Germany', ARRAY['emea'], NOW() - INTERVAL '6 months')
ON CONFLICT (account_id) DO NOTHING;

-- ============================================================================
-- CONTACTS
-- ============================================================================
INSERT INTO contacts (contact_id, account_id, first_name, last_name, email, phone, job_title, is_primary, created_at)
VALUES
  ('con-001', 'acc-001', 'John', 'Smith', 'john.smith@acmelogistics.com', '+1-312-555-0101', 'VP of Operations', true, NOW() - INTERVAL '18 months'),
  ('con-002', 'acc-001', 'Sarah', 'Johnson', 'sarah.j@acmelogistics.com', '+1-312-555-0102', 'Procurement Manager', false, NOW() - INTERVAL '12 months'),
  ('con-003', 'acc-002', 'Mike', 'Chen', 'mike.chen@globalshipping.io', '+1-213-555-0201', 'CEO', true, NOW() - INTERVAL '8 months'),
  ('con-004', 'acc-003', 'Emma', 'Williams', 'emma@fastfreight.co.uk', '+44-20-7946-0301', 'Managing Director', true, NOW() - INTERVAL '2 months'),
  ('con-005', 'acc-004', 'David', 'Tan', 'david.tan@pacifictrade.com', '+65-6123-0401', 'Chief Supply Chain Officer', true, NOW() - INTERVAL '24 months'),
  ('con-006', 'acc-005', 'Klaus', 'Mueller', 'k.mueller@eurofreight.de', '+49-40-1234-0501', 'Head of Logistics', true, NOW() - INTERVAL '6 months')
ON CONFLICT (contact_id) DO NOTHING;

-- ============================================================================
-- LEADS
-- ============================================================================
INSERT INTO leads (lead_id, company_name, contact_name, email, phone, source, triage_status, score, sla_deadline, notes, created_at)
VALUES
  ('lead-001', 'TechCargo Solutions', 'Alice Brown', 'alice@techcargo.com', '+1-415-555-1001', 'Website', 'New', 75, NOW() + INTERVAL '24 hours', 'Interested in FCL services', NOW() - INTERVAL '2 hours'),
  ('lead-002', 'MegaShip Enterprises', 'Bob Wilson', 'bob@megaship.com', '+1-212-555-1002', 'Referral', 'In Review', 85, NOW() + INTERVAL '12 hours', 'High potential - enterprise client', NOW() - INTERVAL '6 hours'),
  ('lead-003', 'Quick Delivery Co', 'Carol Davis', 'carol@quickdelivery.com', '+1-305-555-1003', 'Trade Show', 'Qualified', 90, NOW() + INTERVAL '48 hours', 'Ready for sales handover', NOW() - INTERVAL '1 day'),
  ('lead-004', 'Budget Freight LLC', 'Dan Miller', 'dan@budgetfreight.com', '+1-602-555-1004', 'Cold Call', 'New', 40, NOW() + INTERVAL '72 hours', 'Small volume, exploring options', NOW() - INTERVAL '30 minutes'),
  ('lead-005', 'Prime Logistics Group', 'Eve Thompson', 'eve@primelogistics.com', '+1-206-555-1005', 'LinkedIn', 'Handed Over', 95, NULL, 'Enterprise deal - handed to sales', NOW() - INTERVAL '3 days')
ON CONFLICT (lead_id) DO NOTHING;

-- ============================================================================
-- PROSPECTING TARGETS
-- ============================================================================
INSERT INTO prospecting_targets (target_id, company_name, contact_name, email, linkedin_url, source, status, notes, created_at)
VALUES
  ('tgt-001', 'NextGen Supply Co', 'Frank Garcia', 'frank@nextgensupply.com', 'linkedin.com/in/frankgarcia', 'LinkedIn Sales Navigator', 'New', 'Potential LCL customer', NOW() - INTERVAL '1 day'),
  ('tgt-002', 'Atlas Shipping Corp', 'Grace Lee', 'grace@atlasshipping.com', NULL, 'Industry Event', 'Contacted', 'Followed up via email', NOW() - INTERVAL '5 days'),
  ('tgt-003', 'Horizon Freight Inc', 'Henry Adams', 'henry@horizonfreight.com', 'linkedin.com/in/henryadams', 'Referral', 'Responded', 'Interested in quote', NOW() - INTERVAL '3 days'),
  ('tgt-004', 'Sterling Logistics', 'Ivy Martinez', 'ivy@sterlinglogistics.com', NULL, 'Website Form', 'Converted', 'Converted to lead', NOW() - INTERVAL '7 days')
ON CONFLICT (target_id) DO NOTHING;

-- ============================================================================
-- OPPORTUNITIES
-- ============================================================================
INSERT INTO opportunities (opportunity_id, account_id, name, stage, amount, currency, probability, expected_close_date, lane, equipment_type, notes, created_at)
VALUES
  ('opp-001', 'acc-001', 'Acme Q1 FCL Contract', 'Negotiation', 250000, 'USD', 70, NOW() + INTERVAL '30 days', 'CNSHA-USLAX', '40HC', 'Multi-year contract discussion', NOW() - INTERVAL '45 days'),
  ('opp-002', 'acc-002', 'Global Shipping LCL Pilot', 'Quote Sent', 45000, 'USD', 50, NOW() + INTERVAL '14 days', 'HKHKG-USNYC', 'LCL', 'Trial shipment for new lane', NOW() - INTERVAL '20 days'),
  ('opp-003', 'acc-003', 'FastFreight Air Express', 'Discovery', 15000, 'USD', 30, NOW() + INTERVAL '60 days', 'GBLHR-USORD', 'Air', 'New customer exploring air freight', NOW() - INTERVAL '10 days'),
  ('opp-004', 'acc-004', 'Pacific Trade Expansion', 'Proposal', 500000, 'USD', 60, NOW() + INTERVAL '45 days', 'SGSIN-Multiple', '40HC', 'Expanding to new US ports', NOW() - INTERVAL '30 days'),
  ('opp-005', 'acc-001', 'Acme Air Freight Add-on', 'Won', 75000, 'USD', 100, NOW() - INTERVAL '5 days', 'CNPVG-USORD', 'Air', 'Closed won - air freight services', NOW() - INTERVAL '60 days'),
  ('opp-006', 'acc-005', 'EuroFreight Rail Trial', 'Lost', 30000, 'USD', 0, NOW() - INTERVAL '10 days', 'DEHAM-PLGDN', 'Rail', 'Lost to competitor on price', NOW() - INTERVAL '90 days')
ON CONFLICT (opportunity_id) DO NOTHING;

-- ============================================================================
-- OPPORTUNITY STAGE HISTORY
-- ============================================================================
INSERT INTO opportunity_stage_history (opportunity_id, from_stage, to_stage, changed_at, changed_by)
SELECT 'opp-001', NULL, 'Discovery', NOW() - INTERVAL '45 days', NULL
WHERE NOT EXISTS (SELECT 1 FROM opportunity_stage_history WHERE opportunity_id = 'opp-001' AND to_stage = 'Discovery');

INSERT INTO opportunity_stage_history (opportunity_id, from_stage, to_stage, changed_at, changed_by)
SELECT 'opp-001', 'Discovery', 'Proposal', NOW() - INTERVAL '30 days', NULL
WHERE NOT EXISTS (SELECT 1 FROM opportunity_stage_history WHERE opportunity_id = 'opp-001' AND to_stage = 'Proposal');

INSERT INTO opportunity_stage_history (opportunity_id, from_stage, to_stage, changed_at, changed_by)
SELECT 'opp-001', 'Proposal', 'Negotiation', NOW() - INTERVAL '15 days', NULL
WHERE NOT EXISTS (SELECT 1 FROM opportunity_stage_history WHERE opportunity_id = 'opp-001' AND to_stage = 'Negotiation');

-- ============================================================================
-- ACTIVITIES
-- ============================================================================
INSERT INTO activities (activity_id, entity_type, entity_id, activity_type, subject, description, status, due_date, created_at)
VALUES
  ('act-001', 'opportunity', 'opp-001', 'Call', 'Contract negotiation call', 'Discuss pricing and terms with John Smith', 'Planned', NOW() + INTERVAL '2 days', NOW() - INTERVAL '1 day'),
  ('act-002', 'opportunity', 'opp-002', 'Email', 'Send revised quote', 'Include updated LCL rates for HK-NYC lane', 'Planned', NOW() + INTERVAL '1 day', NOW() - INTERVAL '2 days'),
  ('act-003', 'account', 'acc-003', 'Meeting', 'Introductory meeting', 'Meet with Emma Williams to understand requirements', 'Planned', NOW() + INTERVAL '5 days', NOW() - INTERVAL '3 days'),
  ('act-004', 'lead', 'lead-002', 'Call', 'Qualification call', 'Verify budget and timeline with Bob Wilson', 'Done', NOW() - INTERVAL '1 day', NOW() - INTERVAL '5 days'),
  ('act-005', 'opportunity', 'opp-004', 'Meeting', 'Proposal presentation', 'Present expansion proposal to Pacific Trade team', 'Done', NOW() - INTERVAL '3 days', NOW() - INTERVAL '10 days'),
  ('act-006', 'account', 'acc-001', 'Email', 'Quarterly business review', 'Schedule QBR with Acme Logistics', 'Cancelled', NULL, NOW() - INTERVAL '7 days')
ON CONFLICT (activity_id) DO NOTHING;

-- ============================================================================
-- QUOTES
-- ============================================================================
INSERT INTO quotes (quote_id, opportunity_id, account_id, version, status, valid_until, total_amount, currency, terms, notes, created_at)
VALUES
  ('quo-001', 'opp-001', 'acc-001', 1, 'Draft', NOW() + INTERVAL '30 days', 250000, 'USD', 'Net 30', 'Initial quote for Q1 FCL contract', NOW() - INTERVAL '20 days'),
  ('quo-002', 'opp-001', 'acc-001', 2, 'Sent', NOW() + INTERVAL '30 days', 235000, 'USD', 'Net 30', 'Revised quote with volume discount', NOW() - INTERVAL '10 days'),
  ('quo-003', 'opp-002', 'acc-002', 1, 'Sent', NOW() + INTERVAL '14 days', 45000, 'USD', 'Net 15', 'LCL pilot quote', NOW() - INTERVAL '5 days'),
  ('quo-004', 'opp-004', 'acc-004', 1, 'Draft', NOW() + INTERVAL '45 days', 500000, 'USD', 'Net 45', 'Expansion proposal quote', NOW() - INTERVAL '15 days')
ON CONFLICT (quote_id) DO NOTHING;

-- ============================================================================
-- LEAD HANDOVER POOL
-- ============================================================================
INSERT INTO lead_handover_pool (lead_id, handed_over_at, claimed_by, claimed_at)
VALUES
  ('lead-005', NOW() - INTERVAL '2 days', NULL, NULL)
ON CONFLICT (lead_id) DO NOTHING;

-- ============================================================================
-- INVOICE LEDGER (sample for Account 360 view)
-- ============================================================================
INSERT INTO invoice_ledger (invoice_id, account_id, invoice_number, amount, currency, status, issued_date, due_date, paid_date, created_at)
VALUES
  ('inv-001', 'acc-001', 'INV-2024-001', 50000, 'USD', 'Paid', NOW() - INTERVAL '90 days', NOW() - INTERVAL '60 days', NOW() - INTERVAL '55 days', NOW() - INTERVAL '90 days'),
  ('inv-002', 'acc-001', 'INV-2024-002', 75000, 'USD', 'Paid', NOW() - INTERVAL '60 days', NOW() - INTERVAL '30 days', NOW() - INTERVAL '28 days', NOW() - INTERVAL '60 days'),
  ('inv-003', 'acc-001', 'INV-2024-003', 60000, 'USD', 'Outstanding', NOW() - INTERVAL '20 days', NOW() + INTERVAL '10 days', NULL, NOW() - INTERVAL '20 days'),
  ('inv-004', 'acc-002', 'INV-2024-004', 25000, 'USD', 'Paid', NOW() - INTERVAL '45 days', NOW() - INTERVAL '15 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '45 days'),
  ('inv-005', 'acc-004', 'INV-2024-005', 150000, 'USD', 'Outstanding', NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', NULL, NOW() - INTERVAL '15 days')
ON CONFLICT (invoice_id) DO NOTHING;

-- Verification query
SELECT 'Seed data loaded successfully!' as message;
SELECT 'Accounts: ' || COUNT(*) FROM accounts;
SELECT 'Contacts: ' || COUNT(*) FROM contacts;
SELECT 'Leads: ' || COUNT(*) FROM leads;
SELECT 'Targets: ' || COUNT(*) FROM prospecting_targets;
SELECT 'Opportunities: ' || COUNT(*) FROM opportunities;
SELECT 'Activities: ' || COUNT(*) FROM activities;
SELECT 'Quotes: ' || COUNT(*) FROM quotes;

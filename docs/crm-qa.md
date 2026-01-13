# CRM Module QA Checklist

## Overview

This document provides a comprehensive QA checklist for the rebuilt CRM module. Use this to verify all functionality is working correctly after deployment.

## Prerequisites

1. Database migrations applied (`09_crm_rebuild.sql`, `10_crm_rpc_rls.sql`)
2. Seed data loaded (`supabase/seed.sql`)
3. Application running (`pnpm dev`)
4. User logged in with appropriate role (Sales, Marketing, or Admin)

---

## 1. Lead Triage Queue (`/crm/lead-inbox`)

### Display
- [ ] Lead inbox page loads without errors
- [ ] Response SLA countdown timer displays correctly for each lead
- [ ] Lead statistics show correct counts (New, In Review, Qualified, Handed Over)
- [ ] Leads are sorted by Response SLA deadline (most urgent first)
- [ ] Past Due leads show red Response SLA indicator

### Lead Triage
- [ ] Clicking "Triage" opens the triage modal
- [ ] Modal shows lead details (company, contact, email, phone, source, notes)
- [ ] "Qualify" action changes status to "Qualified"
- [ ] "Nurture" action changes status to "In Review" (or custom nurture status)
- [ ] "Disqualify" action changes status to "Disqualified"
- [ ] Triage notes are saved correctly

### Lead Handover
- [ ] "Send to Sales Pool" button appears for Qualified leads
- [ ] Clicking handover adds lead to the sales pool
- [ ] Lead status changes to "Sent to Sales Pool"
- [ ] Lead appears in My Work Queue sales pool

---

## 2. My Work Queue (`/crm/sales-inbox`)

### Display
- [ ] Page loads with two sections: Past Due Activities and Sales Pool
- [ ] Past Due activities show correct count and list
- [ ] Sales Pool shows unclaimed leads

### Activity Management
- [ ] Past Due activities display entity type and subject
- [ ] Clicking activity opens relevant entity detail

### Lead Claiming
- [ ] "Claim" button appears for unclaimed leads in handover pool
- [ ] Claiming a lead assigns it to the current user
- [ ] Claimed leads disappear from the pool
- [ ] Race condition: Two users clicking claim simultaneously - only one succeeds

---

## 3. Sales Pipeline (`/crm/pipeline`)

### Display
- [ ] Kanban view shows all opportunity stages
- [ ] Each stage shows opportunity count and total value
- [ ] Opportunities display key info (name, account, amount, probability)
- [ ] List view toggle works correctly

### Opportunity Management
- [ ] "Quick Add" button opens add opportunity modal
- [ ] Creating opportunity works (account, name, amount, lane, equipment)
- [ ] New opportunity appears in "Discovery" stage
- [ ] Clicking opportunity opens stage change modal

### Stage Progression
- [ ] Stage change modal shows current stage
- [ ] Valid forward stages are available
- [ ] Backward stage movement requires confirmation
- [ ] Quote Sent stage enforces quote existence check
- [ ] Stage change updates opportunity and adds history record

---

## 4. Accounts (`/crm/accounts`)

### Display
- [ ] Account listing page loads correctly
- [ ] Search filters accounts by company name
- [ ] Tenure status badges display correctly (New < 6mo, Active 6-18mo, Veteran > 18mo)
- [ ] Activity status badges display correctly (Engaged, At Risk, Dormant)

### Account Creation
- [ ] "New Account" button opens add modal
- [ ] Required fields validated (company name)
- [ ] Domain, industry, segment, address fields work
- [ ] Tags can be added as comma-separated values
- [ ] New account appears in listing

---

## 5. Account 360 (`/crm/accounts/[id]`)

### Display
- [ ] Account detail page loads with all tabs
- [ ] Overview tab shows company info, status badges, and financial summary
- [ ] Contacts tab lists associated contacts
- [ ] Opportunities tab shows related opportunities with stage badges
- [ ] Activities tab shows planned, done, and cancelled activities
- [ ] Financial tab shows invoice ledger and aggregates

### Contacts Management
- [ ] "Add Contact" opens contact modal
- [ ] Contact creation works (first name, last name, email, phone, title)
- [ ] Primary contact flag can be set
- [ ] Contacts appear in contacts tab

### Account Updates
- [ ] Edit functionality works for account fields
- [ ] Changes are persisted and reflected in UI

---

## 6. Targets (`/crm/targets`)

### Display
- [ ] Target listing page loads correctly
- [ ] Status filter works (All, New, Contacted, Responded, Converted)
- [ ] Targets display company, contact, source, and status

### Target Management
- [ ] "Add Target" opens add modal
- [ ] Target creation works with all fields
- [ ] Dedupe key prevents duplicate targets (same email)

### Target Conversion
- [ ] "Convert" button opens conversion options
- [ ] Convert to Lead creates new lead record
- [ ] Convert to Account creates new account record
- [ ] Target status changes to "Converted" after conversion

---

## 7. Activities (`/crm/activities`)

### Display
- [ ] Activity listing page loads correctly
- [ ] View toggle (List/Day) works
- [ ] Status filter works (All, Planned, Done, Cancelled)
- [ ] Activities sorted by due date

### Activity Management
- [ ] "Add Activity" opens add modal
- [ ] Activity creation works (type, subject, description, entity, due date)
- [ ] Entity type dropdown shows options (account, lead, opportunity)
- [ ] Entity ID field accepts valid UUIDs

### Activity Completion
- [ ] "Complete" button marks activity as done
- [ ] Completed activities show in Done filter
- [ ] Activity timestamp updates correctly

---

## 8. API Endpoints

### Leads API
- [ ] `GET /api/crm/leads` - Returns lead inbox with Response SLA ordering
- [ ] `POST /api/crm/leads` - Creates lead with dedupe check
- [ ] `GET /api/crm/leads/[id]` - Returns single lead
- [ ] `PATCH /api/crm/leads/[id]` - Updates lead
- [ ] `PATCH /api/crm/leads/[id]/triage` - Triages lead
- [ ] `POST /api/crm/leads/[id]/handover` - Hands over to sales pool
- [ ] `POST /api/crm/leads/[id]/claim` - Claims lead from pool

### Accounts API
- [ ] `GET /api/crm/accounts` - Returns accounts with enriched view
- [ ] `POST /api/crm/accounts` - Creates account
- [ ] `GET /api/crm/accounts/[id]` - Returns account 360 view
- [ ] `PATCH /api/crm/accounts/[id]` - Updates account

### Opportunities API
- [ ] `GET /api/crm/opportunities` - Returns pipeline view
- [ ] `POST /api/crm/opportunities` - Creates opportunity
- [ ] `POST /api/crm/opportunities/[id]/stage` - Changes stage atomically

### Activities API
- [ ] `GET /api/crm/activities` - Returns activities list
- [ ] `POST /api/crm/activities` - Creates activity
- [ ] `POST /api/crm/activities/[id]/complete` - Completes activity

### Targets API
- [ ] `GET /api/crm/targets` - Returns targets list
- [ ] `POST /api/crm/targets` - Creates target(s)
- [ ] `POST /api/crm/targets/[id]/convert` - Converts target

### Quotes API
- [ ] `GET /api/crm/quotes` - Returns quotes list
- [ ] `POST /api/crm/quotes` - Creates quote with auto-versioning

---

## 9. RLS & Permissions

### Role-Based Access
- [ ] Admin users can access all CRM pages
- [ ] Sales users can access pipeline, accounts, activities
- [ ] Marketing users can access lead inbox, targets
- [ ] Unauthorized roles see access denied message

### Data Isolation
- [ ] Users only see data they have permission to view
- [ ] Owner-based filtering works for opportunities
- [ ] Team-based filtering works where applicable

---

## 10. Edge Cases

### Error Handling
- [ ] Invalid UUIDs return 400 error
- [ ] Non-existent records return 404 error
- [ ] Unauthorized access returns 401 error
- [ ] Server errors return 500 with generic message

### Data Validation
- [ ] Required fields are enforced
- [ ] Email format validation works
- [ ] Currency defaults to USD
- [ ] Dates are validated

### Concurrency
- [ ] Lead claiming is race-safe (only one user wins)
- [ ] Stage changes are atomic
- [ ] Idempotency keys prevent duplicate operations

---

## 11. CRM Module Remediation (January 2026)

### P0 Fixes Applied

#### Qualified Leads Vanishing Bug
- [ ] Qualified leads are auto-handed over to Sales Pool (no manual step needed)
- [ ] Leads never disappear after triage - they transition to "Handed Over" state
- [ ] Sales Pool shows all unclaimed leads with "Handed Over" status

#### Claimed Leads Visibility
- [ ] My Leads tab appears in My Work Queue
- [ ] Claimed but not converted leads are visible
- [ ] Convert button allows conversion to opportunity

#### Dead CTAs Fixed
- [ ] Add Account button opens working modal (not dead link)
- [ ] Add Contact button opens working modal in Account 360
- [ ] Import page shows proper placeholder with RBAC

### Guardrails Enforced (SSOT Requirement)

Every active item must have: **Owner + Next Action + Due Date**

#### Opportunities
- [ ] Creating opportunity requires `next_step` (validated)
- [ ] Creating opportunity requires `next_step_due_date` (validated)
- [ ] Stage change requires `next_step` (validated)
- [ ] Stage change requires `next_step_due_date` (validated)
- [ ] Owner auto-assigned to creator

#### Activities
- [ ] Planned activities require `due_date` (validated)
- [ ] Owner auto-assigned to creator

#### Leads
- [ ] Claimed leads have owner assigned
- [ ] SLA deadline set on creation

### Terminology Updates

| Old Term | New Term |
|----------|----------|
| Lead Inbox | Lead Triage Queue |
| Sales Inbox | My Work Queue |
| Handover | Send to Sales Pool |
| Overdue | Past Due |
| SLA | Response SLA |
| Customers | Accounts |
| KPI | Performance |

---

## Sign-off

| Tester | Date | Environment | Status |
|--------|------|-------------|--------|
| | | | |

### Notes
_Add any additional observations or issues found during testing._

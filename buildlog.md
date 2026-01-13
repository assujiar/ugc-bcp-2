**## RINGKASAN PROJECT: UGC Integrated Dashboard**



**---**



**## ✅ COMPLETED STEPS (0-8)**



**### STEP 0: PROJECT INITIALIZATION**

**- Next.js 16 App Router + TypeScript**

**- Tailwind CSS + shadcn/ui + Radix UI**

**- Supabase SSR integration**

**- Environment config (.env.local)**

**- Folder structure sesuai blueprint**



**### STEP 1: BLUEPRINT \& ARCHITECTURE**

**- \*\*BLUEPRINT.md\*\*: Full system specification**

**- \*\*diagrams.mmd\*\*: 9 Mermaid diagrams (architecture, auth flow, RBAC, data flow, etc.)**

**- \*\*validator.json\*\*: Validation rules untuk 15 roles, 5 menus, color palette, constraints**



**### STEP 2: DATABASE SCHEMA**

**- \*\*00\_schema.sql\*\*: 20+ tables, enums, triggers, auto-ID generators**

**- \*\*01\_seed.sql\*\*: 15 roles, 8 departments, service catalog, KPI metric definitions**

**- Core tables: profiles, customers, leads, prospects, tickets, invoices, payments, etc.**



**### STEP 3: RLS + MASKING**

**- \*\*02\_rls.sql\*\*: Row Level Security policies per table per role**

**- \*\*03\_views.sql\*\*: Reporting views (v\_ops\_rfqs\_masked, v\_ar\_aging, v\_dso\_rolling\_30, etc.)**

**- \*\*04\_tests.sql\*\*: RLS test functions**

**- Ops masking untuk RFQ dari lead (customer PII = MASKED)**



**### STEP 4: SUPABASE CLOUD SETUP**

**- Supabase project configured**

**- Migrations applied**

**- Storage buckets (ticket-attachments, kpi-evidence, etc.)**



**### STEP 5: NEXT.JS + SUPABASE INTEGRATION**

**- `lib/supabase/server.ts` - Server client dengan cookies**

**- `lib/supabase/client.ts` - Browser client**

**- `lib/supabase/auth.ts` - Session helpers**

**- Auth callback + logout routes**



**### STEP 6: AUTH + RBAC UI**

**- Dynamic sidebar berdasarkan role**

**- `lib/rbac/roles.ts` - 15 roles exact match**

**- `lib/rbac/permissions.ts` - Menu visibility per role**

**- `lib/contexts/user-context.tsx` - User state management**

**- AppShell + ProtectedShell layout**



**### STEP 7: CORE UI SHELL**

**- Sidebar responsive (fixed desktop, drawer mobile)**

**- Topbar dengan search modal (Cmd+K), notifications, theme toggle**

**- FilterBar + SavedViews components**

**- DataTable dengan pagination**

**- Design system: glassmorphism, border-radius 14-18px, locked color palette**



**### STEP 8: MODULE IMPLEMENTATION**

**\*\*API Routes (23 endpoints):\*\***

**```**

**/api/leads          - CRUD leads + auto-link customer/prospect**

**/api/customers      - CRUD customers**

**/api/prospects      - CRUD prospects + stage update**

**/api/tickets        - CRUD tickets + messages**

**/api/invoices       - CRUD invoices**

**/api/invoices/\[id]/payments - Record payments**

**/api/dso            - Summary, aging, rolling DSO**

**/api/kpi            - Targets, my KPI, team KPI**

**/api/kpi/input      - Marketing activity/spend**

**/api/imports        - Bulk import processing**

**/api/activities     - Sales activities log**

**/api/dashboard      - Role-based metrics**

**/api/search         - Global search**

**/api/notifications  - Role-based notifications**

**/api/users          - User management**

**/api/saved-views    - Filter presets**

**/api/upload         - File upload**

**/api/audit-logs     - Audit trail**

**```**



**\*\*Pages (30 pages):\*\***

**```**

**/login              - Auth page**

**/dashboard          - Role-based dashboard dengan charts**

**/dashboard/users    - User management (super admin)**



**/kpi                - KPI overview**

**/kpi/my             - My KPI targets**

**/kpi/team           - Team KPI (manager)**

**/kpi/targets        - Set targets**

**/kpi/input          - Manual activity/spend input**

**/kpi/imports        - Bulk import**



**/crm/leads          - Leads list + pipeline stats**

**/crm/leads/new      - Create lead form + optional RFQ**

**/crm/leads/\[id]     - Lead detail + edit + assign**

**/crm/customers      - Customers list**

**/crm/customers/new  - Create customer**

**/crm/customers/\[id] - Customer detail**

**/crm/prospects      - Prospects kanban + list view**

**/crm/activities/new - Log sales activity**

**/crm/imports        - CRM imports**



**/ticketing          - Tickets list + status tabs**

**/ticketing/create   - Create ticket form**

**/ticketing/\[id]     - Ticket detail + messages + status update**



**/dso                - AR/DSO overview + aging chart**

**/dso/invoices       - Invoices list**

**/dso/invoices/new   - Create invoice**

**/dso/invoices/\[id]  - Invoice detail + payments**

**/dso/payments/new   - Record payment**

**/dso/my-customers   - Sales scoped AR view**

**```**



**\*\*Lib/API Client:\*\***

**- `lib/api/client.ts` - All fetch functions with proper types**

**- `lib/api/index.ts` - Re-exports**



**---**



**## 🔲 REMAINING STEPS (9-10)**



**### STEP 9: QA + TESTING**

**\*\*Goal:\*\* Membuktikan sistem aman \& stabil**



**\*\*Tasks:\*\***

**1. \*\*RLS Test per Role:\*\***

   **- Director: read-only semua module**

   **- Super admin: full access**

   **- Marketing staff: hanya lihat leads sendiri**

   **- Salesperson: hanya lihat assigned leads/prospects**

   **- Ops: hanya lihat tickets dept sendiri + masked RFQ**

   **- Finance: full DSO, read-only lainnya**



**2. \*\*Smoke Test Scenarios:\*\***

   **- Login sebagai setiap role → verify sidebar menus**

   **- Create lead → verify auto-link customer + prospect**

   **- Create lead + RFQ toggle → verify auto-create ticket**

   **- Record payment → verify outstanding update**

   **- Ops view RFQ → verify customer masked**



**3. \*\*Data Leak Prevention:\*\***

   **- Salesperson A tidak bisa lihat leads Salesperson B**

   **- Ops tidak bisa lihat customer PII dari RFQ**

   **- Finance tidak bisa akses Ticketing**

   **- Director tidak bisa mutation (read-only)**



**4. \*\*Build \& Lint:\*\***

   **- `npm run build` PASS**

   **- `npx tsc --noEmit` PASS**

   **- ESLint clean**



**\*\*Checkpoint:\*\* Semua RLS test PASS, tidak ada data leak lintas role.**



**---**



**### STEP 10: DEPLOY (VERCEL)**

**\*\*Goal:\*\* Production deployment**



**\*\*Tasks:\*\***

**1. \*\*Pre-deploy Checklist:\*\***

   **- Environment variables configured di Vercel**

   **- Supabase project URL + anon key set**

   **- Build passing locally**



**2. \*\*Deploy:\*\***

   **- Connect repo ke Vercel**

   **- Deploy main branch**

   **- Verify build success**



**3. \*\*Post-deploy Verification:\*\***

   **- Login flow works**

   **- All 5 modules accessible per role**

   **- API routes responding**

   **- No console errors**



**4. \*\*Rollback Plan:\*\***

   **- Document current working commit**

   **- Vercel instant rollback ready**



**\*\*Checkpoint:\*\* Production URL aktif, core flows PASS.**



**---**



**## 📁 KEY FILES FOR CONTEXT**



**```**

**C:\\dev\\ugc-integrated-dashboard\\**

**├── BLUEPRINT.md              # System specification**

**├── validator.json            # Validation rules**

**├── diagrams.mmd              # Mermaid diagrams**

**├── supabase/migrations/**

**│   ├── 00\_schema.sql         # DDL + triggers**

**│   ├── 01\_seed.sql           # Seed data**

**│   ├── 02\_rls.sql            # RLS policies**

**│   ├── 03\_views.sql          # Reporting views**

**│   └── 04\_tests.sql          # Test functions**

**├── lib/**

**│   ├── api/client.ts         # API client (627 lines)**

**│   ├── rbac/roles.ts         # 15 roles**

**│   ├── rbac/permissions.ts   # Menu visibility**

**│   ├── contexts/user-context.tsx**

**│   └── supabase/             # Supabase clients**

**├── app/**

**│   ├── (auth)/login/         # Login page**

**│   ├── (protected)/          # All protected pages**

**│   └── api/                   # 23 route handlers**

**└── components/**

    **├── layout/               # AppShell, Sidebar, Topbar**

    **├── table/                # DataTable**

    **├── filter/               # FilterBar, SavedViews**

    **└── ui/                   # shadcn components**

**```**



**---**



**## 🔒 LOCKED CONSTRAINTS (JANGAN DIUBAH)**



**| Constraint | Value |**

**|------------|-------|**

**| Roles | 15 exact (Director, super admin, Marketing Manager, dll.) |**

**| Top-level Menu | 5 only (Dashboard, KPI, CRM, Ticketing, DSO) |**

**| Color Palette | #FF4600, #082567, #DC2F02, #0F1A2D, #FFFFFF |**

**| Border Radius | 14-18px |**

**| Tech Stack | Next.js 16, TypeScript, Tailwind, shadcn, Supabase SSR |**

**| Auth | NO middleware gating, Supabase SSR cookies |**

**| Mutations | Via Route Handlers (BFF), tidak langsung ke Supabase |**



**---**

**```**


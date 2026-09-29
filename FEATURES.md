# ECOVENT Operations — Product Features & Implementation Plan

> **Product:** ECOVENT Order & Operations Portal (formerly "Dispatch")  
> **Industry:** HVAC / Air-conditioning duct manufacturing — engineer-to-order  
> **Platform:** Web Admin Portal + Mobile PWA  
> **Company:** ECOVENT AIR SYSTEMS INDIA LLP — *Quality Ducts Is Our Business*  
> **Last updated:** 19 September 2026

**Related documents:** `ADMIN_PORTAL.md` (Phase 1 user guide) · `trust-blue-pay-DESIGN.md` (UI design system)

---

## Status Legend

| Status | Meaning |
|--------|---------|
| `completed` | Built and verified |
| `pending` | Not yet started |
| `in-progress` | Currently being worked on |
| `deferred` | Intentionally postponed |
| `evolve` | Exists in demo; must be refactored to new model |
| `frozen` | UI/scope locked after client approval |

---

## Phase Overview

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase 0** | UX prototype — dispatch workflow, mock data | `completed` |
| **Phase 1** | Web demo — dispatch module, Trust Blue Pay UI, PDF/Excel/WhatsApp | `completed` |
| **Phase 2** | Pre-order + commercial — Customer, Enquiry, Project, Drawing, Design, Duct Schedule, Quotation, PO, Customer Order | `pending` |
| **Phase 3** | Manufacturing — MO, production, QC, ready stock | `pending` |
| **Phase 4** | Backend — PostgreSQL, Fastify API, auth, workflow engine, file storage | `in-progress` |
| **Phase 5** | Mobile PWA — production, dispatch, delivery, offline sync, QR | `pending` |
| **Phase 6** | Communication — WhatsApp Business API, client portal | `deferred` |

### Build order

1. **Phase 1 dispatch demo** is complete — do not discard; evolve it downstream.
2. **Next client demo (Phase 2 scope):** Customer → Enquiry → Drawing → Design → Duct Schedule → Quotation → PO → Customer Order → Manufacturing status → **existing Dispatch**.
3. **Do not** hard-code statuses in frontend — build workflow engine (Phase 4).
4. Freeze dispatch UI after client approval, then connect PostgreSQL/API behind service layer.

### Executive summary — what changed

| Before (Phase 1) | After (Revised) |
|------------------|-----------------|
| Everything is an "Order" | Separate business entities per lifecycle stage |
| Excel import = order source | Duct Schedule is engineering output, before Customer Order |
| Order → Dispatch | Customer Order → Manufacturing Order → Ready Stock → Dispatch → Delivery |
| Hard-coded statuses | Configurable workflow engine per entity type |
| Dispatch-only product | Full Order-to-Delivery ERP |

**Strongest recommendation:** Do not make "Customer Order" just another status of the existing Order object. Make it a proper business document linked to Quotation, PO, Drawing Revision, and Duct Schedule.

**Product naming:** ECOVENT Operations (recommended) · ECOVENT Order & Operations · ECOVENT DuctFlow

---

## 1. Revised Business Lifecycle

```
                    CUSTOMER / LEAD
                          │
                          ▼
                  CUSTOMER ENQUIRY
                          │
                          ▼
                  DRAWING RECEIVED
                          │
                          ▼
                 DESIGN ENGINEERING
                          │
             ┌────────────┴────────────┐
             │                         │
       Drawing Accepted          Design Modification
             │                         │
             └────────────┬────────────┘
                          ▼
                  DUCT EXTRACTION
                          │
                          ▼
                  DUCT SCHEDULE / BOQ
                          │
                          ▼
                     QUOTATION
                          │
             ┌────────────┴────────────┐
             │                         │
          Accepted                  Rejected
             │                         │
             ▼                         ▼
       CUSTOMER PO                 LOST/CLOSED
             │
             ▼
       CUSTOMER ORDER CONFIRMED
             │
             ▼
       PRODUCTION PLANNING → PRODUCTION → READY FOR DISPATCH
             │
             ▼
      MULTI-TRIP DISPATCH (Trip 1, 2, 3…)
             │
             ▼
          DELIVERED → CLOSED
```

| Stage | Status |
|-------|--------|
| Full lifecycle defined | `completed` (spec) |
| Enquiry → Drawing → Design | `completed` (demo) |
| Duct Schedule / BOQ | `completed` (demo) |
| Quotation → PO → Customer Order | `completed` (demo) |
| Manufacturing | `completed` (demo) |
| Multi-trip Dispatch | `completed` (Phase 1 demo) |
| Delivery | `pending` |

---

## 2. Entity Architecture

**Don't make everything an "Order."**

```
Customer
   └── Lead / Enquiry
          └── Project
                 ├── Drawings / Design Revisions
                 ├── Duct Schedule
                 ├── Quotation
                 └── Customer Order
                         └── Manufacturing Order(s)
                                └── Dispatches → Deliveries
```

**Chain of reference:** `Customer → Project → Enquiry → Quotation → Customer Order`

| Entity | Status |
|--------|--------|
| Customer | `completed` (demo) |
| Lead / Enquiry | `completed` (demo) |
| Project | `completed` (demo) |
| Drawing + Revisions | `completed` (demo) |
| Design | `completed` (demo — status on project pipeline) |
| Duct Schedule | `completed` (demo) |
| Quotation | `completed` (demo) |
| Customer PO | `completed` (demo) |
| Customer Order | `completed` (`evolve` from Phase 1 "Order") |
| Manufacturing Order | `completed` (demo) |
| Dispatch | `completed` (`evolve` reference to Customer Order) |
| Delivery | `pending` |

---

## 3. Module Specifications

### Module 1 — Customer Management

| Requirement | Status |
|-------------|--------|
| Customer master, contacts, billing address | `pending` |
| Project sites, tax info, communication details | `pending` |
| Customer history | `pending` |

### Module 2 — Enquiry / Lead

Do **not** create an Order when a customer sends a drawing.

| Field / Requirement | Status |
|---------------------|--------|
| Enquiry No, Customer, Contact, Phone, Email | `completed` (demo form) |
| Project Name, Location, Enquiry Date, Expected Completion | `completed` (demo form) |
| Sales Person, Priority, Source, Remarks | `completed` (demo form) |
| Drawing attachments (DWG, DXF, PDF, JPG, PNG, Excel, ZIP) | `completed` (filename capture) |
| Activity history, enquiry workflow | `completed` (demo) |
| New enquiry form (`/enquiries/new`) | `completed` |
| Design review → duct extraction → approve | `completed` (demo) |
| Convert to order (no order until approved) | `completed` (demo) |

### Module 3 — Project

| Requirement | Status |
|-------------|--------|
| Project master, customer, site | `pending` |
| Drawings, enquiries, quotations, PO, orders | `pending` |
| Production, dispatch, documents | `pending` |

### Module 4 — Drawing Management

| Field | Status |
|-------|--------|
| Drawing No, Name, Revision, Received Date/From | `pending` |
| File, Status, Reviewed By, Review Date, Remarks | `pending` |
| Revision history (never overwrite — Rev 00, 01, 02…) | `pending` |
| Preview, download, design comments, approval | `pending` |

### Module 5 — Design Engineering

`Drawing Review → Design Modification → Duct Extraction → Duct Schedule → Engineering Approval`

| Requirement | Status |
|-------------|--------|
| Drawing review, design modifications, duct extraction | `pending` |
| Duct schedule generation | `pending` |
| Excel import/export for duct schedule | `evolve` (move from order-level import) |
| Engineering revision and approval | `pending` |

### Module 6 — Duct Schedule / BOQ

Engineering output **before** confirmed customer order. Excel functionality moves here.

| Requirement | Status |
|-------------|--------|
| Standalone duct schedule entity | `pending` |
| Tag line items (W1, H1, W2, H2, L, Qty, Area) | `evolve` |
| Excel import with column mapping | `in-progress` (see `docs/EXCEL_IMPORT.md`) |
| Revision linked to drawing/design | `pending` |

### Module 7 — Engineering Revision Chain

`Drawing Rev → Design Rev → Duct Schedule Rev → Quotation Rev → Order Rev`

| Requirement | Status |
|-------------|--------|
| Cross-document revision linking | `pending` |
| Revision diff / change log | `pending` |

### Module 8 — Quotation

Pulls from Project, Customer, Drawing Revision, Duct Schedule.

**Lifecycle:** `DRAFT → INTERNAL REVIEW → READY TO SEND → SENT → CUSTOMER REVIEW → ACCEPTED / REVISION / LOST`

| Requirement | Status |
|-------------|--------|
| Commercial section (terms, tax, discount, total) | `pending` |
| Technical section (ducts, area, gauge, material, accessories) | `pending` |
| Create from duct schedule, revisions | `pending` |
| PDF / Excel output | `evolve` |
| Customer communication | `evolve` (WhatsApp/email in Phase 1) |

### Module 9 — Customer PO

`Quotation → Customer PO → Customer Order`

| Field / Requirement | Status |
|---------------------|--------|
| PO Number, Date, File, Amount, Qty, Terms, Delivery Date | `pending` |
| PO verification workflow (commercial + technical) | `pending` |
| Do not auto-convert PO to order | `pending` |

### Module 10 — Customer Order

Central operational document after PO approval (e.g. CO-2026-00125).

| Requirement | Status |
|-------------|--------|
| Create from approved PO | `pending` |
| Link quotation, drawing revision, duct schedule | `pending` |
| Order revision, delivery date, manufacturing requirement | `pending` |
| Order progress tracking | `evolve` |

### Module 11 — Manufacturing

**Separate Customer Order (commercial) from Manufacturing Order (shop floor).**

One CO may split into multiple MOs. Workflow: `Planning → MO → Material Prep → Fabrication → Assembly → Inspection → Completed → Ready for Dispatch`

| Requirement | Status |
|-------------|--------|
| Production planning, manufacturing orders | `pending` |
| Tag-level production (Ordered/Production/Completed/Dispatched/Balance) | `pending` |
| QC, ready quantity, manufacturing dashboard | `pending` |
| Configurable production steps | `pending` |
| Ready qty in mock data | `evolve` |

### Module 12 — Dispatch

Phase 1 demo is largely correct — **change reference model only:**

`Customer Order → Manufacturing → Ready Stock → Dispatch` (not Order → Dispatch directly)

| Requirement | Status |
|-------------|--------|
| Order selection | `completed` → `evolve` |
| Tag selection with +/− controls | `completed` |
| Vehicle details, preview, confirm | `completed` |
| Dispatch history timeline | `completed` |
| PDF / WhatsApp / Email share | `completed` |
| Reports, Excel export | `completed` |
| Consume Ready Stock | `pending` |
| Dispatch planning | `pending` |
| Vehicle loading / QR scan | `deferred` |

**Dispatch workflow:** `DRAFT → LOADING → LOADED → DISPATCHED → DELIVERED` — `completed` in demo

### Module 13 — Delivery

`Dispatched → In Transit → Delivered` — capture POD, signature, photo, shortage/damage — `pending`

---

## 4. Application Architecture

```
ECOVENT OPERATIONS
├── CRM / Sales (Customers, Enquiries, Projects, Quotations, POs, Customer Orders)
├── Engineering (Drawings, Design, Duct Schedules)
├── Manufacturing (Planning, MOs, Production, QC, Ready Stock)
├── Dispatch (Planning, Dispatches, Deliveries)
├── Reporting
└── Workflow (Designer, audit)
```

| Surface | Users | Modules |
|---------|-------|---------|
| Admin Web Portal | Office, sales, engineering, management | CRM, Engineering, Sales, Mfg planning, Reports, Workflow |
| Mobile PWA | Shop floor, dispatch operators | Production, Ready Stock, Dispatch, Delivery |

| Layer | Technology | Status |
|-------|------------|--------|
| Frontend | React + TypeScript + Vite | `completed` |
| UI | Tailwind + Trust Blue Pay | `completed` |
| State | Zustand | `completed` |
| API | Fastify + Zod | `in-progress` (enquiry, order, dispatch routes) |
| Database | PostgreSQL + Prisma | `in-progress` (schema + seed) |
| Auth | JWT + RBAC (6 roles) | `in-progress` (login wired in API mode) |
| Workflow engine | Custom | `pending` |
| File storage | S3 / local | `pending` |

---

## 5. Workflow Engine

**Do not hard-code statuses in frontend.**

```
Entity → Workflow Instance → Current State → Allowed Transitions → Workflow History
```

**Transition properties:** From/To state, Action, Allowed Roles, Conditions, Required Fields/Documents, Notification, Audit

| Workflow | States | Status |
|----------|--------|--------|
| Enquiry | NEW → DRAWING RECEIVED → DESIGN REVIEW → QUOTATION → WON/LOST | `pending` |
| Quotation | DRAFT → INTERNAL REVIEW → SENT → CUSTOMER REVIEW → ACCEPTED/REVISION/LOST | `pending` |
| Customer Order | DRAFT → PO RECEIVED → VERIFICATION → CONFIRMED → IN PRODUCTION → READY → PARTIAL/FULL DISPATCH → DELIVERED → CLOSED | `evolve` |
| Manufacturing | PLANNED → MATERIAL PREP → IN PRODUCTION → QC → COMPLETED → READY | `pending` |
| Dispatch | DRAFT → LOADING → LOADED → DISPATCHED → DELIVERED | `completed` → `evolve` |

**Three concepts (not one status field):**

| Concept | Example |
|---------|---------|
| Workflow State | QUOTATION |
| Operational Status | IN PRODUCTION |
| Flags | ⚠ Customer Hold, ⚠ Payment Pending |

**On Hold:** Use flag on current state, not a permanent workflow position.

| Requirement | Status |
|-------------|--------|
| Workflow tables + state machine engine | `pending` |
| Workflow Designer admin UI | `pending` |
| Workflow history / audit | `pending` |
| Internal → customer-visible state mapping | `deferred` |

---

## 6. Database Design

**Core tables:** `customers`, `contacts`, `projects`, `enquiries`, `enquiry_documents`, `drawings`, `drawing_revisions`, `design_jobs`, `design_revisions`, `duct_schedules`, `duct_schedule_items`, `quotations`, `quotation_revisions`, `customer_pos`, `customer_orders`, `customer_order_items`, `manufacturing_orders`, `manufacturing_items`, `production_records`, `quality_checks`, `vehicles`, `drivers`, `dispatches`, `dispatch_items`, `deliveries`, `notifications`, `documents`, `audit_logs`

**Workflow tables:** `workflow_definitions`, `workflow_states`, `workflow_transitions`, `workflow_transition_roles`, `workflow_required_fields`, `workflow_instances`, `workflow_history`

**Document chain (every record retains parent reference):**

`Customer → Project → Enquiry → Drawing Rev → Design Rev → Duct Schedule Rev → Quotation Rev → PO → Customer Order → MO → Ready Stock → Dispatch → Delivery`

| Table group | Status |
|-------------|--------|
| CRM / Engineering / Sales / Manufacturing / Delivery | `pending` |
| Dispatch | `evolve` (mock JSON + localStorage) |
| Workflow engine | `pending` |

---

## 7. Navigation & Dashboard

### Current (Phase 1) — `completed`

`Dashboard | Orders | Dispatch | Reports | Settings`

### Target

`Dashboard` · `CRM` (Customers, Leads, Enquiries, Projects) · `Engineering` (Drawings, Design, Duct Schedules) · `Sales` (Quotations, POs, Customer Orders) · `Manufacturing` (Planning, MOs, Production, Ready Stock) · `Dispatch` (Planning, Dispatches, Deliveries) · `Reports` · `Workflow` · `Settings`

### Target dashboard

Operations KPIs (Enquiries, Quotations, Confirmed, Production) + Fulfillment KPIs (Ready, Dispatch, Delivered, On Hold) + **My Work** queue (design approvals, POs to verify, dispatch today)

| Requirement | Status |
|-------------|--------|
| Phase 1 dispatch dashboard | `completed` |
| Operations dashboard + pipeline view | `completed` |
| Full ERP navigation | `completed` (demo) |

---

## 8. Event History & Audit

Per-entity event log + workflow history. Dispatch timeline at order level — `completed`.

---

## 9. What NOT To Do

| Anti-pattern | Why |
|--------------|-----|
| `orders.status = "quotation"` / `"production"` | Mixes lifecycle in one table |
| Overwriting drawing files on revision | Loses audit trail |
| Auto-converting PO to confirmed order | Skips verification |
| One status field for everything | Unmaintainable |
| Building all modules before next demo | Delays validation |
| Throwing away Phase 1 dispatch demo | Downstream module is proven |

---

## 10. Development Sprints

| Sprint | Scope | Status |
|--------|-------|--------|
| **1** | Keep Order→Dispatch; add nav shell, workflow viz, rebrand | `completed` |
| **2** | Enquiry → Design Review → Order | `completed` (simplified demo) |
| **3** | Manufacturing + Dispatch on order | `completed` (simplified demo) |

### Simplified demo workflow (current UI)

End-to-end path navigable in the demo without backend:

1. **New Enquiry** — Dashboard or Enquiries → **New Enquiry** → `/enquiries/new` form (customer, project, assignment, drawing upload)
2. **Design Review** — Enquiry detail → Start Design Review → enter duct tags / qty / area → Save → Approve Design
3. **Convert to Order** — Creates a production order only after design approval (no order on enquiry create)
4. **Manufacturing** — Mark Ready for Dispatch on enquiry or order detail
5. **Dispatch** — Create Dispatch → vehicle → preview → confirm (existing Phase 1 flow)
| **4** | Quotation / PO / Projects (separate screens) | `cancelled` — removed from UI |
| **5** | Monetary fields in UI | `cancelled` — removed from UI |
| **6** | Workflow engine + Designer UI | `pending` |

### Demo Phase 2 — client presentation scope

Build only: Customers, Enquiries, Drawings, Design status, Duct schedule, Quotation, Customer PO, Customer Order, Manufacturing status, **existing Dispatch**.

**Demo story:** `Customer → Enquiry → Upload Drawing → Design → Extract Ducts → Quotation → PO → Confirm Order → Production → Dispatch`

---

## 11. Phase 1 Dispatch Module (Completed)

The following was built in the Phase 1 web demo and must be retained/evolved.

### Screens

| # | Screen | Status |
|---|--------|--------|
| 1 | Login / Splash (ECOVENT branded) | `completed` |
| 2 | Dashboard | `completed` |
| 3 | Orders (card list, search, filters) | `completed` |
| 4 | Order Detail (summary, items, timeline) | `completed` |
| 5 | Create Dispatch (+/− per tag) | `completed` |
| 6 | Vehicle Details | `completed` |
| 7 | Dispatch Preview | `completed` |
| 8 | Dispatch Confirmation | `completed` |
| 9 | Dispatch History / List | `completed` |
| 10 | Dispatch Note / PDF | `completed` |
| 11 | WhatsApp / Email share | `completed` |
| 12 | Reports + Excel export | `completed` |
| 13 | Settings / Demo Reset | `completed` |

### Core business logic (validated)

- [x] `Total Dispatched = Previous Dispatches + Current Dispatch`
- [x] `Balance = Ordered Qty − Total Dispatched`
- [x] `Balance Area = Ordered Area − Dispatched Area`
- [x] Cannot dispatch more than available per tag
- [x] Multiple trips sum to full order quantity
- [x] Auto status → Fully Dispatched when balance = 0

### Sample demo order — AIRMASTER-WO-845

| Field | Value |
|-------|-------|
| Customer | NEW KC |
| Total Qty | 18 |
| Total Area | 55.01 sq.m |
| Pre-dispatched | 7 qty (1 trip) |
| Balance | 11 qty |
| Tags | 12 line items |

### Phase 1 assets

| Asset | Location | Status |
|-------|----------|--------|
| Web portal UI | `src/` | `completed` |
| Service layer | `src/services/` | `completed` |
| Sample data | `src/data/` | `completed` |
| PDF / share / Excel | `src/lib/` | `completed` |
| User guide PDF | `docs/ECOVENT-Admin-Portal-Guide.pdf` | `completed` |
| Mobile dispatch guide PDF | `docs/ECOVENT-Mobile-Dispatch-Guide.pdf` | `completed` |

**Refactor target:** `orderService` / `orders` → `customerOrderService` / `customer_orders`, fed by duct schedule and ready stock.

---

## 12. Industry Reference

| ERP pattern (e.g. ERPNext) | ECOVENT equivalent |
|----------------------------|-------------------|
| Quotation | Quotation |
| Sales Order | Customer Order |
| Work Order | Manufacturing Order |
| Delivery Note | Dispatch + Delivery |

**Custom IP:** Engineering layer (Enquiry → Drawing → Design → Duct Schedule) is domain-specific and first-class.

---

## 13. Progress Summary

| Area | Completed | Pending | Evolve |
|------|-----------|---------|--------|
| Dispatch (Phase 1) | ~25 | 3 | 5 |
| CRM / Sales | 0 | ~40 | 0 |
| Engineering | 0 | ~30 | 2 |
| Manufacturing | 0 | ~25 | 1 |
| Delivery | 0 | ~10 | 0 |
| Workflow engine | 0 | ~20 | 1 |
| Platform / API / DB | ~20 (demo UI) | ~5 (backend) | 5 |

**Overall:** Phase 1 dispatch demo `completed`. Full Order-to-Delivery product `pending`.

---

## 14. Next Actions

1. Present Phase 1 dispatch + revised roadmap to client
2. Sprint 1 — Navigation shell, ECOVENT Operations branding
3. Sprint 2 — Pre-order modules with mock data + service layer
4. Freeze dispatch UI on client approval
5. Sprints 3–6 — Commercial, manufacturing, dispatch integration, workflow engine
6. **Demo screens complete** — full lifecycle navigable with mock data; backend deferred until client approves demo
7. PostgreSQL + API behind existing service interfaces (`server/` scaffold ready when needed)

---

*ECOVENT AIR SYSTEMS INDIA LLP — Quality Ducts Is Our Business*

# ECOVENT Dispatch — Admin Web Portal

**Product:** Aircon Duct Order & Multi-Trip Dispatch Management System  
**Company:** ECOVENT AIR SYSTEMS INDIA LLP — *Quality Ducts Is Our Business*  
**Version:** 1.0 Demo (Phase 1)  
**Last updated:** 18 September 2026

> **PDF User Guide (with screenshots):** [`docs/ECOVENT-Admin-Portal-Guide.pdf`](docs/ECOVENT-Admin-Portal-Guide.pdf)  
> **Mobile Dispatch PWA guide:** [`docs/ECOVENT-Mobile-Dispatch-Guide.pdf`](docs/ECOVENT-Mobile-Dispatch-Guide.pdf) · [`MOBILE_DISPATCH.md`](MOBILE_DISPATCH.md)  
> Regenerate after UI changes: `npm run docs:pdf` / `npm run docs:mobile-pdf` / `npm run docs:all` (requires dev server on port 5173)

---

## 1. Overview

The ECOVENT Dispatch Admin Web Portal is a browser-based application for managing air-conditioning duct orders and vehicle-wise dispatches. It is designed for office staff, dispatch operators, and management to monitor orders, create multi-trip dispatches, and share dispatch updates with customers.

The portal follows a simple principle:

> **Order ≠ Dispatch**

An order is the parent transaction. Each vehicle trip is recorded as a separate dispatch. One order can have many dispatches until the full quantity is delivered.

### Who is it for?

| Role | Primary use |
|------|-------------|
| **Office / Admin** | Monitor orders, review reports, export data, reset demo |
| **Dispatch operator** | Create dispatches, enter vehicle details, share dispatch notes |
| **Management** | View KPIs, daily dispatch summary, vehicle and order reports |

### Current scope (Phase 1 demo)

This is a **working demo** with mock data and local browser storage. It does not yet connect to a live database, Excel import, or user authentication. Those are planned for Phase 2.

---

## 2. Getting Started

### Run the application

```bash
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

### Login

1. Open the login screen branded with **ECOVENT Air Systems India LLP**
2. Click **Enter Demo** to access the portal
3. No username or password is required in the demo version

### Navigation

The portal uses a **left sidebar** with five main sections:

| Menu | Purpose |
|------|---------|
| **Dashboard** | Today's overview, KPIs, featured order, recent dispatches |
| **Orders** | Browse and search all orders |
| **Dispatch** | View all dispatch trips |
| **Reports** | Management reports and Excel exports |
| **Settings** | Demo reset and application info |

A **Create Dispatch** button is always available in the top header for quick access to the orders list.

---

## 3. Core Concepts

### Order

A duct manufacturing job imported from the office Excel sheet. Each order contains:

- Job / order number (e.g. `AIRMASTER-WO-845`)
- Customer name
- Production date
- Total quantity and total area
- Multiple **tags** (individual duct line items)

### Tag (Order Item)

Each duct piece or batch within an order:

| Field | Example |
|-------|---------|
| Tag number | 1, 2, 3… |
| Description | OFLINE |
| Dimensions | W1 × H1 × W2 × H2 × Length (mm) |
| Quantity | Number of ducts |
| Area | Surface area (sq.m) |

### Dispatch (Trip)

A single vehicle shipment from an order. Each dispatch records:

- Dispatch number (e.g. `D-2026-0092`)
- Vehicle and driver details
- Which tags and quantities were loaded
- Dispatch date and status

### Quantity tracking

For every order and tag, the system maintains:

| Metric | Meaning |
|--------|---------|
| **Ordered** | Total quantity on the original order |
| **Dispatched** | Quantity already sent on previous trips |
| **Balance** | Quantity still remaining to dispatch |
| **Available** | Quantity ready to dispatch now (based on ready stock) |

**Rules enforced by the system:**

- Dispatch quantity cannot exceed available balance per tag
- Total dispatched across all trips cannot exceed ordered quantity
- When balance reaches zero, the order status becomes **Fully Dispatched**

---

## 4. Screen-by-Screen Guide

### 4.1 Dashboard

The home screen shows the current operational picture.

**KPI cards:**

- Total orders
- Orders ready for dispatch
- Orders with dispatches in progress
- Today's dispatch trips and quantity

**Featured order**

Highlights the primary demo order `AIRMASTER-WO-845` with:

- Ordered / Dispatched / Balance counts
- Quick **Create Dispatch** action

**Recent dispatches**

A list of the latest vehicle trips with dispatch number, order reference, quantity, and status.

---

### 4.2 Orders

Browse all orders in a **card layout** (not a dense spreadsheet).

**Each order card shows:**

- Job name and customer
- Status chip (Ready, Partially Dispatched, Fully Dispatched, Production, etc.)
- Total quantity and area
- Dispatched and balance counts
- Progress bar (% dispatched)
- **Dispatch** button (when items are available)

**Search**

Search by:

- Order number
- Customer name
- Job name
- Dispatch number
- Vehicle number

**Filters**

| Filter | Shows |
|--------|-------|
| All | Every order |
| Ready | Orders ready for first dispatch |
| Partial | Partially dispatched orders |
| Fully Dispatched | Completed orders |
| Today | Orders from today |
| Overdue | Orders past production date, not yet complete |

---

### 4.3 Order Detail

Click any order card to open the full order view.

**Order summary**

- Ordered, Dispatched, Balance, and Area totals
- Visual progress bar with percentage
- **Create Dispatch** button

**Items list**

Every tag displayed with:

- Dimensions (W × H × L)
- Ordered, Dispatched, and Balance per tag

**Dispatch history timeline**

A chronological timeline showing:

- Each past dispatch (newest first)
- Dispatch number, date, vehicle, quantity, area, status
- Order created event at the bottom

---

### 4.4 Create Dispatch (4-step workflow)

The dispatch workflow is designed for fast, error-free operation.

#### Step 1 — Select Items

- Each available tag shown with dimensions and **available quantity**
- Large **+ / −** buttons to set dispatch quantity per tag
- **Select All Available** shortcut to fill all tags at once
- The + button is disabled when maximum available quantity is reached
- Cannot dispatch more than the remaining balance

#### Step 2 — Vehicle Details

**Required fields:**

| Field | Example |
|-------|---------|
| Vehicle Number | AP02AB1234 |
| Driver Name | Ramesh |
| Driver Mobile | 9876543210 |
| Transporter | ABC Transport |
| Vehicle Type | 32 ft |
| Loading Date | 18/09/2026 |
| Loading Time | 10:30 |

**Optional fields** (expandable):

- LR number
- E-way bill number
- Driver ID
- Transporter contact
- Destination
- Remarks

#### Step 3 — Dispatch Preview

Review before confirming:

- Order and customer details
- Vehicle and driver
- Item list with quantities
- Current dispatch quantity and area
- Previous dispatched total
- Total after this dispatch
- Remaining balance

#### Step 4 — Dispatch Confirmation

After confirmation:

- Success screen with new dispatch number
- Order, vehicle, quantity, area, and updated balance
- **Order Fully Dispatched** message when balance reaches zero

**Actions available:**

| Action | Description |
|--------|-------------|
| View Dispatch Note | Open formatted dispatch document |
| Share WhatsApp | Opens WhatsApp with pre-filled message |
| Send Email | Opens email client with subject and body |
| Download PDF | Downloads dispatch note as PDF file |

---

### 4.5 Dispatch List

View all vehicle trips across all orders.

Each row shows:

- Dispatch number
- Order number and customer
- Date and vehicle number
- Quantity and area
- Status (Dispatched, etc.)

Click any row to open the full **Dispatch Note**.

---

### 4.6 Dispatch Note

A printable dispatch document containing:

**Header**

- ECOVENT AIR SYSTEMS INDIA LLP
- *Quality Ducts Is Our Business*

**Details**

- Dispatch number, order number, customer
- Vehicle, driver, date

**Item table**

| Tag | Description | Dimensions | Qty | Area |
|-----|-------------|------------|-----|------|

**Summary**

- Current dispatch quantity and area
- Total order quantity
- Total dispatched to date
- Balance remaining

**Signature blocks**

- Prepared By / Driver / Received By

**Share options**

- WhatsApp, Email, PDF download

---

### 4.7 Reports

Management reporting and data export.

**KPI summary**

- Today's orders
- Pending orders
- Partially dispatched count
- Fully dispatched count

**Daily Dispatch report**

| Column | Description |
|--------|-------------|
| Date | Dispatch date |
| Orders | Number of orders dispatched |
| Trips | Number of vehicle trips |
| Qty | Total quantity dispatched |
| Area | Total area dispatched |
| Vehicles | Number of vehicles used |

**Order Report**

Per-order breakdown: ordered, dispatched, balance, and status.  
On mobile, shown as cards for readability. On desktop, shown as a full table.

**Vehicle Report**

Per-vehicle summary: number of trips, orders served, total quantity, total area.

**Excel export**

Download Excel files for:

| Export | Contents |
|--------|----------|
| Original Order | Full tag list as imported |
| Dispatch-wise | Every dispatch with tag details |
| Order Summary | Ordered / dispatched / balance per order |
| Vehicle Report | Trips and totals per vehicle |

---

### 4.8 Settings

**Demo Reset**

Clears all dispatches created during the demo session and restores the original seed data. Use this to restart a client demonstration.

**About**

Application name, version, and company information.

**Exit Demo**

Returns to the login screen.

---

## 5. Order Status Reference

| Status | Meaning |
|--------|---------|
| Draft | Order created but not finalised |
| Imported | Imported from Excel |
| Production | Manufacturing in progress |
| Ready | All items ready for dispatch |
| Partially Dispatched | Some quantity dispatched, balance remains |
| Fully Dispatched | All quantity dispatched |
| Closed | Order administratively closed |
| Cancelled | Order cancelled |

---

## 6. Dispatch Status Reference

| Status | Meaning |
|--------|---------|
| Draft | Dispatch being prepared |
| Loading | Vehicle loading in progress |
| Loaded | Loading complete |
| Dispatched | Vehicle has departed |
| Delivered | Goods received by customer |

---

## 7. Client Communication

After each dispatch, the portal can generate customer updates:

### WhatsApp message (example)

```
Dispatch Update

Order: AIRMASTER-WO-845
Customer: NEW KC
Dispatch No: D-2026-0098
Vehicle: AP02AB1234
Quantity: 5
Area: 14.20 Sq.m

Total dispatched: 12 / 18
Balance: 6

Dispatch Date: 18 Sep 2026

— ECOVENT AIR SYSTEMS INDIA LLP
```

### Email

Pre-filled subject and body with dispatch details, ready to send from the user's email client.

### PDF Dispatch Note

Professional PDF with company header, item table, summary, and signature sections.

---

## 8. Demo Data

The portal ships with sample data for demonstration.

### Primary demo order

| Field | Value |
|-------|-------|
| Job | AIRMASTER-WO-845 |
| Customer | NEW KC |
| Production Date | 17/09/2026 |
| Total Quantity | 18 ducts |
| Total Area | 55.01 sq.m |
| Tags | 12 line items |
| Already Dispatched | 7 qty (1 trip) |
| Balance | 11 qty |

### Additional sample orders

8 orders total across 4 customers, covering statuses: Ready, Partially Dispatched, Fully Dispatched, and Production.

### Sample dispatches

2 pre-loaded dispatch trips demonstrating multi-trip dispatch history.

---

## 9. Design & Usability

The portal uses the **Trust Blue Pay** design system:

- Navy blue primary colour for trust and professionalism
- Inter font with tabular numerals for quantities and areas
- Card-based layouts with clear spacing
- Colour-coded status chips (green = complete, gold = pending, red = error)
- Large touch-friendly buttons for dispatch quantity controls
- Confirmation step before every dispatch commit

**Design goals:**

- Not a traditional ERP — feels like a warehouse/dispatch app
- Minimum typing, maximum clarity
- Numbers and balances always visible
- One action per step in the dispatch workflow

---

## 10. Data & Technical Notes

### How data is stored (Phase 1)

| Layer | Technology |
|-------|------------|
| UI | React + TypeScript + Vite |
| Styling | Tailwind CSS (Trust Blue Pay tokens) |
| State | Zustand |
| Data | Mock JSON files + browser localStorage |
| PDF | jsPDF |
| Excel | SheetJS (xlsx) |

Dispatches created during a demo session are saved in the browser's localStorage. Refreshing the page keeps your data. Use **Reset Demo Data** in Settings to restore the original state.

### Service layer

The UI reads data through service modules (`orderService`, `dispatchService`, `reportService`), not directly from JSON files. This means the same UI can connect to a REST API in Phase 2 without major changes.

---

## 11. Typical Workflows

### Workflow A — Create a new dispatch trip

```
Dashboard or Orders
    → Select order (e.g. AIRMASTER-WO-845)
    → Create Dispatch
    → Set quantities with + / −
    → Enter vehicle details
    → Preview summary
    → Confirm
    → Share via WhatsApp / Email / PDF
```

### Workflow B — Check order progress

```
Orders
    → Open order
    → View summary (Ordered / Dispatched / Balance)
    → Review per-tag balances
    → Scroll dispatch history timeline
```

### Workflow C — Management review

```
Reports
    → Review KPI cards
    → Check Daily Dispatch table
    → Review Order Report
    → Export Excel for records
```

---

## 12. What Is Not Yet Included

The following are planned for future phases and are **not** in the current demo:

| Feature | Planned phase |
|---------|---------------|
| Excel order import | Phase 2 |
| User login and roles | Phase 2 |
| PostgreSQL database | Phase 2 |
| Dispatch cancellation | Phase 2 |
| WhatsApp Business API | Phase 4 |
| Server-side email | Phase 4 |
| Mobile PWA install | Phase 1 (remaining) |
| QR code scanning | Phase 3 |
| Production tracking | Phase 5 |
| Client portal | Phase 5 |

---

## 13. Validation Rules

The portal enforces these business rules automatically:

- [x] `Total Dispatched = Previous Dispatches + Current Dispatch`
- [x] `Balance = Ordered Qty − Total Dispatched`
- [x] `Balance Area = Ordered Area − Dispatched Area`
- [x] Cannot dispatch more than available per tag
- [x] Multiple trips can sum to the full order quantity
- [x] Order status updates to Fully Dispatched when balance = 0

---

## 14. Support & Next Steps

### For client demonstration

1. Open the portal and click **Enter Demo**
2. Walk through **AIRMASTER-WO-845** — show 18 ordered, 7 dispatched, 11 balance
3. Create a new dispatch trip using +/− controls
4. Show the preview and confirm
5. Share the WhatsApp message or download the PDF
6. Show updated balance on the order detail screen

### After client approval

1. Freeze the UI design
2. Build PostgreSQL + API backend (Phase 2)
3. Add Excel import and user authentication
4. Deploy to production server

---

*ECOVENT AIR SYSTEMS INDIA LLP — Quality Ducts Is Our Business*

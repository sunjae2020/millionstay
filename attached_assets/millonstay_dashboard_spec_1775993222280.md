# MillionStay PMS — Dashboard Development Specification

**Project:** MillionStay Property Management System  
**Phase:** Phase 1 — MVP (Replit / Vibe Coding)  
**Target Migration:** Phase 2 → C# .NET / ASP.NET Web API + EF Core  
**Version:** 1.0.0  
**Date:** April 2026  
**Author:** MillionStay Engineering

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Principles](#2-architecture-principles)
3. [Dashboard 1 — Overview](#3-dashboard-1--overview)
4. [Dashboard 2 — Reservations](#4-dashboard-2--reservations)
5. [Dashboard 3 — Finance](#5-dashboard-3--finance)
6. [Dashboard 4 — Operations](#6-dashboard-4--operations)
7. [Shared Components](#7-shared-components)
8. [Data Schema Reference](#8-data-schema-reference)
9. [API Endpoint Map](#9-api-endpoint-map)
10. [Phase 2 Migration Notes](#10-phase-2-migration-notes)

---

## 1. Project Overview

### 1.1 System Purpose

MillionStay PMS is a multi-property management platform designed to handle diverse accommodation types including PBSA (Purpose-Built Student Accommodation), hotels, and homestays. The dashboard layer provides real-time operational visibility across four core domains: property operations, reservations, finance, and facility management.

### 1.2 User Personas & Dashboard Access

| Persona | Dashboard Access | Primary Use Case |
|---|---|---|
| **Super Admin** | All 4 dashboards | Full system oversight, reporting |
| **Property Manager** | Overview, Reservations, Operations | Day-to-day property operations |
| **Receptionist** | Reservations | Check-in/out, guest management |
| **Finance Manager** | Finance, Overview (read-only) | Invoicing, revenue reporting |
| **Housekeeping** | Operations (filtered view) | Room status, work orders |

### 1.3 Technology Stack

```
Phase 1 (MVP — Replit)         Phase 2 (Production)
─────────────────────────      ──────────────────────────────
Frontend  : HTML / CSS / JS    Frontend  : React + TypeScript
Backend   : Python (Flask)     Backend   : ASP.NET Core Web API
Database  : PostgreSQL         Database  : SQL Server + EF Core
Auth      : JWT (simple)       Auth      : ASP.NET Identity + Azure AD B2C
Charts    : Chart.js 4.x       Charts    : Recharts / Chart.js
Hosting   : Replit             Hosting   : Azure App Service
```

### 1.4 Dashboard Navigation Structure

```
MillionStay PMS
│
├── Dashboard 1 — Overview          /dashboard/overview
├── Dashboard 2 — Reservations      /dashboard/reservations
├── Dashboard 3 — Finance           /dashboard/finance
└── Dashboard 4 — Operations        /dashboard/operations
    ├── Maintenance                  /operations/maintenance
    └── Housekeeping                 /operations/housekeeping
```

---

## 2. Architecture Principles

### 2.1 Clean Separation of Concerns

Each dashboard follows a strict three-layer pattern to minimise technical debt for the Phase 2 migration:

```
┌─────────────────────────────────────┐
│           Presentation Layer         │  HTML/CSS/JS → React
│     (UI Components, Layout)          │
├─────────────────────────────────────┤
│           Service Layer              │  Flask routes → ASP.NET Controllers
│  (Business Logic, Validation, DTOs)  │
├─────────────────────────────────────┤
│           Data Access Layer          │  Raw SQL / SQLite → EF Core
│    (Repository Pattern, Queries)     │
└─────────────────────────────────────┘
```

### 2.2 Design Patterns in Use

| Pattern | Applied Where | Phase 2 Equivalent |
|---|---|---|
| **Repository** | All DB access | `IPropertyRepository`, `IBookingRepository` |
| **Strategy** | Pricing engine (seasonal, dynamic) | `IPricingStrategy` interface |
| **Factory** | Booking creation per accommodation type | `BookingFactory.Create(type)` |
| **DTO** | All API request/response payloads | C# record types |
| **Observer** | Real-time alert notifications | SignalR Hub |

### 2.3 API-First Convention

All data displayed in dashboards must be fetched via REST endpoints — no direct DB calls from the UI layer. This ensures a clean 1:1 mapping to ASP.NET Web API controllers in Phase 2.

```
GET  /api/v1/dashboard/overview/summary
GET  /api/v1/reservations?status=active&date=today
POST /api/v1/reservations
GET  /api/v1/finance/invoices?month=2026-04
GET  /api/v1/operations/workorders?priority=urgent
```

---

## 3. Dashboard 1 — Overview

### 3.1 Purpose

The Overview dashboard serves as the operational command centre. It provides the Super Admin and Property Manager with a real-time snapshot of all critical business dimensions — occupancy, bookings, revenue, CRM pipeline, tasks, and integration health — on a single scrollable screen.

### 3.2 Layout Structure

```
┌──────────────────────────────────────────────────────────────┐
│  TOPBAR: Breadcrumb · Live Clock · Refresh · Notifications   │
├──────────────────────────────────────────────────────────────┤
│  ALERT STRIP: Dismissible urgent-action chips (scrollable)   │
├──────────────────────────────────────────────────────────────┤
│  PAGE HEADER: Title · Subtitle · [Export Report] [New Booking]│
├──────────────────────────────────────────────────────────────┤
│  SECTION 1: Today's Key Metrics (4-column KPI cards)         │
├──────────────────────────────────────────────────────────────┤
│  SECTION 2: Property Portfolio (2/3 table + 1/3 donut chart) │
├──────────────────────────────────────────────────────────────┤
│  SECTION 3: CRM Snapshot (1/2) + Revenue Chart (1/2)         │
├──────────────────────────────────────────────────────────────┤
│  SECTION 4: Open Tasks & Alerts (1/2) + Integrations (1/2)   │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 Components & Data

#### Section 1 — KPI Cards

| Card | Metric | Data Source | Refresh |
|---|---|---|---|
| Check-ins Today | Count of confirmed arrivals (today) | `bookings` WHERE `check_in_date = today AND status = 'confirmed'` | Real-time |
| Check-outs Today | Count of active bookings due out (today) | `bookings` WHERE `check_out_date = today AND status = 'active'` | Real-time |
| Occupancy Rate | `(occupied_spaces / total_spaces) * 100` | Aggregated from `spaces` + `bookings` | Every 5 min |
| Monthly Revenue | Sum of paid invoices for current month | `invoices` WHERE `status = 'paid' AND month = current` | Every 15 min |

**Occupancy Rate Badge Logic:**
```
>= 85%  → Green  "High Occupancy"
60–84%  → Amber  "X of Y spaces occupied"
< 60%   → Red    "Low Occupancy — action needed"
```

#### Section 2 — Property Table

**Columns:** Property Name · Location · Type · Status · Space Count · Occupancy Bar + %

**Row Status Rules:**

```
status = 'active'           → Green dot + "Active"
status = 'pending_approval' → Amber dot + "Pending Approval"
status = 'inactive'         → Grey dot  + "Inactive"
```

**Footer Statistics Row:** Total · Active · Pending · Spaces · Options · Regions · Policies

**Occupancy Donut Chart (Chart.js Doughnut):**

```javascript
// Segment breakdown — colours fixed by semantic meaning
segments = [
  { label: 'Occupied',              value: occupied_count,    color: '#00c896' },
  { label: 'Confirmed Booking',     value: confirmed_count,   color: '#3b82f6' },
  { label: 'Maintenance/Cleaning',  value: maintenance_count, color: '#f59e0b' },
  { label: 'Vacant',                value: vacant_count,      color: '#e8e4de' }
]
// Centre overlay: calculated occupancy % + label "Occupancy"
```

#### Section 3 — CRM Snapshot

**Stats Grid (2×2):** Total Contacts · All Accounts · Guest Accounts · Space Owners

**New Leads List (last 7 days):**

```
Lead Status Badges:
  New         → Blue
  Interested  → Green
  In Progress → Amber
  Under Review→ Blue
  Closed Won  → Green (filled)
  Closed Lost → Red
```

**Revenue Bar Chart (Chart.js Bar):**

```javascript
// 6 months rolling: current month highlighted in accent colour
// Past months: muted fill (#d4f0e8)
// Future months: dashed border, transparent fill — labelled "Projected"
// Y-axis hidden; value labels rendered above each bar
datasets = [{ data: [jan, feb, mar, apr_current, null, null] }]
```

**Revenue Footer Split:** Paid · Outstanding · Draft · Invoice counts

#### Section 4 — Open Tasks & Alerts

**Task Priority System:**

```
● Red    prio-red    → Urgent / Same-day resolution required
● Amber  prio-amber  → High / This-week resolution
● Blue   prio-blue   → Normal / Action recommended
● Grey   prio-gray   → Low / Monitor
```

**Action Buttons per task type:**

| Task Category | Button Label | Target Route |
|---|---|---|
| Maintenance | Resolve | `/operations/maintenance/{id}` |
| Property Approval | Review | `/properties/{id}/review` |
| Invoice Follow-up | Follow Up | `/finance/invoices/{id}` |
| Lead Response | View | `/crm/leads/{id}` |
| Overdue Task | Reassign | `/tasks/{id}/reassign` |

**Integration Status Cards:**

| Service | Status States | Indicator |
|---|---|---|
| Stripe | `Connected` / `Setup Required` / `Error` | Green / Amber / Red dot |
| Cloudinary | `Connected · {X} MB used` / `Quota Warning` | Green / Amber dot |
| Resend | `Connected` / `Disconnected` | Green / Grey dot |
| OpenStreetMap | `Built-in renderer` | Grey dot |

### 3.4 API Endpoints — Overview

```
GET  /api/v1/dashboard/overview/kpis          → { checkins, checkouts, occupancy, revenue }
GET  /api/v1/properties/summary               → [ { id, name, type, status, spaces, occ_pct } ]
GET  /api/v1/spaces/occupancy-breakdown       → { occupied, confirmed, maintenance, vacant }
GET  /api/v1/crm/summary                      → { contacts, accounts, guests, owners }
GET  /api/v1/crm/leads?days=7                 → [ { id, name, type, date, status } ]
GET  /api/v1/finance/revenue/monthly          → [ { month, amount, status } ]  (6 months)
GET  /api/v1/tasks/open?limit=5               → [ { id, title, priority, category } ]
GET  /api/v1/integrations/status              → [ { name, status, meta } ]
```

### 3.5 Phase 1 Implementation Checklist

- [x] Sidebar navigation with active state
- [x] Live clock (seconds tick)
- [x] Dismissible alert strip chips
- [x] 4 KPI cards with animated counter on load
- [x] Occupancy bar animation (CSS transition)
- [x] Property table with mini occupancy bars
- [x] Donut chart (Chart.js) with hover tooltips
- [x] CRM stats 2×2 grid
- [x] Lead list with status badges
- [x] Revenue bar chart (Chart.js) with current month highlight
- [x] Revenue footer split (Paid / Outstanding / Draft)
- [x] Open tasks list with priority dots and action buttons
- [x] Integration status cards
- [x] Responsive breakpoints (1200px / 900px / 760px)
- [ ] Live data from `/api/v1/dashboard/overview/kpis`
- [ ] Role-based field visibility (Super Admin vs. Property Manager)
- [ ] Alert strip auto-populated from `/api/v1/tasks/open?priority=urgent`

---

## 4. Dashboard 2 — Reservations

### 4.1 Purpose

The Reservations dashboard is the primary operational screen for Receptionists and Property Managers. It handles the full booking lifecycle: creation, check-in/out processing, status transitions, stay extensions, and the 7-day Gantt-style availability calendar.

### 4.2 Layout Structure

```
┌──────────────────────────────────────────────────────────────┐
│  TOPBAR: Breadcrumb · Live Clock · Notifications             │
├──────────────────────────────────────────────────────────────┤
│  ALERT STRIP: Today's urgent booking actions                 │
├──────────────────────────────────────────────────────────────┤
│  PAGE HEADER: Title · Date Picker · [New Reservation]        │
├──────────────────────────────────────────────────────────────┤
│  SECTION 1: Booking KPI Cards (4-column)                     │
├──────────────────────────────────────────────────────────────┤
│  SECTION 2: 7-Day Gantt Availability Calendar (full width)   │
├──────────────────────────────────────────────────────────────┤
│  SECTION 3: Today's Arrivals (1/2) + Today's Departures(1/2) │
├──────────────────────────────────────────────────────────────┤
│  SECTION 4: Recent Bookings Table (full width, paginated)    │
├──────────────────────────────────────────────────────────────┤
│  SECTION 5: Quick Booking Form (slide-in panel / modal)      │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 Components & Data

#### Section 1 — Booking KPI Cards

| Card | Metric | Calculation |
|---|---|---|
| Active Bookings | Currently checked-in guests | `status = 'active'` |
| Pending Approval | Bookings awaiting manager sign-off | `status = 'pending_approval'` |
| New This Week | Bookings created in last 7 days | `created_at >= NOW() - INTERVAL 7 DAYS` |
| Monthly Total | All bookings this calendar month | `MONTH(created_at) = MONTH(NOW())` |

#### Section 2 — Gantt Availability Calendar

The 7-day calendar is the centrepiece of the Reservations dashboard. It provides a horizontal timeline view of all active, confirmed, and pending bookings across all registered spaces.

**Visual Structure:**

```
┌────────────────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
│ Space          │ Sun  │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │ Sat  │
│                │  12  │  13  │  14  │  15  │  16  │  17  │  18  │
├────────────────┼──────┴──────┴──────┼──────┴──────┼──────┴──────┤
│ SH Unit 101    │ [   B-201 Active  ]│             │[B-205 Conf. ]│
├────────────────┼──────┬─────────────┴─────────────┼─────────────┤
│ SH Unit 102    │      │  [    B-198 Confirmed    ] │             │
├────────────────┼──────┴──────────────────┬─────────┴─────────────┤
│ 118 Kav. 201   │ [B-189 Active · C-B01 ] │ [  B-202 Confirmed  ]  │
├────────────────┼──────────────┬──────────┴──────┬─────────────────┤
│ 118 Kav. 202   │              │ [ B-190 Pending ]│                │
└────────────────┴──────────────┴─────────────────┴─────────────────┘
```

**Booking Bar Colour Coding:**

```css
/* Status → Background → Text Colour */
Draft             #f8fafc  →  #64748b   /* light grey, dashed border */
Pending Payment   #fef9c3  →  #854d0e   /* yellow */
Pending Approval  #fff7ed  →  #9a3412   /* orange */
Confirmed         #dbeafe  →  #1e40af   /* blue */
Active            #dcfce7  →  #166534   /* green */
Checked Out       #fee2e2  →  #991b1b   /* red/muted */
Cancelled         #f1f5f9  →  #94a3b8   /* grey, strikethrough */
```

**Calendar Navigation:**
- Previous / Next week navigation arrows
- "Today" jump button
- Date range picker for custom window (up to 30 days)
- Click on booking bar → opens booking detail drawer

**Overbooking Prevention Logic:**

```
CRITICAL RULE: Before saving any booking, the system must query:
  SELECT COUNT(*) FROM bookings
  WHERE space_id = :space_id
    AND status NOT IN ('cancelled', 'checked_out')
    AND check_in_date < :new_check_out_date
    AND check_out_date > :new_check_in_date

If COUNT > 0 → REJECT with error: "Space unavailable for selected dates"
This validation must exist in the Service Layer, NOT just the UI.
```

#### Section 3 — Today's Arrivals & Departures

**Arrivals Panel:**

Each arrival card shows: Guest avatar · Guest name · Booking reference · Space name · ETA (if provided) · [Check In] action button

**Departures Panel:**

Each departure card shows: Guest avatar · Guest name · Booking reference · Space name · Payment status badge · [Check Out] action button

**Check-in Workflow:**

```
1. Receptionist clicks [Check In]
2. System validates: booking status = 'confirmed', date = today
3. If payment outstanding → show payment warning modal
4. On confirm → PATCH /api/v1/bookings/{id}/checkin
5. Booking status → 'active'
6. Space status → 'occupied'
7. System log entry created: "Check-in processed by {user} at {timestamp}"
```

**Check-out Workflow:**

```
1. Receptionist clicks [Check Out]
2. System validates: booking status = 'active'
3. Check for outstanding balance → if yes, block checkout with payment modal
4. On confirm → PATCH /api/v1/bookings/{id}/checkout
5. Booking status → 'checked_out'
6. Space status → 'needs_cleaning'
7. Auto-create housekeeping work order for the space
8. System log entry created: "Check-out processed by {user} at {timestamp}"
```

#### Section 4 — Bookings Table

**Columns:** Ref # · Guest · Property / Space · Check-in · Check-out · Nights · Amount · Status · Actions

**Filter Controls:**
- Status filter: All / Draft / Pending / Confirmed / Active / Checked Out / Cancelled
- Property filter: dropdown of all active properties
- Date range: check-in window picker
- Search: guest name or booking reference

**Pagination:** 20 rows per page, server-side pagination

#### Section 5 — Quick Booking Form (Slide-in Panel)

**Required Fields:**

```
Guest:          [ Search existing guest ] or [ + Add new guest ]
Property:       [ Dropdown — active properties only ]
Space:          [ Dropdown — filtered by property, available dates only ]
Check-in Date:  [ Date picker ]
Check-out Date: [ Date picker — must be > check-in ]
Rate Plan:      [ Dropdown — rates for selected space ]
Special Requests: [ Textarea — optional ]
Payment Method: [ Select: Cash / Bank Transfer / Online / Invoice ]

Computed (read-only):
  Duration: X nights
  Base Rate: ₩X per night
  Subtotal:  ₩X
  Tax (10%): ₩X
  Total:     ₩X
```

**Validation Rules:**

```
- check_out_date must be > check_in_date
- Selected space must pass overbooking check for date range
- Guest must be an existing contact OR new contact form completed
- Rate must be > 0
- If status = 'confirmed', payment method is required
```

### 4.4 Booking Status State Machine

```
                 ┌──────────────────────────────────────────┐
                 │                                          │
  [Created] ──► Draft ──► Pending Payment ──► Confirmed ──► Active ──► Checked Out
                  │              │                │            │
                  └──────────────┴────────────────┴──► Cancelled
                                                       (any stage before Active)

  Draft           : Booking saved, no payment/approval yet
  Pending Payment : Awaiting guest payment
  Pending Approval: Payment received, awaiting manager approval
  Confirmed       : Approved and ready for check-in
  Active          : Guest is currently checked in
  Checked Out     : Stay completed
  Cancelled       : Booking voided (refund rules apply)
```

### 4.5 API Endpoints — Reservations

```
GET    /api/v1/bookings                              → paginated list with filters
GET    /api/v1/bookings/{id}                         → single booking detail
POST   /api/v1/bookings                              → create new booking
PATCH  /api/v1/bookings/{id}                         → update booking fields
DELETE /api/v1/bookings/{id}                         → cancel booking
PATCH  /api/v1/bookings/{id}/checkin                 → process check-in
PATCH  /api/v1/bookings/{id}/checkout                → process check-out
PATCH  /api/v1/bookings/{id}/extend                  → extend stay (new check-out date)
GET    /api/v1/bookings/calendar?start=&end=         → Gantt data (spaces + booking bars)
GET    /api/v1/bookings/today/arrivals               → today's check-ins
GET    /api/v1/bookings/today/departures             → today's check-outs
GET    /api/v1/spaces/availability?space_id=&start=&end=  → availability check
```

### 4.6 Phase 1 Implementation Checklist

- [x] 4 KPI cards with animated counters
- [x] 7-day Gantt calendar with colour-coded booking bars
- [x] Booking status colour legend
- [x] Today's arrivals panel with guest avatars
- [x] Today's departures panel
- [ ] Check-in workflow with payment validation modal
- [ ] Check-out workflow with auto housekeeping work order
- [ ] Calendar week navigation (prev / next)
- [ ] Click booking bar → drawer with booking detail
- [ ] Quick booking form (slide-in panel)
- [ ] Overbooking prevention validation (service layer)
- [ ] Stay extension modal (Extend Stay button)
- [ ] Recent bookings table with server-side pagination
- [ ] Filter bar (status, property, date range, search)
- [ ] Booking status state machine enforced in API

---

## 5. Dashboard 3 — Finance

### 5.1 Purpose

The Finance dashboard gives the Finance Manager and Super Admin a complete picture of revenue performance, invoice pipeline, and payment status. It supports invoice creation, status tracking, and monthly revenue analysis with drill-down capability.

### 5.2 Layout Structure

```
┌──────────────────────────────────────────────────────────────┐
│  TOPBAR: Breadcrumb · Live Clock · Notifications             │
├──────────────────────────────────────────────────────────────┤
│  PAGE HEADER: Title · Month Selector · [Create Invoice]      │
├──────────────────────────────────────────────────────────────┤
│  SECTION 1: Financial KPI Cards (4-column)                   │
├──────────────────────────────────────────────────────────────┤
│  SECTION 2: Revenue Trend Chart (2/3) + Payment Donut (1/3)  │
├──────────────────────────────────────────────────────────────┤
│  SECTION 3: Invoice List (full width, filterable + actions)  │
├──────────────────────────────────────────────────────────────┤
│  SECTION 4: Revenue by Property (1/2) + Tax Summary (1/2)    │
└──────────────────────────────────────────────────────────────┘
```

### 5.3 Components & Data

#### Section 1 — Financial KPI Cards

| Card | Metric | Formula |
|---|---|---|
| Total Revenue (Settled) | Sum of paid invoices this month | `SUM(amount) WHERE status='paid' AND month=current` |
| Sent Invoices | Count awaiting payment | `COUNT WHERE status='sent'` |
| Paid Invoices | Count completed this month | `COUNT WHERE status='paid' AND month=current` |
| Draft Invoices | Count not yet sent | `COUNT WHERE status='draft'` |

#### Section 2 — Revenue Trend + Payment Donut

**Revenue Trend Chart (Chart.js Line/Bar):**

```javascript
// 12-month rolling window
// Current month bar: accent green (#00c896)
// Historical bars:   muted teal (#d4f0e8)
// Projected months:  dashed, transparent
// Tooltip: "₩X.XM · N invoices"
// Secondary metric overlay: booking count per month (line)
```

**Payment Status Donut (Chart.js Doughnut):**

```javascript
segments = [
  { label: 'Paid',        value: paid_amount,    color: '#00c896' },
  { label: 'Outstanding', value: sent_amount,    color: '#f59e0b' },
  { label: 'Draft',       value: draft_amount,   color: '#94a3b8' },
  { label: 'Overdue',     value: overdue_amount, color: '#ef4444' }
]
// Centre: total revenue figure + "Total Billed"
// Overdue = sent invoices where due_date < TODAY
```

#### Section 3 — Invoice List

**Columns:** Invoice # · Guest / Company · Property · Issue Date · Due Date · Amount · Status · Actions

**Invoice Status Badges:**

```
Draft       → Grey     "Not yet sent"
Sent        → Amber    "Awaiting payment"
Paid        → Green    "Payment confirmed"
Overdue     → Red      "Past due date"
Cancelled   → Grey     "Voided"
```

**Overdue Logic:**

```sql
UPDATE invoices
SET status = 'overdue'
WHERE status = 'sent'
  AND due_date < CURRENT_DATE
-- Run as a scheduled job (nightly) or trigger on page load
```

**Action Buttons per Invoice Status:**

```
Draft   → [Edit] [Send Invoice] [Delete]
Sent    → [Mark as Paid] [Send Reminder] [View PDF]
Paid    → [View PDF] [Issue Receipt]
Overdue → [Mark as Paid] [Send Final Notice] [View PDF]
```

**Invoice PDF Generation:**

```
Template fields:
  MillionStay logo + address
  Invoice number (#INV-YYYY-NNNN)
  Issue date / Due date
  Bill to: Guest name + address
  Line items: { description, nights, rate, subtotal }
  Subtotal / Tax (10%) / Total
  Payment instructions
  Footer: terms and conditions
```

#### Section 4 — Revenue by Property + Tax Summary

**Revenue by Property (Horizontal Bar Chart):**

```javascript
// One bar per property
// Bar length proportional to revenue share
// Colour: same accent palette, ordered by revenue DESC
// Shows: property name · ₩amount · % of total
```

**Tax Summary Table:**

```
Period    | Gross Revenue | Tax Rate | Tax Collected | Net Revenue
--------------------------------------------------------------
Apr 2026  | ₩7,480,000   | 10%      | ₩680,000      | ₩6,800,000
Mar 2026  | ₩6,710,000   | 10%      | ₩610,000      | ₩6,100,000
Feb 2026  | ₩5,610,000   | 10%      | ₩510,000      | ₩5,100,000
```

**Dynamic Pricing Notes:**

```
The system supports three pricing tiers per space:
  Base Rate      : Standard nightly rate
  Seasonal Rate  : Overrides base for defined date ranges (peak / off-peak)
  Dynamic Rate   : Calculated at booking time based on occupancy threshold

Pricing Strategy (Strategy Pattern):
  IPricingStrategy
  ├── BasePricingStrategy       → base_rate
  ├── SeasonalPricingStrategy   → seasonal_rates table lookup
  └── DynamicPricingStrategy    → if occupancy > 80% → base * 1.2
                                  if occupancy < 40% → base * 0.85
```

### 5.4 API Endpoints — Finance

```
GET    /api/v1/finance/summary?month=              → KPI totals
GET    /api/v1/finance/revenue/monthly?months=12   → 12-month trend data
GET    /api/v1/finance/revenue/by-property         → revenue breakdown per property
GET    /api/v1/finance/invoices                    → paginated invoice list (filters: status, month, property)
GET    /api/v1/finance/invoices/{id}               → single invoice detail
POST   /api/v1/finance/invoices                    → create invoice from booking
PATCH  /api/v1/finance/invoices/{id}               → update invoice
PATCH  /api/v1/finance/invoices/{id}/send          → send to guest (triggers Resend email)
PATCH  /api/v1/finance/invoices/{id}/paid          → mark as paid (+ Stripe webhook alt)
GET    /api/v1/finance/invoices/{id}/pdf           → generate + return PDF
GET    /api/v1/finance/tax-summary?year=           → quarterly/monthly tax report
POST   /api/v1/finance/invoices/{id}/reminder      → send payment reminder email
```

### 5.5 Phase 1 Implementation Checklist

- [x] 4 KPI cards (total revenue, sent, paid, draft)
- [x] Monthly revenue bar chart — 6-month rolling
- [x] Payment status donut chart
- [x] Revenue footer split (Paid / Outstanding / Draft / invoice counts)
- [ ] 12-month revenue trend with booking count overlay
- [ ] Invoice list table with full filter controls
- [ ] Invoice status badges with overdue detection
- [ ] Action buttons per invoice status
- [ ] Revenue by property horizontal bar chart
- [ ] Tax summary table with monthly breakdown
- [ ] Invoice creation modal (bound to bookings)
- [ ] Send invoice → Resend email integration
- [ ] PDF generation endpoint + preview
- [ ] Dynamic pricing strategy indicator per booking
- [ ] Overdue invoice nightly job / page-load trigger
- [ ] Stripe webhook handler (mark paid on payment event)

---

## 6. Dashboard 4 — Operations

### 6.1 Purpose

The Operations dashboard serves Property Managers and Housekeeping staff. It consolidates maintenance work orders and housekeeping room status into a single operational view, enabling rapid response to facility issues and efficient room turnaround between guest stays.

### 6.2 Layout Structure

```
┌──────────────────────────────────────────────────────────────┐
│  TOPBAR: Breadcrumb · Live Clock · Notifications             │
├──────────────────────────────────────────────────────────────┤
│  PAGE HEADER: Title · [New Work Order] [Refresh Status]      │
├──────────────────────────────────────────────────────────────┤
│  SECTION 1: Operations KPI Cards (4-column)                  │
├──────────────────────────────────────────────────────────────┤
│  SECTION 2: Work Orders List (2/3) + Priority Chart (1/3)    │
├──────────────────────────────────────────────────────────────┤
│  SECTION 3: Housekeeping Room Grid (full width)              │
├──────────────────────────────────────────────────────────────┤
│  SECTION 4: Staff Task Assignment (1/2) + Activity Log (1/2) │
└──────────────────────────────────────────────────────────────┘
```

### 6.3 Components & Data

#### Section 1 — Operations KPI Cards

| Card | Metric | Data Source |
|---|---|---|
| Open Work Orders | Count of pending/in-progress orders | `work_orders WHERE status IN ('open','in_progress')` |
| In Progress | Currently active assignments | `work_orders WHERE status = 'in_progress'` |
| Urgent Issues | High priority open orders | `work_orders WHERE priority = 'urgent' AND status != 'completed'` |
| Completed This Month | Closed orders this month | `work_orders WHERE status = 'completed' AND MONTH(completed_at) = current` |

#### Section 2 — Work Orders List + Priority Chart

**Work Order Card Fields:**

```
Title:          Short description of the issue
Location:       Property name + Unit/Space
Priority:       Urgent / High / Medium / Low
Assigned To:    Staff member name (or "Unassigned")
Reported By:    Guest / Staff / System
Created At:     Date + time
Due Date:       Expected resolution date
Status:         Open / In Progress / Completed / Deferred
Notes:          Latest update comment
```

**Work Order Priority System:**

```
● Urgent   Red    → Guest-impacting, same-day resolution (SLA: 4 hours)
● High     Amber  → Non-critical but affects guest comfort (SLA: 24 hours)
● Medium   Blue   → General maintenance (SLA: 72 hours)
● Low      Grey   → Cosmetic / low-impact (SLA: 7 days)
```

**Work Order Status Transitions:**

```
Open ──► In Progress ──► Completed
  │                          │
  └──────────► Deferred ─────┘  (rescheduled with new due date)
  │
  └──────────► Cancelled        (invalid or duplicate report)
```

**Priority Distribution Chart (Chart.js Doughnut or Polar Area):**

```javascript
segments = [
  { label: 'Urgent',   value: urgent_count,  color: '#ef4444' },
  { label: 'High',     value: high_count,    color: '#f59e0b' },
  { label: 'Medium',   value: medium_count,  color: '#3b82f6' },
  { label: 'Low',      value: low_count,     color: '#94a3b8' }
]
```

**Work Order Actions:**

```
[Open]       → [Assign Staff] [Mark In Progress] [Defer] [Cancel]
[In Progress]→ [Update Notes] [Mark Completed] [Escalate Priority]
[Completed]  → [View Details] [Reopen]
```

#### Section 3 — Housekeeping Room Grid

The room grid provides a visual map of all spaces grouped by property, with real-time cleaning status for each.

**Room Card Layout:**

```
┌─────────────────┐
│  Unit 201       │  ← Space name
│  118 Kavanagh   │  ← Property
│  ─────────────  │
│  [STATUS BAR]   │  ← Colour-coded progress bar
│  Cleaning Now   │  ← Status label
│  Assigned: Ana  │  ← Housekeeper name
└─────────────────┘
```

**Room Housekeeping Status Codes:**

```
Clean / Ready     → Green   bar 100%   "Ready for Check-in"
Occupied          → Blue    bar 100%   "Guest In"
Needs Cleaning    → Amber   bar 0%     "Requires Cleaning" (auto-created after checkout)
Cleaning In Progress → Yellow bar 50%  "Cleaning Now · Assigned: {name}"
Inspection Required  → Purple bar 85%  "Awaiting Inspection"
Maintenance Block    → Red    bar 100% "Out of Order"
```

**Auto Work Order on Checkout:**

```
Trigger: PATCH /api/v1/bookings/{id}/checkout
Action:
  1. Space status → 'needs_cleaning'
  2. INSERT INTO work_orders:
       title    = "Post-checkout cleaning — {space_name}"
       priority = 'medium'
       type     = 'housekeeping'
       space_id = {space_id}
       status   = 'open'
       due_date = TODAY (same-day turnaround)
  3. Notify housekeeping team via push/Resend
```

**Bulk Assignment:** Select multiple rooms → assign to one housekeeper → creates batch work orders

**Room Grid Filters:**
- Filter by property
- Filter by status (Needs Cleaning / In Progress / Ready)
- View: Grid (default) / List

#### Section 4 — Staff Task Assignment + Activity Log

**Staff Task Assignment Panel:**

```
Staff Member:   [ Dropdown — housekeeping / maintenance staff ]
Task Type:      [ Cleaning / Inspection / Repair / Setup ]
Space:          [ Dropdown — filtered by property ]
Priority:       [ Urgent / High / Medium / Low ]
Due:            [ Date + Time picker ]
Notes:          [ Textarea ]
                [ Assign Task ]
```

**Active Staff Load View:**

```
Ana García    ████████░░  4/5 tasks   [View tasks]
Bob Tanaka    ██░░░░░░░░  1/5 tasks   [View tasks]
Sarah Kim     ███████░░░  3/5 tasks   [View tasks]
```

**System Activity Log:**

The activity log provides a chronological audit trail of all operations-related events. This is a critical PMS requirement for liability, dispute resolution, and compliance.

```
Log Entry Format:
  Timestamp  | Actor      | Action                          | Target
  ──────────────────────────────────────────────────────────────────
  14:32:01   | Ana García  | Marked as clean                 | Unit 201
  14:18:44   | System      | Auto work order created         | Unit 201 (post-checkout)
  13:55:12   | John (Mgr)  | Escalated to Urgent             | WO-2024-089
  13:40:00   | Bob Tanaka  | Started work order              | WO-2024-089
  12:00:00   | System      | Check-out processed             | Booking B-189
```

**Log Filters:** Date range · Actor · Action type · Property

### 6.4 API Endpoints — Operations

```
GET    /api/v1/operations/workorders                  → paginated list (filters: status, priority, property)
GET    /api/v1/operations/workorders/{id}             → single work order detail
POST   /api/v1/operations/workorders                  → create new work order
PATCH  /api/v1/operations/workorders/{id}             → update work order (status, assignee, notes)
PATCH  /api/v1/operations/workorders/{id}/assign      → assign to staff member
PATCH  /api/v1/operations/workorders/{id}/complete    → mark as completed
GET    /api/v1/operations/housekeeping/rooms          → all rooms with cleaning status
PATCH  /api/v1/operations/housekeeping/rooms/{id}     → update room cleaning status
GET    /api/v1/operations/staff                       → staff list with current task load
GET    /api/v1/operations/activity-log               → paginated system log (filters: actor, date, type)
GET    /api/v1/operations/summary/kpis               → KPI card data
```

### 6.5 Phase 1 Implementation Checklist

- [x] 4 KPI cards (open, in-progress, urgent, completed this month)
- [x] Work order list with priority dots and status badges
- [x] Housekeeping room grid with colour-coded status
- [ ] Work order creation modal (title, location, priority, assignee, due date)
- [ ] Work order status transition buttons (per state)
- [ ] Priority distribution doughnut chart
- [ ] Auto work order creation on guest checkout
- [ ] Bulk room assignment to housekeeper
- [ ] Staff task load visualisation (bar per staff member)
- [ ] System activity log with timestamp + actor
- [ ] Activity log filter controls
- [ ] Push notification / Resend email on urgent work order
- [ ] Room grid filter by property and status
- [ ] SLA timer display on urgent/high priority orders

---

## 7. Shared Components

These components are reused across all 4 dashboards and should be built once as independent modules.

### 7.1 Sidebar Navigation

```
Component: <Sidebar>
Props:
  - activeRoute: string
  - userRole: 'super_admin' | 'manager' | 'receptionist' | 'finance' | 'housekeeping'
  - notificationCounts: { maintenance: number, bookings: number, leads: number }

Behaviour:
  - Role-based menu item visibility
  - Animated badge counters
  - Collapse to icon-only mode (mobile)
```

### 7.2 Alert Strip

```
Component: <AlertStrip>
Props:
  - alerts: Alert[]   { id, message, type: 'error'|'warning'|'info', dismissible }

Behaviour:
  - Horizontal scroll on overflow
  - Individual dismiss (×)
  - Dismiss-all action
  - Auto-populated from /api/v1/tasks/open?priority=urgent
  - Persists dismiss state in localStorage
```

### 7.3 KPI Card

```
Component: <KpiCard>
Props:
  - label: string
  - value: number | string
  - unit?: string
  - badge?: { text, type: 'green'|'amber'|'red'|'blue'|'gray' }
  - icon: SVG component
  - iconVariant: 'green'|'blue'|'amber'|'teal'
  - trend?: { value: number, direction: 'up'|'down' }
  - progressBar?: { value: number, max: number, colour: string }
  - animateCounter?: boolean   // default true — count-up on load
```

### 7.4 Status Badge

```
Status → CSS Class → Background → Text

active / paid / clean / completed   → .badge-green   #e6faf5 / #007a5e
pending / outstanding / in_progress → .badge-amber   #fffbeb / #92400e
urgent / overdue / error            → .badge-red     #fef2f2 / #991b1b
confirmed / new / info              → .badge-blue    #eff6ff / #1e40af
draft / inactive / low              → .badge-gray    #f5f4f1 / #6b6560
```

### 7.5 System Activity Log

```
Component: <ActivityLog>
Props:
  - entries: LogEntry[]  { timestamp, actor, action, target, icon }
  - maxRows?: number     // default 20
  - filterable?: boolean

Database table:
  CREATE TABLE system_logs (
    id          SERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_id    INTEGER REFERENCES users(id),
    actor_name  VARCHAR(100),
    action      VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),   -- 'booking' | 'invoice' | 'work_order' | 'space'
    target_id   INTEGER,
    target_name VARCHAR(200),
    metadata    JSONB,
    ip_address  INET
  );
```

### 7.6 Live Clock

```javascript
// Shared utility — mount once in Topbar
function mountLiveClock(elementId) {
  const el = document.getElementById(elementId);
  const tick = () => {
    const n = new Date();
    const pad = v => String(v).padStart(2, '0');
    el.textContent = pad(n.getHours()) + ':' + pad(n.getMinutes()) + ':' + pad(n.getSeconds());
  };
  tick();
  return setInterval(tick, 1000);
}
```

---

## 8. Data Schema Reference

Core tables that underpin all 4 dashboards. Designed SQL-first for direct EF Core migration.

### 8.1 Properties & Spaces

```sql
-- Properties (매물)
CREATE TABLE properties (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  type            VARCHAR(50) NOT NULL CHECK (type IN ('hotel','pbsa','homestay','whole_house')),
  status          VARCHAR(30) NOT NULL DEFAULT 'pending_approval'
                  CHECK (status IN ('active','pending_approval','inactive','archived')),
  address_line1   VARCHAR(255),
  city            VARCHAR(100),
  region          VARCHAR(100),
  country         VARCHAR(100),
  owner_id        INTEGER REFERENCES contacts(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spaces (공간)
CREATE TABLE spaces (
  id              SERIAL PRIMARY KEY,
  property_id     INTEGER NOT NULL REFERENCES properties(id),
  name            VARCHAR(100) NOT NULL,
  space_type      VARCHAR(30) CHECK (type IN ('private','dormitory','whole_unit','studio')),
  floor           SMALLINT,
  max_guests      SMALLINT NOT NULL DEFAULT 1,
  base_rate       NUMERIC(12,2) NOT NULL,
  status          VARCHAR(30) NOT NULL DEFAULT 'available'
                  CHECK (status IN ('available','occupied','needs_cleaning',
                                    'maintenance_block','cleaning_in_progress','inspection')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 8.2 Bookings

```sql
CREATE TABLE bookings (
  id              SERIAL PRIMARY KEY,
  reference       VARCHAR(20) UNIQUE NOT NULL,  -- e.g. B-2026-0189
  space_id        INTEGER NOT NULL REFERENCES spaces(id),
  guest_id        INTEGER NOT NULL REFERENCES contacts(id),
  check_in_date   DATE NOT NULL,
  check_out_date  DATE NOT NULL CHECK (check_out_date > check_in_date),
  actual_checkin  TIMESTAMPTZ,
  actual_checkout TIMESTAMPTZ,
  status          VARCHAR(30) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','pending_payment','pending_approval',
                                    'confirmed','active','checked_out','cancelled')),
  rate_plan_id    INTEGER REFERENCES rate_plans(id),
  nightly_rate    NUMERIC(12,2) NOT NULL,
  total_nights    SMALLINT GENERATED ALWAYS AS (check_out_date - check_in_date) STORED,
  subtotal        NUMERIC(12,2),
  tax_amount      NUMERIC(12,2),
  total_amount    NUMERIC(12,2),
  payment_method  VARCHAR(30),
  special_requests TEXT,
  created_by      INTEGER REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_overlap EXCLUDE USING gist (
    space_id WITH =,
    daterange(check_in_date, check_out_date) WITH &&
  ) WHERE (status NOT IN ('cancelled','checked_out'))
);
```

### 8.3 Invoices

```sql
CREATE TABLE invoices (
  id              SERIAL PRIMARY KEY,
  invoice_number  VARCHAR(20) UNIQUE NOT NULL,  -- INV-2026-0001
  booking_id      INTEGER REFERENCES bookings(id),
  guest_id        INTEGER NOT NULL REFERENCES contacts(id),
  property_id     INTEGER REFERENCES properties(id),
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  subtotal        NUMERIC(12,2) NOT NULL,
  tax_rate        NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  tax_amount      NUMERIC(12,2) NOT NULL,
  total_amount    NUMERIC(12,2) NOT NULL,
  paid_at         TIMESTAMPTZ,
  payment_ref     VARCHAR(100),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 8.4 Work Orders

```sql
CREATE TABLE work_orders (
  id              SERIAL PRIMARY KEY,
  reference       VARCHAR(20) UNIQUE NOT NULL,  -- WO-2026-0089
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  space_id        INTEGER REFERENCES spaces(id),
  property_id     INTEGER REFERENCES properties(id),
  type            VARCHAR(30) CHECK (type IN ('maintenance','housekeeping','inspection','setup')),
  priority        VARCHAR(20) NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('urgent','high','medium','low')),
  status          VARCHAR(20) NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','in_progress','completed','deferred','cancelled')),
  assigned_to     INTEGER REFERENCES users(id),
  reported_by     INTEGER REFERENCES users(id),
  source          VARCHAR(20) DEFAULT 'manual'
                  CHECK (source IN ('manual','auto_checkout','guest_request','inspection')),
  due_date        TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 9. API Endpoint Map

Complete reference of all REST endpoints across all 4 dashboards.

```
BASE URL: /api/v1

─── Overview ─────────────────────────────────────────────────
GET  /dashboard/overview/kpis
GET  /properties/summary
GET  /spaces/occupancy-breakdown
GET  /crm/summary
GET  /crm/leads?days=7
GET  /finance/revenue/monthly
GET  /tasks/open?limit=5
GET  /integrations/status

─── Reservations ─────────────────────────────────────────────
GET    /bookings
GET    /bookings/{id}
POST   /bookings
PATCH  /bookings/{id}
DELETE /bookings/{id}
PATCH  /bookings/{id}/checkin
PATCH  /bookings/{id}/checkout
PATCH  /bookings/{id}/extend
GET    /bookings/calendar?start=&end=
GET    /bookings/today/arrivals
GET    /bookings/today/departures
GET    /spaces/availability?space_id=&start=&end=

─── Finance ──────────────────────────────────────────────────
GET    /finance/summary?month=
GET    /finance/revenue/monthly?months=12
GET    /finance/revenue/by-property
GET    /finance/invoices
GET    /finance/invoices/{id}
POST   /finance/invoices
PATCH  /finance/invoices/{id}
PATCH  /finance/invoices/{id}/send
PATCH  /finance/invoices/{id}/paid
GET    /finance/invoices/{id}/pdf
GET    /finance/tax-summary?year=
POST   /finance/invoices/{id}/reminder

─── Operations ───────────────────────────────────────────────
GET    /operations/workorders
GET    /operations/workorders/{id}
POST   /operations/workorders
PATCH  /operations/workorders/{id}
PATCH  /operations/workorders/{id}/assign
PATCH  /operations/workorders/{id}/complete
GET    /operations/housekeeping/rooms
PATCH  /operations/housekeeping/rooms/{id}
GET    /operations/staff
GET    /operations/activity-log
GET    /operations/summary/kpis

─── System Log ───────────────────────────────────────────────
GET    /system/logs?actor=&type=&start=&end=
POST   /system/logs          (internal — not exposed to clients)
```

---

## 10. Phase 2 Migration Notes

### 10.1 Python → C# Mapping

| Phase 1 (Flask / Python) | Phase 2 (ASP.NET Core) |
|---|---|
| `@app.route('/api/v1/bookings', methods=['GET'])` | `[HttpGet] BookingController.GetBookings()` |
| `booking_repo.get_all(filters)` | `IBookingRepository.GetAllAsync(filters)` |
| `booking_dto = BookingSchema().dump(booking)` | `_mapper.Map<BookingDto>(booking)` |
| `db.session.add(booking)` | `_context.Bookings.Add(booking)` |
| `db.session.commit()` | `await _context.SaveChangesAsync()` |
| `jsonify(result)` | `return Ok(result)` |

### 10.2 Data Migration Strategy

```
1. Export PostgreSQL schema → generate EF Core migration scripts
2. Run schema comparison tool (dbup or EF Core scaffolding from existing DB)
3. Data seeding: migrate existing records preserving IDs and timestamps
4. Validate row counts and referential integrity post-migration
5. Run parallel environment (Phase 1 + Phase 2) for 2 weeks before cutover
```

### 10.3 Key Interfaces for Phase 2

```csharp
// Core interfaces — define these in Phase 1 design, implement in Phase 2
public interface IBookingRepository
{
    Task<Booking?> GetByIdAsync(int id);
    Task<PagedResult<Booking>> GetAllAsync(BookingFilter filter);
    Task<List<Booking>> GetCalendarDataAsync(DateOnly start, DateOnly end);
    Task<bool> CheckAvailabilityAsync(int spaceId, DateOnly start, DateOnly end);
    Task AddAsync(Booking booking);
    Task UpdateAsync(Booking booking);
}

public interface IPricingStrategy
{
    decimal Calculate(Space space, DateOnly checkIn, DateOnly checkOut);
}

public class BasePricingStrategy : IPricingStrategy { ... }
public class SeasonalPricingStrategy : IPricingStrategy { ... }
public class DynamicPricingStrategy : IPricingStrategy { ... }
```

### 10.4 Real-Time Updates (Phase 2)

```
Phase 1:  Polling via setInterval (every 30–60 seconds)
Phase 2:  SignalR Hub for real-time push

Events to broadcast via SignalR:
  - BookingStatusChanged  → Refresh Reservations calendar
  - RoomStatusChanged     → Refresh Housekeeping grid
  - UrgentWorkOrderCreated→ Push alert strip notification
  - InvoiceOverdue        → Alert Finance dashboard
  - NewLeadReceived       → Badge counter update in sidebar
```

---

*Document maintained by MillionStay Engineering — update with each sprint.*  
*Next review: May 2026 — post Phase 1 MVP completion.*

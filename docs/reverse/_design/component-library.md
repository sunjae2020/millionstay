# Component Library Inventory

All five web artifacts share the same UI primitive structure: `src/components/ui/` (shadcn/ui = Radix + Tailwind + class-variance-authority + Lucide icons). App-specific components live in `src/components/`.

## 1. Shared primitives (per artifact `src/components/ui/`)

| Category | Components |
|---|---|
| **Layout** | `card`, `separator`, `aspect-ratio`, `scroll-area`, `resizable`, `sidebar`, `sheet`, `drawer` |
| **Form** | `button`, `input`, `textarea`, `label`, `checkbox`, `radio-group`, `switch`, `select`, `slider`, `toggle`, `toggle-group`, `form` (react-hook-form wrapper), `date-input` |
| **Display** | `avatar`, `badge`, `accordion`, `carousel`, `collapsible`, `progress`, `skeleton`, `tabs`, `tooltip`, `alert`, `empty` |
| **Navigation** | `breadcrumb`, `pagination`, `navigation-menu`, `command`, `menubar`, `dropdown-menu`, `context-menu` |
| **Modal / overlay** | `dialog`, `alert-dialog`, `sheet`, `drawer`, `popover`, `hover-card`, `toast`, `sonner` |
| **Table** | `table`, `TablePagination` (custom wrapper) |
| **Feedback** | `ErrorBoundary` (class component), `Skeleton` |

## 2. App-specific components — property-admin

| Component | Purpose |
|---|---|
| `Layout`, `Sidebar`, `admin-layout` | Two-column shell with collapsible left sidebar |
| `StatusBadge` | Color-coded badge (Active/Pending/Suspended/Rejected/Inactive) |
| `KPICard` | Dashboard top-row metric cards |
| `PageHeader` | Page title + actions row |
| `ConfirmDialog` | AlertDialog wrapper for destructive ops |
| `EmptyState` | Used across list pages |
| `DataTable` | Wraps `Table` + sortable headers + pagination |

## 3. App-specific — million-stay-web

| Component | Purpose |
|---|---|
| `Navbar`, `Footer` | Marketing-site shell |
| `PortalLayout` | Two-column shell for `/portal/*` routes |
| `SpaceCard` | Public listing tile |
| `BookingWizardSteps` | Stepper for 4-step booking flow |
| `PaymentSummaryCard` | Right-rail price breakdown on booking |
| `PrivacyConsentCheckbox` | Marketing consent control |

## 4. App-specific — agent / owner / service-host portals

Each follows the same template:

| Component | Purpose |
|---|---|
| `PortalShell` | Top bar + left nav |
| `LoginCard` | Centered login form |
| `DashboardKPI` | KPI tile |
| `BookingsTable` / `JobsTable` | List view |
| `EarningsChart` (agent / service-host) | Stacked bar of period earnings |

## 5. Booking wizard (4-step)

`million-stay-web/src/pages/booking-new.tsx`:

| Step | Title | Fields |
|---|---|---|
| 1 | Stay Details | check-in, check-out, num_guests, stay package selection (term type) |
| 2 | Guest Info | first/last name, email, account create / password, nationality |
| 3 | Documents | informational — required document list (Passport, Visa, CoE) |
| 4 | Confirmed | success message + booking ref + portal redirect button |

Right-rail throughout: `PaymentSummaryCard` showing live "Est. Due Today".

## 6. Status badge color mapping (property-admin)

```ts
// components/StatusBadge.tsx
const STATUS_COLORS = {
  Active:    "bg-green-100 text-green-800",
  Pending:   "bg-amber-100 text-amber-800",
  Suspended: "bg-rose-100  text-rose-800",
  Rejected:  "bg-gray-100  text-gray-600",
  Inactive:  "bg-gray-100  text-gray-600",
};

const BOOKING_STATUS_COLORS = {
  Draft:           "bg-gray-100 text-gray-700",
  PendingApproval: "bg-amber-100 text-amber-800",
  PendingPayment:  "bg-orange-100 text-orange-800",
  Confirmed:       "bg-blue-100 text-blue-800",
  Active:          "bg-green-100 text-green-800",
  CheckedOut:      "bg-purple-100 text-purple-800",
  Cancelled:       "bg-red-100 text-red-800",
  NoShow:          "bg-zinc-100 text-zinc-800",
};
```

## 7. Reusability gaps

- Each artifact maintains its **own copy** of the shadcn primitives. There is **no** `lib/ui` shared package. A change to `Button` requires propagating to 5 artifacts. **Recommendation:** extract `lib/ui` once mockup-sandbox stabilizes.
- `StatusBadge` exists only in property-admin; the public portal re-implements coloring inline.
- `PortalShell` is duplicated across three partner portals with minor styling differences.

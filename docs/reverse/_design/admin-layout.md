# Admin Layout (`property-admin`)

## 1. Shell

```
┌──────────────────────────────────────────────────────────┐
│  TopBar  · org logo · search · user menu · notifications │
├───────────┬──────────────────────────────────────────────┤
│  Sidebar  │                                               │
│           │              Main content                     │
│  (groups) │  PageHeader · breadcrumbs · actions           │
│           │  ────────────────────────────────────────     │
│           │  Content area                                  │
│           │                                                │
└───────────┴──────────────────────────────────────────────┘
```

## 2. Sidebar groups (with routes)

| Group | Items | Route |
|---|---|---|
| Dashboard | Overview, Reservations, Finance, Operations | `/dashboard`, `/dashboard/reservations`, `/dashboard/finance`, `/dashboard/operations` |
| Account | Contacts, Accounts, Tenant Lifecycle (stub), Leads, Tasks | `/account/contacts`, `/account/accounts`, `/account/leads`, `/account/tasks` |
| Property | Properties, Spaces, Space Options, Space Policies | `/property/properties`, `/property/spaces`, `/property/options`, `/property/policies` |
| Booking | Bookings, Contracts, Service Hosts | `/booking/bookings`, `/booking/contracts`, `/booking/service-hosts` |
| Finance | Invoices, Transactions, Receipts, Commissions, Recurring | `/finance/invoices`, etc. |
| Content | Website Content, Blog | `/content/website`, `/content/blog` |
| CS | CS Tickets | `/cs/tickets` |
| Settings | Organisation, Users, Integrations, Reports | `/settings`, `/settings/users`, `/settings/integrations` |

Sidebar collapses to icon-only on `< 1024px`. Active item is bold + left accent border in `--primary`.

## 3. Pages

| Page | Path | Notes |
|---|---|---|
| Dashboard | `/dashboard` | KPI grid + (placeholder) availability calendar |
| Dashboard – Reservations | `/dashboard/reservations` | Today's check-ins/outs |
| Dashboard – Finance | `/dashboard/finance` | Month revenue, outstanding |
| Dashboard – Operations | `/dashboard/operations` | Open WO + open tickets |
| Property List | `/property/properties` | DataTable + create CTA |
| Space List | `/property/spaces` | Filter by property |
| Space Detail | `/property/spaces/:id` | Inline edit form |
| Account List | `/account/accounts` | DataTable |
| Contact List | `/account/contacts` | DataTable |
| Booking List | `/booking/bookings` | Status-colored badges, filter chips |
| Invoice List | `/finance/invoices` | Status filter, total row |
| CS Ticket List | `/cs/tickets` | Inbox-like layout |
| Settings | `/settings` | Hub linking sub-pages |

## 4. Common patterns

| Pattern | Implementation |
|---|---|
| List page | `PageHeader` (title + "+ New") · filter chips · `DataTable` · `TablePagination` |
| Detail page | breadcrumbs · `Card` form · "Save" sticky bar |
| Create dialog | `Dialog` modal with react-hook-form + zod |
| Confirm destructive | `AlertDialog` |
| Toast feedback | `sonner` — success on save, error on fail |
| Loading | `Skeleton` rows in `DataTable` |
| Empty | `EmptyState` with icon + CTA |

## 5. Theme

- Primary: deep orange (`hsl(21 82% 51%)`)
- Background: white / `--background`
- Sidebar bg: `--card`
- Border radius: `0.375rem`
- Font: Inter

## 6. Known UI debt

- "Tenant Lifecycle", "Reports", "Integrations" sub-pages are stubs.
- "Receipts" page is a re-skin of the invoices page filtered to `Paid` — no separate receipt model.
- No keyboard shortcuts.
- No dark mode toggle (CSS variables defined but no toggle).
- Mobile breakpoints work but the data tables require horizontal scroll on phones.

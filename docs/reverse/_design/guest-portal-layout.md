# Guest Portal Layout (`million-stay-web`)

## 1. Shell

The guest portal lives under `/portal/*` inside the public site (`million-stay-web`). It uses a separate `PortalLayout` shell — the public marketing nav is hidden once authenticated.

```
┌────────────────────────────────────────────────┐
│  Logo · Portal · (avatar · logout)             │
├──────────┬─────────────────────────────────────┤
│          │                                      │
│   Nav    │      Page content                    │
│          │                                      │
│  · My Bookings                                  │
│  · Invoices                                     │
│  · Documents                                    │
│  · Support                                      │
│  · Profile                                      │
│  · My Data                                      │
│          │                                      │
└──────────┴─────────────────────────────────────┘
```

## 2. Routes

| Page | Path | Backend |
|---|---|---|
| Portal home (profile + summary) | `/portal` | `GET /v1/guest/me` |
| Bookings list | `/portal/bookings` | `GET /v1/guest/bookings` |
| Invoices | `/portal/invoices` | `GET /v1/guest/invoices` + Stripe pay button |
| Support tickets | `/portal/cs` | `GET /v1/guest/cs-tickets` + create form |
| **My Data** (APP 12 export) | `/portal/my-data` | `GET /v1/guest/me/data` |
| Documents (currently merged into My Data) | n/a | `GET /v1/guest/documents` |
| Login | `/login` | `POST /v1/auth/guest/login` |
| Register | `/register` | `POST /v1/auth/guest/register` (creates account + marketing consent) |

## 3. Public site (pre-login) navigation

Top nav: Search · Stay Plans · About Us · For Students · For Agent · (Login)

| Public page | Path |
|---|---|
| Home | `/` |
| Search | `/search` |
| Space detail | `/spaces/:id` |
| Booking wizard | `/booking/:spaceId` (or `/booking-new` for the WIP version) |
| Blog | `/blog`, `/blog/:slug` |
| About / Contact / FAQ / House Rules | `/about`, `/contact`, `/faq`, `/house-rules` |
| Privacy Policy | `/privacy-policy` |
| Stay Plan landings | `/stay-plan` |
| For Students / For Agent | `/for-student`, `/for-agent` |

## 4. Booking wizard step layout

```
┌──────────────────────────────────────────┐
│  ❶ ──── ❷ ──── ❸ ──── ❹                  │
│                                           │
│  ┌──────────────────┐   ┌──────────────┐ │
│  │ Step body        │   │ Price summary │ │
│  │ (form fields)    │   │ (sticky right)│ │
│  └──────────────────┘   └──────────────┘ │
│                                           │
│  [ Back ]                  [ Next → ]    │
└──────────────────────────────────────────┘
```

Right rail uses `PaymentSummaryCard`. On step 4 the summary becomes the booking confirmation card.

## 5. My Data (APP 12) screen

Sections rendered in order:
1. Profile (with masked bank/passport fields)
2. Account
3. Bookings (only when sole-owner)
4. Invoices (only when sole-owner)
5. Documents (with signed download links)
6. Marketing consents (per-channel opt-in/out timestamps + status)
7. Counts table
8. "Download all as JSON" button → `?format=download`

A standing "Generated at: ISO timestamp" stamp at the top of the page.

## 6. Theme

- Primary: orange (`hsl(24 93% 53%)` ~ `#F97316`)
- Background: white
- Border radius: `0.75rem`
- Font: Inter (with Noto Sans JP / Thai fallbacks for non-Latin guest names)

## 7. Loading / empty / error

| State | Implementation |
|---|---|
| Loading | `Skeleton` lines in cards / table rows |
| Empty | `EmptyState` with category icon + suggested next action |
| Error | `Alert` (destructive) + retry CTA; ErrorBoundary at the layout root |
| Network unauth | redirect to `/login` (TanStack Query interceptor) |

## 8. Mobile behaviour

- Single-column layout below `768px`.
- Right-rail `PaymentSummaryCard` collapses into a sticky bottom bar on mobile.
- Sidebar in `/portal/*` becomes a hamburger drawer.

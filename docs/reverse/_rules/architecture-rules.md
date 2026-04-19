# Architecture Rules — Layering, Naming, Conventions

## 1. Clean-architecture compliance score (1–5)

| Concern | Score | Notes |
|---|---|---|
| Business logic separated from route handlers | **2 / 5** | Most logic is inline in route files (`bookings.ts`, `contracts.ts`, `invoices.ts`). The longest single handler in `contracts.ts` exceeds 200 lines. |
| DB access isolated in a repository / data layer | **1 / 5** | No repository layer. Drizzle calls happen directly inside route handlers. |
| Routes only handle HTTP concerns | **2 / 5** | Routes do validation + auth check + business logic + DB calls + response shaping. |
| Cross-cutting concerns extracted | **3 / 5** | `lib/audit.ts`, `lib/email.ts`, `lib/cloudinary.ts`, `lib/loginLockout.ts`, `lib/refreshTokens.ts`, `lib/retention.ts`, `utils/passwordPolicy.ts`, `utils/fileValidator.ts` are well isolated. |
| Domain types separate from DB types | **1 / 5** | The same Drizzle row shape is what gets returned in responses. |

## 2. Concrete violations (most impactful first)

| File | What's wrong | Recommended split |
|---|---|---|
| `routes/bookings.ts` | `checkOverbooking()` + `calcStayDetails()` + every state transition + audit logging all inline | Extract `services/booking-service.ts` with `confirm()`, `cancel()`, `checkIn()`, `checkOut()` |
| `routes/contracts.ts` | `generateContractInvoicesAndSchedules()` is the system's most complex calculator and lives inline | Extract `services/contract-activation.ts` |
| `routes/invoices.ts` | `PUT` allows mutation regardless of status | Add `services/invoice-service.ts::update()` with status guard |
| `routes/agent-portal.ts:251` | Commission calc inline | Extract `services/commission-service.ts` (used by both agent portal and admin reporting) |
| `routes/admin-users.ts` | Manual field whitelist + manual validation | Use Zod + a service layer |

## 3. Naming conventions in use

| Concern | Convention |
|---|---|
| File names — server | kebab-case (e.g., `guest-portal.ts`, `marketing-consents.ts`) |
| File names — frontend | PascalCase for page components (e.g., `BookingList.tsx`); kebab-case for utility files |
| DB table names | snake_case plural (`bookings`, `contract_products`) |
| DB column names | snake_case (`booking_status`, `agreed_weekly_rate`) |
| TypeScript symbols | camelCase variables, PascalCase types/interfaces |
| Zod schemas | `Create<X>Body`, `Update<X>Body`, `<X>Response` (Orval-generated) |

**Inconsistencies:**
- Booking statuses are PascalCase (`PendingApproval`); contract statuses are PascalCase (`Signed`); but invoice payment_method values are mixed (`Stripe`, `BankTransfer`, `Cash`).
- Some endpoints use `:id` numeric IDs, others (`marketing_consents`, `documents`) use UUIDs — both URL styles coexist.

## 4. Current vs target architecture (ASCII)

### Current

```
┌──────────────────┐
│   HTTP request   │
└────────┬─────────┘
         ▼
┌────────────────────────────────────────────────┐
│  routes/<domain>.ts                             │
│  - manual try/catch                              │
│  - Zod safeParse                                 │
│  - inline business rules                         │
│  - inline Drizzle queries                        │
│  - inline audit logActions                       │
│  - inline response shaping                       │
└────────┬───────────────────────────────────────┘
         ▼
┌──────────────────┐
│  Drizzle / pg    │
└──────────────────┘
```

### Target

```
┌──────────────────┐
│   HTTP request   │
└────────┬─────────┘
         ▼
┌──────────────────────────────────┐
│  routes/<domain>.ts               │
│  - validation (Zod)               │
│  - call service                   │
│  - shape response                 │
│  - global error handler catches   │
└────────┬─────────────────────────┘
         ▼
┌──────────────────────────────────┐
│  services/<domain>-service.ts     │
│  - business rules (transactions,  │
│    state guards, side effects)    │
│  - calls repositories             │
│  - calls audit / email helpers    │
└────────┬─────────────────────────┘
         ▼
┌──────────────────────────────────┐
│  repositories/<domain>-repo.ts    │
│  - Drizzle queries only           │
│  - returns typed domain entities  │
└────────┬─────────────────────────┘
         ▼
┌──────────────────┐
│   Drizzle / pg   │
└──────────────────┘
```

## 5. Cross-cutting concerns — already good ✅

- `lib/audit.ts::logAction()` — used consistently in booking / invoice / contract / space-block routes.
- `lib/email.ts` — single export surface for Resend.
- `lib/cloudinary.ts` — signed URL helper used by both upload and `/me/data` export.
- `middlewares/requireAuth.ts` — single source of truth for admin auth checking.

## 6. Recommended refactor sequence (before C# migration)

1. Extract `services/` and `repositories/` for **booking → contract → invoice** chain (highest value).
2. Add a global Express error handler that maps thrown `AppError` to standardized JSON.
3. Standardize on **one** error shape — `{ success: false, error: { code, message } }`.
4. Move all money columns (`real`) to `numeric(10,2)`.
5. Add unit-test scaffolding (Vitest is the lowest-friction choice).

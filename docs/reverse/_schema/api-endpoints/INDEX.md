# API Endpoints — INDEX

> **Scope**: All 353 endpoints across 51 route files in `artifacts/api-server/src/routes/`.
> **Convention**: rows follow the **file-of-origin rule** (see `_T002_PLAN.md` §2.1). An endpoint defined in `bookings.ts` belongs to the `booking` domain even if its URL is `/admin/bookings/*` and even if it ends up writing the `contracts` table — cross-cutting effects are surfaced via per-endpoint cross-references in the domain file, not by re-classifying the row.
> **Numbers** below are verified by `rg -c "^router\.(get|post|put|patch|delete)\("` (T001.5 follow-up scan, 2026-04-26).

---

## Column meaning

| Column | Meaning |
|---|---|
| **Domain** | One of: booking · contract · finance · ops-property · ops-catalog · ops-crm · portal-guest · portal-partner · public · admin. The three `ops-*` domains are a single conceptual `ops` domain split across three files for size budget (see [Domain Groups](#domain-groups)). |
| **Source File** | Path relative to `artifacts/api-server/src/routes/`. |
| **URL Prefix** | App-mount prefix from `app.ts:149-175`, plus the file's predominant in-route prefix. All endpoints in this file inherit at least this prefix. |
| **# Endpoints** | Count of `router.<method>(...)` declarations at file root. |
| **Auth Guard** | The middleware that gates this file's endpoints. `requireAuth` is the admin guard at `app.ts:167`. `none` means the file is mounted before `requireAuth`. `webhook` means signature-verified at `stripe.ts:25-44`. ⚠️ markers reference CF entries. |
| **logAction** | ✅ = the file calls `logAction(...)` at least once. ❌ = the file never calls it (CF-008 footprint). The count in parentheses is the number of distinct call sites. |
| **$$** | Money-touching: ✅ if the file reads or writes any column listed in `MONEY_AUDIT.md §1`. ❌ otherwise. |
| **Status** | `ACTIVE` or 🪦 `DEAD` (file backs a tombstoned table per CF-009). |
| **Risk** | 🔴 P0 finding present in the domain · 🟡 P1 finding present · 🟢 only P2 or no finding. See [Risk Legend](#risk-legend). |

---

## Index

| Domain | Source File | URL Prefix | # | Auth Guard | logAction | $$ | Status | Risk |
|---|---|---|---:|---|---|---|---|---|
| booking | `bookings.ts` | `/api/v1/bookings` | 27 | `requireAuth` | ✅ (6) | ✅ | ACTIVE | 🔴 |
| contract | `contracts.ts` | `/api/v1/contracts` | 21 | `requireAuth` | ✅ (8) | ✅ | ACTIVE | 🔴 |
| contract | `contract-types.ts` | `/api/v1/contract-types` | 7 | `requireAuth` | ❌ | ❌ | ACTIVE | 🔴 |
| finance | `invoices.ts` | `/api/v1/invoices` | 10 | `requireAuth` | ✅ (3) | ✅ | ACTIVE | 🔴 |
| finance | `recurring-schedules.ts` | `/api/v1/recurring-schedules` | 7 | `requireAuth` | ❌ | ✅ | ACTIVE | 🔴 |
| finance | `payment-info.ts` | `/api/v1/payment-info` | 6 | `requireAuth` | ❌ | ✅ | ACTIVE | 🔴 |
| finance | `commissions.ts` | `/api/v1/commissions` | 6 | `requireAuth` | ❌ | ✅ | ACTIVE | 🔴 |
| finance | `beneficiaries.ts` | `/api/v1/beneficiaries` | 6 | `requireAuth` | ❌ | ✅ | ACTIVE | 🔴 |
| finance | `accounts.ts` | `/api/v1/accounts` | 6 | `requireAuth` | ❌ | ✅ | ACTIVE | 🔴 |
| finance | `stripe.ts` | `/api/stripe` | 2 | `webhook` (signature) | ✅ (3) | ✅ | ACTIVE | 🔴 |
| ops-property | `spaces.ts` | `/api/v1/spaces` | 13 | `requireAuth` | ✅ (4) | ✅ | ACTIVE | 🔴 |
| ops-property | `properties.ts` | `/api/v1/properties` | 7 | `requireAuth` | ❌ | ❌ | ACTIVE | 🔴 |
| ops-property | `space-policies.ts` | `/api/v1/space-policies` | 6 | `requireAuth` | ❌ | ❌ | ACTIVE | 🔴 |
| ops-property | `space-options.ts` | `/api/v1/space-options` | 6 | `requireAuth` | ❌ | ❌ | ACTIVE | 🔴 |
| ops-property | `space-images.ts` | `/api/v1/space-images` | 6 | `requireAuth` *(mounted at `/api`, see app.ts:173)* | ❌ | ❌ | ACTIVE | 🔴 |
| ops-property | `suburbs.ts` | `/api/v1/suburbs` | 6 | `requireAuth` | ❌ | ❌ | ACTIVE | 🔴 |
| ops-catalog | `product-catalog.ts` | `/api/v1/product-catalog` | 11 | `requireAuth` | ❌ | ✅ | ACTIVE | 🟡 |
| ops-catalog | `products.ts` | `/api/v1/products` | 10 | `requireAuth` | ❌ | ✅ | 🪦 **DEAD** *(CF-009)* | 🟡 |
| ops-catalog | `product-types.ts` | `/api/v1/product-types` | 6 | `requireAuth` | ❌ | ❌ | ACTIVE | 🟡 |
| ops-catalog | `product-groups.ts` | `/api/v1/product-groups` | 6 | `requireAuth` | ❌ | ❌ | ACTIVE | 🟡 |
| ops-catalog | `service-catalog.ts` | `/api/v1/service-catalog` | 6 | `requireAuth` | ❌ | ✅ | ACTIVE | 🟡 |
| ops-crm | `work-orders.ts` | `/api/v1/work-orders` | 10 | `requireAuth` | ❌ | ✅ | ACTIVE | 🔴 |
| ops-crm | `leads.ts` | `/api/v1/leads` | 8 | `requireAuth` | ❌ | ❌ | ACTIVE | 🔴 |
| ops-crm | `tasks.ts` | `/api/v1/tasks` | 7 | `requireAuth` | ❌ | ❌ | ACTIVE | 🔴 |
| ops-crm | `cs-tickets.ts` | `/api/v1/cs-tickets` | 7 | `requireAuth` | ❌ | ❌ | ACTIVE | 🔴 |
| ops-crm | `contacts.ts` | `/api/v1/contacts` | 6 | `requireAuth` | ❌ | ❌ | ACTIVE | 🔴 |
| ops-crm | `service-hosts.ts` | `/api/v1/service-hosts` | 5 | `requireAuth` | ❌ | ❌ | ACTIVE | 🔴 |
| ops-crm | `promotions.ts` | `/api/v1/promotions` | 8 | `requireAuth` | ❌ | ✅ | ACTIVE | 🔴 |
| portal-guest | `guest-portal.ts` | `/api/v1/guest` | 18 | `requireGuestAuth` | ✅ (1) | ✅ | ACTIVE | 🟡 |
| portal-guest | `guest-cs.ts` | `/api/v1/guest/cs` | 8 | `requireGuestAuth` | ❌ | ❌ | ACTIVE | 🟡 |
| portal-guest | `guest-auth.ts` | `/api/v1/guest/auth` | 3 | `none` (login) | ❌ | ❌ | ACTIVE | 🟡 |
| portal-partner | `service-host-portal.ts` | `/api/v1/service-host-portal` | 9 | `requireServiceHostAuth` *(CF-005)* | ❌ | ✅ | ACTIVE | 🟡 |
| portal-partner | `owner-portal.ts` | `/api/v1/owner-portal` | 5 | `requirePartnerAuth` | ❌ | ✅ | ACTIVE | 🟡 |
| portal-partner | `agent-portal.ts` | `/api/v1/agent-portal` | 5 | `requirePartnerAuth` | ❌ | ✅ | ACTIVE | 🟡 |
| portal-partner | `partner-auth.ts` | `/api/v1/partner/auth` | 3 | `none` (login) | ❌ | ❌ | ACTIVE | 🟡 |
| public | `public.ts` | `/api/v1/public` | 10 | `none` | ❌ | ❌ | ACTIVE | 🟢 |
| public | `lookup.ts` | `/api/v1/lookup` | 10 | `requireAuth` *(via /v1)* | ❌ | ❌ | ACTIVE | 🟢 |
| public | `blog-posts.ts` | `/api/v1/blog-posts` | 6 | `requireAuth` *(mutators)* | ❌ | ❌ | ACTIVE | 🟢 |
| public | `page-contents.ts` | `/api/v1/page-contents` | 3 | `requireAuth` *(mounted at `/api`)* | ❌ | ❌ | ACTIVE | 🟢 |
| public | `privacy.ts` | `/api/v1/privacy` | 2 | `none` | ❌ | ❌ | ACTIVE | 🟢 |
| public | `health.ts` | `/api/health` | 2 | `none` | ❌ | ❌ | ACTIVE | 🟢 |
| admin | `dashboard.ts` | `/api/v1/dashboard` | 8 | `requireAuth` | ❌ | ✅ | ACTIVE | 🟡 |
| admin | `auth.ts` | `/api/v1/auth` | 7 | `none` (login flows) | ❌ | ❌ | ACTIVE | 🟡 |
| admin | `email-templates.ts` | `/api/v1/email-templates` | 6 | `requireAuth` | ❌ | ❌ | ACTIVE | 🟡 |
| admin | `integrations.ts` | `/api/v1/integrations` | 5 | `requireAuth` | ❌ | ❌ | ACTIVE | 🟡 |
| admin | `admin-users.ts` | `/api/v1/admin-users` | 4 | `requireAuth` *(mounted at `/api` before global guard, app.ts:166)* | ❌ | ❌ | ACTIVE | 🟡 |
| admin | `db-sync.ts` | `/api/v1/admin/db-sync` | 3 | `requireAuth` | ❌ | ❌ | ACTIVE | 🟡 |
| admin | `dev-migration.ts` | `/api/v1/admin/dev-migration` | 1 | ⚠️ **`none` (CF-004)** | ❌ | ❌ | ACTIVE | 🟡 |
| admin | `system-logs.ts` | `/api/v1/system-logs` | 1 | `requireAuth` | ❌ | ❌ | ACTIVE | 🟡 |
| admin | `reports.ts` | `/api/v1/reports` | 1 | `requireAuth` | ❌ | ✅ *(reads invoices/contracts)* | ACTIVE | 🟡 |
| admin | `email-logs.ts` | `/api/v1/email-logs` | 1 | `requireAuth` | ❌ | ❌ | ACTIVE | 🟡 |
| **Σ** | **51 files** | — | **353** | — | **6 of 51** | **20 of 51** | **1 DEAD** | — |

---

## Domain Groups

The conceptual `ops` domain is split into **three files** to respect the 1500-line per-file budget set in `_T002_PLAN.md` §8:

- **`ops-property.md`** — physical assets (spaces, properties, space-policies/options/images, suburbs). 6 files, **44 endpoints**.
- **`ops-catalog.md`** — catalogue tables (product-catalog, products [DEAD], product-types, product-groups, service-catalog). 5 files, **39 endpoints**.
- **`ops-crm.md`** — operational/CRM workflows (work-orders, leads, tasks, cs-tickets, contacts, service-hosts, promotions). 7 files, **51 endpoints**.

Cross-domain endpoints stay with their **file of origin**, not with the entity they touch. Examples cataloged in `_T002_PLAN.md` §2.3:
- `POST /api/v1/contracts/:id/invoices` lives in `contract.md` (file = `contracts.ts`) and carries `→ finance.md#invoice-lifecycle` cross-ref.
- `PATCH /api/v1/bookings/:id/confirm` lives in `booking.md` (file = `bookings.ts`) even though it inserts a `contracts` row and N `contract_line_items` rows; cross-ref to `contract.md#auto-creation` is required on the row.

---

## Domain summary

| Domain | Files | Endpoints | logAction-covered files | $$ files |
|---|---:|---:|---:|---:|
| booking | 1 | 27 | 1 | 1 |
| contract | 2 | 28 | 1 | 1 |
| finance | 7 | 43 | 2 | 7 |
| ops-property | 6 | 44 | 1 | 1 |
| ops-catalog | 5 | 39 | 0 | 2 |
| ops-crm | 7 | 51 | 0 | 2 |
| portal-guest | 3 | 29 | 1 | 1 |
| portal-partner | 4 | 22 | 0 | 3 |
| public | 6 | 33 | 0 | 0 |
| admin | 10 | 37 | 0 | 2 |
| **Σ** | **51** | **353** | **6** | **20** |

**Audit-coverage gap (CF-008)**: only **6 of 51 files (11.8%)** call `logAction`. Money-relevant files without audit logging include `recurring-schedules.ts`, `payment-info.ts`, `commissions.ts`, `beneficiaries.ts`, `accounts.ts`, `dashboard.ts` (read-only but reports), and the entire `portal-partner` cluster's mutating endpoints.

---

## Risk Legend

| Risk | Domain(s) | Triggering CF |
|---|---|---|
| 🔴 P0 | **booking** | [CF-002 booking→contract precision loss](../../_audit/CRITICAL_FINDINGS.md#cf-002), [CF-003 zero `references()` FK](../../_audit/CRITICAL_FINDINGS.md#cf-003) |
| 🔴 P0 | **contract** | [CF-002](../../_audit/CRITICAL_FINDINGS.md#cf-002), [CF-003](../../_audit/CRITICAL_FINDINGS.md#cf-003) |
| 🔴 P0 | **finance** | [CF-001 money type schism](../../_audit/CRITICAL_FINDINGS.md#cf-001), [CF-002](../../_audit/CRITICAL_FINDINGS.md#cf-002), [CF-003](../../_audit/CRITICAL_FINDINGS.md#cf-003) |
| 🔴 P0 | **ops-property** | [CF-001](../../_audit/CRITICAL_FINDINGS.md#cf-001) (`spaces.weekly_rate` is `real`), [CF-003](../../_audit/CRITICAL_FINDINGS.md#cf-003) |
| 🔴 P0 | **ops-crm** | [CF-001](../../_audit/CRITICAL_FINDINGS.md#cf-001) (`work_orders.cost` is `real`), [CF-003](../../_audit/CRITICAL_FINDINGS.md#cf-003) |
| 🟡 P1 | **ops-catalog** | [CF-009 dead products/product_catalog](../../_audit/CRITICAL_FINDINGS.md#cf-009), [CF-008 audit gap](../../_audit/CRITICAL_FINDINGS.md#cf-008) |
| 🟡 P1 | **portal-guest** | [CF-010 Stripe webhook gap](../../_audit/CRITICAL_FINDINGS.md#cf-010) (Stripe payment intent created at `guest-portal.ts:885`) |
| 🟡 P1 | **portal-partner** | [CF-005 service_host portal_type leak](../../_audit/CRITICAL_FINDINGS.md#cf-005), [CF-006 weekly→monthly formula mismatch](../../_audit/CRITICAL_FINDINGS.md#cf-006) (`owner-portal.ts:83` vs `:236`) |
| 🟡 P1 | **admin** | [CF-004 dev-migration before requireAuth](../../_audit/CRITICAL_FINDINGS.md#cf-004), [CF-008 audit gap](../../_audit/CRITICAL_FINDINGS.md#cf-008) |
| 🟢 — | **public** | None (P2: CF-011, CF-012 do not affect public surface) |

Cross-cutting findings ([CF-013](../../_audit/CRITICAL_FINDINGS.md#cf-013) date/timezone, [CF-014](../../_audit/CRITICAL_FINDINGS.md#cf-014) no-transactions, [CF-015](../../_audit/CRITICAL_FINDINGS.md#cf-015) soft/hard-delete) apply to every mutating domain and are not enumerated per-row to avoid noise.

---

## Reading order recommendation

For a Phase 2 (.NET) port team:
1. Read this index → pick a domain → open the corresponding `<domain>.md`.
2. Inside each domain file, the per-endpoint blocks follow a single fixed format (see `_T002_PLAN.md` §4). Cross-references are clickable.
3. For finance / booking / contract domains, **always** read `MONEY_AUDIT.md` and `CRITICAL_FINDINGS.md` CF-001/002/007/010 before re-implementing any handler.

---

*End of `INDEX.md` — last updated 2026-04-26 (T002.1).*

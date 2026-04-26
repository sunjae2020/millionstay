# Schema-File ↔ Table-Name Map (영구 reference)

> **Trigger**: T002.1.5 incidental finding — `contract_products` table lives in the `products.ts` schema file, even though the `products.ts` *route* file was previously labeled DEAD per CF-009. This raised the suspicion that the heuristic used to detect "dead tables" had been **conflating schema-file-name with table-name**, which would corrupt CF-009, the INDEX DEAD count, the ERD tombstones, the MONEY_AUDIT dead-table column inventory, and any downstream T002.3+ tombstone work. This document is the **table-level** ground truth that supersedes any file-level claim made before 2026-04-26.

---

## §0. Status / Maintenance contract

| Field | Value |
|---|---|
| **Location** | `docs/reverse/_schema/SCHEMA_FILE_TABLE_MAP.md` *(promoted from `_audit/` to `_schema/` on 2026-04-26 (T002.1.7) — this is a **permanent reference asset**, not a one-off audit artefact)* |
| **Audience** | T002.2.x domain doc authors, T002.3 (`db-schema-overview`), T002.4 (`erd-core`), T002.5 (`state-machines`), T006 (`_design/`) — anyone who needs to resolve a table name ↔ file ↔ var. |
| **Update obligation** | **MUST** update on any schema change: table add / table remove / file rename / var rename. **R-REPO-1 atomic-commit candidate** in every such PR. Stale rows here will silently re-introduce CF-009-class bugs. |
| **Anchored CFs** | [CF-009 revised](../_audit/CRITICAL_FINDINGS.md#cf-009) (table-level dead inventory) · [CF-016](../_audit/CRITICAL_FINDINGS.md#cf-016) (naming inconsistency — this map *is* the canonical evidence) |
| **Last full re-audit** | 2026-04-26 (T002.1.6) |

### How to use this map

Three lookup recipes, each with a one-line `rg` command. Use these instead of guessing from filename:

**Use case A — "I have a SQL table name; where is it defined?"**

```sh
# Find the schema file that declares "<table_name>"
rg -l "pgTable\(\"<table_name>\"" lib/db/src/schema/
```

Then look up that filename in §2 below to confirm the var name and active routes.

**Use case B — "I have a schema file; what tables does it actually define?"**

Open the file and look for `pgTable("...")` calls. Or:

```sh
rg "pgTable\(\"([a-z_]+)\"" lib/db/src/schema/<file>.ts -o -r '$1'
```

Beware: 4 files declare 2-3 tables each (see §3).

**Use case C — "I have a TS variable name from a route; what SQL table does it hit?"**

```sh
rg "(\w+)\s*=\s*pgTable\(\"([a-z_]+)\"" lib/db/src/schema/ \
   -o -r '$1 → $2' --no-filename | rg "^<varName>\b"
```

Use this **before** writing `rg "<varName>" routes/` for usage counts — naive `<TableName>Table` heuristics fail in 6 places (see §3 var-name section).

---

## §1. Methodology

### 1.1 Why this map is needed

The original recon (T001) scanned `lib/db/src/schema/*.ts` and assumed `<filename>.ts` defined a table named `<filename>`. That assumption fails in **at least 8 places** in this codebase (see §3 below — file-name vs table-name divergences). Two specific consequences corrupt CF-009:

1. **The `products` table does not exist.** `lib/db/src/schema/products.ts` defines exactly **one** table — `contract_products` — which is **active** (4 route files use it).
2. **`product_catalog` is the only dead member** of the so-called "product family". It lives in its own file `product_catalog.ts`, which is wired into `schema/index.ts` but never read by any route.

A file-level audit would have flagged `products.ts` as suspicious (the recon did) but the conclusion that "the `products` table is dead" was a **mis-naming**, not a real discovery. The table never existed in the first place.

### 1.2 Detection criteria (tightened from T002.0 §6)

A table is **CONFIRMED DEAD** iff *all three* hold:

1. The table-var (e.g. `productCatalogTable`) is not imported by any file under `artifacts/api-server/src/routes/`.
2. No other schema module declares a `references()` pointing at the table (in this repo, irrelevant — there are 0 `.references()` declarations anywhere; see CF-003).
3. No raw SQL string in the codebase mentions the table name.

A table is **SUSPECTED DEAD** iff condition (1) is *false* but the table appears in only one route file *and* the count of unique handler functions touching it is ≤ 2. (Per §4 below, **no table** in this repo currently meets the SUSPECTED-DEAD threshold — every 1-file table is heavily used inside that single file.)

A table is **ACTIVE** otherwise.

### 1.3 Detection commands

```sh
# table-var → table-name mapping (the source of truth)
rg "(\w+Table)\s*=\s*pgTable\(\"([a-z_]+)\"" lib/db/src/schema/ \
   -o -r '$1|$2' --no-filename | sort -u

# per-table route-file count (uses the actual var name, not a guess)
rg -l "\b<varname>\b" artifacts/api-server/src/routes/ | wc -l

# raw SQL string check
rg -F "\"<table_name>\"" artifacts/api-server/src/   # excluding the schema file itself
```

---

## §2. Full inventory (50 tables across 47 schema files)

| # | Schema File | Var Name (TS) | Table Name (SQL) | Route Files Using | Status |
|---|---|---|---|---:|---|
| 1 | `accommodation_catalog.ts` | `accommodationCatalogTable` | `accommodation_catalog` | 6 | ✅ Active |
| 2 | `accommodation_service_catalog.ts` | `accommodationServiceCatalogTable` | `accommodation_service_catalog` | 2 | ✅ Active |
| 3 | `accounts.ts` | `accountsTable` | `accounts` | 18 | ✅ Active |
| 4 | `announcements.ts` | `announcementsTable` | `announcements` | 1 *(guest-cs.ts:5 uses)* | ✅ Active |
| 5 | `announcements.ts` | `guestDirectMessagesTable` | `guest_direct_messages` | 1 *(guest-cs.ts:7 uses)* | ✅ Active |
| 6 | `beneficiaries.ts` | `beneficiariesTable` | `beneficiaries` | 1 | ✅ Active |
| 7 | `blog_posts.ts` | `blogPostsTable` | `blog_posts` | 2 | ✅ Active |
| 8 | `booking_service_photos.ts` | `bookingServicePhotosTable` | `booking_service_photos` | 2 | ✅ Active |
| 9 | `bookings.ts` | `bookingsTable` | `bookings` | 13 | ✅ Active |
| 10 | `bookings.ts` | `bookingDocumentsTable` | `booking_documents` | 1 *(bookings.ts:5 uses)* | ✅ Active |
| 11 | `bookings.ts` | `bookingServicesTable` | `booking_services` | 4 | ✅ Active |
| 12 | `commissions.ts` | `commissionsTable` | `commissions` | 5 | ✅ Active |
| 13 | `contacts.ts` | `contactsTable` | `contacts` | 11 | ✅ Active |
| 14 | `contract_line_items.ts` | `contractLineItemsTable` | `contract_line_items` | 3 | ✅ Active |
| 15 | `contracts.ts` | `contractsTable` | `contracts` | 8 | ✅ Active |
| 16 | `contract_types.ts` | `contractTypesTable` | `contract_types` | 2 | ✅ Active |
| 17 | `cs_tickets.ts` | `csTicketsTable` | `cs_tickets` | 2 | ✅ Active |
| 18 | `cs_tickets.ts` | `csMessagesTable` | `cs_messages` | 2 | ✅ Active |
| 19 | `email_logs.ts` | `emailLogsTable` | `email_log` ⚠ singular | 2 | ✅ Active |
| 20 | `email_templates.ts` | `emailTemplatesTable` | `email_template` ⚠ singular | 1 | ✅ Active |
| 21 | `guest_emergency_contacts.ts` | `guestEmergencyContactsTable` | `guest_emergency_contacts` | 1 *(guest-portal.ts:26 uses)* | ✅ Active |
| 22 | `guest_users.ts` | `guestUsersTable` | `guest_users` | 4 | ✅ Active |
| 23 | `integration_settings.ts` | `integrationSettings` ⚠ no `Table` suffix | `integration_settings` | 2 *(dev-migration.ts, integrations.ts)* | ✅ Active |
| 24 | `invoices.ts` | `invoicesTable` | `invoices` | 9 | ✅ Active |
| 25 | `leads.ts` | `leadsTable` | `leads` | 3 | ✅ Active |
| 26 | `page_contents.ts` | `pageContentsTable` | `page_contents` | 1 *(page-contents.ts:11 uses)* | ✅ Active |
| 27 | `partner_users.ts` | `partnerUsersTable` | `partner_users` | 1 *(partner-auth.ts:19 uses)* | ✅ Active |
| 28 | `payment_info.ts` | `paymentInfoTable` | `payment_info` | 3 | ✅ Active |
| 29 | `product_catalog.ts` | `productCatalogTable` | `product_catalog` | **0** | 🪦 **CONFIRMED DEAD** |
| 30 | `product_groups.ts` | `productGroupsTable` | `product_groups` | 3 | ✅ Active |
| 31 | `products.ts` | `contractProductsTable` | `contract_products` ⚠ filename ≠ table | 4 | ✅ Active |
| 32 | `product_types.ts` | `productTypesTable` | `product_types` | 3 | ✅ Active |
| 33 | `promotions.ts` | `promotionsTable` | `promotions` | 3 | ✅ Active |
| 34 | `properties.ts` | `propertiesTable` | `properties` | 12 | ✅ Active |
| 35 | `recurring_schedules.ts` | `recurringSchedulesTable` | `recurring_schedule` ⚠ singular | 4 | ✅ Active |
| 36 | `service_catalog.ts` | `serviceCatalogTable` | `service_catalog` | 5 | ✅ Active |
| 37 | `service_hosts.ts` | `serviceHostsTable` | `service_hosts` | 2 | ✅ Active |
| 38 | `space_availability.ts` | `spaceAvailabilityTable` | `space_availability` | 2 | ✅ Active |
| 39 | `space_images.ts` | `spaceImagesTable` | `space_images` | 2 | ✅ Active |
| 40 | `space_options.ts` | `spaceOptionsTable` | `space_options` | 2 | ✅ Active |
| 41 | `space_policies.ts` | `spacePoliciesTable` | `space_policies` | 3 | ✅ Active |
| 42 | `space_service_catalog.ts` | `spaceServiceCatalogTable` | `space_service_catalog` | 2 | ✅ Active |
| 43 | `spaces.ts` | `spacesTable` | `spaces` | 15 | ✅ Active |
| 44 | `spaces.ts` | `spaceOptionMapsTable` | `space_option_maps` | 2 | ✅ Active |
| 45 | `spaces.ts` | `spaceBlockedDatesTable` | `space_blocked_dates` | 2 | ✅ Active |
| 46 | `suburbs.ts` | `suburbsTable` | `suburbs` | 4 | ✅ Active |
| 47 | `system_logs.ts` | `systemLogsTable` | `system_log` ⚠ singular | 2 | ✅ Active |
| 48 | `tasks.ts` | `tasksTable` | `tasks` | 2 | ✅ Active |
| 49 | `users.ts` | `usersTable` ⚠ no `admin_` prefix | `admin_users` | 2 | ✅ Active |
| 50 | `work_orders.ts` | `workOrdersTable` | `work_orders` | 2 | ✅ Active |

**Totals**: 50 tables across 47 schema files. **49 ACTIVE** · **1 CONFIRMED DEAD** (`product_catalog`) · **0 SUSPECTED DEAD**.

---

## §3. File-name vs table-name divergences (the trap)

Eight cases in this codebase break the `<filename>.ts → <filename>` table-naming convention. Any tool, document, or grep recipe that assumes the convention will produce wrong answers in these eight rows:

| Schema file | Defines table(s) | Divergence type |
|---|---|---|
| `products.ts` | `contract_products` | Filename plural of a non-existent base; actual table is a different concept |
| `users.ts` | `admin_users` | Filename omits the `admin_` prefix |
| `email_logs.ts` | `email_log` | Filename plural ↔ table singular |
| `email_templates.ts` | `email_template` | Filename plural ↔ table singular |
| `recurring_schedules.ts` | `recurring_schedule` | Filename plural ↔ table singular |
| `system_logs.ts` | `system_log` | Filename plural ↔ table singular |
| `announcements.ts` | `announcements` + `guest_direct_messages` | Single file declares two unrelated tables |
| `bookings.ts` | `bookings` + `booking_documents` + `booking_services` | Three tables in one file |
| `cs_tickets.ts` | `cs_tickets` + `cs_messages` | Two tables in one file |
| `spaces.ts` | `spaces` + `space_option_maps` + `space_blocked_dates` | Three tables in one file |

**Implication for downstream docs**: any per-file row in INDEX.md, ERD diagrams, or T002.3 (db-schema-overview) **must cite the table name**, not the file name, when discussing dead/active status, FKs, or money columns. The `🪦` tombstone marker should attach to *table* rows, never to *file* rows.

> **Anchored CF**: this entire section is the canonical evidence for [CF-016 — Schema file/table/variable naming inconsistency](../_audit/CRITICAL_FINDINGS.md#cf-016) (P2, Phase 2 migration friction).

A second-order rule for `var name`: three files break the `<TableName>Table` JS-variable convention:

| Var | Where it diverges |
|---|---|
| `usersTable` | Refers to `admin_users` table (not a generic `users` table) |
| `integrationSettings` | Has no `Table` suffix at all (the only such case) |
| `recurringSchedulesTable`, `emailLogsTable`, `emailTemplatesTable`, `systemLogsTable` | Plural var name maps to singular table name |

Naive grep recipes like `rg "<table>Table" routes/` will produce **false 0-counts** for any of these. The §1.3 detection commands above use the actual var name and avoid this trap.

---

## §4. Re-evaluation of T002.0 §6 "suspected dead" candidates

T002.0 §6.2 listed `announcements`, `*_service_catalog`, `product_types`, `product_groups` as "suspect dead pending deeper scan". All four are now **cleared** under the §1.2 criteria:

| Candidate | Route files | Internal usage | Verdict |
|---|---:|---|---|
| `announcements` | 1 (`guest-cs.ts`) | 5 distinct uses | ✅ Active |
| `accommodation_service_catalog` | 2 | normal CRUD | ✅ Active |
| `space_service_catalog` | 2 | normal CRUD | ✅ Active |
| `product_types` | 3 | normal lookup + CRUD | ✅ Active |
| `product_groups` | 3 | normal lookup + CRUD | ✅ Active |

---

## §5. Cross-document impact log (atomic commit T002.1.6)

This map's findings invalidate or correct the following claims in other documents. All are corrected in the same commit per **R-REPO-1**:

| Document | Old claim | Corrected to |
|---|---|---|
| `CRITICAL_FINDINGS.md` CF-009 (title) | "Three product-shaped tables; two are dead" | "`product_catalog` table is dead schema; the so-called `products` table never existed" |
| `CRITICAL_FINDINGS.md` CF-009 (count) | 2 dead tables | 1 dead table |
| `CRITICAL_FINDINGS.md` summary row | "products / product_catalog dead tables" | "product_catalog dead table; products.ts file actually defines active contract_products" |
| `INDEX.md` row L46 | `products.ts` route is 🪦 DEAD, path `/api/v1/products` | `products.ts` route is ✅ ACTIVE, path `/api/v1/contract-products` |
| `INDEX.md` L89 (domain group blurb) | "products [DEAD]" listed under ops-catalog | removed; only `product_catalog [DEAD]` remains |
| `INDEX.md` L127 (Risk Legend) | "CF-009 dead products/product_catalog" | "CF-009 dead product_catalog (singular)" |
| `MONEY_AUDIT.md` §1.2 (7 rows) | columns attributed to `products` table | re-attributed to `contract_products` (active) |
| `MONEY_AUDIT.md` §1.2 subtotal | "Six are in dead products/product_catalog" | "Four are in dead product_catalog; the other six in products.ts file actually belong to active contract_products" |
| `MONEY_AUDIT.md` §1.5 cross-pair row | `products.weekly_rate (real — dead)` | `contract_products.weekly_rate (real)` |
| `MONEY_AUDIT.md` §1.5 bond row | `products.bond_amount (dead)` | `contract_products.bond_amount` |
| `MONEY_AUDIT.md` §2.2 row | `products.ts:19 bond_weeks` (treated as dead) | belongs to `contract_products`, not dead |
| `MONEY_AUDIT.md` §2.3 closing note | "products schema table also declares effective_weekly_rate but is dead" | removed entirely (no such table exists) |

---

## §6. What this map does NOT decide

- Whether `accommodation_catalog` should be merged with `contract_products` (overlap of weekly_rate / bond_amount / admin_fee / cleaning_fee). Out of scope here; raised as a *design* question for T002.3 (db-schema-overview) and T006 (`_design/`).
- Whether `announcements` and `guest_direct_messages` belong in the same file. Convention drift only; no data-integrity impact.
- Whether route file `products.ts` should be renamed to `contract-products.ts` for filename–path symmetry. UX/clarity matter; no functional impact.

---


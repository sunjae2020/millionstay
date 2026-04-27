# Admin Layout (`property-admin`)

> ✅ **T006-REWRITE** 2026-04-27 (T001 시점 80L NEEDS REVISION → 본 95L; T002 admin.md 37 ep + T003 _context/domain-logic-admin.md (7 mount-time auth tier A-D″ + 🔴 CF-004 P0 deep dive) + T004 security-rules.md §3 (Sub-pattern B 57 sites) + §7 (CF-004 P0) 통합).
> **상위 source**: artifacts/property-admin/src/{App.tsx, pages/, components/Sidebar.tsx, components/PageHeader.tsx} + admin 도메인 (37 ep / 10 files).
> **Cross-ref**: component-library.md §2 (admin 표준 list/detail 패턴) + design-tokens.md §2 (deep orange + tight radius) + guest-portal-layout.md §1 (admin vs guest shell 대비).

---

## §1 SHELL — 단일 도메인 admin

```
┌─────────────────────────────────────────────────────┐
│ TopBar  · org logo · search · user menu · notifs    │
├──────────┬──────────────────────────────────────────┤
│ Sidebar  │  PageHeader · breadcrumbs · actions      │
│ (8 group)│  ────────────────────────────────────    │
│          │  Content area (DataTable / Card / form)  │
└──────────┴──────────────────────────────────────────┘
```

- Sidebar collapses to icon-only on `< 1024px`
- Active item: bold + left accent border (`--primary` deep orange `hsl(21 82% 51%)`; design-tokens §2)
- mobile data tables = horizontal scroll (UI debt §6)

---

## §2 SIDEBAR — 8 group (T002 admin.md 37 ep mapping)

| Group | Items | Route 경로 | T002 backend mapping |
|-------|-------|-----------|---------------------|
| Dashboard | Overview, Reservations, Finance, Operations | `/dashboard/*` | dashboard.ts 8 ep |
| Account | Contacts, Accounts, Tenant Lifecycle (stub), Leads, Tasks | `/account/*` | accounts/contacts/leads (T002 ops-crm.md) |
| Property | Properties, Spaces, Space Options, Space Policies | `/property/*` | T002 ops-property.md (44 ep) |
| Booking | Bookings, Contracts, Service Hosts | `/booking/*` | T002 booking.md (27 ep) + contract.md (28 ep) |
| Finance | Invoices, Transactions, Receipts, Commissions, Recurring | `/finance/*` | T002 finance-{invoicing,payments}.md |
| Content | Website Content, Blog | `/content/*` | T002 public.md (blog-posts 6 ep) |
| CS | CS Tickets | `/cs/*` | T002 ops-crm.md (cs_tickets) |
| Settings | Organisation, Users, Integrations, Reports | `/settings/*` | admin-users (4 ep) + integrations (5 ep) + reports (1 ep) |

---

## §3 7 MOUNT-TIME AUTH TIER UI 매핑 (security-rules §3+§7 cross-ref)

`property-admin` UI 표면 × backend 7 tier (`domain-logic-admin.md §0`) — **role 별 navigation 가시성**:

| Tier | Backend 가드 | UI 영향 |
|------|------------|---------|
| A 🔴 | dev-migration.ts (mount-order < requireAuth) | **UI 노출 0** (CF-004 P0 — admin sidebar 어디에도 dev-migration entry 부재 = positive UI side) |
| A' | health.ts (no auth) | UI 노출 0 (운영 전용) |
| B | auth.ts (login flow) | TopBar user menu + `/login` route only |
| B' | requireAuth (global) | sidebar 모든 group access 전제 |
| C | requireSuperAdmin (router-level db-sync.ts:30) | Settings → DB Sync entry sub-admin 숨김 |
| C′ | inline `!== "SuperAdmin"` 56 sites × 28 files | sidebar item 별 inline 가시성 가드 (CF-018 Sub-pattern B carrier — Phase 2 단일 middleware 추출) |
| D″ | super-admin/admin/sub-admin 분기 | role 별 entry 노출 매트릭스 (현재 inline drift = role-string normalisation drift CF-016 + db-sync.ts:16 4-variant Set vs 28-file 정확 string) |

**🔴 CF-004 P0 UI side positive**: `dev-migration.ts:14-79` (TRUNCATE 39 production tables RESTART IDENTITY CASCADE) = UI 표면 노출 0 hits — admin sidebar 어디에도 entry 부재 + URL guess 만 가능. Phase 2 prescription = (1) backend NODE_ENV gate / (2) MIGRATION_SECRET literal 제거 / (3) mount order 정정 / (4) requireSuperAdmin 적용 / (5) audit log 통합 (현재 0 hits).

---

## §4 PAGES — 표준 패턴 (component-library §2 cross-ref)

| 패턴 | 구현 |
|------|------|
| List page | `PageHeader` (title + "+ New") · filter chips · `DataTable` · `TablePagination` |
| Detail page | breadcrumbs · `Card` form · "Save" sticky bar |
| Create dialog | `Dialog` modal + react-hook-form + zod (CF-017 5.4% Zod floor — admin 도메인 = email-templates.ts 1/6 = 17% only; security-rules §6 cross-ref) |
| Confirm destructive | `AlertDialog` |
| Toast feedback | `sonner` |
| Loading | `Skeleton` rows |
| Empty | `EmptyState` |

---

## §5 KNOWN UI DEBT

- "Tenant Lifecycle", "Reports", "Integrations" sub-pages = stubs
- "Receipts" = 재skin of invoices filter `Paid` (별도 receipt model 부재)
- 키보드 단축키 0
- Dark mode toggle 0 (design-tokens §3 cross-ref — CSS variable 정의 + toggle 0)
- mobile DataTable 가로 스크롤
- Sub-pattern B 56 inline sites × 28 files = role 가시성 가드 산재 (Phase 2 단일 middleware)

---

## §6 자가 검증 (3 spot-check ✅)

- C1 `property-admin/src/components/Sidebar.tsx` 8 group nav (T002 admin.md 37 ep mapping; `domain-logic-admin.md §0`)
- C2 dev-migration UI entry = `rg "dev-migration|MIGRATION" artifacts/property-admin/src/` 0 hits → CF-004 UI side positive (backend P0 vs UI 0 노출)
- C3 admin primary `--primary: 21 82% 51%` deep orange + radius `0.375rem` (design-tokens §2 mapping)

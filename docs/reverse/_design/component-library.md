# Component Library Inventory

> ✅ **T006-REWRITE** 2026-04-27 (T001 시점 96L NEEDS REVISION → 본 92L; T002 5 artifact src/components/ + T004 architecture-rules.md §5 (5-artifact 중복) + security-rules.md §1 (sole-owner E20 UI carrier) 통합).
> **상위 source**: 5 artifact `src/components/ui/` (shadcn/ui = Radix + Tailwind + class-variance-authority + Lucide icons; ~50 primitive 동일) + `src/components/` (artifact-specific).
> **Cross-ref**: design-tokens.md §1 (5-artifact CSS 중복) + admin-layout.md §4 (admin 표준 패턴 carrier) + guest-portal-layout.md §4 (guest specific component 분리).

---

## §1 SHARED PRIMITIVES — 5 artifact 중복 (architecture-rules §5 DEAD/duplicate carrier)

각 artifact `src/components/ui/` = shadcn/ui 표준 primitive 폴더 — **5-way 중복** (design-tokens 와 동일 패턴):

| 카테고리 | primitive 예 |
|---------|------------|
| Layout | `accordion`, `aspect-ratio`, `card`, `collapsible`, `resizable`, `scroll-area`, `separator`, `sheet`, `sidebar`, `tabs` |
| Form input | `button`, `button-group`, `checkbox`, `input`, `input-otp`, `label`, `radio-group`, `select`, `slider`, `switch`, `textarea`, `toggle`, `toggle-group`, `form` |
| Overlay | `alert`, `alert-dialog`, `dialog`, `drawer`, `dropdown-menu`, `context-menu`, `hover-card`, `popover`, `tooltip`, `command`, `menubar`, `navigation-menu` |
| Display | `avatar`, `badge`, `breadcrumb`, `calendar`, `carousel`, `chart`, `progress`, `skeleton`, `table`, `pagination`, `data-table` |
| Feedback | `sonner` (toast), `progress`, `skeleton` |

**~50 primitive × 5 artifact = ~250 file 중복** (`ls artifacts/*/src/components/ui/ | wc -l`). Phase 2 prescription = `packages/ui-primitives/` workspace package + `@workspace/ui-primitives` import 단일 source.

---

## §2 ARTIFACT-SPECIFIC COMPONENTS — `src/components/`

| artifact | 핵심 components/ |
|----------|----------------|
| million-stay-web (guest) | `BookingWizard` (4-step) + `PaymentSummaryCard` (sticky right-rail) + `PortalLayout` (/portal/* shell) + property listing cards + APP12 my-data sections |
| property-admin | `Sidebar` (8 group) + `TopBar` + `PageHeader` + `DataTable` + `EmptyState` + admin form Dialog 패턴 |
| agent-portal | dashboard cards + booking list + commission summary |
| owner-portal | property dashboard + booking list + revenue chart |
| service-host-portal | service-host dashboard + assigned booking list |

**Pattern 표준 5 artifact 동일**: list page = PageHeader + filter chips + DataTable + TablePagination / detail page = breadcrumbs + Card form + Save sticky bar / create dialog = Dialog modal + react-hook-form + zod / destructive confirm = AlertDialog / toast = sonner / loading = Skeleton / empty = EmptyState.

---

## §3 SOLE-OWNER E20 UI CARRIER (security-rules §1 cross-ref)

`million-stay-web` guest portal 의 APP12 my-data screen — **sole-owner guard UI 노출 정책** (domain-logic-portal-guest.md §1.6 + security-rules §1):

- Profile (masked bank/passport)
- Account
- **Bookings (sole-owner 일 때만 노출)** ← E20 canonical exemplar UI carrier
- **Invoices (sole-owner 일 때만 노출)** ← 동일
- Documents (signed download)
- Marketing consents
- Counts table
- "Download all as JSON" → `?format=download`

→ section 4-5 = backend API 결과 sole-owner 가드 통과 시점에만 fetch + render. **CF-018 Sub-pattern A POSITIVE** = UI-side 가시성 backend 가드 동기화 = E20 canonical exemplar UI 측면.

---

## §4 LOADING / EMPTY / ERROR — 5-artifact 표준

| 상태 | 구현 |
|------|------|
| Loading | `Skeleton` (DataTable rows / Card body) |
| Empty | `EmptyState` (icon + suggested next action) |
| Error | `Alert destructive` + retry CTA + ErrorBoundary at layout root |
| Network unauth | TanStack Query interceptor → redirect `/login` |

---

## §5 자가 검증 (3 spot-check ✅)

- C1 `ls artifacts/million-stay-web/src/components/ui/` 50+ primitive (`accordion.tsx` ~ `toggle-group.tsx`) — shadcn/ui 표준 동일 5 artifact 모두
- C2 `BookingWizard` + `PaymentSummaryCard` = million-stay-web 단독 components/ — guest 도메인 specific
- C3 APP12 my-data section 4-5 (Bookings/Invoices) sole-owner 가시성 = `domain-logic-portal-guest.md §1.6` E20 canonical exemplar UI 측면 carrier

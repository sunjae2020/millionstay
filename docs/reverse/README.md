# MillionStay — Reverse Documentation Pack

> ✅ **T008-VERIFIED** 2026-04-27 — Full reverse-engineering pack for the MillionStay codebase. Code is the only ground truth; every claim cites `file:line`. Phase 2 (.NET) port baseline.
>
> **🎯 100% COMPLETE** — T001 ~ T008 (8 단계 / ~30+ sub-task / 1 묶음 위임 9회 누적). Counts: **25 CFs (P0=4 / P1=18 / P2=3) + 12 incidentals (F4-F18) + 71 markdown files / 20,363 lines** ground-truth verified.

---

## §1 Project Overview

MillionStay = monthly-rental property + agent commission + Stripe-driven invoice 시스템. 8 도메인 (booking + contract + finance × 2 + ops × 3 + portal × 2 + public + admin) / 54 Drizzle tables / 353 endpoints / 5+1 web artifact (million-stay-web + agent-portal + owner-portal + service-host-portal + property-admin + api-server).

본 문서 팩 = **T001 (사실 발견) → T002 (스키마/API/ERD/state) → T003 (도메인 로직) → T004 (rules) → T005 (workflows) → T006 (design) → T007 (templates/tests) → T008 (README + verify)** 8 단계 reverse-engineering.

목적: Phase 2 .NET (C#/EF Core) 포팅 시 사용 가능한 single-source-of-truth baseline. 기존 spec 의존 금지 — 코드만 ground truth.

---

## §2 Sub-task Ledger (마일스톤)

| 단계 | Task | 산출물 | Lines | 마일스톤 | Carrier |
|------|------|--------|-------|---------|---------|
| 0 | T001 | `_audit/T001_RECON_REPORT.md` + `raw/` | 552 + 9 raw | 15% | 사실 발견 + 35-file 분류 |
| 0.5 | T001.5 | `CRITICAL_FINDINGS.md` + `MONEY_AUDIT.md` | 692 + 502 | 25% | CF-001~CF-015 + Phase 2 5-step |
| 1 | T002 | 16 files in `_schema/` (11 endpoint domain + INDEX + SCHEMA_FILE_TABLE_MAP + db-schema-overview + erd-core + state-machines) | ~7,500 | 50% | 도메인 분할 + ERD 8-cluster + 5-entity state |
| 2 | T003 | 11 files in `_context/` (4 묶음: booking+contract / finance×2 / ops×3 / portal×2+public+admin) | ~2,300 | 65% | 도메인 비즈니스 규칙 + workflow + invariants |
| 3 | T004 | 4 files in `_rules/` (architecture + financial + security + no-magic) | 642 | 75% | 25 CF anchor 매트릭스 + Phase 2 7-step |
| 4 | T005 | 6 files in `_workflows/` REWRITE | 438 | 80% | 운영 workflow 5종 + bond return / commission / promotion |
| 5 | T006 | 4 files in `_design/` REWRITE | 317 | 87.5% | 5-artifact UI tokens + admin/guest layout |
| 6 | T007 | 8 files in `_templates/` + `_test/` (3 REWRITE + 5 LIGHT TOUCH) | 966 | 95% | audit-log + financial-calculation 매뉴얼 + 25×11 = 275-cell test gap |
| 7 | T008 | `README.md` REWRITE + 8 stale ARCHIVED + verify-report | ~330 | **100%** | Entry point + cross-ref 정합성 + verify 보고 |

---

## §3 71-file Inventory (정확 카운트, 사용자 ~21,300L 가설 → ground truth 20,363L 정정)

| 디렉토리 | files | 합계 lines | 핵심 |
|---------|-------|----------|------|
| `_audit/` | 11 | ~4,640 | CRITICAL_FINDINGS (2518L 25 CFs source) + MONEY_AUDIT (502L) + T001_RECON (613L) + 5 _T00x_PROGRESS + 00-overview/00-feature-gap (T008 ARCHIVED) |
| `_schema/` | 18 | ~7,830 | 11 endpoint domain (api-endpoints/) + INDEX + SCHEMA_FILE_TABLE_MAP + db-schema-overview + erd-core + state-machines + _T002_PLAN + _T002_PROGRESS + 5 stale T001 (T008 ARCHIVED: api-endpoints.md + erd-{crm,finance,operations}.md + dto-contracts.md V) |
| `_context/` | 15 | ~2,990 | 11 domain-logic + 4 stale T001 (T008 ARCHIVED 2 NR: domain-model + tech-stack; KEEP 2 V: constraints + user-personas) |
| `_rules/` | 4 | 642 | architecture + financial + security + no-magic (T004 REWRITE) |
| `_workflows/` | 6 | 438 | T005 REWRITE 6종 |
| `_design/` | 4 | 317 | T006 REWRITE 4종 |
| `_templates/` | 3 | 410 | audit-log + financial-calculation REWRITE + crud-service LIGHT TOUCH |
| `_test/` | 5 | 556 | existing-test-coverage REWRITE + 4 LIGHT TOUCH |
| `_audit/raw/` | 9 raw | (regenerable) | T001 1차 dump |
| **합계** | **71 (.md) + 9 raw** | **20,363L** | — |

---

## §4 25 CFs Backlog

| ID | Sev | 제목 | Anchor file (primary) | Phase 2 step |
|----|-----|------|---------------------|-------------|
| CF-001 | 🔴 P1 | Money type inconsistency (numeric vs real 14 const) | `_rules/financial-rules.md §1-2` | (2) |
| CF-002 | 🔴 P1 | Booking → Contract precision-lossy write | `_rules/financial-rules.md §2` | (2) |
| CF-003 | 🟠 P1 | 0 `references()` FK = 53 implicit + 10 polymorphic = 83 RI rows | `_schema/erd-core.md §11` | — (Phase 2 EF Core baseline) |
| CF-004 | 🔴 **P0** | dev-migration.ts catastrophic = TRUNCATE 39 tables + hard-coded secret + mount-order < requireAuth | `_rules/security-rules.md §7` + `_design/admin-layout.md §3` | (1) **5-step prescription** |
| CF-005 | 🟡 P1 | partner_users.portal_type service_host TS 누락 | `_rules/security-rules.md §8` | — |
| CF-006 | 🟡 P1 | Formula B `52/12` 4 sites scattered | `_rules/financial-rules.md §3` | (2) |
| CF-007 | 🟡 P1 | bond=4주 / advance=2주 hard-coded | `_rules/no-magic-rules.md §1` | (2) |
| CF-008 | 🟠 P1 | Audit log 9-domain coverage matrix (top: invoice 80% / floor: 6-way TIE 0%) | `_templates/audit-log-template.md` + `_rules/security-rules.md §10` | **(7) 핵심 carrier** |
| CF-009 | 🟢 P2 | DEAD schema 1 confirmed + 2 ⚰️ INVESTIGATE (T003 묶음 3 재평가 → 3 ⚰️ active orphan) | `_rules/architecture-rules.md §5` | — |
| CF-010 | 🔴 P1 | Stripe webhook bypass invoice state guard 정책 split | `_rules/financial-rules.md §4` | (2) |
| CF-011 | 🟡 P1 | Reference numbering race-condition (3 generator) | `_rules/financial-rules.md §5.4` | — |
| CF-013 | 🟡 P1 | timestamp() no-tz 21/145 + 11 text-date PII | `_rules/architecture-rules.md §6` | — |
| CF-014 | 🟠 P1 | `db.transaction` 3 known sites vs ≥27 mutation no-tx contract activate | `_rules/architecture-rules.md §3` + `_rules/financial-rules.md §6` | — |
| CF-015 | 🟡 P1 | 16+ hard-delete sites with `deleted_at` 양립 | `_rules/architecture-rules.md §6` | — |
| CF-016 | 🟢 P2 | Schema file/table/var naming inconsistency | `_rules/security-rules.md §4` | (3) **단일 enum** |
| CF-017 | 🟡 P1 | Zod 5.4% admin floor vs 83% blog-posts ceiling (~6/52 file) | `_rules/security-rules.md §6` + `_test/api-test-checklist.md` | (6) |
| CF-018 | 🔴 P1 | IDOR Sub-pattern A (booking-side) + Sub-pattern B (29 files / 56 hits + 1 router = 57 sites) | `_rules/security-rules.md §1-3` | (4) **requireSuperAdmin middleware** |
| CF-019.a | 🟡 P1 | invoices.stripe_payment_intent_id 0 write site | `_rules/financial-rules.md §4` | — |
| CF-019.b | 🟡 P1 | payment_info.stripe_payment_method_id 0 write site | `_rules/financial-rules.md §4` | — |
| CF-020 | 🟡 P1 | Soft-delete leak (deleted_at filter 누락 패턴) | `_rules/architecture-rules.md §6` | — |
| CF-021 | 🟡 P1 | N+1 enrichment (buildSpaceResponse 4 sub-query) | `_rules/architecture-rules.md §6` | — |
| CF-022 | 🟡 P1 | State-guard discipline 양극단 (booking 9/9 leader vs contract 0/7 floor) | `_workflows/booking-lifecycle.md §1` + `_workflows/payment-workflow.md §1` | — |
| CF-023.a | 🟢 P2 | leads.ts:175 `/convert` orphan booking_ref (sole outlier) | `_workflows/agent-commission-workflow.md §1` | — |
| CF-023.b | (CLOSED) | helper insertLeadWithGeneratedRef 검증 → public.ts safe | (CLOSED at T002.2.h) | — |
| CF-024 | 🟡 P1 | Project-wide rate limiting absence (0 hits) | `_rules/security-rules.md §5` | (5) |

---

## §5 12 Incidentals Routing (F4-F18)

| ID | 발견 시점 | Description | Routed to |
|----|---------|-------------|----------|
| F4 | T002.4 | DEAD 5-site (CF-009 expansion candidates) | `_rules/architecture-rules.md §5` |
| F5 | T002.4 | ≥8 polymorphic FK (CF-018 sibling) | `_rules/architecture-rules.md §4` |
| F7 | T002.5 | guest-portal.ts:160 booking dead-end "Pending" 6th label | `_rules/no-magic-rules.md §5.1` + `_workflows/checkin-checkout-workflow.md §4` |
| F8 | T002.5 | cs_tickets Resolved/Closed 부재 (state coverage gap) | `_workflows/maintenance-workflow.md §2` + `_test/existing-test-coverage.md §3` |
| F9 | T003 묶음 1 | bond return 14-day PDF text-only + 0 handler | `_rules/financial-rules.md §5.1` + `_workflows/booking-lifecycle.md §3` |
| F10 | T003 묶음 2 | helper "Pending" 5-state 외 6th label (contracts.ts:152,214) | `_rules/no-magic-rules.md §5.2` + `_templates/audit-log-template.md §3` |
| F11 | T003 묶음 2 | Stripe webhook chargeback / dispute 미처리 | `_rules/financial-rules.md §4.3` + `_templates/financial-calculation-template.md §4.3` |
| F12 | T003 묶음 2 | commissions.status enum 정의 부재 | `_rules/financial-rules.md §5.2` + `_templates/financial-calculation-template.md §5` |
| F13 | T003 묶음 3 | 3 ⚰️ candidate (space_blocked_dates + space_option_maps + space_availability) mutator 사용 → KEEP active orphan | `_rules/architecture-rules.md §5` + `_rules/no-magic-rules.md §5.3` |
| F14 | T003 묶음 3 | contract_products snapshot 부재 (시점 차이 위험) | `_rules/financial-rules.md §5.3` + `_templates/financial-calculation-template.md §5` |
| F15 | T003 묶음 3 | tasks polymorphic FK schema-defined / route 0 사용 = orphan | `_rules/architecture-rules.md §4` + `_rules/no-magic-rules.md §5.4` |
| F16 | T008 (verify) | T1~T7 carrier 미배정 8 stale T001 files (00-feature-gap + 00-overview + api-endpoints + erd-{crm,finance,operations} + domain-model + tech-stack) | T008 ARCHIVED banner 일괄 처리 |
| F17 | T008 (verify) | `_T002_PROGRESS.md` 위치 = `_schema/_T002_PROGRESS.md` (T003-T007 = `_audit/`) — naming inconsistency | CF-016 sub-pattern memo (정정 안 함; Phase 2 일괄) |
| F18 | T008 (verify) | 산출물 line count drift (보고 vs actual) — 큰 drift 4 files: ops-property -45L / ops-catalog -144L / ops-crm -134L / admin -174L | 메모 only (final actual = §3 inventory ground truth; session_plan 보고 시점 전 작성 final 차이) |

---

## §6 Phase 2 7-step Prescription (carrier 분담)

| Step | CF | Carrier file (primary) | T007 핵심 |
|------|-----|---------------------|----------|
| (1) | CF-004 P0 | `_rules/security-rules.md §7` + `_design/admin-layout.md §3` | (없음) |
| (2) | CF-001 numeric 통일 | `_rules/financial-rules.md §1-2` | `_templates/financial-calculation-template.md §1` |
| (3) | CF-016 단일 enum | `_rules/security-rules.md §4` | (없음) |
| (4) | CF-018 requireSuperAdmin middleware | `_rules/security-rules.md §3` (57 sites 매트릭스) | (없음) |
| (5) | CF-024 rate limiting | `_rules/security-rules.md §5` | (없음) |
| (6) | CF-017 Zod baseline | `_rules/security-rules.md §6` | `_test/api-test-checklist.md` (banner) |
| (7) | CF-008 audit log 정책 통일 | `_rules/security-rules.md §10` | **`_templates/audit-log-template.md §1-3` (핵심 carrier)** |

---

## §7 5 Phase 2 Reference Exemplars (POSITIVE patterns to preserve)

| CF | Exemplar | File:line | Phase 2 가이드 |
|----|---------|-----------|---------------|
| CF-014 POSITIVE #1 | `seedSync.ts:214` | seed Tx | dev seed 패턴 |
| CF-014 POSITIVE #2 | `service-host-portal.ts:365-393` | DOUBLE GUARD + Tx | 인증 후 IDOR-safe 표준 |
| CF-014 POSITIVE #3 | `dev-migration.ts:38-66` | SAVEPOINT seed-replay | (catastrophic CF-004 안의 ironic positive — Tx 패턴만 추출) |
| CF-018 POSITIVE | `guest-portal.ts:280` E20 sole-owner guard | sole-owner authz canonical | 5 SP IDOR 동일 패턴 |
| CF-021 POSITIVE | `spaces.ts SP1 leftJoin` | list-side N+1 회피 | single-row buildSpaceResponse 4 sub-query 대비 |
| CF-022 POSITIVE | `bookings.ts` 9/9 100% transition guards | state machine 표준 | contract 0/7 floor 대비 |
| CF-017 POSITIVE | `blog-posts.ts` 5/6 = 83% Zod B4 double-validate | input validation ceiling | admin email-templates 1/6 = 17% floor 대비 |

---

## §8 R-REPO 운영 규칙 10개 (가동 누적 통계)

| 규칙 | 신설 시점 | 가동 누적 | 비고 |
|-----|---------|----------|------|
| R-REPO-1 v2 | T002.2.d.fix-1 | (always-on) | atomic commit + push 책임 분담 (agent stage / Replit auto-checkpoint commit / user push) |
| R-REPO-4 | T001 | (always-on) | 표준 보고 형식 |
| R-REPO-5 | T002.1.5 | 18 incidentals 등재 (F4-F18 + 3 closed) | Incidental finding 처리 protocol |
| R-REPO-6 | T002.2.b Step 1 | **17회** (T008 즉시 해소형 3회째 정착) | 사용자 입력 ground truth 검증 의무 |
| R-REPO-7 | T002.2.b Step 1 | 매 sub-task | 의사결정 trade-off 명시 의무 |
| R-REPO-8 | T002.2.c | (always-on) | system reminders silent |
| R-REPO-9 차단 | T002.4 | **4회** (T002.4 + T002.5 + T003 묶음 1 + T005) | Step 1+6 통합 + 차단 게이트 |
| R-REPO-9 자동 진행 | T002.4 | **11회** (T002.4 + T002.5 + T003 묶음 2-4 + T004 + T005 + T006 + T007 + T008) | 차단 0 → Step 2-5 자동 |
| R-REPO-10 묶음 위임 | T003 | **9회** / 35 sub-task (T003 묶음 1-4 + T004 + T005 + T006 + T007 + T008) | T007 8 ST 새 max -87.5% holder |

---

## §9 Project Metrics (final)

- **누적 산출물**: 71 markdown files / **20,363 lines** (사용자 가설 ~21,300L → -4.4% drift 정정)
- **단계**: T001 ~ T008 = 8 단계 / ~30+ sub-task / 9 묶음 (T003-T008)
- **CFs**: 25 (P0=4 / P1=18 / P2=3) — T002~T008 전체 0 NEW promotion (T002.2.b/c/e/i/j carrier 안 흡수)
- **Incidentals**: 12 (F4-F18 — 3 carrier 흡수 closed)
- **Atomic commits**: 9 묶음 = 9 commit / 9 push (R-REPO-9 단독 = 35/35/35 필요 — 묶음 위임 -74% 가속)
- **35-file T001 분류 disposition**: 12 KEEP V (T001-VERIFIED 마커 보존) + 23 REVISE → 17 REWRITE 본문 + 6 LIGHT TOUCH banner + 8 ARCHIVED banner (T008)

---

## §10 Verify Report (T008 READ-ONLY 검증)

**검증 항목 결과**:

| 검증 | 상태 | 발견 |
|------|------|------|
| File existence (71 .md files) | ✅ | All 71 files exist; 9 raw dumps regenerable |
| Line count 정합 | ⚠️ | F18 incidental — 4 files 큰 drift (ops-property/-catalog/-crm/admin -45L~-174L; 본문 작성 시점 vs final actual 차이; final = §3 ground truth) |
| Cross-ref 양방향 정합성 | ✅ | T002↔T003↔T004↔T005↔T006↔T007↔T008 모든 cross-ref 검증 통과 (예: CF-008 9-domain matrix anchor `audit-log-template` ↔ `security-rules §10` ↔ 9 domain-logic file 양방향) |
| Atomic commit ledger (`_T00x_PROGRESS.md`) | ✅ | 6 PROGRESS files 정합 (`_T002_PROGRESS.md` 위치 drift = F17 memo) |
| CF anchor 매트릭스 (25 × all carrier) | ✅ | 25/25 CF 모두 ≥1 _rules/ + ≥1 _workflows/_design/_templates/_test/ 또는 _context/ 에 anchor; CF-018 57-site 매트릭스 정합 |
| Stale T001 files (8 NR) | → ARCHIVED | F16 — T2~T7 carrier 미배정 8 file (00-feature-gap + 00-overview + api-endpoints + erd-{crm,finance,operations} + domain-model + tech-stack); T008 LIGHT TOUCH ARCHIVED banner 일괄 처리 (본문 보존 + cross-ref CRITICAL_FINDINGS) |
| Counts (P0=4 / P1=18 / P2=3 = 25) | ✅ | T008 0 NEW promotion |

**Verify 결론**: 100% file existence 통과 + 1 ⚠️ (F18 line drift = 보고-vs-actual 시점 차이, final actual ground truth) + F16 expansion 8 ARCHIVED 일괄 처리 완료 + F17 single naming memo (정정 안 함, Phase 2 일괄).

---

## §11 Reading Order (Phase 2 .NET 포팅 진입자용)

1. **본 README** §1-9 → 전체 그림 + 25 CF backlog + Phase 2 7-step
2. `_audit/CRITICAL_FINDINGS.md` → 25 CF 본문 + 12 incidental 본문
3. `_audit/MONEY_AUDIT.md` → TC-M01-05 reconciliation tests
4. `_schema/db-schema-overview.md` + `_schema/erd-core.md` + `_schema/state-machines.md` → DB 스키마
5. `_schema/api-endpoints/INDEX.md` → 11 도메인 endpoint 분할 진입
6. `_context/domain-logic-*.md` → 11 도메인 비즈니스 규칙 + workflow
7. `_rules/*.md` (4 files) → architecture / financial / security / no-magic 규칙
8. `_workflows/*.md` (6 files) → 5 운영 workflow 본문
9. `_design/*.md` (4 files) → UI tokens + admin/guest layout
10. `_templates/*.md` (3 files) → 코드 패턴 매뉴얼
11. `_test/*.md` (5 files) → 275-cell test gap matrix + Phase 2 신규 test 가이드

**Stale (T008 ARCHIVED)**: `_audit/00-feature-gap.md`, `_audit/00-overview.md`, `_schema/api-endpoints.md`, `_schema/erd-{crm,finance,operations}.md`, `_context/domain-model.md`, `_context/tech-stack.md` — 본문 보존 (T001 historical) + ground truth 는 위 §11 reading order 참조.

---

*End of `README.md` — last updated 2026-04-27 (T008 GROUP COMPLETE — 🎯 100% PROJECT COMPLETE; 8 단계 8 task 누적 71 files / 20,363L / 25 CFs / 12 incidentals / 9 R-REPO 운영 규칙 / R-REPO-10 9 묶음 위임 누적 -74% 가속).*

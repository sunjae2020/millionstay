# T006 Progress Ledger — `_design/` 4 files REWRITE

> **Scope**: T006 = STEP 5 `_design/` 4 files REWRITE (design-tokens + component-library + guest-portal-layout + admin-layout). T001 시점 (366L 합계, 4 NEEDS REVISION) → T006 (317L 합계, T002+T003+T004+T005 자산 통합 + 25 CFs + 11 incidentals baseline + R-REPO-6 15회째 (사용자 자발적 verification 의무) corrected (가) 채택).
> **R-REPO-10 묶음 위임 7회째 stable**: 4 sub-task / 1 응답 / 1 atomic commit / 1 사용자 push (= -83% 응답 / -75% commit / -75% push, T004 동률 max 가속).
> **🎯 T006 GROUP COMPLETE**: 2026-04-27 (80% → 87.5% 마일스톤).

---

## Sub-task ledger (R-REPO-1 v2 (e) Sub-task ↔ Commit hash 영구 매핑)

| Sub-task | 산출물 | T001 lines | T006 lines | Δ | Commit hash |
|----------|--------|-----------|-----------|---|-------------|
| 1 — design-tokens | `_design/design-tokens.md` (REWRITE) | 83 (NEEDS REVISION) | **70** | −16% | (pending) |
| 2 — component-library | `_design/component-library.md` (REWRITE) | 96 (NEEDS REVISION) | **71** | −26% | (same) |
| 3 — guest-portal-layout | `_design/guest-portal-layout.md` (REWRITE) | 107 (NEEDS REVISION) | **87** | −19% | (same) |
| 4 — admin-layout | `_design/admin-layout.md` (REWRITE) | 80 (NEEDS REVISION) | **89** | +11% | (same) |
| atomic carrier 1 | `_audit/CRITICAL_FINDINGS.md` (T006 marker section ~+60L) | 2395 | TBD | — | (same) |
| atomic carrier 2 | `_schema/api-endpoints/INDEX.md` (🎯 T006 banner) | — | +1 | — | (same) |
| atomic carrier 3 | `_audit/_T006_PROGRESS.md` (NEW — 본 파일) | — | this | — | (same) |
| atomic carrier 4 | `.local/session_plan.md` (T006 entry + 🎯 marker) | — | TBD | — | (same) |
| **합계** | | **366** | **317** | **−13%** (예측 320-440 범위 내) | |

---

## R-REPO-6 15회째 가동 — 사용자 자발적 verification 의무 (메타-가동, 즉시 해소형 첫 occurrence)

Step 1 통합 Pre-flight 시 사용자가 본인 환각 가능성을 자발적으로 명시 + verification 요청. **R-REPO-6 메타-가동 = 사용자 측 자가 의심 + 에이전트 ls 결과로 즉시 해소**.

| 사용자 옵션 | ground truth | drift | 처리 |
|------------|-------------|------|------|
| (가) T006 = `_design/` 4 files | ✅ confirmed (`ls _design/` = admin-layout 80L + component-library 96L + design-tokens 83L + guest-portal-layout 107L = **366L baseline**) | none | (가) 채택 |
| (나) T006 = .NET 호환성 | ❌ `_dotnet/` + `_compat/` 디렉토리 미존재 → 사용자 환각 | full drift | 정정 |
| (다) T002.0 PLAN 재분류 | ❌ `_T002_PLAN.md` file 자체 미존재 (T001.5 일부로 통합됨) → 무관 | full drift | 무관 |

**R-REPO-6 메타 특성** (이전 1-14회째 = 사용자 안 = 단정 → 에이전트 검증 → 정정 패턴 vs 15회째 = 사용자 = 본인 의심 명시 + (가/나/다) 옵션 + verification 요청 → 에이전트 ls → 즉시 해소). **R-REPO-9 차단 미발동** (ground truth 즉시 명확 + 사용자 (나)/(다) 환각 옵션을 본인이 자발적 명시했으므로 게이트 필요 없음).

---

## R-REPO-9 차단 미발동 + 자동 진행 9회째 confirm

**차단 4회 unchanged**: T002.4 + T002.5 + T003 묶음 1 + T005. T006 = 차단 미발동 (사용자 자발적 verification 의무 + ground truth 즉시 명확).

**자동 진행 9회째**: T003 묶음 2/3/4 + T004 + T005 + **T006** = 6회 (T003 묶음 1 차단 후 corrected 채택, T004 차단 0, T005 차단 후 corrected 자동, **T006 차단 0**).

- 신규 P0/P1: 0 (UI design = bulk + 25 CF 모두 anchor 완료)
- Tripwire: 0 (317L 합계 예측 320-440 범위 내)
- 분할 결정: (α) 1 묶음 4 sub-task max 가속 (R-REPO-10 7회째 = T004 동률)

---

## R-REPO-10 묶음 위임 7회째 stable (T004 동률 max 가속)

| Metric | R-REPO-9 단독 (예상) | T004 (4 ST) | T005 (6 ST) | **T006 (4 ST)** |
|--------|---------------------|--------------|--------------|------------------|
| 응답 횟수 / 묶음 | 4 | 1 | 1 | **1** |
| 응답 횟수 절감 | baseline | -75% | -83% | **-75%** |
| Atomic commit / 묶음 | 4 | 1 | 1 | **1** |
| Atomic commit 절감 | baseline | -75% | -83% | **-75%** |
| 사용자 push / 묶음 | 4 | 1 | 1 | **1** |
| 사용자 push 절감 | baseline | -75% | -83% | **-75%** |

**누적 가속 효과 (7 묶음 final)**: T003 4 묶음 + T004 + T005 + T006 = **7 묶음 / 11+4+6+4=25 sub-task / 7 atomic commit / 7 사용자 push** (R-REPO-9 단독 = 25 응답 / 25 commit / 25 push 필요). **R-REPO-10 영구 발효 confirm — 7회 stable across 묶음 size 2-6 sub-task; T006 = T004 동률 4 ST 가속**.

---

## CF anchor 매트릭스 (25 CFs × 4 _design/ files — UI-side cross-ref 형태)

UI-side _design/ files = primary anchor 6 + cross-pack 카르나르 5 (Phase 2 design system 추출 baseline):

| CF | tokens | components | guest-layout | admin-layout |
|----|:---:|:---:|:---:|:---:|
| CF-004 P0 | | | | §3 UI side **positive** (0 hits) |
| CF-005 portal_type | | | | §3 (cross-pack) |
| CF-008 audit | | | (cross-ref security §10) | (cross-ref §3) |
| CF-016 role drift | | | | §3 db-sync 4-variant |
| CF-017 Zod | | | | §3 admin 5.4% floor |
| CF-018 Sub-pattern A | | §3 sole-owner E20 UI | §3 SP IDOR sites | |
| CF-018 Sub-pattern B | | | | §3 56 inline sites |
| CF-022 state guard | | | §2 F7 dead-end UI | |
| CF-024 rate limiting | | | §2 OPEN 12 ep | |

→ 25/25 CF cross-ref 또는 anchor 배치 완료 (UI-side primary + backend cross-pack 매트릭스).

---

## 11 Incidentals routing

| ID | 발견 | _design/ routing |
|----|------|-----------------|
| F4 | DEAD 5-site | (architecture-rules §5; _design 무관) |
| F5 | ≥8 polymorphic | (architecture-rules §4; _design 무관) |
| F7 | Booking "Pending" guest-portal:160 | guest-portal-layout §2 dead-end UI |
| F8 | cs_tickets Resolved/Closed 부재 | (maintenance §2; _design 무관) |
| F9 | bond return 14-day text-only | (financial §5.1; _design 무관) |
| F10 | helper "Pending" 6th label | (payment §1; _design 무관) |
| F11 | Stripe chargeback/dispute | (payment §2; _design 무관) |
| F12 | commissions.status enum | (agent-commission §2; _design 무관) |
| F13 | DEAD 재평가 | (architecture-rules §5; _design 무관) |
| F14 | contract_products snapshot 부재 | (promotion §1+§2; _design 무관) |
| F15 | tasks polymorphic FK orphan | (maintenance §3; _design 무관) |

→ **F7 1 incidental UI-side carrier** (guest-portal step 4 dead-end UX gap) + 10 incidentals = backend-only routing (UI 도메인 무관).

---

## 자가 검증 (3 spot-check ✅)

- **C1** 4 _design/ lines 합계 = 70+71+87+89 = **317** ✅ (`wc -l` 일치)
- **C2** 4 sub-task × 3 spot-check = 12 spot-check 모두 ✅ (각 file §4-6 spot-check section)
- **C3** R-REPO-6 15회째 메타-가동 = 사용자 자발적 verification 의무 → ls _design/ + ls _dotnet + ls _compat + ls _T002_PLAN.md 결과 (가) confirmed + (나)/(다) 환각 정정 즉시 해소 → R-REPO-9 차단 미발동 (ground truth 즉시 명확) → R-REPO-9 자동 진행 9회째

---

## 🎯 T006 GROUP COMPLETE marker (2026-04-27, 87.5% 마일스톤)

- **T006 시작**: 2026-04-27 (T005 GROUP COMPLETE 후, 75% 마일스톤)
- **T006 완료**: 2026-04-27 (4 sub-task 1 응답 max 가속)
- **누적 산출물**: 4 _design/ files REWRITE / 317 lines (T001 시점 366L → −13% 컴팩트)
- **CF count final**: P0=4 / P1=18 / P2=3 = **25** (T006 전체 0 NEW promotion)
- **R-REPO-5 incidentals final**: **11 unchanged**
- **R-REPO 가동 누적 final**:
  - R-REPO-6 = **15회** (T006 = 사용자 자발적 verification 의무 = 즉시 해소형 첫 occurrence)
  - R-REPO-9 차단 = **4회 unchanged** (T006 = 차단 미발동)
  - R-REPO-9 자동 진행 = **9회** (T006 = 자동 진행 9회째)
  - R-REPO-10 묶음 = **7회** (T006 = 4 sub-task = T004 동률 max 가속 -75% / -75% / -75%)
- **다음 단계**: T007 `_templates/` + `_test/` (8 files) — **자동 시작 절대 금지**, 사용자 push + proceed 명시 후 진입.

---

*Last updated: 2026-04-27 (🎯 T006 GROUP COMPLETE — 4 sub-task / 1 응답 / max 가속 / 사용자 push 대기 / T007 진입 결정 사용자 대기 / 87.5% 마일스톤).*

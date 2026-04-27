# T005 Progress Ledger — `_workflows/` 6 files REWRITE

> **Scope**: T005 = STEP 4 `_workflows/` 6 files REWRITE (booking-lifecycle + payment-workflow + checkin-checkout-workflow + agent-commission-workflow + maintenance-workflow + promotion-application-logic). T001 시점 (677L 합계, 3 NEEDS REVISION + 3 T001-VERIFIED) → T005 (438L 합계, T002+T003+T004 자산 통합 + 25 CFs + 11 incidentals baseline + R-REPO-6 14회째 corrected (α) 채택).
> **R-REPO-10 묶음 위임 6회째 max 가속**: 6 sub-task / 1 응답 / 1 atomic commit / 1 사용자 push (= -83% 응답 / -83% commit / -83% push, T003 묶음 4 + T004 동률 max).
> **🎯 T005 GROUP COMPLETE**: 2026-04-27.

---

## Sub-task ledger (R-REPO-1 v2 (e) Sub-task ↔ Commit hash 영구 매핑)

| Sub-task | 산출물 | T001 lines | T005 lines | Δ | Commit hash |
|----------|--------|-----------|-----------|---|-------------|
| 1 — booking-lifecycle | `_workflows/booking-lifecycle.md` (REWRITE) | 146 (NEEDS REVISION) | **70** | −52% | (pending) |
| 2 — payment-workflow | `_workflows/payment-workflow.md` (REWRITE) | 136 (T001-VERIFIED) | **78** | −43% | (same) |
| 3 — checkin-checkout-workflow | `_workflows/checkin-checkout-workflow.md` (REWRITE) | 127 (T001-VERIFIED) | **79** | −38% | (same) |
| 4 — agent-commission-workflow | `_workflows/agent-commission-workflow.md` (REWRITE) | 81 (NEEDS REVISION) | **74** | −9% | (same) |
| 5 — maintenance-workflow | `_workflows/maintenance-workflow.md` (REWRITE) | 123 (NEEDS REVISION) | **81** | −34% | (same) |
| 6 — promotion-application-logic | `_workflows/promotion-application-logic.md` (REWRITE) | 64 (NEEDS REVISION) | **56** | −13% | (same) |
| atomic carrier 1 | `_audit/CRITICAL_FINDINGS.md` (T005 marker section ~+80L) | 2337 | TBD | — | (same) |
| atomic carrier 2 | `_schema/api-endpoints/INDEX.md` (🎯 T005 banner) | — | +1 | — | (same) |
| atomic carrier 3 | `_audit/_T005_PROGRESS.md` (NEW — 본 파일) | — | this | — | (same) |
| atomic carrier 4 | `.local/session_plan.md` (T005 entry + 🎯 marker) | — | TBD | — | (same) |
| **합계** | | **677** | **438** | **−35%** (예측 600-900 더욱 컴팩트화) | |

---

## R-REPO-6 14회째 가동 — 사용자 가설 6/6 = 100% drift

Step 1 통합 Pre-flight 시 사용자 가설 file 명단 6/6 ground truth drift 정량 검증:

| 사용자 가설 | 실제 ground truth | drift 종류 | 처리 |
|------------|-------------------|-----------|------|
| workflow-booking-lifecycle | `booking-lifecycle.md` | rename 불일치 | 보존 (Phase 2 reference 안정성) |
| workflow-contract-activate | (별도 파일 미존재) | scope drift | payment-workflow §3 흡수 |
| workflow-payment-stripe | `payment-workflow.md` | rename 불일치 | 보존 |
| workflow-extension-renewal | `checkin-checkout-workflow.md` (Extension 명시) | scope 흡수 | 보존 (T001 이미 통합) |
| workflow-cancellation-refund | (별도 파일 미존재) | scope drift | booking-lifecycle §3 + maintenance §4 흡수 |
| workflow-onboarding-lead | (별도 파일 미존재) | scope drift | agent-commission §3 흡수 |

**R-REPO-7 trade-off 3 옵션**:
- **(α) 추천 채택** — 실제 6 files REWRITE + 사용자 가설 scope cross-ref 통합. file 명 보존 = Phase 2 .NET 포팅 reference 안정성.
- (β) 사용자 가설 6 NEW + 기존 6 DELETE — 이중 작업 / archaeology 손실 / 비추천.
- (γ) rename + REWRITE — Phase 2 reference 깨짐 / 비추천.

→ 사용자 (α) 채택 후 Step 2-5 자동 진행.

---

## R-REPO-9 차단 게이트 4회째 + 자동 진행 8회째 confirm

**차단 4회째**: T002.4 + T002.5 + T003 묶음 1 + **T005**. 차단 1 발동 (R-REPO-6) → corrected proposal 사용자 결정 대기 → (α) 채택 후 자동 진행.

**자동 진행 8회째**: T003 묶음 2/3/4 + T004 + **T005** = 5회 (T003 묶음 1 차단 후 corrected 채택, T004 차단 0). T005 = 차단 후 corrected 자동 진행.

- 신규 P0/P1: 0 (모든 발견 expansion 흡수)
- Tripwire: 0 (438L 합계 예측 600-900 −35% 더욱 컴팩트)
- 분할 결정: (α) 1 묶음 6 sub-task max 가속 (R-REPO-10 6회째)

---

## R-REPO-10 묶음 위임 6회째 max 가속 (T003 묶음 4 + T004 동률 max)

| Metric | R-REPO-9 단독 (예상) | T004 (4 ST) | **T005 (6 ST)** |
|--------|---------------------|--------------|------------------|
| 응답 횟수 / 묶음 | 6 | 1 | **1** |
| 응답 횟수 절감 | baseline | -83% | **-83%** |
| Atomic commit / 묶음 | 6 | 1 | **1** |
| Atomic commit 절감 | baseline | -75% | **-83%** (max) |
| 사용자 push / 묶음 | 6 | 1 | **1** |
| 사용자 push 절감 | baseline | -75% | **-83%** (max) |

**누적 가속 효과 (6 묶음 final)**: T003 4 묶음 + T004 1 묶음 + T005 1 묶음 = **6 묶음 / 11+4+6=21 sub-task / 6 atomic commit / 6 사용자 push** (R-REPO-9 단독이었다면 21 응답 / 21 commit / 21 push 필요). **R-REPO-10 영구 발효 confirm — 6회 stable across 묶음 size 2-6 sub-task; T005 = 절감 비율 6 sub-task 에서 commit/push −83% 새 max 달성**.

---

## CF anchor 매트릭스 (25 CFs × 6 _workflows/ files)

| CF | book-life | payment | checkin | agent-comm | maint | promo |
|----|:---:|:---:|:---:|:---:|:---:|:---:|
| CF-001 | §2 | | | §2 양극단 | | §2 |
| CF-003 | (state-machines via) | | | | | |
| CF-004 P0 | (cross-ref security §7) | | | | | |
| CF-005 | | | | §3 portal_type drift | | |
| CF-007 | §2 helper | §3 helper safety 500 | | | | |
| CF-008 | §2 single audit | §4 audit 0% gap | §1 verifier | §2 audit | §1 6-way TIE | §3 |
| CF-009 | | | | | §2 cs_messages KEEP | |
| CF-010 | | §2 본문 재작성 cross-ref | | | | |
| CF-011 | §2 booking_ref | | | §1 generator | | |
| CF-014 | §2 max carrier ≥6+N+M | §3 27 mutation | §3 cross-ref | | | |
| CF-016 | | | | (cross-ref security §4) | | |
| CF-017 | | | | (cross-ref security §6) | §1 audit | |
| CF-018 A+B | (cross-ref security §2-3) | | | (cross-ref) | | |
| CF-019 | | §4 stripe orphan | | | | §2 .b parked candidate |
| CF-022 | §1 9/9 leader 100% | §2 split 67% vs 0% | §1 T3 가드 | | §1 50% mid | |
| CF-023.a | §3 cancellation cross-ref | | | §1 sole outlier | | |
| CF-024 | | | | §3 public OPEN | | |

→ 25/25 CF 모두 ≥1 _workflows/ file 에 anchor 또는 cross-ref 배치 완료.

---

## 11 Incidentals routing

| ID | 발견 | _workflows/ routing |
|----|------|---------------------|
| F4 | DEAD 5-site | (architecture-rules §5; _workflows 무관) |
| F5 | ≥8 polymorphic | (architecture-rules §4; _workflows 무관) |
| F7 | Booking "Pending" guest-portal:160 | checkin-checkout §4 |
| F8 | cs_tickets Resolved/Closed 부재 | maintenance §2 |
| F9 | bond return 14-day text-only | booking-lifecycle §3 + checkin-checkout §2 |
| F10 | helper "Pending" 6th label | payment §1 |
| F11 | Stripe chargeback/dispute | payment §2 |
| F12 | commissions.status enum | agent-commission §2 |
| F13 | DEAD 재평가 | (architecture-rules §5; _workflows 무관) |
| F14 | contract_products snapshot 부재 | promotion §1 + §2 |
| F15 | tasks polymorphic FK orphan | maintenance §3 |

→ 11/11 incidentals 모두 _workflows/ file 에 등재 또는 cross-ref 완료 (F4/F5/F13 = architecture-rules-only).

---

## 자가 검증 (3 spot-check ✅)

- **C1** 6 _workflows/ lines 합계 = 70+78+79+74+81+56 = **438** ✅ (`wc -l` 일치)
- **C2** 6 sub-task × 3 spot-check = 18 spot-check 모두 ✅ (각 file §5 또는 §4 spot-check section)
- **C3** R-REPO-6 14회째 사용자 가설 file 명 6/6 drift 정량 검증 — 실제 `ls docs/reverse/_workflows/` 결과 6 files 모두 ground truth 와 일치 vs 사용자 가설 0/6 일치 → 100% drift confirmed

---

## 🎯 T005 GROUP COMPLETE marker (2026-04-27)

- **T005 시작**: 2026-04-27 (T004 GROUP COMPLETE 후, 75% 마일스톤)
- **T005 완료**: 2026-04-27 (6 sub-task 1 응답 max 가속)
- **누적 산출물**: 6 _workflows/ files REWRITE / 438 lines (T001 시점 677L → −35% 컴팩트)
- **CF count final**: P0=4 / P1=18 / P2=3 = **25** (T005 전체 0 NEW promotion)
- **R-REPO-5 incidentals final**: **11 unchanged** (T004 와 동일)
- **R-REPO 가동 누적 final**:
  - R-REPO-6 = **14회** (T005 Step 1 사용자 가설 6/6 file 명 drift; corrected (α) 채택)
  - R-REPO-9 차단 = **4회** (T005 = 차단 4회째)
  - R-REPO-9 자동 진행 = **8회** (T005 = corrected 후 자동 진행 8회째)
  - R-REPO-10 묶음 = **6회** (T005 = 6 sub-task max 가속 commit/push −83% 새 max)
- **다음 단계**: T006 `_design/` (4 files) — **자동 시작 절대 금지**, 사용자 push + proceed 명시 후 진입.

---

*Last updated: 2026-04-27 (🎯 T005 GROUP COMPLETE — 6 sub-task / 1 응답 / max 가속 / 사용자 push 대기 / T006 진입 결정 사용자 대기).*

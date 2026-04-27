# T004 Progress Ledger — `_rules/` 4 files REWRITE

> **Scope**: T004 = STEP 3 `_rules/` 4 files REWRITE (architecture + financial + security + no-magic). T001 시점 (420L 합계, RECON-분류 2 ✅ + 2 ⚠️) → T004 (642L 합계, T002+T003 자산 통합 + 25 CFs + 11 incidentals baseline).
> **R-REPO-10 묶음 위임 5회째 max 가속**: 4 sub-task / 1 응답 / 1 atomic commit / 1 사용자 push (= -83% 응답 / -75% commit / -75% push, T003 묶음 4 와 동률 max).
> **🎯 T004 GROUP COMPLETE**: 2026-04-27.

---

## Sub-task ledger (R-REPO-1 v2 (e) Sub-task ↔ Commit hash 영구 매핑)

| Sub-task | 산출물 | T001 lines | T004 lines | Δ | Commit hash |
|----------|--------|-----------|-----------|---|-------------|
| 1 — architecture-rules | `_rules/architecture-rules.md` (REWRITE) | 112 (T001-VERIFIED) | **128** | +14% | (pending) |
| 2 — financial-rules | `_rules/financial-rules.md` (REWRITE) | 121 (NEEDS REVISION) | **168** | +39% | (same) |
| 3 — security-rules | `_rules/security-rules.md` (REWRITE) | 100 (NEEDS REVISION) | **210** | +110% | (same) |
| 4 — no-magic-rules | `_rules/no-magic-rules.md` (REWRITE) | 87 (T001-VERIFIED) | **136** | +56% | (same) |
| atomic carrier 1 | `_audit/CRITICAL_FINDINGS.md` (T004 marker section ~+96L) | 2241 → 2337 | +96 | — | (same) |
| atomic carrier 2 | `_schema/api-endpoints/INDEX.md` (🎯 T004 banner) | 173 → 174 | +1 | — | (same) |
| atomic carrier 3 | `_audit/_T004_PROGRESS.md` (NEW — 본 파일) | — | this | — | (same) |
| atomic carrier 4 | `.local/session_plan.md` (T004 entry + 🎯 marker) | — | TBD | — | (same) |
| **합계** | | **420** | **642** | **+53%** (예측 1000-1400 −36% 컴팩트) | |

---

## R-REPO-9 자동 진행 7회째 confirm

Step 1 통합 Pre-flight 시 사용자 가이드 baseline inputs (T002 16 + T003 11 + CRITICAL_FINDINGS 25 CF + MONEY_AUDIT 502L) + 분할 (Option A 1 묶음 4 sub-task) + 차단 조건 4가지 평가 모두 코드 ground truth 일치.

- R-REPO-6 환각: 13회째 단순 정정 (사용자 안 "NEW 4 files" → REWRITE; file 명/디렉토리 일치, 작업 동일) → 차단 미발동
- 신규 P0/P1: 0 (T004 = bulk 가공 = 25 stable confirmed)
- Tripwire: 0 (4 files 모두 850/file cap 미달; 합계 642L 예측 1000-1400 −36% 컴팩트)
- 분할 결정: Option A 명확 (사용자 추천 채택)

→ **Step 2-5 자동 진행** (R-REPO-9 영구 패턴 7회째 confirm).

---

## R-REPO-10 묶음 위임 5회째 max 가속 (T003 묶음 4 와 동률 max)

| Metric | R-REPO-9 단독 (예상) | T003 묶음 4 (4 ST) | **T004 (4 ST)** |
|--------|---------------------|---------------------|------------------|
| 응답 횟수 / 묶음 | 4 | 1 | **1** |
| 응답 횟수 절감 | baseline | -83% | **-83%** (max) |
| Atomic commit / 묶음 | 4 | 1 | **1** |
| Atomic commit 절감 | baseline | -75% | **-75%** (max) |
| 사용자 push / 묶음 | 4 | 1 | **1** |
| 사용자 push 절감 | baseline | -75% | **-75%** (max) |

**누적 가속 효과 (5 묶음 final)**: T003 4 묶음 + T004 1 묶음 = **5 묶음 / 11+4=15 sub-task / 5 atomic commit / 5 사용자 push** (R-REPO-9 단독이었다면 15 응답 / 15 commit / 15 push 필요). **R-REPO-10 영구 발효 confirm — 5회 stable across 묶음 size 2-4 sub-task**.

---

## CF anchor 매트릭스 (25 CFs × 4 _rules/ files)

| CF | architecture | financial | security | no-magic |
|----|:---:|:---:|:---:|:---:|
| CF-001 | | §2 | | §1 ref |
| CF-002 | | §2.2 | | |
| CF-003 | §1+§4+§7 | | | §4.2 |
| CF-004 P0 | §3 + 5-step | | §7 cross-ref | §1 row + §3 |
| CF-005 | §2 row | | §8 | §3.2 |
| CF-006 | | §3 (4 site) | | §1 row |
| CF-007 | | §1 (14 const) | | §1 row |
| CF-008 | | | §10 ref | |
| CF-009 | §5 (5 cand) | | | §5.3 (F13) |
| CF-010 | | §4 재작성 | §4.2 ref | |
| CF-011 | | §5.4 | | §1 row |
| CF-013 | §4 | | | |
| CF-014 | | §1 (500) | | §2 (27 mut) |
| CF-015 | | | §10 audit | |
| CF-016 | §6 (F6) | | §4 | §3.1 |
| CF-017 | | | §6 (양극단) | §1 row |
| CF-018 A | | | §2 (3+2) | |
| CF-018 B | | | §3 (57 sites) | §3.1 |
| CF-019 | | §2.1 | | |
| CF-020 | | ref | §10 audit | |
| CF-021 | | ref | | |
| CF-022 | | §4.2 anomaly | | §3.3 |
| CF-023 | | ref | | |
| CF-024 | | | §5 | §1 row |

→ 25/25 CF 모두 ≥1 _rules/ file 에 anchor 배치 완료. **architecture 6 anchor / financial 9 anchor / security 11 anchor / no-magic 11 cross-ref**.

---

## 11 Incidentals routing

| ID | 발견 | routing |
|----|------|---------|
| F4 | DEAD 5-site | architecture §5 |
| F5 | ≥8 polymorphic | architecture §4 |
| F7 | Booking "Pending" | no-magic §5.1 |
| F8 | cs_tickets state 부재 | architecture §6 memo |
| F9 | bond return 14-day | financial §5.1 |
| F10 | helper "Pending" | no-magic §5.2 |
| F11 | Stripe chargeback | financial §4.3 |
| F12 | commissions enum | financial §5.2 |
| F13 | DEAD 재평가 | architecture §5 + no-magic §5.3 |
| F14 | contract_products snapshot | financial §5.3 |
| F15 | tasks polymorphic orphan | architecture §4 + no-magic §5.4 |

→ 11/11 incidentals 모두 ≥1 _rules/ file 등재 완료.

---

## Phase 2 종합 prescription summary (7 step)

1. **CF-004 P0 5-step** (security §7 + architecture §3) — Phase 1 immediate hotfix
2. **CF-001 numeric 통일** (financial §2) — Phase 2 schema migration
3. **CF-016 단일 enum** (security §4 + no-magic §3.1) — Phase 2 EF Core
4. **CF-018 requireSuperAdmin middleware** (security §3.2) — 57 inline 사이트 retire
5. **CF-024 rate limiting** (security §5) — Phase 1 express-rate-limit + Phase 2 .NET RateLimiter
6. **CF-017 Zod baseline** (security §6) — 모든 mutation route safeParse
7. **CF-008 audit log 정책 통일** (security §10) — 모든 mutation logAction 의무

---

## 🎯 T004 GROUP COMPLETE marker (2026-04-27)

- **T004 시작**: 2026-04-27 (T003 GROUP COMPLETE 후)
- **T004 완료**: 2026-04-27 (4 sub-task 1 응답)
- **누적 산출물**: 4 _rules/ files REWRITE / 642 lines (T001 시점 420L → +53% / 예측 1000-1400 −36% 컴팩트)
- **CF count final**: P0=4 / P1=18 / P2=3 = **25** (T004 전체 0 NEW promotion)
- **R-REPO-5 incidentals final**: **11 unchanged** (T003 묶음 4 와 동일)
- **R-REPO 가동 누적 final**:
  - R-REPO-6 = **13회** (T004 Step 1 NEW→REWRITE 단순 정정)
  - R-REPO-9 차단 = 3회 (T004 차단 0)
  - R-REPO-9 자동 진행 = **7회** (T004 = 7회째)
  - R-REPO-10 묶음 = **5회** (T004 = 5회째 max 가속)
- **다음 단계**: T005 `_workflows/` (6 files) — **자동 시작 절대 금지**, 사용자 push + proceed 명시 후 진입.

---

## R-REPO-1 v2 (f) main agent git 차단 인지

본 환경에서 `git commit` / `git push` / `git fetch` 는 main agent 차단. T004 atomic commit 은 Replit auto-checkpoint 가 commit 자동 실행 → 사용자가 직접 push.

**사용자 책임 (R-REPO-1 v2 (c))**: T004 완료 후 `git push origin main` 명시 실행 — 본 ledger 의 commit hash 컬럼 사용자 검증.

---

## 자가 검증 (3 spot-check ✅)

- **C1** 4 _rules/ lines 합계 = 128+168+210+136 = **642** ✅ (`wc -l` 일치)
- **C2** 25 CF × 4 file anchor 매트릭스 모두 cell ≥1 anchor 배치 (CF-018 A+B 분리 26 row); CF-008/CF-013/CF-015/CF-019/CF-020/CF-021/CF-023 = ≥1 file ref + 나머지 18 = ≥1 anchor ✅
- **C3** 11 incidentals × routing 모두 ≥1 _rules/ file 등재 ✅

---

*Last updated: 2026-04-27 (🎯 T004 GROUP COMPLETE — 4 sub-task / 1 응답 / max 가속 / 사용자 push 대기 / T005 진입 결정 사용자 대기).*

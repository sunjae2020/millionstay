# Booking Test Cases (Recommended)

> ✅ **T001-RECON-VERIFIED** 2026-04-26 — corroborated by `docs/reverse/_audit/T001_RECON_REPORT.md` §g.
> ✅ **T007-LIGHT-TOUCH** 2026-04-27 — 본문 보존, T002~T006 자산 cross-ref. CF anchor 추가:
> - **§1 BC-04/BC-05 stay validation** = CF-017 absent (booking 12/27 = 44% Zod coverage = repo 평균 ~12% 이상 but stay validation 자체는 미존재)
> - **§1 BC-06 Guest A submits for Guest B** = CF-018 Sub-pattern A POSITIVE (sole-owner E20 + bookings.ts:728/735/572 3 BAD)
> - **§2 BS-01-14 status transitions** = **CF-022 booking 9/9 cross-pack leader** (`state-machines.md` §1; `_workflows/booking-lifecycle.md` §1; `domain-logic-booking.md` §1)
> - **§3 BO-04 Race overbooking** = **CF-011 booking_ref race** (`generateBookingRef` row-count race; `_rules/security-rules.md` §11)
> - **§4 BX-04 bond_amount = weekly × 4** = **CF-007** (`bookings.ts:395` `*4`; R-REPO-6 11회째 SWAP 정정)
> - **§4 BX-05 advance_amount = weekly × 2** = **CF-007** (`bookings.ts:396` `*2`)
> - **§4 BX-06 1 audit log entry** = CF-008 booking 78% transition-grain leader / CF-014 audit insert in same tx as state change
> - **§5 CT-01 Activate cascade** = **CF-014 max carrier** (`contracts.ts:55-237` helper ≥27 mutation 0 db.transaction; **CRITICAL** rollback test required)
> - **§5 CT-04 pro-rated last period** = CF-006 Formula B 4-site (`bookings.ts:485` + `contracts.ts:92,94` + `dashboard.ts` outlier)
> - **§5 CT-05 Re-activate idempotent** = CF-014 paidKeys 보존 patten (idempotency `db.delete` 후 재생성)
> - **§6 AL-04 audit insert in tx** = CF-014 (현재 0 tx — Phase 2 prescription)
> - **§7 AZ-01 Guest A get Guest B's** = CF-018 Sub-pattern A canonical (`security-rules.md` §1 sole-owner E20)
> - **§8 Edge "F7 Pending dead-end"** = guest-portal.ts:160-162 literal `"Pending"` 8 main state 외 + admin 9/9 transition reject = "submitted but stuck" UX gap (`_design/guest-portal-layout.md` §2 cross-ref)


> Use these as the acceptance suite for the current Node/Express implementation **and** the future C# port.

## 1. Booking creation

| # | Scenario | Expected |
|---|---|---|
| BC-01 | Valid guest application | 201, status `PendingApproval`, audit log row |
| BC-02 | check_out before check_in | 400 `VALIDATION_ERROR` |
| BC-03 | Past check_in date | 400 `INVALID_DATE` (after fix C-02) |
| BC-04 | Stay below `min_stay_weeks` | 400 `STAY_TOO_SHORT` (after fix C-03) |
| BC-05 | Stay above `max_stay_weeks` | 400 `STAY_TOO_LONG` (after fix C-03) |
| BC-06 | Guest A submits for Guest B's account_id | 403 `FORBIDDEN` |
| BC-07 | Unknown space_id | 404 |
| BC-08 | Soft-deleted space | 404 |
| BC-09 | Concurrent applications same space + dates | both 201 (status PendingApproval) — confirmation handles overbooking, not application |

## 2. Status transitions

| # | Scenario | Expected |
|---|---|---|
| BS-01 | Submit Draft → PendingPayment | 200 |
| BS-02 | Submit non-Draft | 409 |
| BS-03 | Confirm PendingApproval → Confirmed | 200 + dates blocked + contract row created |
| BS-04 | Confirm Cancelled | 409 |
| BS-05 | Reject PendingApproval → Cancelled | 200 |
| BS-06 | Reject Confirmed | 409 |
| BS-07 | Cancel Confirmed | 200 + dates unblocked |
| BS-08 | Cancel CheckedOut | 409 |
| BS-09 | Cancel already Cancelled | 409 |
| BS-10 | Check-in Confirmed | 200 |
| BS-11 | Check-in Active | 409 |
| BS-12 | Check-out Active | 200 |
| BS-13 | Check-out Confirmed | 409 |
| BS-14 | After cancel, contract is terminated | (after fix BL-02) ✅ |

## 3. Overbooking (the big one)

| # | Scenario | Expected |
|---|---|---|
| BO-01 | Confirm two non-overlapping bookings same space | both 200 |
| BO-02 | Confirm overlapping booking after another is Confirmed | 409 with conflict dates listed |
| BO-03 | Cancel A then confirm B (overlapping) | 200 (dates freed) |
| BO-04 | **Race** — submit two confirms for same space + dates concurrently (10 attempts) | exactly 1 succeeds, 9 return 409 — covers the race-condition fix |
| BO-05 | Confirm in second space (different space_id) — non-conflicting | 200 |

## 4. Side-effects of confirm

| # | Scenario | Expected |
|---|---|---|
| BX-01 | Confirm creates `space_blocked_dates` rows for every night in range | row count = nights |
| BX-02 | Confirm with no `account_id` | 400 (cannot create contract without tenant) |
| BX-03 | Confirm creates contract with status `Draft` | yes |
| BX-04 | Confirm computes `bond_amount = weekly_rate × 4` | yes |
| BX-05 | Confirm computes `advance_amount = weekly_rate × 2` | yes |
| BX-06 | Confirm writes 1 audit log entry | yes |

## 5. Contract activation cascade

| # | Scenario | Expected |
|---|---|---|
| CT-01 | Activate Signed contract | booking → Active, invoices generated, schedule rows created |
| CT-02 | Activate Draft contract | 409 |
| CT-03 | Activate generates 1 invoice per period (Weekly/Biweekly/Monthly) | row count matches |
| CT-04 | Last partial period pro-rated | amount = `weekly_rate × periodDays / 7`, rounded |
| CT-05 | Re-activate (idempotent) | unpaid invoices wiped + regenerated; paid invoices preserved |

## 6. Audit log

| # | Scenario | Expected |
|---|---|---|
| AL-01 | Every status change writes a `system_log` row | yes |
| AL-02 | `actor_id` matches the authenticated admin | yes |
| AL-03 | `old_value` and `new_value` are JSON blobs | yes |
| AL-04 | `system_log` insert is in the same transaction as the state change | yes — rollback erases both |

## 7. Authorization

| # | Scenario | Expected |
|---|---|---|
| AZ-01 | Guest A `GET /v1/guest/bookings/<Guest B's id>` | 404 |
| AZ-02 | Agent retrieves only their own `agent_account_id` bookings | yes |
| AZ-03 | Owner sees bookings for spaces under their owned properties | yes |
| AZ-04 | Admin sees all bookings regardless of source | yes |

## 8. Edge cases worth fixing

- BC-09: same dates concurrently → one application reaches confirm first; if both somehow get confirmed in parallel, BO-04 is the real safety net.
- Same guest applies twice for same space + dates → currently allowed; consider de-dupe at submit.
- 0-night stay (check_in == check_out) → currently allowed by validator; should be 400.

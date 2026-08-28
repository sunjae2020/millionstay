import { pgTable, serial, integer, text, numeric, jsonb, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// DEPOSIT SETTLEMENT — move-out reconciliation of the refundable security
// deposit (Metheim vision stage 5; see docs/proposals/CONDITION_REPORTS_SETTLEMENT.md).
//
// Built on the booking spine + the move-out condition_report (phase='move_out')
// vs the move-in baseline. `deposit_held` is snapshotted from the actually-paid
// deposit line items (invoice_line_items.line_type='deposit'), which equals the
// booking's Deposits Held (2100) liability balance. On finalize a single GL
// entry releases the liability: Dr Deposits Held / Cr Cash (refund) + Cr Revenue
// (forfeited deductions), balancing because held = refund + deducted.
//
// Money columns are numeric → Drizzle returns strings; wrap reads in Number(),
// writes in String().
export const depositSettlementsTable = pgTable("deposit_settlements", {
  id: serial("id").primaryKey(),
  settlement_ref: text("settlement_ref").notNull().unique(), // e.g. "DS-2026-00001"
  // Exactly one spine is set: a booking (short-term/homestay) OR a contract
  // (Korean monthly lease, imported straight onto `contracts` with no booking).
  booking_id: integer("booking_id"),
  contract_id: integer("contract_id"),
  move_out_report_id: integer("move_out_report_id"), // condition_reports.id (phase='move_out')
  status: text("status").notNull().default("draft"),
  // draft → proposed → tenant_ack → finalized  (+ cancelled)

  deposit_held: numeric("deposit_held", { precision: 10, scale: 2 }).notNull().default("0"),
  total_deducted: numeric("total_deducted", { precision: 10, scale: 2 }).notNull().default("0"),
  refund_amount: numeric("refund_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("AUD"),
  // 보증금(B)을 어디서 읽었는지 — 확인서·회계 대사에서 "실납부"와 "계약상 금액"을
  // 구분한다. invoice/placement 만 2100 에 실재하므로 finalize 의 GL 상계는 그때만
  // 일어난다.
  //   invoice   납부된 보증금 인보이스 라인(line_type='deposit', status='Paid')
  //   placement 납부된 홈스테이 upfront 결제
  //   contract  contracts.bond_amount (계약상 금액, GL 미전기)
  //   booking   bookings.deposit_amount (계약상 금액, GL 미전기)
  //   manual    운영자 직접 입력
  deposit_source: text("deposit_source"),
  // C(최종 반환 차액)가 마이너스일 때 — 차감이 보증금을 넘어 임차인에게서 회수해야
  // 하는 금액을 청구한 인보이스. 확인서가 정본이고 인보이스는 미수금 회수 도구다.
  invoice_id: integer("invoice_id"),

  // 확인서 헤더의 "기준일자" — 정산을 어느 날짜 기준으로 끊었는지. 비워 두면
  // finalized_at ?? proposed_at ?? created_at 으로 폴백한다(종전 동작). 퇴거일과
  // 확인서를 쓴 날이 다른 실무(8/28 퇴거, 9/3 작성)를 위해 운영자가 직접 잡는다.
  as_of_date: date("as_of_date"),
  // "정산구분" — early(중도퇴거) | expiry(만기퇴거). 비워 두면 기준일자와 계약
  // 종료일을 비교해 자동 판정하고, 값이 있으면 그 값이 자동 판정을 이긴다.
  settlement_type: text("settlement_type"),

  notes: text("notes"),
  created_by: integer("created_by"),
  proposed_at: timestamp("proposed_at", { withTimezone: true }),
  tenant_ack_at: timestamp("tenant_ack_at", { withTimezone: true }),
  finalized_at: timestamp("finalized_at", { withTimezone: true }),

  // GL posting key of the finalize journal entry (idempotency anchor).
  posting_key: text("posting_key"),
  audit_trail: jsonb("audit_trail").notNull().default([]),

  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// One damage/charge line deducted from the deposit, each linked to condition
// evidence (a move-out report item + before/after photos).
export const depositDeductionItemsTable = pgTable("deposit_deduction_items", {
  id: serial("id").primaryKey(),
  deposit_settlement_id: integer("deposit_settlement_id").notNull(),
  condition_item_id: integer("condition_item_id"), // condition_report_items.id — evidence
  description: text("description").notNull(),
  // Signed: positive = deducted from the deposit (차감(−)), negative = refunded
  // to the tenant (환급(+)). The move-out settlement form derives each line's
  // 구분 column from this sign, and recomputeTotals() nets both directions.
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  // 확인서 2번 표의 "구분" 칸 — 'deduct'(차감(−)) | 'refund'(환급(+)).
  // 금액 부호가 합계의 정본이고(음수 = 환급) kind 는 그 부호를 문장으로 적어 둔 것이다.
  // 0원 라인(표준 서식 뼈대·견적 전 하자)은 부호가 없으므로 kind 만이 의도를 남긴다.
  kind: text("kind").notNull().default("deduct"),
  // "비고 및 처리 안내" — free-text handling note printed next to the line on the
  // 퇴거 세대 정산 확인서.
  remark: text("remark"),
  photo_ids: jsonb("photo_ids").notNull().default([]), // condition_report_photos.id[]
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDepositSettlementSchema = createInsertSchema(depositSettlementsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertDepositSettlement = z.infer<typeof insertDepositSettlementSchema>;
export type DepositSettlement = typeof depositSettlementsTable.$inferSelect;
export type DepositDeductionItem = typeof depositDeductionItemsTable.$inferSelect;

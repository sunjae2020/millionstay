import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─────────────────────────────────────────────────────────────────────────────
// 결제 일정 (PAYMENT SCHEDULE) — 계약이 "언제 얼마를 받기로 했는가"의 정본.
//
// 지금까지 이 정보는 contracts 의 낱개 컬럼(down_payment / interim_payment /
// balance_amount / bond_amount / monthly_rent + rent_due_day)에만 있었다. 그
// 형태로는 회차를 가리킬 수 없어서, 인보이스도 입금도 "어느 회차"에 붙는지
// 표현할 방법이 없었다. 이 표는 그 낱개 컬럼을 **행으로 펼쳐** 인보이스와
// 거래(transactions)가 가리킬 대상을 만든다.
//
//   contracts ─┬─ payment_schedules ─┬─ invoices      (청구했는가)
//              │                     └─ transactions  (입금됐는가)
//
// 계약 컬럼에서 자동 생성(generate)하되, 생성 후에는 이 표가 정본이다. 수동으로
// 회차를 추가·수정·면제(waived)할 수 있고, 재생성은 손대지 않은 회차만 다시
// 만든다(입금·청구가 붙은 회차는 보존).
//
// 금액 컬럼은 numeric → 문자열. 읽을 때 Number(), 쓸 때 String().
// ─────────────────────────────────────────────────────────────────────────────
export const paymentSchedulesTable = pgTable("payment_schedules", {
  id: serial("id").primaryKey(),
  contract_id: integer("contract_id").notNull(),

  // 회차 종류.
  //   deposit          보증금
  //   down_payment     계약금
  //   interim_payment  중도금
  //   balance          잔금
  //   rent             월세/기간 임대료 (period 로 회차를 구분)
  //   advance          선급금 (단기 요금형)
  //   other            기타(입주청소비 등 일회성)
  // 돈의 방향. 'ar' 받을 돈(세입자 → 우리) / 'ap' 줄 돈(우리 → 집주인·업체).
  // 한 행에 AR·AP 를 겹쳐 넣지 않는 이유는 0080 주석에 있다 — 부분납 로직을
  // 양쪽이 그대로 공유하기 위해서다.
  direction: text("direction").notNull().default("ar"),
  // 이 회차의 상대방. AR 이면 세입자, AP 면 집주인·업체.
  counterparty_account_id: integer("counterparty_account_id"),
  // AP 행이 파생된 AR 행(월세를 받아 집주인에게 넘기는 짝).
  source_schedule_id: integer("source_schedule_id"),

  kind: text("kind").notNull().default("rent"),
  // 표시 순서. 같은 due_date 안에서 계약금 → 중도금 → 잔금 순서를 고정한다.
  seq: integer("seq").notNull().default(0),
  // 사용자에게 보이는 이름. 비면 kind 로 번역 키를 만들어 표시한다.
  label: text("label"),
  // 월세 회차의 대상 월 "YYYY-MM". 같은 계약에서 (kind, period) 는 유일하다.
  period: text("period"),
  period_start: text("period_start"),
  period_end: text("period_end"),

  due_date: text("due_date"), // YYYY-MM-DD
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("AUD"),

  // 이 회차로 발행된 청구서. 통합 청구서의 자식 인보이스가 붙는 것이 정상이다.
  invoice_id: integer("invoice_id"),
  // 입금 합계 캐시. 정본은 transactions 합계이고, 이 값은 거래가 확정/취소될
  // 때마다 recalcSchedulePaid() 가 다시 계산해 넣는다.
  paid_amount: numeric("paid_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  paid_at: timestamp("paid_at", { withTimezone: true }),

  // pending(예정) | invoiced(청구됨) | partial(부분납) | paid(완납) | waived(면제)
  // waived 만 사람이 직접 지정한다. 나머지는 청구·입금 상태에서 파생된다.
  status: text("status").notNull().default("pending"),
  // 자동 생성된 행인지(true) 사람이 추가한 행인지. 재생성이 손대도 되는 행을 구분.
  source: text("source").notNull().default("auto"), // auto | manual
  notes: text("notes"),

  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const PAYMENT_SCHEDULE_DIRECTIONS = ["ar", "ap"] as const;
export const PAYMENT_SCHEDULE_KINDS = [
  "deposit", "down_payment", "interim_payment", "balance", "rent", "advance",
  // AP 전용 — 집주인에게 넘기는 임대료, 파트너·업체 대금.
  "owner_rent", "payout",
  "other",
] as const;
export const PAYMENT_SCHEDULE_STATUSES = [
  "pending", "invoiced", "partial", "paid", "waived",
] as const;

export const insertPaymentScheduleSchema = createInsertSchema(paymentSchedulesTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertPaymentSchedule = z.infer<typeof insertPaymentScheduleSchema>;
export type PaymentSchedule = typeof paymentSchedulesTable.$inferSelect;

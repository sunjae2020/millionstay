import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─────────────────────────────────────────────────────────────────────────────
// 거래 원장 (TRANSACTIONS) — 실제로 움직인 돈 한 건.
//
// 인보이스는 "받을 돈"(청구), journal_entries 는 "회계 기록"이고, 이 표는 그
// 사이의 **입출금 사실**이다. 세 축으로 연결된다.
//
//   invoice_id           어느 청구서를 수납/환불했는가
//   contract_id          어느 계약의 돈인가
//   payment_schedule_id  계약 결제 일정(계약금·중도금·잔금·보증금·월세)의
//                        어느 회차를 정산했는가  ← payment_schedules.ts
//
// 결제 일정 연결이 핵심이다. 그것 없이는 "3월 월세가 들어왔다"를 시스템이
// 알 수 없고, 미납·부분납 집계가 인보이스 status 하나에만 의존하게 된다.
//
// 상태 흐름: draft → confirmed → posted (→ void)
//   draft      입력만 된 상태. 일정/집계에 반영되지 않는다.
//   confirmed  실제 입출금 확인. 결제 일정의 paid_amount 에 반영된다.
//   posted     GL(journal_entries) 전기까지 끝난 상태. journal_entry_id 가 찬다.
//   void       취소. 어떤 집계에도 들어가지 않는다.
//
// 금액 컬럼은 numeric → Drizzle 에서 **문자열**이다. 읽을 때 Number(), 쓸 때
// String() 으로 감쌀 것.
// ─────────────────────────────────────────────────────────────────────────────
export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  // 거래번호 TXN-YYYY-00001. 사람이 부르는 이름이자 은행 적요 대조용 키.
  txn_ref: text("txn_ref").notNull().unique(),

  // income(수입) | expense(지출) | transfer(계좌 간 이체)
  txn_type: text("txn_type").notNull().default("income"),
  txn_date: text("txn_date").notNull(), // YYYY-MM-DD

  // 부호 없는 절대값. 방향은 txn_type 이 정한다(은행 명세서의 signed amount 와
  // 다른 규약이므로 bank_transactions 와 직접 비교하지 말 것).
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("AUD"),
  // 공급가액과 별도로 잡는 부가세(청구서 부가세 규칙과 동일: amount = 공급가액).
  tax_amount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull().default("0"),

  // ── 연결 ──────────────────────────────────────────────────────────────────
  contract_id: integer("contract_id"),
  invoice_id: integer("invoice_id"),
  payment_schedule_id: integer("payment_schedule_id"),
  work_order_id: integer("work_order_id"),
  space_id: integer("space_id"),

  // 거래처. 계정(법인/개인)이 정본이고, 매칭되는 계정이 없을 때만 자유 입력
  // counterparty_name 을 쓴다. GL 전기는 둘 중 하나를 요구한다.
  account_id: integer("account_id"),
  contact_id: integer("contact_id"),
  counterparty_name: text("counterparty_name"),

  // 돈이 실제로 드나든 통장. transfer 는 bank_account_id(출금) →
  // counter_bank_account_id(입금) 로 방향을 표현한다.
  bank_account_id: integer("bank_account_id"),
  counter_bank_account_id: integer("counter_bank_account_id"),
  payment_info_id: integer("payment_info_id"),
  payment_method: text("payment_method"), // bank_transfer | card | cash | offset ...

  // 상대 계정과목(chart_of_accounts.code). 수입이면 대변, 지출이면 차변에 선다.
  // 비우면 전기 시 txn_type 기본값(4000 매출 / 5100 외주비)으로 떨어진다.
  gl_account_code: text("gl_account_code"),

  description: text("description"),
  bank_reference: text("bank_reference"), // 통장 적요
  notes: text("notes"),

  // draft | confirmed | posted | void
  status: text("status").notNull().default("draft"),
  // GL 전기 결과. 전기는 멱등(posting_key = "transaction:<id>")이다.
  journal_entry_id: integer("journal_entry_id"),
  posted_at: timestamp("posted_at", { withTimezone: true }),
  posted_by: integer("posted_by"),
  confirmed_at: timestamp("confirmed_at", { withTimezone: true }),
  confirmed_by: integer("confirmed_by"),
  voided_at: timestamp("voided_at", { withTimezone: true }),
  void_reason: text("void_reason"),

  created_by: integer("created_by"),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const TXN_TYPES = ["income", "expense", "transfer"] as const;
export const TXN_STATUSES = ["draft", "confirmed", "posted", "void"] as const;
/** 결제 일정·집계에 반영되는 상태(= 실제로 돈이 움직였다고 인정하는 상태). */
export const TXN_SETTLED_STATUSES = ["confirmed", "posted"] as const;

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;

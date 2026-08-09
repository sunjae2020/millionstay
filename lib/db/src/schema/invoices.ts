import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoice_ref: text("invoice_ref").notNull().unique(),
  booking_id: integer("booking_id"),
  contract_id: integer("contract_id"),
  quote_id: integer("quote_id"),
  // Set when an invoice is a repair-cost charge-back to a property owner, linking
  // it back to the completed work order it recovers (see work-orders charge-owner).
  work_order_id: integer("work_order_id"),
  account_id: integer("account_id"),
  // ── 통합(단체) 청구 ────────────────────────────────────────────────────────
  // "standard"   기본. 예약/계약 1건에 대한 보통 인보이스.
  // "consolidated" 통합 청구서. 한 계정이 임차한 여러 공간의 그 달 인보이스를
  //                한 장으로 묶은 납부용 문서. 금액은 자식 인보이스 합계와 같다.
  //
  // ⚠️ 집계에서 통합 청구서는 반드시 제외한다 — 자식 인보이스가 매출·정산의
  // 정본이므로 둘 다 더하면 두 번 계산된다. `excludeConsolidated()`
  // (api-server/src/lib/billing/consolidatedInvoices.ts)를 쓸 것.
  invoice_kind: text("invoice_kind").notNull().default("standard"),
  // 통합 청구서에 묶인 공간별(계약별) 인보이스가 부모를 가리킨다.
  parent_invoice_id: integer("parent_invoice_id"),
  // 청구 대상 월 "YYYY-MM". 통합 청구서와 그 자식 모두에 채워진다.
  billing_period: text("billing_period"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("AUD"),
  exchange_rate_to_aud: numeric("exchange_rate_to_aud", { precision: 18, scale: 8 }),
  status: text("status").notNull().default("Draft"),
  due_date: text("due_date"),
  paid_at: timestamp("paid_at", { withTimezone: true }),
  payment_method: text("payment_method"),
  stripe_payment_intent_id: text("stripe_payment_intent_id"),
  stripe_checkout_url: text("stripe_checkout_url"),
  description: text("description"),
  notes: text("notes"),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Itemised invoice lines. An invoice may have zero rows (legacy single-amount
// invoices keep using invoices.amount + description) or N rows whose total_amount
// sums to invoices.amount. Money columns are numeric → strings.
export const invoiceLineItemsTable = pgTable("invoice_line_items", {
  id: serial("id").primaryKey(),
  invoice_id: integer("invoice_id").notNull(), // invoices.id
  label: text("label").notNull(),              // e.g. "Homestay placement fee"
  description: text("description"),
  // "revenue" (default) posts to GL Revenue; "deposit" posts to the Deposits Held
  // liability account so refundable security deposits are never booked as revenue (H-402).
  line_type: text("line_type").notNull().default("revenue"),
  // WHAT is being charged — the base selector for percent-based payout terms.
  // Only "rent" lines feed a landlord/agent `percent_of_rent` calculation, so a
  // one-off charge that rides along on a rent invoice (move-in cleaning, a
  // break fee, late interest) never inflates what we forward to the owner.
  //   rent    월세 — the ONLY base for percent_of_rent
  //   vat     부가세 (taxable contracts only)
  //   deposit 보증금 (kept in step with line_type="deposit")
  //   other   기타 — 입주청소비 · 위약금 · 연체이자 등 일회성
  // There is deliberately NO maintenance/utility value: 관리비 and 공과금 are paid
  // by the tenant directly to the management office / utility companies, so they
  // never appear on our invoices. If that ever changes, the business model
  // changed too — update docs/proposals/ACCOUNTING_UNIFIED_SPEC.md first.
  charge_kind: text("charge_kind").notNull().default("rent"),
  // 통합 청구서 한 줄이 어느 호실/계약의 임대료인지. 공간별 인보이스에서도
  // 채워두면 청구서 PDF와 세입자 포털이 호실 단위로 묶어 보여줄 수 있다.
  space_id: integer("space_id"),
  contract_id: integer("contract_id"),
  // 이 줄이 커버하는 기간(일할계산 이월분은 지난달 구간이 들어간다).
  period_start: text("period_start"),
  period_end: text("period_end"),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unit_amount: numeric("unit_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  total_amount: numeric("total_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

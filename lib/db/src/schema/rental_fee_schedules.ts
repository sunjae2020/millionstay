import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Rental commission fee RATE CARD (임대 수수료 기준표) — the master rule set that
// says, per property TYPE, how much 중개수수료(부동산) / 자체수수료(자체 관리자) /
// Working(직접 모객) fee applies. This is CONFIG, not actuals — actual amounts paid
// on a given contract live in `contract_related_costs`. A booking/contract picks the
// row matching its type and reads the fee off it.
//
// `type_label` is free-text (e.g. "A,B" / "C" / "D" / "E") so it stays generic across
// products rather than forking per property line. Base amounts are stored BEFORE the
// two Korean tax adjustments; the rates below describe how a payable is derived:
//   중개수수료 payable = brokerage_fee × (1 + brokerage_surcharge_rate/100)   (간이과세 가산)
//   자체수수료 payable = self_fee     × (1 − self_withholding_rate/100)       (원천징수 차감)
//   Working(직접 모객)  = working_fee  (자체가 부동산 몫까지 흡수한 고정액)
// Money/rate columns are numeric → returned as numbers via mode: "number".
export const rentalFeeSchedulesTable = pgTable("rental_fee_schedules", {
  id: serial("id").primaryKey(),
  type_label: text("type_label").notNull(), // "A,B" / "C" / "D" / "E"
  brokerage_fee: numeric("brokerage_fee", { precision: 14, scale: 2, mode: "number" }).notNull().default(0), // 중개수수료 (부동산) base
  self_fee: numeric("self_fee", { precision: 14, scale: 2, mode: "number" }).notNull().default(0), // 자체수수료 base
  working_fee: numeric("working_fee", { precision: 14, scale: 2, mode: "number" }).notNull().default(0), // Working (직접 모객) 자체수수료
  brokerage_surcharge_rate: numeric("brokerage_surcharge_rate", { precision: 5, scale: 2, mode: "number" }).notNull().default(4), // 간이과세 % 가산
  self_withholding_rate: numeric("self_withholding_rate", { precision: 5, scale: 2, mode: "number" }).notNull().default(3.3), // 원천징수 % 차감
  currency: text("currency").notNull().default("KRW"),
  sort_order: integer("sort_order").notNull().default(0),
  note: text("note").notNull().default(""),
  status: text("status").notNull().default("Active"), // Active | Archived
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertRentalFeeScheduleSchema = createInsertSchema(rentalFeeSchedulesTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertRentalFeeSchedule = z.infer<typeof insertRentalFeeScheduleSchema>;
export type RentalFeeSchedule = typeof rentalFeeSchedulesTable.$inferSelect;

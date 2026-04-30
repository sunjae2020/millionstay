import { pgTable, serial, text, integer, numeric, timestamp, date, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const exchangeRatesTable = pgTable(
  "exchange_rates",
  {
    id: serial("id").primaryKey(),
    from_currency: text("from_currency").notNull(),
    to_currency: text("to_currency").notNull().default("AUD"),
    rate: numeric("rate", { precision: 18, scale: 8 }).notNull(),
    source: text("source").notNull().default("manual"),
    effective_date: date("effective_date").notNull(),
    created_by: integer("created_by"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    uniquePair: unique("exchange_rates_pair_date_uq").on(t.from_currency, t.to_currency, t.effective_date),
  }),
);

export const insertExchangeRateSchema = createInsertSchema(exchangeRatesTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertExchangeRate = z.infer<typeof insertExchangeRateSchema>;
export type ExchangeRate = typeof exchangeRatesTable.$inferSelect;

import { pgTable, serial, integer, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Marketing list / segment. `list_type='static'` holds an explicit membership set
// (prospect_list_members); `list_type='dynamic'` recomputes membership from
// `filter_criteria` at query time (segment / country / score / last activity).
export const marketingListsTable = pgTable(
  "marketing_lists",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    list_type: text("list_type").notNull().default("static"), // 'static' | 'dynamic'
    filter_criteria: jsonb("filter_criteria").$type<Record<string, unknown>>(),
    // Cached member count, refreshed on membership change / dynamic refresh.
    member_count: integer("member_count").notNull().default(0),
    owner_user_id: integer("owner_user_id"),
    status: text("status").notNull().default("Active"),
    deleted_at: timestamp("deleted_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [index("idx_marketing_lists_status").on(t.status)],
);

export const insertMarketingListSchema = createInsertSchema(marketingListsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertMarketingList = z.infer<typeof insertMarketingListSchema>;
export type MarketingList = typeof marketingListsTable.$inferSelect;

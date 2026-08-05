import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Hard block list for outbound email — bounces and spam complaints.
 *
 * This is NOT the unsubscribe list. Recipient opt-out has one source of truth,
 * `marketing_consents` (opted_out_at), which the existing public unsubscribe
 * endpoint already writes. Suppressions cover the cases consent cannot express:
 * an address that does not exist, or one whose owner reported us as spam.
 *
 * Both tables must be consulted before every send.
 */
export const emailSuppressionsTable = pgTable(
  "email_suppressions",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    // 'hard_bounce' | 'complaint' | 'manual'
    reason: text("reason").notNull(),
    detail: text("detail").notNull().default(""),
    source_campaign_id: integer("source_campaign_id"),
    created_by_user_id: integer("created_by_user_id"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [uniqueIndex("uq_email_suppressions_email").on(sql`lower(${t.email})`)],
);

export const insertEmailSuppressionSchema = createInsertSchema(emailSuppressionsTable).omit({
  id: true,
  created_at: true,
});
export type InsertEmailSuppression = z.infer<typeof insertEmailSuppressionSchema>;
export type EmailSuppression = typeof emailSuppressionsTable.$inferSelect;

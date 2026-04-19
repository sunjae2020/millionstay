import { pgTable, uuid, integer, varchar, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Marketing Consents — Sprint B-1
 *
 * Separate consent record for marketing communications (Australian Spam Act 2003).
 * Booking/transactional emails do NOT count as marketing — only promotional content.
 *
 * The table stores ONE active row per (email, channel). Re-subscribe by setting
 * opted_in_at and clearing opted_out_at. Unsubscribe sets opted_out_at.
 */
export const marketingConsentsTable = pgTable(
  "marketing_consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    user_id: integer("user_id"),
    email: varchar("email", { length: 255 }).notNull(),
    channel: varchar("channel", { length: 20 }).notNull(), // 'email' | 'sms'
    opted_in_at: timestamp("opted_in_at", { withTimezone: true }),
    opted_out_at: timestamp("opted_out_at", { withTimezone: true }),
    source: varchar("source", { length: 50 }), // 'booking_form' | 'profile' | 'import' | 'unsubscribe_link'
    ip_address: varchar("ip_address", { length: 45 }),
    user_agent: varchar("user_agent", { length: 512 }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_marketing_consents_email_channel").on(t.email, t.channel),
    index("idx_marketing_consents_user").on(t.user_id),
  ],
);

export type MarketingConsent = typeof marketingConsentsTable.$inferSelect;
export type InsertMarketingConsent = typeof marketingConsentsTable.$inferInsert;

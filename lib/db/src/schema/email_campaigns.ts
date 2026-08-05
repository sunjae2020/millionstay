import { pgTable, serial, integer, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Outbound email campaign master.
 *
 * Compliance-bearing columns:
 *   `is_advertising`  — marketing (as opposed to a service notice). When true and
 *                       language_code='ko', the subject is prefixed "(광고)" and the
 *                       body must carry the free opt-out notice (정보통신망법 §50).
 *   `send_window_*` / `timezone` — quiet-hours guard. Korean advertising email may
 *                       not be sent 21:00–08:00 local time without separate consent.
 *   `throttle_per_hour` — protects sender reputation; the worker slices it per run.
 */
export const emailCampaignsTable = pgTable(
  "email_campaigns",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    // 'draft' | 'ready' | 'scheduled' | 'sending' | 'paused' | 'completed' | 'cancelled'
    status: text("status").notNull().default("draft"),
    list_id: integer("list_id"),
    from_email: text("from_email").notNull().default(""),
    from_name: text("from_name").notNull().default(""),
    reply_to: text("reply_to").notNull().default(""),
    language_code: text("language_code").notNull().default("ko"),
    is_advertising: boolean("is_advertising").notNull().default(true),
    throttle_per_hour: integer("throttle_per_hour").notNull().default(60),
    // Local-time send window, "HH:MM". Defaults keep Korean advertising email
    // inside the legal daytime window.
    send_window_start: text("send_window_start").notNull().default("09:00"),
    send_window_end: text("send_window_end").notNull().default("18:00"),
    timezone: text("timezone").notNull().default("Asia/Seoul"),
    scheduled_at: timestamp("scheduled_at", { withTimezone: true }),
    started_at: timestamp("started_at", { withTimezone: true }),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    // Denormalised counters, incremented by the worker and the webhook. Treat as a
    // cache — campaign_events is the ledger of record.
    total_recipients: integer("total_recipients").notNull().default(0),
    sent_count: integer("sent_count").notNull().default(0),
    delivered_count: integer("delivered_count").notNull().default(0),
    opened_count: integer("opened_count").notNull().default(0),
    clicked_count: integer("clicked_count").notNull().default(0),
    replied_count: integer("replied_count").notNull().default(0),
    bounced_count: integer("bounced_count").notNull().default(0),
    unsubscribed_count: integer("unsubscribed_count").notNull().default(0),
    converted_count: integer("converted_count").notNull().default(0),
    created_by_user_id: integer("created_by_user_id"),
    deleted_at: timestamp("deleted_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [index("idx_email_campaigns_status").on(t.status)],
);

export const insertEmailCampaignSchema = createInsertSchema(emailCampaignsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;
export type EmailCampaign = typeof emailCampaignsTable.$inferSelect;

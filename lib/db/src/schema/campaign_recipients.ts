import { pgTable, serial, integer, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Per-prospect enrolment in a campaign — also the send queue.
 *
 * The worker claims rows with `recipient_status='pending' AND next_send_at <= now()`
 * using FOR UPDATE SKIP LOCKED, so several workers (or an overlapping cron tick)
 * can never hand the same row to Resend twice. campaign_sends carries the second,
 * durable guard.
 */
export const campaignRecipientsTable = pgTable(
  "campaign_recipients",
  {
    id: serial("id").primaryKey(),
    campaign_id: integer("campaign_id").notNull(),
    prospect_id: integer("prospect_id").notNull(),
    // Snapshot taken at build time — the address actually queued, lower-cased.
    email: text("email").notNull(),
    // 'pending' | 'sending' | 'sent' | 'replied' | 'bounced' | 'unsubscribed'
    // | 'skipped' | 'failed'
    recipient_status: text("recipient_status").notNull().default("pending"),
    current_step: integer("current_step").notNull().default(1),
    next_send_at: timestamp("next_send_at", { withTimezone: true }),
    last_sent_at: timestamp("last_sent_at", { withTimezone: true }),
    opened_at: timestamp("opened_at", { withTimezone: true }),
    clicked_at: timestamp("clicked_at", { withTimezone: true }),
    replied_at: timestamp("replied_at", { withTimezone: true }),
    open_count: integer("open_count").notNull().default(0),
    click_count: integer("click_count").notNull().default(0),
    // Why this row was excluded at build time or dropped mid-sequence.
    skip_reason: text("skip_reason").notNull().default(""),
    error_message: text("error_message").notNull().default(""),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    uniqueIndex("uq_campaign_recipients").on(t.campaign_id, t.prospect_id),
    // Drives the worker's claim query.
    index("idx_campaign_recipients_queue").on(t.recipient_status, t.next_send_at),
    index("idx_campaign_recipients_prospect").on(t.prospect_id),
  ],
);

export const insertCampaignRecipientSchema = createInsertSchema(campaignRecipientsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertCampaignRecipient = z.infer<typeof insertCampaignRecipientSchema>;
export type CampaignRecipient = typeof campaignRecipientsTable.$inferSelect;

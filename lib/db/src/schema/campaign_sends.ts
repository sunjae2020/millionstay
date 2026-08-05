import { pgTable, serial, integer, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * One row per (campaign, step, recipient) send attempt.
 *
 * The UNIQUE constraint is the duplicate-send guard: the worker INSERTs here
 * BEFORE calling Resend, so a crash, a retry or two overlapping cron ticks collide
 * on the constraint instead of mailing the same person twice. A row therefore means
 * "we committed to sending this" — `send_status` records how it actually went.
 */
export const campaignSendsTable = pgTable(
  "campaign_sends",
  {
    id: serial("id").primaryKey(),
    campaign_id: integer("campaign_id").notNull(),
    step_id: integer("step_id").notNull(),
    recipient_id: integer("recipient_id").notNull(),
    prospect_id: integer("prospect_id").notNull(),
    email: text("email").notNull(),
    subject: text("subject").notNull().default(""),
    // 'claimed' | 'sent' | 'failed'
    send_status: text("send_status").notNull().default("claimed"),
    provider_message_id: text("provider_message_id"),
    error_message: text("error_message").notNull().default(""),
    sent_at: timestamp("sent_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    uniqueIndex("uq_campaign_sends").on(t.campaign_id, t.step_id, t.recipient_id),
    index("idx_campaign_sends_provider_msg").on(t.provider_message_id),
    index("idx_campaign_sends_campaign").on(t.campaign_id),
  ],
);

export const insertCampaignSendSchema = createInsertSchema(campaignSendsTable).omit({
  id: true,
  created_at: true,
});
export type InsertCampaignSend = z.infer<typeof insertCampaignSendSchema>;
export type CampaignSend = typeof campaignSendsTable.$inferSelect;

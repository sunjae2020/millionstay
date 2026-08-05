import { pgTable, serial, integer, text, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Append-only email event ledger (sent / delivered / opened / clicked / bounced /
 * complained / unsubscribed / replied).
 *
 * NEVER UPDATE OR DELETE ROWS HERE. It is the evidentiary record behind every
 * statistic and every consent decision, and one send legitimately produces many
 * rows. That multiplicity is also why these do not go into `email_log`, which is
 * one row per transactional send and is read as document dispatch history.
 *
 * `provider_event_id` is UNIQUE so a webhook replay is idempotent.
 */
export const campaignEventsTable = pgTable(
  "campaign_events",
  {
    id: serial("id").primaryKey(),
    campaign_id: integer("campaign_id"),
    step_id: integer("step_id"),
    recipient_id: integer("recipient_id"),
    prospect_id: integer("prospect_id"),
    send_id: integer("send_id"),
    email: text("email").notNull().default(""),
    event_type: text("event_type").notNull(),
    // Resend's event id — the idempotency key for webhook replays. Events we
    // record ourselves (e.g. 'sent') leave this null.
    provider_event_id: text("provider_event_id"),
    provider_message_id: text("provider_message_id"),
    // Clicked URL, bounce classification, etc.
    detail: text("detail").notNull().default(""),
    raw_payload: jsonb("raw_payload").$type<Record<string, unknown>>(),
    occurred_at: timestamp("occurred_at", { withTimezone: true }).notNull().default(sql`now()`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    uniqueIndex("uq_campaign_events_provider_event").on(t.provider_event_id),
    index("idx_campaign_events_campaign").on(t.campaign_id, t.event_type),
    index("idx_campaign_events_prospect").on(t.prospect_id),
    index("idx_campaign_events_message").on(t.provider_message_id),
  ],
);

export const insertCampaignEventSchema = createInsertSchema(campaignEventsTable).omit({
  id: true,
  created_at: true,
});
export type InsertCampaignEvent = z.infer<typeof insertCampaignEventSchema>;
export type CampaignEvent = typeof campaignEventsTable.$inferSelect;

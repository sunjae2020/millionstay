/**
 * Resend event webhook.
 *
 * Mounted OUTSIDE the admin auth chain — the caller is Resend, not a logged-in
 * user — so the signature is the only thing standing between this endpoint and
 * anyone who knows the URL. It is verified before the payload is touched.
 *
 * Two rules shape everything below:
 *   • Idempotent. Providers retry, and a replayed "opened" must not inflate the
 *     open rate. `provider_event_id` is UNIQUE and a conflict is a no-op.
 *   • Always answer 200. A 500 makes Resend retry, which under a real fault turns
 *     a bug into a retry storm. Failures are logged, not signalled upstream.
 */
import { Router, type IRouter } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  campaignEventsTable,
  campaignRecipientsTable,
  campaignSendsTable,
  emailCampaignsTable,
  emailSuppressionsTable,
  marketingConsentsTable,
  prospectsTable,
} from "@workspace/db";

const router: IRouter = Router();

/**
 * Resend signs with Svix headers: `svix-id`, `svix-timestamp`, `svix-signature`,
 * over `${id}.${timestamp}.${body}` using the base64 secret after the `whsec_`
 * prefix. Verified against the RAW body — re-serialising parsed JSON changes the
 * bytes and every signature would fail.
 */
function verifySignature(rawBody: Buffer, headers: Record<string, unknown>): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[marketing] RESEND_WEBHOOK_SECRET is not set — rejecting webhook");
    return false;
  }

  const id = String(headers["svix-id"] ?? "");
  const timestamp = String(headers["svix-timestamp"] ?? "");
  const signatureHeader = String(headers["svix-signature"] ?? "");
  if (!id || !timestamp || !signatureHeader) return false;

  // Reject anything older than 5 minutes so a captured request cannot be replayed.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${rawBody.toString("utf8")}`)
    .digest("base64");

  // The header carries space-separated `v1,<sig>` pairs — any match is valid.
  return signatureHeader.split(" ").some((part) => {
    const provided = part.split(",")[1];
    if (!provided) return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

/** Resend event type → our ledger vocabulary. */
const EVENT_MAP: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

/**
 * Is this bounce permanent — i.e. the address will never accept mail?
 *
 * Resend reports SES-derived classifications, so the value is `Permanent` /
 * `Transient` / `Undetermined`, NOT "hard". Matching on "hard" (the term the
 * industry uses in prose) silently never fires, and dead addresses stay in the
 * sending pool forever, which is exactly the reputation damage the suppression
 * list exists to prevent. Anything not clearly permanent is left alone — a
 * transient bounce is a full mailbox, not a wrong address.
 */
function isPermanentBounce(type: string | undefined): boolean {
  const t = (type ?? "").toLowerCase();
  return t.includes("permanent") || t.includes("hard");
}

interface ResendEvent {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    click?: { link?: string };
    bounce?: { type?: string; message?: string };
    [key: string]: unknown;
  };
}

// The raw body parser for this path is installed in app.ts, ahead of
// express.json() — see the note there.
router.post(
  "/v1/marketing/webhooks/resend",
  async (req, res): Promise<void> => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body ?? ""));

    if (!verifySignature(rawBody, req.headers as unknown as Record<string, unknown>)) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    let payload: ResendEvent;
    try {
      payload = JSON.parse(rawBody.toString("utf8")) as ResendEvent;
    } catch {
      res.status(200).json({ received: true, ignored: "unparseable" });
      return;
    }

    try {
      await handleEvent(payload, req.headers["svix-id"] as string | undefined);
    } catch (err) {
      // Swallow deliberately: a 500 here means Resend retries, and a retry storm
      // on top of a fault is worse than a lost event we can reconstruct.
      console.error("[marketing] webhook handling failed:", err instanceof Error ? err.message : err);
    }

    res.status(200).json({ received: true });
  },
);

async function handleEvent(payload: ResendEvent, svixId?: string): Promise<void> {
  const eventType = EVENT_MAP[payload.type ?? ""] ?? null;
  if (!eventType) return;

  const messageId = payload.data?.email_id ?? null;
  const rawTo = payload.data?.to;
  const email = (Array.isArray(rawTo) ? rawTo[0] : rawTo ?? "").toLowerCase().trim();
  const occurredAt = payload.created_at ? new Date(payload.created_at) : new Date();
  // Resend does not expose a per-event id, so the Svix delivery id is the
  // idempotency key. Falling back to message+type keeps replays deduped even if
  // the header is absent.
  const providerEventId = svixId ?? (messageId ? `${messageId}:${eventType}` : null);

  // Correlate back to the campaign through the send row we wrote before mailing.
  const [send] = messageId
    ? await db.select().from(campaignSendsTable).where(eq(campaignSendsTable.provider_message_id, messageId)).limit(1)
    : [];

  const detail =
    eventType === "clicked"
      ? payload.data?.click?.link ?? ""
      : eventType === "bounced"
        ? `${payload.data?.bounce?.type ?? ""} ${payload.data?.bounce?.message ?? ""}`.trim()
        : "";

  const inserted = await db
    .insert(campaignEventsTable)
    .values({
      campaign_id: send?.campaign_id ?? null,
      step_id: send?.step_id ?? null,
      recipient_id: send?.recipient_id ?? null,
      prospect_id: send?.prospect_id ?? null,
      send_id: send?.id ?? null,
      email: email || send?.email || "",
      event_type: eventType,
      provider_event_id: providerEventId,
      provider_message_id: messageId,
      detail,
      raw_payload: payload as unknown as Record<string, unknown>,
      occurred_at: occurredAt,
    })
    .onConflictDoNothing()
    .returning({ id: campaignEventsTable.id });

  // Already recorded — a replay. Everything below would double-count.
  if (inserted.length === 0) return;

  const targetEmail = email || send?.email || "";

  if (send?.recipient_id) {
    const patch: Record<string, unknown> = { updated_at: new Date() };
    if (eventType === "opened") {
      patch.opened_at = sql`COALESCE(${campaignRecipientsTable.opened_at}, ${occurredAt})`;
      patch.open_count = sql`${campaignRecipientsTable.open_count} + 1`;
    }
    if (eventType === "clicked") {
      patch.clicked_at = sql`COALESCE(${campaignRecipientsTable.clicked_at}, ${occurredAt})`;
      patch.click_count = sql`${campaignRecipientsTable.click_count} + 1`;
    }
    if (eventType === "bounced") {
      patch.recipient_status = "bounced";
      patch.error_message = detail;
    }
    await db.update(campaignRecipientsTable).set(patch).where(eq(campaignRecipientsTable.id, send.recipient_id));
  }

  if (send?.campaign_id) {
    const counter =
      eventType === "delivered" ? emailCampaignsTable.delivered_count
      : eventType === "opened" ? emailCampaignsTable.opened_count
      : eventType === "clicked" ? emailCampaignsTable.clicked_count
      : eventType === "bounced" ? emailCampaignsTable.bounced_count
      : null;
    if (counter) {
      await db
        .update(emailCampaignsTable)
        .set({ [counter.name]: sql`${counter} + 1`, updated_at: new Date() } as never)
        .where(eq(emailCampaignsTable.id, send.campaign_id));
    }
  }

  // A hard bounce means the address does not exist; a complaint means the owner
  // told a mailbox provider we are spam. Both are permanent — block the address
  // rather than letting the next campaign rediscover it.
  const isHardBounce = eventType === "bounced" && isPermanentBounce(payload.data?.bounce?.type);
  if (targetEmail && (isHardBounce || eventType === "complained")) {
    await db
      .insert(emailSuppressionsTable)
      .values({
        email: targetEmail,
        reason: eventType === "complained" ? "complaint" : "hard_bounce",
        detail,
        source_campaign_id: send?.campaign_id ?? null,
      })
      .onConflictDoNothing();
  }

  if (send?.prospect_id) {
    if (eventType === "bounced") {
      await db
        .update(prospectsTable)
        .set({
          bounce_count: sql`${prospectsTable.bounce_count} + 1`,
          prospect_status: isHardBounce ? "bounced" : sql`${prospectsTable.prospect_status}`,
          updated_at: new Date(),
        })
        .where(eq(prospectsTable.id, send.prospect_id));
    } else if (eventType === "complained") {
      await db
        .update(prospectsTable)
        .set({ prospect_status: "unsubscribed", updated_at: new Date() })
        .where(eq(prospectsTable.id, send.prospect_id));
    } else if (eventType === "opened" || eventType === "clicked") {
      // Engagement raises the score; a click is worth more than an open, and a
      // second click is the signal worth acting on.
      const bump = eventType === "clicked" ? 5 : 1;
      await db
        .update(prospectsTable)
        .set({
          qualification_score: sql`${prospectsTable.qualification_score} + ${bump}`,
          prospect_status: sql`CASE WHEN ${prospectsTable.prospect_status} IN ('new','queued','contacted','opened')
            THEN ${eventType} ELSE ${prospectsTable.prospect_status} END`,
          next_action_at: eventType === "clicked" ? new Date() : sql`${prospectsTable.next_action_at}`,
          updated_at: new Date(),
        })
        .where(eq(prospectsTable.id, send.prospect_id));
    }
  }

  // A complaint is also a withdrawal of consent — record it where unsubscribes live.
  if (targetEmail && eventType === "complained") {
    await recordOptOut(targetEmail, "complaint");
  }
}

/** Withdraw marketing consent, matching the shape routes/privacy.ts writes. */
export async function recordOptOut(email: string, source: string): Promise<void> {
  const lc = email.toLowerCase().trim();
  const now = new Date();
  const [existing] = await db
    .select()
    .from(marketingConsentsTable)
    .where(and(eq(marketingConsentsTable.email, lc), eq(marketingConsentsTable.channel, "email")))
    .limit(1);

  if (existing) {
    await db
      .update(marketingConsentsTable)
      .set({ opted_out_at: now, updated_at: now, source })
      .where(eq(marketingConsentsTable.id, existing.id));
  } else {
    await db.insert(marketingConsentsTable).values({
      email: lc,
      channel: "email",
      opted_out_at: now,
      source,
    });
  }
}

export default router;

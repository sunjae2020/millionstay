/**
 * Privacy routes — Sprint B-1
 *
 * Public endpoints for unsubscribe / consent withdrawal. No authentication
 * required (token is HMAC-signed). Marketing consent is recorded per email
 * and channel.
 */
import { Router, type IRouter } from "express";
import {
  db,
  marketingConsentsTable,
  prospectsTable,
  campaignRecipientsTable,
  campaignEventsTable,
  campaignSendsTable,
  emailCampaignsTable,
} from "@workspace/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { verifyUnsubscribeToken } from "../lib/unsubscribeToken";
import { getPrivacyContactEmail } from "../lib/companyContact";
import { getCompanyInfo } from "../lib/documents/theme";

const router: IRouter = Router();

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function renderPage(title: string, body: string, statusColor = "#16a34a"): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body{font-family:-apple-system,sans-serif;background:#f9fafb;margin:0;padding:48px 16px;color:#111}
  .card{max-width:480px;margin:0 auto;background:white;border-radius:16px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08);text-align:center}
  h1{margin:0 0 12px;font-size:22px;color:${statusColor}}
  p{color:#555;line-height:1.6}
</style></head><body><div class="card"><h1>${escapeHtml(title)}</h1>${body}</div></body></html>`;
}

async function applyOptOut(email: string, channel: "email" | "sms", req: any) {
  const lc = email.toLowerCase().trim();
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.ip ||
    null;
  const ua = (req.headers["user-agent"] as string | undefined) ?? null;
  const now = new Date();

  const [existing] = await db
    .select()
    .from(marketingConsentsTable)
    .where(and(eq(marketingConsentsTable.email, lc), eq(marketingConsentsTable.channel, channel)))
    .limit(1);

  if (existing) {
    await db
      .update(marketingConsentsTable)
      .set({ opted_out_at: now, updated_at: now, source: "unsubscribe_link", ip_address: ip, user_agent: ua?.slice(0, 512) ?? null })
      .where(eq(marketingConsentsTable.id, existing.id));
  } else {
    await db.insert(marketingConsentsTable).values({
      email: lc,
      channel,
      opted_out_at: now,
      source: "unsubscribe_link",
      ip_address: ip,
      user_agent: ua?.slice(0, 512) ?? null,
    });
  }

  if (channel === "email") await stopCampaignsFor(lc, now);
}

/**
 * Withdrawing consent has to reach the campaign machinery too, not just the
 * consent table. The send worker re-checks consent before every message, so this
 * is belt-and-braces — but without it a queued recipient stays "pending" forever
 * and the prospect keeps showing as an active target on every screen.
 */
async function stopCampaignsFor(email: string, now: Date): Promise<void> {
  try {
    const [prospect] = await db
      .select({ id: prospectsTable.id })
      .from(prospectsTable)
      .where(sql`lower(${prospectsTable.email}) = ${email}`)
      .limit(1);

    await db
      .update(campaignRecipientsTable)
      .set({ recipient_status: "unsubscribed", skip_reason: "unsubscribed", updated_at: now })
      .where(
        and(
          sql`lower(${campaignRecipientsTable.email}) = ${email}`,
          inArray(campaignRecipientsTable.recipient_status, ["pending", "sending"]),
        ),
      );

    if (prospect) {
      await db
        .update(prospectsTable)
        .set({ prospect_status: "unsubscribed", updated_at: now })
        .where(eq(prospectsTable.id, prospect.id));
    }

    // Attribute the opt-out to the campaign whose message prompted it — the most
    // recent send to this address. Without this the event carries no campaign and
    // every campaign's unsubscribe rate reads as zero, which is precisely the
    // number an operator needs to see when a message is landing badly.
    const [lastSend] = await db
      .select({ campaign_id: campaignSendsTable.campaign_id, recipient_id: campaignSendsTable.recipient_id })
      .from(campaignSendsTable)
      .where(sql`lower(${campaignSendsTable.email}) = ${email}`)
      .orderBy(desc(campaignSendsTable.id))
      .limit(1);

    await db.insert(campaignEventsTable).values({
      campaign_id: lastSend?.campaign_id ?? null,
      recipient_id: lastSend?.recipient_id ?? null,
      prospect_id: prospect?.id ?? null,
      email,
      event_type: "unsubscribed",
      detail: "unsubscribe_link",
      occurred_at: now,
    });

    if (lastSend?.campaign_id) {
      await db
        .update(emailCampaignsTable)
        .set({ unsubscribed_count: sql`${emailCampaignsTable.unsubscribed_count} + 1`, updated_at: now })
        .where(eq(emailCampaignsTable.id, lastSend.campaign_id));
    }
  } catch (err) {
    // The opt-out itself has already been recorded — that is the part that must
    // not fail. Downstream bookkeeping problems are logged, not raised.
    console.error("[privacy] failed to stop campaigns after unsubscribe:", err instanceof Error ? err.message : err);
  }
}

/** Public unsubscribe link clicked from email — renders an HTML confirmation. */
router.get("/v1/privacy/unsubscribe", async (req, res): Promise<void> => {
  const token = (req.query.token as string | undefined) ?? "";
  const payload = verifyUnsubscribeToken(token);
  if (!payload) {
    res.status(400).type("html").send(
      renderPage(
        "Unsubscribe link is invalid or expired",
        `<p>This unsubscribe link is no longer valid. Please open the most recent email from us and use the link inside, or contact <a href="mailto:${getPrivacyContactEmail()}">${getPrivacyContactEmail()}</a>.</p>`,
        "#dc2626",
      ),
    );
    return;
  }

  try {
    await applyOptOut(payload.email, payload.channel, req);
    res
      .type("html")
      .send(
        renderPage(
          "You have been unsubscribed",
          `<p><strong>${escapeHtml(payload.email)}</strong> will no longer receive marketing ${escapeHtml(payload.channel)} from ${escapeHtml(getCompanyInfo().tradingName)}.</p>
           <p style="font-size:13px;color:#999;margin-top:24px">You will still receive transactional messages (booking confirmations, receipts, security alerts) as required to operate your account.</p>`,
        ),
      );
  } catch (err) {
    console.error("Unsubscribe failed:", err);
    res.status(500).type("html").send(
      renderPage(
        "Something went wrong",
        `<p>We couldn't process your request right now. Please try again later or email <a href="mailto:${getPrivacyContactEmail()}">${getPrivacyContactEmail()}</a>.</p>`,
        "#dc2626",
      ),
    );
  }
});

/** JSON API equivalent — for in-app preference toggles. */
router.post("/v1/privacy/unsubscribe", async (req, res): Promise<void> => {
  try {
    const { token, email, channel } = (req.body ?? {}) as {
      token?: string;
      email?: string;
      channel?: "email" | "sms";
    };

    let resolvedEmail: string | null = null;
    let resolvedChannel: "email" | "sms" = "email";

    if (token) {
      const payload = verifyUnsubscribeToken(token);
      if (!payload) {
        res.status(400).json({ success: false, error: "Invalid or expired token" });
        return;
      }
      resolvedEmail = payload.email;
      resolvedChannel = payload.channel;
    } else if (email) {
      resolvedEmail = email;
      resolvedChannel = channel === "sms" ? "sms" : "email";
    } else {
      res.status(400).json({ success: false, error: "token or email is required" });
      return;
    }

    await applyOptOut(resolvedEmail, resolvedChannel, req);
    res.json({ success: true });
  } catch (err) {
    console.error("Unsubscribe (POST) failed:", err);
    res.status(500).json({ success: false, error: "Failed to process request" });
  }
});

export default router;

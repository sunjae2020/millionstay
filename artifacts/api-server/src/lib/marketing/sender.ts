/**
 * The single outbound path for campaign email.
 *
 * Every send goes through `sendCampaignMessage`, which re-checks sendability
 * immediately before handing the message to the provider. That second check is
 * not redundant with the one at build time: minutes or days can pass between
 * queueing a recipient and mailing them, and an unsubscribe that lands in that
 * window must stop the send. Checking only at build time is how systems mail
 * people who already opted out.
 */
import { db, emailLogsTable, type emailCampaignsTable, type prospectsTable } from "@workspace/db";
import { emailSender, resendClient } from "../email";
import type { Resend } from "resend";
import { checkSendable } from "./consent";
import { renderCampaignMessage, type CampaignBrand, type RenderVariables } from "./render";

type Campaign = typeof emailCampaignsTable.$inferSelect;
type Prospect = typeof prospectsTable.$inferSelect;

let client: Resend | null = null;
let clientKey: string | null = null;

/** Re-created when the key changes so a rotated key applies without a restart. */
function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client || clientKey !== key) {
    client = resendClient(key);
    clientKey = key;
  }
  return client;
}

/**
 * Render and record everything, but never hand the message to the provider.
 *
 * This exists because unsetting RESEND_API_KEY does NOT disable sending on this
 * codebase: the key is stored in `integration_settings` and loaded into
 * process.env at boot, so an operator who clears it from `.env` and expects a
 * dry run will still send real email. MARKETING_DRY_RUN is the switch that
 * actually holds, and it is the safe way to exercise the worker end-to-end.
 */
function dryRun(): boolean {
  return String(process.env.MARKETING_DRY_RUN ?? "").toLowerCase() === "true";
}

/** Template variables for one prospect. */
export function prospectVars(prospect: Prospect, campaign: Campaign): RenderVariables {
  return {
    company_name: prospect.company_name,
    contact_name: prospect.contact_name,
    contact_title: prospect.contact_title,
    country: prospect.country,
    city: prospect.city,
    sender_name: campaign.from_name,
  };
}

/**
 * The envelope From. A campaign may name its own sender, but only on a domain
 * the provider has verified for this account — otherwise Resend rejects the
 * whole send. Unknown domains fall back to the instance default.
 */
function resolveFrom(campaign: Campaign, brandName: string): { from: string; replyTo?: string } {
  // The fallback sender still identifies the tenant — a Metheim campaign that
  // does not name its own sender must not go out as "MillionStay".
  const base = emailSender(brandName);
  const configured = campaign.from_email.trim();
  if (!configured) return { from: base.from, replyTo: campaign.reply_to.trim() || base.replyTo };

  const allowed = (process.env.MARKETING_FROM_DOMAIN ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  const domain = configured.split("@")[1]?.toLowerCase() ?? "";
  if (allowed.length > 0 && !allowed.includes(domain)) {
    console.warn(`[marketing] from_email domain "${domain}" is not in MARKETING_FROM_DOMAIN — using the default sender`);
    return { from: base.from, replyTo: configured };
  }

  const display = campaign.from_name.trim();
  return {
    from: display ? `${display} <${configured}>` : configured,
    replyTo: campaign.reply_to.trim() || undefined,
  };
}

export interface SendCampaignMessageOptions {
  to: string;
  campaign: Campaign;
  subject: string;
  bodyHtml: string;
  vars: RenderVariables;
  brand: CampaignBrand;
  languageCode: string;
  prospectId?: number;
  /** The recipient's recorded ground for contact (prospects.consent_basis). */
  consentBasis?: string | null;
  /** Test sends skip the consent ground (the operator chose the address themselves)
   *  but never the suppression list — a test to a complained address is still a send. */
  isTest?: boolean;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  skipped?: boolean;
  /** Machine-readable skip cause, mirrored onto campaign_recipients.skip_reason. */
  reason?: string;
  error?: string;
}

export async function sendCampaignMessage(opts: SendCampaignMessageOptions): Promise<SendResult> {
  const to = opts.to.toLowerCase().trim();

  const verdict = await checkSendable({ email: to, consentBasis: opts.consentBasis });
  if (!verdict.sendable) {
    // A test send may proceed without a recorded ground — the operator typed the
    // address — but an unsubscribe or a suppression still stops it.
    const groundOnly = verdict.reason === "no_consent_basis" || verdict.reason === "personal_domain";
    if (!(opts.isTest && groundOnly)) {
      return { ok: false, skipped: true, reason: verdict.reason, error: verdict.reason };
    }
  }

  const rendered = renderCampaignMessage({
    subject: opts.subject,
    bodyHtml: opts.bodyHtml,
    email: to,
    vars: opts.vars,
    brand: opts.brand,
    languageCode: opts.languageCode,
    isAdvertising: opts.campaign.is_advertising,
  });

  if (dryRun()) {
    console.log(
      `[marketing] DRY RUN — campaign ${opts.campaign.id} → ${to} · "${rendered.subject}" (not sent)`,
    );
    return { ok: true, skipped: true, reason: "dry_run", id: undefined };
  }

  const resend = getClient();
  if (!resend) {
    // Mirrors the rest of lib/email.ts: with no key configured the whole flow
    // still runs, so the worker can be exercised end-to-end without mailing.
    console.log(`[marketing] RESEND_API_KEY not set — skipping campaign ${opts.campaign.id} → ${to}`);
    return { ok: false, skipped: true, reason: "email_disabled", error: "Email service not configured" };
  }

  const sender = resolveFrom(opts.campaign, opts.brand.name);
  try {
    const result = await resend.emails.send({
      from: sender.from,
      ...(sender.replyTo ? { replyTo: sender.replyTo } : {}),
      to: [to],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      // RFC 8058 — lets the mail client offer one-click opt-out, which mailbox
      // providers increasingly require of bulk senders.
      headers: {
        "List-Unsubscribe": `<${rendered.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    const id = (result as { data?: { id?: string } })?.data?.id;

    // A summary row in the transactional log too, so "what did we send this
    // address" has one answer across the whole system.
    await db.insert(emailLogsTable).values({
      template_code: `campaign:${opts.campaign.id}`,
      to_email: to,
      subject: rendered.subject,
      resend_message_id: id ?? null,
      status: "Sent",
      entity_type: "email_campaign",
      entity_id: opts.campaign.id,
    }).catch(() => undefined);

    return { ok: true, id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    console.error(`[marketing] send failed for campaign ${opts.campaign.id}:`, message);
    await db.insert(emailLogsTable).values({
      template_code: `campaign:${opts.campaign.id}`,
      to_email: to,
      subject: rendered.subject,
      status: "Failed",
      entity_type: "email_campaign",
      entity_id: opts.campaign.id,
      error_message: message,
    }).catch(() => undefined);
    return { ok: false, error: message };
  }
}

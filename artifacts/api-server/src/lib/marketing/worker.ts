/**
 * Campaign send worker — runs on the shared node-cron schedule in index.ts.
 *
 * Three properties matter more than throughput here:
 *
 *  1. No double sends. Rows are claimed with FOR UPDATE SKIP LOCKED and a
 *     campaign_sends row is inserted BEFORE the provider call, so a crash between
 *     "we decided to send" and "the provider accepted it" cannot produce a second
 *     attempt — the unique constraint refuses it.
 *  2. No sends outside the legal window. Korean advertising email may not be sent
 *     21:00–08:00; a recipient reached outside the campaign's window is pushed to
 *     the next opening rather than skipped or forced through.
 *  3. No run can wedge the process. Every recipient is wrapped individually; one
 *     bad row records its error and the loop continues.
 */
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import {
  db,
  emailCampaignsTable,
  campaignStepsTable,
  campaignRecipientsTable,
  campaignSendsTable,
  campaignEventsTable,
  prospectsTable,
  emailTemplatesTable,
} from "@workspace/db";
import { resolveCampaignBrand } from "./render";
import { sendCampaignMessage, prospectVars } from "./sender";

/** How often the cron fires; the hourly throttle is divided by this. */
const RUNS_PER_HOUR = 12; // every 5 minutes

export interface WorkerResult {
  enabled: boolean;
  campaigns: number;
  sent: number;
  skipped: number;
  failed: number;
  deferred: number;
}

/** Off unless explicitly enabled, so a new instance never starts mailing by surprise. */
function workerEnabled(): boolean {
  return String(process.env.MARKETING_ENABLED ?? "").toLowerCase() === "true";
}

/** Local wall-clock "HH:MM" for a timezone, without pulling in a date library. */
function localTime(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone, hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  }
}

const toMinutes = (hhmm: string): number => {
  const [h = "0", m = "0"] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
};

/**
 * Is `now` inside the campaign's daily send window? Windows that wrap past
 * midnight (22:00–06:00) are supported, though the Korean defaults never do.
 */
export function insideSendWindow(now: Date, start: string, end: string, timeZone: string): boolean {
  const current = toMinutes(localTime(now, timeZone));
  const from = toMinutes(start);
  const to = toMinutes(end);
  if (from === to) return true;             // 24h window
  if (from < to) return current >= from && current < to;
  return current >= from || current < to;   // wraps midnight
}

/** The next moment the window opens, used to defer rather than drop a recipient. */
export function nextWindowOpening(now: Date, start: string, timeZone: string): Date {
  const currentMinutes = toMinutes(localTime(now, timeZone));
  const startMinutes = toMinutes(start);
  let deltaMinutes = startMinutes - currentMinutes;
  if (deltaMinutes <= 0) deltaMinutes += 24 * 60;
  return new Date(now.getTime() + deltaMinutes * 60_000);
}

async function resolveContent(
  step: typeof campaignStepsTable.$inferSelect,
  lang: string,
): Promise<{ subject: string; bodyHtml: string }> {
  const override = (step.body_i18n ?? {})[lang];
  let subject = override?.subject || step.subject;
  let bodyHtml = override?.body_html || step.body_html;

  if ((!subject || !bodyHtml) && step.template_code) {
    const [template] = await db
      .select()
      .from(emailTemplatesTable)
      .where(eq(emailTemplatesTable.template_code, step.template_code))
      .limit(1);
    if (template) {
      subject = subject || template.subject;
      bodyHtml = bodyHtml || template.body_html;
    }
  }
  return { subject: subject ?? "", bodyHtml: bodyHtml ?? "" };
}

export async function runCampaignSends(): Promise<WorkerResult> {
  const result: WorkerResult = { enabled: workerEnabled(), campaigns: 0, sent: 0, skipped: 0, failed: 0, deferred: 0 };
  if (!result.enabled) return result;

  const now = new Date();

  const campaigns = await db
    .select()
    .from(emailCampaignsTable)
    .where(inArray(emailCampaignsTable.status, ["scheduled", "sending"]));

  for (const campaign of campaigns) {
    try {
      const steps = await db
        .select()
        .from(campaignStepsTable)
        .where(eq(campaignStepsTable.campaign_id, campaign.id))
        .orderBy(asc(campaignStepsTable.step_no));
      if (steps.length === 0) continue;

      const batchSize = Math.max(1, Math.floor(campaign.throttle_per_hour / RUNS_PER_HOUR));

      // Claim a batch. SKIP LOCKED means a second worker (or an overlapping tick)
      // takes different rows instead of blocking or duplicating.
      const claimed = await db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(campaignRecipientsTable)
          .where(
            and(
              eq(campaignRecipientsTable.campaign_id, campaign.id),
              eq(campaignRecipientsTable.recipient_status, "pending"),
              lte(campaignRecipientsTable.next_send_at, now),
            ),
          )
          .orderBy(asc(campaignRecipientsTable.next_send_at))
          .limit(batchSize)
          .for("update", { skipLocked: true });

        if (rows.length) {
          await tx
            .update(campaignRecipientsTable)
            .set({ recipient_status: "sending", updated_at: new Date() })
            .where(inArray(campaignRecipientsTable.id, rows.map((r) => r.id)));
        }
        return rows;
      });

      if (claimed.length === 0) {
        // Nothing due. Finish the campaign only when the queue is genuinely empty.
        const [{ remaining } = { remaining: 0 }] = await db
          .select({ remaining: sql<number>`count(*)::int` })
          .from(campaignRecipientsTable)
          .where(
            and(
              eq(campaignRecipientsTable.campaign_id, campaign.id),
              inArray(campaignRecipientsTable.recipient_status, ["pending", "sending"]),
            ),
          );
        if (remaining === 0 && campaign.status === "sending") {
          await db
            .update(emailCampaignsTable)
            .set({ status: "completed", completed_at: new Date(), updated_at: new Date() })
            .where(eq(emailCampaignsTable.id, campaign.id));
        }
        continue;
      }

      result.campaigns++;

      if (campaign.status === "scheduled") {
        await db
          .update(emailCampaignsTable)
          .set({ status: "sending", started_at: campaign.started_at ?? new Date(), updated_at: new Date() })
          .where(eq(emailCampaignsTable.id, campaign.id));
      }

      // Outside the window: hand every claimed row back with a later time. Done
      // before any provider call so nothing goes out at 03:00.
      if (!insideSendWindow(now, campaign.send_window_start, campaign.send_window_end, campaign.timezone)) {
        const next = nextWindowOpening(now, campaign.send_window_start, campaign.timezone);
        await db
          .update(campaignRecipientsTable)
          .set({ recipient_status: "pending", next_send_at: next, updated_at: new Date() })
          .where(inArray(campaignRecipientsTable.id, claimed.map((r) => r.id)));
        result.deferred += claimed.length;
        continue;
      }

      const brand = await resolveCampaignBrand();

      const prospects = await db
        .select()
        .from(prospectsTable)
        .where(inArray(prospectsTable.id, claimed.map((r) => r.prospect_id)));
      const prospectById = new Map(prospects.map((p) => [p.id, p] as const));

      for (const recipient of claimed) {
        try {
          const prospect = prospectById.get(recipient.prospect_id);
          const step = steps.find((s) => s.step_no === recipient.current_step);
          if (!prospect || !step) {
            await db
              .update(campaignRecipientsTable)
              .set({ recipient_status: "skipped", skip_reason: "missing_step_or_prospect", updated_at: new Date() })
              .where(eq(campaignRecipientsTable.id, recipient.id));
            result.skipped++;
            continue;
          }

          // Claim the send BEFORE calling the provider. A unique violation here
          // means this exact (campaign, step, recipient) was already attempted.
          let sendId: number | undefined;
          try {
            const [send] = await db
              .insert(campaignSendsTable)
              .values({
                campaign_id: campaign.id,
                step_id: step.id,
                recipient_id: recipient.id,
                prospect_id: prospect.id,
                email: recipient.email,
                send_status: "claimed",
              })
              .returning({ id: campaignSendsTable.id });
            sendId = send?.id;
          } catch {
            await db
              .update(campaignRecipientsTable)
              .set({ recipient_status: "sent", skip_reason: "duplicate_send_blocked", updated_at: new Date() })
              .where(eq(campaignRecipientsTable.id, recipient.id));
            result.skipped++;
            continue;
          }

          const lang = prospect.language_code || campaign.language_code;
          const { subject, bodyHtml } = await resolveContent(step, lang);

          const sendResult = await sendCampaignMessage({
            to: recipient.email,
            campaign,
            subject,
            bodyHtml,
            vars: prospectVars(prospect, campaign),
            brand,
            languageCode: lang,
            prospectId: prospect.id,
            consentBasis: prospect.consent_basis,
          });

          const stamp = new Date();

          if (!sendResult.ok) {
            await db
              .update(campaignSendsTable)
              .set({ send_status: "failed", error_message: sendResult.error ?? "" })
              .where(eq(campaignSendsTable.id, sendId!));
            await db
              .update(campaignRecipientsTable)
              .set({
                recipient_status: sendResult.skipped ? "skipped" : "failed",
                skip_reason: sendResult.reason ?? "",
                error_message: sendResult.error ?? "",
                updated_at: stamp,
              })
              .where(eq(campaignRecipientsTable.id, recipient.id));
            if (sendResult.skipped) result.skipped++;
            else result.failed++;
            continue;
          }

          await db
            .update(campaignSendsTable)
            .set({ send_status: "sent", provider_message_id: sendResult.id ?? null, subject, sent_at: stamp })
            .where(eq(campaignSendsTable.id, sendId!));

          await db.insert(campaignEventsTable).values({
            campaign_id: campaign.id,
            step_id: step.id,
            recipient_id: recipient.id,
            prospect_id: prospect.id,
            send_id: sendId,
            email: recipient.email,
            event_type: "sent",
            provider_message_id: sendResult.id ?? null,
            occurred_at: stamp,
          });

          // Advance the sequence, or finish this recipient.
          const nextStep = steps.find((s) => s.step_no === recipient.current_step + 1);
          if (nextStep) {
            const delayMs = (nextStep.delay_days * 24 + nextStep.delay_hours) * 3_600_000;
            await db
              .update(campaignRecipientsTable)
              .set({
                recipient_status: "pending",
                current_step: nextStep.step_no,
                next_send_at: new Date(stamp.getTime() + delayMs),
                last_sent_at: stamp,
                updated_at: stamp,
              })
              .where(eq(campaignRecipientsTable.id, recipient.id));
          } else {
            await db
              .update(campaignRecipientsTable)
              .set({ recipient_status: "sent", next_send_at: null, last_sent_at: stamp, updated_at: stamp })
              .where(eq(campaignRecipientsTable.id, recipient.id));
          }

          await db
            .update(prospectsTable)
            .set({ prospect_status: "contacted", last_contacted_at: stamp, updated_at: stamp })
            .where(and(eq(prospectsTable.id, prospect.id), eq(prospectsTable.prospect_status, "new")));

          await db
            .update(emailCampaignsTable)
            .set({ sent_count: sql`${emailCampaignsTable.sent_count} + 1`, updated_at: stamp })
            .where(eq(emailCampaignsTable.id, campaign.id));

          result.sent++;
        } catch (err) {
          // One bad recipient must not stop the batch.
          const message = err instanceof Error ? err.message : "Unknown error";
          console.error(`[marketing] recipient ${recipient.id} failed:`, message);
          await db
            .update(campaignRecipientsTable)
            .set({ recipient_status: "failed", error_message: message, updated_at: new Date() })
            .where(eq(campaignRecipientsTable.id, recipient.id))
            .catch(() => undefined);
          result.failed++;
        }
      }
    } catch (err) {
      console.error(`[marketing] campaign ${campaign.id} run failed:`, err instanceof Error ? err.message : err);
    }
  }

  return result;
}

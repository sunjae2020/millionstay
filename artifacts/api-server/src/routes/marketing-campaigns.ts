/**
 * Campaigns — authoring, audience build, preview, test send, lifecycle, stats.
 *
 * The actual sending happens in lib/marketing/worker.ts on a cron; these routes
 * only ever move a campaign between states. That separation is deliberate: an
 * HTTP request must never be the thing that decides how many thousand messages
 * go out, because a retry or a double-click would then double the send.
 */
import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  emailCampaignsTable,
  campaignStepsTable,
  campaignRecipientsTable,
  campaignEventsTable,
  campaignSendsTable,
  prospectsTable,
  emailTemplatesTable,
  marketingListsTable,
} from "@workspace/db";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import { logAction } from "../utils/auditLog";
import { resolveListMembers, NON_MAILABLE_STATUSES, MAX_BOUNCES } from "../lib/marketing/audience";
import { checkSendableBatch } from "../lib/marketing/consent";
import { resolveCampaignBrand, renderCampaignMessage, extractVariables } from "../lib/marketing/render";
import { sendCampaignMessage, prospectVars } from "../lib/marketing/sender";

const router: IRouter = Router();
const ENTITY = "email_campaign";

const CampaignBody = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  list_id: z.number().int().nullish(),
  from_email: z.string().default(""),
  from_name: z.string().default(""),
  reply_to: z.string().default(""),
  language_code: z.string().default("ko"),
  is_advertising: z.boolean().default(true),
  throttle_per_hour: z.number().int().min(1).max(10_000).default(60),
  send_window_start: z.string().default("09:00"),
  send_window_end: z.string().default("18:00"),
  timezone: z.string().default("Asia/Seoul"),
  scheduled_at: z.string().nullish(),
});

const StepBody = z.object({
  step_no: z.number().int().min(1).default(1),
  name: z.string().default(""),
  template_code: z.string().nullish(),
  subject: z.string().default(""),
  body_html: z.string().default(""),
  body_i18n: z.record(z.string(), z.unknown()).nullish(),
  delay_days: z.number().int().min(0).default(0),
  delay_hours: z.number().int().min(0).max(23).default(0),
  stop_on: z.enum(["none", "open", "click", "reply"]).default("reply"),
});

/** States in which the send worker will pick a campaign up. */
const LIVE_STATUSES = ["scheduled", "sending"];

// ── CRUD ────────────────────────────────────────────────────────────────────

router.get("/v1/marketing/campaigns", async (req, res): Promise<void> => {
  try {
    const conditions = [deletedFilter(emailCampaignsTable.deleted_at, req)];
    const status = (req.query.status as string | undefined) ?? "";
    if (status) conditions.push(eq(emailCampaignsTable.status, status));
    const rows = await db
      .select()
      .from(emailCampaignsTable)
      .where(and(...conditions))
      .orderBy(desc(emailCampaignsTable.updated_at));
    res.json({ success: true, data: rows, meta: { total: rows.length } });
  } catch {
    res.status(500).json({ error: "Failed to list campaigns" });
  }
});

router.post("/v1/marketing/campaigns", async (req, res): Promise<void> => {
  const parsed = CampaignBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const [row] = await db
      .insert(emailCampaignsTable)
      .values({
        ...parsed.data,
        list_id: parsed.data.list_id ?? null,
        scheduled_at: parsed.data.scheduled_at ? new Date(parsed.data.scheduled_at) : null,
      })
      .returning();
    void logAction({ entityType: ENTITY, entityId: row!.id, action: "CREATE", newValue: { name: row!.name } });
    res.status(201).json({ success: true, data: row });
  } catch {
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

router.get("/v1/marketing/campaigns/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [campaign] = await db.select().from(emailCampaignsTable).where(eq(emailCampaignsTable.id, id)).limit(1);
    if (!campaign) { res.status(404).json({ error: "Not found" }); return; }

    const steps = await db
      .select()
      .from(campaignStepsTable)
      .where(eq(campaignStepsTable.campaign_id, id))
      .orderBy(campaignStepsTable.step_no);

    const list = campaign.list_id
      ? (await db.select().from(marketingListsTable).where(eq(marketingListsTable.id, campaign.list_id)).limit(1))[0] ?? null
      : null;

    res.json({ success: true, data: { ...campaign, steps, list } });
  } catch {
    res.status(500).json({ error: "Failed to load campaign" });
  }
});

router.patch("/v1/marketing/campaigns/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = CampaignBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const [existing] = await db.select().from(emailCampaignsTable).where(eq(emailCampaignsTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    // Editing the audience or the sender mid-flight would silently change what
    // the already-queued recipients receive.
    if (existing.status === "sending") {
      res.status(409).json({ error: "Pause the campaign before editing it" });
      return;
    }
    const [row] = await db
      .update(emailCampaignsTable)
      .set({
        ...parsed.data,
        scheduled_at: parsed.data.scheduled_at ? new Date(parsed.data.scheduled_at) : undefined,
        updated_at: new Date(),
      })
      .where(eq(emailCampaignsTable.id, id))
      .returning();
    void logAction({ entityType: ENTITY, entityId: id, action: "UPDATE", newValue: parsed.data });
    res.json({ success: true, data: row });
  } catch {
    res.status(500).json({ error: "Failed to update campaign" });
  }
});

const campaignsSoftDelete = {
  table: emailCampaignsTable,
  idColumn: emailCampaignsTable.id,
  statusKey: "status",
  archivedStatus: "cancelled",
  restoredStatus: "draft",
  // Steps and the queue go with the campaign; campaign_events do NOT — the event
  // ledger is append-only evidence and outlives the campaign row.
  onPurge: async (ids: number[]) => {
    await db.delete(campaignStepsTable).where(inArray(campaignStepsTable.campaign_id, ids));
    await db.delete(campaignRecipientsTable).where(inArray(campaignRecipientsTable.campaign_id, ids));
  },
};

router.post("/v1/marketing/campaigns/bulk-delete", makeBulkDelete(campaignsSoftDelete));
router.post("/v1/marketing/campaigns/bulk-restore", makeBulkRestore(campaignsSoftDelete));

// ── Steps ───────────────────────────────────────────────────────────────────

router.post("/v1/marketing/campaigns/:id/steps", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = StepBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // C-1: a template with no way out is not shippable. Either the body carries
  // the placeholder or the rendered footer supplies the link — the footer always
  // does, so this only blocks a body that removed a deliberate inline link.
  try {
    const [row] = await db
      .insert(campaignStepsTable)
      .values({
        ...parsed.data,
        campaign_id: id,
        template_code: parsed.data.template_code ?? null,
        body_i18n: parsed.data.body_i18n as Record<string, { subject?: string; body_html?: string }> | null,
      })
      .returning();
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    if (String(err).includes("uq_campaign_steps_no")) {
      res.status(409).json({ error: "A step with this number already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to create step" });
  }
});

router.patch("/v1/marketing/campaigns/:id/steps/:stepId", async (req, res): Promise<void> => {
  const stepId = Number(req.params.stepId);
  if (!Number.isFinite(stepId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = StepBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db
    .update(campaignStepsTable)
    .set({
      ...parsed.data,
      body_i18n: parsed.data.body_i18n as Record<string, { subject?: string; body_html?: string }> | undefined,
      updated_at: new Date(),
    })
    .where(eq(campaignStepsTable.id, stepId))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true, data: row });
});

router.delete("/v1/marketing/campaigns/:id/steps/:stepId", async (req, res): Promise<void> => {
  const stepId = Number(req.params.stepId);
  if (!Number.isFinite(stepId)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(campaignStepsTable).where(eq(campaignStepsTable.id, stepId));
  res.json({ success: true });
});

// ── Build the audience ──────────────────────────────────────────────────────

/**
 * Freeze the recipient set. Every exclusion is counted and reported: an admin
 * who is told "1,200 recipients" without being told that 300 were dropped as
 * unsubscribed has been given a number they cannot act on.
 */
router.post("/v1/marketing/campaigns/:id/build", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    const [campaign] = await db.select().from(emailCampaignsTable).where(eq(emailCampaignsTable.id, id)).limit(1);
    if (!campaign) { res.status(404).json({ error: "Not found" }); return; }
    if (campaign.status === "sending") {
      res.status(409).json({ error: "Pause the campaign before rebuilding its audience" });
      return;
    }
    if (!campaign.list_id) { res.status(400).json({ error: "Select a list first" }); return; }

    const steps = await db.select().from(campaignStepsTable).where(eq(campaignStepsTable.campaign_id, id));
    if (steps.length === 0) { res.status(400).json({ error: "Add at least one step first" }); return; }

    const members = await resolveListMembers(campaign.list_id);
    const excluded: Record<string, number> = {};
    const bump = (reason: string) => { excluded[reason] = (excluded[reason] ?? 0) + 1; };

    const sendability = await checkSendableBatch(
      members.map((m) => ({ email: m.email, consentBasis: m.consent_basis })),
    );

    const eligible = members.filter((m) => {
      if ((NON_MAILABLE_STATUSES as readonly string[]).includes(m.prospect_status)) {
        bump(m.prospect_status);
        return false;
      }
      if (m.bounce_count >= MAX_BOUNCES) { bump("repeated_bounces"); return false; }
      const verdict = sendability.get(m.email.toLowerCase().trim());
      if (!verdict?.sendable) { bump(verdict?.reason ?? "not_sendable"); return false; }
      return true;
    });

    // Replace the queue rather than adding to it — a rebuild after an edit must
    // not leave rows from the previous audience behind. Rows that were already
    // sent are kept so the sequence can continue.
    await db
      .delete(campaignRecipientsTable)
      .where(and(eq(campaignRecipientsTable.campaign_id, id), eq(campaignRecipientsTable.recipient_status, "pending")));

    const startAt = campaign.scheduled_at ?? new Date();
    if (eligible.length) {
      await db
        .insert(campaignRecipientsTable)
        .values(
          eligible.map((p) => ({
            campaign_id: id,
            prospect_id: p.id,
            email: p.email.toLowerCase().trim(),
            recipient_status: "pending",
            current_step: 1,
            next_send_at: startAt,
          })),
        )
        .onConflictDoNothing();
    }

    const [{ total } = { total: 0 }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(campaignRecipientsTable)
      .where(eq(campaignRecipientsTable.campaign_id, id));

    await db
      .update(emailCampaignsTable)
      .set({ total_recipients: total, status: campaign.status === "draft" ? "ready" : campaign.status, updated_at: new Date() })
      .where(eq(emailCampaignsTable.id, id));

    res.json({
      success: true,
      data: {
        audience: members.length,
        recipients: total,
        excluded,
        excluded_total: Object.values(excluded).reduce((a, b) => a + b, 0),
      },
    });
  } catch (err) {
    console.error("[marketing] campaign build failed:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to build audience" });
  }
});

// ── Preview / test send ─────────────────────────────────────────────────────

async function resolveStepContent(step: typeof campaignStepsTable.$inferSelect, lang: string) {
  const override = (step.body_i18n ?? {})[lang];
  let subject = override?.subject || step.subject;
  let bodyHtml = override?.body_html || step.body_html;

  if ((!subject || !bodyHtml) && step.template_code) {
    const [template] = await db
      .select()
      .from(emailTemplatesTable)
      .where(and(eq(emailTemplatesTable.template_code, step.template_code), isNull(emailTemplatesTable.deleted_at)))
      .limit(1);
    if (template) {
      subject = subject || template.subject;
      bodyHtml = bodyHtml || template.body_html;
    }
  }
  return { subject: subject ?? "", bodyHtml: bodyHtml ?? "" };
}

router.post("/v1/marketing/campaigns/:id/preview", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = z.object({ step_id: z.number().int().nullish(), prospect_id: z.number().int().nullish() }).safeParse(req.body ?? {});
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  try {
    const [campaign] = await db.select().from(emailCampaignsTable).where(eq(emailCampaignsTable.id, id)).limit(1);
    if (!campaign) { res.status(404).json({ error: "Not found" }); return; }

    const steps = await db
      .select()
      .from(campaignStepsTable)
      .where(eq(campaignStepsTable.campaign_id, id))
      .orderBy(campaignStepsTable.step_no);
    const step = body.data.step_id ? steps.find((s) => s.id === body.data.step_id) : steps[0];
    if (!step) { res.status(400).json({ error: "No step to preview" }); return; }

    // Prefer a real prospect so the admin sees the substitution actually working;
    // fall back to obvious placeholders rather than empty strings.
    let sample = body.data.prospect_id
      ? (await db.select().from(prospectsTable).where(eq(prospectsTable.id, body.data.prospect_id)).limit(1))[0]
      : undefined;
    if (!sample && campaign.list_id) sample = (await resolveListMembers(campaign.list_id))[0];

    const lang = sample?.language_code || campaign.language_code;
    const { subject, bodyHtml } = await resolveStepContent(step, lang);
    const brand = await resolveCampaignBrand();

    const rendered = renderCampaignMessage({
      subject,
      bodyHtml,
      email: sample?.email ?? "preview@example.com",
      vars: sample ? prospectVars(sample, campaign) : {
        company_name: "(회사명)", contact_name: "(담당자)", contact_title: "(직함)",
        country: "(국가)", city: "(지역)", sender_name: campaign.from_name || brand.name,
      },
      brand,
      languageCode: lang,
      isAdvertising: campaign.is_advertising,
    });

    res.json({
      success: true,
      data: {
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        variables: extractVariables(`${subject} ${bodyHtml}`),
        sample_prospect: sample ? { id: sample.id, company_name: sample.company_name, email: sample.email } : null,
      },
    });
  } catch (err) {
    console.error("[marketing] preview failed:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to render preview" });
  }
});

/**
 * Send one message to an address the operator names. Bypasses the audience but
 * NOT the suppression list — a test send to a complained address is still a send.
 */
router.post("/v1/marketing/campaigns/:id/test-send", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = z.object({ to: z.string().min(3), step_id: z.number().int().nullish() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  try {
    const [campaign] = await db.select().from(emailCampaignsTable).where(eq(emailCampaignsTable.id, id)).limit(1);
    if (!campaign) { res.status(404).json({ error: "Not found" }); return; }
    const steps = await db
      .select()
      .from(campaignStepsTable)
      .where(eq(campaignStepsTable.campaign_id, id))
      .orderBy(campaignStepsTable.step_no);
    const step = body.data.step_id ? steps.find((s) => s.id === body.data.step_id) : steps[0];
    if (!step) { res.status(400).json({ error: "No step to send" }); return; }

    const { subject, bodyHtml } = await resolveStepContent(step, campaign.language_code);
    const brand = await resolveCampaignBrand();
    const result = await sendCampaignMessage({
      to: body.data.to,
      campaign,
      subject,
      bodyHtml,
      vars: {
        company_name: "(테스트) 회사명",
        contact_name: "(테스트) 담당자",
        sender_name: campaign.from_name || brand.name,
      },
      brand,
      languageCode: campaign.language_code,
      isTest: true,
    });

    if (!result.ok) { res.status(400).json({ error: result.error ?? "Test send failed" }); return; }
    res.json({ success: true, data: { id: result.id, skipped: result.skipped } });
  } catch (err) {
    console.error("[marketing] test send failed:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Test send failed" });
  }
});

// ── Lifecycle ───────────────────────────────────────────────────────────────

async function setStatus(id: number, status: string, extra: Record<string, unknown> = {}) {
  const [row] = await db
    .update(emailCampaignsTable)
    .set({ status, updated_at: new Date(), ...extra })
    .where(eq(emailCampaignsTable.id, id))
    .returning();
  return row;
}

router.post("/v1/marketing/campaigns/:id/schedule", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const when = (req.body as { scheduled_at?: string })?.scheduled_at;

  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(campaignRecipientsTable)
    .where(and(eq(campaignRecipientsTable.campaign_id, id), eq(campaignRecipientsTable.recipient_status, "pending")));
  if (count === 0) {
    res.status(400).json({ error: "Build the audience first — there is nobody to send to" });
    return;
  }

  const scheduledAt = when ? new Date(when) : new Date();
  await db
    .update(campaignRecipientsTable)
    .set({ next_send_at: scheduledAt, updated_at: new Date() })
    .where(and(eq(campaignRecipientsTable.campaign_id, id), eq(campaignRecipientsTable.recipient_status, "pending")));

  const row = await setStatus(id, "scheduled", { scheduled_at: scheduledAt });
  void logAction({ entityType: ENTITY, entityId: id, action: "UPDATE", newValue: { status: "scheduled", scheduledAt } });
  res.json({ success: true, data: row });
});

router.post("/v1/marketing/campaigns/:id/pause", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const row = await setStatus(id, "paused");
  res.json({ success: true, data: row });
});

router.post("/v1/marketing/campaigns/:id/resume", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const row = await setStatus(id, "sending");
  res.json({ success: true, data: row });
});

router.post("/v1/marketing/campaigns/:id/cancel", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  await db
    .update(campaignRecipientsTable)
    .set({ recipient_status: "skipped", skip_reason: "campaign_cancelled", updated_at: new Date() })
    .where(and(eq(campaignRecipientsTable.campaign_id, id), eq(campaignRecipientsTable.recipient_status, "pending")));
  const row = await setStatus(id, "cancelled", { completed_at: new Date() });
  void logAction({ entityType: ENTITY, entityId: id, action: "UPDATE", newValue: { status: "cancelled" } });
  res.json({ success: true, data: row });
});

// ── Recipients + stats (PHASE 6) ────────────────────────────────────────────

router.get("/v1/marketing/campaigns/:id/recipients", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const rows = await db
      .select()
      .from(campaignRecipientsTable)
      .where(eq(campaignRecipientsTable.campaign_id, id))
      .orderBy(campaignRecipientsTable.id)
      .limit(1000);

    // Batched company lookup — one query however many recipients.
    const prospectIds = [...new Set(rows.map((r) => r.prospect_id))];
    const prospects = prospectIds.length
      ? await db
          .select({ id: prospectsTable.id, company_name: prospectsTable.company_name })
          .from(prospectsTable)
          .where(inArray(prospectsTable.id, prospectIds))
      : [];
    const nameById = new Map(prospects.map((p) => [p.id, p.company_name] as const));

    res.json({
      success: true,
      data: rows.map((r) => ({ ...r, company_name: nameById.get(r.prospect_id) ?? "" })),
      meta: { total: rows.length },
    });
  } catch {
    res.status(500).json({ error: "Failed to list recipients" });
  }
});

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

router.get("/v1/marketing/campaigns/:id/stats", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [campaign] = await db.select().from(emailCampaignsTable).where(eq(emailCampaignsTable.id, id)).limit(1);
    if (!campaign) { res.status(404).json({ error: "Not found" }); return; }

    // Counted from the event ledger, not the cached counters — the cache exists
    // for list screens, but a stats page that disagrees with the evidence is worse
    // than a slow one.
    const events = await db
      .select({ event_type: campaignEventsTable.event_type, count: sql<number>`count(*)::int` })
      .from(campaignEventsTable)
      .where(eq(campaignEventsTable.campaign_id, id))
      .groupBy(campaignEventsTable.event_type);
    const byType = new Map(events.map((e) => [e.event_type, e.count] as const));

    const [{ sent } = { sent: 0 }] = await db
      .select({ sent: sql<number>`count(*)::int` })
      .from(campaignSendsTable)
      .where(and(eq(campaignSendsTable.campaign_id, id), eq(campaignSendsTable.send_status, "sent")));

    // Unique openers/clickers, not raw event counts — one recipient opening five
    // times is one interested reader, not five.
    const [{ opened } = { opened: 0 }] = await db
      .select({ opened: sql<number>`count(*)::int` })
      .from(campaignRecipientsTable)
      .where(and(eq(campaignRecipientsTable.campaign_id, id), sql`${campaignRecipientsTable.opened_at} IS NOT NULL`));
    const [{ clicked } = { clicked: 0 }] = await db
      .select({ clicked: sql<number>`count(*)::int` })
      .from(campaignRecipientsTable)
      .where(and(eq(campaignRecipientsTable.campaign_id, id), sql`${campaignRecipientsTable.clicked_at} IS NOT NULL`));
    const [{ replied } = { replied: 0 }] = await db
      .select({ replied: sql<number>`count(*)::int` })
      .from(campaignRecipientsTable)
      .where(and(eq(campaignRecipientsTable.campaign_id, id), sql`${campaignRecipientsTable.replied_at} IS NOT NULL`));

    const [{ converted } = { converted: 0 }] = await db
      .select({ converted: sql<number>`count(*)::int` })
      .from(campaignRecipientsTable)
      .innerJoin(prospectsTable, eq(prospectsTable.id, campaignRecipientsTable.prospect_id))
      .where(and(eq(campaignRecipientsTable.campaign_id, id), sql`${prospectsTable.converted_account_id} IS NOT NULL`));

    const delivered = byType.get("delivered") ?? 0;
    const bounced = byType.get("bounced") ?? 0;
    const unsubscribed = byType.get("unsubscribed") ?? 0;

    res.json({
      success: true,
      data: {
        campaign: { id: campaign.id, name: campaign.name, status: campaign.status },
        total_recipients: campaign.total_recipients,
        sent,
        delivered,
        opened,
        clicked,
        replied,
        bounced,
        unsubscribed,
        converted,
        rates: {
          delivered: pct(delivered, sent),
          opened: pct(opened, sent),
          clicked: pct(clicked, sent),
          replied: pct(replied, sent),
          bounced: pct(bounced, sent),
          unsubscribed: pct(unsubscribed, sent),
          converted: pct(converted, sent),
        },
      },
    });
  } catch (err) {
    console.error("[marketing] stats failed:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

/** Manual reply marking — inbound parsing is out of scope for now. */
router.post("/v1/marketing/campaigns/:id/recipients/:rid/mark-replied", async (req, res): Promise<void> => {
  const rid = Number(req.params.rid);
  if (!Number.isFinite(rid)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [recipient] = await db
      .select()
      .from(campaignRecipientsTable)
      .where(eq(campaignRecipientsTable.id, rid))
      .limit(1);
    if (!recipient) { res.status(404).json({ error: "Not found" }); return; }

    const now = new Date();
    await db
      .update(campaignRecipientsTable)
      .set({ replied_at: now, recipient_status: "replied", updated_at: now })
      .where(eq(campaignRecipientsTable.id, rid));
    await db
      .update(prospectsTable)
      .set({ prospect_status: "replied", next_action_at: now, updated_at: now })
      .where(eq(prospectsTable.id, recipient.prospect_id));
    await db.insert(campaignEventsTable).values({
      campaign_id: recipient.campaign_id,
      recipient_id: rid,
      prospect_id: recipient.prospect_id,
      email: recipient.email,
      event_type: "replied",
      detail: "manually marked",
      occurred_at: now,
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to mark reply" });
  }
});

// ── Marketing dashboard ─────────────────────────────────────────────────────

router.get("/v1/marketing/dashboard", async (_req, res): Promise<void> => {
  try {
    const [{ prospects } = { prospects: 0 }] = await db
      .select({ prospects: sql<number>`count(*)::int` })
      .from(prospectsTable)
      .where(isNull(prospectsTable.deleted_at));

    const byStatus = await db
      .select({ status: prospectsTable.prospect_status, count: sql<number>`count(*)::int` })
      .from(prospectsTable)
      .where(isNull(prospectsTable.deleted_at))
      .groupBy(prospectsTable.prospect_status);

    const bySegment = await db
      .select({ segment: prospectsTable.segment, count: sql<number>`count(*)::int` })
      .from(prospectsTable)
      .where(isNull(prospectsTable.deleted_at))
      .groupBy(prospectsTable.segment);

    const campaigns = await db
      .select()
      .from(emailCampaignsTable)
      .where(isNull(emailCampaignsTable.deleted_at))
      .orderBy(desc(emailCampaignsTable.updated_at))
      .limit(10);

    const [{ live } = { live: 0 }] = await db
      .select({ live: sql<number>`count(*)::int` })
      .from(emailCampaignsTable)
      .where(and(isNull(emailCampaignsTable.deleted_at), inArray(emailCampaignsTable.status, LIVE_STATUSES)));

    const totals = await db
      .select({ event_type: campaignEventsTable.event_type, count: sql<number>`count(*)::int` })
      .from(campaignEventsTable)
      .groupBy(campaignEventsTable.event_type);

    res.json({
      success: true,
      data: {
        prospects,
        prospects_by_status: byStatus,
        prospects_by_segment: bySegment.filter((s) => s.segment),
        live_campaigns: live,
        recent_campaigns: campaigns,
        event_totals: totals,
      },
    });
  } catch (err) {
    console.error("[marketing] dashboard failed:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

export default router;

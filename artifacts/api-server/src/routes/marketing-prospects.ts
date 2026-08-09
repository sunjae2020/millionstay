/**
 * Prospects — cold partner-development ledger.
 *
 * Namespaced under /v1/marketing/* so the module can later move out of this
 * service without breaking callers. See docs/proposals/MARKETING_CAMPAIGN_MODULE.md.
 */
import { Router, type IRouter } from "express";
import multer from "multer";
import { and, desc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  prospectsTable,
  accountsTable,
  contactsTable,
  tasksTable,
  campaignEventsTable,
  campaignRecipientsTable,
  emailCampaignsTable,
  prospectListMembersTable,
} from "@workspace/db";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import { keywordCondition } from "../lib/listSearch";
import { logAction } from "../utils/auditLog";
import { formatFirstName, formatLastName } from "../lib/nameFormat";
import { parseCsv, suggestColumnMapping } from "../lib/marketing/csv";
import { checkSendableBatch, isValidEmail } from "../lib/marketing/consent";

const router: IRouter = Router();
const ENTITY = "prospect";

const CONSENT_BASES = ["express", "inferred_b2b", "existing", "none"] as const;

const ProspectBody = z.object({
  company_name: z.string().min(1),
  email: z.string().min(3),
  contact_name: z.string().default(""),
  contact_title: z.string().default(""),
  phone: z.string().default(""),
  website: z.string().default(""),
  segment: z.string().default(""),
  country: z.string().default(""),
  city: z.string().default(""),
  source: z.string().default("manual"),
  source_detail: z.string().default(""),
  prospect_status: z.string().default("new"),
  qualification_score: z.number().int().default(0),
  owner_user_id: z.number().int().nullish(),
  language_code: z.string().default("ko"),
  consent_basis: z.enum(CONSENT_BASES).default("none"),
  consent_evidence: z.string().default(""),
  notes: z.string().default(""),
  attributes: z.record(z.string(), z.string()).default({}),
});

/** A ground for contact is only meaningful with evidence recorded alongside it. */
function consentEvidenceMissing(basis: string, evidence: string): boolean {
  return basis !== "none" && evidence.trim() === "";
}

// ── List ────────────────────────────────────────────────────────────────────

router.get("/v1/marketing/prospects", async (req, res): Promise<void> => {
  const { search, segment, prospect_status, country, owner_user_id, list_id, source } =
    req.query as Record<string, string | undefined>;

  const conditions: SQL[] = [deletedFilter(prospectsTable.deleted_at, req)];
  if (segment) conditions.push(eq(prospectsTable.segment, segment));
  if (prospect_status) conditions.push(eq(prospectsTable.prospect_status, prospect_status));
  if (country) conditions.push(eq(prospectsTable.country, country));
  if (owner_user_id) conditions.push(eq(prospectsTable.owner_user_id, Number(owner_user_id)));
  if (source) conditions.push(eq(prospectsTable.source, source));

  // Attribute filters arrive as `attr.<key>=<value>` so the list screen can reuse
  // whatever facets the segment builder discovered, without this route knowing
  // any key by name.
  for (const [param, value] of Object.entries(req.query as Record<string, unknown>)) {
    if (!param.startsWith("attr.") || typeof value !== "string" || value === "") continue;
    const key = param.slice("attr.".length);
    if (!key) continue;
    conditions.push(sql`lower(${prospectsTable.attributes} ->> ${key}) = lower(${value})`);
  }
  if (list_id) {
    const memberIds = (
      await db
        .select({ id: prospectListMembersTable.prospect_id })
        .from(prospectListMembersTable)
        .where(eq(prospectListMembersTable.list_id, Number(list_id)))
    ).map((r) => r.id);
    // An empty list must yield no rows rather than every row.
    conditions.push(memberIds.length ? inArray(prospectsTable.id, memberIds) : sql`false`);
  }
  if (search) {
    conditions.push(
      keywordCondition(search, [
        prospectsTable.company_name,
        prospectsTable.email,
        prospectsTable.contact_name,
        prospectsTable.contact_title,
        prospectsTable.phone,
        prospectsTable.website,
        prospectsTable.notes,
      ]),
    );
  }

  try {
    const rows = await db
      .select()
      .from(prospectsTable)
      .where(and(...conditions))
      .orderBy(desc(prospectsTable.updated_at));
    res.json({ success: true, data: rows, meta: { total: rows.length } });
  } catch {
    res.status(500).json({ error: "Failed to list prospects" });
  }
});

// ── Create ──────────────────────────────────────────────────────────────────

router.post("/v1/marketing/prospects", async (req, res): Promise<void> => {
  const parsed = ProspectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const b = parsed.data;
  if (!isValidEmail(b.email)) { res.status(400).json({ error: "Invalid email address" }); return; }
  if (consentEvidenceMissing(b.consent_basis, b.consent_evidence)) {
    res.status(400).json({ error: "consent_evidence is required when a consent basis is claimed" });
    return;
  }

  try {
    const [row] = await db
      .insert(prospectsTable)
      .values({
        ...b,
        email: b.email.toLowerCase().trim(),
        owner_user_id: b.owner_user_id ?? null,
        consent_recorded_at: b.consent_basis === "none" ? null : new Date(),
      })
      .returning();
    void logAction({ entityType: ENTITY, entityId: row!.id, action: "CREATE", newValue: { company_name: b.company_name } });
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    // The live-email unique index is the only constraint that can realistically fire.
    if (String(err).includes("uq_prospects_email_live")) {
      res.status(409).json({ error: "A prospect with this email already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to create prospect" });
  }
});

// ── Discovery: sources & facets ─────────────────────────────────────────────
//
// These MUST stay above `/prospects/:id` — Express matches in order and would
// otherwise read "sources" as an id.

/**
 * The source labels that actually exist, derived from the data.
 *
 * Deliberately not an enum: every new import batch invents its own label
 * ("2026 여수 박람회", "중개사협회 명부") and a hard-coded list would go stale the
 * first time someone imports a file without touching the code.
 */
router.get("/v1/marketing/prospects/sources", async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select({ source: prospectsTable.source, count: sql<number>`count(*)::int` })
      .from(prospectsTable)
      .where(and(isNull(prospectsTable.deleted_at), sql`${prospectsTable.source} <> ''`))
      .groupBy(prospectsTable.source)
      .orderBy(prospectsTable.source);
    res.json({ success: true, data: rows });
  } catch {
    res.status(500).json({ error: "Failed to list sources" });
  }
});

/**
 * Which attribute keys can sensibly become a dropdown, and their values.
 *
 * `attributes` is unfolded with jsonb_each_text and scoped to one source, then
 * gated on cardinality: a key with more distinct values than the limit is not a
 * category, it is free text or a number (면적, 거리, 주소, 메모). Those would
 * produce a thousand-item dropdown, so they are dropped here and left to text or
 * range filters. This gate is what makes the builder usable without anyone
 * curating a list of "filterable" keys.
 */
const FACET_VALUE_LIMIT = 40;

router.get("/v1/marketing/prospects/facets", async (req, res): Promise<void> => {
  const source = String((req.query.source as string | undefined) ?? "").trim();
  try {
    const rows = await db.execute(sql`
      SELECT kv.key AS key,
             array_agg(DISTINCT kv.value ORDER BY kv.value) AS values,
             count(DISTINCT kv.value)::int AS value_count
      FROM prospects p, jsonb_each_text(p.attributes) AS kv
      WHERE p.deleted_at IS NULL
        AND kv.value <> ''
        AND (${source === "" ? null : source}::text IS NULL OR p.source = ${source === "" ? null : source})
      GROUP BY kv.key
      HAVING count(DISTINCT kv.value) <= ${FACET_VALUE_LIMIT}
      ORDER BY kv.key
    `);

    const facets = (rows as unknown as { rows?: unknown[] }).rows ?? (rows as unknown as unknown[]);
    res.json({
      success: true,
      data: (facets as Array<{ key: string; values: string[]; value_count: number }>).map((f) => ({
        key: f.key,
        values: f.values ?? [],
        value_count: f.value_count,
      })),
    });
  } catch (err) {
    console.error("[marketing] facet discovery failed:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load facets" });
  }
});

// ── Detail (+ campaign timeline) ────────────────────────────────────────────

router.get("/v1/marketing/prospects/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [row] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id)).limit(1);
    if (!row) { res.status(404).json({ error: "Not found" }); return; }

    const events = await db
      .select()
      .from(campaignEventsTable)
      .where(eq(campaignEventsTable.prospect_id, id))
      .orderBy(desc(campaignEventsTable.occurred_at))
      .limit(200);

    // Batched, not per-event: a busy prospect can carry hundreds of events and a
    // lookup each would turn this detail page into an N+1.
    const campaignIds = [...new Set(events.map((e) => e.campaign_id).filter((v): v is number => v != null))];
    const campaigns = campaignIds.length
      ? await db
          .select({ id: emailCampaignsTable.id, name: emailCampaignsTable.name })
          .from(emailCampaignsTable)
          .where(inArray(emailCampaignsTable.id, campaignIds))
      : [];
    const campaignName = new Map(campaigns.map((c) => [c.id, c.name] as const));

    res.json({
      success: true,
      data: {
        ...row,
        timeline: events.map((e) => ({
          id: e.id,
          event_type: e.event_type,
          detail: e.detail,
          occurred_at: e.occurred_at,
          campaign_id: e.campaign_id,
          campaign_name: e.campaign_id != null ? campaignName.get(e.campaign_id) ?? null : null,
        })),
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to load prospect" });
  }
});

// ── Update ──────────────────────────────────────────────────────────────────

router.patch("/v1/marketing/prospects/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = ProspectBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const b = parsed.data;
  if (b.email !== undefined && !isValidEmail(b.email)) {
    res.status(400).json({ error: "Invalid email address" }); return;
  }

  try {
    const [existing] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

    const basis = b.consent_basis ?? existing.consent_basis;
    const evidence = b.consent_evidence ?? existing.consent_evidence;
    if (consentEvidenceMissing(basis, evidence)) {
      res.status(400).json({ error: "consent_evidence is required when a consent basis is claimed" });
      return;
    }

    const patch: Record<string, unknown> = { ...b, updated_at: new Date() };
    if (b.email !== undefined) patch.email = b.email.toLowerCase().trim();
    if (b.consent_basis !== undefined && b.consent_basis !== existing.consent_basis) {
      patch.consent_recorded_at = b.consent_basis === "none" ? null : new Date();
    }

    const [row] = await db.update(prospectsTable).set(patch).where(eq(prospectsTable.id, id)).returning();
    void logAction({ entityType: ENTITY, entityId: id, action: "UPDATE", newValue: b });
    res.json({ success: true, data: row });
  } catch {
    res.status(500).json({ error: "Failed to update prospect" });
  }
});

// ── Bulk / delete ───────────────────────────────────────────────────────────

const prospectsSoftDelete = {
  table: prospectsTable,
  idColumn: prospectsTable.id,
  statusKey: "status",
  archivedStatus: "Archived",
  restoredStatus: "Active",
  // Membership rows are meaningless without the prospect; campaign_events are
  // deliberately NOT purged — the event ledger is append-only evidence.
  onPurge: async (ids: number[]) => {
    await db.delete(prospectListMembersTable).where(inArray(prospectListMembersTable.prospect_id, ids));
    await db.delete(campaignRecipientsTable).where(inArray(campaignRecipientsTable.prospect_id, ids));
  },
};

router.post("/v1/marketing/prospects/bulk-delete", makeBulkDelete(prospectsSoftDelete));
router.post("/v1/marketing/prospects/bulk-restore", makeBulkRestore(prospectsSoftDelete));

router.delete("/v1/marketing/prospects/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db
    .update(prospectsTable)
    .set({ deleted_at: new Date(), status: "Archived", updated_at: new Date() })
    .where(eq(prospectsTable.id, id));
  void logAction({ entityType: ENTITY, entityId: id, action: "DELETE" });
  res.json({ success: true });
});

// ── Assignment / disqualification ───────────────────────────────────────────

router.post("/v1/marketing/prospects/bulk-assign", async (req, res): Promise<void> => {
  const body = z
    .object({ ids: z.array(z.number().int()).min(1), owner_user_id: z.number().int().nullable() })
    .safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  await db
    .update(prospectsTable)
    .set({ owner_user_id: body.data.owner_user_id, updated_at: new Date() })
    .where(inArray(prospectsTable.id, body.data.ids));
  res.json({ success: true, affected: body.data.ids.length });
});

router.post("/v1/marketing/prospects/:id/disqualify", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const reason = String((req.body as { reason?: string })?.reason ?? "").trim();
  const [row] = await db
    .update(prospectsTable)
    .set({ prospect_status: "disqualified", disqualified_reason: reason, updated_at: new Date() })
    .where(eq(prospectsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  void logAction({ entityType: ENTITY, entityId: id, action: "UPDATE", newValue: { prospect_status: "disqualified", reason } });
  res.json({ success: true, data: row });
});

// ── CSV import ──────────────────────────────────────────────────────────────

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

interface PreviewRow {
  row_no: number;
  company_name: string;
  email: string;
  contact_name: string;
  contact_title: string;
  phone: string;
  website: string;
  segment: string;
  country: string;
  city: string;
  notes: string;
  /** 'new' | 'duplicate' | 'existing_account' | 'suppressed' | 'error' */
  verdict: string;
  message: string;
  /** Columns the mapping did not claim, kept as source-specific attributes. */
  attributes: Record<string, string>;
}

/**
 * Split a CSV row into known prospect fields and everything else.
 *
 * The leftovers are the point, not waste: a 여수 관리대장 export carries 담당구역
 * and 취급물건, a 박람회 명단 carries 부스번호 and 협회. Dropping them would make
 * the whole facet mechanism moot, because there would be nothing to facet on.
 * Keys are normalised so `취급 물건` and `취급물건` do not become two facets.
 */
function normaliseAttrKey(header: string): string {
  return header.trim().replace(/\s+/g, "_").replace(/[."$]/g, "").slice(0, 60);
}

function applyMapping(
  raw: Record<string, string>,
  mapping: Record<string, string>,
): { fields: Record<string, string>; attributes: Record<string, string> } {
  const fields: Record<string, string> = {};
  const attributes: Record<string, string> = {};
  for (const [header, value] of Object.entries(raw)) {
    const field = mapping[header];
    if (field) {
      fields[field] = value ?? "";
      continue;
    }
    const key = normaliseAttrKey(header);
    const v = (value ?? "").trim();
    if (key && v) attributes[key] = v;
  }
  return { fields, attributes };
}

/**
 * Parse + classify without writing anything. Every row lands in exactly one
 * verdict so the totals shown to the admin add up to the file's row count.
 */
async function buildPreview(csvText: string, mappingOverride?: Record<string, string>) {
  const { headers, rows } = parseCsv(csvText);
  const mapping = mappingOverride && Object.keys(mappingOverride).length
    ? mappingOverride
    : suggestColumnMapping(headers);

  const mapped = rows.map((r) => applyMapping(r, mapping));
  const emails = mapped.map((m) => (m.fields.email ?? "").toLowerCase().trim()).filter(Boolean);

  // Three batched lookups, whatever the file size.
  const existingProspects = emails.length
    ? new Set(
        (
          await db
            .select({ email: prospectsTable.email })
            .from(prospectsTable)
            .where(and(inArray(sql`lower(${prospectsTable.email})`, emails), isNull(prospectsTable.deleted_at)))
        ).map((r) => r.email.toLowerCase()),
      )
    : new Set<string>();

  // Already a customer/partner — mailing them a cold pitch is the embarrassing
  // failure mode this check exists to prevent.
  const existingContacts = emails.length
    ? new Set(
        (
          await db
            .select({ email: contactsTable.email })
            .from(contactsTable)
            .where(and(inArray(sql`lower(${contactsTable.email})`, emails), isNull(contactsTable.deleted_at)))
        )
          .map((r) => (r.email ?? "").toLowerCase())
          .filter(Boolean),
      )
    : new Set<string>();

  const sendability = await checkSendableBatch(emails.map((e) => ({ email: e, consentBasis: "none" })));

  // An address repeated inside the file is as much a duplicate as one already in
  // the table — without this the second copy would hit the unique index at commit
  // and roll the whole import back.
  const seenInFile = new Set<string>();

  const preview: PreviewRow[] = mapped.map((m, idx) => {
    const f = m.fields;
    const email = (f.email ?? "").toLowerCase().trim();
    const base: PreviewRow = {
      row_no: idx + 2, // 1-based, and row 1 is the header
      company_name: f.company_name ?? "",
      email,
      contact_name: f.contact_name ?? "",
      contact_title: f.contact_title ?? "",
      phone: f.phone ?? "",
      website: f.website ?? "",
      segment: f.segment ?? "",
      country: f.country ?? "",
      city: f.city ?? "",
      notes: f.notes ?? "",
      verdict: "new",
      message: "",
      attributes: m.attributes,
    };

    if (!base.company_name) return { ...base, verdict: "error", message: "company_name is required" };
    if (!email) return { ...base, verdict: "error", message: "email is required" };
    if (!isValidEmail(email)) return { ...base, verdict: "error", message: "Invalid email format" };
    if (seenInFile.has(email)) return { ...base, verdict: "duplicate", message: "Repeated earlier in this file" };
    seenInFile.add(email);
    if (existingProspects.has(email)) return { ...base, verdict: "duplicate", message: "Already in prospects" };
    if (existingContacts.has(email)) return { ...base, verdict: "existing_account", message: "Already a contact — cold outreach would go to an existing relationship" };
    if (sendability.get(email)?.reason === "suppressed") return { ...base, verdict: "suppressed", message: "On the suppression list (bounce/complaint)" };
    if (sendability.get(email)?.reason === "unsubscribed") return { ...base, verdict: "suppressed", message: "Previously unsubscribed" };
    return base;
  });

  const counts = preview.reduce<Record<string, number>>((acc, r) => {
    acc[r.verdict] = (acc[r.verdict] ?? 0) + 1;
    return acc;
  }, {});

  // Show the operator which columns are being kept as attributes — otherwise the
  // mapping screen looks like those columns are simply being discarded.
  const attributeKeys = [...new Set(preview.flatMap((r) => Object.keys(r.attributes)))].sort();

  return { headers, mapping, rows: preview, counts, total: preview.length, attribute_keys: attributeKeys };
}

router.post("/v1/marketing/prospects/import/preview", upload.single("file"), async (req, res): Promise<void> => {
  const file = (req as unknown as { file?: { buffer: Buffer } }).file;
  const inlineCsv = (req.body as { csv?: string })?.csv;
  const text = file ? file.buffer.toString("utf8") : typeof inlineCsv === "string" ? inlineCsv : "";
  if (!text.trim()) { res.status(400).json({ error: "No CSV content provided" }); return; }

  let mappingOverride: Record<string, string> | undefined;
  const rawMapping = (req.body as { mapping?: string | Record<string, string> })?.mapping;
  if (typeof rawMapping === "string") { try { mappingOverride = JSON.parse(rawMapping); } catch { /* fall back to auto-detection */ } }
  else if (rawMapping && typeof rawMapping === "object") mappingOverride = rawMapping;

  try {
    res.json({ success: true, data: await buildPreview(text, mappingOverride) });
  } catch (err) {
    console.error("[marketing] prospect import preview failed:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to parse CSV" });
  }
});

router.post("/v1/marketing/prospects/import/commit", upload.single("file"), async (req, res): Promise<void> => {
  const file = (req as unknown as { file?: { buffer: Buffer } }).file;
  const body = req.body as {
    csv?: string;
    mapping?: string | Record<string, string>;
    source?: string;
    source_detail?: string;
    segment?: string;
    language_code?: string;
    consent_basis?: string;
    consent_evidence?: string;
    list_id?: string | number;
    /** What to do with rows already in prospects: 'skip' (default) or 'merge'. */
    duplicate_strategy?: string;
  };
  const text = file ? file.buffer.toString("utf8") : typeof body.csv === "string" ? body.csv : "";
  if (!text.trim()) { res.status(400).json({ error: "No CSV content provided" }); return; }

  const consentBasis = String(body.consent_basis ?? "none");
  const consentEvidence = String(body.consent_evidence ?? "");
  if (!CONSENT_BASES.includes(consentBasis as (typeof CONSENT_BASES)[number])) {
    res.status(400).json({ error: "Invalid consent_basis" }); return;
  }
  if (consentEvidenceMissing(consentBasis, consentEvidence)) {
    res.status(400).json({ error: "consent_evidence is required when a consent basis is claimed" });
    return;
  }

  let mappingOverride: Record<string, string> | undefined;
  if (typeof body.mapping === "string") { try { mappingOverride = JSON.parse(body.mapping); } catch { /* auto-detect */ } }
  else if (body.mapping && typeof body.mapping === "object") mappingOverride = body.mapping;

  const merge = String(body.duplicate_strategy ?? "skip") === "merge";
  const listId = body.list_id != null && body.list_id !== "" ? Number(body.list_id) : null;

  try {
    const preview = await buildPreview(text, mappingOverride);
    const importable = preview.rows.filter((r) => r.verdict !== "error");
    if (importable.length === 0) {
      res.status(400).json({ error: "No importable rows", data: { counts: preview.counts } });
      return;
    }

    const result = await db.transaction(async (tx) => {
      let inserted = 0;
      let merged = 0;
      let skipped = 0;
      const touchedIds: number[] = [];

      for (const row of importable) {
        // A row already on the suppression list is still worth holding as a
        // record — it just starts life unsendable rather than being dropped.
        const status = row.verdict === "suppressed" ? "unsubscribed" : "new";

        if (row.verdict === "duplicate") {
          if (!merge) { skipped++; continue; }
          const [updated] = await tx
            .update(prospectsTable)
            .set({
              company_name: row.company_name,
              contact_name: row.contact_name || sql`${prospectsTable.contact_name}`,
              contact_title: row.contact_title || sql`${prospectsTable.contact_title}`,
              phone: row.phone || sql`${prospectsTable.phone}`,
              website: row.website || sql`${prospectsTable.website}`,
              country: row.country || sql`${prospectsTable.country}`,
              city: row.city || sql`${prospectsTable.city}`,
              // Merge rather than replace: a second import of the same company
              // from a different source adds its attributes instead of erasing
              // what the first one contributed.
              attributes: sql`${prospectsTable.attributes} || ${JSON.stringify(row.attributes)}::jsonb`,
              updated_at: new Date(),
            })
            .where(sql`lower(${prospectsTable.email}) = ${row.email} AND ${prospectsTable.deleted_at} IS NULL`)
            .returning({ id: prospectsTable.id });
          if (updated) { merged++; touchedIds.push(updated.id); }
          continue;
        }

        const [created] = await tx
          .insert(prospectsTable)
          .values({
            company_name: row.company_name,
            email: row.email,
            contact_name: row.contact_name,
            contact_title: row.contact_title,
            phone: row.phone,
            website: row.website,
            segment: row.segment || String(body.segment ?? ""),
            country: row.country,
            city: row.city,
            notes: row.notes,
            attributes: row.attributes,
            source: String(body.source ?? "csv_import"),
            source_detail: String(body.source_detail ?? ""),
            language_code: String(body.language_code ?? "ko"),
            prospect_status: status,
            consent_basis: consentBasis,
            consent_evidence: consentEvidence,
            consent_recorded_at: consentBasis === "none" ? null : new Date(),
          })
          .returning({ id: prospectsTable.id });
        if (created) { inserted++; touchedIds.push(created.id); }
      }

      if (listId && touchedIds.length) {
        await tx
          .insert(prospectListMembersTable)
          .values(touchedIds.map((pid) => ({ list_id: listId, prospect_id: pid })))
          .onConflictDoNothing();
      }

      return { inserted, merged, skipped, touchedIds };
    });

    void logAction({
      entityType: ENTITY,
      entityId: 0,
      action: "CREATE",
      newValue: { import: true, inserted: result.inserted, merged: result.merged, skipped: result.skipped },
    });

    res.json({
      success: true,
      data: {
        inserted: result.inserted,
        merged: result.merged,
        skipped: result.skipped,
        errors: preview.counts.error ?? 0,
        total: preview.total,
      },
    });
  } catch (err) {
    console.error("[marketing] prospect import failed:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Import failed — no rows were written" });
  }
});

// ── Convert → Account + Contact ─────────────────────────────────────────────

/**
 * Split a free-text contact name into given/family parts.
 * CJK names are written family-name-first with no separator, so a 2–4 character
 * all-Hangul/Han string is split after the first character; anything else is
 * treated as western order ("Given Family").
 */
function splitContactName(input: string): { first_name: string; last_name: string } {
  const name = input.trim();
  if (!name) return { first_name: "", last_name: "" };
  const cjk = /^[ㄱ-ㆎ가-힣一-鿿]{2,4}$/.test(name);
  if (cjk) return { last_name: name.slice(0, 1), first_name: name.slice(1) };
  const parts = name.split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0]!, last_name: "" };
  return { first_name: parts.slice(0, -1).join(" "), last_name: parts[parts.length - 1]! };
}

router.post("/v1/marketing/prospects/:id/convert", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = z
    .object({
      account_type: z.string().min(1),
      account_name: z.string().optional(),
      create_task: z.boolean().default(true),
    })
    .safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  try {
    const [prospect] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id)).limit(1);
    if (!prospect) { res.status(404).json({ error: "Not found" }); return; }
    if (prospect.converted_account_id) {
      res.status(409).json({ error: "Already converted", data: { account_id: prospect.converted_account_id } });
      return;
    }

    const result = await db.transaction(async (tx) => {
      // Contact first: accounts point at contacts (accounts.primary_contact_id),
      // not the other way round — there is no contacts.account_id in this schema.
      const { first_name, last_name } = splitContactName(prospect.contact_name);
      const [contact] = await tx
        .insert(contactsTable)
        .values({
          first_name: formatFirstName(first_name || prospect.company_name),
          last_name: formatLastName(last_name),
          email: prospect.email,
          mobile_number: prospect.phone || null,
          company_name: prospect.company_name,
          job_title: prospect.contact_title || null,
          website: prospect.website || null,
          country: prospect.country || null,
          suburb: prospect.city || null,
          description: `Converted from prospect #${prospect.id}`,
        })
        .returning();

      const [account] = await tx
        .insert(accountsTable)
        .values({
          name: body.data.account_name?.trim() || prospect.company_name,
          account_type: body.data.account_type,
          primary_contact_id: contact!.id,
          account_email: prospect.email,
          website_url: prospect.website || null,
          phone1: prospect.phone || null,
          address_country: prospect.country || null,
          address_suburb: prospect.city || null,
          description: `Converted from prospect #${prospect.id}`,
        })
        .returning();

      await tx
        .update(prospectsTable)
        .set({
          prospect_status: "converted",
          converted_account_id: account!.id,
          converted_contact_id: contact!.id,
          converted_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(prospectsTable.id, id));

      if (body.data.create_task) {
        await tx.insert(tasksTable).values({
          name: `신규 거래처 온보딩 — ${account!.name}`,
          subject: "Partner onboarding",
          task_category: "Marketing",
          account_id: account!.id,
          primary_contact_id: contact!.id,
          description: `Prospect #${prospect.id} 전환. 첫 미팅 일정과 계약 조건을 확인하세요.`,
        });
      }

      return { account: account!, contact: contact! };
    });

    void logAction({
      entityType: ENTITY,
      entityId: id,
      action: "UPDATE",
      newValue: { converted: true, account_id: result.account.id, contact_id: result.contact.id },
    });
    res.json({ success: true, data: { account: result.account, contact: result.contact } });
  } catch (err) {
    console.error("[marketing] prospect convert failed:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Conversion failed — nothing was created" });
  }
});

export default router;

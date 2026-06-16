// Editable document/email/contract templates — admin CRUD for the Templates
// Studio. Single-tenant (no auto-fork): edits update the row in place.
// Mounted behind requireAuth by routes/index.ts.
import { Router, type IRouter } from "express";
import { Resend } from "resend";
import { and, asc, eq } from "drizzle-orm";
import { db, documentTemplatesTable, documentTemplateTranslationsTable } from "@workspace/db";
import { resolveTemplate, renderString, sampleVarsFromSchema } from "../lib/documents/templateEngine.js";
import { htmlToPdf, PdfUnavailableError } from "../lib/documents/pdf.js";
import { renderDocumentShell } from "../lib/documents/theme.js";
import { logAction } from "../utils/auditLog.js";

const router: IRouter = Router();
const FROM = process.env.EMAIL_FROM ?? "MillionStay <noreply@contact.millionstay.com>";

// GET /v1/document-templates?kind= — list with available locales.
router.get("/v1/document-templates", async (req, res): Promise<void> => {
  try {
    const { kind } = req.query as Record<string, string>;
    const templates = await db.select().from(documentTemplatesTable).orderBy(asc(documentTemplatesTable.category), asc(documentTemplatesTable.name));
    const filtered = kind ? templates.filter((t) => t.kind === kind) : templates;
    const translations = await db.select({ template_id: documentTemplateTranslationsTable.template_id, locale: documentTemplateTranslationsTable.locale })
      .from(documentTemplateTranslationsTable);
    const localesByTpl = new Map<number, string[]>();
    for (const tr of translations) {
      const arr = localesByTpl.get(tr.template_id) ?? [];
      arr.push(tr.locale);
      localesByTpl.set(tr.template_id, arr);
    }
    res.json({
      data: filtered.map((t) => ({
        id: t.id, kind: t.kind, key: t.key, name: t.name, description: t.description,
        category: t.category, status: t.status, version: t.version,
        locales: localesByTpl.get(t.id) ?? [], updated_at: t.updated_at,
      })),
    });
  } catch (err) {
    console.error("[document-templates] list failed:", err);
    res.status(500).json({ error: "Failed to list templates" });
  }
});

// GET /v1/document-templates/:id — template + all translations.
router.get("/v1/document-templates/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [tpl] = await db.select().from(documentTemplatesTable).where(eq(documentTemplatesTable.id, id)).limit(1);
  if (!tpl) { res.status(404).json({ error: "Not found" }); return; }
  const translations = await db.select().from(documentTemplateTranslationsTable)
    .where(eq(documentTemplateTranslationsTable.template_id, id));
  res.json({ data: { ...tpl, translations } });
});

// POST /v1/document-templates — create a new template.
router.post("/v1/document-templates", async (req, res): Promise<void> => {
  try {
    const b = req.body as Record<string, any>;
    if (!b.kind || !b.key || !b.name) { res.status(400).json({ error: "kind, key and name are required" }); return; }
    const [row] = await db.insert(documentTemplatesTable).values({
      kind: String(b.kind), key: String(b.key), name: String(b.name),
      description: b.description ?? null, category: b.category ?? null,
      variables_schema: b.variables_schema ?? {}, status: "draft", version: 1,
    }).returning();
    void logAction({ entityType: "document_template", entityId: row!.id, action: "CREATE", actorId: (req as any).user?.id ?? null, newValue: { kind: b.kind, key: b.key } });
    res.status(201).json({ data: row });
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "A template with this kind+key already exists" }); return; }
    console.error("[document-templates] create failed:", err);
    res.status(500).json({ error: "Failed to create template" });
  }
});

// PATCH /v1/document-templates/:id/translations/:locale — upsert one locale.
router.patch("/v1/document-templates/:id/translations/:locale", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const locale = String(req.params.locale);
    const b = req.body as Record<string, any>;
    const [tpl] = await db.select().from(documentTemplatesTable).where(eq(documentTemplatesTable.id, id)).limit(1);
    if (!tpl) { res.status(404).json({ error: "Template not found" }); return; }

    const [existing] = await db.select().from(documentTemplateTranslationsTable)
      .where(and(eq(documentTemplateTranslationsTable.template_id, id), eq(documentTemplateTranslationsTable.locale, locale))).limit(1);
    const values = {
      subject: b.subject ?? null, body_html: b.body_html ?? null,
      body_json: b.body_json ?? null, body_text: b.body_text ?? null,
    };
    if (existing) {
      await db.update(documentTemplateTranslationsTable).set({ ...values, updated_at: new Date() })
        .where(eq(documentTemplateTranslationsTable.id, existing.id));
    } else {
      await db.insert(documentTemplateTranslationsTable).values({ template_id: id, locale, ...values });
    }
    // Editing returns the template to draft until re-published.
    await db.update(documentTemplatesTable).set({ status: "draft", updated_at: new Date() }).where(eq(documentTemplatesTable.id, id));
    res.json({ data: { id, locale } });
  } catch (err) {
    console.error("[document-templates] patch translation failed:", err);
    res.status(500).json({ error: "Failed to save translation" });
  }
});

// POST /v1/document-templates/:id/publish — publish + bump version.
router.post("/v1/document-templates/:id/publish", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [cur] = await db.select({ v: documentTemplatesTable.version }).from(documentTemplatesTable).where(eq(documentTemplatesTable.id, id)).limit(1);
  if (!cur) { res.status(404).json({ error: "Not found" }); return; }
  await db.update(documentTemplatesTable)
    .set({ status: "published", version: (cur.v ?? 1) + 1, updated_at: new Date() })
    .where(eq(documentTemplatesTable.id, id));
  void logAction({ entityType: "document_template", entityId: id, action: "STATUS_CHANGE", actorId: (req as any).user?.id ?? null, newValue: { status: "published" } });
  res.json({ data: { id, status: "published" } });
});

// POST /v1/document-templates/:id/test-send — render with sample vars + email the admin.
router.post("/v1/document-templates/:id/test-send", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const locale = String(req.body?.locale ?? "en");
    const to = (req as any).user?.email as string | undefined;
    if (!to) { res.status(400).json({ error: "No admin email on the session" }); return; }
    if (!process.env.RESEND_API_KEY) { res.status(503).json({ error: "Email not configured" }); return; }

    const [tpl] = await db.select().from(documentTemplatesTable).where(eq(documentTemplatesTable.id, id)).limit(1);
    if (!tpl) { res.status(404).json({ error: "Not found" }); return; }
    const resolved = await resolveTemplate({ kind: tpl.kind, key: tpl.key, locale, publishedOnly: false });
    if (!resolved) { res.status(404).json({ error: "No translation to send" }); return; }

    const vars = { ...sampleVarsFromSchema(resolved.variablesSchema), ...(req.body?.vars ?? {}) };
    const subject = renderString(resolved.subject || `[Test] ${tpl.name}`, vars);
    const html = renderString(resolved.bodyHtml, vars);
    const client = new Resend(process.env.RESEND_API_KEY);
    const result = await client.emails.send({ from: FROM, to: [to], subject: `[TEST] ${subject}`, html });
    res.json({ data: { sentTo: to, id: (result as any)?.data?.id ?? null, locale } });
  } catch (err) {
    console.error("[document-templates] test-send failed:", err);
    res.status(500).json({ error: "Failed to send test" });
  }
});

// POST /v1/document-templates/:id/test-generate — render the template body with
// sample vars and return a sample PDF. Used by the Studio's PDF/contract preview
// (the editor only previews HTML inline; this shows the real branded PDF).
router.post("/v1/document-templates/:id/test-generate", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const locale = String(req.body?.locale ?? "en");
    const [tpl] = await db.select().from(documentTemplatesTable).where(eq(documentTemplatesTable.id, id)).limit(1);
    if (!tpl) { res.status(404).json({ error: "Not found" }); return; }
    const resolved = await resolveTemplate({ kind: tpl.kind, key: tpl.key, locale, publishedOnly: false });
    if (!resolved) { res.status(404).json({ error: "No translation to render" }); return; }

    const vars = { ...sampleVarsFromSchema(resolved.variablesSchema), ...(req.body?.vars ?? {}) };
    const bodyHtml = renderString(resolved.bodyHtml, vars);
    const html = renderDocumentShell({
      docType: tpl.name,
      bodyHtml: `<div class="section">${bodyHtml}</div>`,
      forPrint: true,
    });
    const pdf = await htmlToPdf(html);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${tpl.key}-${locale}-sample.pdf"`);
    res.setHeader("Content-Length", String(pdf.length));
    res.send(pdf);
  } catch (err) {
    if (err instanceof PdfUnavailableError) { res.status(503).json({ error: err.message }); return; }
    console.error("[document-templates] test-generate failed:", err);
    res.status(500).json({ error: "Failed to generate sample PDF" });
  }
});

export const documentTemplatesAdminRouter = router;

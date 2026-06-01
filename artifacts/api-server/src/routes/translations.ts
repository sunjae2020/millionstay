import { Router, type IRouter } from "express";
import { db, translationsTable, languagesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import * as z from "zod/v4";

const router: IRouter = Router();

/* ───────────────────────── Languages ───────────────────────── */

const LanguageBody = z.object({
  code: z.string().min(2).max(10).transform((s) => s.trim().toLowerCase()),
  name: z.string().min(1),
  english_name: z.string().optional(),
  flag_iso: z.string().optional(),
  enabled: z.boolean().optional(),
  is_default: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

const LanguagePatch = LanguageBody.partial().omit({ code: true });

router.get("/v1/translations/languages", async (_req, res): Promise<void> => {
  const rows = await db.select().from(languagesTable).orderBy(asc(languagesTable.sort_order), asc(languagesTable.code));
  res.json({ success: true, data: rows });
});

router.post("/v1/translations/languages", async (req, res): Promise<void> => {
  const parsed = LanguageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: "INVALID_BODY", issues: parsed.error.issues } });
    return;
  }
  const inserted = await db
    .insert(languagesTable)
    .values(parsed.data)
    .onConflictDoUpdate({
      target: languagesTable.code,
      set: {
        name: parsed.data.name,
        english_name: parsed.data.english_name ?? null,
        flag_iso: parsed.data.flag_iso ?? null,
        ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
        ...(parsed.data.sort_order !== undefined ? { sort_order: parsed.data.sort_order } : {}),
        updated_at: new Date(),
      },
    })
    .returning();
  res.status(201).json({ success: true, data: inserted[0] });
});

router.patch("/v1/translations/languages/:code", async (req, res): Promise<void> => {
  const code = String(req.params.code).toLowerCase();
  const parsed = LanguagePatch.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: "INVALID_BODY", issues: parsed.error.issues } });
    return;
  }
  const updated = await db
    .update(languagesTable)
    .set({ ...parsed.data, updated_at: new Date() })
    .where(eq(languagesTable.code, code))
    .returning();
  if (updated.length === 0) {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND" } });
    return;
  }
  res.json({ success: true, data: updated[0] });
});

router.delete("/v1/translations/languages/:code", async (req, res): Promise<void> => {
  const code = String(req.params.code).toLowerCase();
  if (code === "en") {
    res.status(400).json({ success: false, error: { code: "PROTECTED", message: "English is the base language and cannot be deleted." } });
    return;
  }
  await db.delete(translationsTable).where(eq(translationsTable.lang, code));
  await db.delete(languagesTable).where(eq(languagesTable.code, code));
  res.json({ success: true });
});

/* ──────────────────────── Translations ──────────────────────── */

// GET /v1/translations?lang=ko
// Returns every known key (union across all languages, base = en) with the
// English reference value and the value for the requested language.
router.get("/v1/translations", async (req, res): Promise<void> => {
  const lang = String(req.query.lang ?? "").toLowerCase();
  if (!lang) {
    res.status(400).json({ success: false, error: { code: "MISSING_LANG" } });
    return;
  }
  const all = await db.select().from(translationsTable);
  const keys = new Set<string>();
  const enMap = new Map<string, string>();
  const langMap = new Map<string, { value: string; id: number }>();
  for (const r of all) {
    keys.add(r.key);
    if (r.lang === "en") enMap.set(r.key, r.value);
    if (r.lang === lang) langMap.set(r.key, { value: r.value, id: r.id });
  }
  const data = Array.from(keys)
    .sort()
    .map((key) => ({
      key,
      en: enMap.get(key) ?? "",
      value: langMap.get(key)?.value ?? "",
      id: langMap.get(key)?.id ?? null,
    }));
  res.json({ success: true, data });
});

const UpsertBody = z.object({
  lang: z.string().min(2).max(10).transform((s) => s.trim().toLowerCase()),
  key: z.string().min(1).transform((s) => s.trim()),
  value: z.string(),
});

// PUT /v1/translations — upsert a single (lang, key) value.
router.put("/v1/translations", async (req, res): Promise<void> => {
  const parsed = UpsertBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: "INVALID_BODY", issues: parsed.error.issues } });
    return;
  }
  const user = (req as any).user as { id: number } | undefined;
  const saved = await db
    .insert(translationsTable)
    .values({ ...parsed.data, updated_by: user?.id ?? null })
    .onConflictDoUpdate({
      target: [translationsTable.lang, translationsTable.key],
      set: { value: parsed.data.value, updated_by: user?.id ?? null, updated_at: new Date() },
    })
    .returning();
  res.json({ success: true, data: saved[0] });
});

// DELETE /v1/translations?key=foo.bar — remove a key across every language.
router.delete("/v1/translations", async (req, res): Promise<void> => {
  const key = String(req.query.key ?? "").trim();
  if (!key) {
    res.status(400).json({ success: false, error: { code: "MISSING_KEY" } });
    return;
  }
  await db.delete(translationsTable).where(eq(translationsTable.key, key));
  res.json({ success: true });
});

export default router;

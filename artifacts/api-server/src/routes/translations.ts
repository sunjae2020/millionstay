import { Router, type IRouter } from "express";
import { db, translationsTable, languagesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import * as z from "zod/v4";
import { getAiClient, isTaskConfigured, AiConfigError } from "../lib/ai/client.js";

const router: IRouter = Router();

// Per-language tone/preservation guidance for AI translation. Mirrors the
// guidance baked into scripts/translate-content.mjs so admin-triggered and
// script-triggered translation stay consistent.
const LANG_INFO: Record<string, { name: string; style: string }> = {
  ko: { name: "Korean", style: "Use polite formal Korean (합쇼체)." },
  zh: { name: "Simplified Chinese", style: "Use formal Simplified Chinese." },
  ja: { name: "Japanese", style: "Use polite formal Japanese (です/ます体)." },
  th: { name: "Thai", style: "Use formal, polite Thai." },
  vi: { name: "Vietnamese", style: "Use formal Vietnamese." },
};

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

// GET /v1/translations?lang=ko[&prefix=admin.]
// Returns every known key (union across all languages, base = en) with the
// English reference value and the value for the requested language. `prefix`
// narrows the result to one key namespace — the admin UI now holds thousands of
// keys, so the page-oriented editors ask for just the group they render.
router.get("/v1/translations", async (req, res): Promise<void> => {
  const lang = String(req.query.lang ?? "").toLowerCase();
  if (!lang) {
    res.status(400).json({ success: false, error: { code: "MISSING_LANG" } });
    return;
  }
  const prefix = String(req.query.prefix ?? "").trim();
  const all = (await db.select().from(translationsTable)).filter(
    (r) => !prefix || r.key === prefix || r.key.startsWith(prefix + "."),
  );
  const keys = new Set<string>();
  const enMap = new Map<string, string>();
  const langMap = new Map<
    string,
    { value: string; id: number; source: string; reviewed_at: Date | null; created_at: Date; updated_at: Date }
  >();
  for (const r of all) {
    keys.add(r.key);
    if (r.lang === "en") enMap.set(r.key, r.value);
    if (r.lang === lang)
      langMap.set(r.key, {
        value: r.value, id: r.id, source: r.source, reviewed_at: r.reviewed_at,
        created_at: r.created_at, updated_at: r.updated_at,
      });
  }
  const data = Array.from(keys)
    .sort()
    .map((key) => {
      const m = langMap.get(key);
      return {
        key,
        en: enMap.get(key) ?? "",
        value: m?.value ?? "",
        id: m?.id ?? null,
        source: m?.source ?? null,
        reviewed_at: m?.reviewed_at ?? null,
        created_at: m?.created_at ?? null,
        updated_at: m?.updated_at ?? null,
        // True when the value came from AI and a human hasn't confirmed it yet.
        needs_review: !!m && m.source === "machine" && !m.reviewed_at,
      };
    });
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
  const now = new Date();
  // A manual save through this endpoint is, by definition, human-reviewed.
  const saved = await db
    .insert(translationsTable)
    .values({ ...parsed.data, source: "human", reviewed_at: now, updated_by: user?.id ?? null })
    .onConflictDoUpdate({
      target: [translationsTable.lang, translationsTable.key],
      set: { value: parsed.data.value, source: "human", reviewed_at: now, updated_by: user?.id ?? null, updated_at: now },
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

/* ────────────────────── AI translation ────────────────────── */

const AiTranslateBody = z
  .object({
    keyPrefix: z.string().optional(), // e.g. "homestay.home" — translates every en key under it
    keys: z.array(z.string()).optional(), // explicit key list (alternative to keyPrefix)
    targetLangs: z.array(z.string()).optional(), // defaults to all enabled non-default languages
    overwrite: z.boolean().optional().default(false), // when false, keys that already have a value are skipped
  })
  .refine((b) => b.keyPrefix || (b.keys && b.keys.length > 0), {
    message: "Provide keyPrefix or a non-empty keys array.",
  });

// Translate one batch of {key: english} into a target language using Claude.
async function translateBatch(
  entries: Array<{ key: string; en: string }>,
  langName: string,
  style: string,
): Promise<Record<string, string>> {
  const ai = getAiClient("i18n_translate");
  const system =
    `You are a professional translator for MillionStay / Million Homestay, a student accommodation and homestay platform for international students in Melbourne, Australia. ${style} ` +
    `Keep the brand names "MillionStay" and "Million Homestay" in English. Keep Australian suburb, city and university names in English. ` +
    `Preserve any HTML tags, {{placeholders}} and punctuation exactly. Translate naturally for a marketing website. ` +
    `You will receive a JSON object mapping i18n keys to English source strings. Respond with ONLY a JSON object using the SAME keys, each value translated to ${langName}. Do not add, drop, or rename keys.`;
  const payload: Record<string, string> = {};
  for (const e of entries) payload[e.key] = e.en;
  const msg = await ai.messages.create({
    max_tokens: 8192,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: JSON.stringify(payload) }],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const jsonStr = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(jsonStr) as Record<string, string>;
}

const PRESERVE_RULES =
  `Keep the brand names "MillionStay" and "Million Homestay" in English. Keep Australian suburb, city and university names in English. ` +
  `Preserve any HTML tags, {{placeholders}} and punctuation. Translate naturally for a marketing website.`;

// Translate ONE string and return plain text (no JSON). Used as a robust fallback
// when a batch's JSON output truncates or contains unescaped quotes.
async function translateOnePlain(en: string, langName: string, style: string): Promise<string> {
  const ai = getAiClient("i18n_translate");
  const system =
    `You are a professional translator for MillionStay / Million Homestay (student accommodation & homestay, Melbourne, Australia). ${style} ${PRESERVE_RULES} ` +
    `Translate the user's message into ${langName}. Respond with ONLY the translation as plain text — no quotes, no JSON, no commentary.`;
  const msg = await ai.messages.create({
    max_tokens: 4096,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: en }],
  });
  return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

// Review a batch of candidate translations against their English source and
// return the FINAL translation per key (unchanged if good, corrected otherwise).
async function reviewBatch(
  entries: Array<{ key: string; en: string; current: string }>,
  langName: string,
  style: string,
): Promise<Record<string, string>> {
  const ai = getAiClient("i18n_translate");
  const system =
    `You are a senior bilingual editor reviewing machine translations for the MillionStay / Million Homestay marketing site (Melbourne, Australia). ${style} ${PRESERVE_RULES} ` +
    `You receive a JSON object mapping i18n keys to {"en": <English source>, "current": <candidate ${langName} translation, possibly empty>}. ` +
    `For each key return the FINAL ${langName} translation: keep "current" unchanged when it is accurate, natural and complete; otherwise return a corrected (or, if empty, a new) translation. ` +
    `Respond with ONLY a JSON object using the SAME keys mapping to the final string. Escape any quotes inside values. Do not add, drop, or rename keys.`;
  const payload: Record<string, { en: string; current: string }> = {};
  for (const e of entries) payload[e.key] = { en: e.en, current: e.current };
  const msg = await ai.messages.create({
    max_tokens: 8192,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: JSON.stringify(payload) }],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const jsonStr = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(jsonStr) as Record<string, string>;
}

// Review ONE candidate and return plain text — robust per-key fallback.
async function reviewOnePlain(en: string, current: string, langName: string, style: string): Promise<string> {
  if (!current.trim()) return translateOnePlain(en, langName, style);
  const ai = getAiClient("i18n_translate");
  const system =
    `You are a senior bilingual editor for MillionStay / Million Homestay (Melbourne, Australia). ${style} ${PRESERVE_RULES} ` +
    `The user gives an English source and a candidate ${langName} translation. Return the FINAL ${langName} translation: keep the candidate if it is accurate, natural and complete; otherwise correct it. ` +
    `Respond with ONLY the final translation as plain text — no quotes, no JSON, no commentary.`;
  const msg = await ai.messages.create({
    max_tokens: 4096,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `English: ${en}\n\nCandidate (${langName}): ${current}` }],
  });
  return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

// POST /v1/translations/ai-translate — machine-translate English source strings
// into the requested languages and store them as source='machine' (unreviewed).
router.post("/v1/translations/ai-translate", async (req, res): Promise<void> => {
  const parsed = AiTranslateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: "INVALID_BODY", issues: parsed.error.issues } });
    return;
  }
  if (!isTaskConfigured("i18n_translate")) {
    res.status(503).json({ success: false, error: { code: "AI_NOT_CONFIGURED", message: "Set the Anthropic API key in Admin → Settings → Integrations." } });
    return;
  }
  const { keyPrefix, keys, targetLangs, overwrite } = parsed.data;
  const user = (req as any).user as { id: number } | undefined;

  // English source rows for the requested keys/prefix.
  const enRows = await db.select().from(translationsTable).where(eq(translationsTable.lang, "en"));
  const keySet = keys ? new Set(keys) : null;
  const source = enRows
    .filter((r) => (keySet ? keySet.has(r.key) : r.key === keyPrefix || r.key.startsWith(keyPrefix + ".")))
    .filter((r) => r.value && r.value.trim().length > 0)
    .map((r) => ({ key: r.key, en: r.value }));

  if (source.length === 0) {
    res.status(404).json({ success: false, error: { code: "NO_SOURCE", message: "No English source strings found for the given keys/prefix." } });
    return;
  }

  // Resolve target languages: explicit list, or all enabled non-default languages.
  let langs = (targetLangs ?? []).map((l) => l.toLowerCase()).filter((l) => l !== "en");
  if (langs.length === 0) {
    const enabled = await db.select().from(languagesTable).where(eq(languagesTable.enabled, true));
    langs = enabled.filter((l) => l.code !== "en" && !l.is_default).map((l) => l.code);
  }

  // Small batches keep each Claude call well under the output-token limit — large
  // batches of long (e.g. legal) strings can truncate the JSON and fail to parse.
  const BATCH = 15;
  const summary: Record<string, { translated: number; skipped: number }> = {};
  const errors: Array<{ lang: string; message: string }> = [];

  try {
    for (const lang of langs) {
      const info = LANG_INFO[lang] ?? { name: lang, style: "Use formal, natural language." };
      // Existing values for this lang, to honour overwrite=false.
      const existingRows = await db.select().from(translationsTable).where(eq(translationsTable.lang, lang));
      const existing = new Map(existingRows.map((r) => [r.key, r.value]));
      const todo = overwrite
        ? source
        : source.filter((s) => !((existing.get(s.key) ?? "").trim().length > 0));
      const skipped = source.length - todo.length;
      let translated = 0;

      for (let i = 0; i < todo.length; i += BATCH) {
        const chunk = todo.slice(i, i + BATCH);
        // Isolate each batch: a single failed/truncated batch must not abort the
        // rest of the run. overwrite=false means a later re-run picks up the gaps.
        let map: Record<string, string>;
        try {
          map = await translateBatch(chunk, info.name, info.style);
        } catch (be) {
          if (be instanceof AiConfigError) throw be;
          // A batch can fail when long strings (e.g. legal clauses) overflow the
          // output-token limit and truncate the JSON. Retry key-by-key so each
          // long string gets its own full response budget.
          map = {};
          for (const item of chunk) {
            try {
              const one = await translateBatch([item], info.name, info.style);
              if (typeof one[item.key] === "string") map[item.key] = one[item.key];
            } catch (one_e) {
              if (one_e instanceof AiConfigError) throw one_e;
              errors.push({ lang, message: `key ${item.key}: ${one_e instanceof Error ? one_e.message : String(one_e)}` });
            }
          }
        }
        for (const { key } of chunk) {
          const value = map[key];
          if (typeof value !== "string" || value.length === 0) continue;
          await db
            .insert(translationsTable)
            .values({ lang, key, value, source: "machine", updated_by: user?.id ?? null })
            .onConflictDoUpdate({
              target: [translationsTable.lang, translationsTable.key],
              set: { value, source: "machine", reviewed_at: null, updated_by: user?.id ?? null, updated_at: new Date() },
            });
          translated++;
        }
      }
      summary[lang] = { translated, skipped };
    }
  } catch (e) {
    if (e instanceof AiConfigError) {
      res.status(503).json({ success: false, error: { code: "AI_NOT_CONFIGURED", message: e.message } });
      return;
    }
    console.error("[translations] ai-translate failed:", e);
    errors.push({ lang: "*", message: e instanceof Error ? e.message : String(e) });
  }

  res.json({ success: errors.length === 0, data: { source_keys: source.length, langs, summary }, errors });
});

/* ────────────────────── AI review ────────────────────── */

const AiReviewBody = z
  .object({
    keyPrefix: z.string().optional(),
    keys: z.array(z.string()).optional(),
    targetLangs: z.array(z.string()).optional(),
  })
  .refine((b) => b.keyPrefix || (b.keys && b.keys.length > 0), {
    message: "Provide keyPrefix or a non-empty keys array.",
  });

// POST /v1/translations/ai-review — review every translation against its English
// source, correct any issues (and fill empties), then stamp reviewed_at so the
// editor no longer flags them as unreviewed. Idempotent and resumable.
router.post("/v1/translations/ai-review", async (req, res): Promise<void> => {
  const parsed = AiReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: "INVALID_BODY", issues: parsed.error.issues } });
    return;
  }
  if (!isTaskConfigured("i18n_translate")) {
    res.status(503).json({ success: false, error: { code: "AI_NOT_CONFIGURED", message: "Set the Anthropic API key in Admin → Settings → Integrations." } });
    return;
  }
  const { keyPrefix, keys, targetLangs } = parsed.data;
  const user = (req as any).user as { id: number } | undefined;

  const enRows = await db.select().from(translationsTable).where(eq(translationsTable.lang, "en"));
  const keySet = keys ? new Set(keys) : null;
  const source = enRows
    .filter((r) => (keySet ? keySet.has(r.key) : r.key === keyPrefix || r.key.startsWith(keyPrefix + ".")))
    .filter((r) => r.value && r.value.trim().length > 0)
    .map((r) => ({ key: r.key, en: r.value }));

  if (source.length === 0) {
    res.status(404).json({ success: false, error: { code: "NO_SOURCE", message: "No English source strings found for the given keys/prefix." } });
    return;
  }

  let langs = (targetLangs ?? []).map((l) => l.toLowerCase()).filter((l) => l !== "en");
  if (langs.length === 0) {
    const enabled = await db.select().from(languagesTable).where(eq(languagesTable.enabled, true));
    langs = enabled.filter((l) => l.code !== "en" && !l.is_default).map((l) => l.code);
  }

  const BATCH = 12;
  const now = new Date();
  const summary: Record<string, { reviewed: number; changed: number; filled: number }> = {};
  const errors: Array<{ lang: string; message: string }> = [];

  async function persist(lang: string, key: string, value: string): Promise<void> {
    await db
      .insert(translationsTable)
      .values({ lang, key, value, source: "machine", reviewed_at: now, updated_by: user?.id ?? null })
      .onConflictDoUpdate({
        target: [translationsTable.lang, translationsTable.key],
        set: { value, reviewed_at: now, updated_by: user?.id ?? null, updated_at: now },
      });
  }

  try {
    for (const lang of langs) {
      const info = LANG_INFO[lang] ?? { name: lang, style: "Use formal, natural language." };
      const existingRows = await db.select().from(translationsTable).where(eq(translationsTable.lang, lang));
      const existing = new Map(existingRows.map((r) => [r.key, r.value]));
      const items = source.map((s) => ({ key: s.key, en: s.en, current: existing.get(s.key) ?? "" }));
      let reviewed = 0, changed = 0, filled = 0;

      for (let i = 0; i < items.length; i += BATCH) {
        const chunk = items.slice(i, i + BATCH);
        let map: Record<string, string> | null = null;
        try {
          map = await reviewBatch(chunk, info.name, info.style);
        } catch (be) {
          if (be instanceof AiConfigError) throw be;
          map = null; // fall through to per-key
        }
        for (const item of chunk) {
          let final: string | undefined = map ? map[item.key] : undefined;
          if (typeof final !== "string" || final.length === 0) {
            try {
              final = await reviewOnePlain(item.en, item.current, info.name, info.style);
            } catch (one_e) {
              if (one_e instanceof AiConfigError) throw one_e;
              errors.push({ lang, message: `key ${item.key}: ${one_e instanceof Error ? one_e.message : String(one_e)}` });
              continue;
            }
          }
          if (typeof final !== "string" || final.length === 0) continue;
          await persist(lang, item.key, final);
          reviewed++;
          if (!item.current) filled++;
          else if (final.trim() !== item.current.trim()) changed++;
        }
      }
      summary[lang] = { reviewed, changed, filled };
    }
  } catch (e) {
    if (e instanceof AiConfigError) {
      res.status(503).json({ success: false, error: { code: "AI_NOT_CONFIGURED", message: e.message } });
      return;
    }
    console.error("[translations] ai-review failed:", e);
    errors.push({ lang: "*", message: e instanceof Error ? e.message : String(e) });
  }

  res.json({ success: errors.length === 0, data: { source_keys: source.length, langs, summary }, errors });
});

export default router;

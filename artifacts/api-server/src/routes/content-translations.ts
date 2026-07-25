import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  spacesTable,
  propertiesTable,
  spaceOptionsTable,
  languagesTable,
} from "@workspace/db";
import * as z from "zod/v4";
import { getAnthropic, isChatConfigured, CHAT_MODEL, ChatConfigError } from "../lib/chat/anthropic.js";

// Admin content translation for guest-facing entities (spaces, properties,
// amenity catalog). Admins author the original in the base columns; per-locale
// copy lives in each table's `translations` jsonb keyed by language code:
//   { [lang]: { <field>: value, _source: "machine" | "human" } }
// The public API (public.ts) resolves ONE language per request with fallback
// [lang → ko → en → base column]. This router provides: load-for-edit, save
// reviewed copy, and AI-generate drafts. Mounted under /api/v1 behind requireAuth.
const router: IRouter = Router();

// Which columns are translatable per entity. Structural fields are never here.
const ENTITIES = {
  spaces: { table: spacesTable, fields: ["name", "description", "custom_type_name"] as const },
  properties: { table: propertiesTable, fields: ["name", "description"] as const },
  "space-options": { table: spaceOptionsTable, fields: ["name", "display_name"] as const },
} as const;
type EntityKey = keyof typeof ENTITIES;

function getEntity(key: string): (typeof ENTITIES)[EntityKey] | null {
  return (ENTITIES as Record<string, (typeof ENTITIES)[EntityKey]>)[key] ?? null;
}

// Per-language tone guidance (mirrors translations.ts / translate-content.mjs).
const LANG_INFO: Record<string, { name: string; style: string }> = {
  en: { name: "English", style: "Use clear, natural marketing English." },
  ko: { name: "Korean", style: "Use polite formal Korean (합쇼체)." },
  zh: { name: "Simplified Chinese", style: "Use formal Simplified Chinese." },
  ja: { name: "Japanese", style: "Use polite formal Japanese (です/ます体)." },
  th: { name: "Thai", style: "Use formal, polite Thai." },
  vi: { name: "Vietnamese", style: "Use formal Vietnamese." },
};

const ParamsSchema = z.object({ entity: z.string(), id: z.coerce.number().int() });

/* ── Load a row's translatable source + existing translations for editing ── */
router.get("/v1/content-translations/:entity/:id", async (req, res): Promise<void> => {
  const parsed = ParamsSchema.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.message }); return; }
  const ent = getEntity(parsed.data.entity);
  if (!ent) { res.status(404).json({ success: false, error: "Unknown entity" }); return; }

  const [row] = await db.select().from(ent.table).where(eq(ent.table.id, parsed.data.id));
  if (!row) { res.status(404).json({ success: false, error: "Not found" }); return; }

  const source: Record<string, string> = {};
  for (const f of ent.fields) source[f] = (row as Record<string, unknown>)[f] as string ?? "";
  res.json({
    success: true,
    data: {
      fields: ent.fields,
      source,
      translations: (row as Record<string, unknown>).translations ?? {},
    },
  });
});

/* ── Save reviewed translations (whole jsonb, replaces the column) ── */
const SaveBody = z.object({ translations: z.record(z.string(), z.record(z.string(), z.any())) });
router.put("/v1/content-translations/:entity/:id", async (req, res): Promise<void> => {
  const parsed = ParamsSchema.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.message }); return; }
  const ent = getEntity(parsed.data.entity);
  if (!ent) { res.status(404).json({ success: false, error: "Unknown entity" }); return; }
  const body = SaveBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ success: false, error: body.error.message }); return; }

  // Keep only known fields (+ _source marker) per language; drop empty languages.
  const clean: Record<string, Record<string, string>> = {};
  for (const [lang, copy] of Object.entries(body.data.translations)) {
    const kept: Record<string, string> = {};
    for (const f of ent.fields) {
      const v = copy?.[f];
      if (v != null && String(v).trim() !== "") kept[f] = String(v);
    }
    if (Object.keys(kept).length > 0) {
      kept["_source"] = copy?._source === "machine" ? "machine" : "human";
      clean[lang] = kept;
    }
  }

  const [updated] = await db.update(ent.table)
    .set({ translations: clean, updated_at: new Date() })
    .where(eq(ent.table.id, parsed.data.id))
    .returning();
  if (!updated) { res.status(404).json({ success: false, error: "Not found" }); return; }
  res.json({ success: true, data: { translations: (updated as Record<string, unknown>).translations ?? {} } });
});

/* ── Translate one language's fields via Claude (JSON in / JSON out) ── */
async function translateFields(
  fields: Record<string, string>,
  targetName: string,
  style: string,
): Promise<Record<string, string>> {
  const anthropic = getAnthropic();
  const system =
    `You are a professional translator for a property-management platform. ${style} ` +
    `Keep brand names, proper nouns and place names sensible for the target language. ` +
    `Preserve any HTML tags, {{placeholders}}, line breaks and punctuation. Translate naturally for a customer-facing listing. ` +
    `You will receive a JSON object mapping field names to source text. Respond with ONLY a JSON object using the SAME keys, each value translated to ${targetName}. Do not add, drop, or rename keys.`;
  const msg = await anthropic.messages.create({
    model: CHAT_MODEL,
    max_tokens: 4096,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: JSON.stringify(fields) }],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const jsonStr = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(jsonStr) as Record<string, string>;
}

/* ── AI-generate draft translations, merge into the jsonb, persist ── */
const AiBody = z.object({
  sourceLang: z.string().optional().default("ko"),
  targetLangs: z.array(z.string()).optional(),
  overwrite: z.boolean().optional().default(false),
});
router.post("/v1/content-translations/:entity/:id/ai-translate", async (req, res): Promise<void> => {
  const parsed = ParamsSchema.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.message }); return; }
  const ent = getEntity(parsed.data.entity);
  if (!ent) { res.status(404).json({ success: false, error: "Unknown entity" }); return; }
  const body = AiBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ success: false, error: body.error.message }); return; }
  if (!isChatConfigured()) {
    res.status(503).json({ success: false, error: { code: "AI_NOT_CONFIGURED", message: "Set the Anthropic API key in Admin → Settings → Integrations." } });
    return;
  }

  const [row] = await db.select().from(ent.table).where(eq(ent.table.id, parsed.data.id));
  if (!row) { res.status(404).json({ success: false, error: "Not found" }); return; }

  const sourceLang = normLang(body.data.sourceLang);
  // Source text: the authored base columns.
  const src: Record<string, string> = {};
  for (const f of ent.fields) {
    const v = (row as Record<string, unknown>)[f];
    if (v != null && String(v).trim() !== "") src[f] = String(v);
  }
  if (Object.keys(src).length === 0) {
    res.status(400).json({ success: false, error: { code: "NO_SOURCE", message: "This record has no text to translate." } });
    return;
  }

  // Target languages: explicit list, or all enabled languages except the source.
  let langs = (body.data.targetLangs ?? []).map(normLang).filter((l) => l !== sourceLang);
  if (langs.length === 0) {
    const enabled = await db.select().from(languagesTable).where(eq(languagesTable.enabled, true));
    langs = enabled.map((l) => normLang(l.code)).filter((l) => l !== sourceLang);
  }

  const existing = ((row as Record<string, unknown>).translations ?? {}) as Record<string, Record<string, string>>;
  const merged: Record<string, Record<string, string>> = { ...existing };
  const summary: Record<string, { translated: number }> = {};
  const errors: Array<{ lang: string; message: string }> = [];

  try {
    for (const lang of langs) {
      const info = LANG_INFO[lang] ?? { name: lang, style: "Use formal, natural language." };
      // Honour overwrite=false: skip fields that already have a value for this lang.
      const cur = merged[lang] ?? {};
      const todo: Record<string, string> = {};
      for (const [f, v] of Object.entries(src)) {
        if (body.data.overwrite || !((cur[f] ?? "").trim().length > 0)) todo[f] = v;
      }
      if (Object.keys(todo).length === 0) { summary[lang] = { translated: 0 }; continue; }
      try {
        const out = await translateFields(todo, info.name, info.style);
        const next: Record<string, string> = { ...cur };
        let n = 0;
        for (const f of Object.keys(todo)) {
          if (typeof out[f] === "string" && out[f].trim() !== "") { next[f] = out[f]; n++; }
        }
        next["_source"] = "machine";
        merged[lang] = next;
        summary[lang] = { translated: n };
      } catch (be) {
        if (be instanceof ChatConfigError) throw be;
        errors.push({ lang, message: be instanceof Error ? be.message : String(be) });
      }
    }
  } catch (e) {
    if (e instanceof ChatConfigError) {
      res.status(503).json({ success: false, error: { code: "AI_NOT_CONFIGURED", message: e.message } });
      return;
    }
    console.error("[content-translations] ai-translate failed:", e);
    errors.push({ lang: "*", message: e instanceof Error ? e.message : String(e) });
  }

  const [updated] = await db.update(ent.table)
    .set({ translations: merged, updated_at: new Date() })
    .where(eq(ent.table.id, parsed.data.id))
    .returning();

  res.json({
    success: errors.length === 0,
    data: { translations: (updated as Record<string, unknown>)?.translations ?? merged, langs, summary },
    errors,
  });
});

// "ko-KR" → "ko"; missing → "en".
function normLang(v: unknown): string {
  return String(v ?? "en").split("-")[0].toLowerCase();
}

export default router;

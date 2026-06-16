// Editable-template engine (ported from Edubee CRM's templateEngine, simplified
// for MillionStay's single-tenant model). Resolves a document_templates row +
// its best-matching translation, and substitutes {{variables}}.
//
// Used at send time with publishedOnly=true (only published copy goes out); the
// admin Studio uses publishedOnly=false to preview drafts. Best-effort callers
// fall back to hardcoded copy when resolveTemplate returns null.
import { and, eq } from "drizzle-orm";
import { db, documentTemplatesTable, documentTemplateTranslationsTable } from "@workspace/db";

export interface ResolvedTemplate {
  templateId: number;
  kind: string;
  key: string;
  locale: string;
  subject: string;
  bodyHtml: string;
  variablesSchema: Record<string, { type?: string; required?: boolean }>;
}

const FALLBACK_LOCALE = "en";

/** Resolve a template by (kind, key) + best translation (requested → en → first). */
export async function resolveTemplate(args: {
  kind: string;
  key: string;
  locale?: string;
  publishedOnly?: boolean;
}): Promise<ResolvedTemplate | null> {
  try {
    const publishedOnly = args.publishedOnly ?? true;
    const [tpl] = await db.select().from(documentTemplatesTable)
      .where(and(eq(documentTemplatesTable.kind, args.kind), eq(documentTemplatesTable.key, args.key)))
      .limit(1);
    if (!tpl) return null;
    if (publishedOnly && tpl.status !== "published") return null;

    const translations = await db.select().from(documentTemplateTranslationsTable)
      .where(eq(documentTemplateTranslationsTable.template_id, tpl.id));
    if (translations.length === 0) return null;

    const want = (args.locale ?? FALLBACK_LOCALE).toLowerCase();
    const pick =
      translations.find((t) => t.locale?.toLowerCase() === want) ??
      translations.find((t) => t.locale?.toLowerCase() === FALLBACK_LOCALE) ??
      translations[0];

    return {
      templateId: tpl.id,
      kind: tpl.kind,
      key: tpl.key,
      locale: pick.locale,
      subject: pick.subject ?? "",
      bodyHtml: pick.body_html ?? "",
      variablesSchema: (tpl.variables_schema as Record<string, { type?: string; required?: boolean }>) ?? {},
    };
  } catch (err) {
    console.error("[templateEngine] resolveTemplate failed:", err);
    return null;
  }
}

/**
 * Resolve a published template's body and render its {{variables}} for inline
 * use inside a generated document (e.g. the editable "pdf" terms/notes injected
 * into invoice/quote/contract PDFs). Best-effort: returns "" when no published
 * template/translation exists, so callers fall back to their hardcoded copy.
 */
export async function resolveTemplateBody(
  kind: string,
  key: string,
  locale: string,
  vars: Record<string, unknown> = {},
): Promise<string> {
  const tpl = await resolveTemplate({ kind, key, locale });
  if (!tpl?.bodyHtml?.trim()) return "";
  return renderString(tpl.bodyHtml, vars);
}

/** Substitute {{ var }} placeholders. Missing variables render as empty strings. */
export function renderString(tpl: string, vars: Record<string, unknown>): string {
  if (!tpl) return "";
  return tpl.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_m, name: string) => {
    const v = vars[name];
    return v == null ? "" : String(v);
  });
}

/** Build placeholder sample values from a variables schema (preview/test-send). */
export function sampleVarsFromSchema(schema: Record<string, { type?: string; required?: boolean }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, def] of Object.entries(schema ?? {})) {
    const type = def?.type ?? "string";
    if (type === "url") out[name] = "https://www.millionstay.com";
    else if (type === "date") out[name] = new Date().toISOString().slice(0, 10);
    else if (type === "number") out[name] = "100.00";
    else out[name] = `[${name}]`;
  }
  return out;
}

/**
 * 세대점검표 양식 설정 — which template rows a tenant wants on the form at all.
 *
 * Two levels of hiding, on purpose:
 *  - here (template level): "this building has no 월패드" — applies to every
 *    checklist created from now on, and to the blank printable form.
 *  - per checklist (`condition_report_items.hidden`): "this A-type unit has no
 *    이동식 식탁" — a one-off override on a single contract.
 *
 * Stored as a settings blob rather than its own table: it is one small
 * per-tenant document, edited from one screen, read on create/print.
 */
import { eq } from "drizzle-orm";
import { db, integrationSettings } from "@workspace/db";

export const INSPECTION_PREFS_KEY = "inspection_template_prefs";

/** { "<templateKey>": { hidden: ["living.wall_pad", …] } } */
export type InspectionTemplatePrefs = Record<string, { hidden: string[] }>;

export async function readTemplatePrefs(): Promise<InspectionTemplatePrefs> {
  try {
    const [row] = await db
      .select()
      .from(integrationSettings)
      .where(eq(integrationSettings.key, INSPECTION_PREFS_KEY));
    if (!row?.value) return {};
    const parsed = JSON.parse(row.value) as InspectionTemplatePrefs;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Item codes hidden by default for one template. */
export async function hiddenCodesFor(templateKey: string): Promise<Set<string>> {
  const prefs = await readTemplatePrefs();
  return new Set(prefs[templateKey]?.hidden ?? []);
}

export async function writeTemplatePrefs(
  templateKey: string,
  hidden: string[],
): Promise<InspectionTemplatePrefs> {
  const prefs = await readTemplatePrefs();
  prefs[templateKey] = { hidden: [...new Set(hidden.filter((c) => typeof c === "string"))] };
  const value = JSON.stringify(prefs);
  await db
    .insert(integrationSettings)
    .values({ key: INSPECTION_PREFS_KEY, value })
    .onConflictDoUpdate({
      target: integrationSettings.key,
      set: { value, updated_at: new Date() },
    });
  return prefs;
}

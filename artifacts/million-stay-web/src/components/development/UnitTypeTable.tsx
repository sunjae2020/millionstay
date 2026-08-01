import { useTranslation } from "react-i18next";
import { SpecTable, SectionHeading } from "./DevSection";

// Unit-type specification table.
//
// The Buy and Rent pages described the building in prose, which made a page of
// figures read as a paragraph. This puts them in the table the guideline (§9)
// specifies instead.
//
// Rows come from the CMS (page key "dev-buy" / "dev-rent", fields
// type_N_name … ), one row per unit type, and the section renders NOTHING when
// no row is filled — a placeholder table of invented areas and prices would
// otherwise ship to a live sales page.

export const UNIT_TYPE_ROW_COUNT = 8;

export interface UnitTypeColumn {
  key: string;
  label: string;
  numeric?: boolean;
}

/**
 * @param pc     the page's CMS accessor (`usePageContent(pageKey)`)
 * @param fields which per-type fields this page shows, in column order
 */
export function UnitTypeTable({
  pc,
  fields,
  eyebrow,
  title,
  lead,
  note,
}: {
  pc: (field: string, fallback: string) => string;
  fields: UnitTypeColumn[];
  eyebrow?: string;
  title: string;
  lead?: string;
  note?: string;
}) {
  const { t } = useTranslation();

  const rows: Record<string, string>[] = [];
  for (let i = 1; i <= UNIT_TYPE_ROW_COUNT; i += 1) {
    const row: Record<string, string> = {};
    let hasValue = false;
    for (const field of fields) {
      const value = pc(`type_${i}_${field.key}`, "");
      row[field.key] = value;
      if (value.trim()) hasValue = true;
    }
    if (hasValue) rows.push(row);
  }

  if (rows.length === 0) return null;

  return (
    <div>
      <SectionHeading eyebrow={eyebrow} title={title} lead={lead} />
      <SpecTable columns={fields} rows={rows} caption={title} />
      {note && <p className="mt-3 text-xs text-[hsl(var(--brand-ink))]/55">{note}</p>}
      <p className="mt-1 text-xs text-[hsl(var(--brand-ink))]/55">{t("dev.spec_table_disclaimer")}</p>
    </div>
  );
}

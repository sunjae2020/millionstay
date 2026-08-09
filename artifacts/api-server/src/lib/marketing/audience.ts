/**
 * Audience resolution — turning a list (static or dynamic) into prospect rows,
 * and a campaign's audience into a vetted recipient set.
 *
 * Kept out of the route files because both the list-preview endpoint and the
 * campaign `build` step need exactly the same answer; if they could drift, the
 * count an admin approves would not be the set that actually gets mailed.
 */
import { and, eq, gte, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { db, prospectsTable, prospectListMembersTable, marketingListsTable } from "@workspace/db";

/**
 * Dynamic-segment filter, stored as `marketing_lists.filter_criteria`.
 * Unknown keys are ignored rather than failing the query — a segment saved by a
 * later version of the UI still resolves, just less precisely.
 */
export interface FilterCriteria {
  /** Import batch / provenance label (prospects.source). */
  source?: string;
  /**
   * Source-specific attribute filters, `{ key: value }` against `attributes`.
   * Applied generically — no key is named in code, so a segment can filter on an
   * attribute that did not exist when this was written.
   */
  attrs?: Record<string, string>;
  segment?: string | string[];
  country?: string | string[];
  prospect_status?: string | string[];
  consent_basis?: string | string[];
  language_code?: string;
  min_score?: number;
  /** Only prospects never contacted. */
  never_contacted?: boolean;
  /** Free-text match against company / contact / email. */
  search?: string;
}

function asArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
}

export function criteriaConditions(criteria: FilterCriteria): SQL[] {
  const conditions: SQL[] = [isNull(prospectsTable.deleted_at)];

  const segments = asArray(criteria.segment);
  if (segments.length) conditions.push(inArray(prospectsTable.segment, segments));

  const countries = asArray(criteria.country);
  if (countries.length) conditions.push(inArray(prospectsTable.country, countries));

  const statuses = asArray(criteria.prospect_status);
  if (statuses.length) conditions.push(inArray(prospectsTable.prospect_status, statuses));

  const bases = asArray(criteria.consent_basis);
  if (bases.length) conditions.push(inArray(prospectsTable.consent_basis, bases));

  if (criteria.language_code) conditions.push(eq(prospectsTable.language_code, criteria.language_code));
  if (typeof criteria.min_score === "number") {
    conditions.push(gte(prospectsTable.qualification_score, criteria.min_score));
  }
  if (criteria.never_contacted) conditions.push(isNull(prospectsTable.last_contacted_at));

  if (criteria.source) conditions.push(eq(prospectsTable.source, criteria.source));

  for (const [key, value] of Object.entries(criteria.attrs ?? {})) {
    if (!key || value === undefined || value === null || value === "") continue;
    // Case-insensitive equality on the JSONB text value. Both sides are bound
    // parameters — the key never reaches SQL as an identifier.
    conditions.push(sql`lower(${prospectsTable.attributes} ->> ${key}) = lower(${value})`);
  }
  if (criteria.search) {
    const term = `%${criteria.search}%`;
    conditions.push(
      sql`(${prospectsTable.company_name} ILIKE ${term} OR ${prospectsTable.contact_name} ILIKE ${term} OR ${prospectsTable.email} ILIKE ${term})`,
    );
  }

  return conditions;
}

export type ProspectRow = typeof prospectsTable.$inferSelect;

/** Members of a list — explicit rows for `static`, a live query for `dynamic`. */
export async function resolveListMembers(listId: number): Promise<ProspectRow[]> {
  const [list] = await db
    .select()
    .from(marketingListsTable)
    .where(eq(marketingListsTable.id, listId))
    .limit(1);
  if (!list) return [];

  if (list.list_type === "dynamic") {
    const criteria = (list.filter_criteria ?? {}) as FilterCriteria;
    return db
      .select()
      .from(prospectsTable)
      .where(and(...criteriaConditions(criteria)));
  }

  const memberIds = (
    await db
      .select({ id: prospectListMembersTable.prospect_id })
      .from(prospectListMembersTable)
      .where(eq(prospectListMembersTable.list_id, listId))
  ).map((r) => r.id);
  if (memberIds.length === 0) return [];

  return db
    .select()
    .from(prospectsTable)
    .where(and(inArray(prospectsTable.id, memberIds), isNull(prospectsTable.deleted_at)));
}

/** Statuses that end a prospect's participation in outbound campaigns. */
export const NON_MAILABLE_STATUSES = [
  "unsubscribed",
  "bounced",
  "converted",
  "disqualified",
] as const;

export const MAX_BOUNCES = 2;

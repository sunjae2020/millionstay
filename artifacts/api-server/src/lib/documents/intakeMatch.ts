import { db, contractsTable, spacesTable, accountsTable, contactsTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import type { IntakeDocType, IntakeFields } from "./intakeScan.js";

/**
 * Match a scanned document to the record it belongs to.
 *
 * The scan gives us fragments off the page — a unit designation, a tenant name,
 * a lease term. This turns those into a ranked list of candidate records by
 * scoring each fragment that agrees. Nothing here files anything: the top
 * candidate is a proposal, and the score is what decides whether a human has to
 * look at it before it lands.
 *
 * Identity documents deliberately match against *people*, never contracts —
 * an ID filed on a contract would inherit a 7-year retention instead of the
 * 30 days APP 11 requires, and the upload endpoint refuses it anyway.
 */

export interface MatchCandidate {
  entity_type: "contract" | "contact";
  entity_id: number;
  /** What the reviewer sees in the picker — ref, unit and tenant. */
  label: string;
  /** 0–1. See SIGNALS below for what each point is worth. */
  score: number;
  /** Which signals agreed, in plain words. */
  reason: string;
}

export interface MatchResult {
  best: MatchCandidate | null;
  candidates: MatchCandidate[];
  /**
   * True when the top candidate is strong enough AND clearly ahead of the
   * runner-up. Only these are offered for one-click filing.
   */
  confident: boolean;
}

/**
 * What each agreeing signal is worth.
 *
 * A printed contract/document reference is near-decisive on its own — it is an
 * exact identifier, not an inference. Everything else is circumstantial and has
 * to stack: a unit number alone matches every lease that unit ever had, and a
 * tenant name alone matches every unit that tenant ever rented. Unit + name, or
 * unit + a date inside the term, is what actually identifies one contract.
 */
const SIGNALS = {
  reference: 0.9,
  unit: 0.45,
  party: 0.4,
  dateWithinTerm: 0.25,
  building: 0.1,
} as const;

/** Top candidate must clear this, and beat the runner-up by MIN_MARGIN, to skip review. */
const CONFIDENT_SCORE = 0.8;
const MIN_MARGIN = 0.2;

/** Identity documents belong to a person, so they are matched against contacts. */
const PERSON_DOC_TYPES = new Set<IntakeDocType>(["id_document", "visa_document"]);

/**
 * Normalise a unit designation for comparison.
 *
 * The same unit is written "1503호", "제1503호", "A-1503", "a1503" and " 1503 "
 * depending on who typed it, and the ledger import stored bare 호수 for the
 * Metheim units. Strip everything that is not alphanumeric, drop the 호 marker,
 * and drop leading zeros so "0503" and "503" agree.
 */
function normaliseUnit(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const stripped = raw
    .replace(/제/g, "")
    .replace(/호/g, "")
    .replace(/[^0-9A-Za-z]/g, "")
    .toUpperCase();
  if (!stripped) return null;
  return stripped.replace(/^0+(?=\d)/, "");
}

/**
 * Normalise a person or company name: drop spaces and case, and drop the
 * corporate-form noise that appears on some documents but not others
 * ((주), 주식회사, Co., Ltd., Pty).
 */
function normaliseName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const stripped = raw
    .replace(/\(주\)|\(유\)|주식회사|유한회사/g, "")
    .replace(/\b(co|ltd|inc|pty|llc|corp)\b\.?/gi, "")
    .replace(/[\s.,·]/g, "")
    .toLowerCase();
  return stripped || null;
}

/** Two names agree if either contains the other — "홍길동" vs "홍길동(임차인)". */
function namesAgree(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  // Guard against a one- or two-character fragment matching half the database.
  if (Math.min(a.length, b.length) < 3) return false;
  return a.includes(b) || b.includes(a);
}

function withinTerm(date: string, start: string | null, end: string | null): boolean {
  if (start && date < start) return false;
  if (end && date > end) return false;
  return Boolean(start || end);
}

interface ContractRow {
  id: number;
  contract_ref: string;
  space_id: number | null;
  tenant_account_id: number | null;
  start_date: string | null;
  end_date: string | null;
}

/**
 * Rank contracts against a scan.
 *
 * Every non-deleted contract is loaded once per batch by the caller and scored
 * in memory — the working set is small (hundreds of contracts, not millions),
 * and doing it in SQL would mean one query per fuzzy signal per file.
 */
export function scoreContracts(
  fields: IntakeFields,
  contracts: ContractRow[],
  spaceNames: Map<number, string>,
  accountNames: Map<number, string>,
): MatchCandidate[] {
  const wantUnit = normaliseUnit(fields.unit_label);
  const wantParty = normaliseName(fields.party_name);
  const wantRef = fields.reference?.trim().toUpperCase() || null;
  const wantBuilding = normaliseName(fields.building_name);
  // Any date the document gave us, most specific first — used to pick between
  // successive leases on the same unit by the same tenant.
  const probeDates = [fields.start_date, fields.document_date, fields.end_date].filter(Boolean) as string[];

  const out: MatchCandidate[] = [];
  for (const c of contracts) {
    let score = 0;
    const reasons: string[] = [];

    if (wantRef && c.contract_ref.toUpperCase() === wantRef) {
      score += SIGNALS.reference;
      reasons.push(`계약번호 ${c.contract_ref}`);
    }

    const spaceName = c.space_id != null ? spaceNames.get(c.space_id) : undefined;
    if (wantUnit && spaceName) {
      const unit = normaliseUnit(spaceName);
      if (unit && unit === wantUnit) {
        score += SIGNALS.unit;
        reasons.push(`세대 ${spaceName}`);
      } else if (wantBuilding && namesAgree(normaliseName(spaceName), wantBuilding)) {
        score += SIGNALS.building;
        reasons.push(`건물명 ${spaceName}`);
      }
    }

    const tenantName = c.tenant_account_id != null ? accountNames.get(c.tenant_account_id) : undefined;
    if (wantParty && namesAgree(normaliseName(tenantName), wantParty)) {
      score += SIGNALS.party;
      reasons.push(`임차인 ${tenantName}`);
    }

    if (probeDates.some((d) => withinTerm(d, c.start_date, c.end_date))) {
      score += SIGNALS.dateWithinTerm;
      reasons.push("계약기간 일치");
    }

    if (score <= 0) continue;
    out.push({
      entity_type: "contract",
      entity_id: c.id,
      label: [c.contract_ref, spaceName, tenantName].filter(Boolean).join(" · "),
      score: Math.min(1, score),
      reason: reasons.join(", "),
    });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

interface ContactRow {
  id: number;
  first_name: string;
  last_name: string;
  company_name: string | null;
}

/** Rank people against a scan — used for identity and visa documents. */
export function scoreContacts(fields: IntakeFields, contacts: ContactRow[]): MatchCandidate[] {
  const wantParty = normaliseName(fields.party_name);
  if (!wantParty) return [];

  const out: MatchCandidate[] = [];
  for (const p of contacts) {
    // Korean names are written family-name-first and unspaced on documents, so
    // compare against both orderings rather than assuming one.
    const combined = [`${p.last_name}${p.first_name}`, `${p.first_name}${p.last_name}`];
    if (!combined.some((n) => namesAgree(normaliseName(n), wantParty))) continue;
    out.push({
      entity_type: "contact",
      entity_id: p.id,
      label: [`${p.last_name}${p.first_name}`, p.company_name].filter(Boolean).join(" · "),
      // A name match alone identifies a person only when the name is unique —
      // the ambiguity check below is what turns duplicates into review items.
      score: SIGNALS.party + SIGNALS.unit,
      reason: `이름 ${p.last_name}${p.first_name}`,
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

/** Everything the matcher needs, loaded once and reused across a whole batch. */
export interface MatchContext {
  contracts: ContractRow[];
  spaceNames: Map<number, string>;
  accountNames: Map<number, string>;
  contacts: ContactRow[];
}

export async function loadMatchContext(): Promise<MatchContext> {
  const contracts = await db
    .select({
      id: contractsTable.id,
      contract_ref: contractsTable.contract_ref,
      space_id: contractsTable.space_id,
      tenant_account_id: contractsTable.tenant_account_id,
      start_date: contractsTable.start_date,
      end_date: contractsTable.end_date,
    })
    .from(contractsTable)
    .where(isNull(contractsTable.deleted_at));

  const spaces = await db
    .select({ id: spacesTable.id, name: spacesTable.name })
    .from(spacesTable)
    .where(isNull(spacesTable.deleted_at));

  const accounts = await db
    .select({ id: accountsTable.id, name: accountsTable.name })
    .from(accountsTable)
    .where(isNull(accountsTable.deleted_at));

  const contacts = await db
    .select({
      id: contactsTable.id,
      first_name: contactsTable.first_name,
      last_name: contactsTable.last_name,
      company_name: contactsTable.company_name,
    })
    .from(contactsTable)
    .where(isNull(contactsTable.deleted_at));

  return {
    contracts,
    spaceNames: new Map(spaces.map((s) => [s.id, s.name])),
    accountNames: new Map(accounts.map((a) => [a.id, a.name])),
    contacts,
  };
}

export function matchDocument(
  docType: IntakeDocType,
  fields: IntakeFields,
  ctx: MatchContext,
): MatchResult {
  const candidates = PERSON_DOC_TYPES.has(docType)
    ? scoreContacts(fields, ctx.contacts)
    : scoreContracts(fields, ctx.contracts, ctx.spaceNames, ctx.accountNames);

  const best = candidates[0] ?? null;
  const runnerUp = candidates[1]?.score ?? 0;
  // A strong-but-tied top score means the document genuinely matches two records
  // (two leases on the same unit, two people with the same name). That is
  // exactly the case a human has to resolve, so the margin check is not
  // optional polish — it is what stops a confident-looking mis-filing.
  const confident = Boolean(best && best.score >= CONFIDENT_SCORE && best.score - runnerUp >= MIN_MARGIN);

  return { best, candidates, confident };
}

/** Does this record actually exist? Guards a reviewer-supplied override. */
export async function entityExists(entityType: string, entityId: number): Promise<boolean> {
  const table =
    entityType === "contract" ? contractsTable
    : entityType === "contact" ? contactsTable
    : entityType === "account" ? accountsTable
    : entityType === "space" ? spacesTable
    : null;
  if (!table) return false;
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, entityId), isNull(table.deleted_at)))
    .limit(1);
  return Boolean(row);
}

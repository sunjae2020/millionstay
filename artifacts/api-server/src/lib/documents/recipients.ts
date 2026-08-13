import { db, accountsTable, contactsTable, contractsTable, leadsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

/**
 * One address the admin can send a document to. `role` drives the label shown
 * beside the suggestion in the send dialog ("고객" vs "담당자").
 */
export interface DocumentRecipient {
  email: string;
  name: string | null;
  role: "account" | "primary_contact" | "secondary_contact" | "lead" | "landlord" | "agency";
}

export interface DocumentRecipients {
  /** Pre-filled in the send dialog — the first candidate, when there is one. */
  default: string[];
  /** Everything we know about, offered as one-click additions. */
  candidates: DocumentRecipient[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function contactName(c: typeof contactsTable.$inferSelect): string {
  return [c.last_name, c.first_name].filter(Boolean).join(" ").trim() || c.email || "";
}

/**
 * Collect every address associated with an account: the account's own billing
 * email plus its primary/secondary contacts (the 담당자 on the record).
 */
export async function accountRecipients(
  accountId: number | null | undefined,
  role: DocumentRecipient["role"] = "account",
): Promise<DocumentRecipient[]> {
  if (!accountId) return [];
  const [acc] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId));
  if (!acc) return [];

  const out: DocumentRecipient[] = [];
  if (acc.account_email) out.push({ email: acc.account_email, name: acc.name, role });

  const contactIds = [acc.primary_contact_id, acc.secondary_contact_id].filter(
    (v): v is number => typeof v === "number",
  );
  if (contactIds.length) {
    const contacts = await db.select().from(contactsTable).where(inArray(contactsTable.id, contactIds));
    for (const id of contactIds) {
      const c = contacts.find((x) => x.id === id);
      if (!c?.email) continue;
      out.push({
        email: c.email,
        name: contactName(c),
        role: id === acc.primary_contact_id ? "primary_contact" : "secondary_contact",
      });
    }
  }
  return out;
}

/** The party on a quote is either an account or a bare lead. */
export async function quotePartyRecipients(
  accountId: number | null,
  leadId: number | null,
): Promise<DocumentRecipient[]> {
  if (accountId) return accountRecipients(accountId);
  if (!leadId) return [];
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId));
  const email = (lead as { email?: string | null } | undefined)?.email;
  if (!email) return [];
  const name = [(lead as any)?.last_name, (lead as any)?.first_name].filter(Boolean).join(" ").trim() || null;
  return [{ email, name: name || null, role: "lead" }];
}

/**
 * 계약 한 건에 걸린 상대방 전원 — 임차인(기본 수신자) · 부동산(중개) · 임대인.
 * 부동산은 계약 시점 스냅숏 주소(channel_contact_email)와 연결된 계정 주소를 모두
 * 후보로 올린다. 청구서·영수증도 계약이 걸려 있으면 이 목록을 함께 제안한다.
 */
export async function contractPartyRecipients(contractId: number | null | undefined): Promise<DocumentRecipient[]> {
  if (!contractId) return [];
  const [row] = await db.select().from(contractsTable).where(eq(contractsTable.id, contractId));
  if (!row) return [];
  const out: DocumentRecipient[] = [];
  out.push(...await accountRecipients(row.tenant_account_id));
  if (row.channel_contact_email) {
    out.push({ email: row.channel_contact_email, name: row.channel_contact_name ?? null, role: "agency" });
  }
  out.push(...(await accountRecipients(row.channel_account_id)).map((r) => ({ ...r, role: "agency" as const })));
  out.push(...(await accountRecipients(row.landlord_account_id)).map((r) => ({ ...r, role: "landlord" as const })));
  return out;
}

/** Drop blanks/dupes/invalid addresses and shape the API response. */
export function toRecipientsResponse(candidates: DocumentRecipient[]): DocumentRecipients {
  const seen = new Set<string>();
  const clean: DocumentRecipient[] = [];
  for (const c of candidates) {
    const email = c.email?.trim();
    if (!email || !EMAIL_RE.test(email)) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push({ ...c, email });
  }
  return { default: clean.length ? [clean[0].email] : [], candidates: clean };
}

/**
 * Normalise the `to` field of a document-email request. Accepts a single
 * address or a list (the send dialog lets the admin add several), and rejects
 * anything that is not a plausible address so a typo fails loudly instead of
 * silently dropping the send.
 */
export function parseRecipients(raw: unknown): { to: string[]; invalid: string[] } {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,;]/) : [];
  const to: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const email = String(item ?? "").trim();
    if (!email) continue;
    if (!EMAIL_RE.test(email)) { invalid.push(email); continue; }
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    to.push(email);
  }
  return { to, invalid };
}

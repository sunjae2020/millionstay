import { db, accountsTable, contactsTable, contractsTable, leadsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

/**
 * One address the admin can send a document to. `role` drives the label shown
 * beside the suggestion in the send dialog ("고객" vs "담당자").
 */
export interface DocumentRecipient {
  /**
   * 이메일 주소. 문자 수신자 후보는 주소가 없을 수 있다 — 한국 임대차 세입자는
   * 메일 주소 없이 휴대폰만 등록된 경우가 흔하다. 두 칸 중 하나는 있어야 한다.
   */
  email: string | null;
  /** 휴대폰 번호(있으면). 문자 보내기 대화상자가 쓴다. */
  phone?: string | null;
  name: string | null;
  role: "account" | "primary_contact" | "secondary_contact" | "lead" | "landlord" | "agency";
}

export interface DocumentRecipients {
  /** Pre-filled in the send dialog — the first candidate, when there is one. */
  default: string[];
  /** 문자 대화상자의 기본 수신 번호 — 첫 번째 휴대폰 후보. */
  default_phone: string[];
  /** Everything we know about, offered as one-click additions. */
  candidates: DocumentRecipient[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 국내 휴대폰만 문자 수신자로 올린다(lib/sms.ts normalizeKrPhone 과 같은 규칙). */
function mobileOf(...raw: Array<string | null | undefined>): string | null {
  for (const r of raw) {
    if (!r) continue;
    const d = r.replace(/[^\d+]/g, "").replace(/^\+?82/, "0");
    if (/^01[016789]\d{7,8}$/.test(d)) return d;
  }
  return null;
}

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
  const accPhone = mobileOf(acc.phone1, acc.phone2);
  if (acc.account_email || accPhone) out.push({ email: acc.account_email ?? null, phone: accPhone, name: acc.name, role });

  const contactIds = [acc.primary_contact_id, acc.secondary_contact_id].filter(
    (v): v is number => typeof v === "number",
  );
  if (contactIds.length) {
    const contacts = await db.select().from(contactsTable).where(inArray(contactsTable.id, contactIds));
    for (const id of contactIds) {
      const c = contacts.find((x) => x.id === id);
      if (!c) continue;
      const phone = mobileOf(c.mobile_number);
      if (!c.email && !phone) continue;
      out.push({
        email: c.email ?? null,
        phone,
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
  const email = (lead as { email?: string | null } | undefined)?.email ?? null;
  const phone = mobileOf((lead as { phone?: string | null } | undefined)?.phone);
  if (!email && !phone) return [];
  const name = [(lead as any)?.last_name, (lead as any)?.first_name].filter(Boolean).join(" ").trim() || null;
  return [{ email, phone, name: name || null, role: "lead" }];
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
  const channelPhone = mobileOf(row.channel_contact_phone);
  if (row.channel_contact_email || channelPhone) {
    out.push({ email: row.channel_contact_email ?? null, phone: channelPhone, name: row.channel_contact_name ?? null, role: "agency" });
  }
  out.push(...(await accountRecipients(row.channel_account_id)).map((r) => ({ ...r, role: "agency" as const })));
  out.push(...(await accountRecipients(row.landlord_account_id)).map((r) => ({ ...r, role: "landlord" as const })));
  return out;
}

/** Drop blanks/dupes/invalid addresses and shape the API response. */
export function toRecipientsResponse(candidates: DocumentRecipient[]): DocumentRecipients {
  const seenEmail = new Set<string>();
  const seenPhone = new Set<string>();
  const clean: DocumentRecipient[] = [];
  for (const c of candidates) {
    const rawEmail = c.email?.trim();
    const email = rawEmail && EMAIL_RE.test(rawEmail) ? rawEmail : null;
    const phone = c.phone ?? null;
    if (!email && !phone) continue;
    // 주소·번호 각각 한 번씩만. 같은 사람이 계정과 연락처 양쪽에 걸려 있는 일이 흔하다.
    const newEmail = email && !seenEmail.has(email.toLowerCase()) ? email : null;
    const newPhone = phone && !seenPhone.has(phone) ? phone : null;
    if (!newEmail && !newPhone) continue;
    if (newEmail) seenEmail.add(newEmail.toLowerCase());
    if (newPhone) seenPhone.add(newPhone);
    clean.push({ ...c, email: newEmail, phone: newPhone });
  }
  const firstEmail = clean.find((c) => c.email)?.email;
  const firstPhone = clean.find((c) => c.phone)?.phone;
  return {
    default: firstEmail ? [firstEmail] : [],
    default_phone: firstPhone ? [firstPhone] : [],
    candidates: clean,
  };
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

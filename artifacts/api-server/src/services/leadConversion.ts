// 문의(lead) → 사람(연락처) → 거래 상대(계정) 만들기.
//
// 전환은 지금까지 `lead_status` 만 바꿨고, 실제 레코드는 담당자가 손으로 만들었다.
// 문의 하나마다 연락처를 치고, 계정을 만들고, 그 계정의 대표 연락처 슬롯에 연락처를
// 물리는 세 단계가 사람 몫이었다 — 그 사이에서 오타와 누락이 났고, 만들어진 계약과
// 문의 사이에는 아무 연결도 남지 않았다.
//
// 이 파일이 그 세 단계를 한 번에 한다. 예약 전환과 계약 전환이 같은 함수를 쓰므로,
// 어느 쪽으로 전환하든 같은 사람·같은 계정에 걸린다 — 한 문의를 예약으로 한 번,
// 계약으로 한 번 전환해도 연락처가 둘로 갈라지지 않는다.
//
// **계약서의 임차인 칸은 연락처가 아니라 계정을 가리킨다**(`contracts.tenant_account_id`).
// 개인 세입자에게도 계정이 필요한 이유이고, 그 계정은 `entity_kind='Individual'` 로
// 만들어 회사 전용 칸(사업자등록번호·대표자·웹사이트)이 화면에 뜨지 않게 한다.
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  db, leadsTable, contactsTable, accountsTable, accountContactsTable,
  tenantAccessLinksTable,
} from "@workspace/db";
import { logAction } from "../utils/auditLog";
import { formatPersonName } from "../lib/nameFormat";

/** 신청서에서 연락처로 그대로 옮겨 앉는 칸들. */
const CONTACT_FIELDS = [
  "first_name", "last_name", "email", "mobile_number",
  "date_of_birth", "nationality", "sns_type", "sns_id",
  "address_line1", "suburb", "state", "postcode", "country",
  "company_name", "job_title",
] as const;

export interface LeadParty {
  contactId: number;
  accountId: number;
  createdContact: boolean;
  createdAccount: boolean;
  /** 신청서 제출본(있으면). 전환 화면이 희망 입주일 같은 값을 여기서 꺼내 쓴다. */
  answers: Record<string, string>;
}

/** 이 문의에 달린 임차 신청서의 최신 제출본. 없으면 빈 객체. */
export async function leadApplicationAnswers(leadId: number): Promise<Record<string, string>> {
  const [link] = await db
    .select({ submissions: tenantAccessLinksTable.submissions })
    .from(tenantAccessLinksTable)
    .where(and(
      eq(tenantAccessLinksTable.kind, "application"),
      eq(tenantAccessLinksTable.context_type, "lead"),
      eq(tenantAccessLinksTable.context_id, leadId),
    ))
    .orderBy(desc(tenantAccessLinksTable.id))
    .limit(1);
  const subs = Array.isArray(link?.submissions) ? link!.submissions : [];
  const latest = [...subs].reverse().find((s: any) => s?.event === "application") as any;
  return (latest?.answers ?? {}) as Record<string, string>;
}

/**
 * 문의에 걸린 연락처와 계정을 확보한다. 이미 만들어 둔 것이 있으면 그것을 쓴다.
 *
 * 값의 출처는 **신청서 제출본이 1순위, 문의 자체가 2순위**다. 신청서가 훨씬
 * 자세하고 본인이 직접 적은 것이기 때문이다. 신청서를 내지 않은 문의도 전환할 수
 * 있어야 하므로(전화로 받은 문의가 실제로 있다) 문의 칸만으로도 동작한다.
 *
 * 기존 연락처를 찾았을 때는 **비어 있는 칸만** 채운다. 검증된 값을 신청서 한 줄로
 * 덮어쓰면 되돌릴 방법이 없다 — 임차 신청서 승인(`/tenant-links/:id/apply`)과 같은
 * 규칙이다.
 */
export async function ensureLeadParty(
  leadId: number,
  actorId: number | null,
): Promise<LeadParty> {
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId)).limit(1);
  if (!lead) throw new Error("LEAD_NOT_FOUND");

  const answers = await leadApplicationAnswers(leadId);

  // 신청서 → 문의 순서로 채운다.
  const values: Record<string, string> = {};
  for (const f of CONTACT_FIELDS) {
    const v = answers[f];
    if (typeof v === "string" && v.trim()) values[f] = v.trim();
  }
  values["first_name"] ??= (lead.first_name ?? "").trim();
  values["last_name"] ??= (lead.last_name ?? "").trim();
  values["email"] ??= (lead.email ?? "").trim();
  if (lead.phone) values["mobile_number"] ??= lead.phone.trim();
  if (lead.nationality) values["nationality"] ??= lead.nationality.trim();
  for (const k of Object.keys(values)) if (!values[k]) delete values[k];

  /* ── 연락처 ─────────────────────────────────────────────────────────── */
  let contactId = lead.converted_contact_id ?? null;
  let createdContact = false;

  if (!contactId && values["email"]) {
    const [hit] = await db
      .select({ id: contactsTable.id })
      .from(contactsTable)
      .where(and(eq(contactsTable.email, values["email"]!), isNull(contactsTable.deleted_at)))
      .limit(1);
    contactId = hit?.id ?? null;
  }

  if (contactId) {
    const [current] = await db.select().from(contactsTable).where(eq(contactsTable.id, contactId)).limit(1);
    const fill: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      const now = (current as any)?.[k];
      if (now == null || String(now).trim() === "") fill[k] = v;
    }
    if (Object.keys(fill).length) {
      await db.update(contactsTable)
        .set({ ...fill, updated_at: new Date() } as never)
        .where(eq(contactsTable.id, contactId));
    }
  } else {
    const [row] = await db.insert(contactsTable).values({
      ...values,
      // notNull 두 칸. 한쪽만 들어온 문의가 실제로 있어서, 막되 사람이 보면
      // 무엇이 비었는지 알 수 있게 둔다.
      first_name: values["first_name"] ?? "—",
      last_name: values["last_name"] ?? "—",
      manual_input: false,
      status: "Active",
    } as never).returning({ id: contactsTable.id });
    contactId = row!.id;
    createdContact = true;
    void logAction({
      entityType: "contact", entityId: contactId, action: "CREATE",
      actorId, newValue: { from_lead: leadId },
    });
  }

  /* ── 계정 ───────────────────────────────────────────────────────────── */
  let accountId = lead.converted_account_id ?? null;
  let createdAccount = false;

  if (!accountId) {
    // 이 사람이 대표 연락처로 걸린 임차인 계정이 이미 있으면 그것을 쓴다.
    const [hit] = await db
      .select({ id: accountsTable.id })
      .from(accountsTable)
      .where(and(
        eq(accountsTable.primary_contact_id, contactId),
        eq(accountsTable.account_type, "Tenant"),
      ))
      .limit(1);
    accountId = hit?.id ?? null;
  }

  if (!accountId) {
    const personName = formatPersonName(values["first_name"] ?? null, values["last_name"] ?? null);
    const [row] = await db.insert(accountsTable).values({
      name: personName || values["email"] || `문의 ${lead.lead_ref}`,
      account_type: "Tenant",
      // 개인 임차인. 회사 전용 칸(사업자등록번호·대표자·웹사이트)이 뜨지 않는다.
      entity_kind: "Individual",
      primary_contact_id: contactId,
      email: values["email"] ?? null,
      phone: values["mobile_number"] ?? null,
      manual_input: false,
      status: "Active",
    } as never).returning({ id: accountsTable.id });
    accountId = row!.id;
    createdAccount = true;
    void logAction({
      entityType: "account", entityId: accountId, action: "CREATE",
      actorId, newValue: { from_lead: leadId, contact_id: contactId },
    });
  }

  // 계정↔연락처 N:M 연결. 대표 슬롯과 별개로 목록 탭이 이 표를 읽는다.
  const [linked] = await db
    .select({ id: accountContactsTable.id })
    .from(accountContactsTable)
    .where(and(
      eq(accountContactsTable.account_id, accountId),
      eq(accountContactsTable.contact_id, contactId),
    ))
    .limit(1);
  if (!linked) {
    await db.insert(accountContactsTable).values({
      account_id: accountId, contact_id: contactId,
    } as never);
  }

  await db.update(leadsTable)
    .set({ converted_contact_id: contactId, converted_account_id: accountId, updated_at: new Date() })
    .where(eq(leadsTable.id, leadId));

  return { contactId, accountId, createdContact, createdAccount, answers };
}

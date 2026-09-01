/**
 * 통보(SMS) 공통부 — 발송 + 이력 + 멱등 + 수신자 조회.
 *
 * `lib/sms.ts` 는 "한 통을 어떻게 보내는가"(바이트·인코딩·알림톡·광고 규칙)만 안다.
 * 실제 호출부가 매번 다시 짜게 되는 것은 그 바깥이다 —
 *
 *   ① 이 사람의 휴대폰 번호가 어디 붙어 있는가 (계약→계정→연락처, 파트너→계정…)
 *   ② 같은 사건으로 두 번 보내지 않았는가 (크론은 매일 돈다)
 *   ③ 보낸 사실을 어디에 남기는가
 *
 * 세 가지를 호출부마다 다시 쓰면 반드시 한 곳이 빠진다. 그래서 여기 모은다.
 *
 * ## 이력은 `email_log` 에 남긴다
 *
 * 테이블 이름은 email 이지만 이 로그가 답하는 질문은 **"이 건은 통보했는가"** 이고,
 * 그건 채널과 무관하다. `sms_log` 를 따로 파면 멱등 확인을 두 곳에서 해야 하고
 * 한쪽을 빠뜨리는 순간 중복 발송이 나간다. 연체 독촉(rentDunning)이 이미 같은
 * 판단으로 email_log 를 쓰고 있어 규칙도 하나로 맞는다.
 * `to_email` 칸에는 번호가 들어간다 — SMS 에서는 번호가 수신자 식별자다.
 *
 * ⚠️ 실패도 남긴다(status='Failed'). 조용한 실패는 "보냈다고 생각했는데 안 갔다" 가
 *    되고, 그건 청구·정산 통보에서 가장 비싼 종류의 사고다.
 */
import { and, eq, isNull, inArray } from "drizzle-orm";
import {
  db, emailLogsTable, contactsTable, accountsTable, usersTable,
  invoicesTable, contractsTable,
} from "@workspace/db";
import { normalizeKrPhone, sendSms } from "./sms";

export interface NotifySmsArgs {
  /** SMS 템플릿 키 (document_templates.kind='sms'). 예: "sms.payment_received" */
  smsKey: string;
  to?: string | null;
  name?: string | null;
  vars?: Record<string, unknown>;
  /** 이력·멱등의 대상. 없으면 이력만 남기고 멱등 확인은 하지 않는다. */
  entity?: { type: string; id: number };
  /**
   * 멱등·이력 키. 기본값은 smsKey.
   * 이메일과 같은 사건을 두 채널로 보낼 때는 **이메일 문안 키로 통일**한다 —
   * "이 단계는 통보했다" 가 기록의 뜻이라 채널별로 나누면 중복 통보가 된다.
   */
  logKey?: string;
  /** true 면 같은 (entity, logKey) 로 이미 보낸 이력이 있을 때 보내지 않는다. */
  once?: boolean;
  /** 알림톡을 쓰지 않고 SMS 로만. */
  smsOnly?: boolean;
}

export interface NotifySmsResult {
  sent: boolean;
  /** 설정 미비·중복·번호 없음 등 "실패가 아닌 미발송". */
  skipped: boolean;
  reason?: string;
  id?: string;
}

/** 이 대상에 이 키로 이미 통보했나. */
export async function alreadyNotified(entityType: string, entityId: number, key: string): Promise<boolean> {
  const [row] = await db
    .select({ id: emailLogsTable.id })
    .from(emailLogsTable)
    .where(and(
      eq(emailLogsTable.entity_type, entityType),
      eq(emailLogsTable.entity_id, entityId),
      eq(emailLogsTable.template_code, key),
    ))
    .limit(1);
  return !!row;
}

/**
 * SMS 한 통 + 이력. 절대 throw 하지 않는다 — 통보 실패가 본 작업(수납·배정·정산)을
 * 되돌리면 안 된다. 호출부는 `void notifySms(...)` 로 띄워 두어도 안전하다.
 */
export async function notifySms(args: NotifySmsArgs): Promise<NotifySmsResult> {
  const key = args.logKey ?? args.smsKey;
  try {
    const to = normalizeKrPhone(args.to ?? "");
    if (!to) return { sent: false, skipped: true, reason: "no_mobile" };

    if (args.once && args.entity && await alreadyNotified(args.entity.type, args.entity.id, key)) {
      return { sent: false, skipped: true, reason: "already_sent" };
    }

    const res = await sendSms({
      to,
      templateKey: args.smsKey,
      smsOnly: args.smsOnly,
      vars: {
        // 문의 번호는 거의 모든 문안이 쓰고 값은 인스턴스 하나다 — 호출부마다
        // 넘기게 하면 빠뜨린 곳만 "문의 " 로 끝나는 문자가 나간다.
        contact_phone: process.env.SUPPORT_PHONE ?? "",
        ...(args.vars ?? {}),
      },
    });

    if (args.entity) {
      await logNotification({
        key, to, name: args.name ?? null, entity: args.entity,
        ok: res.ok, messageId: res.id, error: res.error,
        // 미설정으로 건너뛴 건은 이력에 남기지 않는다 — 개통 전 크론이 도는 동안
        // 로그가 "실패" 로 가득 차면 진짜 실패가 묻힌다.
        skip: !!res.skipped,
      });
    }

    if (res.ok) return { sent: true, skipped: false, id: res.id };
    return { sent: false, skipped: !!res.skipped, reason: res.error };
  } catch (err) {
    console.error(`[notify] ${key} 발송 중 예외:`, err instanceof Error ? err.message : err);
    return { sent: false, skipped: false, reason: "exception" };
  }
}

async function logNotification(a: {
  key: string; to: string; name: string | null;
  entity: { type: string; id: number };
  ok: boolean; messageId?: string; error?: string; skip: boolean;
}): Promise<void> {
  if (a.skip) return;
  try {
    await db.insert(emailLogsTable).values({
      template_code: a.key,
      to_email: a.to,                 // SMS 는 번호가 수신자 식별자다
      to_name: a.name,
      subject: `[SMS] ${a.key}`,
      resend_message_id: a.messageId ?? null,
      status: a.ok ? "Sent" : "Failed",
      error_message: a.ok ? null : (a.error ?? null),
      entity_type: a.entity.type,
      entity_id: a.entity.id,
    });
  } catch (err) {
    console.error("[notify] 이력 기록 실패:", err instanceof Error ? err.message : err);
  }
}

/* ── 수신자 조회 ─────────────────────────────────────────────────────────────
   "누구에게 보내는가" 는 도메인마다 경로가 다르다. 호출부가 조인을 다시 쓰지
   않도록 여기 모아 둔다. 전부 실패해도 null 을 돌려주고 throw 하지 않는다. */

export interface Recipient { mobile: string | null; email: string | null; name: string }

function personName(first?: string | null, last?: string | null, fallback = "고객"): string {
  // 한국어 표기는 성 먼저 붙여쓰기 — nameFormat.ts 의 규칙과 같다.
  return [last, first].filter(Boolean).join("") || fallback;
}

/** 연락처 한 명. */
export async function contactRecipient(contactId?: number | null): Promise<Recipient | null> {
  if (!contactId) return null;
  const [c] = await db.select({
    email: contactsTable.email, mobile: contactsTable.mobile_number,
    first: contactsTable.first_name, last: contactsTable.last_name,
  }).from(contactsTable).where(eq(contactsTable.id, contactId)).limit(1);
  if (!c) return null;
  return { mobile: c.mobile, email: c.email, name: personName(c.first, c.last) };
}

/**
 * 계정의 연락 수단. 계정 전화(phone1)를 먼저 보고, 없으면 주 연락처의 휴대폰을 쓴다.
 * 파트너·소유주·에이전트는 계정이 창구라 이 순서가 맞다.
 */
export async function accountRecipient(accountId?: number | null): Promise<Recipient | null> {
  if (!accountId) return null;
  const [a] = await db.select({
    name: accountsTable.name, email: accountsTable.account_email,
    phone1: accountsTable.phone1, contactId: accountsTable.primary_contact_id,
  }).from(accountsTable).where(eq(accountsTable.id, accountId)).limit(1);
  if (!a) return null;
  const direct = normalizeKrPhone(a.phone1 ?? "");
  if (direct) return { mobile: direct, email: a.email, name: a.name };
  const contact = await contactRecipient(a.contactId);
  return {
    mobile: contact?.mobile ?? null,
    email: a.email ?? contact?.email ?? null,
    name: a.name || (contact?.name ?? "고객"),
  };
}

/** 인보이스를 받는 사람 — 계정의 주 연락처. 연체 독촉이 쓰는 경로와 같다. */
export async function invoiceRecipient(invoiceId: number): Promise<Recipient | null> {
  const [row] = await db.select({
    email: contactsTable.email, mobile: contactsTable.mobile_number,
    first: contactsTable.first_name, last: contactsTable.last_name,
    accountId: invoicesTable.account_id,
  })
    .from(invoicesTable)
    .leftJoin(accountsTable, eq(accountsTable.id, invoicesTable.account_id))
    .leftJoin(contactsTable, eq(contactsTable.id, accountsTable.primary_contact_id))
    .where(eq(invoicesTable.id, invoiceId))
    .limit(1);
  if (!row) return null;
  if (row.mobile || row.email) {
    return { mobile: row.mobile, email: row.email, name: personName(row.first, row.last) };
  }
  return accountRecipient(row.accountId);
}

/** 계약의 세입자 — 계약은 계정을 물고, 계정이 주 연락처를 문다. */
export async function contractTenantRecipient(contractId?: number | null): Promise<Recipient | null> {
  if (!contractId) return null;
  const [c] = await db.select({ accountId: contractsTable.tenant_account_id })
    .from(contractsTable).where(eq(contractsTable.id, contractId)).limit(1);
  if (!c) return null;
  return accountRecipient(c.accountId);
}

/**
 * 운영 담당자 번호. `STAFF_ALERT_MOBILES`(쉼표 구분)가 정본이고, 없으면 SuperAdmin
 * 사용자의 전화번호를 쓴다. env 를 먼저 보는 이유는 야간 장애 알림을 받을 사람이
 * 계정 목록과 항상 같지는 않기 때문이다(당번은 사람이 정한다).
 */
export async function staffAlertMobiles(): Promise<string[]> {
  const raw = (process.env.STAFF_ALERT_MOBILES ?? "").trim();
  if (raw) {
    return raw.split(",").map((s) => normalizeKrPhone(s)).filter((v): v is string => !!v);
  }
  const rows = await db.select({ phone: usersTable.phone })
    .from(usersTable)
    .where(and(inArray(usersTable.role, ["SuperAdmin", "Admin"]), isNull(usersTable.deleted_at)));
  return rows.map((r) => normalizeKrPhone(r.phone ?? "")).filter((v): v is string => !!v);
}

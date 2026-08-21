/**
 * 연체 독촉 발송 (billing.rent_overdue_1 / _2 / _3)
 *
 * `generateLeaseRentInvoices()` 는 기한이 지난 인보이스를 'Overdue' 로 바꾸지만
 * **메일은 한 통도 보내지 않았다** — 연체가 시스템 안에서만 쌓이고 세입자는 통보를
 * 받지 못했다. 이 모듈이 그 구멍을 메운다.
 *
 * ## 중복 발송 방지가 핵심이다
 *
 * 크론이 매일 돈다. "연체 3일 이상이면 1차 발송" 을 조건 없이 걸면 같은 세입자에게
 * **매일** 독촉이 나간다. 그래서 단계별로 **이미 보냈는지**를 `email_log` 에서 확인한다
 * (template_code + entity_type='invoice' + entity_id). 새 테이블이 필요 없고,
 * 발송 이력이 곧 멱등 키다.
 *
 * ## 단계
 *
 *   1차  3일 경과   실수로 놓친 경우를 전제한 부드러운 확인
 *   2차  10일 경과  연체료 발생 고지 + 분할 납부 창구
 *   3차  30일 경과  최고장. 법적 조치 예고
 *
 * 일수는 env 로 조정한다(DUNNING_DAYS="3,10,30"). 테넌트마다 계약 조건이 다르다.
 *
 * ⚠️ 3차의 구체적 법령 인용은 문안이 아니라 {{legal_note}} 변수로 들어간다 —
 *    계약 해지·명도 요건은 계약서와 관할 법령을 따르므로 테넌트 법률 자문이 채운다.
 * ⚠️ 금액·이율은 전부 변수다. 문장에 숫자를 리터럴로 쓰면 청구서 PDF 와 갈라진다.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  db, invoicesTable, contractsTable, accountsTable, contactsTable, emailLogsTable,
} from "@workspace/db";
import { sendDunningEmail } from "../email";
import { sendSms } from "../sms";

/**
 * 수신자 한 명에게 청구 알림을 보낸다. 이메일이 있으면 이메일, 없으면 SMS.
 *
 * **Metheim 실측: 세입자 101명 중 이메일 보유 3명(3%), 휴대폰 101명(100%).**
 * 한국 임대차에서 이메일은 사실상 채널이 아니다. 이메일 전용으로 만들면 기능이
 * 배포돼도 아무에게도 닿지 않는다 — 그래서 두 채널을 모두 태운다.
 */
async function notifyBilling(args: {
  invoiceId: number;
  templateKey: string;      // 이메일 문안 키
  smsKey: string;           // SMS 문안 키
  email: string | null;
  mobile: string | null;
  name: string;
  vars: Record<string, unknown>;
}): Promise<boolean> {
  if (args.email) {
    return sendDunningEmail({
      to: args.email, toName: args.name,
      templateKey: args.templateKey, invoiceId: args.invoiceId, vars: args.vars,
    });
  }
  if (!args.mobile) return false;
  // {{brand}} 는 sendSms 가 테넌트 상호로 채운다 — 여기서 빈 값을 넘기면 덮어써진다.
  const res = await sendSms({
    to: args.mobile,
    templateKey: args.smsKey,
    vars: { ...args.vars, contact_phone: process.env.SUPPORT_PHONE ?? "" },
  });
  // 채널이 달라도 멱등 키는 이메일 문안 키로 통일한다 — "이 단계는 통보했다" 가
  // 기록의 뜻이고, 채널별로 나누면 이메일→SMS 전환 시 중복 통보가 나간다.
  if (res.ok) await logDunningSms(args.invoiceId, args.templateKey, args.mobile, args.name, res.id);
  return res.ok;
}

export type RentDueResult = { enabled: boolean; checked: number; sent: number; skipped: number; noContact: number };

/**
 * 납부 기한 **사전** 안내 (billing.rent_due / sms.rent_due).
 *
 * 연체된 뒤 독촉하는 것보다 기한 전에 알리는 편이 낫다 — 세입자는 잊어서 밀리는
 * 경우가 대부분이고, 독촉은 이미 관계가 상한 뒤의 수단이다.
 *
 * 기한 `RENT_DUE_NOTICE_DAYS`(기본 3)일 전에 한 번만. 멱등 키는 인보이스별
 * 'billing.rent_due' 하나이므로 매일 크론이 돌아도 한 통이다.
 */
export async function sendRentDueNotices(opts: { dryRun?: boolean } = {}): Promise<RentDueResult> {
  const enabled = (process.env.RENT_DUE_NOTICE_ENABLED ?? "").toLowerCase() === "true";
  if (!enabled && !opts.dryRun) return { enabled: false, checked: 0, sent: 0, skipped: 0, noContact: 0 };

  const daysAhead = Number(process.env.RENT_DUE_NOTICE_DAYS ?? 3) || 3;
  const key = "billing.rent_due";
  const today = new Date().toISOString().slice(0, 10);

  const rows = await db
    .select({
      id: invoicesTable.id,
      ref: invoicesTable.invoice_ref,
      amount: invoicesTable.amount,
      currency: invoicesTable.currency,
      dueDate: invoicesTable.due_date,
      email: contactsTable.email,
      mobile: contactsTable.mobile_number,
      firstName: contactsTable.first_name,
      lastName: contactsTable.last_name,
    })
    .from(invoicesTable)
    .leftJoin(accountsTable, eq(accountsTable.id, invoicesTable.account_id))
    .leftJoin(contactsTable, eq(contactsTable.id, accountsTable.primary_contact_id))
    .where(and(
      isNull(invoicesTable.deleted_at),
      sql`${invoicesTable.status} in ('Sent','Draft')`,
      // 아직 기한 전이고, 기한이 daysAhead 일 안으로 다가온 건.
      // due_date 는 text 라 캐스트가 필요하다.
      sql`${invoicesTable.due_date}::date > ${today}::date`,
      sql`${invoicesTable.due_date}::date <= (${today}::date + ${daysAhead}::int)`,
    ));

  let sent = 0, skipped = 0, noContact = 0;
  for (const r of rows) {
    if (!r.dueDate) { skipped++; continue; }
    if (!r.email && !r.mobile) { noContact++; continue; }
    if (await alreadySent(r.id, key)) { skipped++; continue; }
    if (opts.dryRun) { sent++; continue; }

    const name = [r.lastName, r.firstName].filter(Boolean).join("") || "고객";
    const daysLeft = Math.ceil(
      (Date.parse(String(r.dueDate)) - Date.parse(today)) / 86_400_000);
    const ok = await notifyBilling({
      invoiceId: r.id, templateKey: key, smsKey: "sms.rent_due",
      email: r.email, mobile: r.mobile, name,
      vars: {
        recipient: name,
        ref: r.ref ?? String(r.id),
        amount: `${Number(r.amount ?? 0).toLocaleString()} ${r.currency ?? ""}`.trim(),
        due_date: String(r.dueDate),
        days_left: daysLeft,
        payment_method: process.env.PAYMENT_METHOD_LABEL ?? "계좌이체",
        url: "",
      },
    });
    ok ? sent++ : skipped++;
  }
  return { enabled: true, checked: rows.length, sent, skipped, noContact };
}

/** 단계별 경과 일수. 기본 3/10/30, `DUNNING_DAYS` 로 덮어쓴다. */
function dunningStages(): Array<{ stage: 1 | 2 | 3; days: number; key: string }> {
  const raw = (process.env.DUNNING_DAYS ?? "3,10,30").split(",").map((s) => Number(s.trim()));
  const [d1, d2, d3] = [raw[0] || 3, raw[1] || 10, raw[2] || 30];
  return [
    { stage: 3, days: d3, key: "billing.rent_overdue_3" },
    { stage: 2, days: d2, key: "billing.rent_overdue_2" },
    { stage: 1, days: d1, key: "billing.rent_overdue_1" },
  ];
}

export type DunningResult = {
  enabled: boolean;
  checked: number;
  sent: number;
  skipped: number;
  failed: number;
  /** 이메일도 휴대폰도 없어 통보할 수단이 없는 건. 0 이 아니면 연락처 정비가 필요하다. */
  noContact: number;
};

/**
 * SMS 로 보낸 독촉도 email_log 에 남긴다. 테이블 이름은 email 이지만 이 로그의 역할은
 * **"이 인보이스의 이 단계는 통보했다"** 이고, 그건 채널과 무관하다. 별도 sms_log 를
 * 만들면 멱등 확인을 두 곳에서 해야 하고 한쪽을 빠뜨리면 중복 독촉이 나간다.
 */
async function logDunningSms(
  invoiceId: number, key: string, to: string, name: string, messageId?: string,
): Promise<void> {
  await db.insert(emailLogsTable).values({
    template_code: key,
    to_email: to,            // SMS 는 번호가 수신자 식별자다
    to_name: name,
    subject: `[SMS] ${key}`,
    resend_message_id: messageId ?? null,
    status: "Sent",
    entity_type: "invoice",
    entity_id: invoiceId,
  });
}

/** 이 인보이스에 이 단계를 이미 보냈나. 보냈으면 다시 보내지 않는다. */
async function alreadySent(invoiceId: number, key: string): Promise<boolean> {
  const [row] = await db
    .select({ id: emailLogsTable.id })
    .from(emailLogsTable)
    .where(and(
      eq(emailLogsTable.entity_type, "invoice"),
      eq(emailLogsTable.entity_id, invoiceId),
      eq(emailLogsTable.template_code, key),
    ))
    .limit(1);
  return !!row;
}

/**
 * 연체 인보이스를 훑어 해당 단계 독촉을 보낸다.
 *
 * 한 인보이스에 대해 **가장 높은 미발송 단계 하나만** 보낸다. 30일 넘은 건에 1·2·3차를
 * 한꺼번에 쏟아붓지 않기 위해서다(크론이 처음 도입될 때 실제로 그런 사고가 난다).
 *
 * `dryRun` 이면 발송하지 않고 대상만 센다 — 도입 직전에 몇 통이 나갈지 확인한다.
 */
export async function sendRentDunning(opts: { dryRun?: boolean } = {}): Promise<DunningResult> {
  const enabled = (process.env.DUNNING_ENABLED ?? "").toLowerCase() === "true";
  if (!enabled && !opts.dryRun) {
    return { enabled: false, checked: 0, sent: 0, skipped: 0, failed: 0, noContact: 0 };
  }

  const today = new Date().toISOString().slice(0, 10);
  const stages = dunningStages();
  const maxDays = Math.min(...stages.map((s) => s.days));

  // 연체 인보이스 + 청구 대상 연락처. 이름·이메일이 없으면 보낼 수 없다.
  const rows = await db
    .select({
      id: invoicesTable.id,
      ref: invoicesTable.invoice_ref,
      amount: invoicesTable.amount,
      currency: invoicesTable.currency,
      dueDate: invoicesTable.due_date,
      contractId: invoicesTable.contract_id,
      email: contactsTable.email,
      mobile: contactsTable.mobile_number,
      firstName: contactsTable.first_name,
      lastName: contactsTable.last_name,
    })
    .from(invoicesTable)
    .leftJoin(contractsTable, eq(contractsTable.id, invoicesTable.contract_id))
    // 수신자 경로: invoice → account → primary_contact.
    // contacts 에는 account_id 가 없다(계정이 대표 연락처를 가리키는 방향).
    .leftJoin(accountsTable, eq(accountsTable.id, invoicesTable.account_id))
    .leftJoin(contactsTable, eq(contactsTable.id, accountsTable.primary_contact_id))
    .where(and(
      isNull(invoicesTable.deleted_at),
      eq(invoicesTable.status, "Overdue"),
      sql`${invoicesTable.due_date}::date <= (${today}::date - ${maxDays}::int)`,
    ));

  let sent = 0, skipped = 0, failed = 0, noContact = 0;

  for (const r of rows) {
    if (!r.dueDate) { skipped++; continue; }
    // 연락 수단이 아예 없으면 보낼 수 없다. 이메일이 없는 세입자가 대부분이므로
    // 둘 중 하나만 있어도 진행한다.
    if (!r.email && !r.mobile) { noContact++; continue; }

    const daysOverdue = Math.floor(
      (Date.parse(today) - Date.parse(String(r.dueDate))) / 86_400_000);

    // 높은 단계부터 확인해 **하나만** 보낸다.
    const stage = stages.find((s) => daysOverdue >= s.days);
    if (!stage) { skipped++; continue; }
    if (await alreadySent(r.id, stage.key)) { skipped++; continue; }

    if (opts.dryRun) { sent++; continue; }

    const name = [r.lastName, r.firstName].filter(Boolean).join("") || "고객";
    const vars = {
      recipient: name,
      ref: r.ref ?? String(r.id),
      amount: `${Number(r.amount ?? 0).toLocaleString()} ${r.currency ?? ""}`.trim(),
      due_date: String(r.dueDate),
      days_overdue: daysOverdue,
    };

    const ok = await notifyBilling({
      invoiceId: r.id, templateKey: stage.key, smsKey: "sms.rent_overdue",
      email: r.email, mobile: r.mobile, name, vars,
    });
    ok ? sent++ : failed++;
  }

  return { enabled: true, checked: rows.length, sent, skipped, failed, noContact };
}

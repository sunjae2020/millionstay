// 문자 발송 센터 — 관리자 컨트롤 패널의 뒷단.
//
// 연동 카드(키·발신번호·잔액)는 "개통이 됐나" 만 답한다. 실무에서 필요한 나머지 —
// 지금 바로 한 통 보내기, 누구에게 무엇이 나갔고 실패했는지, 문서 링크를 열었는지 —
// 를 한 화면에서 보게 하는 것이 이 라우터다. 발송은 전부 lib/sms.ts 를 거치고
// 이력은 email_log 에 남는다(채널 무관 통보 원장, lib/notify.ts 의 규칙과 같다).
import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, like, or, sql } from "drizzle-orm";
import { db, emailLogsTable, documentTemplatesTable, documentTemplateTranslationsTable } from "@workspace/db";
import { normalizeKrPhone, sendSms, smsBalance, smsBytes, smsConfigStatus, smsSenderIds, smsType } from "../lib/sms";
import { smsAutomationPaused } from "../lib/notify";
import { renderString } from "../lib/documents/templateEngine.js";
import { resolveEmailBrand } from "../lib/emailBrand.js";
import { buildOrderBy, parseListPage, parseSortParams, sendList, type SortMap } from "../utils/pagination";
import { logAction } from "../utils/auditLog";

const router: IRouter = Router();

/** SMS 이력의 판별 규칙 — notify.ts 가 남기는 형식(subject "[SMS] <key>")과 키 접두. */
const SMS_ROWS = or(like(emailLogsTable.subject, "[SMS]%"), like(emailLogsTable.template_code, "sms.%"))!;

/** 개통 상태 + 잔액. 잔액 조회는 SOLAPI 호출이라 무료지만 느릴 수 있어 status 에만 붙인다. */
router.get("/v1/sms/status", async (_req, res): Promise<void> => {
  const config = smsConfigStatus();
  const authed = config.api_key && config.api_secret;
  // 등록된 발신번호까지 같이 본다 — 설정값이 등록 목록에 없으면 한 통도 나가지
  // 않는데, 그건 발송해 봐야 드러나는 종류의 실패다.
  const [balance, senders] = authed
    ? await Promise.all([smsBalance(), smsSenderIds()])
    : [null, null];
  // 문안의 {{brand}} 는 발송 시점에 서버가 채운다. 화면 미리보기가 같은 값을
  // 보여 주려면 그 상호를 알아야 한다.
  const brand = await resolveEmailBrand().then((b) => b.name).catch(() => null);
  res.json({
    success: true,
    data: {
      ...config,
      balance,
      brand,
      registered_senders: senders,
      // 자동 발송이 멈춰 있으면 "왜 통보가 안 나가지" 를 화면이 먼저 말해 준다.
      automation_paused: smsAutomationPaused(),
      // null = 조회 실패(모름), false = 목록에 없음.
      sender_registered: senders == null ? null : !!config.sender_number && senders.includes(config.sender_number),
    },
  });
});

/** 발행된 SMS 문안 — 직접 발송 화면의 "문안 불러오기". 본문은 ko 만 있다(국내 전용). */
router.get("/v1/sms/templates", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      key: documentTemplatesTable.key,
      name: documentTemplatesTable.name,
      description: documentTemplatesTable.description,
      variables_schema: documentTemplatesTable.variables_schema,
      body: documentTemplateTranslationsTable.body_html,
    })
    .from(documentTemplatesTable)
    .innerJoin(documentTemplateTranslationsTable, and(
      eq(documentTemplateTranslationsTable.template_id, documentTemplatesTable.id),
      eq(documentTemplateTranslationsTable.locale, "ko"),
    ))
    .where(and(eq(documentTemplatesTable.kind, "sms"), eq(documentTemplatesTable.status, "published")))
    .orderBy(documentTemplatesTable.key);
  res.json({
    success: true,
    data: rows.map((r) => ({
      key: r.key, name: r.name, description: r.description, body: r.body,
      variables: Object.keys((r.variables_schema as Record<string, unknown>) ?? {}).filter((k) => k !== "kakao"),
    })),
  });
});

/**
 * 발송 이력 — email_log 의 SMS 행. 정렬·페이징은 공용 규약(sort/dir/limit/offset +
 * X-Total-Count). 필터: status, q(번호·이름·문안 키).
 */
const SORT: SortMap = {
  sent_at: emailLogsTable.sent_at,
  status: emailLogsTable.status,
  to_email: emailLogsTable.to_email,
  template_code: emailLogsTable.template_code,
};
router.get("/v1/sms/logs", async (req, res): Promise<void> => {
  const query = req.query as Record<string, unknown>;
  const p = parseListPage(query, { defaultLimit: 50, maxLimit: 5000, unpagedLimit: 5000 });
  const s = parseSortParams(query, SORT, { defaultKey: "sent_at", defaultDir: "desc" });
  const conds = [SMS_ROWS];
  const status = typeof query.status === "string" ? query.status.trim() : "";
  if (status) conds.push(eq(emailLogsTable.status, status));
  if (p.q) {
    const pat = `%${p.q}%`;
    conds.push(or(
      ilike(emailLogsTable.to_email, pat),
      ilike(emailLogsTable.to_name, pat),
      ilike(emailLogsTable.template_code, pat),
      ilike(emailLogsTable.error_message, pat),
    )!);
  }
  const where = and(...conds);
  const [rows, [cnt]] = await Promise.all([
    db.select().from(emailLogsTable).where(where)
      .orderBy(...buildOrderBy(SORT, s, emailLogsTable.id, [desc(emailLogsTable.sent_at), desc(emailLogsTable.id)]))
      .limit(p.limit).offset(p.offset),
    db.select({ total: sql<number>`count(*)` }).from(emailLogsTable).where(where),
  ]);
  sendList(res, rows.map((r) => ({
    id: r.id,
    sent_at: r.sent_at,
    to: r.to_email,
    to_name: r.to_name,
    template_code: r.template_code,
    status: r.status,
    message_id: r.resend_message_id,
    error_message: r.error_message,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
  })), Number(cnt?.total ?? 0), p);
});

/** 요약 — 오늘·이번 달 건수와 실패 수. 패널 상단 카드용. */
router.get("/v1/sms/summary", async (_req, res): Promise<void> => {
  const [row] = await db.select({
    today: sql<number>`count(*) filter (where ${emailLogsTable.sent_at} >= date_trunc('day', now()))`,
    month: sql<number>`count(*) filter (where ${emailLogsTable.sent_at} >= date_trunc('month', now()))`,
    failed_month: sql<number>`count(*) filter (where ${emailLogsTable.sent_at} >= date_trunc('month', now()) and ${emailLogsTable.status} = 'Failed')`,
  }).from(emailLogsTable).where(SMS_ROWS);
  res.json({ success: true, data: { today: Number(row?.today ?? 0), month: Number(row?.month ?? 0), failed_month: Number(row?.failed_month ?? 0) } });
});

/**
 * POST /v1/sms/send — 직접 발송.
 *   { to: string[] | {phone,name}[], text?: string, template_key?: string, vars?: {}, advertising?: boolean }
 * text 와 template_key 중 하나. 화면의 "문안 불러오기"는 본문을 채워 text 로 보내므로
 * 담당자가 고쳐 보낸 글이 그대로 나간다. 이력은 수신자마다 한 줄.
 */
router.post("/v1/sms/send", async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const rawTo = Array.isArray(body.to) ? body.to : typeof body.to === "string" ? body.to.split(/[\n,;]/) : [];
  const to: Array<{ phone: string; name: string | null }> = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const item of rawTo) {
    const raw = typeof item === "string" ? item : String((item as any)?.phone ?? "");
    const name = typeof item === "object" && item && typeof (item as any).name === "string" ? String((item as any).name).trim().slice(0, 60) || null : null;
    if (!raw.trim()) continue;
    const phone = normalizeKrPhone(raw);
    if (!phone) { invalid.push(raw.trim()); continue; }
    if (seen.has(phone)) continue;
    seen.add(phone);
    to.push({ phone, name });
  }
  if (invalid.length) { res.status(400).json({ success: false, error: { code: "INVALID_PHONE", message: `휴대폰 번호를 확인해 주세요: ${invalid[0]}` } }); return; }
  if (!to.length) { res.status(400).json({ success: false, error: { code: "NO_RECIPIENT", message: "받는 사람 번호를 입력해 주세요." } }); return; }
  if (to.length > 50) { res.status(400).json({ success: false, error: { code: "TOO_MANY", message: "한 번에 50명까지 보낼 수 있습니다." } }); return; }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const templateKey = typeof body.template_key === "string" && body.template_key.trim() ? body.template_key.trim() : undefined;
  if (!text && !templateKey) { res.status(400).json({ success: false, error: { code: "NO_TEXT", message: "보낼 내용을 입력해 주세요." } }); return; }
  const vars = body.vars && typeof body.vars === "object" ? (body.vars as Record<string, unknown>) : {};
  const advertising = body.advertising === true;
  const actorId = (req as any).user?.id ?? null;

  const results: Array<{ phone: string; name: string | null; ok: boolean; skipped: boolean; error?: string; type?: string; bytes?: number }> = [];
  for (const r of to) {
    const r2 = await sendSms({
      to: r.phone,
      templateKey,
      text: text ? renderString(text, { name: r.name ?? "고객", ...vars }) : undefined,
      vars: { name: r.name ?? "고객", ...vars },
      advertising,
    });
    await db.insert(emailLogsTable).values({
      template_code: templateKey ?? "sms.manual",
      to_email: r.phone,
      to_name: r.name,
      subject: `[SMS] ${templateKey ?? "sms.manual"}`,
      resend_message_id: r2.id ?? null,
      status: r2.ok ? "Sent" : r2.skipped ? "Skipped" : "Failed",
      error_message: r2.ok ? null : (r2.error ?? null),
      entity_type: null,
      entity_id: null,
    }).catch(() => {});
    results.push({ phone: r.phone, name: r.name, ok: r2.ok, skipped: !!r2.skipped, error: r2.error, type: r2.type, bytes: r2.bytes });
  }
  void logAction({
    entityType: "sms", entityId: 0, action: "CREATE", actorId,
    newValue: { to: results.map((x) => x.phone), template_key: templateKey ?? null, bytes: text ? smsBytes(text) : null, type: text ? smsType(text) : null, sent: results.filter((x) => x.ok).length },
  });
  const sent = results.filter((x) => x.ok).length;
  if (!sent) {
    const first = results[0];
    res.status(first?.skipped ? 503 : 502).json({
      success: false,
      error: { code: "SEND_FAILED", message: first?.error ?? "발송에 실패했습니다" },
      data: { results },
    });
    return;
  }
  res.json({ success: true, data: { sent, results } });
});

export default router;

// 문서 문자 보내기 — 종류를 가리지 않는 공통 경로.
//
// 이메일은 PDF 를 첨부해 보내지만 문자에는 파일을 실을 수 없다. 그래서 문자에서는
// **짧은 열람 링크**가 첨부를 대신한다 —
//
//   1. 미리보기 모달이 이미 받아 둔 바이트를 그대로 올린다(이메일 공통 경로
//      `/v1/documents/email-attachment` 와 같은 모양). 새 문서 종류가 생겨도
//      발송 경로를 따로 만들 필요가 없다.
//   2. 파일은 비공개 Cloudinary 에 두고, 수신자마다 토큰 하나를 발급한다
//      (`document_share_links`). 누가 열었는지가 토큰별로 남는다.
//   3. 문자 본문은 `sms.document_link` 문안(Studio 에서 수정 가능) + 링크 한 줄.
//      링크는 `https://<api>/d/<12자>` — 문자 길이가 곧 요금이라 API 도메인 바로
//      아래 가장 짧은 경로에 둔다.
//   4. 링크를 열면 서버가 파일을 그대로 흘려보낸다(브라우저 안에서 열림).
//      Cloudinary URL 을 직접 보내지 않는 이유는, 만료·회수를 우리 원장에서
//      하기 위해서다.
//
// 수신자 정책은 관리자 전용이다 — 번호를 직접 적는다. 세입자·오너 포털에는
// 붙이지 않는다(문자는 발신자 요금이 들고, 포털 사용자는 이미 문서를 보고 있다).
import { Router, type IRouter } from "express";
import multer from "multer";
import { randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, documentShareLinksTable } from "@workspace/db";
import { fetchPrivateAsset, isCloudinaryConfigured, uploadPrivateToCloudinary } from "../utils/cloudinary";
import { notifySms } from "../lib/notify";
import { normalizeKrPhone } from "../lib/sms";
import { decodeUploadFilename } from "../lib/uploadFilename";
import { logAction } from "../utils/auditLog";

/** 미리보기에 뜨는 것만 보낸다 — 임의 파일을 실어 나르는 통로가 되지 않도록. */
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png", "image/jpeg", "image/webp", "image/gif",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

/** 링크 유효기간(일). 청구서·계약서를 며칠 뒤에 다시 여는 일이 흔하다. */
const DEFAULT_EXPIRY_DAYS = 30;
const MAX_EXPIRY_DAYS = 180;

/**
 * 문안이 DB 에 없을 때의 대체 본문. 시드(`sms.document_link`)와 같은 글이어야
 * 한다 — 어느 인스턴스는 시드 전, 어느 인스턴스는 시드 후라도 같은 문자가 나가게.
 */
export const DOCUMENT_LINK_SMS_FALLBACK =
  "[{{brand}}] {{name}}님, {{doc_type}} 확인 부탁드립니다.\n{{url}}";

const adminRouter: IRouter = Router();
const publicRouter: IRouter = Router();

function fail(res: any, code: number, error: string, message: string): void {
  res.status(code).json({ success: false, error: { code: error, message } });
}

/** 12자 base62. 추측 불가능하면서 문자 한 줄에 들어갈 만큼 짧게. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; // 헷갈리는 0/O/1/l/I 제외
function newToken(): string {
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

// 링크의 기준 주소 — tenants/<instance>/config.env 의 PUBLIC_API_URL, 없으면 요청의 호스트.
function publicBaseUrl(req: { protocol: string; get: (h: string) => string | undefined }): string {
  const fromEnv = (process.env.PUBLIC_API_URL ?? "").trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const host = req.get("host") ?? "localhost";
  return `${req.protocol}://${host}`;
}

export function shareLinkUrl(req: any, token: string): string {
  return `${publicBaseUrl(req)}/d/${token}`;
}

interface Recipient { phone: string; name: string | null }

/** `to` 는 JSON 배열(문자열 또는 {phone,name}) 이나 쉼표 목록으로 들어온다. */
function parseRecipients(raw: unknown): { to: Recipient[]; invalid: string[] } {
  let list: unknown[] = [];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      list = Array.isArray(parsed) ? parsed : raw.split(/[,;]/);
    } catch { list = raw.split(/[,;]/); }
  } else if (Array.isArray(raw)) {
    list = raw;
  }
  const to: Recipient[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const phoneRaw = typeof item === "string" ? item : String((item as any)?.phone ?? "");
    const name = typeof item === "object" && item && typeof (item as any).name === "string"
      ? String((item as any).name).trim().slice(0, 60) || null
      : null;
    const trimmed = phoneRaw.trim();
    if (!trimmed) continue;
    const phone = normalizeKrPhone(trimmed);
    if (!phone) { invalid.push(trimmed); continue; }
    if (seen.has(phone)) continue;
    seen.add(phone);
    to.push({ phone, name });
  }
  return { to, invalid };
}

/* ── 관리자 — 번호를 직접 적는다 ─────────────────────────────────────────── */

/**
 * POST /v1/documents/sms-link  (multipart)
 *   file            미리보기에 떠 있는 문서 바이트
 *   filename        파일명(서버 규칙 이름이 있으면 그것)
 *   doc_type_label  문자 본문에 들어갈 문서 이름("계약서", "청구서" …)
 *   ref             문서 참조번호(선택)
 *   to              JSON 배열 — ["01012345678"] 또는 [{ phone, name }]
 *   entity_type / entity_id   이력·검색용(선택)
 *   expires_days    링크 유효기간(기본 30, 최대 180)
 */
adminRouter.post("/v1/documents/sms-link", upload.single("file"), async (req, res): Promise<void> => {
  try {
    const file = (req as any).file as { buffer: Buffer; mimetype?: string; originalname?: string } | undefined;
    if (!file) { fail(res, 400, "NO_FILE", "보낼 문서가 없습니다."); return; }
    const contentType = String(file.mimetype ?? "").split(";")[0]!.trim();
    if (!ALLOWED_TYPES.has(contentType)) {
      fail(res, 415, "UNSUPPORTED_TYPE", "이 형식은 문자 링크로 보낼 수 없습니다.");
      return;
    }
    if (!isCloudinaryConfigured()) {
      fail(res, 503, "STORAGE_NOT_CONFIGURED", "문서 저장소(Cloudinary)가 설정되지 않아 링크를 만들 수 없습니다.");
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const filename = decodeUploadFilename(
      (typeof body.filename === "string" && body.filename.trim()) || file.originalname || "document.pdf",
    ).slice(0, 200);
    const docTypeLabel = (typeof body.doc_type_label === "string" && body.doc_type_label.trim().slice(0, 40)) || "문서";
    const ref = typeof body.ref === "string" && body.ref.trim() ? body.ref.trim().slice(0, 120) : null;
    const entityType = typeof body.entity_type === "string" && body.entity_type.trim() ? body.entity_type.trim().slice(0, 32) : null;
    const entityIdRaw = Number(body.entity_id);
    const entityId = entityType && Number.isFinite(entityIdRaw) && entityIdRaw > 0 ? entityIdRaw : null;
    const daysRaw = Number(body.expires_days);
    const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(Math.floor(daysRaw), MAX_EXPIRY_DAYS) : DEFAULT_EXPIRY_DAYS;

    const { to, invalid } = parseRecipients(body.to);
    if (invalid.length) {
      fail(res, 400, "INVALID_PHONE", `휴대폰 번호를 확인해 주세요: ${invalid[0]}`);
      return;
    }
    if (!to.length) { fail(res, 400, "NO_RECIPIENT", "받는 사람 번호를 입력해 주세요."); return; }

    // 파일은 한 번만 올린다. 수신자마다 다른 것은 토큰뿐이다.
    const isPdf = contentType === "application/pdf";
    const up = await uploadPrivateToCloudinary(file.buffer, isPdf ? { format: "pdf" } : { resource_type: "auto" });
    const expiresAt = new Date(Date.now() + days * 86_400_000);
    const actorId = (req as any).user?.id ?? null;

    const results: Array<{ phone: string; name: string | null; url: string; sent: boolean; skipped: boolean; reason?: string }> = [];
    for (const r of to) {
      const token = newToken();
      await db.insert(documentShareLinksTable).values({
        token,
        cloudinary_public_id: up.public_id,
        resource_type: up.resource_type,
        file_name: filename,
        mime_type: contentType,
        file_size: file.buffer.length,
        label: docTypeLabel,
        ref,
        entity_type: entityType,
        entity_id: entityId,
        sent_to: r.phone,
        recipient_name: r.name,
        expires_at: expiresAt,
        created_by: actorId,
      });
      const url = shareLinkUrl(req, token);
      const sms = await notifySms({
        smsKey: "sms.document_link",
        text: DOCUMENT_LINK_SMS_FALLBACK,
        to: r.phone,
        name: r.name,
        vars: { name: r.name ?? "고객", doc_type: docTypeLabel, url, ref: ref ?? "" },
        // 같은 문서를 두 번 보내는 것은 의도일 수 있다(번호 정정·재발송) — 멱등 없음.
        entity: entityId ? { type: entityType!, id: entityId } : undefined,
        logKey: "sms.document_link",
      });
      results.push({ phone: r.phone, name: r.name, url, sent: sms.sent, skipped: sms.skipped, reason: sms.reason });
    }

    void logAction({
      entityType: entityType ?? "document", entityId: entityId ?? 0, action: "UPDATE",
      actorId,
      // 번호는 무엇을 누구에게 보냈는지의 증거다. 파일 내용은 남기지 않는다.
      newValue: { sms_link: filename, to: results.map((r) => r.phone), doc_type: docTypeLabel, ref, expires_at: expiresAt.toISOString() },
    });

    const anySent = results.some((r) => r.sent);
    if (!anySent) {
      const first = results[0];
      const message = first?.skipped
        ? `문자를 보내지 못했습니다 — ${first.reason === "SMS 미설정" ? "설정 → 연동 → 문자 카드에서 발신번호·API 키를 확인하세요." : first.reason ?? "미설정"}`
        : `문자를 보내지 못했습니다: ${first?.reason ?? "발송 실패"}`;
      res.status(first?.skipped ? 503 : 502).json({ success: false, error: { code: "SEND_FAILED", message }, data: { results } });
      return;
    }
    res.json({ success: true, data: { results, expires_at: expiresAt.toISOString() } });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err?.message ?? String(err));
  }
});

/**
 * GET /v1/documents/sms-links?entity_type=&entity_id=  — 이 레코드로 보낸 링크와
 * 열람 여부. 상세 화면이 "문자로 보냈는데 열어 봤나" 를 답하는 데 쓴다.
 */
adminRouter.get("/v1/documents/sms-links", async (req, res): Promise<void> => {
  const entityType = String(req.query.entity_type ?? "").trim();
  const entityId = Number(req.query.entity_id);
  const scoped = !!entityType && Number.isFinite(entityId);
  // 레코드 지정이 없으면 최근 발급분 — 문자 발송 센터의 "문서 링크" 탭.
  const rows = await db.select().from(documentShareLinksTable)
    .where(scoped ? and(eq(documentShareLinksTable.entity_type, entityType), eq(documentShareLinksTable.entity_id, entityId)) : undefined)
    .orderBy(sql`${documentShareLinksTable.created_at} DESC`)
    .limit(scoped ? 50 : 200);
  res.json({
    success: true,
    data: rows.map((r) => ({
      id: r.id, label: r.label, ref: r.ref, file_name: r.file_name,
      sent_to: r.sent_to, recipient_name: r.recipient_name,
      url: shareLinkUrl(req, r.token),
      expires_at: r.expires_at, viewed_at: r.viewed_at, view_count: r.view_count,
      revoked_at: r.revoked_at, created_at: r.created_at,
    })),
  });
});

/** POST /v1/documents/sms-links/:id/revoke — 잘못 보낸 링크를 그 자리에서 죽인다. */
adminRouter.post("/v1/documents/sms-links/:id/revoke", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { fail(res, 400, "INVALID_ID", "Invalid id"); return; }
  const [row] = await db.update(documentShareLinksTable)
    .set({ revoked_at: new Date() })
    .where(and(eq(documentShareLinksTable.id, id), isNull(documentShareLinksTable.revoked_at)))
    .returning({ id: documentShareLinksTable.id });
  if (!row) { fail(res, 404, "NOT_FOUND", "Not found"); return; }
  res.json({ success: true });
});

/* ── 공개 — 링크를 쥔 사람이 문서를 본다 ───────────────────────────────── */

function expiredPage(title: string, body: string): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f6f7f9;color:#1f2937}
main{max-width:22rem;padding:2rem;text-align:center}h1{font-size:1.1rem;margin:0 0 .5rem}p{font-size:.9rem;color:#4b5563;margin:0}</style></head>
<body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;
}

/**
 * GET /d/:token — 문서를 브라우저 안에서 연다.
 * 만료·회수된 링크는 410 안내 화면. 열람 시각과 횟수를 남긴다.
 */
publicRouter.get("/d/:token", async (req, res): Promise<void> => {
  const token = String(req.params.token ?? "").trim();
  if (!/^[A-Za-z0-9]{8,32}$/.test(token)) { res.status(404).send(expiredPage("링크를 찾을 수 없습니다", "주소를 다시 확인해 주세요.")); return; }
  const [row] = await db.select().from(documentShareLinksTable).where(eq(documentShareLinksTable.token, token));
  if (!row) { res.status(404).send(expiredPage("링크를 찾을 수 없습니다", "주소를 다시 확인해 주세요.")); return; }
  if (row.revoked_at || row.expires_at.getTime() < Date.now()) {
    res.status(410).send(expiredPage("만료된 링크입니다", "문서를 다시 받으시려면 보낸 곳에 문의해 주세요."));
    return;
  }

  const ext = row.file_name.includes(".") ? row.file_name.split(".").pop()! : "";
  const format = row.resource_type === "raw" ? "" : ext;
  try {
    const asset = await fetchPrivateAsset(row.cloudinary_public_id, { format, resourceType: row.resource_type });
    // 열람 기록은 응답과 무관하게 남긴다 — 실패해도 문서는 보여 준다.
    void db.update(documentShareLinksTable)
      .set({ viewed_at: new Date(), view_count: sql`${documentShareLinksTable.view_count} + 1` })
      .where(eq(documentShareLinksTable.id, row.id))
      .catch(() => {});
    res.setHeader("Content-Type", row.mime_type || asset.contentType);
    res.setHeader("Content-Length", asset.buffer.length);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(row.file_name)}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.end(asset.buffer);
  } catch (err) {
    console.error(`[document-sms] fetch failed (${row.file_name}):`, (err as any)?.message ?? err);
    res.status(502).send(expiredPage("문서를 불러오지 못했습니다", "잠시 후 다시 열어 주세요."));
  }
});

export {
  adminRouter as documentSmsAdminRouter,
  publicRouter as documentSmsPublicRouter,
};

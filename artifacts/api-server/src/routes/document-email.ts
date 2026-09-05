// 문서 메일 보내기 — 종류를 가리지 않는 공통 경로.
//
// 지금까지 미리보기 모달의 "이메일 보내기"는 문서 종류마다 전용 발송 엔드포인트가
// 있는 것(청구서·영수증·견적서·계약서)에만 붙었다. 정산서·점검표·신청서·업로드
// 스캔처럼 전용 경로가 없는 문서는 버튼 자체가 없어서, 담당자는 내려받아 자기
// 메일 프로그램으로 다시 보냈다. 그러면 무엇을 언제 누구에게 보냈는지가 시스템에
// 남지 않는다.
//
// 이 라우터는 **이미 화면에 떠 있는 그 문서**를 그대로 첨부해 보낸다. 미리보기가
// 이미 받아 둔 바이트를 되돌려 받아 붙이므로, 새 문서 종류가 생겨도 발송 경로를
// 따로 만들 필요가 없다.
//
// 전용 경로가 있는 문서는 계속 그쪽을 쓴다 — 그쪽은 수신자 후보를 레코드에서
// 뽑아 채워 주고 문서 종류에 맞는 본문을 쓴다. 이 공통 경로는 그것이 없는
// 문서를 위한 바닥이다.
//
// 수신자 정책이 화면마다 다르다:
//   관리자   — 주소를 직접 적는다(지금도 문서를 메일로 보내는 사람들이다).
//   세입자·오너 — **본인 주소로만** 간다. 포털에 로그인한 사람이 아무 주소로나
//               문서를 쏘게 두면 포털이 곧 유출 통로가 된다. 화면에서 주소를
//               받더라도 서버가 무시하고 토큰의 주소를 쓴다.
//   토큰 링크  — 로그인이 없는 화면(서명·점검·청구서)이다. 링크를 쥔 사람이
//               맞는지는 토큰이 증명하고, 받는 주소는 **그 링크 원장에 적힌 주소**를
//               쓴다. 화면에서 받은 주소는 절대 쓰지 않는다 — 링크가 남의 손에
//               들어갔을 때 임의 주소로 문서를 빼낼 수 있게 되기 때문이다.
import { Router, type IRouter } from "express";
import multer from "multer";
import { and, eq } from "drizzle-orm";
import { db, tenantAccessLinksTable, contractSigningRequestsTable, contactsTable } from "@workspace/db";
import { requireGuestAuth } from "../middlewares/requireGuestAuth";
import { requirePartnerAuth } from "../middlewares/requirePartnerAuth";
import { sendDocumentEmail } from "../lib/email";
import { normalizeLang } from "../lib/documents/i18n";
import { decodeUploadFilename } from "../lib/uploadFilename";
import { logAction } from "../utils/auditLog";

/** 미리보기에 뜨는 것만 보낸다 — 임의 파일을 실어 나르는 통로가 되지 않도록. */
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png", "image/jpeg", "image/webp", "image/gif",
  "text/plain", "text/csv",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  // 메일 첨부 한도(대개 25MB)보다 낮게 잡는다. 넘는 문서는 링크로 보내야 한다.
  limits: { fileSize: 15 * 1024 * 1024 },
});

const adminRouter: IRouter = Router();
const guestRouter: IRouter = Router();
const partnerRouter: IRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(res: any, code: number, error: string, message: string): void {
  res.status(code).json({ success: false, error: { code: error, message } });
}

interface Parsed {
  buffer: Buffer;
  filename: string;
  contentType: string;
  docTypeLabel: string;
  ref: string;
  lang: string;
  note: string | null;
}

/** 폼 필드를 훑는다. 파일이 없거나 종류가 아니면 그 자리에서 막는다. */
function parseBody(req: any, res: any): Parsed | null {
  const file = req.file;
  if (!file) { fail(res, 400, "NO_FILE", "보낼 문서가 없습니다."); return null; }
  const contentType = String(file.mimetype ?? "").split(";")[0]!.trim();
  if (!ALLOWED_TYPES.has(contentType)) {
    fail(res, 415, "UNSUPPORTED_TYPE", "이 형식은 메일로 보낼 수 없습니다.");
    return null;
  }
  const body = req.body ?? {};
  const filename = decodeUploadFilename(
    (typeof body.filename === "string" && body.filename.trim()) || file.originalname || "document.pdf",
  ).slice(0, 200);
  return {
    buffer: file.buffer,
    filename,
    contentType,
    docTypeLabel: (typeof body.doc_type_label === "string" && body.doc_type_label.trim()) || "문서",
    ref: (typeof body.ref === "string" && body.ref.trim()) || filename,
    lang: typeof body.lang === "string" ? body.lang : "",
    note: typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null,
  };
}

async function send(res: any, to: string[], p: Parsed) {
  const result = await sendDocumentEmail({
    to,
    docTypeLabel: p.docTypeLabel,
    ref: p.ref,
    pdf: p.buffer,
    filename: p.filename,
    contentType: p.contentType,
    note: p.note,
    lang: normalizeLang(p.lang || undefined),
  });
  if (!result.ok) {
    fail(res, result.skipped ? 503 : 502, "SEND_FAILED", result.error ?? "메일을 보내지 못했습니다.");
    return null;
  }
  return result;
}

/* ── 관리자 — 주소를 직접 적는다 ─────────────────────────────────────────── */

adminRouter.post("/v1/documents/email-attachment", upload.single("file"), async (req, res): Promise<void> => {
  try {
    const p = parseBody(req, res);
    if (!p) return;

    // `to` 는 JSON 배열 문자열이나 쉼표 목록으로 들어온다.
    const raw = (req.body ?? {}).to;
    let list: string[] = [];
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        list = Array.isArray(parsed) ? parsed.map(String) : String(raw).split(",");
      } catch { list = raw.split(","); }
    } else if (Array.isArray(raw)) {
      list = raw.map(String);
    }
    const to = [...new Set(list.map((x) => x.trim()).filter((x) => EMAIL_RE.test(x)))];
    if (!to.length) { fail(res, 400, "NO_RECIPIENT", "받는 사람 주소를 입력해 주세요."); return; }

    const result = await send(res, to, p);
    if (!result) return;

    void logAction({
      entityType: "document", entityId: 0, action: "UPDATE",
      actorId: (req as any).user?.id ?? null,
      // 주소는 무엇을 누구에게 보냈는지의 증거다. 파일 내용은 남기지 않는다.
      newValue: { emailed: p.filename, to, doc_type: p.docTypeLabel, ref: p.ref },
    });
    res.json({ success: true, data: { to, subject: result.subject } });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

/* ── 세입자 · 오너 — 본인 주소로만 ──────────────────────────────────────── */

/**
 * "내 메일로 받기". 화면이 주소를 보내더라도 무시하고 로그인한 사람의 주소를
 * 쓴다. 포털에서 임의 주소로 문서를 보낼 수 있으면 그 자체가 유출 경로다.
 */
function selfCopyHandler(who: "guest" | "partner") {
  return async (req: any, res: any): Promise<void> => {
    try {
      const p = parseBody(req, res);
      if (!p) return;
      const to = (req[who]?.email ?? "").trim();
      if (!EMAIL_RE.test(to)) {
        fail(res, 400, "NO_ACCOUNT_EMAIL", "계정에 등록된 이메일 주소가 없습니다.");
        return;
      }
      const result = await send(res, [to], p);
      if (!result) return;
      res.json({ success: true, data: { to: [to], subject: result.subject } });
    } catch (err: any) {
      fail(res, 500, "SERVER_ERROR", err.message);
    }
  };
}

guestRouter.post(
  "/v1/guest/documents/email-copy",
  requireGuestAuth,
  upload.single("file"),
  selfCopyHandler("guest"),
);

// 파트너 포털(오너·에이전트·서비스호스트) 공용. 인증을 라우터가 직접 걸어
// 마운트 순서에 기대지 않는다 — 파트너 라우트는 순서에 민감하다.
partnerRouter.post(
  "/v1/partner/documents/email-copy",
  requirePartnerAuth,
  upload.single("file"),
  selfCopyHandler("partner"),
);


/* ── 토큰 링크 — 로그인 없는 화면의 "내 메일로 받기" ────────────────────── */

/**
 * 토큰이 가리키는 상대의 주소. 두 원장을 다 본다 —
 * 서명이 정본인 링크는 `contract_signing_requests`, 나머지는 `tenant_access_links`.
 * 주소가 없으면 보내지 않는다(추측해서 보내면 남에게 갈 수 있다).
 */
async function recipientForToken(token: string): Promise<string | null> {
  const [link] = await db.select().from(tenantAccessLinksTable)
    .where(eq(tenantAccessLinksTable.token, token)).limit(1);
  if (link) {
    if (link.sent_to && EMAIL_RE.test(link.sent_to)) return link.sent_to;
    if (link.contact_id) {
      const [c] = await db.select({ email: contactsTable.email })
        .from(contactsTable).where(eq(contactsTable.id, link.contact_id)).limit(1);
      if (c?.email && EMAIL_RE.test(c.email)) return c.email;
    }
    return null;
  }

  const [signing] = await db.select().from(contractSigningRequestsTable)
    .where(eq(contractSigningRequestsTable.token, token)).limit(1);
  if (!signing) return null;
  // 서명 요청의 수신자는 signers 배열에 있다.
  const signers = Array.isArray(signing.signers) ? signing.signers : [];
  for (const sgn of signers as any[]) {
    const mail = typeof sgn?.email === "string" ? sgn.email.trim() : "";
    if (EMAIL_RE.test(mail)) return mail;
  }
  return null;
}

const publicRouter: IRouter = Router();

publicRouter.post("/v1/public/documents/email-copy", upload.single("file"), async (req, res): Promise<void> => {
  try {
    const p = parseBody(req, res);
    if (!p) return;
    const token = String((req.body ?? {}).token ?? "").trim();
    if (!token) { fail(res, 400, "NO_TOKEN", "유효하지 않은 링크입니다."); return; }

    const to = await recipientForToken(token);
    if (!to) {
      fail(res, 404, "NO_RECIPIENT", "이 링크에 등록된 이메일 주소가 없습니다. 담당자에게 문의해 주세요.");
      return;
    }
    const result = await send(res, [to], p);
    if (!result) return;
    // 주소는 돌려주지 않는다 — 링크를 쥔 사람이 등록 주소를 알아낼 이유가 없다.
    res.json({ success: true, data: { subject: result.subject } });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

export {
  adminRouter as documentEmailAdminRouter,
  publicRouter as documentEmailPublicRouter,
  guestRouter as documentEmailGuestRouter,
  partnerRouter as documentEmailPartnerRouter,
};

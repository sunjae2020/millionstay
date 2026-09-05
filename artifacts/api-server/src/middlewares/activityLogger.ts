import type { Request, Response, NextFunction } from "express";
import { db, userActivityLogsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { clientIp } from "../lib/clientIp";

/**
 * 사용자 활동 로거 — 값이 바뀌지 않는 행위를 남긴다.
 *
 * CUD 는 utils/auditLog.ts(logAction → system_log)가 전·후 값과 함께 남기므로
 * 여기서는 열람·다운로드·내보내기·AI/OCR·서류 발행·메일 발송만 잡는다. 응답이
 * 끝난 뒤(res.on("finish")) fire-and-forget 으로 INSERT 하므로 요청을 막지 않고,
 * 적재가 실패해도 사용자 요청은 이미 성공으로 끝나 있다.
 *
 * 규칙에 걸리지 않는 경로는 아무것도 남기지 않는다 — 모든 GET 을 남기면 하루
 * 수십만 행이 쌓이고 정작 봐야 할 행위가 묻힌다.
 */

type TrackRule = {
  re: RegExp;
  action: string;
  resourceType: string;
  methods?: string[];
};

const TRACKED: TrackRule[] = [
  // ── 문서·서류 ────────────────────────────────────────────────────────────
  { re: /^\/api\/v1\/documents\/\d+\/(file|download|preview)/, action: "DOWNLOAD", resourceType: "document", methods: ["GET"] },
  { re: /^\/api\/v1\/documents\/library/,                      action: "VIEW",     resourceType: "document", methods: ["GET"] },
  { re: /^\/api\/v1\/contracts\/\d+\/document/,                action: "DOC_ISSUE", resourceType: "contract" },
  { re: /^\/api\/v1\/invoices\/\d+\/(pdf|document)/,           action: "DOC_ISSUE", resourceType: "invoice" },
  { re: /^\/api\/v1\/quotes\/\d+\/(pdf|document)/,             action: "DOC_ISSUE", resourceType: "quote" },
  { re: /^\/api\/v1\/work-orders\/\d+\/(document|billing-statement)/, action: "DOC_ISSUE", resourceType: "work_order" },
  { re: /^\/api\/v1\/deposit-settlements\/\d+\/document/,      action: "DOC_ISSUE", resourceType: "deposit_settlement" },
  { re: /^\/api\/v1\/unit-inspections\/\d+\/document/,         action: "DOC_ISSUE", resourceType: "unit_inspection" },
  { re: /^\/api\/v1\/condition-reports\/\d+\/document/,        action: "DOC_ISSUE", resourceType: "condition_report" },

  // ── 내보내기 ─────────────────────────────────────────────────────────────
  { re: /^\/api\/v1\/.+\/export(\b|\/|$)/, action: "EXPORT", resourceType: "export" },
  { re: /^\/api\/v1\/reports\//,           action: "EXPORT", resourceType: "report", methods: ["GET"] },

  // ── AI · OCR ─────────────────────────────────────────────────────────────
  { re: /^\/api\/v1\/ai\//,                        action: "AI_CALL", resourceType: "ai",   methods: ["POST"] },
  { re: /^\/api\/v1\/translations\/ai-translate/,  action: "AI_CALL", resourceType: "translation", methods: ["POST"] },
  { re: /^\/api\/v1\/content-translations\/.*translate/, action: "AI_CALL", resourceType: "translation", methods: ["POST"] },
  { re: /ocr/i,                                    action: "OCR_RUN", resourceType: "ocr",  methods: ["POST"] },
  { re: /^\/api\/v1\/document-intake\/.*(analyz|classif|match)/i, action: "AI_CALL", resourceType: "document_intake", methods: ["POST"] },

  // ── 메일 발송 ────────────────────────────────────────────────────────────
  { re: /^\/api\/v1\/.+\/(send-email|email|send)$/, action: "SEND_EMAIL", resourceType: "email", methods: ["POST"] },
  { re: /^\/api\/v1\/marketing\/campaigns\/\d+\/send/, action: "SEND_EMAIL", resourceType: "campaign", methods: ["POST"] },

  // ── 대량 반입 ────────────────────────────────────────────────────────────
  { re: /^\/api\/v1\/(bank-import|document-intake\/upload|.*\/import)/, action: "IMPORT", resourceType: "import", methods: ["POST"] },
];

/** 경로 첫 숫자 세그먼트를 대상 id 로 본다(/v1/invoices/123/pdf → 123). */
function extractResourceId(path: string): number | null {
  const m = path.match(/\/(\d+)(?:\/|$)/);
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) ? n : null;
}

/** 소속(지점·팀)은 자주 안 바뀌므로 짧게 캐시한다 — 로그 한 줄에 조회 한 번은 과하다. */
type OrgEntry = { branch_id: number | null; team_id: number | null; expires: number };
const orgCache = new Map<number, OrgEntry>();
const ORG_TTL_MS = 5 * 60 * 1000;

async function orgOf(userId: number): Promise<{ branch_id: number | null; team_id: number | null }> {
  const now = Date.now();
  const hit = orgCache.get(userId);
  if (hit && hit.expires > now) return hit;
  try {
    const [u] = await db
      .select({ branch_id: usersTable.branch_id, team_id: usersTable.team_id })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    const entry: OrgEntry = {
      branch_id: u?.branch_id ?? null,
      team_id: u?.team_id ?? null,
      expires: now + ORG_TTL_MS,
    };
    orgCache.set(userId, entry);
    return entry;
  } catch {
    return { branch_id: null, team_id: null };
  }
}

/** 검색어·프롬프트는 본문을 남기지 않는다 — 길이와 해시만으로 묶어 보기에 충분하다. */
function digest(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `len=${s.length},h=${(h >>> 0).toString(16)}`;
}

export function activityLogger(req: Request, res: Response, next: NextFunction): void {
  const started = Date.now();

  res.on("finish", () => {
    void (async () => {
      try {
        const path = req.originalUrl.split("?")[0] || "";
        const rule = TRACKED.find(
          (r) => r.re.test(path) && (!r.methods || r.methods.includes(req.method.toUpperCase())),
        );
        if (!rule) return;

        // 인증 전(로그인 실패 등)은 routes/auth.ts 가 직접 남긴다.
        const user = (req as any).user as { id?: number; email?: string; role?: string } | undefined;
        if (!user?.id) return;

        const org = await orgOf(user.id);

        const meta: Record<string, unknown> = {};
        const rawQ = (req.query as Record<string, unknown>)?.q ?? (req.query as Record<string, unknown>)?.search;
        if (typeof rawQ === "string" && rawQ.length > 0) meta["search"] = digest(rawQ);
        const len = res.getHeader("content-length");
        if (len) meta["bytes"] = Number(len);

        await db.insert(userActivityLogsTable).values({
          actor_id: user.id,
          actor_email: user.email ?? null,
          actor_role: user.role ?? null,
          branch_id: org.branch_id,
          team_id: org.team_id,
          action: rule.action,
          resource_type: rule.resourceType,
          resource_id: extractResourceId(path),
          method: req.method.toUpperCase().slice(0, 10),
          path: path.slice(0, 500),
          status_code: res.statusCode,
          duration_ms: Date.now() - started,
          metadata: Object.keys(meta).length > 0 ? meta : null,
          ip_address: clientIp(req).slice(0, 60) || null,
          user_agent: String(req.headers["user-agent"] ?? "").slice(0, 500) || null,
        });
      } catch (err) {
        console.warn("[activityLogger] insert failed:", (err as Error)?.message ?? err);
      }
    })();
  });

  next();
}

/**
 * 인증 이벤트 전용 기록기. 로그인 실패 시점에는 인증된 사용자가 없어 미들웨어가
 * 잡을 수 없으므로 routes/auth.ts 에서 직접 부른다.
 */
export async function logAuthEvent(params: {
  action: "LOGIN" | "LOGOUT" | "LOGIN_FAILED";
  actorId?: number | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const org = params.actorId ? await orgOf(params.actorId) : { branch_id: null, team_id: null };
    await db.insert(userActivityLogsTable).values({
      actor_id: params.actorId ?? null,
      actor_email: params.actorEmail ?? null,
      actor_role: params.actorRole ?? null,
      branch_id: org.branch_id,
      team_id: org.team_id,
      action: params.action,
      resource_type: "auth",
      method: "POST",
      path: "/api/v1/auth",
      metadata: params.metadata ?? null,
      ip_address: params.ipAddress?.slice(0, 60) ?? null,
      user_agent: params.userAgent?.slice(0, 500) ?? null,
    });
  } catch (err) {
    console.warn("[logAuthEvent] insert failed:", (err as Error)?.message ?? err);
  }
}

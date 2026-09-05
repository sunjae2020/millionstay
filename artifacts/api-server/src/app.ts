import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import session from "express-session";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { isOriginAllowed } from "./lib/allowedOrigins";
import router from "./routes";
import authRouter from "./routes/auth";
import passkeysRouter from "./routes/passkeys";
import healthRouter from "./routes/health";
import publicRouter from "./routes/public";
import spaceImagesRouter from "./routes/space-images";
import propertyImagesRouter from "./routes/property-images";
import guestAuthRouter from "./routes/guest-auth";
import guestPortalRouter from "./routes/guest-portal";
import guestCsRouter from "./routes/guest-cs";
import devMigrationRouter from "./routes/dev-migration";
import dbSyncRouter from "./routes/db-sync";
import systemMapRouter from "./routes/system-map";
import stripeRouter from "./routes/stripe";
import adminUsersRouter from "./routes/admin-users";
import partnerAuthRouter from "./routes/partner-auth";
import partnerPrivacyRouter from "./routes/partner-privacy";
import agentPortalRouter from "./routes/agent-portal";
import ownerPortalRouter from "./routes/owner-portal";
import brandingRouter from "./routes/branding";
import serviceHostPortalRouter from "./routes/service-host-portal";
import partnerCsRouter from "./routes/partner-cs";
import { homestayPublicRouter, homestayPortalRouter } from "./routes/homestay";
import { contractSigningPublicRouter, contractSigningAdminRouter } from "./routes/contract-signing";
import { unitInspectionsAdminRouter, unitInspectionsPublicRouter } from "./routes/unit-inspections";
import { tenantLinksAdminRouter, tenantLinksPublicRouter, tenantLinksGuestRouter } from "./routes/tenant-links";
import {
  documentEmailAdminRouter, documentEmailGuestRouter, documentEmailPartnerRouter,
  documentEmailPublicRouter,
} from "./routes/document-email";
import helpDocsRouter from "./routes/help-docs";
import { homestayStudentPublicRouter } from "./routes/homestay-students";
import { shortTermPublicRouter } from "./routes/short-term";
import pageContentsRouter from "./routes/page-contents";
import mediaRouter from "./routes/media";
import privacyRouter from "./routes/privacy";
import marketingWebhooksRouter from "./routes/marketing-webhooks";
import chatRouter from "./routes/chat";
import knowledgeRouter from "./routes/knowledge";
import externalApiRouter from "./routes/external-api";
import rolesRouter from "./routes/roles";
import { conditionReportsAdminRouter, conditionReportsGuestRouter } from "./routes/condition-reports";
import { depositSettlementsAdminRouter, depositSettlementsGuestRouter } from "./routes/deposit-settlements";
import { logger } from "./lib/logger";
import { requireAuth } from "./middlewares/requireAuth";
import { activityLogger } from "./middlewares/activityLogger";
import { requestContext } from "./lib/requestContext";
import { originGuard } from "./middlewares/originGuard";
import { loginLimiter, applicationLimiter, generalLimiter, privacyExportLimiter, chatLimiter } from "./middlewares/rateLimit";

// Resolve the directory of this file — works both in source and in the esbuild bundle.
// In the bundle (artifacts/api-server/dist/index.mjs), import.meta.url correctly
// points to the bundle file, so __thisDir = .../artifacts/api-server/dist/
const __thisDir = path.dirname(fileURLToPath(import.meta.url));

// ─── Required environment variables (Sprint A-3) ───
// Refuse to start if any critical secret is missing. No hardcoded fallbacks.
const REQUIRED_ENV = ["DATABASE_URL", "SESSION_SECRET"] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    // eslint-disable-next-line no-console
    console.error(`[FATAL] Required environment variable "${key}" is not set. Server cannot start.`);
    process.exit(1);
  }
}
if (!process.env["JWT_SECRET"] && !process.env["SESSION_SECRET"]) {
  // eslint-disable-next-line no-console
  console.error('[FATAL] At least one of "JWT_SECRET" or "SESSION_SECRET" must be set.');
  process.exit(1);
}

const SESSION_SECRET = process.env["SESSION_SECRET"]!;

// ─── CORS allow-list (Sprint A-2) ───
// Production: only origins listed in ALLOWED_ORIGINS (comma-separated) are allowed.
// Development: also allow localhost so the local workspace works.
// The predicate itself lives in lib/allowedOrigins so WebAuthn can pin its
// expected origins to exactly the same set.
const isProduction = process.env["NODE_ENV"] === "production";

const app: Express = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin / non-browser requests (no Origin header: curl, server-to-server)
    if (!origin) {
      cb(null, true);
      return;
    }
    if (isOriginAllowed(origin)) {
      cb(null, true);
      return;
    }
    logger.warn({ origin }, "CORS blocked: origin not in allow-list");
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  // 리스트 전체 건수는 응답 스키마를 바꾸지 않으려고 헤더로 나간다(utils/pagination.ts
  // sendList). 브라우저는 노출 목록에 없는 헤더를 읽지 못하므로 여기에 반드시 넣는다.
  exposedHeaders: ["X-Total-Count", "X-Page-Limit", "X-Page-Offset"],
}));

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true, // refresh maxAge on every authenticated request
    cookie: {
      secure: process.env["NODE_ENV"] === "production",
      httpOnly: true,
      sameSite: "lax", // cross-site form submissions ok, third-party fetch blocked
      maxAge: 4 * 60 * 60 * 1000, // 4h idle (was 8h absolute) — APP 11 (security)
    },
  }),
);

// APP 11 — additional privacy/security headers beyond helmet defaults.
app.use((_req, res, next) => {
  // Permissions-Policy: deny features unless explicitly needed
  res.setHeader(
    "Permissions-Policy",
    // camera=(self): the field web app photographs work orders in-browser
    // (작업 전/후 사진). Denying it here would break capture on the SPAs this
    // server also hosts. Third parties stay denied.
    "camera=(self), microphone=(), geolocation=(self), payment=(self), interest-cohort=()",
  );
  // Referrer-Policy: don't leak full URLs to external sites
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // X-Robots-Tag for API: not indexable
  if (!res.getHeader("X-Robots-Tag")) {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
  }
  next();
});

// ── Origin lock ── reject /api requests that didn't arrive through Cloudflare
// (no valid X-Edge-Secret). No-op until ORIGIN_SHARED_SECRET is set. Runs before
// webhooks + routes so a direct-to-origin caller can't reach any handler.
app.use("/api", originGuard);

app.use(
  "/api/v1/stripe/webhook",
  express.raw({ type: "application/json" }),
);

// Same reason as Stripe above: the Svix signature covers the exact bytes Resend
// sent, so this path must keep its raw body. express.json() would consume it and
// every signature check would fail.
app.use(
  "/api/v1/marketing/webhooks/resend",
  express.raw({ type: "application/json" }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CF-024 — Rate limits for high-risk endpoints (effective in production only).
app.use([
  "/api/v1/auth/login",
  "/api/v1/auth/partner/login",
  "/api/v1/auth/guest/login",
  "/api/v1/auth/guest/register",
  "/api/v1/auth/forgot-password",
  "/api/v1/auth/guest/forgot-password",
  "/api/v1/auth/partner/forgot-password",
  "/api/v1/auth/reset-password",
  "/api/v1/auth/guest/reset-password",
  "/api/v1/auth/partner/reset-password",
  // Passkey sign-in is unauthenticated and hands out session tokens — same
  // budget as password login.
  "/api/v1/auth/passkey/login/options",
  "/api/v1/auth/passkey/login/verify",
], loginLimiter);
app.use([
  "/api/v1/public/owner-applications",
  "/api/v1/public/agent-applications",
  "/api/v1/public/service-host-applications",
  "/api/v1/public/homestay-host-applications",
  "/api/v1/public/homestay-student-requests",
  "/api/v1/public/short-term-applications",
  // Public e-signature endpoints (sign/preview/pdf/send) — token-gated but
  // otherwise anonymous; cap them like other public application routes so a
  // leaked token can't be used to hammer PDF rendering/email (H-203).
  "/api/v1/public/contract-signing",
], applicationLimiter);
// Public, unauthenticated write/upload endpoints that previously only fell
// through to generalLimiter (300/min). Each POST fans out email (auth/register
// notifies every SuperAdmin — mail-bomb vector), creates DB rows (inquiries) or
// writes to Cloudinary (no-login token uploads), so cap them at the application
// tier (100/min/IP). Same skip rule as every limiter: disabled outside prod.
app.use([
  "/api/v1/auth/register",
  "/api/v1/public/contact-inquiries",
  "/api/v1/public/sales-inquiries",
  "/api/v1/public/listing-inquiries",
  "/api/v1/public/long-term-inquiries",
  "/api/v1/public/management-inquiries",
  "/api/v1/public/student-inquiries",
  "/api/v1/public/sites/:slug/inquiry",
  "/api/v1/public/sale-listings/:id/inquiry",
  // No-login token uploads (세입자 온보딩 링크 + 세대점검표) — multer +
  // Cloudinary writes behind a bearer-less token; a leaked token must not be
  // able to hammer storage.
  "/api/v1/public/doc-requests/:token/upload",
  "/api/v1/public/intake/:token/photo",
  "/api/v1/public/unit-inspections/:token/photos",
], applicationLimiter);
app.use([
  "/api/v1/guest/me/data",
  "/api/v1/guest/me/export",
  "/api/v1/guest/me/deletion-request",
], privacyExportLimiter);
app.use("/api/v1/public/chat", chatLimiter);
app.use("/api/", generalLimiter);

// 요청 컨텍스트 — 인증 미들웨어가 심는 행위자와 IP 를 감사 로그가 인자 없이도
// 읽게 한다. 라우터·인증보다 먼저 걸려 있어야 컨텍스트가 요청 전 구간을 덮는다.
app.use("/api", requestContext);

// 사용자 활동 로그 — 열람·다운로드·내보내기·AI/OCR·서류 발행을 응답 종료 후
// 비동기로 남긴다. 라우터보다 먼저 걸어 두지만 실제 기록은 res.on("finish")
// 시점이라 requireAuth 가 채운 req.user 를 그대로 읽는다. (CUD 는 system_log.)
app.use("/api", activityLogger);

app.use("/api", authRouter);
// Passkeys — the login half is anonymous and the register half authenticates
// itself against whichever token scope the caller presents, so this must sit
// before the admin requireAuth guard.
app.use("/api", passkeysRouter);
app.use("/api", healthRouter);
app.use("/api", publicRouter);
// Public homestay host application submission (no auth, rate-limited above).
app.use("/api", homestayPublicRouter);
// Public e-signature: token-addressed signing page fetch + submit (no auth).
app.use("/api", contractSigningPublicRouter);
// 세대점검표 — tenant signing link (token-addressed, no login). Must sit before
// the global requireAuth guard.
app.use("/api", unitInspectionsPublicRouter);
// Public homestay student application intake (no auth).
app.use("/api", homestayStudentPublicRouter);
// Public short-term accommodation application intake (no auth).
app.use("/api", shortTermPublicRouter);
// 세입자 온보딩 링크 — 청구서 조회·입금 통보 / 서류 제출 (토큰, 로그인 없음).
// requireAuth 앞에 있어야 한다.
app.use("/api", tenantLinksPublicRouter);
// 토큰 링크 화면의 "내 메일로 받기" — 받는 주소는 서버가 원장에서 고른다.
app.use("/api", documentEmailPublicRouter);
app.use("/api", chatRouter);
app.use("/api", privacyRouter);
// Resend campaign event webhook — the caller is Resend, not an admin, so it is
// mounted before requireAuth and authenticates by Svix signature instead. It
// parses its own raw body (the signature covers the exact bytes).
app.use("/api", marketingWebhooksRouter);
// External third-party API — authenticates with issued API Key + Secret
// (requireApiKey inside the router), NOT the admin JWT. Mounted before the
// requireAuth guard so it is never caught by admin authentication.
app.use("/api/ext", externalApiRouter);
app.use("/api", guestAuthRouter);
app.use("/api", guestPortalRouter);
app.use("/api", guestCsRouter);
// Condition reports — tenant side (self-guards with requireGuestAuth on /v1/guest).
app.use("/api", conditionReportsGuestRouter);
app.use("/api", depositSettlementsGuestRouter);
// 세입자 포털 — 로그인한 세입자의 "해야 할 일"(자기 링크 다시 찾기).
app.use("/api", tenantLinksGuestRouter);
// 문서 메일 — 세입자·파트너는 "내 메일로 받기"만 된다(각 라우터가 인증을 직접 건다).
// 관리자 가드 앞에 있어야 한다.
app.use("/api", documentEmailGuestRouter);
app.use("/api", documentEmailPartnerRouter);
app.use("/api", stripeRouter);
// dev-migration: NEVER mount in production. CF-004 hard block.
if (process.env["NODE_ENV"] !== "production") {
  app.use("/api/v1/admin", devMigrationRouter);
}

// Partner auth + portals — must be registered BEFORE adminUsersRouter which applies requireAuth
// to every request passing through it via router.use(requireAuth)
app.use("/api", partnerAuthRouter);
app.use("/api", partnerPrivacyRouter);
app.use("/api", agentPortalRouter);
app.use("/api", ownerPortalRouter);
app.use("/api", serviceHostPortalRouter);
// Partner support tickets — any partner type (agent/owner/service_host) can open
// a ticket with admin. Scoped to the caller's own tickets; no peer-to-peer.
app.use("/api", partnerCsRouter);
// Homestay host portal — partner JWT (portal_type='homestay'); login works
// regardless of approval. Mounted before requireAuth like the other portals.
app.use("/api", homestayPortalRouter);

// Branding settings — GET /v1/branding is PUBLIC (login screen themes itself);
// PUT + upload apply requireAuth inline. Mounted BEFORE the global guard so the
// public GET is never caught by admin authentication.
app.use("/api", brandingRouter);

app.use("/api", adminUsersRouter);
app.use("/api/v1", requireAuth);

// Super Admin only — DB snapshot & sync (auth enforced by requireAuth above,
// role enforced by requireSuperAdmin inside the router)
app.use("/api/v1/admin", dbSyncRouter);

// Super Admin only — System Map: live platform snapshot (DB shape, integrations,
// jobs, API census, schema browser). Role enforced by requireSuperAdmin inside.
app.use("/api/v1/admin", systemMapRouter);

app.use("/api", spaceImagesRouter);
app.use("/api", propertyImagesRouter);
app.use("/api", knowledgeRouter);
app.use("/api", pageContentsRouter);
app.use("/api", mediaRouter);
// Admin e-signature management (create / list / cancel) — behind requireAuth.
app.use("/api", contractSigningAdminRouter);
// Roles & permission matrix (RBAC) — admin; writes SuperAdmin-only inside.
app.use("/api", rolesRouter);
// Condition reports — admin side (self-guards with requireAuth on /v1).
app.use("/api", conditionReportsAdminRouter);
// 세대점검표 — admin side (self-guards with requireAuth on /v1).
app.use("/api", unitInspectionsAdminRouter);
app.use("/api", depositSettlementsAdminRouter);
// 세입자 온보딩 링크 — 관리자 발급·회수·대기열 (requireAuth 뒤).
app.use("/api", tenantLinksAdminRouter);
// 문서 메일(관리자) — 전용 발송 경로가 없는 문서를 미리보기에서 그대로 보낸다.
app.use("/api", documentEmailAdminRouter);
// 내부 문서함 — 운영 지도·정책 문서·세입자 링크 목록(직원 교육용).
app.use("/api", helpDocsRouter);
app.use("/api", router);

// In production, serve the built SPAs so a single Cloud Run process handles everything.
// The build step copies both SPAs into dist/static/{admin,web} alongside this bundle.
if (process.env["NODE_ENV"] === "production") {
  // Primary: sibling "static/" folder next to the running bundle file
  // Fallback: repo-root based path (for when CWD is the workspace root)
  const staticFromBundle = path.resolve(__thisDir, "static");
  const staticFromCwd = path.resolve(process.cwd(), "artifacts/api-server/dist/static");
  // Pick whichever resolves to an existing directory
  const staticBase = existsSync(staticFromBundle) ? staticFromBundle : staticFromCwd;

  logger.info({ staticBase, __thisDir, cwd: process.cwd() }, "Static file serving initialized");

  // Admin SPA — served at /admin
  const adminDir = path.join(staticBase, "admin");
  const adminIndex = path.join(adminDir, "index.html");
  app.use("/admin", express.static(adminDir, { index: false }));
  app.use("/admin", (_req, res) => {
    res.sendFile(adminIndex, (err) => {
      if (err) {
        logger.error({ err, adminIndex }, "Failed to serve admin SPA index");
        res.status(503).send("Admin portal unavailable");
      }
    });
  });

  // Guest / public web portal — catch-all (must be last)
  const webDir = path.join(staticBase, "web");
  const webIndex = path.join(webDir, "index.html");
  app.use(express.static(webDir, { index: false }));
  app.use((_req, res) => {
    res.sendFile(webIndex, (err) => {
      if (err) {
        logger.error({ err, webIndex }, "Failed to serve web SPA index");
        res.status(503).send("Web portal unavailable");
      }
    });
  });
}

// ── Central JSON error handler ── registered last so it catches every error any
// route or middleware forwards (Express 5 also routes rejected async handlers
// here). Without it, Express's default handler renders an HTML error page — and
// in dev, the full stack trace. Preserves the status an upstream middleware
// attached (body-parser 400/413, etc.) so existing monitors see the same codes;
// only the body format changes from HTML to the API's `{ error }` JSON shape.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const fromErr =
    typeof err?.status === "number" ? err.status
    : typeof err?.statusCode === "number" ? err.statusCode
    : 500;
  const status = fromErr >= 400 && fromErr < 600 ? fromErr : 500;

  logger.error(
    { err, reqId: (req as any).id, method: req.method, path: req.path, status },
    "Unhandled request error",
  );

  if (res.headersSent) {
    // Response already streaming — delegate so Node tears the socket down.
    next(err);
    return;
  }

  // Never leak internals in production: only messages explicitly marked safe
  // (http-errors sets `expose` for 4xx, e.g. body-parser's "invalid JSON") get
  // through; everything else collapses to a generic message. Dev keeps detail.
  const message = !isProduction
    ? String(err?.message ?? "Internal server error")
    : err?.expose === true && err?.message && status < 500
      ? String(err.message)
      : status >= 500
        ? "Internal server error"
        : "Request failed";

  res.status(status).json({ error: message });
});

export default app;

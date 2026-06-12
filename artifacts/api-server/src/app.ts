import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import session from "express-session";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import router from "./routes";
import authRouter from "./routes/auth";
import healthRouter from "./routes/health";
import publicRouter from "./routes/public";
import spaceImagesRouter from "./routes/space-images";
import guestAuthRouter from "./routes/guest-auth";
import guestPortalRouter from "./routes/guest-portal";
import guestCsRouter from "./routes/guest-cs";
import devMigrationRouter from "./routes/dev-migration";
import dbSyncRouter from "./routes/db-sync";
import stripeRouter from "./routes/stripe";
import adminUsersRouter from "./routes/admin-users";
import partnerAuthRouter from "./routes/partner-auth";
import agentPortalRouter from "./routes/agent-portal";
import ownerPortalRouter from "./routes/owner-portal";
import serviceHostPortalRouter from "./routes/service-host-portal";
import { homestayPublicRouter, homestayPortalRouter } from "./routes/homestay";
import { contractSigningPublicRouter, contractSigningAdminRouter } from "./routes/contract-signing";
import pageContentsRouter from "./routes/page-contents";
import privacyRouter from "./routes/privacy";
import chatRouter from "./routes/chat";
import knowledgeRouter from "./routes/knowledge";
import externalApiRouter from "./routes/external-api";
import { logger } from "./lib/logger";
import { requireAuth } from "./middlewares/requireAuth";
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
// Development: also allow localhost and Replit preview domains so the workspace works.
const isProduction = process.env["NODE_ENV"] === "production";
const ALLOWED_ORIGINS = (process.env["ALLOWED_ORIGINS"] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isOriginAllowed(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    // Always allow our own apex + ANY subdomain over https. Owner landing sites
    // create arbitrary {slug}.millionstay.com origins that must reach the public
    // API; authenticated routes are still gated by JWT, so this is safe.
    if (protocol === "https:" && (hostname === "millionstay.com" || hostname.endsWith(".millionstay.com"))) {
      return true;
    }
    if (isProduction) return false;
    // Dev-only allowances
    if (protocol !== "http:" && protocol !== "https:") return false;
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    if (hostname.endsWith(".replit.dev")) return true;
    if (hostname.endsWith(".replit.app")) return true;
    if (hostname.endsWith(".repl.co")) return true;
    return false;
  } catch {
    return false;
  }
}

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
    "camera=(), microphone=(), geolocation=(self), payment=(self), interest-cohort=()",
  );
  // Referrer-Policy: don't leak full URLs to external sites
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // X-Robots-Tag for API: not indexable
  if (!res.getHeader("X-Robots-Tag")) {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
  }
  next();
});

app.use(
  "/api/v1/stripe/webhook",
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
], loginLimiter);
app.use([
  "/api/v1/public/owner-applications",
  "/api/v1/public/agent-applications",
  "/api/v1/public/service-host-applications",
  "/api/v1/public/homestay-host-applications",
], applicationLimiter);
app.use([
  "/api/v1/guest/me/data",
  "/api/v1/guest/me/export",
  "/api/v1/guest/me/deletion-request",
], privacyExportLimiter);
app.use("/api/v1/public/chat", chatLimiter);
app.use("/api/", generalLimiter);

app.use("/api", authRouter);
app.use("/api", healthRouter);
app.use("/api", publicRouter);
// Public homestay host application submission (no auth, rate-limited above).
app.use("/api", homestayPublicRouter);
// Public e-signature: token-addressed signing page fetch + submit (no auth).
app.use("/api", contractSigningPublicRouter);
app.use("/api", chatRouter);
app.use("/api", privacyRouter);
// External third-party API — authenticates with issued API Key + Secret
// (requireApiKey inside the router), NOT the admin JWT. Mounted before the
// requireAuth guard so it is never caught by admin authentication.
app.use("/api/ext", externalApiRouter);
app.use("/api", guestAuthRouter);
app.use("/api", guestPortalRouter);
app.use("/api", guestCsRouter);
app.use("/api", stripeRouter);
// dev-migration: NEVER mount in production. CF-004 hard block.
if (process.env["NODE_ENV"] !== "production") {
  app.use("/api/v1/admin", devMigrationRouter);
}

// Partner auth + portals — must be registered BEFORE adminUsersRouter which applies requireAuth
// to every request passing through it via router.use(requireAuth)
app.use("/api", partnerAuthRouter);
app.use("/api", agentPortalRouter);
app.use("/api", ownerPortalRouter);
app.use("/api", serviceHostPortalRouter);
// Homestay host portal — partner JWT (portal_type='homestay'); login works
// regardless of approval. Mounted before requireAuth like the other portals.
app.use("/api", homestayPortalRouter);

app.use("/api", adminUsersRouter);
app.use("/api/v1", requireAuth);

// Super Admin only — DB snapshot & sync (auth enforced by requireAuth above,
// role enforced by requireSuperAdmin inside the router)
app.use("/api/v1/admin", dbSyncRouter);

app.use("/api", spaceImagesRouter);
app.use("/api", knowledgeRouter);
app.use("/api", pageContentsRouter);
// Admin e-signature management (create / list / cancel) — behind requireAuth.
app.use("/api", contractSigningAdminRouter);
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

export default app;

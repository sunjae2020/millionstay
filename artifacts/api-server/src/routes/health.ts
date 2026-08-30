import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const router: IRouter = Router();

// Liveness — ALWAYS 200 while the process is up, with no dependency checks.
// Restart probes point here; making it fail on a DB blip would cause restart
// storms. Do not add checks to this endpoint — use /readyz below instead.
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Readiness — 200 only when the DB answers a cheap `select 1` within 2s,
// 503 otherwise. Point load balancers / uptime monitors that should stop
// routing traffic during a DB outage here; it never restarts the process.
router.get("/readyz", async (_req, res) => {
  const startedAt = Date.now();
  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise<never>((_resolve, reject) => {
        const t = setTimeout(() => reject(new Error("DB readiness check timed out")), 2_000);
        t.unref();
      }),
    ]);
    res.json({ status: "ok", db: "ok", latency_ms: Date.now() - startedAt });
  } catch {
    res.status(503).json({ status: "unavailable", db: "unreachable" });
  }
});

// Public status summary. Deliberately does NOT disclose NODE_ENV or the
// Stripe live/test mode — this endpoint is unauthenticated, and key mode is
// reconnaissance data. Admins see the full detail (incl. stripe mode) at the
// authenticated /v1/integrations/status. `commit` makes "deployed == source"
// verifiable (Railway injects RAILWAY_GIT_COMMIT_SHA at build time).
router.get("/v1/health", (_req, res) => {
  const stripeKey = process.env["STRIPE_SECRET_KEY"];
  const resendKey = process.env["RESEND_API_KEY"];
  res.json({
    status: "ok",
    service: "MillionStay API",
    version: "1.0.0",
    commit: process.env["RAILWAY_GIT_COMMIT_SHA"] ?? "unknown",
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
    integrations: {
      stripe: stripeKey ? "configured" : "not_configured",
      email: resendKey ? "configured" : "not_configured",
    },
  });
});

export default router;

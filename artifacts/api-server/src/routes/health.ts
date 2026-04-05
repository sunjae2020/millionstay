import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/v1/health", (_req, res) => {
  const stripeKey = process.env["STRIPE_SECRET_KEY"];
  const resendKey = process.env["RESEND_API_KEY"];
  res.json({
    status: "ok",
    service: "MillionStay API",
    version: "1.0.0",
    environment: process.env["NODE_ENV"] ?? "development",
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
    integrations: {
      stripe: stripeKey ? (stripeKey.startsWith("sk_live_") ? "live" : "test") : "not_configured",
      email: resendKey ? "configured" : "not_configured",
    },
  });
});

export default router;

import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/v1/health", (_req, res) => {
  res.json({ status: "ok", service: "MillionStay API", timestamp: new Date().toISOString() });
});

export default router;

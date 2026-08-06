import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { logger } from "../lib/logger";

/**
 * Origin lock. The API sits behind Cloudflare, but the origin host (Railway /
 * Cloud Run) stays publicly reachable, so proxying alone lets a caller skip
 * Cloudflare and forge `CF-Connecting-IP`. When the platform can't do
 * Authenticated Origin Pull / IP allowlisting, we enforce a shared secret:
 *
 *   1. A Cloudflare Transform Rule adds header `X-Edge-Secret: <secret>` to every
 *      request for the API hostname.
 *   2. This guard 403s any /api request whose header != ORIGIN_SHARED_SECRET.
 *
 * Requests that skip Cloudflare (direct-to-origin) lack the header → 403. This is
 * the prerequisite that makes TRUST_CLOUDFLARE=1 safe (see lib/clientIp.ts).
 *
 * No-op when ORIGIN_SHARED_SECRET is unset (default), so shipping it is safe
 * before the env/rule exist. Health checks and CORS preflight are exempt.
 */
export function originGuard(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env["ORIGIN_SHARED_SECRET"];
  if (!secret) { next(); return; }                 // not configured → no-op
  if (req.method === "OPTIONS") { next(); return; } // CORS preflight
  const p = req.path;
  if (p === "/healthz" || p.endsWith("/health") || p.endsWith("/healthz")) { next(); return; }

  const provided = req.headers["x-edge-secret"];
  if (typeof provided === "string" && safeEqual(provided, secret)) { next(); return; }

  logger.warn(
    { ip: req.ip, path: req.originalUrl, method: req.method },
    "[originGuard] blocked request without a valid edge secret (direct-to-origin?)",
  );
  res.status(403).json({ error: "Forbidden" });
}

/** Constant-time compare so the 403/200 timing can't leak the secret. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

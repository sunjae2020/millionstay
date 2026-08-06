import type { Request } from "express";
import { ipKeyGenerator } from "express-rate-limit";

/**
 * Resolve the real client IP for rate-limiting and audit.
 *
 * Prefers Cloudflare's `CF-Connecting-IP` (the true visitor IP, overwritten on
 * every proxied request), but ONLY when `TRUST_CLOUDFLARE=1`. Until the origin
 * refuses non-Cloudflare traffic (see middlewares/originGuard.ts), that header is
 * spoofable by a caller that skips Cloudflare, so trusting it before the origin
 * lock is in place would be worse than the XFF/`req.ip` default. With the flag
 * off (default) this resolves exactly like today's `req.ip`, so shipping it is a
 * no-op until ops flips the flag.
 */
export function clientIp(req: Request): string {
  const trustCf = process.env["TRUST_CLOUDFLARE"] === "1";
  const cf = trustCf ? req.headers["cf-connecting-ip"] : undefined;
  const raw =
    (typeof cf === "string" && cf.trim())
    || req.ip
    || (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
    || (req.socket as unknown as { remoteAddress?: string })?.remoteAddress
    || "";
  return String(raw).replace(/^::ffff:/, "");
}

/**
 * express-rate-limit key generator built on {@link clientIp}. Runs the address
 * through the library's `ipKeyGenerator` so IPv6 clients are bucketed by subnet.
 * Use as `keyGenerator` on every limiter so per-IP limits key off the resolved
 * client IP rather than the library default `req.ip`.
 */
export function rateLimitKey(req: Request): string {
  const ip = clientIp(req);
  return ip ? ipKeyGenerator(ip) : "unknown";
}

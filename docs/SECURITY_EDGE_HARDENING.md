# Security — Edge Hardening Runbook

Internal ops doc. Ported from the Edubee CRM hardening (same author/stack family).
Last updated 2026-08-06.

Protects the Railway API behind Cloudflare against IP spoofing, direct-origin
bypass, and abuse. The **application code is deployed and no-op by default**; the
remaining work is Cloudflare + Railway env, which must be done in this order.

## What the code adds

- **Client IP single source** — [lib/clientIp.ts](../artifacts/api-server/src/lib/clientIp.ts) `clientIp()` / `rateLimitKey()`. Prefers Cloudflare `CF-Connecting-IP` but **gated behind `TRUST_CLOUDFLARE=1`** (off by default → resolves like today's `req.ip`, so shipping is a no-op). Wired as `keyGenerator` on all 5 limiters in [middlewares/rateLimit.ts](../artifacts/api-server/src/middlewares/rateLimit.ts), so per-IP limits key off the un-spoofable IP once the flag is on.
- **Origin lock** — [middlewares/originGuard.ts](../artifacts/api-server/src/middlewares/originGuard.ts). 403s any `/api` request lacking a valid `X-Edge-Secret` header. No-op until `ORIGIN_SHARED_SECRET` is set. Exempts `/healthz`, `/v1/health`, and CORS preflight.
- Already present (not changed): account lockout ([lib/loginLockout.ts](../artifacts/api-server/src/lib/loginLockout.ts), 5 failures), helmet + HSTS, CORS allow-list, per-route rate limiters.

## Rollout — do this in order

### Phase A — proxy the API through Cloudflare
1. Cloudflare → `millionstay.com` zone → DNS → the API record (`api.…`) → **Proxied (orange)**.
2. SSL/TLS → **Full (strict)**. Verify `https://<api-host>/api/healthz` returns 200.

### Phase B — lock the origin  ⚠️ MUST precede Phase C
Railway's origin host stays publicly reachable, so proxying alone lets a caller
forge `CF-Connecting-IP`. Lock with a shared-secret header:
1. Generate: `openssl rand -hex 32`.
2. Cloudflare → Rules → **Transform Rules → Modify Request Header → Create**: when `Hostname equals <api-host>`, **Set static** `X-Edge-Secret` = `<secret>`. Deploy.
3. Railway → Variables → `ORIGIN_SHARED_SECRET` = `<same secret>`.
4. Verify: direct-to-origin `/api/...` (a non-health route) → 403; via Cloudflare → 200/401.
5. ⚠️ Confirm webhooks (Stripe etc.) hit the Cloudflare hostname — the raw railway host would now 403.

### Phase C — flip the IP trust (only after B)
Railway → Variables → `TRUST_CLOUDFLARE` = `1`. Rate limits now key off the real client IP.

### Phase D — Cloudflare WAF / bot / rate limiting
- WAF → Managed rules → enable the free managed ruleset (full OWASP needs Pro).
- Security → Bots → Bot Fight Mode (⚠️ can challenge webhooks on Free — test after enabling, or defer to Pro's Super Bot Fight Mode which supports path exceptions).
- Rate limiting rule (Free = 1 rule): `POST /api/v1/auth/login` → e.g. 10/10s per IP → Block.

## Environment variables

| Var | Default | Effect |
|---|---|---|
| `ORIGIN_SHARED_SECRET` | unset | Reject /api requests lacking `X-Edge-Secret` (origin lock) |
| `TRUST_CLOUDFLARE` | off | Trust `CF-Connecting-IP` as client IP — set only AFTER origin lock |

## Not done (needs frontend / optional)

- **Turnstile CAPTCHA on public forms** — deliberately NOT wired. The backend guard would 400 every submission unless the public form frontends render a Turnstile widget and send the token. Requires frontend work first (create a Turnstile widget → render `<Turnstile>` on the owner/agent/host application forms → send `turnstileToken` → then set `TURNSTILE_SECRET_KEY`).
- **Distributed rate-limit store (Redis)** — the limiters are in-memory (reset on deploy, not shared across replicas). Add `ioredis` + `rate-limit-redis` + a `REDIS_URL`-gated store only if the API runs multiple replicas. Not needed for a single instance.
- **Incident toggle** — Cloudflare Under Attack Mode (API) + Vercel Attack Challenge Mode (property-admin frontend) during an active attack.

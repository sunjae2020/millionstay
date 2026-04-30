<!--
PR template — keep concise. Tick each box, OR write "n/a — <reason>" next to it.
Anything left unchecked blocks merge.
-->

## What & why

<!-- 1–3 sentences. What does this PR change, and why now? -->



## Australian Privacy Act 1988 / APP checklist

> Tick every box that applies, or write `n/a — <reason>`. See `docs/CONTRIBUTING.md`
> §"Privacy & security checklist" for what each item means in practice.

### Auth & access (APP 11)
- [ ] All new routes use the correct auth middleware (`requireAuth` /
  `requireGuestAuth` / `requirePartnerAuth`) — or are deliberately public
  and listed under `routes/public.ts`.
- [ ] Rate limit applied to login / signup / form-submission routes
  (`middlewares/rateLimit.ts`).
- [ ] Inputs validated by Zod schema from `@workspace/api-zod` (no raw
  `req.body` reads in handlers).

### Audit (APP 11)
- [ ] Every CREATE / UPDATE / DELETE / STATUS_CHANGE / LOGIN / PAYMENT call
  is wrapped with `logAction(...)` from `utils/auditLog.ts`.
- [ ] Audit `actorId` and `actorEmail` populated from authenticated user,
  not request body.

### PII handling (APP 6, 9, 11)
- [ ] No PII (passport, TFN, Medicare, license, card, CVV, DOB) logged
  via `console.log` — use `logger` from `lib/logger.ts`.
- [ ] Any new PII field name added to `logger.ts` redact list (the
  pre-commit hook will catch most cases, but verify).
- [ ] Sensitive uploads use the retention policy in `lib/retention.ts`
  (ID/visa = 30 days, contracts = 7 y, invoices = 5 y).

### Data subject rights (APP 12, 13)
- [ ] If a new table holds guest PII, it is included in
  `/api/v1/guest/me/export` (`routes/guest-portal.ts`).
- [ ] If a new table holds guest PII, deletion handling is added to
  `/api/v1/guest/me/deletion-request`. Hard-delete if no retention
  obligation; soft-delete + pseudonymise if records have ATO/tenancy
  retention.

### Cross-border (APP 8)
- [ ] If this PR introduces a new third-party vendor that processes
  personal data, `docs/PRIVACY_COMPLIANCE.md` cross-border table is
  updated AND the privacy policy will be amended before launch.

### Sessions / cookies
- [ ] No new cookie set without `httpOnly`, `secure` (prod), `sameSite`.
- [ ] No PII in URL query strings (use POST body or path with auth).

## Security
- [ ] Secrets not committed. Verify with `git diff` for `pk_`, `sk_`,
  `re_`, `ghp_`, `eyJ`, `Bearer ` patterns.
- [ ] No `dangerouslySetInnerHTML` without sanitisation.
- [ ] No SQL string concat — use Drizzle parameterised queries.

## Test plan
- [ ] Local: `./scripts/dev.sh` reproduces the change.
- [ ] Local: `pnpm --filter @workspace/api-server typecheck` clean.
- [ ] Local: `./scripts/check-privacy.sh` clean (run automatically by
  pre-commit, but re-run before submitting).
- [ ] Production smoke test plan documented below.

<!-- Smoke test commands here -->


## Deploy notes

<!-- Anything special: env var changes, DNS changes, migration order, etc. -->


---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

# Contributing

This project handles personal data of users in Australia and is bound by the
**Privacy Act 1988 (Cth)** and the **Australian Privacy Principles (APPs)**.
Every change must preserve compliance. This document is the operational guide.

## Local setup

See `docs/LOCAL_DEV.md`. Short version:

```bash
./scripts/dev.sh   # api + 5 frontends, all on localhost
```

## Daily workflow

1. Edit code locally, verify in browser.
2. `git commit` — pre-commit hook auto-runs `./scripts/check-privacy.sh`.
3. `git push` 2–3× per day, not per change.
4. Vercel + Railway auto-deploy.
5. Smoke-test the change on `*.millionstay.com` before closing the task.

## Privacy & security checklist

Every PR must pass `.github/pull_request_template.md`. Below is what each
checkbox actually means.

### Adding a new authenticated API route

```ts
// routes/my-feature.ts
import { Router } from "express";
import { requireGuestAuth } from "../middlewares/requireGuestAuth";
import { logAction } from "../utils/auditLog";

const router = Router();

router.post("/v1/guest/my-feature", requireGuestAuth, async (req, res) => {
  const guest = (req as any).guest;
  // ... do thing ...
  await logAction({
    entityType: "my_feature",
    entityId: created.id,
    action: "CREATE",
    actorId: guest.id,
    actorEmail: guest.email,
    newValue: created,
    ipAddress: req.ip ?? null,
  });
  res.json({ success: true });
});
```

Things to remember:
- Pick the right auth middleware: `requireAuth` (admin), `requirePartnerAuth`
  (agent/owner/host), `requireGuestAuth` (guest).
- Mount the router in `app.ts`. Routes mounted **before** `app.use("/api/v1",
  requireAuth)` are public; routes after are admin-protected.
- Mutations always call `logAction(...)` so they appear in `system_logs`.

### Adding a new PII field to a table

Personal information includes (non-exhaustive): name, email, phone, DOB,
passport, driver licence, Medicare, TFN, photo, address, payment info,
emergency contact, biometrics.

Steps:

1. **Schema** (`lib/db/src/schema/<table>.ts`)
   - Add the column.
   - If the field has a legal retention obligation, document it in code
     comment.

2. **Logger redaction** (`artifacts/api-server/src/lib/logger.ts`)
   - Add the new field name to the `redact.paths` array under "Body — PII".
   - Pre-commit hook will fail otherwise.

3. **DSAR export** (`artifacts/api-server/src/routes/guest-portal.ts`,
   `/v1/guest/me/export`)
   - If the table holds guest data, include it in the export.

4. **DSAR deletion** (`/v1/guest/me/deletion-request`)
   - Decide hard-delete vs soft-delete + pseudonymise vs keep-under-retention.

5. **Retention** (`artifacts/api-server/src/lib/retention.ts`)
   - If a document type, add the retention period.

6. **Privacy policy** — flag for the legal/operations owner that the public
   privacy policy must be updated before this ships.

### Adding a new third-party vendor

If your code calls a new external service that may process personal data
(email, payments, analytics, error reporting, AI inference, etc.):

1. Update `docs/PRIVACY_COMPLIANCE.md` cross-border disclosure table.
2. Add the API key to Railway env vars (never commit).
3. Add the API key reference to `artifacts/api-server/.env` template (with
   empty value).
4. Verify the vendor's Standard Contractual Clauses (SCC) or equivalent.
5. Document the data flow in the PR.

### Adding a new cookie

Always include all three security flags:

```ts
res.cookie("name", value, {
  httpOnly: true,        // Always
  secure: isProd,        // HTTPS only in prod
  sameSite: "lax",       // Or "strict" if no cross-origin needs
  maxAge: 4 * 60 * 60_000,
});
```

Don't put PII or session tokens in non-`httpOnly` cookies — JS can read them
and so can XSS.

### Handling user-uploaded files

- Pass through the retention pipeline (`lib/retention.ts` — picks max
  allowed retention).
- ID documents must be deleted within **30 days** of purpose fulfilment.
- Use `cloudinary` for image storage with signed URLs; never expose direct
  blob URLs.

## Local guard checks

`./scripts/check-privacy.sh` runs automatically on `git commit`. It checks:

| Check | What it catches |
| --- | --- |
| Hardcoded secrets | `pk_…`, `sk_…`, `re_…`, `ghp_…`, JWTs, `Bearer …` |
| PII fields not redacted | New columns with names like `passport`, `tfn`, `medicare`, `dob`, `card_no`, etc., not present in `logger.ts` redact list |
| Console PII leaks | `console.log(...passport...)` etc. |
| Missing audit log | New `db.insert/update/delete(...)` not paired with a nearby `logAction` call (heuristic — false positives possible, override with `// audit-skip: <reason>`) |
| Missing auth | New `router.post/put/delete(...)` outside `routes/public.ts` without a `require*Auth` middleware |
| Insecure cookies | `res.cookie(` without `httpOnly: true` |

To bypass on a specific file (rare, justify in PR):

```ts
// privacy-skip: <reason>
```

Or skip the entire commit (don't unless the hook is broken):

```bash
git commit --no-verify   # NOT RECOMMENDED
```

## Releases

Push to `main` deploys both Railway (api) and Vercel (5 frontends)
automatically. Production smoke test:

```bash
./scripts/smoke-test.sh   # TODO — to be added
```

## Reporting a security issue

Email `security@millionstay.com` (private). Do **not** open a public issue.
For Notifiable Data Breach scheme procedures, see `docs/PRIVACY_COMPLIANCE.md`.

## Code style

- TypeScript strict mode.
- No `any` unless necessary; prefer `unknown` and narrow.
- Use Zod for all request body / query validation.
- Drizzle ORM for all DB access — no raw SQL strings concatenated with input.
- Comments only when the *why* is non-obvious.

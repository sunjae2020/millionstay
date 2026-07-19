# Tenants — per-instance configuration

White-label instance separation keeps **each tenant's config separate** here.
One folder per instance (`million`, `metheim`, …). Spec:
[docs/proposals/WHITELABEL_INSTANCE_SEPARATION.md](../docs/proposals/WHITELABEL_INSTANCE_SEPARATION.md).

```
tenants/
  _template/
    config.env            # copy → tenants/<name>/config.env, fill non-secret values
    secrets.env.example   # copy → tenants/<name>/secrets.env, fill secrets
  million/                # primary MillionStay instance (millionstay.com)
    config.env            # committed  (non-secret: brand, identity, domains, public keys)
    secrets.env           # gitignored (DB URL, JWT, Stripe/Cloudinary/Resend secrets, admin pw)
  metheim/                # pilot 2nd instance
    config.env
    secrets.env
```

## Secret vs non-secret split

| File | Committed? | Contents |
| --- | --- | --- |
| `config.env`  | ✅ yes | `BRAND_*` palette + fonts, all `VITE_*` (app name, logo, company, bank), non-secret API identity (`COMPANY_*`, domains, `ROOT_DOMAIN`, `ALLOWED_ORIGINS`, `SUPPORT_EMAIL`, publishable/cloud-name keys, model names, Vercel project/team ids) |
| `secrets.env` | ❌ **gitignored** | `DATABASE_URL`, `SESSION_SECRET`, `JWT_SECRET`/`GUEST_`/`PARTNER_`, `SEED_ADMIN_PASSWORD`, `STRIPE_SECRET_KEY`/`_WEBHOOK_SECRET`, `CLOUDINARY_API_KEY`/`_SECRET`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `VERCEL_TOKEN` |

`tenants/*/secrets.env` is gitignored — **never commit a filled secrets file.**
Non-secret payment coordinates (BSB/account number, ABN, publishable keys) are
already shipped in the client bundle, so they live in `config.env`.

## How the files are consumed

These files are the **canonical source of truth** for each tenant. Nothing reads
them at runtime — you feed them into each surface:

1. **Local provisioning** — the provisioner loads both for you:
   ```bash
   TENANT=metheim scripts/provision-instance.sh      # loads tenants/metheim/{config,secrets}.env
   ```
   > It parses `KEY=VALUE` with a read loop (handles spaced values like
   > `BRAND_ORANGE=190 100% 23%`) and never clobbers already-set env vars. Don't
   > `source` these files directly — unquoted spaced values would word-split.
2. **API deploy (Railway)** — copy `config.env` + `secrets.env` values into the
   instance's Railway service variables.
3. **Frontend deploy (Vercel)** — copy the `BRAND_*` + `VITE_*` (+ build vars)
   into each app's Vercel project env. `BRAND_*` feed `generate-brand.mjs`
   (build step → `brand.overrides.css`); `VITE_*` are read by the client build.

## The primary instance (`million`)

MillionStay is the **default**: `VITE_APP_NAME` unset → "MillionStay", no
`BRAND_*` overrides → `brand.css` #E8621A. `tenants/million/config.env` documents
those defaults explicitly (mostly for reference/symmetry) — leaving `BRAND_*`
empty keeps `brand.overrides.css` empty (see `.githooks/pre-commit` guard).

## Adding a tenant

```bash
mkdir tenants/<name>
cp tenants/_template/config.env       tenants/<name>/config.env      # fill + commit
cp tenants/_template/secrets.env.example tenants/<name>/secrets.env   # fill, gitignored
```
Then provision a **separate** Supabase project (never the primary), set
`DATABASE_URL` in `secrets.env`, and run `TENANT=<name> scripts/provision-instance.sh`.

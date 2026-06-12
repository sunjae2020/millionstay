# Million Homestay — End-to-End Lifecycle, Operations & Build Design

**Status:** design-of-record for the operational workflow (procedures + what to build).
**Companion docs:** [HOMESTAY_WORKFLOW.md](./HOMESTAY_WORKFLOW.md) (product/architecture),
this file (operations + the application→signing→PDF→approval→matching→placement→contract chain).
**Reference CRM:** Edubee CRM (`/Users/sunkim/Claude-Code/Edubee-CRM`) — patterns for editable
contract/email templates, e-signature, and document management are mapped in §8.

---

## 0. Context — why this doc

Intake + e-signature + signed-PDF email for **Student** and **Host Family** applications
are LIVE (PR #35). What is missing is the **operational procedure around it** and the
**downstream lifecycle**: where PDF/email is configured, how ops view/resend a document
from the admin list, and what happens **after approval** — matching a student to a host,
turning that into a **Placement**, issuing a **Placement Contract**, and collecting payment.

This document defines (a) the full state machine, (b) the per-stage ops procedure and where
each piece is configured, and (c) a phased build backlog with concrete specs that reuse what
already exists. It deliberately reuses existing infra rather than porting Edubee wholesale.

---

## 1. The lifecycle at a glance

Two intake tracks run independently and **converge at a Placement**:

```
HOST TRACK                                STUDENT TRACK
─────────                                 ─────────────
host applies (/for-homestay-host)         student applies (/students/apply)
  → host_app signing request                → student_app signing request (+guardian if minor)
  → /sign  → SIGNED → PDF+email              → /sign → SIGNED → PDF+email
homestay_host_applications                homestay_student_requests
  Submitted → UnderReview                   Submitted → UnderReview
  → (DocsRequested) → APPROVED              → Matching
  → ensureHomestayListings()                     │
  (property + spaces created, Inactive)          │
        │                                        │
        └──────────────┬─────────────────────────┘
                       ▼
              MATCHING (admin-brokered)
   GET /v1/homestay-student-requests/:id/host-suggestions  (engine + AI rationale)
                       │  ops picks a host
                       ▼
              ┌──────────────────────────┐
              │  homestay_placements      │   HSP-YYYY-NNNNN
              │  Proposed                 │
              │   → HostAccepted          │  host accepts the match
              │   → (Placement Contract)  │  context_type='placement_contract' e-sign
              │   → AwaitingPayment       │  Stripe deposit/placement fee
              │   → Active                │  student moved in
              │   → Ending → Completed    │
              └──────────────────────────┘
   Student request status mirrors: Matching → Proposed → Confirmed → Placed → Completed
```

**Entities (all already in the schema):**
- `homestay_host_applications` — host intake + approval + compliance ([schema](../../lib/db/src/schema/homestay_host_applications.ts))
- `homestay_student_requests` — student intake + ops queue ([schema](../../lib/db/src/schema/homestay_student_requests.ts))
- `homestay_host_availability` — capacity/occupied for matching
- `homestay_placements` — the **match→contract→payment spine** (HSP ref, fees, Stripe, status machine) — table exists, **no routes/UI yet** ([schema](../../lib/db/src/schema/homestay_placements.ts))
- `contract_signing_requests` — generic e-sign, `context_type ∈ {host_app, student_app, placement_contract}` ([schema](../../lib/db/src/schema/contract_signing_requests.ts))
- `email_template` / `email_log` — editable email copy + per-record send history ([email_templates](../../lib/db/src/schema/email_templates.ts), [email_logs](../../lib/db/src/schema/email_logs.ts))
- `contract_types` — contract metadata/requirements ([schema](../../lib/db/src/schema/contract_types.ts))
- `documents` — unified Cloudinary attachment store (entity_type/entity_id + retention)

---

## 2. Stage-by-stage operations procedure

For each stage: **trigger → automated actions → ops action → where it's configured.**

### Stage 1 — Intake & e-signature  *(LIVE)*
- **Trigger:** applicant submits the public form.
- **Automated:** create `homestay_*` row (status `Submitted`); create a `contract_signing_request`
  (student + guardian if minor / host); redirect to `/sign/:token`; ops "lead" email.
- **On sign:** capture signatures + server metadata (IP/time/consent); render branded PDF
  (Puppeteer); store privately (Cloudinary `authenticated`); email signed PDF to
  applicant + linked agent + ops.
- **Where configured:** form fields in `StudentApply.tsx` / `for-homestay-host.tsx`; PDF layout in
  [applicationPdf.ts](../../artifacts/api-server/src/lib/documents/applicationPdf.ts); pipeline in
  [applicationDocs.ts](../../artifacts/api-server/src/services/applicationDocs.ts); routes in
  [contract-signing.ts](../../artifacts/api-server/src/routes/contract-signing.ts).

### Stage 2 — Ops review of applications
- **Student:** `Submitted → UnderReview → Matching` via `POST /v1/homestay-student-requests/:id/status`
  (notes + reviewed_by/at). Admin pages: `HomestayStudentRequests[Detail].tsx`.
- **Host:** `Submitted → UnderReview → (DocsRequested) → Approved | Rejected` via
  `/approve` `/reject` `/request-docs`. **Approve** runs `ensureHomestayListings()` → creates a
  `property` + one `space` per room (Inactive until the host activates their landing page).
  Admin pages: `HomestayApplications[Detail].tsx`.
- **Compliance gate (hosts):** minor students require every 18+ resident to have a **verified WWCC**
  (enforced in the matching engine). Insurance + WWCC live on the host application; ops verify before approval.
- **Where configured:** admin routers in [homestay-students.ts](../../artifacts/api-server/src/routes/homestay-students.ts)
  and [homestay.ts](../../artifacts/api-server/src/routes/homestay.ts).

### Stage 3 — View / resend the application document  *(BUILD — Phase A)*
- Ops opens an application detail page and needs to **see the signed PDF** and **resend it** (Resend).
- **Reuse:** every signed application already has `/preview`, `/pdf`, `/send` on its signing token.
  Add an admin "Signature & Documents" card that surfaces them (spec in §4).

### Stage 4 — Matching  *(partly built)*
- **Trigger:** student in `Matching`, host(s) `Approved`.
- **Automated:** `host-suggestions` endpoint ranks approved/available hosts (hard filters + weighted
  score) and adds an AI rationale (best-effort Claude). Read-only today.
- **Ops action:** review the shortlist, pick a host → **create a Placement** (Phase B).
- **Where configured:** [matching.ts](../../artifacts/api-server/src/lib/homestay/matching.ts),
  [matchRationale.ts](../../artifacts/api-server/src/lib/homestay/matchRationale.ts).

### Stage 5 — Placement  *(BUILD — Phase B)*
- Picking a suggested host creates a `homestay_placements` row (`Proposed`) linking the student
  request + host application (+ agent). Host is notified and **accepts** → `HostAccepted`.
- Student request advances `Matching → Proposed → Confirmed`; host capacity (`occupied`) increments.

### Stage 6 — Placement contract  *(BUILD — Phase C)*
- Generate a **Homestay Placement Agreement** PDF from the placement (parties, dates, fees, terms).
- Send for e-signature with `context_type='placement_contract'` (student/guardian + host).
- On full signature → freeze the signed PDF (retention) and email all parties.

### Stage 7 — Payment & activation  *(BUILD — Phase E)*
- `AwaitingPayment`: collect deposit + placement fee (Stripe; `stripe_customer_id`/`subscription_id`
  fields already on the placement). On payment → `Active`, student status `Placed`, space marked occupied.

### Stage 8 — Lifecycle close
- `Ending → Completed` near move-out; release host capacity; trigger reviews/settlement.

---

## 3. "Where do I configure X?" — single reference

| Concern | Configured in | Notes |
|---|---|---|
| **Application form fields** | `million-stay-web/.../StudentApply.tsx`, `for-homestay-host.tsx` | React; extra fields ride `preferences`/jsonb (no migration) |
| **Application PDF layout** | [applicationPdf.ts](../../artifacts/api-server/src/lib/documents/applicationPdf.ts) | shared shell from [theme.ts](../../artifacts/api-server/src/lib/documents/theme.ts) |
| **Contract PDF layout** | [contractDocument.ts](../../artifacts/api-server/src/lib/documents/contractDocument.ts) | reuse for placement agreement |
| **PDF engine** | [pdf.ts](../../artifacts/api-server/src/lib/documents/pdf.ts) (Puppeteer) | needs Chromium in the Railway image |
| **PDF private storage** | [cloudinary.ts](../../artifacts/api-server/src/utils/cloudinary.ts) `uploadPrivateToCloudinary` + `generateSignedUrl` | `authenticated` type; **confirm prod account active** |
| **Transactional email copy** | **`email_template` table** (admin: Settings → Email Templates) | `template_code`, `subject`, `body_html`, `available_vars` |
| **Homestay status emails** | currently **hardcoded** in [email.ts](../../artifacts/api-server/src/lib/email.ts) `HOMESTAY_EMAIL_COPY` | migrate to `email_template` (Phase D) |
| **Email send history** | **`email_log` table** (admin: email logs) | logged by contracts/invoices/quotes; **homestay app sends do NOT log yet** (gap, Phase A) |
| **Email provider / sender** | env: `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_LOGO_URL`, `SUPPORT_EMAIL`, `LEAD_NOTIFICATION_EMAIL` | Resend |
| **Company/brand on documents** | env: `COMPANY_LEGAL_NAME/ABN/PHONE/ADDRESS`, `PUBLIC_WEB_URL` | read by `getCompanyInfo()` |
| **Contract requirements** | **`contract_types` table** (admin: Settings → Contract Types) | passport/visa/enrollment flags, security |
| **Matching weights/rules** | [matching.ts](../../artifacts/api-server/src/lib/homestay/matching.ts) | pure, unit-tested |
| **i18n for documents** | [i18n.ts](../../artifacts/api-server/src/lib/documents/i18n.ts) | en/ko/ja/th |

---

## 4. Phase A (next) — Admin "View PDF + Send email" on application detail

**Goal:** from `HomestayStudentRequestDetail` / `HomestayApplicationDetail`, ops can view the signed
application PDF and resend it (to applicant / agent / ops), with the send recorded in history.

**Backend (small):**
1. The signing record is already reachable via the admin list endpoint
   `GET /v1/contract-signing/:contextType/:contextId` → returns the request incl. `token`, `status`, `pdf_url`.
   Surface it on the application detail response (or call it from the page).
2. **Log homestay sends to `email_log`.** In `emailApplicationPdf`
   ([applicationDocs.ts](../../artifacts/api-server/src/services/applicationDocs.ts)), after each
   successful `sendDocumentEmail`, insert an `email_log` row:
   `{ template_code: 'document.homestay_application', to_email, to_name, subject, resend_message_id,
   entity_type: 'homestay_student_request'|'homestay_host_application', entity_id }` — mirrors
   [contracts.ts:445](../../artifacts/api-server/src/routes/contracts.ts). Closes the history gap.
3. (Optional) An **admin-authed** thin proxy `GET /v1/homestay-*/:id/document` that resolves the
   latest signed signing request and streams `/preview` or `/pdf`, so the admin UI doesn't handle raw tokens.

**Frontend (property-admin):** add a **"Signature & Documents"** `Section` to both detail pages:
- Status chip (Pending / Signed + signed date), **View PDF** (opens `/preview` or `/pdf`),
  **Download** (`/pdf`).
- **Send / Resend** dialog with checkboxes Applicant / Guardian / Agent / Ops → `POST /…/:token/send`
  with `{applicant, agent, ops}`; toast the returned `sent[]`.
- An **email history** list for the record (`GET /v1/email-logs?entity_type=…&entity_id=…`).
- Follow the existing `Section`/`Field`/Dialog pattern (model after the host approve/reject dialogs).

**Effort:** ~1 day. Pure reuse of PR #35 endpoints + the established `email_log` pattern.

---

## 5. Phase B — Placement (match → Proposed → HostAccepted)

**Backend — new `routes/homestay-placements.ts`:**
- `POST /v1/homestay-placements` `{ student_request_id, host_application_id, agent_account_id?, fees, dates }`
  → create `Proposed` (`generateRef('HSP')`); set student request `Proposed`; increment host `occupied`
  (guard capacity); notify host (email_template `homestay.placement_proposed`).
- `GET /v1/homestay-placements` (filters) + `GET /:id` (joined student + host views).
- `POST /:id/host-accept` → `HostAccepted`, stamp `host_accepted_at`; `POST /:id/cancel` → release capacity.
- Audit every transition via `logAction`.

**Frontend (property-admin):** new **Placements** list + detail; a **"Create placement"** action on each
host-suggestion card in `HomestayStudentRequestDetail` (the card already renders score/rationale).

**Decision (recommended):** use the dedicated **`homestay_placements`** table as the spine — **do not**
overload `bookings`/`contracts`, which model short-term rental stays with different fields/flows.
Placements already carry HSP refs, fee columns, Stripe fields and the right status machine.

---

## 6. Phase C — Placement contract (generate → e-sign → send)

**Reuse the contract pipeline 1:1** ([contracts.ts](../../artifacts/api-server/src/routes/contracts.ts)
`/send` `:537`, `/sign` `:548`):
1. Map a placement → `ContractDocInput` and render with `buildContractHtml` (or add a thin
   `homestayPlacementToContractDoc` if the homestay agreement needs bespoke clauses — house rules,
   meal plan, cancellation tiers).
2. `createSigningRequest({ contextType: 'placement_contract', contextId: placement.id, signers:[student(+guardian), host] })`
   → `/sign/:token` (the themed page already labels `placement_contract` as "Homestay Agreement").
3. On full signature: `freezeDocument({ entityType:'homestay_placement', ... })` for retention; email all
   parties via `sendDocumentEmail`; **log to `email_log`**; advance `HostAccepted → AwaitingPayment`.
4. `buildDocForSigning` in [applicationDocs.ts](../../artifacts/api-server/src/services/applicationDocs.ts)
   currently handles `student_app`/`host_app`; extend it (or the contract route) to render the
   placement agreement for the `placement_contract` context so `/preview` `/pdf` `/send` work uniformly.

**Contract terms source:** start from a `contract_types` entry ("Homestay Placement Agreement") +
a stored terms template (see Phase D). Until then, embed the terms in the builder like the
short-term-rental contract does.

---

## 7. Phase D — Editable contract & email templates (Edubee-style)

MillionStay **already has** the foundation Edubee built — use it before porting anything:
- `email_template` (code + subject + html + `available_vars`) and the **Settings → Email Templates** editor.
- `email_log` history. `contract_types` for contract metadata.

**Step 1 (cheap, do with Phase A/C):** move homestay copy out of code into `email_template` rows and
render via a small `renderTemplate(code, vars)` helper (substitute `{{var}}`), so ops can edit subject/body
without a deploy. Seed codes:
`homestay.student_received`, `homestay.host_received`, `homestay.docs_requested`, `homestay.approved`,
`homestay.rejected`, `homestay.placement_proposed`, `homestay.placement_signed`,
`homestay.payment_due`, `document.homestay_application`, `document.homestay_contract`.

**Step 2 (larger, optional):** if per-partner/agent branding or rich editing is needed, adopt Edubee's
**`document_templates`** model (system default + tenant override, `document_template_translations` for
multi-locale, `document_template_brand_tokens` for logo/colours/from-address, a TipTap-based **Templates
Studio** editor, and a `resolveTemplate()` engine with locale fallback). See §8 for exact references.
This is the upgrade path for editable **contract bodies** (not just emails), versioning, and previews.

---

## 8. Edubee CRM — what to copy, and from where

| Pattern | Edubee location | Adopt for MillionStay? |
|---|---|---|
| **Editable templates (email/pdf/contract)** with system-default + per-tenant override, multi-locale, variable schema | `lib/db/src/schema/document-templates.ts`; engine `…/services/templateEngine.ts` (`resolveTemplate`, `renderString`, `sampleVarsFromSchema`) | **Yes (Phase D step 2).** Target model for editable contract bodies + branded emails. MillionStay's `email_template` is the lightweight first step. |
| **Templates Studio admin UI** (tabs Email/PDF/Contract/Brand, auto-fork on edit, locale switch, variable sidebar, preview/publish) | `artifacts/edubee-admin/.../settings/templates.tsx`, `template-edit.tsx` | **Yes**, as the model for a future homestay template editor (extend the existing Settings → Email Templates page). |
| **Brand tokens per tenant** (logo, colours, from-name/reply-to, header/footer) | `document_template_brand_tokens` + `emailBranding.ts` (`resolveEmailBrand`, `brandedEmailShell`) | **Optional.** Useful if agents/providers need own-branded emails; MillionStay uses single-brand env today. |
| **E-signature** (token links, expiry, signers jsonb, append-only audit, signature image + IP/UA/consent) | `contractSigningRequests`, `…/routes/contract-signing.ts`, `SigningPage.tsx` | **Already mirrored** — MillionStay's signing system is the same lineage (ported from Edubee). Keep parity. |
| **PDF generation** | `documentPdfService.ts` (`@react-pdf/renderer`, DocModel, CJK fonts) | **No switch.** MillionStay uses HTML→Puppeteer, which already shares one shell across docs. Keep Puppeteer; just ensure CJK web-fonts in the shell for KO/JA/TH names. |
| **Email send log per record** | (Edubee lacks a central one) | MillionStay's `email_log` is **ahead** — just make homestay use it (Phase A). |
| **Form management** (forms + partners + per-form terms + submissions jsonb) | `application-forms.ts`, `form-submissions.ts`, `application-form.tsx` | **Later/optional.** Homestay forms are hardcoded React today; a config-driven `form_fields` table is a future nicety, not required for the lifecycle. |
| **Contract detail workspace** (tabs: Overview/Services/Schedule/Transactions/Documents/Signature) | `ContractDetailPage.tsx` | **Yes**, as the UX model for the **Placement detail** page (Phase B/C). |

---

## 9. Templates inventory to author (initial)

**Emails (`email_template` rows):** student/host received; docs requested; approved; rejected;
placement proposed (to host); placement contract ready (to sign); placement signed (all parties);
payment due / received; generic document cover (already: `document.*`).

**Documents (PDF builders):** Student Application + Host Family Application (LIVE);
**Homestay Placement Agreement** (Phase C) — parties, premises (host home + room), term (move-in/out),
fees (placement fee, deposit, monthly), house rules, meal plan, cancellation policy, signatures.

---

## 10. Build order & open decisions

**Order:** A (admin view/resend + email_log) → B (placements) → C (placement contract e-sign) →
D-step1 (homestay copy → `email_template`) → E (Stripe payment) → D-step2 (full editable templates) →
lifecycle close.

**Open decisions (need product sign-off):**
1. **Placement spine** — confirm dedicated `homestay_placements` (recommended) vs reuse `bookings`/`contracts`.
2. **Placement contract terms** — single standard agreement vs per-`contract_type` variants (e.g. under-18 vs adult).
3. **Template editing scope** — lightweight `email_template` edits now; adopt full Edubee `document_templates`
   (per-partner branding, multi-locale, contract-body editing) later? 
4. **Payment** — Stripe deposit + placement fee + recurring monthly (subscription) vs one-off; who pays the agent.
5. **Agent subsystem (Phase 4)** — commission attribution on placements (`agent_account_id` already threaded).

# Google Sheets → Time Study (Homestay) intake automation

Imports **Time Study** Google Form responses into MillionStay as homestay
student applications. Distinct from
[`google-sheets-homestay.gs`](./google-sheets-homestay.gs) (that one round-trips
`status`/`notes` for the ops queue; this one **creates** applications from the
agency's intake form).

Bound Apps Script:
[`google-sheets-timestudy-homestay.gs`](./google-sheets-timestudy-homestay.gs).

## Pipeline

```
Form Responses (raw)  ──importTimeStudy()──▶  MillionStay tab  ──pushToMillionStay()──▶  POST /api/ext/v1/homestay-student-requests
   (Google Form)         filter + remap            (curated)         create homestay_student_requests (status "Submitted")
```

1. **`importTimeStudy()`** — rebuilds the `MillionStay` tab from `Form Responses`.
   Keeps only rows whose `PROGRAM & SERVICE LIST` matches a homestay placement or
   settlement (airport pickup / settlement derived into their own columns).
   Header wording is resolved through the `STRUCTURED` alias table, so form label
   changes are absorbed in one place.
2. **`pushToMillionStay()`** — POSTs each `MillionStay`-tab row to the External
   API. The endpoint creates a request with status `Submitted`, **no e-signature
   request and no notification email** (unlike the public intake form). Idempotent
   via `external_ref`.

## Endpoint (External API, `/api/ext/v1`)

| Method | Path | Scope | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/ext/v1/homestay-student-requests` | `homestay:write` | Create one request. Idempotent on `external_ref` (stored at `preferences.import.ref`). |

Auth headers on every call: `X-API-Key`, `X-API-Secret`. Server impl:
[`artifacts/api-server/src/routes/external-api.ts`](../../artifacts/api-server/src/routes/external-api.ts).

**Idempotency key.** `external_ref` is `Submission Date | Email | first | last`
so two same-day submissions don't collide (a date-only submission stamp would
otherwise make the second submission look like a duplicate and silently drop it).

## Automation

`installAutoSync()` (run once from the editor) wires two installable triggers,
both calling `syncAll()` (= `importTimeStudy()` → `pushToMillionStay()` under a
`LockService` guard):

- **`onFormSubmit`** — real-time; a new application reaches the admin within
  seconds of submission.
- **time-based, hourly** — safety net that re-runs the sync to catch anything the
  form-submit trigger missed.

`removeAutoSync()` deletes both. Trigger contexts have no UI, so all feedback
goes through `alert_()` / `toast_()` which fall back to `Logger` when
`SpreadsheetApp.getUi()` throws.

> `pushToMillionStay()` re-sends every `MillionStay`-tab row each run; the server
> skips duplicates, so it's safe but O(rows) requests. Fine at low volume; add a
> "pushed" marker column to skip already-created rows if volume grows.

## Setup

1. **Issue an API key** in property-admin → Settings → API Keys with scope
   **`homestay:write`** (add `homestay:read` if you also use the ops-queue
   script). Copy the Key + Secret (shown once).
2. **Add the script.** In the Form's response sheet: Extensions → Apps Script,
   paste [`google-sheets-timestudy-homestay.gs`](./google-sheets-timestudy-homestay.gs).
3. **Store credentials.** Project Settings → Script Properties:
   - `API_BASE` → `https://<your-api-host>/api/ext/v1`
   - `API_KEY` → the Key
   - `API_SECRET` → the Secret
4. **Enable automation.** Run `installAutoSync` once (grant permissions:
   spreadsheet, `UrlFetchApp`, triggers). Confirm two `syncAll` triggers exist.
5. **Backfill / smoke test.** Menu **MillionStay → ▶ Sync now**, then check the
   admin homestay student queue. Per-row status notes appear in column A
   (`✓ created …` / `• exists …` / `✗ …`).

## Behaviour notes

- Tab names are fixed: source `Form Responses`, destination `MillionStay`.
- Rows with neither given nor family name are skipped on push.
- `importTimeStudy()` **fully rebuilds** the `MillionStay` tab each run
  (`clearContents`), so manual edits to that tab don't survive a sync — edit the
  source form or the DB, not the curated tab.

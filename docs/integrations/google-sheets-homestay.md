# Google Sheets ⇄ Homestay Student Applications

Real-time **Sheets → DB** sync for the homestay student ops queue. An ops user
edits a Google Sheet; an `onEdit` Apps Script trigger pushes the change to the
MillionStay External API, which updates the matching `homestay_student_requests`
row. A menu action pulls the latest list down to (re)seed the sheet.

**What round-trips:** only the ops-managed fields — `status` and `notes`.
Student/guardian PII is read-only from the sheet (privacy: the sheet must not be
able to overwrite applicant-submitted data).

## Endpoints (External API, `/api/ext/v1`)

| Method | Path | Scope | Purpose |
| --- | --- | --- | --- |
| `GET`  | `/api/ext/v1/homestay-student-requests` | `homestay:read`  | List requests (curated view) to seed the sheet. Optional `?status=`. |
| `PATCH`| `/api/ext/v1/homestay-student-requests/by-ref/:ref` | `homestay:write` | Update one request matched by `request_ref`. Body: `{ status?, notes? }`. |

Auth headers on every call: `X-API-Key`, `X-API-Secret`.
`status` is validated against the ops queue states (Draft, Submitted,
UnderReview, Matching, Proposed, Confirmed, Placed, Completed, Cancelled,
Rejected). Every write is recorded in the audit log
(`actor_email = integration:google_sheets:<key name>`).

## Setup

1. **Issue an API key** in property-admin → Settings → API Keys with scopes
   **`homestay:read`** and **`homestay:write`**. Copy the Key + Secret (shown once).
2. **Create the sheet.** First row = headers. Required columns: `request_ref`,
   `status`, `notes` (others from the read view are optional context). Note the
   1-based column index of `status` and `notes`.
3. **Add the script.** In the sheet: Extensions → Apps Script, paste
   [`google-sheets-homestay.gs`](./google-sheets-homestay.gs).
4. **Store credentials.** Project Settings → Script Properties, add:
   - `API_BASE` → `https://<your-api-host>/api/ext/v1`
   - `API_KEY` → the Key
   - `API_SECRET` → the Secret
5. **Install the edit trigger.** Run `installTrigger` once from the editor
   (grant permissions). This wires an installable `onEdit` trigger (the simple
   `onEdit` can't make external `UrlFetchApp` calls).
6. **Seed the sheet.** Reload the sheet → menu **MillionStay → Pull latest**.

## Behaviour

- Editing the **status** or **notes** cell of a row that has a `request_ref`
  fires a `PATCH`. The cell briefly notes success/failure.
- Editing PII columns does nothing (not pushed).
- A row without a `request_ref` is ignored (new applications are created via the
  intake form, not the sheet).

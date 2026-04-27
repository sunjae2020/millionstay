# Operations & Logging Schema — WorkOrder / CSTicket / SystemLog

> 🪦 **T008-ARCHIVED** 2026-04-27 — T002.4 통합 결정 = 도메인별 ERD file → 단일 `_schema/erd-core.md` 8-cluster Mermaid 통합. 본 파일 은 T001 시점 도메인별 분할 historical 보존. Ground truth = `_schema/erd-core.md` §5 (Ops cluster Mermaid) + §11 (Ops cluster 권장 FK rows) + `_context/domain-logic-ops-{property,catalog,crm}.md` (3 도메인 비즈니스 규칙 + work_orders/cs_tickets state machines).


> Source: `lib/db/src/schema/{work_orders,cs_tickets,service_catalog,system_logs,email_logs}.ts`

## work_orders

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| order_ref | text UNIQUE | e.g. `WO-2026-0123` |
| property_id | int → properties.id | |
| space_id | int → spaces.id | nullable (property-wide jobs) |
| title, description | text | |
| status | text default `Open` | `Open` \| `InProgress` \| `PendingReview` \| `Completed` \| `Cancelled` \| `Archived` |
| priority | text default `Normal` | `Low` \| `Normal` \| `High` \| `Urgent` |
| category | text | `Maintenance`, `Cleaning`, `Inspection`, `Other` |
| assigned_contact_id | int → contacts.id | the staff or vendor contact |
| reported_at, scheduled_at, completed_at | timestamp | |
| cost | real | ⚠️ should be `numeric(10,2)` |
| currency | text default `AUD` | |
| notes | text | |
| created_at, updated_at, deleted_at | timestamp | |

**Triggers creation:** Admin manual only. **Auto-creation on checkout is NOT implemented** — see `_workflows/maintenance-workflow.md` Automation Gaps.

**Status transitions:** Free-form via `PATCH /v1/work-orders/:id` — no enforced state machine.

**Billing link:** No FK to invoices. Cost is internal-only. ⚠️ A vendor invoice flow that would feed into AP does not exist.

## cs_tickets

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| ticket_ref | text UNIQUE | `CS-2026-0001` |
| guest_user_id | int → guest_users.id | |
| booking_id | int → bookings.id | nullable |
| category | text default `General` | `General` \| `Maintenance` \| `Billing` \| `Booking` \| `Complaint` |
| subject | text | |
| description | text | |
| status | text default `Open` | `Open` \| `InProgress` \| `Resolved` \| `Closed` \| `Archived` |
| priority | text default `Normal` | |
| assigned_admin_id | int → admin_users.id | |
| closed_at | timestamp | |
| created_at, updated_at, deleted_at | timestamp | |

**Creation paths:**
- Guest: `POST /v1/guest/cs-tickets` (Guest Portal)
- Admin: not exposed as a create endpoint — admins reply via `POST /v1/cs-tickets/:id/reply`

**Ticket-to-WorkOrder conversion:** ❌ Not implemented (despite Maintenance category existing).

## service_catalog

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text | e.g. "Mid-stay clean", "Airport pickup" |
| description | text | |
| category | text | |
| price | real | ⚠️ `numeric(10,2)` recommended |
| currency | text | |
| duration_minutes | int | |
| is_active | boolean | |
| created_at, updated_at, deleted_at | timestamp | |

> Used by `booking_extra_services` (link table) to add chargeable services to a booking.

## system_log (audit log)

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| entity_type | text | `booking`, `invoice`, `contract`, `space`, `account`, etc. |
| entity_id | int | |
| action | text | `CREATE`, `UPDATE`, `STATUS_CHANGE`, `PAYMENT`, `BLOCK`, `UNBLOCK`, `SCHEDULE_ADD`, `SCHEDULE_UPDATE`, `SCHEDULE_DELETE` |
| actor_type | text default `User` | `User` \| `System` |
| actor_id | int → admin_users.id | nullable for system actions |
| actor_email | text | |
| old_value | jsonb | snapshot before change |
| new_value | jsonb | snapshot after change |
| ip_address | text | |
| user_agent | text | |
| created_at | timestamp default now() | |

**Helper:** `logAction()` in `artifacts/api-server/src/lib/audit.ts` (called from booking, invoice, contract, space-block routes).

## email_logs

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| recipient_email | text | |
| recipient_user_type | text | `guest` \| `admin` \| `partner` |
| recipient_user_id | int | |
| email_type | text | `password_reset`, `booking_confirmation`, `registration_request`, ... |
| subject | text | |
| status | text | `Sent` \| `Failed` |
| resend_message_id | text | from Resend response |
| error_message | text | nullable |
| sent_at | timestamp | |

## State changes WITHOUT audit log (gaps)

- ❌ `work_orders` — no log on create/status/complete
- ❌ `cs_tickets` — no log on create/reply/close
- ❌ `accounts` / `contacts` CRUD — no log
- ❌ `documents` upload / hard purge — no log
- ❌ `marketing_consents` opt-out — only persisted to its own row, no system_log entry
- ❌ Login success/failure — recorded in `login_attempts`, not in `system_log`

See `_templates/audit-log-template.md` for the recommended fix template.

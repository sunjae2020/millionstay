# Maintenance & CS Workflow

> ⚠️ **NEEDS REVISION** — see `docs/reverse/_audit/T001_RECON_REPORT.md` §g for specific corrections required. Will be rewritten in T002–T007 when its domain folder is processed.


## 1. Work Orders

### Lifecycle

```
Open ──► InProgress ──► PendingReview ──► Completed
   │           │              │
   └───────────┴──────────────┴───► Cancelled
                                    Archived (soft delete)
```

State transitions are not enforced — `PATCH /v1/work-orders/:id` accepts any status string. There is no state machine guard.

### Creation

- **Manual only**, by admin via `POST /v1/work-orders`.
- No automatic creation triggers exist (would expect: on checkout, on damage report, on negative review).

### Assignment

- `assigned_contact_id` → `contacts.id`. The contact represents a staff member or vendor.
- There is no "assigned-to-team" or capacity-based round-robin. Assignment is fully manual.

### Cost tracking

- `cost` (real, ⚠️ should be `numeric(10,2)`) and `currency`.
- Tracks vendor cost only; no link to `invoices` (work orders are AP-side, invoices are AR-side).
- No vendor-payable workflow exists. To pay a vendor, the operator records the cost on the WO and then handles the actual payment outside the system.

### Billing link to guests

❌ Not implemented. If a WO arose because a guest damaged something, there is no automated path to charge the guest. The operator would manually create an invoice with `description="Damage charge per WO-XXXX"`.

## 2. CS Tickets

### Lifecycle

```
Open ──► InProgress ──► Resolved ──► Closed
                              │
                              └─► Archived (soft delete)
```

### Creation paths

| Path | Status |
|---|---|
| Guest portal `POST /v1/guest/cs-tickets` | ✅ implemented |
| Admin direct creation | ❌ not implemented (admins can only reply / change status on existing tickets) |
| Email-to-ticket | ❌ not implemented |
| Phone log | ❌ not implemented |

### Ticket → WorkOrder conversion ❌

Despite the `Maintenance` category existing on tickets, there is no API/UI to convert a ticket into a work order. **Recommendation:** add `POST /v1/cs-tickets/:id/convert-to-work-order` that creates a work order with `space_id` derived from the linked booking and adds a reply on the ticket linking to the WO.

### Reply flow

- `POST /v1/cs-tickets/:id/reply` — admin posts a reply.
- Replies are stored in `cs_ticket_replies(id, ticket_id, author_admin_id, body, created_at)`.
- Guest portal has a read-only view of replies.
- ❌ No outbound email notification on reply (the guest must check the portal).

### Audit log

❌ CS tickets do not write to `system_log`. Status changes and replies are not tracked centrally.

## 3. Service jobs (Service Host portal)

The Service Host portal (`artifacts/service-host-portal`) operates on **service jobs**, which are conceptually similar to work orders but scoped to bookings (cleaning between guests, mid-stay services, etc.).

| Aspect | Detail |
|---|---|
| Endpoint | `GET /v1/service-host/jobs` |
| Filtered by | `assigned_service_host_id` (a partner_users row with `portal_type = service_host`) |
| Status updates | `PATCH /v1/service-host/jobs/:id` |
| Earnings | `GET /v1/service-host/earnings` calculates from completed jobs |

These "jobs" today are a thin layer over `work_orders`. The two should be consolidated or kept clearly separate; the current split risks duplication.

## 4. Email notifications — what fires today

`artifacts/api-server/src/lib/email.ts` exports:

| Function | Trigger |
|---|---|
| `sendPasswordResetEmail` | `/v1/auth/forgot-password` (admin) and guest equivalents |
| `sendRegistrationRequestEmail` | `/v1/auth/register` — notifies admins of a new admin signup pending approval |
| `sendBookingConfirmation` | `/v1/guest/bookings` (post-create) |

**Not sent (gaps):**

| Event | Should fire |
|---|---|
| Booking confirmed by admin | Email guest "your booking is confirmed" |
| Contract sent | Email guest with sign link |
| Contract signed by guest | Email admin |
| Invoice issued (every period) | Email guest with payment link |
| Invoice overdue | Reminder email — depends on automated job (which doesn't exist) |
| CS ticket reply | Email guest |
| WO assigned to staff | Email contact |
| Bond refund initiated | Email guest |

All email sends are recorded in `email_logs` (when actually sent).

## 5. Automation gaps summary

| Trigger | Should auto-fire | Currently |
|---|---|---|
| Booking checkout | Cleaning WO with `space_id` | ❌ |
| Contract end_date reached | Contract → `Expired` | ❌ |
| Booking cancelled | Contract → `Terminated`, future invoices voided | ❌ |
| Invoice due_date passed (Sent) | Invoice → `Overdue`, reminder email | ❌ |
| Document `retention_until` reached | Hard delete + Cloudinary purge | ✅ (manual script only — `purge-expired-documents.ts`) |
| Refresh tokens expired | Hard delete | ❌ (rows accumulate) |
| Login lockout window passed | Reset counter | ✅ (sliding window inside `loginLockout.ts`) |

A nightly job runner (e.g., `node-cron` in api-server, or a separate Replit scheduled job) would close most of these gaps with one orchestration file.

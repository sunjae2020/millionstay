# User Personas, Roles & Permissions

## 1. User roles in code

| Role | Stored in | Field / values |
|---|---|---|
| Admin | `admin_users.role` | `Admin` (default), `SuperAdmin` |
| Guest | `guest_users` | implicit (no role column) |
| Agent | `partner_users.portal_type` | `agent` |
| Owner | `partner_users.portal_type` | `owner` |
| Service Host | `partner_users.portal_type` | `service_host` |

> All role strings are hard-coded as text in code and DB defaults. There is no enum table. SuperAdmin is created via seed only (no admin UI to elevate).

## 2. Portals and their auth boundary

| Portal | Login endpoint | JWT secret env var | TTL | Middleware |
|---|---|---|---|---|
| `property-admin` | `POST /api/v1/auth/login` | `JWT_SECRET` | 8 h + 30-day refresh | `requireAuth` |
| `million-stay-web` (Guest Portal) | `POST /api/v1/auth/guest/login` | `GUEST_JWT_SECRET` | 7 d | `requireGuestAuth` |
| `agent-portal` | `POST /api/v1/auth/partner/login` (with `portal_type=agent`) | `PARTNER_JWT_SECRET` | 7 d | `requireAgentAuth` |
| `owner-portal` | same, `portal_type=owner` | `PARTNER_JWT_SECRET` | 7 d | `requireOwnerAuth` |
| `service-host-portal` | same, `portal_type=service_host` | `PARTNER_JWT_SECRET` | 7 d | `requireServiceHostAuth` |

Each portal is a **separate Vite app** with a separate workflow and preview path. JWT secrets are isolated per portal type — a stolen guest token cannot impersonate an admin.

## 3. Permission matrix

| Domain → | Admin | SuperAdmin | Agent | Owner | Service Host | Guest |
|---|---|---|---|---|---|---|
| All admin CRUD (property/space/product/booking/contract/invoice/CRM) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Admin user management | ✅ (read/edit) | ✅ (incl. bulk delete) | ❌ | ❌ | ❌ | ❌ |
| `db-sync` export | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Public space search | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (anonymous) |
| Own bookings | — | — | ✅ (where `agent_account_id`=self) | ✅ (where space owner=self) | ❌ | ✅ (where `account_id`=self) |
| Own properties | — | — | ❌ | ✅ (where `owner_account_id`=self) | ❌ | ❌ |
| Own commissions | — | — | ✅ | ❌ | ❌ | ❌ |
| Service jobs | — | — | ❌ | ❌ | ✅ (where assigned) | ❌ |
| Own invoices / pay | — | — | ❌ | ✅ (read) | ❌ | ✅ |
| CS ticket creation | — | — | ❌ | ❌ | ❌ | ✅ |
| **APP 12 data export** | — | — | — | — | — | ✅ (`/v1/guest/me/data`) |

## 4. Agent-sourced bookings

- `bookings.agent_account_id` carries the agent's account ID at creation.
- The agent portal's `GET /v1/agent/bookings` filters by this column.
- Commissions are computed dynamically per booking (`agent-portal.ts:251`) — there is no `commission_payouts` table yet, so payout tracking is currently external (operator-managed).

## 5. Security gaps in roles

| Gap | Severity | Detail |
|---|---|---|
| No fine-grained admin roles (Manager / Receptionist / Housekeeping not modeled) | 🟡 | Code references suggest these were planned; today every Admin has full access |
| `service_host` is multiplexed into `partner_users.portal_type` | 🟢 | Works but conceptually mixes two product-team scopes |
| No "agent acting on behalf of guest" identity context | 🟡 | When an agent books for a guest, audit log records the agent identity but the guest user can't see the agent in their own portal |
| No MFA for any role | 🔴 | Mentioned in privacy policy as "progressively rolling out" — not yet implemented |

See also `_rules/security-rules.md` for the broader audit.

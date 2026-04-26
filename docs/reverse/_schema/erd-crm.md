# CRM Schema — Account / Contact / Commission / Lead

> ⚠️ **NEEDS REVISION** — see `docs/reverse/_audit/T001_RECON_REPORT.md` §g for specific corrections required. Will be rewritten in T002–T007 when its domain folder is processed.


> Source: `lib/db/src/schema/{accounts,contacts,commissions,leads}.ts`

## accounts

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text | |
| account_type | text | e.g. `Guest`, `Agent`, `Owner`, `Vendor`, `Corporate` |
| primary_contact_id | int → contacts.id | |
| secondary_contact_id | int → contacts.id | |
| account_email | text | |
| website_url | text | |
| phone1, phone2 | text | |
| address_line1, address_suburb, address_state, address_postcode, address_country | text | |
| payment_info_id | int | future link to a stored bank/card account |
| default_commission_id | int → commissions.id | for agent accounts |
| default_currency | text | default 'AUD' |
| parent_account_id | int → accounts.id | self-FK for sub-accounts |
| description, manual_input | text | |
| status | text default `Active` | `Active`, `Inactive`, `Suspended` |
| created_at, updated_at, deleted_at | timestamp | soft delete |

**Triggered by:** registration of a new guest (auto-creates Guest account), admin creating Agent/Owner/Vendor accounts.

## contacts

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| first_name, last_name, title, other_name | text | |
| email | text | not unique — same person across accounts |
| mobile_number, office_number | text | |
| date_of_birth, nationality, gender | text/date | |
| sns_id | text | KakaoTalk / WeChat / etc. |
| passport_number, passport_expiry | text/date | sensitive — APP 11 |
| visa_type, visa_expiry | text/date | sensitive — APP 11 |
| address_line1, suburb, state, postcode, country | text | |
| portal_enabled | boolean | does this contact have a portal login? |
| portal_user_id | int | links to guest_users.id when portal_enabled |
| profile_photo_url, description, manual_input | text | |
| status | text | `Active`, `Inactive` |
| created_at, updated_at, deleted_at | timestamp | |

## commissions

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text | label, e.g. "Standard Agent 10%" |
| commission_type | text | `Percentage` \| `Fixed` |
| commission_rate | real | percent (e.g. 10 = 10%) |
| commission_amount | real | flat AUD when `Fixed` |
| applies_to | text | usually `weekly_rent` × stay_weeks |
| account_id | int → accounts.id | which agent account this commission belongs to |
| effective_from, effective_to | date | optional time-bounded |

**Used in:** `routes/agent-portal.ts` (line 251) calculates earned commission per booking.

## leads

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| first_name, last_name, email, phone | text | |
| nationality, university | text | student-targeted lead |
| source | text | `web_form`, `referral`, `agent`, `import` |
| status | text default `New` | `New` → `Contacted` → `Qualified` → `Converted` \| `Lost` |
| assigned_to_admin_id | int → admin_users.id | |
| converted_to_account_id | int → accounts.id | set when conversion happens |
| notes | text | |
| created_at, updated_at, deleted_at | timestamp | |

## Status enums (CRM)

| Table | Field | Values |
|---|---|---|
| accounts | status | `Active`, `Inactive`, `Suspended` |
| contacts | status | `Active`, `Inactive` |
| leads | status | `New`, `Contacted`, `Qualified`, `Converted`, `Lost` |

## C# migration risks

- All money fields here are `real` (single-precision) — should be **`numeric(10,2)`** before EF Core mapping (`decimal` in C#).
- `accounts.parent_account_id` self-FK is fine in EF, but recursive queries should be reviewed.

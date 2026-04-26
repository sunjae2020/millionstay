# Core ERD — Property → Space → Product → Booking → Contract → Invoice

> ⚠️ **NEEDS REVISION** — see `docs/reverse/_audit/T001_RECON_REPORT.md` §g for specific corrections required. Will be rewritten in T002–T007 when its domain folder is processed.


> Schema source: `lib/db/src/schema/*.ts` (Drizzle ORM, PostgreSQL).
> Generated migrations: `lib/db/drizzle/0000_violet_morgan_stark.sql` (baseline).
> No `drizzle-orm/relations` blocks are defined — joins happen at the application layer via FK columns.

## ASCII ERD — Booking Chain

```
                    ┌─────────────────┐
                    │    properties   │
                    │  id (PK)        │
                    │  name, address  │
                    │  owner_account_id ──┐
                    │  approval_status   │
                    └────────┬────────┘    │
                             │ 1:N         │
                             ▼             │
                    ┌─────────────────┐    │
                    │     spaces      │    │
                    │  id (PK)        │    │
                    │  property_id  ──┘    │
                    │  space_type         │
                    │  base_weekly_price  │
                    │  status             │
                    │  landlord_account_id ─┐
                    └────────┬────────┘     │
                             │ 1:N          │
              ┌──────────────┼──────────────────┐
              ▼              ▼                  ▼
      ┌──────────────┐ ┌──────────────────┐ ┌────────────────────┐
      │ contract_    │ │ space_blocked_   │ │ accommodation_     │
      │ products     │ │ dates            │ │ catalog            │
      │ id (PK)      │ │ space_id, date   │ │ space_id           │
      │ space_id     │ │ booking_id       │ │ promotion_id       │
      │ weekly_rate  │ │ reason           │ │                    │
      │ bond_amount  │ └──────────────────┘ └────────────────────┘
      │ admin_fee    │                              │
      │ cleaning_fee │ ◄─────────────────── product_id (link)
      │ promotion_id │
      └──────┬───────┘
             │ 1:N (via contract_product_id)
             ▼
      ┌────────────────────┐         ┌────────────────────┐
      │     bookings       │ 1:1     │     contracts      │
      │  id (PK)           │ ◄────► │  id (PK)            │
      │  booking_ref(uniq) │ booking_│  contract_ref(uniq) │
      │  account_id        │   id    │  booking_id         │
      │  contact_id        │         │  tenant_account_id  │
      │  space_id          │         │  start/end_date     │
      │  product_id        │         │  weekly_rate        │
      │  contract_product_id│        │  bond_amount        │
      │  agent_account_id  │         │  status             │
      │  booking_status    │         │  signed_at, sent_at │
      │  check_in_date     │         │  document_url       │
      │  check_out_date    │         │  terms_text         │
      │  agreed_weekly_rate│         └─────────┬──────────┘
      │  total_rent        │                   │ 1:N
      └────────┬───────────┘                   ▼
               │ 1:N                  ┌────────────────────┐
               ▼                      │     invoices       │
      ┌────────────────────┐          │  id (PK)           │
      │ recurring_schedule │ ───────► │  invoice_ref(uniq) │
      │  contract_id       │          │  booking_id        │
      │  schedule_type     │          │  contract_id       │
      │  frequency         │          │  account_id        │
      │  amount            │          │  amount  numeric   │
      │  next_due_date     │          │  status            │
      └────────────────────┘          │  due_date, paid_at │
                                      │  stripe_*          │
                                      └────────────────────┘
```

## SQL DDL (essential columns)

```sql
CREATE TABLE properties (
  id              serial PRIMARY KEY,
  name            text NOT NULL,
  address         text,
  city            text,
  state           text,
  postcode        text,
  country_code    text,
  lat             real,
  lng             real,
  approval_status text DEFAULT 'Pending',  -- Pending | Approved | Rejected
  owner_account_id integer REFERENCES accounts(id),
  suburb_id       integer,
  description     text,
  deleted_at      timestamp,
  created_at      timestamp DEFAULT now(),
  updated_at      timestamp DEFAULT now()
);

CREATE TABLE spaces (
  id                   serial PRIMARY KEY,
  property_id          integer NOT NULL REFERENCES properties(id),
  parent_space_id      integer REFERENCES spaces(id),
  name                 text NOT NULL,
  space_type           text,        -- Private Room | Shared Room | Whole Property | Other
  custom_type_name     text,
  max_occupancy        integer,
  booking_mode         text,
  base_weekly_price    real,
  base_daily_price     real,
  base_currency        text DEFAULT 'AUD',
  floor_number         integer,
  floor_area_sqm       real,
  description          text,
  ical_import_url      text,
  status               text DEFAULT 'Active',
  space_policy_id      integer,
  landlord_account_id  integer REFERENCES accounts(id),
  privacy_hide_unit_no boolean DEFAULT false,
  privacy_hide_street_no boolean DEFAULT false,
  privacy_map_blur     boolean DEFAULT false,
  deleted_at           timestamp,
  created_at           timestamp DEFAULT now(),
  updated_at           timestamp DEFAULT now()
);

CREATE TABLE contract_products (
  id                       serial PRIMARY KEY,
  space_id                 integer NOT NULL REFERENCES spaces(id),
  promotion_id             integer REFERENCES promotions(id),
  name                     text NOT NULL,
  description              text,
  product_type             text DEFAULT 'Room',
  status                   text DEFAULT 'Draft',
  term_type                text,         -- short | long
  weekly_rate              real,
  monthly_rate             real,
  effective_weekly_rate    real,         -- weekly after promotion
  currency                 text DEFAULT 'AUD',
  billing_frequency        text,         -- Weekly | Biweekly | Monthly
  bond_weeks               integer,
  bond_amount              real,
  admin_fee                real,
  cleaning_fee             real,
  advance_weeks            integer,
  min_stay_weeks           integer DEFAULT 1,
  max_stay_weeks           integer,
  includes_wifi            boolean DEFAULT false,
  includes_parking         boolean DEFAULT false,
  includes_utilities       boolean DEFAULT false,
  includes_meals           boolean DEFAULT false,
  includes_laundry         boolean DEFAULT false,
  includes_cleaning        boolean DEFAULT false,
  extra_inclusions         text,
  notes                    text,
  deleted_at               timestamp,
  created_at               timestamp DEFAULT now(),
  updated_at               timestamp DEFAULT now()
);

CREATE TABLE bookings (
  id                  serial PRIMARY KEY,
  booking_ref         text UNIQUE NOT NULL,
  name                text,
  account_id          integer REFERENCES accounts(id),
  contact_id          integer REFERENCES contacts(id),
  space_id            integer NOT NULL REFERENCES spaces(id),
  product_id          integer,
  contract_product_id integer REFERENCES contract_products(id),
  agent_account_id    integer REFERENCES accounts(id),
  booking_source      text,
  customer_notes      text,
  check_in_date       date,
  check_out_date      date,
  stay_nights         integer,
  stay_weeks          real,
  agreed_weekly_rate  real,
  total_rent          real,
  currency            text DEFAULT 'AUD',
  num_guests          integer,
  booking_status      text DEFAULT 'Draft',
                      -- Draft | PendingPayment | PendingApproval | Confirmed | Active | CheckedOut | Cancelled | NoShow
  cancellation_reason text,
  cancelled_at        timestamp,
  status              text,             -- legacy mirror
  deleted_at          timestamp,
  created_at          timestamp DEFAULT now(),
  updated_at          timestamp DEFAULT now()
);

CREATE TABLE contracts (
  id                   serial PRIMARY KEY,
  contract_ref         text UNIQUE NOT NULL,
  booking_id           integer REFERENCES bookings(id),
  product_id           integer,
  contract_product_id  integer REFERENCES contract_products(id),
  tenant_account_id    integer REFERENCES accounts(id),
  landlord_account_id  integer REFERENCES accounts(id),
  space_id             integer REFERENCES spaces(id),
  start_date           date,
  end_date             date,
  weekly_rate          real,
  total_rent           real,
  bond_amount          real,
  advance_amount       real,
  currency             text DEFAULT 'AUD',
  status               text,        -- Draft | Sent | Signed | Active | Terminated | Expired
  sent_at              timestamp,
  signed_at            timestamp,
  effective_date       date,
  expiry_date          date,
  termination_reason   text,
  document_url         text,
  terms_text           text,
  notes                text,
  deleted_at           timestamp,
  created_at           timestamp DEFAULT now(),
  updated_at           timestamp DEFAULT now()
);

CREATE TABLE space_blocked_dates (
  id          serial PRIMARY KEY,
  space_id    integer NOT NULL REFERENCES spaces(id),
  date        date NOT NULL,
  booking_id  integer REFERENCES bookings(id),
  reason      text
);
-- Used for overbooking prevention; see _workflows/booking-lifecycle.md
```

## Relationship summary

| From | To | Cardinality | FK column |
|---|---|---|---|
| properties | spaces | 1:N | `spaces.property_id` |
| accounts | properties | 1:N | `properties.owner_account_id` |
| spaces | contract_products | 1:N | `contract_products.space_id` |
| spaces | space_blocked_dates | 1:N | `space_blocked_dates.space_id` |
| accommodation_catalog | spaces | N:1 | `accommodation_catalog.space_id` |
| contract_products | bookings | 1:N | `bookings.contract_product_id` |
| accounts | bookings | 1:N | `bookings.account_id` (guest), `bookings.agent_account_id` (agent) |
| contacts | bookings | 1:N | `bookings.contact_id` |
| spaces | bookings | 1:N | `bookings.space_id` |
| bookings | contracts | 1:1 | `contracts.booking_id` |
| contracts | invoices | 1:N | `invoices.contract_id` |
| contracts | recurring_schedule | 1:N | `recurring_schedule.contract_id` |

## Tables missing audit columns

| Table | Missing |
|---|---|
| `guest_users` | `deleted_at` |
| `partner_users` | `deleted_at` |
| `refresh_tokens` | `updated_at`, `deleted_at` |
| `marketing_consents` | `deleted_at` |
| `space_blocked_dates` | `created_at`, `updated_at`, `deleted_at` |

> All other core tables have `created_at`, `updated_at`, `deleted_at`.

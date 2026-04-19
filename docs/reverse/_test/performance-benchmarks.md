# Performance Benchmarks (Targets & Test Plan)

> No load testing has been run against the current Node/Express stack. The targets below are derived from typical SaaS expectations and should be measured before / after the C# port to verify parity.

## 1. Latency targets (p95)

| Endpoint class | Target p95 | Notes |
|---|---|---|
| Auth (`/auth/login`, `/auth/refresh`) | 250 ms | bcrypt is the bottleneck |
| Public space search (`/public/spaces`) | 300 ms | with cache headers `s-maxage=60` |
| Space detail + availability | 400 ms | one extra query for `space_blocked_dates` |
| Booking confirm (the heaviest write path) | 800 ms | because it generates `space_blocked_dates`, contract row, audit row in one transaction |
| Contract activate (generates N invoices) | 1500 ms for a 24-period (12-month biweekly) contract | dominated by N inserts |
| Invoice list (paginated 20) | 200 ms | |
| Guest portal `/me/data` | 800 ms | aggregates 6 child resources + signs URLs |
| Stripe webhook | 200 ms | must respond fast or Stripe retries |

## 2. Throughput targets

| Path | Target | Notes |
|---|---|---|
| Public search | 100 RPS sustained | mostly cacheable |
| Authenticated reads | 50 RPS sustained | |
| Booking writes (peak) | 5 RPS | bound by `space_blocked_dates` write contention |
| Stripe webhook ingestion | 20 RPS burst | |

## 3. Database query budget

| Endpoint | Allowed queries | Current (estimated) |
|---|---|---|
| `GET /v1/bookings/:id` | ≤ 3 | 3–4 (✅) |
| `POST /v1/bookings/:id/confirm` | ≤ 5 + N inserts (N = nights) | currently issues separate inserts per blocked date — **should be a single `insert ... values (..),(..),(..)` batch** |
| `POST /v1/contracts/:id/activate` | ≤ 4 + N inserts (N = periods) | currently per-period insert — batch-able |
| `GET /v1/guest/me/data` | ≤ 8 | currently ~10 (one per resource); acceptable |

## 4. Tools

| Layer | Tool |
|---|---|
| HTTP load | **k6** (`k6 run script.js`) |
| API smoke | **autocannon** for one-off |
| DB query plan | `EXPLAIN (ANALYZE, BUFFERS)` |
| Profiling Node | `--inspect` + Chrome devtools |
| Profiling C# | dotTrace / PerfView |

## 5. Sample k6 script

```js
// scripts/perf-booking-confirm.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 10,
  duration: "30s",
  thresholds: { http_req_duration: ["p(95)<800"] },
};

const BASE = __ENV.BASE_URL || "http://localhost:8080";
const TOKEN = __ENV.ADMIN_TOKEN;

export default function () {
  const id = (__VU * 1000 + __ITER) % 5000 + 1;     // pre-seeded booking IDs
  const r = http.patch(`${BASE}/api/v1/bookings/${id}/confirm`, null, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  check(r, { "200 or 409": (res) => res.status === 200 || res.status === 409 });
  sleep(1);
}
```

## 6. Indexes worth verifying

Most existing indexes are PK-only. Recommended additions:

- `bookings (space_id, check_in_date, check_out_date)` — for availability queries
- `bookings (account_id) WHERE deleted_at IS NULL` — for guest portal
- `bookings (agent_account_id) WHERE deleted_at IS NULL` — for agent portal
- `space_blocked_dates (space_id, date)` UNIQUE — for overbooking guarantee
- `invoices (account_id, status)` — for guest portal invoice list
- `invoices (contract_id)` — for activate/regenerate
- `invoices (due_date) WHERE status = 'Sent' AND deleted_at IS NULL` — for the future overdue job
- `system_log (entity_type, entity_id, created_at DESC)` — for the future audit viewer
- `recurring_schedule (next_due_date) WHERE is_active` — already exists ✅
- `documents (entity_type, entity_id)` — already exists ✅
- `documents (retention_until) WHERE deleted_at IS NULL` — already exists ✅

## 7. Caching strategy (recommended)

| Cache | What |
|---|---|
| HTTP `Cache-Control` | Public space search & details: `public, s-maxage=60, stale-while-revalidate=120` |
| In-process | None today; keep stateless to allow horizontal scaling |
| CDN | Cloudinary already CDN-fronts images; use a CDN for the marketing site if traffic warrants |

## 8. Memory / runtime targets

| Metric | Target |
|---|---|
| API container RSS at idle | < 200 MB |
| API container RSS at p95 load | < 400 MB |
| Cold start time | < 2 s |
| Open DB connections (pool max) | 10 — tune via `pg.Pool({ max: 10 })` |

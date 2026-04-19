# Million Stay PMS — Replit 역방향 문서화 프롬프트 통합본
> 기존 Replit 코드베이스를 분석하여 `_context` `_rules` `_schema` `_design` `_templates` `_workflows` `_test` 7개 폴더 문서를 자동 생성하기 위한 프롬프트 모음

---

## 📌 사용 방법

1. 아래 각 프롬프트를 **Replit AI Chat**에 순서대로 붙여넣기
2. 응답 결과를 해당 폴더의 `.md` 파일로 저장
3. 불일치 항목은 `[TODO]` 태그로 표시 후 수동 보완

## 📌 실행 순서

```
STEP 0  전체 스캔       ← 반드시 첫 번째 실행 (이후 모든 프롬프트의 기반)
STEP 1  _schema/       ← DB 구조가 모든 문서의 기반
STEP 2  _context/      ← 스키마 기반으로 도메인 모델 정의
STEP 3  _rules/        ← 코드에서 규칙 추출
STEP 4  _workflows/    ← 비즈니스 로직 흐름 추출
STEP 5  _design/       ← UI 컴포넌트 인벤토리
STEP 6  _templates/    ← 반복 패턴 추출
STEP 7  _test/         ← 검증 기준 도출
```

---

---

# STEP 0 — 프로젝트 전체 스캔 (필수 선행)

---

## PROMPT 00-A │ 프로젝트 전체 구조 파악

```
Perform a complete reverse documentation audit of this entire codebase.

Give me a structured overview:

1. PROJECT STRUCTURE
   - List all top-level folders and their purpose
   - Identify: routes, services, models, utils, middleware, frontend pages

2. TECH STACK
   - Framework, DB, Auth library, key dependencies
   - List from package.json / requirements.txt grouped by purpose

3. DATABASE MODELS
   - List every model/table name
   - Note any missing: created_at, updated_at, soft-delete columns

4. API ROUTES
   - List every route file and the endpoints it contains

5. FRONTEND PAGES
   - List every page component (admin portal + guest portal separately)

6. MISSING PIECES
   - What backend features have no frontend UI?
   - What routes have no service layer?
   - What models have no API endpoint?

Format as a structured Markdown report.
Be exhaustive — document what EXISTS, not what SHOULD exist.
```

---

## PROMPT 00-B │ 기능 구현 현황 갭 분석

```
Compare the current implementation against this intended feature list.
For each feature, mark: ✅ Fully implemented | ⚠️ Partially | ❌ Not implemented | 🔲 Backend only (no UI)

ADMIN FEATURES:
- Dashboard (occupancy, revenue, check-in/out schedule)
- Booking: create, list, confirm, cancel, check-in, check-out
- Contracts: manage, activate, PDF download
- Finance: invoice list, payment processing, receipt, payment schedule
- Property / Space / Product management
- Promotions (percentage + fixed discount)
- Agent commission setup and tracking
- Work Orders (maintenance)
- CS Tickets
- System Settings

GUEST PORTAL FEATURES:
- Property search with availability filter
- Booking wizard (multi-step)
- My Bookings page
- Invoices page
- Documents upload/download
- CS ticket submission
- Profile management

After the matrix, list:
1. Top 5 highest-priority gaps
2. Any features built in backend but completely missing from frontend
```

---
---

# STEP 1 — `_schema/` 추출

---

## PROMPT 01-A │ ERD 핵심 스키마 추출

```
Analyze the ENTIRE codebase and extract the complete database schema.

Tasks:
1. Find all database model definitions (ORM models, schema files, migration files, raw SQL)
2. For each table/model, document:
   - Table name
   - All columns: name, data type, nullable, default value
   - Primary keys and foreign keys
   - Unique constraints and indexes
3. Map all relationships between tables (one-to-many, many-to-many)
4. Draw an ASCII ERD showing the full entity relationship diagram
5. Highlight the core booking chain:
   Property → Space → Product → Booking → Contract → Invoice → PaymentSchedule

Output format: Markdown with SQL DDL code blocks.
Save as: _schema/erd-core.md
```

---

## PROMPT 01-B │ CRM & Finance 스키마 추출

```
Focus on CRM and Finance related tables.

CRM Tables — find and document:
- Account, Contact, Commission, Lead
- All columns, foreign keys, enum/status values (list ALL possible values)

Finance Tables — find and document:
- Invoice, PaymentSchedule, Receipt, PaymentMethod
- All columns, status values, computed fields or virtual columns

For each table, also document:
- What triggers record creation?
- What triggers status changes?
- Any fields that could cause migration issues to C# / SQL Server?

Save as:
  _schema/erd-crm.md
  _schema/erd-finance.md
```

---

## PROMPT 01-C │ Operations & Log 스키마 추출

```
Focus on operational and logging tables.

Find and document:
1. WorkOrder, ServiceCatalog, CSTicket — full column definitions + all status enums
2. Any audit log, activity log, or system log tables

Then answer:
- Is there a SystemLog / AuditLog table? If YES, what does it capture?
- If NO audit log exists, list all state-changing operations that currently have no audit trail

Flag any tables that change state but have no corresponding log record.

Save as: _schema/erd-operations.md
```

---

## PROMPT 01-D │ API 엔드포인트 전체 목록 추출

```
Analyze all route and controller files in this project.

For EVERY API endpoint, create a table with:
| Method | Path | Handler Function | Auth Required | Roles Allowed | Description |

Group by domain:
- Auth
- Property / Space / Product
- Booking
- Contract
- Finance (Invoice, Payment)
- CRM (Account, Contact, Commission)
- Operations (WorkOrder, Ticket)
- Settings

Also flag:
- [ ] Endpoints with NO authentication check (security risk)
- [ ] Endpoints missing input validation
- [ ] Endpoints with no error handling
- [ ] Endpoints that exist in code but are not yet connected to the frontend

Save as: _schema/api-endpoints.md
```

---

## PROMPT 01-E │ DTO / Request-Response 구조 추출

```
Analyze all request validation schemas, serializers, or DTO definitions.

For each API endpoint group, document:
1. Request body: field name, type, required/optional, validation rules
2. Response body: field name, type, always present vs conditional
3. Error response format

Flag any endpoints where:
- Input is not validated at all
- Response structure is inconsistent across calls
- Types would cause issues migrating to C# (dynamic keys, any-typed fields, nested untyped objects)

Output using TypeScript-style interface definitions even if the project uses JavaScript/Python.

Save as: _schema/dto-contracts.md
```

---
---

# STEP 2 — `_context/` 추출

---

## PROMPT 02-A │ 도메인 모델 & 계층 구조 확인

```
Based on the codebase, reverse-engineer the domain model.

Answer with evidence from the code:

1. HIERARCHY
   - Does the system implement Property → Space → Product structure?
   - If YES: show exact model names and foreign key chain
   - If NO or PARTIAL: document what structure currently exists and what is missing

2. BOOKING CHAIN
   - What entity chain is created when a guest books?
   - List every table that gets a new record, in order
   - Is each step triggered automatically by code or manually by admin?

3. STAY TYPES
   - How does the system differentiate short-term vs long-term stays?
   - Is it a flag on Product? A separate model? Handled only in code?

4. SPACE TYPES
   - List all enum values or string constants used for space/room types

5. FEES
   - Where exactly are Weekly Rate, Cleaning Fee, Admin Fee, Bond Amount defined?
   - Are they on the Product model or elsewhere?

Save as: _context/domain-model.md
```

---

## PROMPT 02-B │ 사용자 역할 & 권한 체계 확인

```
Analyze the authentication and authorization implementation.

Document:

1. USER ROLES
   - List all role names/values found in the codebase
   - Where are they defined? (enum, constant, DB table, hardcoded strings?)

2. PERMISSION CHECKS
   - Scan all route middleware, guards, or decorators
   - Build a permissions matrix: Role (rows) × Endpoint/Feature (columns)

3. PORTAL SEPARATION
   - Is there code-level separation between Admin and Guest portals?
   - Same codebase? Separate apps? How is routing/access handled?

4. AGENT HANDLING
   - Is there special handling for Agent-type users?
   - How is an agent-sourced booking tracked?
   - Can agents log in? Which portal?

5. SECURITY GAPS
   - List any routes/features with NO role check

Save as: _context/user-personas.md
```

---

## PROMPT 02-C │ 기술 스택 & 프로젝트 구조 확인

```
Perform a full tech stack audit.

1. DEPENDENCIES
   List all packages from package.json / requirements.txt
   Group by: Framework | DB/ORM | Auth | File handling | Email | Testing | Utilities

2. PROJECT STRUCTURE
   Map the folder structure — what is in each folder?
   Is there clear separation of: routes / services / models / utils / middleware?

3. DATABASE
   - Which DB is used? Connection method? ORM/query builder?
   - Is there a migration system? List migration files if present.

4. AUTH IMPLEMENTATION
   - JWT or Session? Which library?
   - Where is the auth middleware? Is it applied consistently?

5. C# MIGRATION RISK ASSESSMENT
   List any patterns that would NOT translate well to C# .NET:
   - Dynamic typing, Python/JS-specific features, missing interfaces
   - Rate each risk: 🔴 High / 🟡 Medium / 🟢 Low

Save as: _context/tech-stack.md
```

---

## PROMPT 02-D │ 비즈니스 제약 조건 추출

```
Find all business rule validations in the codebase.

1. BOOKING CONSTRAINTS
   - Where is overbooking prevention implemented? Paste the code.
   - Is minimum/maximum stay enforced? Paste the validation code.
   - Are past-date bookings blocked? Where?

2. FINANCIAL CONSTRAINTS
   - Is Invoice immutability enforced? Or can invoices be edited directly?
   - Where is Est. Due Today calculated? Show the exact formula in code.
   - Is Bond amount tracked separately from revenue?

3. STATUS CONSTRAINTS
   - Are state transitions validated before execution?
   - List ALL places where status is checked before an action proceeds.

4. MISSING CONSTRAINTS (gaps)
   - List any business rules that SHOULD exist but are NOT currently enforced in code
   - Flag each with priority: 🔴 Critical / 🟡 Important / 🟢 Nice-to-have

Save as: _context/constraints.md
```

---
---

# STEP 3 — `_rules/` 추출

---

## PROMPT 03-A │ 아키텍처 패턴 & 규칙 추출

```
Perform a Clean Architecture compliance audit.

1. LAYER SEPARATION (Score each 1–5):
   - Is business logic separated from route handlers?
   - Is DB access isolated in a repository/data layer?
   - Do routes only handle HTTP concerns (validation, serialization)?

2. VIOLATIONS FOUND
   - List files where business logic is mixed into route handlers
   - List direct DB queries inside route files
   - List any cross-layer dependencies that shouldn't exist

3. NAMING CONVENTIONS IN USE
   - File naming pattern (camelCase / snake_case / PascalCase)
   - Function naming, variable naming
   - Are these consistent? Note inconsistencies.

4. ARCHITECTURE DIAGRAM
   - Draw the ACTUAL current architecture as ASCII
   - Then draw the TARGET Clean Architecture
   - Mark the delta between them

Save as: _rules/architecture-rules.md
```

---

## PROMPT 03-B │ 재무 처리 규칙 추출

```
Find all financial calculation logic.

1. ROUNDING
   - Find all Math.round(), toFixed(), Decimal() usages
   - Is rounding consistent (ROUND_HALF_UP)?
   - Any risk of floating-point precision errors?

2. FEE CALCULATIONS
   - Paste the exact code that calculates Est. Due Today
   - Is there a centralized calculation utility or is logic scattered?
   - Does it correctly include: Bond + Admin + Cleaning + (Weekly Rate × 2)?

3. INVOICE HANDLING
   - Can invoices be edited after creation? Show the update route.
   - Is there a Credit Note / void mechanism?
   - What happens to future invoices if a booking is cancelled?

4. PROMOTIONS
   - Where is discount calculation done?
   - Are both Percentage and Fixed discount types implemented?
   - Can multiple promotions stack? What is the priority logic?

5. COMMISSION
   - Where is commission calculated? Paste the code.
   - At what lifecycle point is it applied?

Save as: _rules/financial-rules.md
```

---

## PROMPT 03-C │ 보안 규칙 & 취약점 감사

```
Perform a security audit.

1. AUTHENTICATION
   - JWT: Where is token generated, validated, refreshed?
   - Token expiry settings for access token and refresh token
   - Are tokens stored securely on the client?

2. AUTHORIZATION
   - Is RBAC consistently applied?
   - List routes with NO auth middleware — are they intentionally public?
   - Can Guest A access Guest B's data? Trace the query logic.

3. INPUT VALIDATION
   - What validation library is used?
   - Are all POST/PATCH endpoints validated?
   - List endpoints with NO input validation

4. SENSITIVE DATA
   - Are passwords hashed? Which algorithm (bcrypt, argon2)?
   - Is sensitive data exposed in error messages or logs?
   - Are environment variables used for all secrets? (No hardcoded keys?)

5. TOP 5 SECURITY RISKS
   List the 5 biggest security vulnerabilities in the current code with severity.

Save as: _rules/security-rules.md
```

---

## PROMPT 03-D │ C# 마이그레이션 호환성 검사

```
This project will migrate to C# .NET. Audit for compatibility.

Find ALL instances of — rate each: 🔴 High / 🟡 Medium / 🟢 Low risk

1. LOOSE TYPING
   - Functions returning plain objects/dicts instead of typed structures
   - Use of `any`, untyped parameters, dynamic key access
   - Missing TypeScript interfaces or Python TypedDicts

2. LANGUAGE-SPECIFIC PATTERNS
   - Python: list comprehensions in business logic, *args/**kwargs
   - JavaScript: prototype manipulation, dynamic property assignment
   - Any pattern with no direct C# equivalent

3. LIBRARY DEPENDENCIES
   - List each library used and its C# equivalent
   - Flag libraries with NO C# equivalent

4. DATABASE PATTERNS
   - JSONB/JSON columns storing critical queryable data
   - Raw SQL mixed with ORM
   - PostgreSQL-specific functions (need SQL Server alternatives)

For each 🔴 item: provide the refactoring approach for C# compatibility.

Save as: _rules/no-magic-rules.md
```

---
---

# STEP 4 — `_workflows/` 추출

---

## PROMPT 04-A │ 예약 생명주기 (Booking Lifecycle) 추출

```
Trace the complete Booking lifecycle through the codebase.

1. STATUS VALUES
   - List every possible Booking status value found in the code
   - Is there a state machine implementation or just if/else checks?

2. STATE TRANSITIONS
   For EACH status change, document:
   - What API endpoint triggers it?
   - What validations run before the change?
   - What side effects happen after? (auto-creates, emails, schedule generation, etc.)
   - Is it recorded in an audit log?

3. CONTRACT CREATION
   - When exactly is a Contract created?
   - Is it automatic or requires a separate API call?
   - What is the Contract's initial status?

4. OVERBOOKING PREVENTION
   - Paste the exact SQL or ORM query used to check availability
   - Is there a race condition risk? (Is there a DB-level lock or transaction?)

5. STATE MACHINE DIAGRAM
   Draw the complete Booking state machine as ASCII art including:
   all statuses, all transitions, the trigger for each, and side effects

Save as: _workflows/booking-lifecycle.md
```

---

## PROMPT 04-B │ 납부 워크플로우 (Payment Workflow) 추출

```
Trace all payment-related workflows.

1. PAYMENT SCHEDULE GENERATION
   - When is PaymentSchedule created? (On confirm? On activate?)
   - Paste the complete schedule generation logic
   - How are short-term (2-week) and long-term (monthly) schedules handled differently?

2. INVOICE LIFECYCLE
   - When are Invoices created from the schedule?
   - List every Invoice status and transition logic
   - What triggers changes: manual admin action or automated batch job?

3. OVERDUE HANDLING
   - Is there a scheduled job/cron for marking invoices overdue?
   - What happens after overdue? (Notification? Late fee? Grace period?)

4. BOND REFUND FLOW
   - How is bond refund initiated?
   - Is there a WorkOrder or ticket linkage for bond disputes?

5. RECEIPT GENERATION
   - When is a Receipt created?
   - What data fields does it contain?

Save as: _workflows/payment-workflow.md
```

---

## PROMPT 04-C │ 체크인/아웃 & 연장 워크플로우 추출

```
Document check-in, check-out, and stay extension workflows.

1. CHECK-IN
   - What API endpoint handles check-in?
   - What validations run? (e.g., invoice paid check, date check)
   - What records are updated?

2. CHECK-OUT
   - What happens to the Space record on checkout?
   - Is a cleaning WorkOrder automatically created?
   - How is bond refund initiated?
   - What happens if there are unpaid invoices at checkout?

3. STAY EXTENSION
   - Is there a stay extension feature?
   - Is it implemented as a new booking or modifying check_out_date?
   - Are new invoices generated for the extended period?

4. EARLY TERMINATION
   - Can a contract be terminated before check-out date?
   - What is the penalty/fee calculation?
   - How are future unpaid invoices handled?

Save as: _workflows/checkin-checkout-workflow.md
```

---

## PROMPT 04-D │ 에이전트 커미션 & 프로모션 워크플로우 추출

```
Document agent commission and promotion workflows.

COMMISSIONS:
1. How is an agent linked to a booking at creation time?
2. When is commission calculated? (On confirm? On activate? On payment?)
3. Paste the commission calculation code — Percentage vs Fixed
4. Is there a commission payment tracking/payout system?

PROMOTIONS:
1. How is a promotion linked to a product?
2. When is the discount applied — at booking creation or invoice generation?
3. Are promotions validated for expiry date at time of booking?
4. Can multiple promotions apply to one booking? What is the priority logic?
5. Is the original price saved alongside the discounted price for audit trail?

Save as:
  _workflows/agent-commission-workflow.md
  _workflows/promotion-application-logic.md
```

---

## PROMPT 04-E │ 유지보수 & CS 워크플로우 추출

```
Document maintenance and customer service workflows.

WORK ORDERS:
1. What triggers WorkOrder creation? (Manual only or auto-triggered?)
2. List all WorkOrder statuses and allowed transitions
3. How are WorkOrders assigned to staff?
4. Is there cost tracking on WorkOrders?
5. How does a completed WorkOrder link back to billing (if at all)?

CS TICKETS:
1. How can a ticket be created? (Guest portal? Admin? Email?)
2. List all ticket statuses and transitions
3. Is there a ticket-to-WorkOrder conversion feature?
4. What notification system exists for ticket updates?

AUTOMATION GAPS:
- On checkout: Is a cleaning WorkOrder auto-created? Should it be?
- On maintenance complete: Is the guest notified?
- List any workflow automations that SHOULD exist but currently do not

Save as: _workflows/maintenance-workflow.md
```

---
---

# STEP 5 — `_design/` 추출

---

## PROMPT 05-A │ UI 컴포넌트 인벤토리 추출

```
Audit all UI components in the frontend codebase.

1. SHARED/COMMON COMPONENTS
   - List every reusable component: name, file path, props it accepts
   - Group by type: Layout | Form | Display | Navigation | Modal | Table | Badge

2. ADMIN PAGE COMPONENTS
   - Dashboard: what widgets/panels does it contain?
   - Bookings: List, Detail, Create form — what fields are on each?
   - Finance: Invoice list, payment form
   - Property: Property/Space/Product management

3. GUEST PORTAL PAGE COMPONENTS
   - Search: how does availability search UI work?
   - Booking wizard: how many steps? What is on each step?
   - My Bookings: what information is shown per booking?

4. STATUS BADGES
   - List: status value → color/style mapping currently in code
   - Are these consistent across Booking, Contract, Invoice?

5. MISSING COMPONENTS
   - What backend features have NO frontend UI yet?

Save as: _design/component-library.md
```

---

## PROMPT 05-B │ 어드민 레이아웃 & 네비게이션 추출

```
Document the admin portal layout and navigation.

1. SIDEBAR MENU
   - List every menu item and sub-item currently implemented
   - Note any placeholder or disabled menu items
   - Compare against intended: Dashboard | Bookings | Contracts | Finance | Property | Products | CRM | Sales | Services | Maintenance | CS | Settings
   - Flag: what menu items are MISSING from the intended structure?

2. DASHBOARD
   - What KPI cards/widgets are on the dashboard?
   - Is there an Availability Calendar? Describe its current implementation.
   - What data is fetched and from which endpoints?

3. LAYOUT SYSTEM
   - What CSS framework is used?
   - Is the layout responsive / mobile-friendly?
   - What color scheme and fonts are in use?

4. ADMIN UX FLOWS
   - How does booking confirmation work in the UI? (Button? Modal? Inline?)
   - How does contract activation work?

Draw ASCII wireframes for Dashboard and Booking list page.
Save as: _design/admin-layout.md
```

---

## PROMPT 05-C │ 게스트 포털 레이아웃 추출

```
Document the guest portal UI and booking wizard flow.

1. BOOKING WIZARD
   - How many steps are in the booking flow?
   - What happens on each step? (Fields shown, validation, API calls made)
   - How is Est. Due Today calculated and displayed?
   - Is there a date picker with availability blocking?

2. MY BOOKINGS PAGE
   - What information is shown for each booking?
   - Can guests cancel their own bookings?
   - Can guests download their contract PDF?

3. INVOICES PAGE
   - How are invoices listed and filtered?
   - Is there an online payment integration? (Stripe? Manual bank transfer?)

4. GUEST PORTAL GAPS
   - What admin-side features have no guest-facing counterpart?
   - What should guests be able to do that they currently cannot?

Save as: _design/guest-portal-layout.md
```

---

## PROMPT 05-D │ 디자인 토큰 & 스타일 시스템 추출

```
Extract the design system foundations.

1. COLOR SYSTEM
   - List all color variables/tokens (CSS variables, Tailwind config, theme file)
   - Identify: primary, secondary, accent, success, warning, danger, info colors
   - Flag any hardcoded hex values that should be tokenized

2. TYPOGRAPHY
   - What fonts are loaded?
   - List all font sizes in use
   - Is there a consistent type scale?

3. SPACING & LAYOUT
   - What spacing units are used? (rem, px, Tailwind classes)
   - Max-width containers, grid columns

4. COMPONENT STATES
   - How are loading, empty, error states handled visually?
   - Is there a consistent skeleton/loading pattern?

5. DESIGN DEBT
   - List inline styles that should be moved to tokens
   - Inconsistent patterns that need standardization before Phase 2

Save as: _design/design-tokens.md
```

---
---

# STEP 6 — `_templates/` 추출

---

## PROMPT 06-A │ 반복 코드 패턴 추출

```
Find all repeating code patterns that should be standardized as templates.

1. CRUD PATTERN
   - Find 3 examples of route + service + repository for different entities
   - Identify the common structure
   - Note any entities that deviate from the pattern and why
   - Extract the IDEAL template from the best-implemented example

2. ERROR HANDLING PATTERN
   - How are errors currently caught and returned?
   - Is there a global error handler? Paste it.
   - Are custom error classes used?
   - What is the standard error response format? Is it consistent?

3. RESPONSE FORMAT
   - What is the standard success response envelope? (data wrapper, pagination?)
   - Are all endpoints consistent?

4. MIDDLEWARE PATTERN
   - List all middleware functions and what they do
   - Is auth middleware applied consistently?

Output the ACTUAL patterns from this codebase as the templates.
Save as: _templates/crud-service-template.md
```

---

## PROMPT 06-B │ 감사 로그 구현 현황 추출

```
Find all audit trail / logging implementations.

1. SYSTEM LOG STATUS
   - Is there a SystemLog table or equivalent?
   - What events are currently being logged?
   - What data is captured per log entry? (actor, action, entity, before/after state?)

2. LOG COVERAGE
   List all state-changing operations and mark:
   ✅ Logged | ❌ Not logged

   Priority operations to check:
   - Booking status changes (pending→confirmed, confirmed→active, etc.)
   - Invoice payments
   - Contract activation / termination
   - Check-in / check-out
   - User login / logout

3. LOG FORMAT
   Paste an example log record from DB or code.
   Does it capture before/after state or just the action?

4. IF NO AUDIT LOG EXISTS
   List every function that changes data in the DB.
   Generate the SystemLog table DDL needed for this specific codebase.

Save as: _templates/audit-log-template.md
```

---

## PROMPT 06-C │ 금융 계산 로직 추출

```
Find and consolidate all financial calculation code.

1. FEE CALCULATIONS
   - Find every place monetary amounts are calculated
   - Paste the code for: Est. Due Today, weekly rent, commission, tax
   - Is there a centralized calculator utility or scattered logic?

2. PAYMENT SCHEDULE GENERATION
   - Paste the complete payment schedule generation function
   - How does it handle the first payment vs recurring payments?
   - How does it handle the last partial period?

3. ROUNDING
   - Find all number formatting/rounding in the codebase
   - Is it consistent? What method is used?
   - Any floating-point precision risks?

4. DISCOUNT APPLICATION
   - How and where is the discount subtracted?
   - Is the original price preserved alongside the discounted price?

Output the ACTUAL code from this project.
Save as: _templates/financial-calculation-template.md
```

---
---

# STEP 7 — `_test/` 추출

---

## PROMPT 07-A │ 기존 테스트 커버리지 감사

```
Audit all existing tests in this codebase.

1. TEST INVENTORY
   - List every test file and what it tests
   - Coverage by domain: Booking | Finance | Auth | Property | CRM | Operations

2. COVERAGE GAPS
   - What critical paths have NO tests?
   - Priority: overbooking prevention, fee calculation, auth/role checks

3. TEST QUALITY
   - Are edge cases tested? (empty inputs, boundary values, concurrent requests)
   - Are error paths tested? (invalid inputs, unauthorized access)

4. TEST SETUP
   - What testing framework is used?
   - Are tests unit / integration / e2e?
   - Are there mocks or fixtures? List them.

Save as: _test/existing-test-coverage.md
```

---

## PROMPT 07-B │ 예약 & 금융 엣지 케이스 테스트 케이스 도출

```
Generate a complete test case specification and verify against the current codebase.

OVERBOOKING TESTS — for each, run and document: ✅ PASS | ❌ FAIL | ⬜ NOT TESTED

| # | Scenario | Expected |
|---|----------|----------|
| OB01 | Same space, exact same dates | 409 Conflict |
| OB02 | Same space, overlapping start date | 409 Conflict |
| OB03 | Same space, overlapping end date | 409 Conflict |
| OB04 | New booking completely inside existing | 409 Conflict |
| OB05 | Adjacent dates (checkout = checkin of new) | 201 Created |
| OB06 | Dates overlap with CANCELLED booking only | 201 Created |
| OB07 | Two simultaneous requests for same space/dates | 1 success, 1 fail |

STAY DURATION TESTS:
| S01 | Below min_stay_weeks | 422 |
| S02 | Exactly min_stay_weeks | 201 |
| S03 | Above max_stay_weeks | 422 |
| S04 | max_stay_weeks = NULL, any duration | 201 |

FINANCIAL CALCULATION TESTS (verify with actual numbers):
| F01 | Weekly $350, Clean $50, Admin $150, Bond $700 | Est. Due = $1,750 |
| F02 | Above + 10% Percentage Promo | 2-week rent = $630, Total = $1,530 |
| F03 | Weekly $350, Fixed $100 discount | 2-week rent = $600, Total = $1,500 |
| F04 | Weekly $333.33 × 2 | $666.66 (ROUND_HALF_UP) |
| F05 | Total rent $2,800 × 10% commission | Commission = $280.00 |

Save as: _test/booking-test-cases.md
```

---

## PROMPT 07-C │ 권한 & API 보안 테스트 케이스 도출

```
Generate role-permission test cases based on current implementation.

AUTH BASELINE TESTS:
- No token → Expected: 401
- Expired token → Expected: 401
- Invalid token → Expected: 401
- Valid token, wrong role → Expected: 403

ROLE PERMISSION MATRIX — test each combination and mark actual result:
✅ Allowed | ❌ Blocked | ⬜ Not implemented

| Endpoint | Admin | Manager | Receptionist | Housekeeping | Guest |
|----------|-------|---------|--------------|--------------|-------|
| POST /bookings/confirm | | | | | |
| POST /contracts/activate | | | | | |
| GET /bookings (all records) | | | | | |
| GET /invoices (all records) | | | | | |
| POST /work-orders | | | | | |
| PATCH /work-orders/:id/complete | | | | | |
| GET /settings | | | | | |

DATA ISOLATION TESTS:
- Guest A requests GET /bookings/:id owned by Guest B → Expected: 403
- Guest requests GET /bookings with no filter → Expected: only their own data

Run these against the current API and document actual vs expected results.

Save as: _test/api-test-checklist.md
```

---

## PROMPT 07-D │ Phase 2 마이그레이션 준비도 체크리스트

```
Evaluate this codebase's readiness for migration to C# .NET.

For each item mark: ✅ Done | ⚠️ Partial | ❌ Not done | 🔴 Blocker

SCHEMA COMPATIBILITY:
[ ] All column types are SQL Server compatible (no PostgreSQL-exclusive types)
[ ] No JSONB columns storing critical queryable/filterable data
[ ] All foreign keys explicitly defined
[ ] No composite primary keys that EF Core cannot handle
[ ] Enum values are strings, not integers

API CONTRACT CONSISTENCY:
[ ] All DTOs explicitly typed (no loose plain objects)
[ ] Pagination structure standardized: { data, pagination: { page, limit, total } }
[ ] Error response format consistent across all endpoints
[ ] No endpoint returns conditional field sets without documentation

BUSINESS LOGIC ISOLATION:
[ ] Service layer contains all business rules (nothing in routes)
[ ] Repository layer contains only DB queries (no business logic)
[ ] No business logic in the database (no stored procedures or triggers)
[ ] All calculations in centralized utility functions

AUDIT & LOGGING:
[ ] All state changes recorded in SystemLog
[ ] Before/after state captured in each log
[ ] All logs include actor ID and timestamp

For each ❌ or ⚠️ item, add:
- Migration impact: HIGH / MEDIUM / LOW
- Estimated refactoring effort in hours
- Suggested fix approach

Save as: _test/migration-readiness-checklist.md
```

---

## PROMPT 07-E │ 성능 기준치 & 병목 분석

```
Analyze the codebase for performance risks and establish benchmarks.

1. SLOW QUERY RISKS
   - Find the availability check query — does it use indexes?
   - Find queries that load full table without pagination (no LIMIT)
   - Find N+1 query patterns (DB call inside a loop)

2. MISSING INDEXES
   - Based on common query patterns, what indexes should exist?
   - Check these specifically:
     - booking by guest_id
     - invoice by due_date + status (overdue batch query)
     - space availability by space_id + date range

3. CURRENT PERFORMANCE BASELINE
   If possible to run: measure response times for
   - GET /bookings (paginated list)
   - GET /spaces/:id/availability
   - POST /contracts/:id/activate (invoice batch generation)

4. BENCHMARK TARGETS for Phase 2:
   - Availability check: < 100ms
   - Booking list (paginated, 20 items): < 200ms
   - Invoice batch generation (50 invoices): < 2s

For each identified risk, suggest the fix (add index, add pagination, eager load, etc.)

Save as: _test/performance-benchmarks.md
```

---
---

# ⚡ QUICK REFERENCE — 즉시 실행용 핵심 프롬프트

> 전체 프롬프트를 순서대로 실행할 시간이 없을 때 아래 6개만 실행하면 핵심 문서가 완성됩니다.

---

### QR-1 │ 전체 스캔 (5분)

```
Perform a complete reverse documentation audit of this project.
List: all folders and purpose, tech stack, every DB model, every API route, every frontend page.
Flag: backend features with no frontend, routes with no service layer.
Output as structured Markdown.
```

---

### QR-2 │ DB 스키마 + ERD (10분)

```
Extract the complete database schema. For every table: all columns with types, PKs, FKs, enums.
Draw ASCII ERD. Show the booking chain: Property → Space → Product → Booking → Contract → Invoice.
Flag any table missing created_at, updated_at, or soft-delete.
Output as Markdown with SQL DDL.
```

---

### QR-3 │ 상태 머신 (10분)

```
Find every status field in every model. For each:
- List ALL possible values
- Map allowed transitions (which status → which status)
- What API endpoint triggers each transition?
- What side effects fire on each transition?
Draw ASCII state machines for Booking, Contract, Invoice.
Flag any transitions with no validation check.
```

---

### QR-4 │ 금융 계산 로직 (5분)

```
Find and paste the exact code for:
1. Est. Due Today calculation (expected: Bond + Admin + Cleaning + Weekly×2)
2. Payment schedule generation logic
3. Commission calculation
4. Promotion/discount application
Is there a centralized calculator? Is rounding consistent?
```

---

### QR-5 │ 권한 매트릭스 (5분)

```
List all user roles. For every API endpoint, what roles can access it?
Build a permissions matrix: Role (rows) × Endpoint (columns).
List routes with NO auth check. Test: can Guest A access Guest B's bookings?
```

---

### QR-6 │ C# 마이그레이션 준비도 (10분)

```
Rate this codebase's C# .NET migration readiness (1–10).
Check: typed DTOs, business logic in services, DB queries in repositories, string-based enums, no PostgreSQL-specific features.
For each problem: 🔴 Blocker / 🟡 Needs work / 🟢 Fine + estimated fix time in hours.
```

---

*— End of Million Stay PMS Reverse Documentation Prompt Pack —*

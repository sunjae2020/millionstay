---
status: live
domain: 인프라
last_verified: 2026-08-31
---

# 시스템 감사 결과 — 2026-08-31

점검표: [../OPERATIONS_AUDIT_CHECKLIST.md](../OPERATIONS_AUDIT_CHECKLIST.md)
감사 대상: **`origin/main` = `03263bd8`** (실제 배포본). 주 체크아웃은 이보다 281커밋 뒤처져
있어 별도 워크트리를 만들어 감사했습니다.
방법: 정적 분석 전용(읽기 전용). **DB·네트워크 접속 없음.** 7개 병렬 에이전트 + 리포 자체 검사 스크립트.

## 요약

정적 게이트(`pnpm typecheck` 0 에러, privacy checks PASS, 브랜드 드리프트 0)는 그린이고,
**행 단위 격리·SQLi·개발용 라우트 노출은 실측 결과 깨끗**했습니다. 반면 **비밀정보 1건과
개인정보 처리 1건이 즉시 조치 대상**이고, 청구·계약 도메인에 **돈이 새거나 발행이 멈추는
경로 3건**이 열려 있습니다.

가장 뼈아픈 발견은 **이미 고쳐 둔 수정이 배포되지 않은 것**입니다. 청구서 번호 채번을
하나로 합친 커밋(`68605996`, 8월 22일)이 `fix/invoice-ref-collision` 브랜치에 남아 있고
main에 머지되지 않아, 과거 중복 키 사고를 냈던 개수 기반 채번이 프로덕션에 6곳 그대로입니다.

| 등급 | 건수 |
|---|---|
| P0 Critical | 5 |
| P1 High | 12 |
| P2 Medium | 11 |
| P3 Low | 6 |

---

## P0 — Critical (즉시)

### [C-1] 프로덕션 DB 비밀번호가 git에 커밋됨
- **섹션** §6.3 시크릿 관리 · **파급** all-instances
- **증거** `docs/LOCAL_DEV.md:78` — `PGPASSWORD='…'` + 전체 Supabase pooler 접속 문자열(호스트·유저·DB).
  git 추적 파일이며 커밋 `aa3936f5`(**2026-04-30**)부터 **4개월간** 히스토리에 존재.
- **영향** 리포 접근 권한자 또는 유출된 clone 누구나 프로덕션 DB에 읽기·쓰기로 직접 접속.
  전 테넌트의 계약·청구·개인정보가 이 문자열 하나 뒤에 있습니다.
- **권고** ① Supabase 비밀번호 **즉시 회전**(파일 삭제만으로는 히스토리에 남아 무의미)
  ② 문서를 `PGPASSWORD=$SUPABASE_PW` 형태로 교체 ③ Supabase IP allowlist 검토
  ④ 회전일을 기록하고 §12.10 회전 플레이북에 편입.
- 대조적으로 `artifacts/api-server/.env.example`과 `tenants/*/config.env`는 플레이스홀더·비시크릿만
  담고 있어 깨끗했고, `.gitignore`는 `.env.local`·`tenants/*/secrets.env`·`docs/LOGIN_CREDENTIALS.md`를
  모두 덮고 있습니다(실제 미추적 확인). 이 1건만 예외입니다.

### [C-2] 주민등록번호 평문 저장 + 리스트 응답 무마스킹
- **섹션** §12.2 한국 PIPA · **파급** all-instances (Metheim 실사용)
- **증거** `lib/db/src/schema/contacts.ts:34` `resident_no: text(...)`, `:35` `passport_number`,
  `lib/db/src/schema/accounts.ts:52` — 모두 평문 `text`. api-server 전역에 암호화 호출 **0건**.
  `artifacts/api-server/src/routes/contacts.ts:71` `db.select().from(contactsTable)` 전 컬럼을
  `res.json(rows)`로 그대로 반환 — 목록 조회 한 번에 전 고객 주민등록번호·여권번호가 나갑니다.
- **영향** 개인정보보호법 §24-3(고유식별정보 암호화 의무) 위반 소지. 관리자 토큰이면
  Viewer 역할까지 포함해 일괄 열람 가능. 유출 시 즉시 신고 대상.
- **권고** ① 저장 시 암호화 또는 뒷자리 분리보관 ② 리스트는 컬럼 화이트리스트 + 마스킹
  ③ 상세는 권한 확인 + 열람 감사로그 후 reveal(§6.12).
- 완화 요소: 로거 redact 목록에는 등재돼 있어(`lib/logger.ts:33`) 로그로는 새지 않습니다.

### [C-3] DB 쓰기 스크립트에 인스턴스 가드가 사실상 없음
- **섹션** §1.1 · **파급** all-instances
- **증거** 가드 보유 스크립트는 `scripts/provision-instance.sh:43` 단 1개. 그마저
  `PROD_REF="rdwzpbxrkjlmtwcoiniq"` **MillionStay ref 하나만** 차단해 **Metheim 프로덕션
  (`dhdjxweuushugqltjael`)은 통과** — `db push` + 시드가 그대로 실행됩니다.
  가드 없는 직접 쓰기 경로: `scripts/backfill-party-codes.mjs:44`(쓰기가 기본),
  `lib/db/drizzle.config.ts:4`(`db:push`/`db:migrate`가 URL 존재만 확인),
  `artifacts/api-server/scripts/` 시드·백필 8종(dry-run 언급 0).
- **영향** 잘못된 `DATABASE_URL` 하나로 상대 인스턴스 프로덕션 오염. §11.2(로컬이 프로드 DB
  직결)와 결합하면 평범한 실수가 곧 사고입니다.
- **권고** 공통 `dbGuard` 모듈(호스트 ref → 예상 인스턴스 `--instance=` 명시 불일치 시 거부,
  쓰기 스크립트 dry-run 기본)을 만들어 전 스크립트에 적용. `PROD_REF`를 알려진 프로드 ref 배열로 확장.

### [C-4] 청구서 번호 SSOT가 배포본에 없음 — 수정 커밋이 머지되지 않음
- **섹션** §5.2 · **파급** all-instances
- **증거** `origin/main`에 `insertInvoiceWithRef` **0건**. 대신 로컬 `nextInvoiceRef()`가 6곳에 복제:
  개수 기반(`rows.length + 1`, 과거 사고 패턴) — `routes/invoices.ts:34`, `routes/work-orders.ts:44`,
  `routes/recurring-schedules.ts:44`, `lib/homestay/placementInvoice.ts:32`,
  `routes/guest-portal.ts:848`; max+1 근사 — `lib/billing/recurringInvoices.ts:77`, `routes/contracts.ts:189`.
  통합 커밋 `68605996`("청구서 번호 발급기를 하나로 — 개수 기반 중복 키 사고 차단", 2026-08-22)는
  `fix/invoice-ref-collision` 브랜치에만 존재하며 **main의 조상이 아님**을 확인.
- **영향** `invoice_ref`가 unique라 이중 발행은 막히지만, 어느 경로에도 트랜잭션·23505 재시도가 없어
  동시 발행 시 두 번째가 500으로 실패합니다. 인보이스가 1건이라도 하드 삭제되면 count < max가 되어
  **해당 경로의 발행이 갭이 메워질 때까지 반복 실패**합니다.
- **권고** `fix/invoice-ref-collision`을 main에 머지하고 6곳 전부 교체. 이번 감사에서 가장 값싼 조치입니다.

### [C-5] 계약(contracts)에 이중 배정 방지가 전무
- **섹션** §5.1 · **파급** all-instances (Metheim 주력 경로)
- **증거** `lib/db/src/schema/contracts.ts:7`에 `contract_ref` unique뿐 — space+기간 UNIQUE/EXCLUDE 없음
  (전 마이그레이션에 `EXCLUDE`/btree_gist 0건). `routes/contracts.ts:581` `POST /v1/contracts`가
  `space_id`·기간 겹침을 **검사하지 않고** insert하며, `space_blocked_dates`도 클레임하지 않습니다
  (해당 테이블을 쓰는 파일에 contracts 경로 없음).
- **영향** 같은 세대에 기간이 겹치는 Active 계약 2건이 생성 가능하고, 각각이 월세 크론에서 따로
  청구서를 발행합니다. 여수 98계약이 booking 없이 contracts 직결이라 주력 경로가 무방비입니다.
- **대조** 예약(bookings)은 잘 만들어져 있습니다 — `space_blocked_dates (space_id, date)` UNIQUE
  (`drizzle/0001_space_blocked_dates_unique.sql:14`) + 트랜잭션 안 `onConflictDoNothing` 클레임,
  부분 실패 시 롤백(`routes/bookings.ts:290`). **DB가 최종 심판이라 레이스가 없습니다.**
- **권고** 계약 생성·수정에 Active 겹침 검사(트랜잭션 + `FOR UPDATE`), 이상적으로는
  `EXCLUDE USING gist (space_id WITH =, daterange(start_date,end_date) WITH &&) WHERE status='Active'`.

---

## P1 — High

### [H-1] 월세 청구가 의도한 날짜에 발행되지 않음 (UTC 월 경계)
`lib/billing/leaseRentInvoices.ts:59-61`이 `getUTCFullYear()/getUTCMonth()`, `:136`이 UTC 오늘로
연체를 판정합니다. 크론은 03:00 시드니 = **전날 17:00 UTC**라서, 매월 1일 실행분은 UTC로는 아직
지난달입니다. → **Metheim 신월 월세 청구서가 2일에 생성**되고 Overdue 전환도 하루 밀립니다.
납입일이 1일인 세입자는 청구서를 기한 다음 날 받습니다.
같은 문제를 `lib/billing/consolidatedInvoices.ts:41`은 `BILLING_TIMEZONE`으로 이미 올바르게 풀었으니
**그 헬퍼를 재사용**하면 됩니다. `recurringInvoices.ts:45`·`homestay/monthlyBilling.ts:20`은
시드니 하드코딩, `gl.ts:49`도 동일 계열 — 청구 잡 전체를 `BILLING_TIMEZONE` 하나로 통일 권고.

### [H-2] 월세 크론 3종의 중복 방지 키가 서로 다른 공간
`leaseRentInvoices.ts:103`의 가드는 "그 계약의 **아무** 인보이스가 그 달 납기면 skip"입니다(ref 제한 없음).
계약 생성 시 만들어지는 보증금·선납 인보이스나 반복 청소비가 그 달에 잡히면 **그 달 월세가 조용히
누락**되고, 로그에는 skipped로만 남습니다. 반대로 `recurringInvoices.ts:150`은 due_date + description
문자열 일치라, 납기일이 다르면 같은 달 월세가 2장 나올 수 있습니다.
권고: `billing_period`(YYYY-MM) 컬럼 + `(contract_id, billing_period)` partial unique index를 세 잡이 공유.

### [H-3] 홈스테이 호스트 신원서류만 보존기한 미설정 → 영구 보존
문서 insert 11곳 중 10곳은 `calcRetentionDate()`를 설정하는데 `routes/homestay.ts:367`만 누락입니다.
파기 잡(`lib/retentionPurge.ts:47`)은 `retention_until` 경과분만 지우므로, **가장 민감한 신원 스캔(WWCC·ID)이
영구 보존**됩니다 — APP 11.5 위반. 파기 잡 자체는 Cloudinary 자산 + DB 행을 모두 물리 삭제해 올바릅니다.
권고: 해당 insert에 보존기한 추가 + 기존 NULL 백필.

### [H-4] 에러 트래킹·알림 전무, 크론 실패가 무음
Sentry 등 트래킹 통합 grep 0건, `app.ts`에 중앙 에러 핸들러(4-인자 미들웨어) 없음.
크론 11개 전부 실패 경로가 `.catch(logger.error)` 뿐 — 재시도·알림·데드레터 없음.
**월세가 매일 발행 실패해도 아무도 모릅니다.** 침묵 `catch {}` 27곳.
권고: 트래킹 도입 + 크론 결과를 실패 시 알림 채널로 + JSON 에러 미들웨어.

### [H-5] 헬스체크가 DB를 확인하지 않음
`routes/health.ts:6` — `/healthz`는 무조건 200, `/v1/health`는 env 존재만 확인. DB ping 없음.
커넥션 고갈·Supavisor 장애에도 green이라 죽은 인스턴스가 살아 있다고 보고됩니다.
덤으로 `:22`가 Stripe live/test 여부와 NODE_ENV를 무인증 노출합니다. 빌드 SHA도 없어
§2.1 "배포본 == 소스" 검증이 두 인스턴스 모두 불가능합니다.

### [H-6] RBAC가 fail-open, Viewer 쓰기 차단이 stale 토큰 의존
`lib/rbac.ts:120` `isAllowed()`가 알 수 없는 역할·미매핑 경로·미설정 리소스에 **허용**을 반환하고,
`loadRoles()`는 DB 오류를 삼켜 빈 맵(= 전면 허용)을 냅니다. `requireAuth.ts:169`도 RBAC 조회 실패를
"절대 차단하지 않음"으로 감쌉니다. `/v1/marketing`·`/v1/ai-ops`·`/v1/external-api`·`/v1/payment-info`는
`PREFIX_MAP`에 없어 커스텀 역할이 무제한 접근합니다.
Viewer 하드 게이트(`requireAuth.ts:150`)는 토큰의 role을 보므로, 강등된 사용자가 **최대 1시간** 쓰기를 유지합니다.
권고: 변경 메서드에 한해 fail-closed, 누락 프리픽스 등재, 강등 시 토큰 무효화.

### [H-7] GL 전기가 원자적이지 않음 + Stripe 수납에 부가세 누락
`lib/billing/gl.ts:113` — 전표 헤더 insert 후 **별도 호출**로 라인 insert. 사이에 죽으면 라인 없는
전표가 남고, `posting_key` 멱등 때문에 **재전기가 영구 차단**됩니다.
또 `routes/stripe.ts:74,161`의 `postInvoicePaid` 호출이 `tax`를 넘기지 않아, 부가세 있는 인보이스를
Stripe로 수납하면 발행 전표(VAT 포함)와 수납 전표(VAT 누락)가 어긋나 AR·부가세예수금 잔액이 드리프트합니다.

### [H-8] 오너 포털이 타입 마스터·삭제 세대를 세대 수로 집계
`routes/owner-portal.ts:95,161,207`이 `countableUnitFilter`도 `deleted_at` 필터도 없이 spaces를 조회하고,
그 값이 `total_spaces`와 점유율 분모(`:599`)로 들어갑니다. 여수 기준 타입 8행 + 삭제분이 섞여
**세대 수는 부풀고 점유율은 낮게** 나옵니다. `lib/chat/tools.ts:157`도 raw `spaces.length` 폴백.

### [H-9] 게스트 웹 번역 대량 누락 (i18n 정책 위반)
`million-stay-web` 기준 en 3,065키 대비 누락: **ja 496 · ko 456 · th 496 · zh 497** (vi만 72로 최신).
전부 homestay 신규 페이지 9종과 `search.*` 네임스페이스 — en만 넣고 배포된 패턴입니다.
`StudentApply.tsx` 103/103, `StudentBecome.tsx` 67/67이 통째로 누락. 폴백이 영어라 크래시는 없지만
한국어 사용자에게 영어 화면이 그대로 나갑니다. 포털 3종과 property-admin(ko 100%)은 양호.
권고: `scripts/translate-i18n.mjs`를 `homestay.*`·`search.*`에 일괄 실행.

### [H-10] 내부 4개 앱이 검색엔진에 색인 가능
5개 앱 `index.html` 어디에도 `noindex` 메타가 없고, `robots.txt` 0개, `vercel.json` 5개 모두 headers 블록 없음.
property-admin·agent·owner·service-host 로그인 화면이 색인 대상입니다.
반대로 게스트 웹은 sitemap·hreflang(6로케일)·robots가 **모두 없어** SEO 자산을 못 쓰고 있습니다.

### [H-11] 공개 무인증 write·업로드에 전용 레이트 리밋 미부착
`generalLimiter`(300/min)만 걸린 경로: `/v1/public/contact-inquiries`, sales/listing/long-term/
management/student-inquiries(`routes/public.ts:1536-1650`), `sites/:slug/inquiry`,
`sale-listings/:id/inquiry`, 그리고 **무로그인 파일 업로드** `tenant-links` doc-requests/intake photo,
`unit-inspections/:token/photos`. 문의 스팸·업로드 남용 표면입니다.
`POST /v1/auth/register`(무인증)도 loginLimiter 밖이라, 요청마다 전 SuperAdmin에게 메일이 나가 메일 폭탄이 가능합니다.

### [H-12] 크론에 인스턴스 게이트가 없음
`index.ts:157-305`가 모든 크론을 무조건 등록합니다. 실질 격리는 DB 분리와 플래그 기본 off뿐인데,
**홈스테이 렌트 크론은 플래그가 아예 없어** Metheim에 Active placement가 하나라도 생기면 즉시
시드니 달력으로 과금을 시작합니다. `HOMESTAY_MODULE_ENABLED`는 **어드민 메뉴만 숨길 뿐 크론을 막지 않습니다**
(`routes/integrations.ts:138`). 반대로 MillionStay 어드민에서 `LEASE_RENT_INVOICES_ENABLED`를 켜면
호주 인스턴스가 한국식 월세를 UTC 달력으로 발행합니다 — 오설정이 1클릭 거리입니다.

---

## P2 — Medium (요약)

| ID | 내용 | 증거 |
|---|---|---|
| M-1 | CS·점검·하자 사진이 공개 CDN(`type:"upload"`)에 서명·만료 없이 저장 | `routes/guest-cs.ts:60`, `partner-cs.ts:53`, `unit-inspections.ts:543`, `condition-reports.ts:192` |
| M-2 | 통합청구 부모/자식 구분 없이 독촉·납기예고 발송 → 이중 고지 | `lib/billing/rentDunning.ts:88` (`parent_invoice_id` 참조 0건) |
| M-3 | 리스트 N+1 6곳 (행마다 SELECT) | `documents.ts:51,61`, `recurring-schedules.ts:29`, `service-hosts.ts:86`, `partner-cs.ts:72`, `guest-cs.ts:79` |
| M-4 | OpenAPI 스펙 사문화 — 스펙 79경로 vs 실제 634 등록 | `lib/api-spec/openapi.yaml`, 드리프트 땜질 `api-augmentations.d.ts` 3종 |
| M-5 | 통화 하드코딩 `$` 직접 렌더 5건 → KRW 인스턴스에 `$500000.00` | `BookingDetail.tsx:1057`, `ContractDetail.tsx:1587,1589,1838` |
| M-6 | 날짜 헬퍼 우회 17건, 상당수 로케일 `"en"` 고정 | `FinanceTab.tsx:75`, `OverviewTab.tsx:66,224`, `ReservationsTab.tsx:115` 등 |
| M-7 | 문서 미리보기 규칙 우회 — agent·host 포털이 `window.open(signedUrl)` 직행 | 양 `DocumentsPage.tsx:83` (두 앱에 DocumentPreviewDialog 부재) |
| M-8 | 이미지 Cloudinary 변환(`f_auto/q_auto`) 사용 0건, recharts가 5개 앱 전부에 | `fallback-spaces.ts:64` 등 |
| M-9 | 전자서명 단일사용이 비원자적(check-then-update) → 동시 제출 시 스냅숏 덮어씀 | `routes/contract-signing.ts:192` vs `:273` |
| M-10 | 예약 인보이스 FX가 `"1"` 하드코딩 (코드 자체 TODO) | `routes/guest-portal.ts:861` |
| M-11 | `movable:"no"` AI 태스크(신분증 OCR)의 벤더 고정이 주석뿐, 코드 강제 없음 | `lib/ai/tasks.ts:149`, client.ts에 참조 0건 |

## P3 — Low (요약)

테스트 0개·린터 설정 0개(현행 정책과 일치, 사실 확인) · 브랜드 hex 리터럴 32곳(대시보드 차트·PWA) ·
"MetHeim" 오표기 4건(주석·시드 한정, 사용자 노출 0) · 오너 계약 상세가 임차인 자유기술 PII 전 컬럼 반환
(`owner-portal.ts:263`, 교차 노출은 아님) · 개인 Gmail이 지원 주소로 13곳 하드코딩 ·
`docs/LOCAL_DEV.md:51`이 존재하지 않는 `scripts/verify-prod.sh`를 참조.

---

## 건전하다고 확인된 것 (동등하게 중요)

- **행 단위 격리 — 교차 노출 0건.** 파트너·게스트 엔드포인트 30여 개를 전수 확인한 결과, `:id`를 받는
  모든 조회·변경이 호출자 소유권으로 제약돼 있었습니다(IDOR 없음). 라우트 마운트 순서도 안전하고,
  JWT 3종이 **각기 다른 시크릿**을 쓰며 교차 검증이 프로덕션에서 거부됩니다.
  오너의 임차인 마스킹(`formatTenantForOwner`), 게스트 DSAR의 **공동 소유자 가드**도 제대로 동작합니다.
- **SQLi 없음.** `sql``` 보간 60여 건 전수 검토 결과 사용자 입력은 전부 파라미터 바인딩이고,
  `sql.raw()` 4곳은 모두 서버 상수·루프 카운터입니다.
- **개발용 라우트가 프로덕션에 도달 불가.** `dev-migration.ts`는 라우터 자체 404 + `app.ts:283`에서
  프로덕션이면 마운트조차 안 되는 2중 가드, `db-sync.ts`는 SuperAdmin 전용 + 확인 문구 요구.
- **예약 오버부킹 방어가 견고** (C-5의 대조군, 위 참조).
- **민감 문서 접근 통제.** 신분증·명함·계약 스캔은 private 업로드(`type:"authenticated"`)에,
  관리자용은 서버 스트리밍 + `no-store`, 포털용은 300~900초 만료 서명 URL.
- **초기 관리자 계정에 하드코딩 폴백 비밀번호 없음**(`SEED_ADMIN_PASSWORD` 미설정 시 생성 스킵).
- **금액 문자열 연산 버그 0건** — numeric→string 규약이 실제로 지켜지고 있었습니다.
- **문서명 레지스트리가 타입으로 강제됨** — `DOC_NAMES_KO: Record<DocKind, string>`이라 한쪽 누락이
  컴파일 에러가 됩니다(typecheck 그린 = 13종 양쪽 등재 보장).
- **데드코드 0건**, 폐기된 `space_rent_options` 참조 0건, TODO 실질 1건.
- **CI 게이팅 정상** — 배포 잡 2개 모두 `needs: verify` + main 푸시 조건. 게이트 밖 배포 경로 없음.
- **마케팅 동의 강제** — 발송 직전 `checkSendable()`, opt-out·suppression 절대 우선.

### 점검표 자체의 오류 1건 (수정함)
점검표 §9.3이 "Metheim의 Montserrat이 index.html에 로드되지 않는다"고 적었는데, **5개 앱 전부에
로드돼 있습니다**(web `index.html:25`, 나머지 `:10`). Noto Sans Thai/JP/SC도 전부 로드되고,
css2 API가 unicode-range로 자동 서브셋을 서빙해 태국어·베트남어 글리프도 커버됩니다.
tenants config의 주석을 근거로 삼은 오판이었고, 점검표를 정정했습니다.

---

## 미측정 (DB·네트워크 접속 필요)

정적 분석만 수행했으므로 아래는 **아직 확인하지 못했습니다.** 승인 시 읽기 전용으로 조회합니다.

```sql
-- C-5 실제 겹침 계약 존재 여부
SELECT a.id, b.id, a.space_id FROM contracts a JOIN contracts b
  ON a.space_id=b.space_id AND a.id<b.id AND a.status='Active' AND b.status='Active'
 AND a.deleted_at IS NULL AND b.deleted_at IS NULL
 AND daterange(a.start_date,a.end_date,'[]') && daterange(b.start_date,b.end_date,'[]');

-- H-7 라인 없는 고아 전표
SELECT e.id, e.posting_key FROM journal_entries e
  LEFT JOIN journal_lines l ON l.entry_id=e.id WHERE l.id IS NULL;

-- H-3 보존기한 없는 문서 (영구 보존 대상)
SELECT doc_type, count(*) FROM documents WHERE retention_until IS NULL GROUP BY 1 ORDER BY 2 DESC;

-- C-4 인보이스 번호 결번·중복 흔적
SELECT invoice_ref, count(*) FROM invoices GROUP BY 1 HAVING count(*)>1;
```

그 밖에 **두 DB 스키마 diff**(§1.5·§4.1), **Railway/Vercel 실환경 변수 대조**(§1.4),
**`ORIGIN_SHARED_SECRET`·`TRUST_CLOUDFLARE` 현재 설정 상태**(§6.10),
**라이브 번들의 브랜드 베이크 여부**(§1.2)는 접속이 필요해 미측정입니다.

---

## 권장 조치 순서

1. **오늘** — C-1 비밀번호 회전(다른 무엇보다 먼저), C-4 `fix/invoice-ref-collision` 머지.
2. **이번 주** — C-2 주민등록번호 마스킹·암호화, C-3 DB 가드 모듈, H-3 보존기한, H-1 `BILLING_TIMEZONE` 통일.
3. **이번 달** — C-5 계약 겹침 제약, H-2 청구 기간 키 통일, H-4 알림, H-6 RBAC fail-closed, H-9 번역, H-10 noindex.
4. **분기** — P2 전반 + 미측정 항목 DB 실측.

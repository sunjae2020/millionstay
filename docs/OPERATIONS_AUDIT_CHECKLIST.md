---
status: live
domain: 인프라
last_verified: 2026-08-31
---

# MillionStay · Metheim — 시스템 정기 점검표

> 범용 템플릿이 **아닙니다**. 모든 항목은 이 모노레포의 실제 구조에 매핑돼 있습니다 —
> **하나의 코드베이스가 두 개의 화이트라벨 인스턴스(MillionStay / Metheim)로 배포**되고,
> 각 인스턴스는 **자기 Supabase DB + 자기 Railway API + 5개 프런트엔드**를 갖습니다.
> 실제 금전(월세·보증금·수수료 원장)과 신분 서류(신분증·여권·통장 사본)를 다룹니다.
>
> 실행 순서: **인벤토리 → 인스턴스 격리 → 구조 → 코드 → DB → 도메인 무결성 → 보안 →
> 성능 → 신뢰성 → 프런트/i18n/브랜드 → API → 인프라 → 컴플라이언스**

---

## 제품 프로파일 (감사 전 반드시 확정)

| 항목 | MillionStay | Metheim |
|---|---|---|
| 제품 성격 | 숙박 예약 + 유학생 홈스테이 매칭 + 장·단기 임대 | 한국 부동산 임대관리 (여수 269세대) |
| 프런트엔드 | `million-stay-web`(5173) · `property-admin`(5174) · `agent-portal`(5175) · `owner-portal`(5176) · `service-host-portal`(5177) | 동일 5개 앱 (`metheim-*` Vercel 프로젝트) |
| API | Railway `api-server` — `/api/v1/` | Railway `metheim-api` — 동일 코드 |
| DB | Supabase `rdwzpbxrkjlmtwcoiniq` | Supabase `dhdjxweuushugqltjael` (Seoul) |
| 브랜드 | Orange `#E8621A` / Navy `#16263F` | Urban Teal `#005F73` / Logo Gold `#C6942E` |
| 통화 · 시간대 | AUD · `Australia/Melbourne` | KRW · `Asia/Seoul` |
| 로케일 | 5개 앱 전부 **en · ja · ko · th · vi · zh (6개)** | 동일 |
| 격리 축 | **DB 분리**(인스턴스 간) + **행 단위 소유권**(인스턴스 내: 계정·파트너·소유주) | 동일 |
| 사용자 역할 | SuperAdmin · Admin · Viewer(RBAC) · Guest · Partner(Agent/Owner/ServiceHost) | 동일 |
| 재고 단위 | Property → Space(+`parent_space_id` 타입 마스터) → Booking/Contract | 동일 (여수 8타입 × 269세대) |
| 스택 | pnpm workspace · Node 24 · TS 5.9 · Express 5 · Drizzle · Zod · Orval · vite/esbuild | 동일 |
| 스테이징 환경 | **없음 — 로컬 개발이 프로드 DB를 직접 바라봄** (`docs/LOCAL_DEV.md`) → §11.2 **Critical** | 동일 |

> 프로파일 표의 값이 바뀌면(새 인스턴스 추가, 로케일 추가, 앱 추가) 이 점검표를
> 먼저 갱신하고 감사를 시작합니다. 인스턴스가 3개가 되는 순간 §1 전체가 재작성 대상입니다.

---

## 범례

**상태**
- ✅ **완비** — 도구/게이트가 이미 있음. 실행하고 기록만 하면 됨.
- ⚠️ **부분 / 재해석 필요** — 일부만 있거나 확인된 리스크가 남아 있음.
- ❌ **도구 부재** — 없는 도구가 필요함. 도입 자체가 백로그 과제.
- ⬜ **미확인** — 첫 감사 전 기본값. 확인 후 위 셋 중 하나로 갱신.

**주기** — 🟥 배포마다 / 🟧 주간 / 🟨 월간 / 🟦 분기 / 🟪 반기

**심각도**

| 등급 | 의미 |
|---|---|
| **Critical** | 인스턴스 간 데이터 교차(다른 테넌트 DB 오염), 전 고객 데이터 유실·유출, 신분 서류 노출, 청구·보증금·원장(GL) 손상, 시크릿 노출, 이중 예약, 브랜드 클로버(테넌트 프런트가 무브랜드/무API 번들로 덮임) |
| **High** | 단일 인스턴스·단일 앱 장애, 인증·권한 우회, 파트너 간 데이터 교차 노출, 금액 오기입, 서명 문서 무결성 훼손, 크론 미실행 |
| **Medium** | 특정 로케일 깨짐, 성능 저하, 브랜드 토큰 드리프트, 가드레일 부재 |
| **Low** | 표기 오류, 문서 드리프트, 데드 코드 |

**파급 반경 축**

`all-instances`(공유 코드·스키마·디자인 토큰 → 두 인스턴스 전부) → `instance`(millionstay / metheim) →
`app`(web / admin / agent / owner / host) → `locale`(6개 중 1개) → `single-page`

**공유 코드 경로(`lib/*`, `artifacts/api-server/src/lib/*`)를 건드리는 결함은 항상 한 단계 위로 올려** 판정합니다.
이 모노레포에서는 "MillionStay만의 버그"라는 것이 거의 없습니다 — 같은 코드가 Metheim에도 떠 있습니다.

> ⚠️ **이 시스템의 황금률 (2가지)**
>
> 1. **로컬 개발이 프로덕션 DB를 직접 바라봅니다.** 별도 개발 DB가 없습니다. 감사 중 쿼리는
>    **읽기 전용이 기본**이며, 계약 상태·청구 상태·서명 문서·GL 전표는 절대 변경하지 않습니다.
>    쓰기는 명시적 승인 + 사전 덤프 이후에만.
> 2. **두 인스턴스는 DB가 다릅니다.** 백필·마이그레이션·점검 스크립트를 돌릴 때
>    `DATABASE_URL`이 어느 인스턴스를 가리키는지 매번 확인하고, 결과를 **양쪽에 각각** 적용합니다
>    (`docs/DB_MIGRATION_CONVENTION.md`). 한쪽만 적용된 스키마는 그 자체로 §3.1 Critical입니다.

---

## 0. 자산 인벤토리 (분기마다 가장 먼저) 🟦

| # | 항목 | 방법 | 상태 |
|---|---|---|---|
| 0.1 | 인스턴스 · 앱 목록 | 인스턴스 2개 × 앱 5개 + API 2개 + DB 2개 = **14개 배포 단위**. 각 단위의 호스팅 프로젝트명·URL·마지막 배포 시각을 1:1 표로 유지. `tenants/*/config.env`가 출발점. | ⬜ |
| 0.2 | 도메인 / SSL | `millionstay.com` · `homestay.millionstay.com` · 오너 랜딩(`{slug}.millionstay.com`, 발행 시 Vercel 도메인 자동 등록) · Metheim 도메인. 인증서 만료일 + 자동 갱신 + DNS 소유 계정. | ⬜ |
| 0.3 | 발신 이메일 도메인 | Resend 발신 주소가 인스턴스별로 분리됐는지. **`EMAIL_FROM`은 import 시점 상수라 env가 DB(company_info)를 이깁니다** — 양쪽을 함께 갱신하고 재배포했는지 확인. SPF/DKIM/DMARC. | ⚠️ |
| 0.4 | 외부 연동 · 키 보관 위치 | Supabase · Railway · Vercel · Cloudflare · Cloudinary(미디어/서류) · Resend(메일) · Stripe(`routes/stripe.ts`) · OTA iCal 채널 · AI 3사(Anthropic/Kimi/Gemini) · 외부 API 키(`api_credentials`). 각 키가 `.env.local` / Railway 변수 / DB(`integration_settings`) 중 어디에 있는지 표기. | ⬜ |
| 0.5 | DB 테이블 목록 | 현재 **97개 스키마 파일**(`lib/db/src/schema/`). 각 테이블의 소유 도메인(예약·계약·청구·문서·홈스테이·CMS·파트너) 표기 + 인스턴스별 사용 여부. | ⬜ |
| 0.6 | 크론 잡 (8개) | `artifacts/api-server/src/index.ts` — 환율 동기화 `0 0`, OTA iCal 임포트 `0 *`, 보존기간 파기 `15 3`, 홈스테이 렌트 `0 2`, 반복 청구 `30 2`, 월세 청구 `0 3`, 통합 청구 `10 3`, 작업지시 SLA `*/10`. **전부 `Australia/Sydney` 타임존으로 고정 → Metheim(한국)에서는 새벽 잡이 한국 시간 낮에 도는지 확인 필요.** 각 잡의 실패 알림 경로. | ⚠️ |
| 0.7 | 기능 토글 | `RECURRING_INVOICES_ENABLED` · `LEASE_RENT_INVOICES_ENABLED` · `HOMESTAY_MODULE_ENABLED` · `MARKETING_DRY_RUN` · `TRUST_CLOUDFLARE` · `ORIGIN_SHARED_SECRET` · `DOC_NAME_INCLUDE_ORG` 등. **인스턴스별 현재 값**을 표로 확정. env와 `integration_settings` 두 곳을 모두 볼 것. | ⬜ |
| 0.8 | 의존성 그래프 | `pnpm list -r --depth 0` + 런타임 버전(Node 24, React, vite). | ⬜ |
| 0.9 | 마이그레이션 상태 | `lib/db/drizzle/` **88개 파일** — 그중 `manual_*.sql` 레거시 5개는 번호 체계 밖. 두 인스턴스 각각의 적용 이력과 대조. | ⚠️ |

---

## 1. 인스턴스 격리 (화이트라벨) 🟨 ⭐

> 첨부 원본에 없던, **이 시스템 고유의 최상위 섹션**입니다. 한 코드베이스가 두 회사를 굴리므로
> 여기서 나오는 결함은 정의상 Critical입니다.

| # | 항목 | 방법 | 심각도 | 상태 |
|---|---|---|---|---|
| 1.1 | **DB 교차 오염 방지** | 백필·시드·마이그레이션 스크립트가 `DATABASE_URL` 가드를 갖고 있는지. `scripts/provision-instance.sh`는 프로드 ref(`rdwzpbxrkjlmtwcoiniq`) 하드코딩 거부 가드가 있음 — **다른 스크립트에도 같은 가드가 있는지** 전수 확인. | **Critical** | ⚠️ |
| 1.2 | **Metheim 프런트 클로버** | `metheim-*` Vercel 프로젝트는 git 연결이 없고 **로컬 prebuilt 업로드**입니다. 테넌트 config 없이 배포하면 무브랜드·무API 번들로 덮입니다. 복구는 `TENANT=metheim scripts/redeploy-tenant-frontends.sh`. 현재 배포분이 브랜드 빌드인지(로고·팔레트·API base) 육안 + 번들 grep으로 확인. | **Critical** | ⚠️ |
| 1.3 | 브랜드 생성 파이프라인 | `tenants/<t>/config.env`의 `BRAND_*` → `generate-brand.mjs` → `@workspace/design-tokens` `brand.css`. 앱 코드에 하드코딩 색이 새로 들어오지 않았는지 `scripts/check-brand-overrides.sh`로 검증. | Medium | ✅ |
| 1.4 | 인스턴스별 env 대조 | 두 Railway 서비스의 변수 목록을 diff. 한쪽에만 있는 키 = 기능 불일치 후보(특히 토글·AI 키·메일 발신). | High | ⬜ |
| 1.5 | 스키마 동기 | 두 DB의 테이블·컬럼 목록 diff. 코드 스키마가 SSOT이므로 **양쪽 모두** 최신인지. 한쪽만 적용된 ALTER가 남아 있는지(`docs/` 미배포 ALTER 대기 항목 포함). | **Critical** | ⬜ |
| 1.6 | 동시 배포 충돌 | `main` 푸시 = api-server(Railway) + metheim-api + 웹·admin(Vercel) + Metheim 프런트(CI) **동시 배포**. 브랜치에서 `railway up`으로 올린 배포분은 다음 `main` 푸시에 소멸. 배포 창 정책과 회귀 점검 절차가 문서화됐는지. | High | ⚠️ |
| 1.7 | 신규 인스턴스 절차 | `scripts/provision-instance.sh` + `tenants/_template`이 현재 스키마로 실제 부팅되는지 반기 1회 리허설(폐기용 Supabase 프로젝트 대상). | Medium | ⬜ |

## 2. 아키텍처 & 구조 🟦

| # | 항목 | 방법 | 심각도 | 상태 |
|---|---|---|---|---|
| 2.1 | 배포본 == 소스 | 각 앱이 노출하는 빌드 SHA가 HEAD와 일치하는지(`/api/v1/health`에 커밋 SHA 노출 권장). **로컬 주 체크아웃이 `origin/main`보다 수백 커밋 뒤처져 있을 수 있음** — 기능 유무 판단·배포는 `origin/main` 워크트리에서. | High | ⚠️ |
| 2.2 | 공유 코드 경계 | `lib/*`(db·api-zod·api-client-react·design-tokens·cms-blocks)에 앱 전용 로직이 새어 들어갔는지, 반대로 5개 앱에 같은 컴포넌트가 복제됐는지. **DocumentPreviewDialog는 의도적 앱별 사본**(현재 3개) — 그 외 복제는 지적 대상. | High | ⬜ |
| 2.3 | 레이어 분리 | `routes/`(92개 파일)에 비즈니스 로직이 인라인되지 않고 `lib/`로 내려갔는지 스팟 체크. 신규 라우트 우선. | Medium | ⬜ |
| 2.4 | 순환 의존성 | `madge --circular` 도입 대상. 미도입 시 *미측정* 으로 기록. | Medium | ❌ |
| 2.5 | 네이밍 / 규칙 준수 | 문서 파일명(`resolveDocFileName()`), 인보이스 번호(`insertInvoiceWithRef()`), 고객ID(`resolvePartyCode()`), 인명 표기(`nameFormat.ts`), 주소(`@workspace/address`) — **전부 SSOT 함수 경유**인지 grep(§3.6). | High | ⬜ |
| 2.6 | 스택 수명 / EOL | Node 24 LTS 상태, React·vite EOL. `pnpm outdated -r`. | Medium | ⬜ |
| 2.7 | SPOF | 인스턴스당 API 1대 · DB 1개 · Cloudinary 1계정. 제거 못 하면 "수용된 리스크 + 완화책(정기 덤프 주기)"로 문서화. | Critical | ⬜ |

## 3. 코드 건전성 🟧

| # | 항목 | 방법 | 심각도 | 상태 |
|---|---|---|---|---|
| 3.1 | 타입 / 계약 드리프트 | `pnpm typecheck` = 0 에러. **자동화 테스트가 없으므로 이것이 유일한 정적 게이트**이고 CI `verify` 잡이 이를 강제합니다(2026-06 번다운으로 그린 달성 — 유지가 곧 과제). | High | ✅ |
| 3.2 | 배포 타깃 빌드 | CI `verify`가 `mockup-sandbox`를 제외한 전 앱을 빌드. Railway/Vercel은 vite·esbuild라 `tsc`를 돌리지 않으므로 **빌드 성공 ≠ 타입 안전**임을 기억. | High | ✅ |
| 3.3 | 린트 / 포맷 게이트 | ESLint·Prettier 설정 존재 여부와 CI 편입. 없으면 도입 자체가 과제. | Medium | ⬜ |
| 3.4 | 목록 페이지네이션 · N+1 | 공용 `DataTable`(44개 리스트) 기준 이중 페이지네이션·클라이언트 슬라이스 상한 확인. **리스트 무한로딩의 실제 원인은 enrich N+1** — `inArray` 배치화가 됐는지, Railway 로그로 진단. | High | ⚠️ |
| 3.5 | 테스트 — 커버리지% 아닌 **불변식** | 자동화 테스트 부재. 최소 이 6개는 스크립트로라도 덮여야 함: ① 같은 공간·기간 이중 배정 방지 ② 파트너가 타 계정 데이터 조회 불가 ③ 인보이스 금액 재계산 일치(공급가액+부가세) ④ 보증금 정산 잔액 ⑤ 문서 파일명·인보이스 번호 유일성 ⑥ 세대 집계에서 타입 마스터 행 제외. | High | ❌ |
| 3.6 | 하드코딩 금지 grep | 브랜드 색 리터럴(`#E8621A`·`#EE6B19`·`#005F73` 등 → 토큰 경유, `check-brand-overrides.sh`), 통화 기호 `$` 단독(→ `A$`/`₩` 명시), 하드코딩 이메일·전화·계좌, `${firstName} ${lastName}` 인라인 결합(→ `nameFormat.ts`), 라우트 안 `` `${ref}.pdf` `` 조립(→ `setDocFileName()`), `new Anthropic()` 직접 호출(→ `getAiClient()`). | Medium | ⚠️ |
| 3.7 | 데드 코드 / 유령 파일 | `_bak`·`_old` grep + `git log`. 폐기된 `space_rent_options` 등 이관 잔재 확인. | Low | ⬜ |
| 3.8 | TODO/FIXME 부채 | `grep -rn "TODO\|FIXME" artifacts lib` — 개수 추세 관리. | Low | ⬜ |

## 4. 데이터베이스 & 스키마 🟨

> 인스턴스 간 격리는 **DB 분리**로 해결됩니다. 인스턴스 **안**의 격리 축은
> 행 단위 소유권(계정·파트너·소유주)이므로, 모든 파트너 대상 쿼리에 소유권 필터가
> 걸려 있는지가 이 섹션의 핵심입니다.

| # | 항목 | 방법 | 심각도 | 상태 |
|---|---|---|---|---|
| 4.1 | 마이그레이션 드리프트 | 코드 스키마(SSOT) vs **두 DB 각각의** 실제 컬럼 대조. `manual_*.sql` 5건과 "ALTER 대기" 상태 항목(예: `0064`·`0014`)의 인스턴스별 적용 여부를 대장으로 관리. | **Critical** | ⚠️ |
| 4.2 | **소유권 필터 누락 스캔** | `routes/agent-portal.ts` · `owner-portal.ts` · `service-host-portal.ts` · `guest-portal.ts`가 읽는 모든 쿼리에 `partner_user`/`account`/`owner` 조건이 있는지 전수 확인. 누락 1건 = 타 파트너 계약·서류 노출. `check-privacy.sh` §5(requireAuth 누락)는 인증만 보고 **인가는 보지 않음**. | **Critical** | ⚠️ |
| 4.3 | 참조 무결성 / 고아 레코드 | 예약↔계약, 계약↔인보이스, 인보이스↔전표(journal), 문서↔엔티티, 작업지시↔파트너. 소프트 삭제(`deleted_at`) 사용 테이블은 표준 FK로 안 잡히므로 앱 레벨 감사 스크립트 필요(dry-run 기본). | High | ⬜ |
| 4.4 | 유령 테이블 | `pg_stat_user_tables`에서 `seq_scan + idx_scan ≈ 0` + 코드 grep-0 교차 확인. 97개 스키마 중 실사용분 확정. | Medium | ⬜ |
| 4.5 | 인덱스 (누락/중복/미사용) | 핵심 경로는 **기간 겹침 조회(체크인·체크아웃·계약기간)와 세대 가용성**, 그리고 리스트 정렬(수정일·생성일). `pg_stat_user_indexes`에서 `idx_scan = 0` 확인. | Medium | ⬜ |
| 4.6 | 슬로우 쿼리 | `pg_stat_statements`. 특히 대시보드 집계(층×타입 매트릭스)와 리스트 enrich. | Medium | ⬜ |
| 4.7 | **백업 복원 리허설** | "백업 존재"를 믿지 말고 **폐기용 프로젝트에 실제 복원**. 신분 서류가 있는 **Cloudinary 미디어도 복원 대상**. 두 인스턴스 각각 리허설하고 날짜 기록. | **Critical** | ⬜ |
| 4.8 | 금액 컬럼 타입 | 금액은 `numeric(10,2)` → **Drizzle이 문자열로 반환**. 쓰기 `String(...)`, 읽기 `Number(...)` 규약 준수 여부를 신규 코드에서 grep. `float` 컬럼이 새로 들어왔으면 즉시 지적. 통화 컬럼 존재 여부. | High | ⚠️ |
| 4.9 | 날짜 / 시간대 저장 | 체크인·체크아웃·납입일·기준일자의 `timestamptz` vs `date` 일관성. **크론은 Sydney 타임존, Metheim 업무는 Seoul** — 월 경계·일할 계산이 ±1일 어긋나는지 검증. Melbourne DST 전환일도 동일 검증. | High | ⚠️ |
| 4.10 | 세대 집계 기준 | 타입 마스터 행(`parent_space_id` 부모)은 임대 가능 세대가 아님. 모든 대시보드·리포트가 `countableUnitFilter`(api) / `unitSpaces()`(admin)를 쓰는지, `spaces.length`를 직접 세는 곳이 없는지. 여수 정본 = **269세대**. | High | ⚠️ |

## 5. 도메인 무결성 — 예약 · 계약 · 청구 · 원장 🟨 ⭐

> **이 시스템의 심장부.** 여기서 나오는 결함은 대부분 "실제 돈" 또는 "입주자가 잘 곳"에 직결됩니다.
> 다른 섹션을 다 통과해도 이 섹션이 비어 있으면 감사를 한 것이 아닙니다.

| # | 항목 | 방법 | 심각도 | 상태 |
|---|---|---|---|---|
| 5.1 | **이중 배정 / 오버부킹** | 같은 공간·겹치는 기간에 예약 2건 또는 계약 2건이 들어가는 레이스. **DB 유니크·exclusion 제약 또는 트랜잭션 잠금**이 실제로 있는지 코드로 확인. OTA iCal 임포트(`space_availability`, source='ical')와 내부 예약이 서로를 덮지 않는지도 포함. | **Critical** | ⬜ |
| 5.2 | **인보이스 번호 유일성** | 발급은 **`insertInvoiceWithRef()` 단일 경로**만 허용. 개수 기반 번호 생성은 중복 키 사고를 낸 전례가 있으므로 신규 코드에 재등장했는지 grep. 번호 연속성·재발행 이력 보존. | **Critical** | ⚠️ |
| 5.3 | 요금·청구 금액 계산 | 월세·보증금·관리비·부대비용의 화면 표시액 vs 인보이스 금액 일치. **`amount`는 공급가액 고정, `tax_amount` 별도, 부가세예수금 2300 계정** 규약 준수. 일할 계산(절사 3종)과 반올림 규칙. 통합(단체) 청구는 **부모 청구서가 집계에 이중 계상되지 않는지**. | High | ⚠️ |
| 5.4 | **보증금 원장** | 수령 → 보류(Deposits Held 2100) → 차감 → 반환의 상태 전이가 전표에 기록되는지, 잔액 음수·이중 반환이 가능한지, 차감 사유 증빙이 첨부되는지. 퇴거 정산의 기준일자·정산구분(NULL이면 자동 파생, 값 있으면 수동이 우선) 동작 확인. | **Critical** | ⬜ |
| 5.5 | 원장(GL) 전기 규칙 | 전기 일자 = `paid_at ?? due_date`, `posting_key` 멱등. 재실행 시 이중 전기가 없는지. 고객결제 → 집주인·파트너·에이전트 분배 leg이 맞아떨어지고 **실매출 = retained leg**인지. | **Critical** | ⬜ |
| 5.6 | 월세 청구 주기 | `LEASE_RENT_INVOICES_ENABLED` 크론(03:00 Sydney)이 계약-월당 1건만 만드는지(멱등), 납기 경과분이 Overdue로 넘어가 미납 대시보드와 일치하는지. **월 단위와 28일 단위(홈스테이)가 섞이지 않는지.** | High | ⬜ |
| 5.7 | 반복 청구 · 통합 청구 | `RECURRING_INVOICES_ENABLED`(02:30)와 통합 청구(03:10)가 동시에 같은 계약을 청구하지 않는지. 계정별 토글이 스위치이므로 **양쪽이 켜진 계정**을 실제 쿼리로 찾아 확인. | High | ⬜ |
| 5.8 | 커미션 · 파트너 정산 | 커미션 플랜의 `base_type`(환산보증금 등) 산정 기준, 중복 지급, 취소 시 회수(clawback), 지급 이력. 서비스호스트 정산 GL 5100/2200 대사. | High | ⬜ |
| 5.9 | 전자서명 무결성 | 서명 완료 문서가 **변경 불가**한지, 서명 시각·IP·기기가 감사 로그에 남는지, 재발송 시 이전 버전이 무효화되는지. **무로그인 토큰 링크**(세대점검표·작업지시 서명·세입자 온보딩)의 토큰 만료·1회성·추측 불가성. **본인이 아닌 대리 서명 경로**가 열려 있는지. | **Critical** | ⬜ |
| 5.10 | 계약 발행 흐름 | 위저드 4단계 + 서식 선택 강제 + 31일 이하만 온라인 서명 규칙이 API 레벨에서도 강제되는지(프런트 우회 가능성). **`PUT`이 전체 덮어쓰기라 부분 수정이 다른 필드를 지우는 함정** 확인. | High | ⚠️ |
| 5.11 | 서식 법정 기재사항 | 표준임대차계약서(별지 제24호서식, 2025-10-31 개정본)·주택임대차표준계약서의 필수 칸이 비어 발행되지 않는지. 임대사업자 등록증 `mlt_*` 17칸 자동 복사 동작. 임대인 칸 = **법인등록번호**(사업자등록번호 아님). | High | ⬜ |
| 5.12 | 상태 머신 역행 | 문의 → 신청 → 계약 → 청구 → 입주 → 퇴거 정산. 역행·건너뛰기 전이가 API로 가능한지(관리자 강제 전이는 사유 기록 필수). | High | ⬜ |
| 5.13 | 작업지시 · SLA | `*/10` 크론이 미확인 파트너를 breach 처리하고 에스컬레이션하는지(멱등, `sla_status='pending_ack'`만 터치). 카테고리 정본은 `lib/api-zod/src/workOrderCategories.ts` — 필터 이름이 컬럼과 일치하는지. | High | ⬜ |
| 5.14 | 문서 파일명 · 고객ID | `<고객ID>-<대상>-<서류종류>-<YYYYMMDD><순번>` 규칙이 모든 발행 경로에서 지켜지는지. 신규 문서 종류가 `DOC_CODES`·`DOC_NAMES_KO` **양쪽에** 등록됐는지. 고객ID는 `party_codes`로만 발급되고 재사용되지 않는지. | High | ⬜ |
| 5.15 | 세금 · 인보이스 표기 | MillionStay: ABN·GST. Metheim: 사업자등록번호·부가세·세금계산서 연계. 재발행 시 이력 보존. | High | ⬜ |

## 6. 보안 🟨

| # | 항목 | 방법 | 심각도 | 상태 |
|---|---|---|---|---|
| 6.1 | 인증 / 인가 / 권한 상승 | **JWT가 3종(게스트·관리자·파트너)으로 분리**되고 `PARTNER_JWT_SECRET`은 별도. 파트너 인증은 **Express 라우트 마운트 순서에 민감** — 마운트 순서를 바꾼 커밋이 있으면 파트너/관리자 우선순위를 재검증. Viewer 역할의 서버 측 읽기전용 강제가 우회 불가한지. | **Critical** | ⚠️ |
| 6.2 | **신분 서류 접근 통제** | 신분증·여권·통장 사본은 **Cloudinary 서명 URL + 보존기한**. URL이 추측 가능한지, 서명 만료가 실제로 적용되는지, 직접 URL 접근이 권한 검사를 우회하는지. 신분증은 연락처에만 첨부되는 규칙 준수. | **Critical** | ⚠️ |
| 6.3 | 시크릿 관리 | `check-privacy.sh` §1이 스테이지된 파일의 대표 키 패턴(sk_/pk_/whsec_/re_/ghp_/sbp_/JWT)을 차단 — **git 이력 전체 스캔은 아님**. `gitleaks detect` 도입이 백로그. `.env.local`·`tenants/*/secrets.env` gitignore 확인. 회전 플레이북 존재 여부. | **Critical** | ⚠️ |
| 6.4 | 의존성 취약점 | `pnpm audit` / Dependabot을 CI에 편입. 미도입이면 그것이 과제. | High | ❌ |
| 6.5 | SQLi | Drizzle 파라미터 바인딩이 기본. `sql\`\`` 원시 쿼리(검색·집계·리포트)에서 문자열 결합 grep. | High | ⬜ |
| 6.6 | XSS / 토큰 보관 | 토큰 보관 위치(쿠키 vs localStorage)를 **먼저 확정**. `check-privacy.sh` §6이 `httpOnly` 없는 쿠키를 차단. CMS 블록·이메일 템플릿·챗 응답 등 **사용자/AI 생성 콘텐츠 렌더링 경로** 특히 주의. | High | ⚠️ |
| 6.7 | 입력 검증 | `@workspace/api-zod` 적용 범위를 **쓰기 라우트 기준으로 실측**(92개 라우트 중 몇 개). 금액·날짜·파일 업로드 우선. | Medium | ⬜ |
| 6.8 | 보안 헤더 · CORS | helmet + HSTS + 추가 프라이버시 헤더가 `app.ts`에 적용됨. **CORS 허용 목록이 두 인스턴스의 실제 도메인만** 담고 있는지, 오너 랜딩 와일드카드가 과도하지 않은지, 레거시 도메인이 남아 있는지. | Medium | ⚠️ |
| 6.9 | 레이트 리밋 | 5개 리미터(login·application·general·privacy-export·chat)가 존재. **신규 공개 라우트마다 리미터가 붙는지**가 실제 리스크 — 공개 문의·신청·무로그인 서명 링크·AI 챗이 1차 표적. 로그인 잠금은 5회 실패(`loginLockout.ts`). | High | ⚠️ |
| 6.10 | 엣지 하드닝 상태 | `docs/SECURITY_EDGE_HARDENING.md` Phase A~D. 코드는 배포됐지만 **`ORIGIN_SHARED_SECRET`·`TRUST_CLOUDFLARE`가 설정되기 전까지 전부 no-op**. 두 인스턴스 각각의 현재 Phase를 기록하고, Phase C를 B보다 먼저 켜지 않았는지 확인. | High | ⚠️ |
| 6.11 | 파일 업로드 검증 | MIME·확장자·크기 제한, 실행 파일 차단, 이미지 재인코딩, 저장 경로에 원본 파일명 그대로 쓰지 않기(고객ID 폴더 규칙 `resolveDocFolder()`). 일괄 업로드 인박스·작업지시 사진 경로 포함. | High | ⬜ |
| 6.12 | 감사 로그 | `check-privacy.sh` §4가 `logAction` 없는 mutation을 휴리스틱으로 잡음. **서류 열람 로그**는 개인정보 대응상 필수 — 열람이 기록되는지 별도 확인. `system-logs` 라우트로 실제 조회 가능한지. | High | ⚠️ |
| 6.13 | 관리자 계정 위생 | 퇴사자·공용 계정, MFA, 최소 권한. `ensureAdminExists`가 `SEED_ADMIN_EMAIL/PASSWORD`로 만드는 **초기 계정이 그대로 살아 있는지**, 시드 비밀번호가 회전됐는지. `refresh_tokens` 폐기 동작. | High | ⚠️ |
| 6.14 | 외부 API 키 | `api_credentials`(Key+Secret, `/api/ext/v1`)의 발급·폐기 이력, 스코프 제한, 만료 정책. | High | ⬜ |

## 7. 성능 🟦

| # | 항목 | 방법 | 심각도 | 상태 |
|---|---|---|---|---|
| 7.1 | Core Web Vitals | 검색 유입이 매출 경로인 **게스트 웹 홈 · 매물 목록 · 매물 상세** 3개만이라도 측정. Lighthouse CI 미도입 시 *미측정* 기록. | Medium | ❌ |
| 7.2 | 캐시 전략 | 가용성·요금은 **장기 캐시 금지**(`no-store`). 정적 에셋 immutable. 두 인스턴스가 서로의 캐시를 오염시키지 않는지(호스트별 분리). | High | ⬜ |
| 7.3 | 이미지 / 번들 | 매물 사진이 핵심 자산 — Cloudinary 반응형 변환·포맷·지연 로딩. **prebuilt 업로드 방식인 Metheim은 번들이 커도 CI가 경고하지 않으므로** 번들 리포트를 수동 확인. | Medium | ⬜ |
| 7.4 | API 지연 | 리스트·대시보드·가용성 조회 TTFB. `pg_stat_statements` + Railway 메트릭. | Medium | ⬜ |
| 7.5 | 부하 테스트 | 시즌 동시 신청·일괄 청구 발행 시나리오. k6/artillery 미도입 시 *미측정* 기록. | Medium | ❌ |

## 8. 신뢰성 & 가용성 🟦

| # | 항목 | 방법 | 심각도 | 상태 |
|---|---|---|---|---|
| 8.1 | 예외 처리 일관성 | 중앙 에러 핸들러 → 로거. **크론 8개는 전부 `.catch()`로 로깅만 하고 끝납니다 — 실패해도 아무도 모릅니다.** 청구·정산·파기 실패는 조용히 넘어가면 안 됨. | High | ⚠️ |
| 8.2 | 크론 실행 확인 | 매일 각 잡의 성공 로그가 실제로 찍혔는지 확인하는 루틴(또는 `system_logs` 집계). 특히 **`RECURRING_INVOICES_ENABLED`·`LEASE_RENT_INVOICES_ENABLED`가 꺼져 있으면 잡은 돌지만 아무 일도 안 합니다** — "돌았다"와 "청구됐다"를 구분해 기록. | High | ⚠️ |
| 8.3 | 모니터링 / 알림 | 에러 트래킹 + 크론 실패 알림 채널 + 일일 헬스체크. 알림이 실제 수신되는지 테스트 발송. | Medium | ⬜ |
| 8.4 | 헬스 엔드포인트 + 스모크 | `routes/health.ts`(`/api/v1/health`, `/healthz`) — **엣지 origin guard의 예외 대상**이므로 직접 도달 가능. 두 인스턴스 API UP + 10개 프런트 로딩 + 로그인 스모크(테스트 계정, 프로드 데이터 미오염). | Medium | ⚠️ |
| 8.5 | 백업 / DR + RTO·RPO | Supabase 자동 백업 주기 + **Cloudinary(신분 서류) 백업 포함 여부**. RTO/RPO를 숫자로 명시. 복원 리허설 날짜 기록(§4.7). | High | ⬜ |
| 8.6 | 무중단 배포 | API 재배포 시 진행 중인 청구·서명 요청이 끊기는지. `SIGTERM` 핸들링 확인. 배포 창 정책(하루 2~3회 푸시 규약과 정합). | Medium | ⬜ |
| 8.7 | 외부 연동 장애 대응 | Resend(메일) · Cloudinary(미디어) · Stripe · AI 3사 · OTA iCal 다운 시 재시도 / 대체 경로 / 사용자 안내. **AI는 레지스트리에서 프로바이더 폴백(Anthropic)이 있으나 PDF·툴 사용은 Anthropic 전용** — 폴백 시 기능 저하 경로 확인. | Medium | ⚠️ |

## 9. 프런트엔드 · i18n · 브랜드 🟦 ⭐

> **6개 로케일 × 5개 앱 × 2개 브랜드**가 이 시스템의 고유 리스크입니다.

| # | 항목 | 방법 | 심각도 | 상태 |
|---|---|---|---|---|
| 9.1 | **번역 키 완결성** | `node scripts/audit-locale-coverage.mjs <lang>`로 앱·파일별 커버리지 측정(en이 SSOT). 누락 키는 `scripts/translate-i18n.mjs`로 채움. **신규 키를 en에만 넣고 끝낸 커밋**이 이번 주기에 있었는지 diff로 확인. | High | ✅ |
| 9.2 | 게스트 웹 콘텐츠 번역 | 게스트 웹의 비영어 콘텐츠는 **i18n 키가 아니라 DB `translations`** 경로(`?lang`, lang→ko→en 폴백). 공간·매물·편의시설 신규 데이터가 번역 없이 노출되는지. | High | ⚠️ |
| 9.3 | 로케일별 렌더링 | 베트남어 성조 부호(폰트 Vietnamese subset), 태국어 행간, 일·중 폰트 폴백(Noto Sans JP/SC/Thai), 한글 Pretendard. Montserrat·Noto Sans JP/SC/Thai는 5개 앱 `index.html`에 모두 로드됨을 2026-08-31 감사에서 확인(css2 API가 unicode-range로 자동 서브셋 서빙) — 신규 앱 추가 시 `<link>` 누락만 주의. | Medium | ✅ |
| 9.4 | 로케일별 포맷 | 날짜 형식은 **런타임 `branding.date_format` + 빌드타임 `VITE_DATE_FORMAT` 이중 레버** — 둘이 어긋나면 화면마다 다른 형식이 나옵니다. 통화는 `branding.currency` / `VITE_DEFAULT_CURRENCY`(게스트 웹 고정 + FX 환산). 날짜 오해는 실제 계약 사고로 직결. | High | ⚠️ |
| 9.5 | 긴 문자열 레이아웃 붕괴 | 태국어·일본어·베트남어에서 버튼·카드·테이블 헤더 오버플로. 주요 화면 6개 로케일 스팟 체크. | Medium | ⬜ |
| 9.6 | **브랜드 토큰 드리프트** | `@workspace/design-tokens` `brand.css`가 팔레트 SSOT. MillionStay 정식 `#E8621A`(로고 에셋 `#EE6B19`·구자료 `#ff6b00` 혼재 이력), Metheim `#005F73`+`#C6942E`. **코드·SVG·PDF 템플릿·이메일 템플릿 전부** 토큰 경유인지 `scripts/check-brand-overrides.sh`로 검증. | Medium | ⚠️ |
| 9.7 | 워드마크 · 표기 | MillionStay: "Million" = Navy `#16263F` / "Stay" = Orange. Metheim: **표기는 항상 "Metheim"**("MetHeim" 금지) — 코드·문서·이메일·PDF grep. 자동 생성물(인보이스·계약서)에서도 지켜지는지. | Low | ⚠️ |
| 9.8 | 문서 미리보기 규칙 | 모든 PDF·리포트·샘플이 `DocumentPreviewDialog` + `useDocumentPreview()` 경유인지. **새 `a.download` / `window.open(blobUrl)` 경로가 추가됐는지** grep. `onEmail`은 발송 엔드포인트가 있는 문서에만. | Medium | ⚠️ |
| 9.9 | 반응형 / 크로스 브라우저 | 파트너 포털(에이전트·오너·서비스호스트)은 모바일 비중이 높음. 로그인 → 목록 → 상세 → 서명 흐름을 **모바일 실기기**로 확인. | Medium | ⬜ |
| 9.10 | 접근성 (WCAG) | Orange `#E8621A` / Teal `#005F73` 위 흰 텍스트 대비비 실측. 폼 라벨, 키보드 내비게이션. axe-core 미도입 시 주요 흐름만 수동. | Medium | ❌ |
| 9.11 | SEO | 게스트 웹·랜딩은 SEO가 매출 경로 — 메타·사이트맵·robots·`hreflang`(6개 로케일). **admin/agent/owner/host는 `noindex`여야 정상.** 오너 랜딩(`{slug}.millionstay.com`) 색인 상태. | High | ⬜ |
| 9.12 | 콘솔 에러 / 깨진 링크 | 주요 흐름 콘솔 에러 0. 무로그인 서명·온보딩 링크 유효성. | Low | ⬜ |

## 10. API 🟦

| # | 항목 | 방법 | 심각도 | 상태 |
|---|---|---|---|---|
| 10.1 | API 계약 최신성 | `lib/api-spec`(OpenAPI) → `lib/api-client-react`(Orval) 재생성이 실제 API를 따라가는지. **생성 타입이 뒤처져 `api-augmentations.d.ts`로 임시 브리지된 항목**은 스펙 갱신 + 재생성으로 갚아야 할 부채로 기록. | Medium | ⚠️ |
| 10.2 | **버전 정책** | `/api/v1/` 단일 버전을 **두 인스턴스가 공유** — 한쪽을 위한 파괴적 변경이 다른 쪽을 즉시 깨뜨립니다. 파괴적 변경 시 v2 분기 규칙이 문서화됐는지. 외부 API는 `/api/ext/v1` 별도. | High | ⚠️ |
| 10.3 | 응답 포맷 일관성 | 조회 엔드포인트는 `{ id, display, ...extra }` 규약(lookup). 리스트·에러 코드 체계가 92개 라우트에서 일관적인지. | Low | ⬜ |
| 10.4 | 폐기 엔드포인트 | `dev-migration.ts` · `db-sync.ts` 같은 **개발용 라우트가 프로덕션에 노출돼 있는지** 반드시 확인. 레거시·그림자 라우트 grep. | High | ⚠️ |
| 10.5 | 공개 엔드포인트 노출 범위 | `routes/public.ts`가 내부 필드(원가·소유주 정보·내부 메모·타 고객 정보)를 함께 반환하지 않는지 **응답 필드 화이트리스트 확인**. 판매 1차 문의는 비공개 + 관리자 마스킹 검수 큐 경유. 오너 포털의 임차인 마스킹 동작. | High | ⚠️ |

## 11. 인프라 / DevOps 🟦

| # | 항목 | 방법 | 심각도 | 상태 |
|---|---|---|---|---|
| 11.1 | CI/CD 상태 | `ci.yml`(verify → deploy-admin → deploy Metheim frontends) + `privacy-checks.yml`. 전부 green인지, **`verify` 게이트 뒤에 있는 배포 잡만 존재하는지**(게이트 밖 배포 = 빨간 빌드 출하). | Medium | ✅ |
| 11.2 | **환경 분리 (dev/staging/prod)** | **로컬 개발이 프로덕션 Supabase(Supavisor 세션 풀러)를 직접 바라봅니다. 별도 개발 DB가 없습니다.** 실 고객 데이터·청구가 있는 시스템에서 이는 Critical 지적 사항입니다. 최소한 읽기 전용 자격증명 분리 또는 스냅숏 기반 개발 DB 도입을 로드맵에 올릴 것. | **Critical** | ⚠️ |
| 11.3 | 시크릿 배치 | 로컬 `.env.local` / `tenants/*/secrets.env` vs Railway·Vercel 환경변수 대조. 프로드 키가 개발자 로컬에 복사돼 있는 범위를 명시적으로 기록(현 구조상 일부는 불가피 — 그러면 회전 주기로 관리). | Critical | ⚠️ |
| 11.4 | 배포 경로 위생 | Railway CLI 인증 만료 시 `main` 머지 또는 대시보드로 재배포. **브랜치에서 `railway up`한 배포분은 다음 `main` 푸시에 소멸** — 그 사실을 아는 사람만 아는 상태인지, 점검 스크립트가 있는지. | High | ⚠️ |
| 11.5 | 도메인 / SSL / DNS | 두 인스턴스 도메인 + 오너 랜딩 와일드카드의 인증서 만료·자동 갱신·DNS 소유 계정. | Medium | ⬜ |
| 11.6 | 비용 / 리소스 | Supabase(2개) · Railway(2개) · Vercel(10개 프로젝트) · Cloudinary 사용량. **사진·서류 누적으로 스토리지가 선형 증가** — 추세 확인 + 보존기간 파기 잡의 실제 감축 효과 대조. | Low | ⬜ |
| 11.7 | 계정 소유권 | 도메인·호스팅·DB·미디어·메일 계정이 누구 명의인지. 인스턴스별로 다르면 이관 계획을 리스크로 기록. | High | ⬜ |

## 12. 컴플라이언스 🟪

> **두 나라 법을 동시에 지켜야 합니다** — MillionStay는 호주(APP), Metheim은 한국(PIPA·주택임대차보호법).

| # | 항목 | 방법 | 심각도 | 상태 |
|---|---|---|---|---|
| 12.1 | 개인정보 (호주) | **Australian Privacy Act (APPs)** 기준. `docs/PRIVACY_COMPLIANCE.md` + CI `privacy-checks`가 코드 레벨을 강제. 개인정보 처리방침 페이지가 실제 처리 내역과 일치하는지. | High | ✅ |
| 12.2 | 개인정보 (한국) | **개인정보보호법(PIPA)** — Metheim은 계약서 발행을 위해 **주민등록번호를 수집**합니다. 법정 수집 근거 표시, 별도 동의, 암호화 저장, 파기 절차가 갖춰졌는지. 이 항목은 호주 APP 체계로 대체되지 않습니다. | **Critical** | ⬜ |
| 12.3 | **서류 보관 · 파기** | 보존기한 경과 문서를 **물리 삭제**하는 크론이 이미 있음(`retentionPurge.ts`, 03:15, Cloudinary 자산 + DB 행). 확인할 것: 모든 서류 유형에 보존기한이 실제로 설정돼 있는지, 파기 로그가 남는지, DSAR 삭제 요청이 소프트 삭제에서 끝나지 않는지. | **Critical** | ⚠️ |
| 12.4 | 국외 이전 | MillionStay 데이터는 호주 밖(예: Cloudinary·Resend·AI 3사) 리전으로 나가는지, Metheim 데이터(Seoul Supabase)가 호주·미국 서비스로 나가는지. **AI 호출로 개인정보가 벤더에 전송되는 경로**(명함 OCR·신분증 판독·문서 인테이크·번역)가 고지·동의 범위 안인지. | High | ⚠️ |
| 12.5 | 소비자법 / 약관 | 보증금 차감 기준·취소·환불 정책이 호주 ACL / 한국 주택임대차보호법·약관규제법상 불공정에 해당하지 않는지(법률 검토 필요 — 이 점검표는 검토 필요 여부만 표시). | High | ⬜ |
| 12.6 | 요금·조건 표시 정합성 | 웹사이트 · 매물 리스팅 · 계약서 · 인보이스의 금액·기간·환불 조건이 **모두 동일한지**. 광고 표시와 실제 청구 불일치는 규제 리스크. (§5.3 참조) | High | ⬜ |
| 12.7 | 마케팅 동의 | `marketing_consents` — 동의 없는 대상에게 캠페인이 나가지 않는지. **`RESEND_API_KEY`는 DB로도 주입되므로 `.env`에서 지워도 발송이 멈추지 않습니다** — 안전장치는 `MARKETING_DRY_RUN`. | High | ⚠️ |
| 12.8 | 쿠키 동의 / 트래킹 | 공개 사이트에 분석·광고 태그가 있으면 동의 배너 필요 여부 확인(EU 방문자 포함 시). | Low | ⬜ |
| 12.9 | 오픈소스 라이선스 | `license-checker`로 의존성 스캔. `docs/THIRD_PARTY_UI_CREDITS.md`와 대조. | Low | ⬜ |
| 12.10 | 시크릿 회전 준비 | 회전 플레이북 존재 + 최근 회전일 기록. 유출 시 절차는 `docs/NDB_INCIDENT_RUNBOOK.md`. | High | ⚠️ |
| 12.11 | 침해 대응 리허설 | NDB(호주) / 개인정보 유출 신고(한국) 각각의 통지 기한·창구를 아는 담당자가 지정됐는지. 런북 기준 탁상 훈련 반기 1회. | High | ⬜ |

---

## 실행 방법 (자동화 번들)

**읽기 전용 1회 스캔 — 안전:**

```bash
pnpm typecheck                                  # §3.1 유일한 정적 게이트
./scripts/check-privacy.sh                      # §6.3 §6.12 프라이버시 정적 검사 6종
./scripts/test-privacy-coverage.sh              # §12.1 커버리지 테스트
./scripts/check-brand-overrides.sh              # §9.6 브랜드 토큰 드리프트
node scripts/audit-locale-coverage.mjs ko       # §9.1 (vi·th·ja·zh 각각 반복)
pnpm outdated -r                                # §2.6
pnpm audit                                      # §6.4 (CI 미편입 — 도입 과제)
gitleaks detect --no-git                        # §6.3 (미도입 — 도입 과제)
```

**도메인 데이터 감사 — 반드시 dry-run, 승인 없이 `--apply` 금지, 인스턴스별로 각각:**

```
· 기간 겹침(이중 배정) 검출              (§5.1)
· 인보이스 번호 중복·결번 스캔            (§5.2)
· 인보이스 금액 재계산 대조(공급가액/부가세) (§5.3)
· 보증금 원장 잔액 대사                   (§5.4)
· GL posting_key 중복 전기 스캔           (§5.5)
· 같은 계약에 반복청구+통합청구 동시 활성   (§5.7)
· 고아 레코드 스캔                        (§4.3)
· 파트너 라우트 소유권 필터 누락 스캔       (§4.2)
· 두 DB 스키마 diff                       (§1.5 §4.1)
```

**도입 대상 도구 (각각이 백로그 항목):**
gitleaks(§6.3) · Dependabot / `pnpm audit` CI(§6.4) · madge `--circular`(§2.4) ·
Lighthouse CI(§7.1) · k6 또는 artillery(§7.5) · axe-core(§9.10) ·
license-checker(§12.9) · **도메인 불변식 테스트 하네스(§3.5 — 최우선)**

**도구로 잡을 수 없어 수동 검토가 필요한 것:**
이중 배정 레이스 · 보증금/커미션 정산 로직 · 파트너 간 데이터 경계 · 전자서명 무결성 ·
무로그인 토큰 링크 수명 · 신분 서류 접근 통제 · 크론 타임존과 월 경계 · 인스턴스 간 배포 순서.

---

## 심각도 × 파급 반경 판정

발견 사항은 **영향 × 파급 반경**으로 순위를 매깁니다. 반경은 다음 순으로 큽니다.

`all-instances` > `instance`(millionstay / metheim) > `app` > `locale` > `single-page`

다음 중 하나에 해당하면 겉보기 크기와 무관하게 **Critical** 로 판정합니다.

인스턴스 간 데이터 교차 / 전 고객 데이터 유실·유출 / 신분 서류 노출 /
청구·보증금·GL 원장 손상 / 역할·파트너 경계를 넘는 데이터 노출 / 시크릿 노출 /
이중 배정 / 테넌트 프런트 브랜드 클로버.

## 발견 사항 보고 양식

```
[ID]  제목
섹션 / 항목:   예) §5.4 보증금 원장
심각도:       Critical | High | Medium | Low
파급 반경:     all-instances | instance:<millionstay|metheim> | app:<web|admin|agent|owner|host> | locale:<xx> | single-page
증거:         파일:라인, 쿼리 결과, 스크린샷
재현 절차:     정확한 단계 / 명령
권고:         조치 방안 + 공수 추정
금전 영향:     해당 시 예상 금액 · 영향 계약/청구 건수
```

## 개선 로드맵

| 우선순위 | 발견 사항 | 담당 | 기한 | 재검증 |
|---|---|---|---|---|
| P0 (Critical) | | | | |
| P1 (High) | | | | |
| P2 (Medium) | | | | |
| P3 (Low) | | | | |

> 조치 후: 자동화 번들 재실행 + 해당 항목 수동 재검증 → 이 문서의 상태 태그와
> 프런트매터 `last_verified` 갱신.

---

## 권장 주기 요약

| 주기 | 범위 |
|---|---|
| 🟥 배포마다 | `typecheck` · 배포 타깃 빌드 · privacy checks — CI 강제. 배포 후 두 인스턴스 헬스 + 로그인 스모크 |
| 🟧 주간 | 코드 건전성(§3) · 신규 공개 라우트 레이트 리밋 · 번역 키 누락 · 크론 성공 로그 확인 |
| 🟨 월간 | 인스턴스 격리(§1) · DB/스키마(§4) · **도메인 무결성(§5)** · 보안(§6) · 마이그레이션 드리프트 |
| 🟦 분기 | 자산 인벤토리(§0) · 아키텍처(§2) · 성능(§7) · 신뢰성(§8) · 프런트/i18n/브랜드(§9) · API(§10) · 인프라(§11) · **백업 복원 리허설** |
| 🟪 반기 | 컴플라이언스(§12) · 시크릿 회전 · RTO/RPO 재산정 · 침해 대응 탁상 훈련 · 신규 인스턴스 프로비저닝 리허설 |

---

*MillionStay · Metheim — 시스템 정기 점검표 v1.1 (2026-08-31)*

첫 감사 결과: [audits/2026-08-31-system-audit.md](audits/2026-08-31-system-audit.md)

# Homestay Workflow — 홈스테이 매칭·계약 워크플로우

> 상태: 제안 / 설계 확정, 구현 착수 전
> 작성: 2026-06-12
> 관련 앱: `million-stay-web`, `agent-portal`, `property-admin`, `api-server`, `lib/db`
> 전자서명 참고: Edubee CRM (`/Users/sunkim/Claude-Code/Edubee-CRM`)

## 1. 목표

`www.millionstay.com`은 중·단기 개인 렌트(거래형 self-serve)를 위해 제작되었다.
홈스테이는 본질적으로 **심사·매칭형(운영팀 중개)** 제품이므로 워크플로우를
단기 렌트와 **별도로** 설계한다. 단, 코드·API·DB는 분리하지 않는다.

**전략: "논리적 분리, 물리적 통합"**
- 논리적 분리 — `homestay.millionstay.com` 서브도메인 + 홈스테이 전용 동선·플로우
- 물리적 통합 — 동일 모노레포·단일 API 서버·단일 Postgres. **새 포털 0개**(기존
  포털에 홈스테이 모듈만 추가).

### 확정된 설계 결정 (사용자 승인)

| 결정 항목 | 선택 |
|---|---|
| 매칭 주체 | **운영팀 수동 매칭 (admin-brokered)** — 에이전트는 신청 대행 채널 |
| 결제 모델 | **전액 온라인** — 선결제(배치비+보증금+첫 달) + 월 Stripe 구독 |
| 대상 고객 | **미성년/성인 둘 다** — 신청 시 만 18세 연령 분기 |
| 학생/계약주체 용어 | **Student 단일 사용** — 보호자(Guardian)는 Student의 속성 필드 |
| 에이전트 커미션 기준액 | **배치비/첫 결제(선결제) 기준** + 픽스 소개비 정액 추가, 중복 적용 |

### 용어 (확정)

| 도메인 개념 | 용어 | 비고 |
|---|---|---|
| 거주 당사자 | **Student** | 단일 도메인 용어 |
| 보호자 | (Student의 속성) | `is_minor` 시 `guardian_*` 필드로 처리 |
| 호스트 가족 | **Host family** | 확정 |
| 유학원 | **Agent** | 확정 |
| 단기 렌트 고객 | **Guest** | 기존 유지 — 홈스테이와 충돌 금지 |

## 2. 현황 (기준 코드)

### 이미 구현됨
- **홈스테이 호스트**: 신청 폼 + 관리자 승인 + 호스트 포털 + DB
  - `lib/db/src/schema/homestay_host_applications.ts` (상태기계 Submitted→
    UnderReview→DocsRequested→Approved/Rejected, 가구·방·학생선호·서류추적,
    `landing_active`)
  - `artifacts/api-server/src/routes/homestay.ts` (공개 신청/디렉터리, 호스트
    포털, 관리자 승인)
  - `artifacts/million-stay-web/src/pages/{for-homestay-host,host-login,host-portal}.tsx`
  - 인증: partner JWT `portal_type='homestay'`, `homestay_token`
- **서브도메인 인프라**(owner-sites): `{slug}.millionstay.com` 자동 프로비저닝
  (`artifacts/api-server/src/lib/vercelDomains.ts`), 와일드카드 CORS, slug 검증
  (`getOwnerSiteSlug()` in `million-stay-web/src/lib/owner-site.ts`)
- **에이전트/커미션 기반**: `partner_users.portal_type`에 `'agent'` 존재,
  `accounts`에 회사·은행(`payment_info_id`)·커미션(`default_commission_id`)·담당자
  (contacts) 필드, `commissions` 테이블, property-admin 커미션 관리 페이지
- **결제**: Stripe 연동(`routes/stripe.ts`), Cloudinary 서명 URL, Resend 이메일

### 핵심 격차
1. **Student 쪽 여정 전무** — 신청·서명·배치 조회·결제 화면 없음
2. **매칭 모델 없음** — 호스트↔Student를 잇는 placement 엔티티·상태기계·가용 모델 없음
3. **에이전트 대행 기능 없음** — 현재 agent-portal은 읽기 전용(대행 신청·결제·학생 관리 불가)
4. **커미션 엔진 부족** — 계정당 단일 %만, **픽스+%+중복·정산추적 없음**
5. **전자서명 없음** — 신청서·계약서 온라인 서명 미구현

## 3. 5-역할 모델 & 재사용 전략

| 역할 | 인증/포털 | 재사용 | 신규 추가 |
|---|---|---|---|
| **Host family** | partner JWT `homestay` · 호스트 포털 | 신청·승인·서류 | 신청서 **전자서명** |
| **Agent** | partner JWT `agent` · agent-portal | 회원가입·인증·accounts/은행/contacts | 회사·담당자·은행 구조화 + **승인 게이트**, **홈스테이 모듈**(대행신청·학생관리·파이낸스·커미션) |
| **Student** | guest 계정 `ms_guest_token` · 게스트 포털 | 계정·로그인·포털 셸 | **온라인 신청서+서명**, 배치 조회, 결제 |
| **Service Partner**<br>(공항픽업·초기정착) | partner JWT `service_host` · service-host-portal | `service_hosts`·포털(jobs/schedule/earnings)·신청 흐름·**마스킹** | `service_catalog`에 서비스 유형 추가 + placement 연결 |
| **Operations** | property-admin | CRM·커미션 셸 | **매칭 콘솔**, 커미션 플랜, 배치·결제·정산, **서비스 배정** |

> **Service Partner 비노출은 기존 틀로 자동 충족** — 게스트 포털·에이전트 포털은
> 이미 `service_hosts`/`booking_services` 데이터를 응답에 포함하지 않는다
> (`maskTenantForAgent()` in `routes/agent-portal.ts`). 학생·에이전트는 픽업
> 드라이버 정보를 볼 수 없고, 운영팀(property-admin)·해당 파트너만 본다.

## 4. 워크플로우 (액터별 여정)

### Host family (대부분 구현됨)
신청 → 운영팀 검증 → 서류(WWCC 등) → 승인 → **매칭 대기(가용)** →
**배정 제안 수락/거절** → 배치 활성 → 월 정산 수령

### Student (신규)
신청(연령 분기: <18 → 보호자 정보·동의·서명) → **T&C 동의** → 운영팀 검토 →
운영팀 제안 호스트 확인 → **선결제(배치비+보증금+첫 달)** → 월 구독 등록 →
**계약서 전자서명** → 배치 확정 → 포털에서 배치·결제·지원

### Agent (신규)
회원가입(기존) → 회사·담당자·은행 제출 → **운영팀 승인** → 포털에서
**Student 대신 신청서 작성** → 정보 확인 → **대행 결제 또는 결제 링크 전달** →
등록 학생 업무·서류·진행상태·파이낸스 관리 → **커미션 지급여부 확인**

### Operations (신규, property-admin)
호스트 승인(기존) → **Student 신청 큐** → **매칭 콘솔**(신청 ↔ 가용 호스트
필터: 지역·성별·정원·식사·연령정책 → 배정 → 호스트 알림·수락 추적) →
**배치·결제 관리**(선결제·구독·보증금) → **서비스 배정**(공항픽업·초기정착을
service partner에 할당, 학생·에이전트엔 비노출) → **호스트/에이전트 정산**

## 5. 상태기계

- **Student 신청**: `Draft → Submitted → UnderReview → Matching → Proposed →
  Confirmed → Placed → Completed` (+ `Cancelled`/`Rejected`)
- **Placement**: `Proposed → HostAccepted → AwaitingPayment → Active → Ending →
  Completed` (+ `Cancelled`/`Terminated`, 보조 `PastDue`)
  - `AwaitingPayment → Active`는 선결제 성공이 게이트
- **Agent 온보딩**: `Registered → UnderReview → Approved/Rejected`
- **Commission**: `Pending → Approved → Paid`

## 6. 데이터 모델 (신규, `lib/db`)

```
homestay_student_requests
  id, account_id(FK→accounts, guest 계정), agent_account_id(FK, nullable — 대행 시),
  student_name, date_of_birth, is_minor,
  guardian_name, guardian_email, guardian_relationship, guardian_consent_at,  // 미성년만
  preferences JSONB { gender, suburb, school, meal, dietary, move_in, duration, budget },
  status, terms_accepted_at, notes(운영팀)

homestay_placements
  id, host_application_id(FK), student_request_id(FK), status,
  move_in_date, move_out_date,
  placement_fee, deposit, monthly_fee,            // numeric → String() 래핑
  stripe_customer_id, stripe_subscription_id,
  agent_account_id(FK, nullable)

homestay_placement_payments
  id, placement_id(FK), kind('upfront'|'monthly'), amount, status,
  invoice_id(FK, nullable), stripe_payment_intent_id, paid_at

homestay_commission_plans                          // 회사별 차등
  id, account_id(FK→agent account), fixed_referral_fee, percentage_rate, stack(bool)
  // commission = fixed_referral_fee + (선결제액 × percentage_rate%)   when stack

agent_commission_ledger                            // 정산 추적 (현재 시스템에 없음)
  id, placement_id(FK), agent_account_id(FK), amount, status('Pending'|'Approved'|'Paid'),
  approved_at, paid_at

homestay_host_availability (선택)                   // 매칭용 정원/점유
  host_application_id(FK), capacity, occupied

homestay_placement_services                        // 픽업·정착 작업을 placement에 연결
  id, placement_id(FK), service_id(FK→service_hosts), service_type, status,
  scheduled_at, notes, price
  // booking_services 패턴 미러링 — service-host 포털이 이 작업도 표시
  // 학생·에이전트 응답엔 절대 미포함 (기존 마스킹 정책 그대로)

contract_signing_requests                          // Edubee 포팅
  id, token(unique), context_type('host_app'|'student_app'|'placement_contract'),
  context_id, status('pending'|'signed'|'expired'|'cancelled'), expires_at,
  signers JSONB [{role,name,email,required}],
  signatures JSONB [{role,name,email,signatureImage,serverSignedAt,ip,userAgent,consent}],
  pdf_url(Cloudinary), audit_trail JSONB
```

> 커미션 기준액 = **선결제(배치비+첫 결제)** 1회성 → 커미션은 배치 시점 1회
> 산정. 월별 누적 불필요로 ledger 단순.

## 7. 전자서명 & 계약 (Edubee CRM 포팅)

거의 동일 스택(React/Express/Drizzle/Postgres/Resend)이라 그대로 이식:
- 캔버스 **SignaturePad**(`Edubee .../components/shared/SignaturePad.tsx`) — PNG data URL
- 토큰 공개서명 링크 + `signatures` JSONB(서버측 법적 메타: serverSignedAt·IP·
  userAgent·consent) + audit_trail
- `@react-pdf/renderer`로 서명 PDF + **서명 인증서 페이지**
  (`Edubee .../services/signatureCertificate.ts`)
- 저장소만 로컬디스크 → **Cloudinary**로 대체

| 폼 | 서명 | 서명자 |
|---|---|---|
| Host family 신청서 (기존) | 추가 | Host |
| Agent 신청서 | 불필요 | (기존 회원가입) |
| Student 신청서 (신규) | 추가 | Student + (미성년시) Guardian |
| 계약서(placement agreement) | 풀 서명 플로우 | Guardian/Student (+ 필요시 Host) |
| Terms & Conditions | 동의 체크 + 타임스탬프 | 신청 단계 |

## 8. 에이전트 커미션 엔진

- `homestay_commission_plans`로 **회사별 차등** 설정 (property-admin 관리 페이지 신규)
- 산식: `commission = fixed_referral_fee + (선결제액 × percentage_rate%)` (중복 적용)
- `agent_commission_ledger`로 배치별 발생·지급상태(`Pending→Approved→Paid`) 추적
- 에이전트 포털 파이낸스 탭에서 학생별 결제일·결제여부 + 본인 커미션 지급여부 표시

## 9. 단계별 로드맵

| Phase | 내용 | 의존성 |
|---|---|---|
| **0. 서브도메인 분리** | `homestay.millionstay.com` 진입·홈·네비 (`isHomestaySubdomain()`) | — |
| **1. 스키마 기반** | §6 테이블 전부 + 마이그레이션 | 0 |
| **2. 전자서명 공용 모듈** | SignaturePad·signing API·PDF·인증서 (Edubee 포팅) | 1 |
| **3. Student 신청+서명** | 온라인 신청서(연령분기) + 서명 + 호스트 신청서 서명 + T&C | 2 |
| **4. 에이전트 서브시스템** | 승인 게이트 + 대행신청 + 학생관리·파이낸스 + 커미션 엔진/원장 + 결제대행·링크 | 1,3 |
| **5. 운영팀 매칭 콘솔** | 신청↔가용호스트 배정 + placement 상태기계 + 호스트 수락 | 3 |
| **6. 결제·계약·정산** | Stripe 선결제+월 구독 + 계약서 서명 + 호스트/에이전트 정산 | 4,5 |
| **6b. 서비스 파트너** | `service_catalog`에 공항픽업·초기정착 추가 + `homestay_placement_services` + 운영팀 배정 (service-host 포털·마스킹 재사용) | 5 |
| **7. 라이프사이클·운영** | 연장/해지(보증금 정산) + 알림(영문) + 리포트 | 6 |

> Phase 2(전자서명)·4(에이전트)는 Phase 1 이후 **병렬 가능**.
> `property-admin`은 **수동 배포** 필요(`pnpm build` + `vercel --prod`).

## 10. 남은 결정사항 (구현 중 확정)

1. **호스트 정산 방식** — Stripe Connect(자동 payout, 무거움) vs 수동 정산 기록 +
   오프라인 송금. → MVP는 후자 권장.
2. **보증금 보관** — 플랫폼 보유 vs 호스트 직접 (호주 규정 영향).
3. **에이전트와 단기 렌트 agent-portal 공존** — 동일 포털에 홈스테이 섹션 추가
   (현 방침) vs 교육 에이전트 전용 `account_type` 분기.
4. **월 구독 결제수단 수집** — 대행 결제 시 에이전트 카드 vs 결제 링크로 보호자
   카드 등록.

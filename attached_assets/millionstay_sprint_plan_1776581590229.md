# MillionStay PMS — 기술 부채 해소 스프린트 계획서
**진단 기준일:** 2025 | **대상 코드베이스:** property-admin + million-stay-web + API Server
> 이 문서는 아키텍처 진단 결과를 바탕으로 작성된 실행 계획입니다.
> 각 옵션은 독립적이지 않으며, A → B → C 순서로 누적 적용됩니다.

---

## 📊 진단 요약 (의사결정 근거)

| 영역 | ✅ 충족 | ⚠️ 부분 | ❌/🚫 미흡 | 핵심 리스크 |
|------|--------|---------|-----------|-----------|
| SaaS 아키텍처 | 1 | 1 | 6 | 멀티테넌시 전무 |
| DB / 스키마 | 3 | 3 | 4 | PK integer, 마이그레이션 도구 없음 |
| 파일 스토리지 | 2 | 3 | 8 | 영구 URL 노출, 문서 테이블 없음 |
| 호주 Privacy Act | 2 | 4 | 14 | APP 7 위반, 파기 절차 없음 |
| 보안 / 인증 | 4 | 3 | 6 | CORS 전체 허용, Refresh Token 없음 |
| API 설계 | 2 | 2 | 4 | OpenAPI 없음, 응답 형식 불통일 |
| 사이트맵 / IA | 2 | 1 | 4 | 권한 매트릭스 미정의 |
| .NET 전환 준비 | 1 | 2 | 5 | Repository Pattern 전무, 테스트 0건 |

---

## 🗺️ 옵션 선택 가이드

```
지금 MillionStay는 어떤 단계인가?

단일 법인 운영 + 당장 법적 리스크만 제거  →  옵션 A
단일 법인 운영 + 호주 Privacy Act 정식 대응  →  옵션 B  ← 권장
향후 타 PMS 고객사에도 판매 (진짜 SaaS)  →  옵션 C
신규 기능 개발 우선, 기술 부채는 나중에  →  옵션 D (비권장)
```

---

## 옵션 A — 즉시 위험 제거 스프린트
**기간:** 1~2주 | **범위:** 🔴 치명 항목 9개만 | **팀:** 백엔드 1명

> 서비스를 지금 당장 멈추게 할 수 있는 보안·데이터 오류만 제거합니다.
> 기능 추가 없이 기존 코드 수정만 진행합니다.

---

### Sprint A-1: 금융 데이터 오류 수정 (0.5일)

**목표:** 인보이스 GST 계산 오류 원천 차단

| # | 작업 | 파일 | 처리 방법 |
|---|------|------|----------|
| A-1-1 | `amount` 타입 변경 | `shared/schema/invoices.ts:9` | `real()` → `numeric("amount", {precision:10, scale:2})` |
| A-1-2 | `discount_amount` 타입 변경 | `shared/schema/promotions.ts:10` | `real()` → `numeric("discount_amount", {precision:10, scale:2})` |
| A-1-3 | 마이그레이션 파일 생성 및 적용 | `drizzle/migrations/` | `drizzle-kit generate` 후 검증 |

**완료 기준:** `SELECT pg_typeof(amount) FROM invoices` → `numeric` 반환

---

### Sprint A-2: CORS 보안 긴급 패치 (0.5일)

**목표:** 임의 도메인 인증 토큰 탈취 차단

| # | 작업 | 파일 | 처리 방법 |
|---|------|------|----------|
| A-2-1 | CORS origin 화이트리스트 적용 | `server/app.ts` | 아래 코드로 교체 |
| A-2-2 | 환경변수 `ALLOWED_ORIGINS` 추가 | `.env.example` | 배포 환경별 도메인 목록 |

```typescript
// 변경 전 (취약)
cors({ origin: true, credentials: true })

// 변경 후 (안전)
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim());
cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
})
```

**완료 기준:** 미등록 도메인에서 API 호출 시 `403` 반환

---

### Sprint A-3: JWT 하드코딩 시크릿 제거 (0.5일)

**목표:** `JWT_SECRET` 미설정 시 서버 시작 차단

| # | 작업 | 파일 | 처리 방법 |
|---|------|------|----------|
| A-3-1 | fallback 시크릿 제거 | 미들웨어 3개 파일 | fallback 값 삭제, 미설정 시 서버 시작 오류 발생 |
| A-3-2 | 시작 시 필수 ENV 검증 | `server/app.ts` | 아래 코드 추가 |

```typescript
// server/app.ts 최상단 — 필수 환경변수 검증
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'CLOUDINARY_URL'] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[FATAL] 환경변수 ${key} 가 설정되지 않았습니다. 서버를 시작할 수 없습니다.`);
    process.exit(1);
  }
}
```

**완료 기준:** `.env`에서 `JWT_SECRET` 제거 후 `npm start` 실행 시 즉시 종료

---

### Sprint A-4: 마이그레이션 도구 전환 (1일)

**목표:** `drizzle-kit push` → `drizzle-kit generate` + 마이그레이션 파일 git 관리

| # | 작업 | 설명 |
|---|------|------|
| A-4-1 | `drizzle/migrations/` 폴더 생성 | 현재 스키마 기준 초기 마이그레이션 생성 |
| A-4-2 | `package.json` 스크립트 수정 | `db:push` 제거, `db:generate` + `db:migrate` 추가 |
| A-4-3 | CI/CD에 `db:migrate` 추가 | 배포 시 자동 마이그레이션 적용 |
| A-4-4 | 팀 가이드 문서 작성 | 스키마 변경 시 반드시 generate → PR → migrate 순서 명시 |

```json
// package.json scripts
"db:generate": "drizzle-kit generate",
"db:migrate":  "drizzle-kit migrate",
"db:studio":   "drizzle-kit studio"
```

**완료 기준:** `git log drizzle/migrations/` 에 마이그레이션 이력 확인 가능

---

### Sprint A-5: Refresh Token 기초 구현 (1일)

**목표:** Access Token 8시간 → 15분 단축 + Refresh Token 도입

| # | 작업 | 파일 |
|---|------|------|
| A-5-1 | `refresh_tokens` 테이블 추가 | `shared/schema/refresh-tokens.ts` (신규) |
| A-5-2 | 로그인 시 Refresh Token 발급 | `routes/auth.ts` |
| A-5-3 | `/api/v1/auth/refresh` 엔드포인트 추가 | `routes/auth.ts` |
| A-5-4 | 로그아웃 시 Refresh Token 무효화 | `routes/auth.ts` |

```typescript
// shared/schema/refresh-tokens.ts
export const refreshTokens = pgTable('refresh_tokens', {
  id:         uuid('id').defaultRandom().primaryKey(),
  userId:     integer('user_id').notNull().references(() => adminUsers.id),
  tokenHash:  varchar('token_hash', { length: 64 }).notNull().unique(),
  expiresAt:  timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt:  timestamp('revoked_at', { withTimezone: true }),
  createdAt:  timestamp('created_at', { withTimezone: true }).defaultNow(),
  ipAddress:  varchar('ip_address', { length: 45 }),
  userAgent:  varchar('user_agent', { length: 512 }),
});
```

**완료 기준:** `/api/v1/auth/refresh` 호출로 신규 Access Token 발급 확인

---

### Sprint A-6: Cloudinary Signed URL 전환 (1일)

**목표:** 여권·계약서 등 민감 파일 영구 URL 노출 차단

| # | 작업 | 파일 |
|---|------|------|
| A-6-1 | `generateSignedUrl()` 유틸 함수 작성 | `utils/cloudinary.ts` |
| A-6-2 | 파일 서빙 API를 Signed URL 반환으로 변경 | `routes/space-images.ts`, `routes/documents.ts` |
| A-6-3 | DB에 저장된 `secure_url`을 `public_id`로 교체 | 마이그레이션 스크립트 |

```typescript
// utils/cloudinary.ts — 15분 만료 Signed URL
export function generateSignedUrl(publicId: string, expiresInSeconds = 900): string {
  return cloudinary.url(publicId, {
    sign_url: true,
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
    secure: true,
  });
}
```

**완료 기준:** 파일 API 응답의 URL에 `?__cld_token__=` 포함 확인

---

### 옵션 A 완료 기준 체크리스트

- [ ] `invoices.amount`, `promotions.discount_amount` → `numeric(10,2)` 변환 완료
- [ ] CORS 화이트리스트 적용 — 미등록 origin 차단 확인
- [ ] JWT_SECRET 하드코딩 fallback 완전 제거
- [ ] 마이그레이션 파일 git 관리 전환
- [ ] Refresh Token 엔드포인트 동작 확인
- [ ] 민감 파일 Signed URL 전환 (만료 15분)

**총 예상 소요: 4~5일 (풀타임 백엔드 1명)**

---

## 옵션 B — Privacy Act 정식 대응 패키지
**기간:** 옵션 A 완료 후 2~3주 추가 | **범위:** A 전체 + APP 7/11/12/13 + 문서 관리 기반 | **팀:** 백엔드 1명 + 프론트 1명

> 호주 Privacy Act 1988 위반으로 인한 OAIC 과태료 및 법적 리스크를 제거합니다.
> Spam Act 2003 위반(APP 7) 은 이메일 발송이 있다면 최우선입니다.

---

### Sprint B-1: APP 7 마케팅 동의 시스템 (2일)

**목표:** 예약 동의 ≠ 마케팅 동의 분리 (Spam Act 2003 대응)

| # | 작업 | 파일 |
|---|------|------|
| B-1-1 | `marketing_consents` 테이블 생성 | `shared/schema/marketing-consents.ts` (신규) |
| B-1-2 | 예약/가입 화면에 마케팅 별도 체크박스 추가 | `million-stay-web/src/pages/booking-new.tsx` |
| B-1-3 | 이메일 템플릿에 Unsubscribe 링크 추가 | 이메일 발송 유틸 |
| B-1-4 | `/api/v1/privacy/unsubscribe` 엔드포인트 | `routes/privacy.ts` (신규) |

```typescript
// shared/schema/marketing-consents.ts
export const marketingConsents = pgTable('marketing_consents', {
  id:           uuid('id').defaultRandom().primaryKey(),
  userId:       integer('user_id').references(() => users.id),
  email:        varchar('email', { length: 255 }).notNull(),
  channel:      varchar('channel', { length: 20 }).notNull(), // 'email' | 'sms'
  optedInAt:    timestamp('opted_in_at',  { withTimezone: true }),
  optedOutAt:   timestamp('opted_out_at', { withTimezone: true }),
  source:       varchar('source', { length: 50 }),  // 'booking_form' | 'profile' | 'import'
  ipAddress:    varchar('ip_address', { length: 45 }),
  createdAt:    timestamp('created_at',   { withTimezone: true }).defaultNow(),
});
```

---

### Sprint B-2: 문서 메타데이터 테이블 및 파기 정책 (3일)

**목표:** APP 11 파기 의무 이행 + documents 통합 관리 기반

| # | 작업 | 설명 |
|---|------|------|
| B-2-1 | `documents` 통합 테이블 생성 | 체크리스트 3.6 스키마 그대로 구현 |
| B-2-2 | 기존 `space_images`, `booking_service_photos` → `documents` 마이그레이션 | 데이터 이관 스크립트 |
| B-2-3 | `retention_until` 자동 설정 로직 | 문서 유형별 보존 기간 자동 계산 |
| B-2-4 | 만료 파일 자동 삭제 스케줄러 | 매일 새벽 3시 실행 (node-cron) |

```typescript
// 문서 유형별 보존 기간 (호주 법규 기준)
const RETENTION_DAYS: Record<string, number> = {
  'tax_invoice':   365 * 5,   // ATO 요건 — 5년
  'contract':      365 * 7,   // 각 주 임대차보호법 — 7년
  'receipt':       365 * 5,   // ATO 요건 — 5년
  'id_document':   30,         // APP 11 — 목적 달성 후 즉시 (30일 유예)
  'visa_document': 30,
  'other':         365 * 2,
};

export function calcRetentionDate(docType: string): Date {
  const days = RETENTION_DAYS[docType] ?? RETENTION_DAYS['other'];
  return addDays(new Date(), days);
}
```

---

### Sprint B-3: Privacy Policy 내용 보강 (1일)

**목표:** APP 1, APP 5 — 수집 고지 의무 충족

현재 페이지 존재 확인, 아래 항목 누락 여부 점검 및 추가:

- [ ] 수집 정보 전체 목록 (이름, 이메일, 여권번호, 결제정보, 주소)
- [ ] 수집 목적별 설명
- [ ] 제3자 제공 목록: Stripe, Cloudinary, Resend, AWS (리전 명시)
- [ ] 해외 이전 여부 및 대상국
- [ ] 보존 기간 (문서 유형별)
- [ ] 열람·수정·삭제 요청 방법 및 연락처
- [ ] Privacy Officer 이름 또는 직책 및 이메일
- [ ] OAIC 불만 제기 방법 안내

---

### Sprint B-4: 게스트 포털 APP 12/13 대응 (2일)

**목표:** 본인 데이터 열람권 및 정정권 UI 구현

| # | 작업 | 파일 |
|---|------|------|
| B-4-1 | "내 데이터" 통합 페이지 추가 | `million-stay-web/src/pages/my-data.tsx` (신규) |
| B-4-2 | 업로드 파일 목록 + 다운로드 UI | 문서 API 연동 |
| B-4-3 | 개인정보 수정 이력 로깅 | `profile_change_logs` 테이블 + 미들웨어 |
| B-4-4 | 계정 삭제 요청 기능 | 30일 유예 후 익명화 처리 |

---

### Sprint B-5: NDB 대응 기초 (1일)

**목표:** Notifiable Data Breaches — 30일 신고 절차 기반 마련

| # | 작업 | 산출물 |
|---|------|--------|
| B-5-1 | 침해 대응 Runbook 작성 | `docs/INCIDENT_RESPONSE.md` |
| B-5-2 | 비정상 접근 알림 로직 | 단기간 대량 파일 다운로드 시 Slack/이메일 알림 |
| B-5-3 | OAIC 신고 템플릿 준비 | `docs/NDB_REPORT_TEMPLATE.md` |

---

### Sprint B-6: MIME 검증 + 비밀번호 정책 강화 (1일)

| # | 작업 | 파일 |
|---|------|------|
| B-6-1 | magic-bytes 파일 시그니처 검증 | `utils/file-validator.ts` (신규) |
| B-6-2 | 비밀번호 최소 12자 + 복잡도 강제 | `routes/auth.ts:99` |
| B-6-3 | 로그인 실패 5회 잠금 | `routes/auth.ts` + `login_attempts` 테이블 |

```typescript
// utils/file-validator.ts — magic bytes 검증
const ALLOWED_SIGNATURES: Record<string, number[][]> = {
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],          // %PDF
  'image/jpeg':      [[0xFF, 0xD8, 0xFF]],
  'image/png':       [[0x89, 0x50, 0x4E, 0x47]],
  'image/webp':      [[0x52, 0x49, 0x46, 0x46]],           // RIFF
};

export function validateMimeBySignature(buffer: Buffer, declaredMime: string): boolean {
  const sigs = ALLOWED_SIGNATURES[declaredMime];
  if (!sigs) return false;
  return sigs.some(sig => sig.every((byte, i) => buffer[i] === byte));
}
```

---

### 옵션 B 완료 기준 체크리스트

- [ ] `marketing_consents` 테이블 + 게스트 화면 별도 Opt-in 체크박스
- [ ] 모든 발송 이메일에 Unsubscribe 링크 포함
- [ ] `documents` 통합 테이블 + `retention_until` 자동 설정
- [ ] 만료 파일 자동 삭제 스케줄러 동작 확인
- [ ] Privacy Policy 7개 필수 항목 모두 포함 확인
- [ ] 게스트 포털 "내 데이터" 페이지 — 파일 열람/삭제 요청 기능
- [ ] magic-bytes 검증으로 확장자 위장 파일 차단
- [ ] NDB Runbook 및 OAIC 신고 템플릿 문서화

**총 추가 예상 소요: 10~12일 (백엔드 + 프론트 각 1명, 병렬 진행)**

---

## 옵션 C — .NET 전환 대공사 (선택적 장기 계획)
**기간:** 옵션 B 완료 후 6~10주 추가 | **범위:** B 전체 + UUID PK + Repository Pattern + tenant_id + Docker | **팀:** 백엔드 2명

> 이 옵션은 MillionStay를 **다른 고객사에도 판매하는 진짜 SaaS 플랫폼**으로 전환할 때만 필요합니다.
> 단일 법인 운영이라면 옵션 B로 충분합니다.

---

### Sprint C-1: 신규 테이블부터 UUID PK 전환 (2주)

> 기존 45개 테이블을 한 번에 바꾸는 것은 현실적으로 불가능합니다.
> 전략: **신규 테이블은 무조건 UUID PK**, 기존 테이블은 별도 마이그레이션 스프린트로 순차 전환

| 단계 | 작업 | 기간 |
|------|------|------|
| C-1-1 | Drizzle 스키마 가이드 문서 작성 (UUID 강제 규칙) | 0.5일 |
| C-1-2 | 고위험 테이블 우선 전환 (users, admin_users, bookings, contracts) | 5일 |
| C-1-3 | 나머지 테이블 순차 전환 | 5일 |
| C-1-4 | 기존 integer FK 참조 전체 수정 | 3일 |

```typescript
// 모든 신규 테이블 PK 패턴 (표준)
id: uuid('id').defaultRandom().primaryKey(),
```

---

### Sprint C-2: Repository Pattern 도입 (3주)

> 45개 라우트 핸들러의 DB 직접 접근을 단계적으로 분리합니다.
> 신규 라우트부터 강제 적용, 기존 라우트는 수정 시 함께 리팩터링.

```
현재 구조 (문제)               목표 구조 (.NET 호환)
──────────────────────         ──────────────────────────────
routes/bookings.ts             routes/bookings.ts
  ├─ req, res 처리                ├─ req, res 처리 (얇은 레이어)
  └─ Drizzle 쿼리 직접 호출       └─ bookingService.create(dto)
                                       │
                               services/booking-service.ts
                                 ├─ 비즈니스 로직
                                 └─ bookingRepository.save(entity)
                                       │
                               repositories/booking-repository.ts
                                 └─ Drizzle 쿼리
```

| 단계 | 작업 | 기간 |
|------|------|------|
| C-2-1 | `repositories/`, `services/` 디렉터리 생성 및 Base 인터페이스 정의 | 1일 |
| C-2-2 | 핵심 모듈 우선 분리 (bookings, contracts, invoices) | 5일 |
| C-2-3 | 나머지 모듈 순차 분리 | 10일 |

```typescript
// repositories/booking-repository.ts (패턴 예시)
export interface IBookingRepository {
  findById(id: string): Promise<Booking | null>;
  findByTenantId(tenantId: string, opts: QueryOpts): Promise<PaginatedResult<Booking>>;
  save(booking: Booking): Promise<Booking>;
  softDelete(id: string): Promise<void>;
}

export class DrizzleBookingRepository implements IBookingRepository {
  constructor(private db: DrizzleDb) {}
  // Drizzle 구현 ...
}

// .NET 전환 시: EfCoreBookingRepository implements IBookingRepository
```

---

### Sprint C-3: tenant_id 전체 도입 (2주)

> Repository Pattern 완료 후 진행 — 쿼리가 한 레이어에 모여 있어야 수정이 현실적입니다.

| 단계 | 작업 | 기간 |
|------|------|------|
| C-3-1 | 멀티테넌시 전략 확정 (Row-level Security vs tenant_id 컬럼) | 0.5일 |
| C-3-2 | 전체 테이블 `tenant_id UUID` 컬럼 추가 마이그레이션 | 2일 |
| C-3-3 | 모든 Repository 메서드에 `tenantId` 파라미터 강제 | 5일 |
| C-3-4 | JWT 미들웨어에 `tenantId` 추출 + Repository 자동 주입 | 2일 |

---

### Sprint C-4: Docker + 기초 테스트 환경 (1주)

| 단계 | 작업 | 산출물 |
|------|------|--------|
| C-4-1 | `docker-compose.yml` 작성 | API + DB + Redis 로컬 환경 |
| C-4-2 | Vitest 설치 + 핵심 Service 유닛 테스트 | 테스트 커버리지 ≥ 60% (비즈니스 로직) |
| C-4-3 | GitHub Actions CI 파이프라인 | PR 시 자동 테스트 + 린트 |

```yaml
# docker-compose.yml (핵심 서비스)
services:
  api:
    build: ./server
    environment:
      DATABASE_URL: postgres://dev:dev@db:5432/millionstay
      JWT_SECRET: local-dev-secret-change-in-prod
    depends_on: [db, redis]

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: millionstay
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
```

---

### 옵션 C 완료 기준 체크리스트

- [ ] 모든 PK UUID 전환 완료 — `serial` 컬럼 0개
- [ ] `repositories/` + `services/` 디렉터리 존재 — 라우트 파일 내 직접 DB 호출 0건
- [ ] `tenant_id` 컬럼 전체 테이블 적용
- [ ] Docker Compose로 로컬 환경 `docker compose up` 한 번에 실행
- [ ] 핵심 Service 유닛 테스트 커버리지 ≥ 60%
- [ ] CI에서 자동 테스트 통과

**총 추가 예상 소요: 6~10주 (백엔드 2명 전담)**

---

## 옵션 D — 현상 유지 (비권장)
**기간:** 0 | **범위:** 없음

> 신규 기능 개발을 우선하고 기술 부채를 나중에 처리하는 옵션입니다.
> 아래 리스크를 인지한 상태에서 선택하는 것을 전제로 합니다.

| 리스크 | 현재 상태 | 예상 발생 시점 |
|--------|----------|--------------|
| 인보이스 GST 계산 오류 | `real()` float 사용 | 소수점 누적 시 수백 건 불일치 |
| 보안 토큰 위조 | JWT_SECRET fallback 존재 | ENV 미설정 운영 배포 시 즉시 |
| CORS 토큰 탈취 | 전체 origin 허용 | 악성 사이트에서 즉시 가능 |
| Spam Act 2003 위반 | 마케팅 동의 미분리 | 이메일 발송 즉시 |
| APP 11 위반 (파기 미이행) | 자동 파기 없음 | 첫 게스트 퇴실 후 |
| .NET 전환 시 전체 재작성 | Repository Pattern 없음 | 전환 시점에 6~12주 추가 |

---

## 📅 옵션별 전체 일정 비교

```
Week  1   2   3   4   5   6   7   8   9   10  11  12
옵션A [━━━━━]
옵션B       [━━━━━━━━━━━━━]
옵션C                     [━━━━━━━━━━━━━━━━━━━━━━━]

권장 경로: A → B → (판단 후) C or 신규 기능 개발
```

| 옵션 | 기간 | 투입 인력 | 법적 리스크 해소 | .NET 전환 준비 | 권장 대상 |
|------|------|----------|----------------|--------------|---------|
| A | 1~2주 | 백엔드 1명 | 부분 | ❌ | 최소 조치 필요 시 |
| **B** | **3~5주** | **백엔드+프론트** | **✅ 충분** | **❌** | **현재 단계 권장** |
| C | 9~15주 | 백엔드 2명 | ✅ | ✅ | SaaS 다중 고객사 판매 시 |
| D | 0 | — | ❌ | ❌ | 비권장 |

---

## 🔁 지속 관리 항목 (스프린트와 무관하게 즉시 적용)

이 항목들은 코드 변경 없이 지금 당장 적용 가능합니다.

- [ ] Replit 또는 배포 환경에서 `JWT_SECRET` 실제 랜덤값으로 설정 확인
- [ ] `ALLOWED_ORIGINS` 환경변수에 실제 운영 도메인만 등록
- [ ] Cloudinary 대시보드 → 접근 제어 설정 검토 (퍼블릭 URL 노출 여부)
- [ ] Privacy Policy 페이지 — Privacy Officer 연락처 최소 1줄 추가
- [ ] 모든 마케팅 이메일 발송 중단 또는 Opt-in 확인 후 재개
- [ ] `drizzle-kit push` 를 운영 DB에 직접 실행하지 않도록 팀 공유

---

*이 계획서는 진단 시점(2025년) 기준이며, 코드 변경에 따라 항목 상태가 달라집니다.*
*법률 조항(Privacy Act, Spam Act)은 실제 적용 전 호주 법률 전문가 검토를 권장합니다.*

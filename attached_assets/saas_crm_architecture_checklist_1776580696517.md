# MillionStay PMS 아키텍처 평가 체크리스트
**MillionStay PMS — MVP → .NET 전환 준비**
> 버전: v1.0 | 대상: MillionStay PMS (호주 운영 기준) | 총 8개 영역 · 72항목

---

## 우선순위 범례
| 기호 | 수준 | 설명 |
|------|------|------|
| 🔴 | 치명적 | 지금 놓치면 .NET 전환 시 전체 재설계 필요 |
| 🟠 | 높음 | 운영 개시 후 버그·기술 부채로 직결 |
| 🔵 | 보통 | Phase 2 전환 전까지 처리 권장 |
| 🟢 | 낮음 | 여유 있을 때 개선 |

---

## 01. SaaS 아키텍처 기초

### 멀티 테넌시
- [ ] 🔴 Tenant isolation 전략 확정 (Schema-per-tenant vs Row-level Security)
  - PostgreSQL Row-Level Security 또는 별도 스키마 선택
  - .NET 전환 시 EF Core Global Query Filter 적용 용이성 고려
- [ ] 🔴 `tenant_id` FK가 **모든** 주요 테이블에 존재하는지 확인
  - 누락 시 나중에 ALTER TABLE 마이그레이션 비용 폭발
- [ ] 🟠 Tenant 온보딩 자동화 워크플로우 설계 (셀프 사인업 → 프로비저닝)
  - 수동 셋업은 SaaS 확장성 저하의 주요 원인

### 확장성
- [ ] 🟠 Stateless API 서버 설계 (수평 확장 가능한 구조)
  - 세션 상태를 서버 메모리가 아닌 Redis/DB에 저장
- [ ] 🟠 Background Job Queue 분리 (이메일, 알림, PDF 생성 등)
  - 동기 처리 시 API 응답 지연 — Celery / BullMQ / Hangfire 검토
- [ ] 🔵 Rate Limiting per tenant 구현
  - Noisy Neighbor 문제 방지 (한 테넌트 과부하 → 다른 테넌트 영향)

### 운영
- [ ] 🔵 Health Check 엔드포인트 `/health` 구현
  - `/health/live`, `/health/ready` 분리 권장 (Kubernetes probe 대응)
- [ ] 🔵 Feature Flag 시스템 구현 (테넌트별 기능 On/Off)
  - Plan별 기능 제한, A/B 테스트, 점진적 롤아웃에 필수

---

## 02. 데이터베이스 / 스키마 설계

### 설계 원칙
- [ ] 🔴 모든 PK가 `UUID(v4/v7)`인지 확인 — `auto-increment` PK 금지
  - 분산 환경 및 다중 DB 병합 시 충돌 방지, .NET `GUID`와 1:1 매핑
- [ ] 🟠 Soft Delete 패턴 적용 (`deleted_at TIMESTAMPTZ`)
  - `is_deleted BOOLEAN` 금지 — NULL=활성, 날짜값=삭제로 통일
- [ ] 🟠 Audit 컬럼 모든 테이블 통일
  - `created_at`, `updated_at`, `created_by`, `updated_by` 4개 컬럼 필수
  - .NET EF Core `SaveChanges` 인터셉터로 자동화 가능

### 정규화
- [ ] 🟠 요금/가격 테이블 정규화 수준 검토 (최소 3NF)
  - JSON 컬럼에 가격 구조 저장 시 쿼리 및 인덱스 불가 — 컬럼으로 분리
- [ ] 🔵 Enum 값을 DB 타입 또는 `lookup_values` 테이블로 관리
  - 하드코딩된 상태값은 다국어/확장에 취약

### 성능
- [ ] 🟠 자주 조회되는 FK 컬럼에 복합 Index 존재 여부
  - `(tenant_id, status)`, `(tenant_id, created_at)` 등 — `EXPLAIN ANALYZE` 검증
- [ ] 🔵 N+1 쿼리 발생 위험 구간 식별 및 Eager Loading 적용
  - .NET EF Core `Include()` 패턴 준비

### 마이그레이션
- [ ] 🔴 DB 마이그레이션 도구 사용 (Alembic / Flyway / EF Migrations)
  - SQL 스크립트 수동 관리는 팀 협업과 롤백 불가능
- [ ] 🔴 금액 필드 전체 `DECIMAL(10,2)` 사용 여부 (`float`/`double` 금지)
  - 부동소수점 오류로 인한 인보이스 계산 오류 — SaaS 치명적 버그
- [ ] 🔵 현재 스키마에서 SQL Server 호환 DDL 추출 가능 여부 테스트
  - PostgreSQL 전용 타입(`JSONB`, `ARRAY`) 사용 범위 파악 후 대체재 검토

---

## 03. 파일 스토리지 & 문서 관리

### 스토리지 인프라
- [ ] 🔴 파일 스토리지 전략 확정 — S3 호환 오브젝트 스토리지 사용
  - AWS S3 / Cloudflare R2 / MinIO (자체 호스팅)
  - 로컬 파일시스템(`/uploads`) 저장 **절대 금지** — 멀티 테넌트 환경에서 경로 충돌 및 재해 복구 불가
- [ ] 🔴 파일 경로 네이밍 규칙 정의
  - 구조: `tenants/{tenant_id}/{entity_type}/{entity_id}/{year}/{month}/{uuid}.{ext}`
  - `tenant_id` 최상위 prefix로 — 타 테넌트 파일 접근 불가 구조
- [ ] 🔴 Presigned URL 방식으로 파일 서빙 (직접 S3 버킷 퍼블릭 노출 금지)
  - 만료 시간 15분 이하 Presigned URL 생성
  - 다운로드 이력 `file_access_logs` 테이블에 기록
- [ ] 🟠 S3 버킷 정책 설정
  - 퍼블릭 액세스 차단 (`Block Public Access` 활성화)
  - 서버 사이드 암호화 `SSE-S3` 또는 `SSE-KMS` 활성화
  - Versioning 활성화 (문서 덮어쓰기 방지)
- [ ] 🟠 버킷 복제 또는 백업 정책 설정
  - Cross-Region Replication (호주 내: `ap-southeast-2` ↔ DR 리전)
  - 최소 30일 보존 정책 설정

### 파일 메타데이터 DB 설계
- [ ] 🟠 `documents` 테이블 설계 완료
  ```
  documents
  ├── id              UUID PK
  ├── tenant_id       UUID FK (NOT NULL)
  ├── entity_type     VARCHAR  -- 'booking', 'contract', 'guest', 'invoice'
  ├── entity_id       UUID FK
  ├── document_type   VARCHAR  -- 'contract', 'invoice', 'receipt', 'id_doc', 'visa', 'other'
  ├── file_name       VARCHAR  -- 원본 파일명 (표시용)
  ├── s3_key          VARCHAR  -- S3 오브젝트 경로 (UNIQUE)
  ├── s3_bucket       VARCHAR
  ├── mime_type       VARCHAR
  ├── file_size_bytes BIGINT
  ├── checksum_sha256 VARCHAR  -- 무결성 검증
  ├── version         INTEGER  DEFAULT 1
  ├── parent_id       UUID FK SELF -- 이전 버전 참조
  ├── status          VARCHAR  -- 'pending_review', 'approved', 'rejected', 'archived'
  ├── is_sensitive    BOOLEAN  DEFAULT false  -- PII 여부
  ├── retention_until DATE     -- 보존 만료일 (자동 삭제 스케줄러 기준)
  ├── uploaded_by     UUID FK (users)
  ├── reviewed_by     UUID FK (users)
  ├── reviewed_at     TIMESTAMPTZ
  ├── deleted_at      TIMESTAMPTZ  -- Soft Delete
  ├── created_at      TIMESTAMPTZ  DEFAULT NOW()
  └── updated_at      TIMESTAMPTZ
  ```
- [ ] 🟠 문서 유형별 분류 체계 및 접근 권한 매트릭스 정의
  | 문서 유형 | 게스트 본인 | 게스트 타인 | Staff | Admin |
  |-----------|------------|------------|-------|-------|
  | 계약서 | ✅ 읽기 | ❌ | ✅ | ✅ |
  | 인보이스 | ✅ 읽기 | ❌ | ✅ | ✅ |
  | 신분증/여권 | ✅ 업로드 | ❌ | 🔒 필요시 | ✅ |
  | 비자 서류 | ✅ 업로드 | ❌ | 🔒 필요시 | ✅ |

### 업로드 보안
- [ ] 🔴 업로드 파일 MIME 타입 검증 (확장자 위장 공격 방지)
  - 허용: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`
  - Content-Type 헤더가 아닌 **파일 시그니처(magic bytes)** 검증
- [ ] 🟠 업로드 파일 바이러스 스캔 연동
  - ClamAV (자체 호스팅) 또는 AWS GuardDuty Malware Protection
  - 스캔 미완료 파일은 격리(quarantine) 버킷에 임시 저장
- [ ] 🟠 파일 크기 제한 설정
  - 단일 파일: 최대 20MB
  - 테넌트 전체 스토리지 쿼터 설정 및 초과 알림
- [ ] 🔵 이미지 파일 메타데이터(EXIF) 자동 제거
  - GPS 위치정보, 촬영 기기 정보 등 PII 포함 가능 — Stripping 처리

### PDF 자동 생성
- [ ] 🟠 PDF 생성 파이프라인 구성
  - Python: WeasyPrint / wkhtmltopdf
  - .NET: iTextSharp / QuestPDF
  - 방식: HTML 템플릿 → PDF (헤더, 푸터, 페이지 번호 포함)
- [ ] 🟠 생성 대상 문서 목록
  - [ ] 예약 확인서 (Booking Confirmation)
  - [ ] 임대 계약서 (Tenancy Agreement)
  - [ ] 인보이스 (Tax Invoice — GST 포함, ABN 표기)
  - [ ] 영수증 (Receipt)
  - [ ] 보증금 반환 명세서 (Bond Refund Statement)
- [ ] 🔵 전자 서명 워크플로우 설계 (계약서)
  - DocuSign / HelloSign API 연동 또는 자체 서명 캔버스
  - 서명 완료 후 원본 PDF 잠금 (수정 불가)

### 문서 버전 관리
- [ ] 🟠 견적서(Quote) → 계약서(Contract) 버전 이력 보존
  - `documents.version` + `parent_id` FK로 체인 구성
  - 이전 버전 삭제 금지 (법적 증거 보존)
- [ ] 🔵 문서 변경 이력 `document_audit_logs` 테이블
  - `action` (created, approved, rejected, downloaded, deleted), `actor_id`, `timestamp`, `ip_address`

### 파일 보존 & 삭제
- [ ] 🟠 문서 보존 기간 정책 수립 (호주 법규 기준)
  - 세금 관련 서류: **최소 5년** (ATO 요건)
  - 임대 계약서: **계약 종료 후 최소 7년** (호주 각 주 임대차보호법)
  - 신분증/여권 사본: **목적 달성 후 즉시 삭제 또는 익명화** (APP 11)
- [ ] 🟠 자동 삭제/아카이브 스케줄러 구현
  - `documents.retention_until` 기준 만료 파일 S3 Glacier 이관 또는 삭제
  - 삭제 전 30일 이메일 알림 (테넌트 Admin에게)
- [ ] 🔵 삭제 요청(Right to Erasure) 처리 워크플로우
  - 게스트 데이터 삭제 시 관련 파일 S3 삭제 + `s3_key` DB 익명화

---

## 04. 호주 개인정보보호법 (Privacy Act 1988 / APPs)

> 호주 Privacy Act 1988에는 13개의 **Australian Privacy Principles (APPs)**가 있습니다.
> 숙박업(PMS)에서 수집하는 이름, 여권, 결제정보, 주소는 **민감 개인정보**로 취급됩니다.

### APP 1 — 개인정보 관리의 공개 (Open and transparent management)
- [ ] 🟠 Privacy Policy 페이지 작성 및 게스트 포털 하단 링크 게시
  - 수집 정보 목록, 이용 목적, 제3자 제공 여부, 보존 기간, 열람/수정 방법 명시
- [ ] 🟠 Privacy Policy를 예약 체크박스 동의로 연결 (예약 완료 전 필수 동의)
- [ ] 🔵 Privacy Officer 지정 및 연락처 명시

### APP 2 — 익명성 및 가명 처리 (Anonymity and pseudonymity)
- [ ] 🔵 가능한 경우 익명 또는 가명으로 서비스 이용 옵션 제공 고려
  - 문의(CS 티켓) 등 개인정보 불필요한 기능에서 옵션 제공

### APP 3 — 개인정보 수집 (Collection of solicited personal information)
- [ ] 🟠 수집 시점에 수집 목적 고지 (인라인 안내 문구 또는 툴팁)
  - 여권 번호 입력 필드 옆: "비자 조건 확인 및 법적 신원 검증 목적으로만 사용됩니다"
- [ ] 🟠 **목적 외 정보 수집 금지** — 예약에 불필요한 정보 요구 금지
  - 종교, 정치적 의견, 건강 정보 등 민감 정보는 명시적 동의 없이 수집 금지
- [ ] 🔵 수집 정보 최소화 원칙 적용 (Data Minimisation)

### APP 5 — 수집 고지 (Notice about collection)
- [ ] 🟠 수집 즉시 또는 이전에 다음 사항 고지
  - 조직명 및 연락처
  - 수집 목적
  - 제3자 공개 가능성 (예: 회계사, 정부기관)
  - 해외 이전 여부 (클라우드 서버 위치 포함)
- [ ] 🔵 이메일/SMS로 예약 확인 시 Privacy Notice 링크 포함

### APP 6 — 이용 및 제3자 제공 (Use or disclosure)
- [ ] 🟠 개인정보 이용은 수집 목적 범위 내로 한정
- [ ] 🟠 제3자 제공 목록 문서화
  - 결제 처리사 (Stripe / PayID / BPAY)
  - 이메일 발송 서비스 (SendGrid / SES)
  - 클라우드 인프라 (AWS ap-southeast-2)
  - 채널 매니저 (OTA 연동 시)
- [ ] 🔵 제3자 제공 시 Data Processing Agreement (DPA) 체결 여부 확인

### APP 7 — 직접 마케팅 (Direct marketing)
- [ ] 🟠 마케팅 이메일/SMS 발송 시 명시적 Opt-in 동의 수집
  - 예약 완료 ≠ 마케팅 동의 — 별도 체크박스 필수
- [ ] 🟠 Unsubscribe 링크 모든 마케팅 이메일에 포함 (스팸법 CAN-SPAM / Spam Act 2003 동시 준수)
- [ ] 🔵 마케팅 수신 동의 이력 DB 저장 (`marketing_consents` 테이블: `opted_in_at`, `opted_out_at`, `source`)

### APP 8 — 해외 이전 (Cross-border disclosure)
- [ ] 🟠 개인정보 해외 이전 시 상대국 보호 수준 확인
  - AWS `ap-southeast-2` (시드니) 사용 시 국내 처리로 간주 가능
  - 다른 리전(미국, 유럽) 이전 시 **APP 8.1** 준수 또는 동의 획득
- [ ] 🟠 이메일 서비스(SendGrid 등) 데이터 처리 위치 확인 및 DPA 체결
- [ ] 🔵 개인정보 처리 위치 지도 (Data Flow Map) 작성

### APP 11 — 개인정보 보안 (Security of personal information)
- [ ] 🔴 개인정보 무단 접근, 수정, 공개, 분실에 대한 기술적 보안 조치 적용
  - 암호화 전송 (HTTPS/TLS 1.2+)
  - 저장 데이터 암호화 (RDS 암호화, S3 SSE)
  - 접근 로그 (`access_logs` 테이블 — who, when, what)
- [ ] 🔴 더 이상 필요하지 않은 개인정보 파기 또는 익명화 절차
  - 퇴실 후 불필요한 여권 사본 삭제
  - 마케팅 미동의 비활성 계정 데이터 익명화 (N년 후)
- [ ] 🟠 내부 직원 접근 최소 권한 원칙 (Least Privilege)
  - 청소 스태프는 예약 날짜만, 프론트는 계약서까지, Admin은 전체

### APP 12 — 열람권 (Access to personal information)
- [ ] 🟠 게스트 포털에서 본인 데이터 열람 기능 제공
  - 저장된 개인정보, 계약서, 인보이스, 업로드 파일 조회 가능
- [ ] 🔵 데이터 열람 요청 처리 프로세스 정의 (요청 후 30일 이내 응답 — APP 기준)
- [ ] 🔵 열람 거부 사유 목록 및 응답 템플릿 준비

### APP 13 — 정정권 (Correction of personal information)
- [ ] 🟠 게스트 Profile 메뉴에서 개인정보 직접 수정 기능 제공
- [ ] 🔵 수정 요청 처리 이력 로깅 (`profile_change_logs`)
- [ ] 🔵 수정 불가 항목(계약 확정 후 이름 등) 처리 정책 수립 및 안내

### 데이터 침해 대응 (Notifiable Data Breaches Scheme — NDB)
- [ ] 🟠 데이터 침해 감지 모니터링 구성
  - 비정상 대량 쿼리, 비업무 시간 대량 다운로드 알림
- [ ] 🟠 침해 발생 시 **30일 이내** OAIC(정보접근위원회) 신고 절차 수립
  - 신고 기준: 개인정보 침해가 "심각한 피해"를 초래할 가능성
- [ ] 🔵 침해 대응 Runbook 작성 (감지 → 격리 → 평가 → 신고 → 통보 → 복구)
- [ ] 🔵 영향받은 개인에게 통보 템플릿 준비 (이메일/SMS)

---

## 05. 보안 / 인증 / 권한

### 인증
- [ ] 🔴 JWT Access Token + Refresh Token Rotation 구현
  - Access Token 만료: 15~60분
  - Refresh Token: DB 저장, 강제 만료 가능 (`token_blacklist` 또는 `refresh_tokens` 테이블)
- [ ] 🔴 비밀번호 Hashing — `bcrypt(cost ≥ 12)` 또는 `Argon2id`
  - MD5/SHA1/SHA256 단독 사용 **절대 금지**
- [ ] 🟠 MFA(다단계 인증) — Admin 계정 필수, 게스트 옵션
  - TOTP (Google Authenticator) 또는 이메일 OTP
- [ ] 🟠 비밀번호 정책 적용 (최소 12자, 대소문자+숫자+특수문자)
- [ ] 🔵 로그인 실패 5회 이상 시 계정 잠금 또는 CAPTCHA

### 권한 관리
- [ ] 🟠 RBAC 설계 — `roles` / `permissions` / `role_permissions` 테이블
  - Super Admin / Property Admin / Staff / Housekeeping / Readonly / Guest
  - 하드코딩된 `if(user.role === 'admin')` 패턴 금지
- [ ] 🔴 API 레벨 Tenant 소유권 검증 미들웨어
  - 모든 API에서 리소스의 `tenant_id` ↔ JWT `tenant_id` 자동 검증

### 인프라 보안
- [ ] 🔴 환경변수 / 시크릿 코드에서 완전 분리
  - `.env`를 git에 커밋 **절대 금지** — `.env.example`만 커밋
  - 프로덕션: AWS Secrets Manager / Parameter Store 사용
- [ ] 🟠 HTTPS 강제 + HSTS 헤더 (`max-age=31536000; includeSubDomains`)
- [ ] 🟠 CORS 정책 설정 (허용 도메인 화이트리스트)
- [ ] 🔵 SQL Injection 방지 — ORM Parameterized Query 사용 (Raw SQL 금지)
- [ ] 🔵 XSS 방지 — CSP(Content Security Policy) 헤더 설정

---

## 06. API 설계

### RESTful 규칙
- [ ] 🟠 HTTP 메서드/상태 코드 일관성
  - `200 OK`로 에러 응답하는 패턴 금지
  - `204 No Content`, `409 Conflict`, `422 Unprocessable Entity` 정확히 사용
- [ ] 🟠 페이지네이션 표준화 (Cursor 방식 또는 Offset — 전체 통일)
  - `?page=1&limit=20` 또는 `?cursor=xxx` — 혼용 금지
- [ ] 🔵 에러 응답 스키마 표준화 (RFC 7807 Problem Details)
  ```json
  { "type": "https://api.example.com/errors/not-found",
    "title": "Resource Not Found",
    "status": 404,
    "detail": "Booking ABC123 does not exist",
    "instance": "/api/v1/bookings/ABC123" }
  ```

### 버전 관리
- [ ] 🟠 API 버전 전략 확정 (`/api/v1/` URL prefix 방식 권장)
  - Header 버전 방식은 디버깅 어려움 — URL prefix가 명시적
- [ ] 🟢 Deprecation 정책 정의 (버전 유지 기간, `Sunset` 헤더)

### 문서화
- [ ] 🟠 OpenAPI 3.0 Spec 파일 존재 및 Swagger UI 자동 생성
  - `/api/docs` 접근 가능 — 개발팀 + 파트너 에이전트 연동 시 필수
- [ ] 🔵 Webhook 이벤트 발송 설계
  - `booking.confirmed`, `payment.received`, `contract.signed` 등
  - HMAC-SHA256 서명으로 수신자 검증

---

## 07. 사이트맵 / 정보 아키텍처

### 정보 구조
- [ ] 🟠 전체 사이트맵 문서화 완료
  - Admin Portal / Guest Portal / API Server 3포털 분리
  - 각 포털별 메뉴 트리, 권한 레이어, 데이터 흐름 다이어그램
- [ ] 🟠 URL 체계 확정 (`/api/v1/` RESTful 패턴)
- [ ] 🔵 각 모듈별 CRUD 화면 흐름도 (Booking, Contract, Invoice)
  - `List → Detail → Create/Edit → Confirm` 패턴 통일

### 사용자 흐름
- [ ] 🔵 User Journey Map 작성 (게스트 예약 → 결제 → 체크인)
- [ ] 🟠 Admin 권한 레벨별 접근 메뉴 매트릭스 정의
  - Super Admin / Property Admin / Staff / Readonly 최소 4단계
- [ ] 🟢 Breadcrumb 구조 설계 (깊이 3단계 이상 화면 대응)
- [ ] 🔵 글로벌 검색 / 필터 UX 설계 (날짜, 상태, 테넌트)

---

## 08. .NET 전환 준비

### 코드 구조
- [ ] 🔴 Repository Pattern 적용 — DB 접근 코드가 한 레이어에만 존재
  - 직접 SQL/ORM 쿼리가 여러 레이어에 산재하면 .NET EF Core 전환 시 전체 재작성
- [ ] 🟠 Clean Architecture 레이어 분리
  - `Domain / Application / Infrastructure / API` 4레이어
- [ ] 🟠 비즈니스 로직이 HTTP Handler/View에서 완전 분리
  - `Controller → Service → Repository` 3-tier 검증

### 데이터 타입 호환성
- [ ] 🔴 금액 필드 `DECIMAL(10,2)` 사용 (float/double 금지)
- [ ] 🟠 날짜/시간 UTC 저장 + 클라이언트 타임존 변환
  - DB: `TIMESTAMPTZ` (UTC) 저장
  - .NET: `DateTimeOffset` 호환
  - 호주 현지 시간: `Australia/Sydney` (AEST/AEDT) 변환은 프론트에서

### 의존성
- [ ] 🔵 Python/JS 전용 라이브러리 의존도 목록 작성 및 .NET 대체재 확인
  | 현재 (Python/JS) | .NET 대체재 |
  |---|---|
  | WeasyPrint | QuestPDF / iTextSharp |
  | Celery | Hangfire / MassTransit |
  | SendGrid SDK | SendGrid .NET SDK (공용) |
  | SQLAlchemy | EF Core |
  | Pillow | ImageSharp |

### 테스트 & 배포
- [ ] 🟠 비즈니스 로직 유닛 테스트가 DB 없이 실행 가능 (Mock 사용)
  - DB 의존 테스트는 .NET 전환 후 전부 재작성 필요
- [ ] 🔵 Docker Compose 기반 로컬 개발 환경 구성
  - .NET 컨테이너를 동일 Compose에 추가만 하면 됨

---

## 🏁 빠른 점검 — 지금 당장 확인할 Top 10

| # | 항목 | 위험 |
|---|------|------|
| 1 | 모든 테이블에 `tenant_id` FK 존재 | 누락 시 마이그레이션 비용 폭발 |
| 2 | 파일 저장소가 S3 호환인지 | 로컬 저장은 SaaS에서 절대 불가 |
| 3 | 금액 필드가 `DECIMAL(10,2)` | float 사용 시 인보이스 계산 오류 확정 |
| 4 | Presigned URL로만 파일 서빙 | 직접 S3 노출 = 데이터 침해 위험 |
| 5 | OpenAPI Spec 파일 존재 | 없으면 프론트 자동화 파이프라인 전부 수작업 |
| 6 | bcrypt(cost≥12) 비밀번호 저장 | MD5/SHA1이면 즉시 교체 필요 |
| 7 | Privacy Policy 게스트 포털 게시 | APP 1 위반 — OAIC 과태료 대상 |
| 8 | 여권 사본 목적 달성 후 파기 절차 | APP 11 위반 |
| 9 | 마케팅 동의와 예약 동의 분리 | APP 7 위반 — Spam Act 동시 위반 |
| 10 | Repository Pattern 레이어 분리 | 미적용 시 .NET 전환 = 전체 재작성 |

---

*문서 마지막 업데이트: 2025 | 법률 조항은 최신 OAIC 가이드라인 기준 — 실제 적용 시 법률 전문가 검토 권장*

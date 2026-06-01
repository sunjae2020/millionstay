# 제안서 — 문서 통합 관리 (Document Hub)

> 이메일·견적서·인보이스·영수증·계약서 등 모든 대외 문서를 한 곳에서 생성·편집·발송·보관하는 통합 메뉴
> 작성일: 2026-06-01 · 대상: MillionStay property-admin · 상태: **검토용 초안 (진행 여부 미정)**

---

## 1. 배경 및 목적

현재 MillionStay는 문서 관련 기능이 **여러 메뉴에 흩어져 있고, 발송 채널·디자인·보관이 일관되지 않습니다.**

- 인보이스는 Finance, 계약서는 Booking, 이메일 템플릿은 Settings에 각각 존재
- 견적서(Quote)·영수증 PDF 등 **고객에게 정식으로 나가는 서류 양식은 아직 없음**
- 이메일은 코드에 하드코딩된 HTML(`api-server/src/lib/email.ts`)로만 발송 — 운영자가 편집 불가
- **PDF 생성 기능이 전혀 없음** (서버에 PDF 라이브러리 미설치)

**목표:** 모든 대외 문서를 회사 디자인 가이드라인(로고·색상·폰트·자간·여백)에 맞춰 **일관되게 생성하고, 편집하고, 이메일/PDF로 발송하며, 법적 보존 정책에 따라 보관**하는 단일 허브를 만든다.

---

## 2. 현황 분석 — 이미 있는 것 vs 새로 만들 것

제안의 핵심은 **"무에서 만드는 것이 아니라, 흩어진 자산을 통합·확장"** 한다는 점입니다.

### 2.1 이미 존재하는 자산 (재사용)

| 영역 | 현황 | 위치 |
|------|------|------|
| 파일 저장 + 보존정책 | `documents` 테이블 (Cloudinary 서명 URL, APP 11 보존기한 자동 계산) | `lib/db/src/schema/documents.ts`, `lib/retention.ts` |
| 인보이스 | CRUD + 상태머신 + Stripe 결제 링크 | `finance/InvoiceList`, `InvoiceDetail`, `routes/invoices.ts` |
| 영수증 | 목록 화면 존재 (PDF/양식 없음) | `finance/ReceiptList` |
| 계약서 | CRUD + 서명/발송 상태, `terms_text`, `document_url` 필드 | `contracts/ContractDetail`, `routes/contracts.ts` |
| 이메일 발송 | Resend 연동, 브랜드 HTML(로고·오렌지), 발송 로그 | `lib/email.ts`, `email_log` 테이블 |
| 이메일 템플릿 | `email_template` 테이블 + Settings 관리 화면 | `settings/sub/EmailTemplates` |
| 다국어 | EN/KO/ZH/JA/TH (react-i18next) | `locales/*` |

### 2.2 빠져 있는 것 (신규 개발 대상)

1. **통합 진입점(메뉴)** — 문서를 유형 무관하게 한 화면에서 검색/필터/관리
2. **견적서(Quote) · 영수증 양식** — 정식 문서 타입 부재
3. **PDF 생성 엔진** — 서버에 PDF 라이브러리 없음 (가장 큰 신규 작업)
4. **운영자용 문서 편집기** — 내용 수정·미리보기 (현재 이메일은 코드 하드코딩)
5. **브랜드 디자인 토큰의 문서 적용** — 색상/폰트/자간/여백을 문서 양식에 일관 적용
6. **연계(linkage) 가시화** — "이 문서가 어느 예약/계약/고객과 연결됐는지"

---

## 3. 제안 개요

property-admin 사이드바에 **`Documents` (문서)** 신규 그룹을 추가하고, 그 안에 통합 허브와 유형별 화면을 둡니다.

```
📁 Documents (문서)              ← 신규 메뉴 그룹
   ├─ All Documents (전체)        ← 통합 목록: 유형·상태·연계 대상으로 검색/필터
   ├─ Quotes (견적서)             ← 신규
   ├─ Invoices (인보이스)         ← Finance에서 연결(딥링크 재사용)
   ├─ Receipts (영수증)           ← 양식·PDF 추가
   ├─ Contracts (계약서)          ← Booking에서 연결
   ├─ Emails (발송 이메일)         ← 발송 이력 + 재발송 + 템플릿
   └─ Templates (문서 템플릿)      ← 양식·이메일 템플릿 편집기 (디자인 가이드 적용)
```

> 기존 Finance/Booking 내 인보이스·계약서 화면은 **그대로 유지**하고, Document Hub는 이를 가로지르는(cross-cutting) 통합 뷰로 동작합니다. 중복 구현이 아니라 **단일 색인 + 공통 양식/발송 레이어**입니다.

---

## 4. 핵심 기능

### 4.1 문서 유형 (Document Types)

| 유형 | 형식 | 연계 대상 | 발송 |
|------|------|----------|------|
| 견적서 Quote | PDF / 이메일 | Lead, Account, Space | 이메일 첨부 + 링크 |
| 인보이스 Invoice | PDF / 이메일 | Booking, Contract, Account | 이메일 + Stripe 링크 |
| 영수증 Receipt | PDF / 이메일 | Invoice(결제완료) | 이메일 첨부 |
| 계약서 Contract | PDF / 이메일 | Booking, Tenant/Landlord, Space | 이메일 + (전자)서명 |
| 일반 이메일 | 이메일(HTML) | 모든 엔티티 | Resend |
| 기타 첨부 | PDF/이미지 업로드 | 모든 엔티티 | 보관/다운로드 |

### 4.2 생성 → 편집 → 미리보기 → 발송 워크플로우

1. **생성**: 연계 대상(예: 예약/리드)에서 "문서 생성" → 데이터 자동 채움(고객명·금액·기간 등)
2. **편집**: 운영자가 항목/문구/메모 수정 — 리치 편집 + 변수 토큰(`{{guest_name}}` 등) 지원
3. **미리보기**: 실제 브랜드 양식 그대로 렌더링(이메일 본문 / PDF 미리보기)
4. **발송**: 이메일(Resend) 또는 PDF 다운로드/첨부. 발송 시 `email_log` + `documents`에 자동 보관
5. **상태 추적**: Draft → Sent → Viewed/Paid/Signed (유형별 상태머신)
6. **버전·이력**: 발송본은 PDF 스냅샷으로 동결(immutable), 이후 수정은 새 버전으로 기록

### 4.3 연계(Linkage) 정보 — "어디에 연결돼 있나"

- 모든 문서는 `entity_type` + `entity_id`로 원천 레코드에 연결 (이미 `documents` 테이블 구조 존재)
- 문서 상세에서 **연결 칩(chip)** 제공: 예) `예약 #1234 · 고객 Jane Doe · 계약 MS-C-2026-0007`
- 역방향도 지원: 예약/계약/고객 상세 화면에 **"관련 문서" 탭** 추가 → 해당 엔티티의 모든 문서 표시
- 표준 참조번호 체계 유지: `MS-INV-YYYY-NNNNN`, `MS-QT-YYYY-NNNNN`, `MS-RCP-...`, `MS-C-...`

---

## 5. 디자인 가이드라인 적용 (요청 핵심 사항)

문서는 **2단계 브랜드 정체성** 중 **고객 대면(brand orange)** 라인을 따릅니다. property-admin은 운영 UI(딥 오렌지)지만, 고객에게 나가는 서류·이메일은 게스트 브랜드와 통일합니다.

### 5.1 문서용 디자인 토큰 (제안)

| 토큰 | 값 | 근거 |
|------|-----|------|
| Brand Primary | `#E8621A` (오렌지) | 현재 이메일 템플릿·게스트 포털 공통 |
| Primary (강조 hover) | `hsl(24 93% 53%)` ≈ `#F97316` | 게스트 포털 primary |
| 본문 텍스트 | `#111111` | 현 이메일 본문색 |
| 보조 텍스트 | `#555555` / `#999999` | 라벨·각주 |
| 배경/카드 | `#FFFFFF` 카드 + `#F9FAFB` 페이지 | 현 이메일 컨테이너 |
| 강조 박스 | 배경 `#FFF7F0`, 보더 `#FCD9B6` | 현 info-box |
| 폰트 | **Inter** (본문) · 비라틴 fallback Noto Sans JP/Thai/KR | 전 artifact 공통 |
| 참조번호 | monospace, letter-spacing `0.05em` | 현 ref-box 스타일 |
| 제목 자간 | 대문자 라벨 `letter-spacing 0.06–0.08em` | 현 섹션 헤더 |
| 본문 행간 | `1.5` 기준 | 가독성 |
| 모서리 radius | 문서 카드 `12–16px` | 게스트 톤(부드러움) |
| 여백 | 컨테이너 패딩 `32px`, 행 패딩 `8px`, 섹션 간 `20–24px` | 현 이메일 |
| 로고 | `EMAIL_LOGO_URL` 환경변수(현 사용) → 문서 공통 헤더 | `lib/email.ts` |

### 5.2 "단일 양식 원천(Single Template Source)" 원칙

이메일과 PDF가 **동일한 HTML/CSS 양식**을 공유하도록 설계합니다.

- 브랜드 토큰을 코드 한 곳(`packages/document-theme` 또는 공유 모듈)에 정의
- 이메일 발송 = 그 HTML을 Resend로 전송
- PDF = **동일 HTML을 헤드리스 렌더링 → PDF** (아래 6장)
- 결과: **색상·폰트·자간·여백을 한 번만 정의**하면 이메일/PDF가 자동 일치 → 디자인 드리프트 방지

> 참고: 디자인 토큰이 현재 5개 artifact에 중복 정의돼 있어(`design-tokens.md` §1), 이 작업을 공유 테마 추출(Phase 2 계획)과 함께 진행하면 일석이조입니다.

---

## 6. 기술 아키텍처

### 6.1 PDF 생성 방식 (의사결정 필요)

| 옵션 | 장점 | 단점 | 권장 |
|------|------|------|------|
| **A. Puppeteer/Playwright (헤드리스 Chrome, 서버)** | HTML/CSS 양식 그대로 픽셀 일치, 이메일과 단일 원천 | Chromium ~300MB, Railway 빌드/메모리 부담 | ⭐ **권장** |
| B. `@react-pdf/renderer` | 브라우저 불필요, 가벼움 | 별도 컴포넌트 스타일 — 이메일 HTML 재사용 불가, 디자인 이원화 | △ |
| C. 클라이언트 `window.print()` (`@media print`) | 백엔드 0, 즉시 가능 | 보관용 PDF 파일 생성·이메일 첨부 불가 | 단기 보조 |

권장: **A안**. 단일 양식 원천 원칙(5.2)과 가장 잘 맞음. Railway 메모리 제약이 우려되면 PDF 변환만 별도 경량 서비스/HTML-to-PDF API로 분리 가능.

### 6.2 데이터 모델 (신규/확장)

```
documents (확장)               ← 이미 존재. 발송본 PDF 스냅샷 보관에 그대로 사용
  + status, version, doc_ref, rendered_at 등 컬럼 보강 검토

document_templates (신규)       ← 양식/이메일 템플릿 (HTML + 변수 정의 + 브랜드 변형)
  - template_code, doc_type, subject, body_html, available_vars(jsonb),
    is_active, language, deleted_at ...   (email_template 구조 확장·통합)

quotes (신규)                   ← 견적서 헤더 + 라인아이템
  + quote_line_items
  (invoices / contract_line_items 패턴 재사용)
```

> `email_template`(이미 존재)과 `document_templates`를 하나로 통합할지, 별도로 둘지는 설계 시 결정. 이메일도 "문서의 한 형식"으로 보면 통합이 자연스럽습니다.

### 6.3 API (Express, `/api/v1/`)

- `routes/documents.ts` (신규) — 통합 목록/검색/연계
- `routes/quotes.ts` (신규)
- `routes/templates.ts` — `email-templates.ts` 확장/통합
- `lib/pdf.ts` (신규) — `renderHtmlToPdf(html)` + Cloudinary 업로드(서명 URL)
- `lib/documentRenderer.ts` (신규) — 브랜드 양식 + 변수 치환(단일 원천)

기존 패턴 준수: Zod 검증(`@workspace/api-zod`), `enrichXxx()`, 상태 전이 POST 엔드포인트, 표준 참조번호.

---

## 7. 단계별 로드맵

| 단계 | 범위 | 산출물 |
|------|------|--------|
| **Phase 0 — 설계 확정** | PDF 방식·데이터 모델·템플릿 통합 여부 결정 | 확정 설계 문서 |
| **Phase 1 — 양식 엔진 + 디자인 토큰** | 단일 양식 원천(HTML/CSS) + PDF 렌더러 + 브랜드 토큰 모듈 | 인보이스 PDF 1종 end-to-end |
| **Phase 2 — Document Hub UI** | `Documents` 메뉴 + 통합 목록/필터/연계 칩 + 엔티티별 "관련 문서" 탭 | 통합 화면 |
| **Phase 3 — 편집기 + 신규 유형** | 운영자 편집/미리보기 + 견적서·영수증 양식 + 템플릿 편집기 | 전체 문서 유형 |
| **Phase 4 — 발송·이력·다국어** | 이메일/PDF 발송, 버전 동결, 발송 로그 연계, EN/KO/ZH/JA/TH | 운영 투입 |

각 Phase는 독립 배포 가능하며, Phase 1만으로도 "인보이스 PDF 발송"이라는 즉시 가치를 냅니다.

---

## 8. 범위 외 / 리스크

- **전자서명 법적 효력**: 계약서 e-sign은 별도 검토(외부 서비스 연동 가능성). 본 제안은 "서명란 포함 PDF + 서명 상태 추적"까지를 기본 범위로 함.
- **Railway 리소스**: Puppeteer 채택 시 메모리·빌드시간 증가 → Phase 1에서 실측 후 분리 여부 판단.
- **보존·개인정보**: 발송본은 민감정보 포함 → 기존 `documents` 보존정책(세금계산서/영수증 5년, 계약서 7년) 및 Cloudinary 서명 URL 그대로 적용.
- **다국어 양식**: 5개 언어 양식 유지보수 부담 → 변수/레이아웃은 공유, 문구만 언어별 분리.

---

## 9. 결정 사항

**확정됨 (2026-06-01):**

1. ✅ **PDF 생성 방식**: **A안 — Puppeteer (헤드리스 Chrome)**. "단일 양식 원천" 원칙대로 이메일과 동일 HTML/CSS를 PDF로 렌더링.
2. ✅ **대상 문서 유형**: **인보이스 · 견적서 · 영수증 · 계약서 4종 전체** (Phase별 순차 구현 — 6.x 참고).

**아직 미정 (Phase 0에서 확정):**

3. **이메일 템플릿 통합 여부**: 기존 `email_template`을 `document_templates`로 통합할지
4. **편집 수준**: 단순 변수 치환만 / 리치 텍스트 자유 편집까지
5. **언어 범위**: 5개 전 언어 동시 / EN+KO 우선

**확정 결정에 따른 Phase 순서 (4종 전체 대상):**

| 단계 | 문서 | 비고 |
|------|------|------|
| Phase 1 | 인보이스 PDF | 데이터·화면 존재 → 양식+PDF 엔진만, 즉시 가치 |
| Phase 2 | 영수증 | 결제완료 인보이스에서 자동 생성 (인보이스 양식 재사용) |
| Phase 3 | 견적서 | 신규 양식 + `quotes` 데이터 모델 |
| Phase 4 | 계약서 | 서명란 포함 PDF + 발송/서명 상태 추적 |

---

## 10. 요약

- 백엔드 자산(문서 저장·보존, 인보이스/계약/이메일)은 **이미 상당 부분 존재** → 통합·확장 중심
- 신규 핵심은 **① PDF 엔진, ② 통합 메뉴 UI, ③ 편집기, ④ 견적/영수증 양식, ⑤ 브랜드 디자인 토큰 적용**
- 설계 원칙은 **"단일 양식 원천"** — 이메일·PDF가 색상·폰트·자간·여백을 한 번만 정의하고 공유
- Phase 1만으로 "브랜드 인보이스 PDF 발송"의 즉시 가치 확보 가능

> **다음 단계:** 위 9장의 결정 사항에 회신해 주시면, 확정 설계와 Phase 1 작업 계획(파일 단위)을 작성하겠습니다.

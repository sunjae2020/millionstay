# 이메일 템플릿 체계 — 설계 정본

> **범위**: 1차 = **Metheim 인스턴스 전용**(한국어 우선, 여수 임대 운영 기준).
> 2차 = 동일 체계를 MillionStay 본체에 적용.
> **정본**: 이 문서가 키·카테고리·그룹·로케일 규칙의 단일 소스입니다.
> 문서 파일명 규칙은 [DOCUMENT_NAMING_RULE.md](DOCUMENT_NAMING_RULE.md), 문서 미리보기 규칙은
> CLAUDE.md 의 `DocumentPreviewDialog` 항목을 따릅니다.

---

## 0. 현재 상태 (2026-08-04 조사)

### 이미 있는 것

| 자산 | 위치 | 상태 |
|---|---|---|
| 템플릿 레지스트리 | `document_templates` (kind/key/name/description/category/variables_schema/status) | 운영 중 |
| 다국어 저장 | `document_template_translations` (template_id/locale/subject/body_html) | 운영 중 |
| 해석 엔진 | [templateEngine.ts](../artifacts/api-server/src/lib/documents/templateEngine.ts) `resolveTemplate()` — 요청 locale → `en` → 첫 행 폴백, `publishedOnly` | 운영 중 |
| 관리 UI | Settings → Documents → Templates ([DocumentTemplates.tsx](../artifacts/property-admin/src/pages/settings/sub/DocumentTemplates.tsx)) | 운영 중 |
| Metheim 시드 | [seed-metheim-document-templates.mjs](../artifacts/api-server/scripts/seed-metheim-document-templates.mjs) — ko/en/ja/zh/th/vi 6개국어, `DEFAULT_DOC_LANG=ko` | 운영 중 |
| 문서 테마 토큰 | [theme.ts](../artifacts/api-server/src/lib/documents/theme.ts) `DOC_TOKENS` — `DOC_*` env 로 테넌트 재테마 | 운영 중 |
| 발신자 해석 | [email.ts](../artifacts/api-server/src/lib/email.ts) `emailSender()` — `EMAIL_FROM` 매 발송 시 읽기, free-mail 도메인 폴백 | 운영 중 |

### 브랜딩 — 이미 해결되어 있음 (`origin/main`)

| 자산 | 위치 | 상태 |
|---|---|---|
| 브랜드 해석 | `lib/emailBrand.ts` `resolveEmailBrand()` — `company_info` 우선, `DOC_*` env 폴백, 매 발송 해석 | main `684bd7e` |
| 공용 셸 | 동 파일 `renderEmailShell({brand, body, tag?, footerLines?, …})` — 로고 헤더·강조색·법인 푸터 소유 | main `684bd7e` |
| SVG 로고 대응 | `rasterLogoUrl()` — Cloudinary SVG → `f_png,h_96,c_fit` 래스터화 | main |

`main` 의 `email.ts` 는 `renderEmailShell` 을 **11회** 호출하고, 하드코딩 `<!DOCTYPE html>` 은 **0건**,
`alt="MillionStay"` 리터럴도 **0건**이다. 즉 **테넌트 상호·로고·색·법인 푸터는 이미 자동 적용된다.**

> ⚠️ **작업 브랜치 주의**: 현재 체크아웃된 `fix/onboarding-flow-bugs` 는 `origin/main` 보다
> **138 커밋 뒤처져 있고** `emailBrand.ts` 자체가 없다. 이 브랜치에서 조사하면 "브랜딩이 안 되어
> 있다"는 **잘못된 결론**이 나온다(실제로 이 문서 초안이 그렇게 작성됐다가 정정됐다).
> **이 작업은 `origin/main` 에서 딴 워크트리에서 진행한다.**

**결론: Phase A(공용 셸 신설)는 불필요하다.** 템플릿 작성이 곧바로 1순위다.

---

## 1. 네이밍 규칙

### 1.1 결정 — `<domain>.<event>`

```
tenancy.movein_info
billing.rent_overdue_1
cs.ticket_resolved
```

- **소문자 snake_case, 점(`.`) 1개로 도메인과 이벤트 구분.** 점은 1회만 — 3단계 금지.
- `document_templates` 의 유니크 인덱스는 **`(kind, key)`** 이므로 **키에 kind 를 넣지 않는다.**
  같은 이벤트의 이메일 본문과 PDF 푸터는 `kind` 로 갈리고 키는 같다.

### 1.2 기존 키 처리 — 리네임하지 않는다

| 기존 키 | kind | 판정 |
|---|---|---|
| `homestay.host_received` 외 6개 | email | ✅ 새 규칙과 이미 일치 — 그대로 |
| `homestay_placement_terms` | contract | ⚠️ 점 없음. 코드 배선 + 프로드 시드 존재 → **유지**, 신규만 규칙 적용 |
| `email.invoice` / `email.receipt` / `email.contract` | email | ⚠️ kind 중복 접두사. **유지**(코드 배선 + 양 DB 시드) |
| `pdf.invoice` / `pdf.receipt` / `pdf.quote` / `pdf.tenancy_agreement` / `pdf.move_out_confirmation` / `pdf.homestay_placement_agreement` | pdf | ⚠️ 동일. **유지** |
| `contract.terms` | contract | ✅ 규칙 일치 |

**이유**: `key` 는 유니크 인덱스이자 테넌트 오버라이드·코드 호출부의 매칭 축이다. 이름을 바꾸면
프로덕션에 이미 published 된 행이 고아가 되어 **조용히 기본 문안으로 되돌아간다**(에러 없이).
신규 문안 유실 위험이 통일성 이득보다 크다. 대신 **group/category 재분류로 목록상 정렬을 잡는다.**

> 기존 `email.*` / `pdf.*` 접두사는 **레거시 예외 8건으로 동결**한다. 신규 키에는 절대 쓰지 않는다.

### 1.3 도메인 목록 (Metheim)

| domain | 뜻 | 주 수신자 |
|---|---|---|
| `account` | 계정·인증·보안 | 전원 (공통) |
| `doc` | 문서 커버 메일 (청구서·영수증·견적·계약서 첨부) | 전원 (공통) |
| `marketing` | 마케팅·프로모션 | 리드·고객 |
| `lead` | 문의 접수·상담 | 리드 |
| `sale` | 분양/판매 문의 | 매수 문의자 |
| `booking` | 단기 예약 | 게스트 |
| `application` | 신청서 접수·심사 | 신청자 |
| `contract` | 계약 체결·서명 | 세입자·게스트 |
| `tenancy` | 입주·거주·갱신·퇴거 | 세입자 |
| `billing` | 청구·수납·미납·환불 | 세입자·게스트 |
| `inspection` | 세대 점검·하자 | 세입자·호스트 |
| `appointment` | 방문·상담 약속 | 전원 |
| `cs` | 고객·파트너 문의 티켓 | 전원 |
| `survey` | 만족도·중간 점검 | 고객·파트너 |
| `owner` | 소유주 리포트·정산 | 소유주 |
| `agent` | 에이전트 파트너 | 에이전트 |
| `host` | 서비스 호스트 (청소·기사) | 서비스 호스트 |
| `staff` | 내부 직원 알림 | 직원 |

---

## 2. 카테고리 / 그룹 체계

### 2.1 결정 — `category` = **수신자 그룹**, 공통 그룹은 **분리한다**

`key` 가 이미 **업무 도메인**을 담으므로, `category` 는 다른 축인 **"누가 받는가"** 를 담아야
Studio 목록이 두 축으로 탐색된다. 같은 축을 두 번 쓰면 정보가 0이다.

| category (저장 slug) | 한국어 라벨 | 대상 |
|---|---|---|
| `common` | 공통 | 전 수신자 공용 — 계정/인증, 문서 커버 메일 |
| `customer` | 고객·세입자 | 게스트, 세입자, 신청자 (B2C) |
| `owner` | 소유주 | 임대인/건물주 |
| `partner` | 파트너 | 부동산·여행 에이전트, 학교, 회사 (B2B) |
| `host` | 서비스 호스트 | 청소·기사·정비 |
| `staff` | 내부 직원 | 테넌트 직원 |
| `marketing` | 마케팅 | 마케팅·세일즈 캠페인 (동의 필요) |

### 2.2 공통 그룹을 왜 분리하는가

`account.password_reset` · `doc.invoice` 같은 템플릿은 **세입자·소유주·에이전트·호스트가 전부 같은
문안을 받는다.** 수신자별로 쪼개면 같은 문장을 5벌 유지해야 하고, 하나만 고치면 나머지 4벌이
조용히 낡는다. **공통은 `common` 한 벌로 두고, 수신자별 차이가 실제로 있을 때만 분리한다.**

분리 판단 기준 — 아래 중 하나라도 해당하면 수신자별 별도 키:
1. 호칭·격식이 다르다 (세입자 "고객님" vs 파트너 "담당자님")
2. 담긴 데이터가 다르다 (고객=내 계약 / 소유주=세대별 수익)
3. 법적 고지가 다르다 (마케팅 수신동의는 B2C 만 필수)

### 2.3 스키마·UI 변경

- `category` 컬럼에 **영문 slug 를 저장**하고 화면 라벨은 admin i18n 으로 번역한다.
  현재는 표시 문자열이 그대로 들어가 있어 **base 시드는 `"Documents"`, Metheim 시드는 `"문서"`** 로
  드리프트했다 ([seed-metheim…mjs:212](../artifacts/api-server/scripts/seed-metheim-document-templates.mjs#L212)).
  → 마이그레이션으로 기존 값 정규화: `Documents`/`문서` → `common`, `Homestay` → `customer`.
- Studio 목록은 category 그룹 헤더 + 키의 domain 을 서브 라벨로 표시한다. **컬럼 추가 불필요.**

---

## 3. 로케일

**`ko, en, ja, zh, th, vi` 6종** — Metheim 시드의 기존 결정을 그대로 따른다.
`zh-TW` 는 Metheim 미지원(문서 채널에 없음). 기본 = `ko` (`DEFAULT_DOC_LANG=ko`).

### 3.1 작성 원칙 — 기계번역 금지

- **`ko` 가 원본**이다. Metheim 은 한국 법인·한국 고객 기준이므로 한국어로 먼저 쓰고 나머지를 옮긴다
  (MillionStay 본체 적용 시에는 `en` 이 원본).
- **한국어 본문은 `humanize-korean` 스킬을 통과시킨다.** 기존 임대차 약관 본문이 이미
  run 2026-07-27-001 (grade A) 로 처리되어 있고, 같은 문서군 안에서 문체가 튀면 안 된다.
- 나머지 5개 로케일은 **번역투를 남기지 않는다.** 한국어 문장을 직역하지 말고 해당 언어 사용자가
  실제로 받는 안내문처럼 다시 쓴다. 특히:
  - `ja` — 「〜いたします」체 유지, 한국식 한자어 직수입 금지
  - `zh` — 간체, 부동산 용어는 중국 본토 통용어(押金/租金)
  - `th` — 격식체(ครับ/ค่ะ 미사용, 공지문체)
  - `vi` — 존칭 Quý khách, 임대 용어는 tiền cọc/tiền thuê
- 미작성 로케일은 `en` 으로 폴백되므로 **발송이 깨지지는 않는다.** 다만 published 상태에서
  빈 로케일을 남기지 않는다.

---

## 4. 테넌트 브랜딩 — 기존 `emailBrand.ts` 를 그대로 쓴다

셸은 이미 있다(§0). 템플릿 작성자가 지켜야 할 것은 **본문에 브랜드를 넣지 않는 것**뿐이다.

| 요소 | 소스 | 템플릿이 할 일 |
|---|---|---|
| 상호·법인명·주소·문의메일 | `company_info` (Settings → Organisation) | 아무것도 안 함 — 셸이 헤더/푸터에 넣음 |
| 로고 | `company_info.logoUrl` → `rasterLogoUrl()` | 아무것도 안 함 |
| 강조색·배경·라운드 | `DOC_TOKENS` (`DOC_*` env; Metheim = Urban Teal) | 아무것도 안 함 |
| 폰트 | `DOC_TOKENS.font` (Inter → Noto Sans KR/JP/SC/TC/Thai) | 아무것도 안 함 |
| 제목의 브랜드명 | i18n `email.subject` 의 `{brand}` 파라미터 | `{{brand}}` 변수로만 참조 |

**템플릿 본문 금지사항**
- `<!DOCTYPE html>` / `<style>` / `<table>` 레이아웃 — 본문은 **카드 안쪽 조각**이다
- 색상 리터럴 (`#E8621A` 등), 로고 `<img>`, 문자열 `"MillionStay"` / `"Metheim"`
- 인라인 폰트 지정

**허용 태그**: `<p> <b> <strong> <em> <ul> <ol> <li> <a> <br> <h2>` + `{{변수}}`

**허용 클래스** — 셸(`shellStyles()`)이 제공하므로 인라인 style 대신 이걸 쓴다:

| 클래스 | 용도 |
|---|---|
| `<p class="lead">` | 첫 인사 문장 (16px, 진한 잉크) |
| `<div class="box">` + `.label` `.ref` `.amount` | 참조번호·금액 강조 박스 |
| `<a class="btn">` | 주 CTA 버튼 (브랜드색 배경) |
| `<p class="muted">` | 보조 안내·주의 문구 |
| `<table class="kv">` + `<td class="k">` | 라벨-값 2열 표 (예약 상세, 정산 내역) |

> 로고가 SVG 인 테넌트는 Cloudinary 호스팅이어야 `rasterLogoUrl()` 이 PNG 로 변환한다.
> 다른 호스트의 SVG 는 변환 불가 → Gmail/Outlook 에서 렌더되지 않으니 PNG 로 올릴 것.

---

## 5. 템플릿 카탈로그 (Metheim)

`kind=email` 기준. **✅ = 이미 존재 · 🔧 = 코드에 하드코딩되어 있어 템플릿화 필요 · ➕ = 신규**

### 5.1 `common` — 공통 (전 수신자)

| key | 발송 시점 | 상태 |
|---|---|---|
| `account.password_reset` | 비밀번호 재설정 요청 | 🔧 `sendPasswordResetEmail()` |
| `account.welcome` | 계정 생성 완료 | ➕ |
| `account.email_verify` | 이메일 인증 | ➕ |
| `account.login_new_device` | 새 기기 로그인 알림 | ➕ |
| `account.registration_request` | 가입 요청 접수(관리자 알림) | 🔧 `sendRegistrationRequestEmail()` |
| `account.privacy_update` | 개인정보처리방침·약관 변경 고지 | ➕ |
| `email.invoice` | 청구서 첨부 커버 | ✅ 레거시 키 유지 |
| `email.receipt` | 영수증 첨부 커버 | ✅ 레거시 키 유지 |
| `email.contract` | 계약서 첨부 커버 | ✅ 레거시 키 유지 |
| `doc.quote` | 견적서 첨부 커버 | ➕ |
| `doc.statement` | 거래명세서·정산서 커버 | ➕ |
| `doc.generic` | 기타 문서 첨부 커버 | ➕ |

> ⚠️ 청구서·영수증·계약서 커버는 **`doc.*` 로 새로 만들지 말 것.** 이미 `email.*` 로 코드에 배선돼
> 있고 양 DB 에 published 되어 있다(§1.2 동결 목록). 신규 커버만 `doc.*` 를 쓴다.
| `appointment.confirmed` | 약속 확정 (+.ics) | 🔧 `sendAppointmentConfirmationEmail()` |
| `appointment.reminder` | 약속 24시간 전 | ➕ |
| `appointment.rescheduled` | 약속 변경 | ➕ |
| `appointment.cancelled` | 약속 취소 | ➕ |

### 5.2 `customer` — 고객·세입자 (B2C)

**마케팅 · 세일즈**

| key | 발송 시점 | 상태 |
|---|---|---|
| `lead.enquiry_received` | 홈페이지 문의 접수 확인(문의자에게) | ➕ |
| `lead.consultation_booked` | 상담 예약 확정 | ➕ |
| `lead.consultation_reminder` | 상담 전일 | ➕ |
| `lead.followup` | 미응답 리드 3일 후 | ➕ |
| `sale.inquiry_received` | 분양/판매 1차 문의 접수 | ➕ |
| `sale.inquiry_reply` | 담당자 회신 | ➕ |
| `sale.brochure_sent` | 자료·도면 발송 | ➕ |

**신청서 접수**

| key | 발송 시점 | 상태 |
|---|---|---|
| `application.received` | 신청서 제출 접수 확인 | 🔧 `sendApplicationAckEmail()` |
| `application.incomplete` | 필수 항목·서류 누락 | ➕ |
| `application.document_request` | 특정 서류 요청 (신분증·재직증명 등) | ➕ |
| `application.document_received` | 서류 접수 완료 | ➕ |
| `application.document_rejected` | 서류 반려 — 재제출 요청 | ➕ |
| `application.under_review` | 심사 착수 | ➕ |
| `application.approved` | 승인 | ➕ |
| `application.rejected` | 반려 | ➕ |
| `application.withdrawn` | 신청 취소 확인 | ➕ |

**예약 (단기)**

| key | 발송 시점 | 상태 |
|---|---|---|
| `booking.confirmed` | 예약 확정 | 🔧 `sendBookingConfirmation()` |
| `booking.modified` | 예약 변경 | ➕ |
| `booking.cancelled` | 예약 취소 + 환불 규정 | ➕ |
| `booking.checkin_guide` | 체크인 3일 전 안내 (주소·비밀번호·교통) | ➕ |
| `booking.checkout_guide` | 체크아웃 전일 안내 | ➕ |

**계약**

| key | 발송 시점 | 상태 |
|---|---|---|
| `contract.signature_request` | 전자서명 요청 링크 | ➕ |
| `contract.signature_reminder` | 미서명 2일·5일 후 | ➕ |
| `contract.signed_copy` | 서명 완료 — 쌍방 서명본 송부 | ➕ |
| `contract.countersigned` | 회사 날인 완료 | ➕ |
| `contract.renewal_offer` | 갱신 안내 (만료 60일 전) | ➕ |
| `contract.terminated` | 해지 확인 | ➕ |

**입주 · 거주 · 퇴거**

| key | 발송 시점 | 상태 |
|---|---|---|
| `tenancy.movein_info` | 입주 안내 (열쇠·주소·관리규정) | ➕ |
| `tenancy.movein_checklist` | 입주 점검표 서명 요청 | 🔧 `sendInspectionSignLinkEmail()` |
| `tenancy.movein_confirmed` | 입주 확정 — 최종 배치 확인 | ➕ |
| `tenancy.house_rules` | 입주 수칙·생활 안내 | ➕ |
| `tenancy.midterm_checkin` | 거주 중간 점검 안내 | ➕ |
| `tenancy.maintenance_notice` | 공용부 공사·정전·단수 공지 | ➕ |
| `tenancy.inspection_notice` | 정기 점검 방문 통지 | ➕ |
| `tenancy.moveout_notice` | 퇴거 절차 안내 | ➕ |
| `tenancy.moveout_checklist` | 퇴거 점검표 서명 요청 | ➕ |
| `tenancy.moveout_settlement` | 보증금 정산 내역서 | ➕ |
| `tenancy.moveout_completed` | 퇴거 확정 — 세대 확인서 | ➕ |

**청구 · 수납**

| key | 발송 시점 | 상태 |
|---|---|---|
| `billing.invoice_issued` | 청구서 발행 | ➕ |
| `billing.rent_due` | 월세 납부 3일 전 | ➕ |
| `billing.rent_overdue_1` | 연체 1차 (3일) | ➕ |
| `billing.rent_overdue_2` | 연체 2차 (10일) | ➕ |
| `billing.rent_overdue_3` | 연체 3차 — 최고장 (30일) | ➕ |
| `billing.payment_received` | 입금 확인 | ➕ |
| `billing.payment_failed` | 자동이체 실패 | ➕ |
| `billing.refund_issued` | 환불 처리 완료 | ➕ |
| `billing.deposit_received` | 보증금 수납 확인 | ➕ |
| `billing.fee_change` | 요금 변경 고지 | ➕ |

**CS**

| key | 발송 시점 | 상태 |
|---|---|---|
| `cs.ticket_received` | 문의 접수 — 접수번호 자동 회신 | ➕ |
| `cs.ticket_assigned` | 담당자 배정 | ➕ |
| `cs.ticket_update` | 진행 상황 업데이트 | ➕ |
| `cs.info_needed` | 고객 회신 대기 | ➕ |
| `cs.ticket_escalated` | 상급자 이관 | ➕ |
| `cs.ticket_resolved` | 처리 완료 — 조치 내역 | ➕ |
| `cs.ticket_closed` | 종결 + 재문의 안내 | ➕ |
| `cs.sla_apology` | 응답 지연 사과 | ➕ |

**서비스 리포트 · 만족도**

| key | 발송 시점 | 상태 |
|---|---|---|
| `inspection.report_sent` | 세대 점검 결과 리포트 | ➕ |
| `inspection.defect_registered` | 하자 접수 확인 | ➕ |
| `inspection.defect_resolved` | 하자 처리 완료 | ➕ |
| `survey.service_csat` | 입주 7일 후 만족도 | ➕ |
| `survey.midterm` | 거주 중간 만족도 | ➕ |
| `survey.exit` | 퇴거 시 만족도 | ➕ |
| `survey.reminder` | 미응답 5일 후 | ➕ |
| `survey.review_request` | 긍정 응답자 리뷰 요청 | ➕ |

### 5.3 `owner` — 소유주

| key | 발송 시점 | 상태 |
|---|---|---|
| `owner.portal_welcome` | 소유주 포털 계정 개설 | ➕ |
| `owner.monthly_report` | 월간 임대·수익 리포트 | ➕ |
| `owner.settlement_statement` | 월 정산서 송부 | ➕ |
| `owner.payout_sent` | 정산금 지급 완료 | ➕ |
| `owner.vacancy_alert` | 공실 발생 알림 | ➕ |
| `owner.new_tenancy` | 신규 임차 계약 체결 보고 | ➕ |
| `owner.tenancy_ending` | 계약 만료 예정 보고 | ➕ |
| `owner.maintenance_approval` | 수선비 집행 승인 요청 | ➕ |
| `owner.inspection_report` | 세대 점검 결과 공유 | ➕ |
| `owner.annual_statement` | 연간 수익·비용 명세 | ➕ |

### 5.4 `partner` — 에이전트 · 학교 · 기업 (B2B)

| key | 발송 시점 | 상태 |
|---|---|---|
| `agent.application_received` | 파트너 가입 신청 접수 | ➕ |
| `agent.approved` | 파트너 승인 + 포털 안내 | ➕ |
| `agent.rejected` | 파트너 신청 반려 | ➕ |
| `agent.agreement_sent` | 제휴 계약서 서명 요청 | ➕ |
| `agent.portal_welcome` | 포털 사용 안내 | ➕ |
| `agent.referral_received` | 고객 소개 접수 | ➕ |
| `agent.referral_status` | 소개 건 진행 상태 변경 | ➕ |
| `agent.contract_confirmed` | 소개 건 계약 체결 — 최종 배치 확인 | ➕ |
| `agent.commission_statement` | 월 수수료 명세서 | ➕ |
| `agent.commission_paid` | 수수료 지급 완료 | ➕ |
| `agent.inventory_update` | 신규 매물·공실 안내 | ➕ |
| `agent.quarterly_review` | 분기 실적 리뷰 안내 | ➕ |
| `agent.inactive` | 90일 무실적 — 재활성 안내 | ➕ |
| `agent.agreement_renewal` | 제휴 계약 갱신 | ➕ |
| `cs.partner_ticket_received` | 파트너 문의 접수 | ➕ |
| `cs.partner_ticket_resolved` | 파트너 문의 처리 완료 | ➕ |
| `survey.partner_csat` | 파트너 만족도 | ➕ |

### 5.5 `host` — 서비스 호스트 (청소·기사·정비)

| key | 발송 시점 | 상태 |
|---|---|---|
| `host.application_received` | 호스트 지원 접수 | 🔧 `sendHomestayHostEmail()` |
| `host.approved` | 승인 + 포털 안내 | 🔧 동일 |
| `host.rejected` | 반려 | 🔧 동일 |
| `host.docs_requested` | 서류 요청 (신분증·보험·자격) | 🔧 동일 |
| `host.job_assigned` | 작업 지시 배정 | ➕ |
| `host.job_reminder` | 작업 전일 리마인더 | ➕ |
| `host.job_changed` | 일정·내용 변경 | ➕ |
| `host.job_cancelled` | 작업 취소 | ➕ |
| `host.job_overdue` | 기한 초과 경고 | ➕ |
| `host.report_required` | 완료 보고·사진 제출 요청 | ➕ |
| `host.report_accepted` | 작업 완료 승인 | ➕ |
| `host.settlement_statement` | 월 정산 명세서 | ➕ |
| `host.payout_sent` | 정산금 지급 완료 | ➕ |
| `survey.host_csat` | 호스트 만족도 | ➕ |

### 5.6 `staff` — 내부 직원

| key | 발송 시점 | 상태 |
|---|---|---|
| `staff.invitation` | 직원 초대 | ➕ |
| `staff.welcome` | 최초 로그인 온보딩 | ➕ |
| `staff.role_changed` | 권한 변경 | ➕ |
| `staff.offboarding` | 접근 해제·인수인계 | ➕ |
| `staff.lead_assigned` | 신규 리드 배정 | ➕ |
| `staff.application_assigned` | 신청서 배정 | ➕ |
| `staff.task_assigned` | 업무 배정 | ➕ |
| `staff.task_overdue` | 기한 초과 업무 | ➕ |
| `staff.cs_ticket_assigned` | CS 티켓 배정 | ➕ |
| `staff.cs_sla_breach` | SLA 임박·초과 | ➕ |
| `staff.approval_request` | 승인 요청 (할인·환불·수선비) | ➕ |
| `staff.approval_decision` | 승인 결과 | ➕ |
| `staff.payment_received` | 담당 계약 입금 발생 | ➕ |
| `staff.overdue_digest` | 미납 현황 일일 요약 | ➕ |
| `staff.daily_digest` | 오늘 일정·업무 요약 | ➕ |
| `staff.weekly_report` | 주간 실적 요약 | ➕ |
| `staff.monthly_kpi` | 월간 KPI | ➕ |
| `staff.inspection_due` | 점검 예정 세대 | ➕ |
| `staff.contract_expiring` | 만료 임박 계약 | ➕ |
| `staff.system_alert` | 잡 실패·연동 오류 | ➕ |

### 5.7 `marketing` — 마케팅 (수신동의 필수)

| key | 발송 시점 | 상태 |
|---|---|---|
| `marketing.campaign` | 일반 캠페인 발송 | 🔧 `sendMarketingEmail()` |
| `marketing.newsletter` | 정기 뉴스레터 | ➕ |
| `marketing.promotion` | 프로모션·할인 | ➕ |
| `marketing.new_listing` | 신규 매물 안내 | ➕ |
| `marketing.seasonal` | 시즌 캠페인 | ➕ |
| `marketing.event_invite` | 설명회·행사 초대 | ➕ |
| `marketing.reengagement` | 휴면 고객 재활성 | ➕ |
| `marketing.referral_invite` | 추천 프로그램 안내 | ➕ |

### 5.8 집계

| category | 템플릿 수 |
|---|---|
| `common` | 16 |
| `customer` | 62 |
| `owner` | 10 |
| `partner` | 17 |
| `host` | 14 |
| `staff` | 20 |
| `marketing` | 8 |
| **합계** | **147** |

× 6 로케일 = **882 개 번역 행.**

---

## 6. 마케팅 메일 필수 요건 (한국 법령)

`marketing` 카테고리 + `survey.review_request` 는 「정보통신망법」 제50조 대상:

- 제목 머리에 **`(광고)`** 표기
- 본문에 **수신거부 방법**과 링크
- **수신동의 시점·출처** 명시 (예: "2026년 3월 12일 회원가입 시 수신에 동의하셨습니다")
- 발신자 상호·주소·연락처 (`company_info` 에서 자동)
- 야간(21시–08시) 발송 시 **사전 별도 동의** 필요 → 스케줄러에서 차단

이 4개 요소는 `renderEmailShell()` 이 `category==='marketing'` 일 때 자동 삽입한다.
**본문 템플릿에 손으로 적지 않는다.**

---

## 7. PDF · 계약서 동시 검토 결과

`document_templates` 는 `kind` 로 email / pdf / contract 를 한 테이블에 담는다. 위 이메일 카탈로그와
**짝이 되는 문서 템플릿**을 함께 정리한다.

### 7.1 현재 PDF/계약 템플릿

| kind | key | 문서 | 3자리 코드 |
|---|---|---|---|
| pdf | `pdf.invoice` | 청구서 | `INV` |
| pdf | `pdf.receipt` | 영수증 | `RCP` |
| pdf | `pdf.quote` | 견적서 | `QUO` |
| pdf | `pdf.tenancy_agreement` | 숙박·임대차 약관 본문 | `CTR` |
| pdf | `pdf.move_out_confirmation` | 퇴거 세대 확인서 | — |
| pdf | `pdf.homestay_placement_agreement` | 홈스테이 배치 약정 | — (Metheim 제거 대상) |
| contract | `contract.terms` | 기본 약관 (레거시 폴백) | — |
| contract | `homestay_placement_terms` | 홈스테이 배치 약관 | — |

### 7.2 이메일과 짝을 맞춰 신설할 문서 템플릿

| kind | key | 짝이 되는 이메일 |
|---|---|---|
| pdf | `pdf.statement` | `doc.statement` · `owner.settlement_statement` |
| pdf | `pdf.owner_monthly_report` | `owner.monthly_report` |
| pdf | `pdf.commission_statement` | `agent.commission_statement` |
| pdf | `pdf.host_settlement` | `host.settlement_statement` |
| pdf | `pdf.inspection_report` | `inspection.report_sent` |
| pdf | `pdf.deposit_settlement` | `tenancy.moveout_settlement` |
| pdf | `pdf.overdue_notice` | `billing.rent_overdue_3` (최고장) |
| contract | `contract.agent_agreement` | `agent.agreement_sent` |
| contract | `contract.host_agreement` | `host.approved` |

**규칙**: 신규 문서는 [DOCUMENT_NAMING_RULE.md](DOCUMENT_NAMING_RULE.md) 에 따라 `DOC_CODES` 에
3자리 코드를 먼저 등록하고 `resolveDocFileName()` 으로만 파일명을 만든다. 라우트에서
`` `${ref}.pdf` `` 조립 금지. 발행 문서는 전부 `DocumentPreviewDialog` 로 연다.

### 7.3 이메일 ↔ PDF 문안 일치

같은 사건의 이메일 본문과 PDF 푸터는 **같은 사실을 두 번 말한다.** 문안이 갈라지면 고객이
"메일엔 3일이라는데 문서엔 5일"을 발견한다. 납부기한·연체이율·환불규정 같은 **수치는
`variables_schema` 변수로만** 넣고 문장에 리터럴로 쓰지 않는다.

---

## 8. 실행 순서

**작업 브랜치: `origin/main` 에서 딴 워크트리.** 현재 `fix/onboarding-flow-bugs` 는 138 커밋
뒤처져 있고 `emailBrand.ts` 가 없다 — 여기서 작업하면 셸 없는 코드 위에 템플릿을 얹게 된다.

| Phase | 내용 | 산출물 |
|---|---|---|
| ~~A~~ | ~~공용 이메일 셸~~ | **완료 (main 684bd7e)** |
| **B** | `category` slug 정규화 마이그레이션 + Studio 그룹 라벨 i18n | 마이그레이션 1건, admin i18n |
| **C** | 카탈로그 147키 등록 + **ko 원문 작성 → humanize-korean** | `seed-metheim-email-templates.mjs` |
| **D** | en/ja/zh/th/vi 5개 로케일 작성 (기계번역 금지) | 동 시드 확장 |
| **E** | 발송부 배선 — 하드코딩 문안 제거, `resolveTemplate` 경유 | 라우트/서비스 수정 |
| **F** | PDF·계약 템플릿 9건 신설 + `DOC_CODES` 등록 | 시드 + `docFileName.ts` |
| **G** | MillionStay 본체 적용 (en 원본, 홈스테이 도메인 포함) | `seed-document-templates.mjs` 확장 |

C·D 는 키 단위로 파이프라인이 돌아간다(ko 작성 → humanize → 5개 로케일). 카테고리 단위로
끊어서 `common`(16) → `customer`(62) → `owner`(10) → `partner`(17) → `host`(14) → `staff`(20)
→ `marketing`(8) 순으로 진행하고, 각 묶음이 끝날 때마다 시드를 실행해 Studio 에서 확인한다.

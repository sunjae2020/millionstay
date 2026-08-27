---
status: live
domain: 계약
last_verified: 2026-08-27
---

# 세입자 온보딩 링크 (무로그인 토큰)

세입자가 계정 없이, 링크 하나로 끝내는 단계들의 정본 문서.

## 왜 링크인가

한국 임대차 세입자는 포털 계정을 거의 만들지 않는다. 어떤 단계든 로그인을
요구하면 실무는 곧 우회로를 찾는다 — 카톡으로 사진을 보내고, 통장 사본을
문자로 받고, 확인서에 도장을 받으러 다시 만난다. 기록은 개인 대화방에 흩어지고
남는 증거가 없다.

입주 **전** 단계(신청 → 계약 서명 → 세대점검)는 이미 토큰 링크로 끝나 있었다.
2026-08 작업으로 입주 신청서와 입주 **후** 단계(청구·서류 제출·퇴거 정산)도 같은 모양이 됐다.

## 전체 단계

| 단계 | 공개 주소 | 발급 | 원장 |
|---|---|---|---|
| 신청·문의 | 공개 폼 (`/v1/public/*-inquiries`, `short-term-applications` …) | 방문자 스스로 | leads / applications |
| 계약서 서명 | `/sign/:token` | `POST /v1/contracts/:id/issue-signing` | `contract_signing_requests` |
| 입주 신청서 | `/intake/:token` | `POST /v1/contracts/:id/intake-request` | `tenant_access_links` |
| 서류 제출 | `/documents/:token` | `POST /v1/contracts/:id/document-request` | `tenant_access_links` |
| 입주 세대점검 | `/inspection/:token` | `POST /v1/inspections/:id/sign-link` | `condition_reports` |
| 청구 · 입금 통보 | `/pay/:token` | `POST /v1/invoices/:id/pay-link` | `tenant_access_links` |
| 작업지시 확인 | `/work-order/:token` | `POST /v1/work-orders/:id/sign-link` | `contract_signing_requests` |
| 퇴거 세대점검 | `/inspection/:token` | `POST /v1/inspections/:id/sign-link` | `condition_reports` |
| 퇴거 정산 확인 | `/sign/:token` | `POST /v1/deposit-settlements/:id/sign-link` | `contract_signing_requests` |

## 두 원장을 나눈 이유

- **`contract_signing_requests`** — 서명이 정본인 단계. 저장되는 것은 서명 이미지와
  법적 메타데이터(서버 기준 서명시각·IP·기기·동의문·문서 해시)이고, 서명 시점의
  문서 HTML이 `signed_snapshot` 으로 동결된다. 계약서·작업 확인서·퇴거 정산이
  `context_type` 으로 갈린다.
- **`tenant_access_links`** — 서명이 **아닌** 단계. 청구서를 열어 계좌를 확인하고
  입금을 알리는 것, 서류를 올리는 것, 입주 신청서를 채우는 것. 서명 원장에 섞으면
  그 표의 의미(= 서명된 문서의 증거)가 흐려지므로 따로 둔다.

두 표 모두 (kind|context_type, context_id) 로 대상을 가리키고, 대상당 살아 있는
링크는 하나다 — 재발급하면 이전 링크가 취소된다. 링크를 두 개 뿌려 놓고 어느
쪽으로 들어왔는지 모르는 상황이 실무에서 가장 성가시다.

## 입주 신청서가 받는 것

계약서에는 임대 조건이 다 들어 있다. 정작 입주 당일 관리사무소가 묻는 것들은
계약서에 없다 — 급할 때 연락할 사람과의 **관계**, 차량 번호, 반려동물, 실제 거주
인원, 그리고 증명사진. 지금까지 전화·카톡으로 오가다 어디에도 남지 않던 값이다.

알고 있는 값은 미리 채워 보내고 세입자는 **고칠 것만** 고친다. 빈 양식을 처음부터
다 적게 하면 계약서에 이미 있는 정보를 두 번 묻는 꼴이고, 그 순간 사람들은 대충
적는다.

제출된 값은 **곧바로 덮어쓰지 않는다.** 세입자가 급히 적은 한 글자가 이미 검증된
연락처를 지울 수 있으므로, 제출은 그대로 보관하고 반영은 관리자가 한 번 본 뒤에
누른다(`POST /v1/tenant-links/:id/apply` — 명함 OCR 과 같은 규칙). 반영 후에도
제출 원본은 링크에 남는다: 무엇을 언제 받았는지가 증거다.

앉는 자리는 `contacts`(인적사항·비상연락처·프로필 사진)와 `contracts`(차량·반려
동물·동거인)로 갈린다. 증명사진은 연락처 프로필 사진과 같은 저장 규칙(공개 CDN
URL)을 따른다 — 목록·상세가 그대로 그리는 이미지라 서명 URL 로 두면 화면마다 다시
서명해야 한다. **신분증 사본과는 다른 물건이다**(그쪽은 비공개 + 30일 보존).

## 설계상 일부러 하지 않은 것

- **입금 통보가 청구서를 `Paid` 로 바꾸지 않는다.** 수납 확인은 통장을 보는 사람의
  일이다. 자동으로 넘기면 실제로 안 들어온 돈이 장부에서 사라진다. 통보는
  `tenant_access_links.submissions` 에 쌓이고 관리자 대기열(문서 → 세입자 링크)에
  뜬다. 닫는 것은 기존 수납 처리.
- **신분증·비자는 계약이 아니라 사람(연락처)에 붙는다.** 보존기간이 30일 대 7년이라
  잘못 붙이면 퍼지 잡이 계약 첨부를 한 달 뒤에 지우거나, 신분증을 7년 보관하게
  된다. 붙일 연락처가 없으면 요청 발급 단계에서 막는다.
- **서류 종류 이름은 `doc_type` 이 아니라 `label` 로 보낸다.** `doc_type` 은 곧 보존
  정책 키라서, "재직증명서"와 "주민등록등본"은 같은 `other` 이지만 요청서에는 각자의
  이름으로 찍혀야 한다.

## 화면

- **관리자** — 청구서 상세(결제 링크), 계약 상세(온보딩 현황 7단계 + 입주 신청서 + 서류 요청),
  퇴거 정산 카드(확인 서명), 문서 → **세입자 링크** 대기열.
- **세입자** — `/pay/:token`, `/documents/:token`, `/intake/:token`, `/sign/:token`,
  `/inspection/:token`. 포털에 로그인하면 홈 맨 위 "해야 할 일"에 미완료 링크가
  다시 뜬다(`GET /v1/guest/onboarding`) — 메일을 못 찾는 사람을 위한 자리이며,
  화면을 복제하지 않고 같은 토큰 주소로 보낸다.
- **메일** — `sendTenantLinkEmail` 한 함수가 4종(청구·서류·입주 신청서·정산 서명)
  문안을 6개 로케일로 낸다.

## 토큰·만료

토큰은 `randomBytes(32)` 16진수. 만료는 기본 14일이고, 청구서 링크만 납기일 +
30일이다(납기 전에 죽으면 안 되고, 연체 건도 한 달은 열려 있어야 독촉이 된다).
만료는 조회 시점에 상태로 굳는다 — 크론 없이도 원장이 진실을 말한다.

## 마이그레이션

- `0072_tenant_access_links.sql` — 신규 테이블 하나. 롤백은 `DROP TABLE`.
- `0073_intake_fields.sql` — `contacts.emergency_contact_relation`,
  `contracts.vehicle_no|pet_note|cohabitants`. 전부 nullable, 롤백은 컬럼 DROP.

둘 다 additive-only이며 **두 인스턴스(MillionStay·Metheim)에 2026-08-27 적용 완료**
([마이그레이션 관행](DB_MIGRATION_CONVENTION.md)).

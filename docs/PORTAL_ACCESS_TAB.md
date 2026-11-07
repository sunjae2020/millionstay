---
status: live
domain: 테넌트
last_verified: 2026-11-07
---

# 계정 → 포털 사용 탭

파트너(에이전트·건물주·서비스호스트)에게 포털 로그인을 발급하고, 실제로 들어올 때까지
돌봐 주는 화면. 계정 상세 → **포털 사용**.

한 계정에 로그인이 여러 개 붙는다(담당자별 1행 = `partner_users` 1행). 목록에서
행을 누르면 아래로 상세 패널이 펼쳐진다.

## 상세 패널

| 영역 | 하는 일 |
| --- | --- |
| 포털 이용 안내 | 포털 주소·아이디·비밀번호가 담긴 문구를 만들어 **복사 / 이메일 / 문자**로 전달 |
| 비밀번호 관리 | 임시 비밀번호 발급, 비밀번호 직접 설정 |
| 로그인 상태 | 최근 로그인·실패 횟수·계정 잠금·비밀번호 상태, 잠금 해제 |
| 이 사용자로 포털 열기 | 그 파트너로 로그인한 포털을 새 탭에서 확인 |

### 안내 문구

문구는 **서버가 만든다**(`buildPortalGuide()`, `lib/partnerPortal.ts`). 화면
미리보기와 실제 발송이 갈라지지 않게 조립하는 곳을 하나로 뒀고, 발송 API 는
화면이 보낸 문장을 그대로 싣지 않고 같은 함수로 다시 만든다.

문자로도 나가므로 **EUC-KR 밖의 문자를 문구에 넣지 말 것** — `sendSms()` 가 발송을
거부한다(`▪` 같은 글머리표가 여기 걸려 `·` 로 바꿨다). 미리보기 아래에 SMS/LMS
구분과 바이트 수가 표시된다.

### 임시 비밀번호

- 발급하면 **화면에 한 번만** 보인다. 저장되는 것은 해시뿐이다.
- `partner_users.force_password_change` 가 켜지고 `temp_password_expires_at` 이
  **72시간** 뒤로 찍힌다.
- 파트너는 이 비밀번호로 로그인해 **새 비밀번호를 정해야** 포털을 쓸 수 있다.
  강제는 화면이 아니라 `requirePartnerAuth` 가 한다 — 비밀번호 변경(과 `/me`,
  `/logout`)을 뺀 모든 파트너 API 가 `PASSWORD_CHANGE_REQUIRED` 403 이다.
  포털 3종은 이 상태에서 `ForcePasswordChangePage` 만 그린다.
- 만료 뒤에는 비밀번호가 맞아도 로그인이 거부된다(`TEMP_PASSWORD_EXPIRED`).
  담당자가 다시 발급해야 한다.

### 잠금과 해제

잠금은 별도 플래그가 아니라 `login_attempts` 의 최근 실패 연속 횟수로 계산된다
(15분 창, 5회). 그래서 **잠금 해제 = 창 안의 실패 기록 삭제**
(`clearFailedAttempts()`). 한 사람이 이메일과 휴대폰 두 아이디로 로그인할 수 있어
카운터가 둘일 수 있으므로, 조회·해제 모두 두 키를 함께 본다.

### 이 사용자로 포털 열기

`POST …/impersonate` 가 **refresh 없는 30분짜리 접근 토큰**만 발급하고, 포털이 이미
통합 로그인에서 쓰는 `#sso=` 프래그먼트로 넘긴다. 토큰은 쿼리스트링이 아니라
프래그먼트다 — 서버 로그·Referer 에 남지 않는다.

안전장치:

- **SuperAdmin·Admin 만** 쓸 수 있다(`IMPERSONATION_ROLES`). Viewer 는
  `requireAuth` 가 POST 를 막고, RBAC 매트릭스는 fail-open 이라(`lib/rbac.ts`)
  사용자 정의 역할도 이 라우트가 허용 목록으로 직접 막는다. 버튼도 그 역할에만 보인다.
- 토큰에 `impersonated_by: <관리자 id>` 클레임이 붙는다
  (`signPartnerImpersonationJWT()`, TTL `PARTNER_IMPERSONATION_TTL` = 30분).
  포털은 이 클레임을 보면 브라우저에 남은 다른 세션의 refresh 토큰을 지운다 —
  30분이 지나면 세션이 끝나고 연장되지 않는다.
- 그 세션에서는 **비밀번호 변경, 개인정보 내보내기·삭제 요청**
  (`requirePartnerAuth` 의 `IMPERSONATION_BLOCKED`)과 **패스키 등록·관리**
  (`passkeys.ts` `resolveCaller`)가 `IMPERSONATION_FORBIDDEN` 403 이다. 관리자가
  파트너 계정에 자기 로그인 수단을 심지 못하게 하려는 것이다.
- 임시 비밀번호를 아직 바꾸지 않은 사용자는 대신 열 수 없다(409) — 강제 변경
  화면을 관리자가 통과하면 파트너 비밀번호를 관리자가 정하게 된다.
- 발급마다 `system_log` 에 `LOGIN` 으로 남는다(관리자 id·이메일, 파트너 사용자 id,
  계정 id, 만료 시각). 세션 안에서 일어난 감사 기록은 행위자 이메일 뒤에
  `[impersonated_by admin#<id>]` 가 붙는다.
- 포털은 `/me` 의 `impersonated: true` 를 보고 화면 맨 위에 노란 배너
  (`ImpersonationBanner`)와 "세션 끝내기" 버튼을 띄운다.

## 관련 파일

- 화면: `artifacts/property-admin/src/components/AccountPortalUsers.tsx`(목록),
  `AccountPortalUserPanel.tsx`(상세 패널)
- API: `artifacts/api-server/src/routes/accounts.ts` (`/v1/accounts/:id/portal-users/*`)
- 문구·임시 비밀번호: `artifacts/api-server/src/lib/partnerPortal.ts`
- 강제 변경 관문: `artifacts/api-server/src/middlewares/requirePartnerAuth.ts`
- 포털 화면: `artifacts/{agent,owner,service-host}-portal/src/pages/ForcePasswordChangePage.tsx`
- 포털 배너: `artifacts/{agent,owner,service-host}-portal/src/components/ImpersonationBanner.tsx`
- 마이그레이션: `lib/db/drizzle/0101_partner_portal_temp_password.sql`

---
status: live
domain: 인프라
last_verified: 2026-09-04
---

# 패스키 로그인 + 웹앱(PWA) + 현장 사진 촬영

비밀번호를 **대체하지 않고 추가한다.** 기존 로그인·리프레시 토큰 흐름은 그대로고,
같은 계정에 기기별 패스키를 여러 개 등록할 수 있다.

## 1. 패스키(WebAuthn)

| 구성 | 위치 |
| --- | --- |
| 자격증명·챌린지 테이블 | `lib/db/src/schema/webauthn.ts`, 마이그레이션 `lib/db/drizzle/0078_webauthn.sql` |
| 서버 헬퍼 | `artifacts/api-server/src/lib/webauthn.ts` |
| 라우트 | `artifacts/api-server/src/routes/passkeys.ts` (`/api/v1/auth/passkey/*`) |
| 프론트 | 각 앱 `src/lib/passkey.ts` + 로그인 화면 버튼 + 관리 화면 |

- **대상 3종**을 한 테이블에 담는다: `user_type` = `admin`(users) / `partner`(partner_users) /
  `guest`(guest_users). 자격증명 모양이 같아 검증 경로를 셋으로 쪼갤 이유가 없다.
- **등록**은 이미 로그인한 상태에서만 가능하다(`POST /register/options` → `/register/verify`).
  호출자의 Bearer 토큰을 admin → partner → guest 순으로 검증해 대상을 판별한다.
- **로그인**은 discoverable credential 방식이라 아이디를 입력하지 않는다
  (`POST /login/options` → `/login/verify`). 발급하는 토큰·리프레시 토큰은 비밀번호
  로그인과 동일하므로 로그인 이후 코드는 어떤 방식으로 들어왔는지 알 필요가 없다.
- **RP ID는 요청 호스트명 그대로**다(apex 아님). 오너 랜딩 사이트가 임의의
  `{slug}.millionstay.com` 서브도메인을 만들기 때문에, apex로 잡으면 그 사이트들이
  우리 패스키를 요구할 수 있다. 즉 패스키는 등록한 호스트에서만 쓰인다.
- 챌린지는 5분짜리로 DB에 저장한다. API 인스턴스가 여러 개라 발급한 쪽과 검증하는
  쪽이 다를 수 있다. 사용 즉시 삭제되므로 재생 공격은 빈손으로 끝난다.
- 로그인 옵션·검증은 비밀번호 로그인과 같은 `loginLimiter` 예산을 쓴다.

### 선택 환경변수

| 이름 | 기본값 | 용도 |
| --- | --- | --- |
| `WEBAUTHN_RP_ID` | 요청 호스트명 | 여러 호스트에서 자격증명을 공유하고 싶을 때만 |
| `WEBAUTHN_RP_NAME` | `MillionStay` | OS 프롬프트에 뜨는 서비스 이름 |

### 관리 화면

- 관리자: 설정 → 패스키 (`/settings/passkeys`)
- 파트너 3종: 사이드바 → 보안 (`/security`)
- 게스트: 포털 프로필 → 패스키 카드

## 2. 웹앱(PWA)

`artifacts/{service-host-portal,property-admin}/src/lib/pwa.ts` + `public/sw.js`.
게스트 웹은 종전 `million-stay-web/src/lib/pwa.ts`를 그대로 쓴다.

- 매니페스트는 **런타임 생성**이다. 화이트라벨 인스턴스마다 이름·아이콘이 다른데
  정적 파일이면 테넌트마다 빌드를 따로 떠야 한다.
- 서비스 워커는 network-first + 셸 캐시. GET만 가로채므로 사진 업로드(POST)가
  오프라인에서 조용히 성공하는 일은 없다.
- 설치 버튼은 서비스 호스트 포털 사이드바(`InstallAppButton`). iOS는 설치 API가
  없어 "공유 → 홈 화면에 추가" 안내만 띄운다.
- API 응답 헤더의 `Permissions-Policy`를 `camera=(self)`로 바꿨다. 같은 Express가
  SPA를 서빙하기 때문에 `camera=()`면 촬영이 막힌다.

## 3. 작업 전/후 사진 촬영

- 촬영 진입점은 `capture="environment"` 파일 입력이다. 폰에서 갤러리를 거치지 않고
  바로 후면 카메라가 열린다.
- 업로드 전에 브라우저에서 긴 변 1600px·JPEG 0.82로 줄인다
  (`src/lib/photo.ts`). 원본 4~12MB짜리를 현장 4G로 올리면 끝나지 않는다.
- 서버 엔드포인트는 기존 `POST /api/v1/service-host/work-orders/:id/photos`를 그대로
  쓴다. 사진 한 장마다 촬영일·매물/호수 워터마크를 태우는 경로라서, 여러 장을 고르면
  프론트가 순차로 한 장씩 올린다.
- 화면: 서비스 호스트 포털 작업지시 상세를 **작업 전 / 작업 후 두 구역**으로 나누고
  구역마다 촬영·불러오기 버튼을 붙였다(종전에는 `kind`가 `after` 고정).
  관리자 작업지시 상세의 사진 구역에는 모바일 전용 촬영 버튼을 추가했다.

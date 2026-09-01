---
status: live
domain: 인프라
last_verified: 2026-09-01
---

# SMS 발송 개통 절차 (SOLAPI)

문안 24종, 발송 코드(`lib/sms.ts`), 통보 배선(`lib/notify.ts` + 호출부)은 준비돼 있다.
**남은 것은 계정과 번호뿐이다** — 아래를 갖추면 그 순간부터 나간다. 설정이 없으면
`sendSms()` 가 조용히 `skipped` 를 돌려주므로, 배선된 상태로 두어도 사고가 나지 않는다.

## 1. 계정과 인증 정보

1. https://solapi.com 가입 → 콘솔에서 **API Key / API Secret** 발급
2. 값을 넣는 곳은 두 군데다. **관리자 화면 쪽이 기본**이다:

   - **관리자 → 설정 → 통합 → 💬 문자 · 카카오 알림톡** — 배포 없이 저장·교체되고,
     같은 화면에서 잔액 조회와 테스트 발송까지 된다(`integration_settings` 에 저장).
   - Railway(api-server) 환경변수 — 부팅 시 폴백. 화면에서 넣은 값이 우선한다.

```
SOLAPI_API_KEY=...
SOLAPI_API_SECRET=...
```

> 이 두 값은 **레포에 커밋하지 않는다.** `tenants/metheim/config.env` 에는 자리만 있고
> 값은 비어 있다(다른 시크릿과 같은 규칙).

## 2. 발신번호 사전등록 (전기통신사업법)

국내는 **등록된 번호로만** 발신할 수 있다. 등록되지 않은 번호를 쓰면 발송이 거부된다.

1. SOLAPI 콘솔 → 발신번호 등록
2. 통신서비스 이용증명원 또는 사업자등록증 등 서류 제출 → 승인 대기(영업일 1~2일)
3. 승인된 번호를 등록:

```
SMS_SENDER_NUMBER=0611234567
```

## 3. 광고 SMS 무료거부번호 (광고 발송 시에만)

「정보통신망법」은 광고성 문자에 **무료 수신거부 수단**을 요구한다. 이메일과 달리
**링크로 대체할 수 없고 무료 080 번호**여야 한다.

1. SOLAPI 또는 통신사에서 **080 수신거부 서비스** 신청
2. 발급받은 번호를 등록:

```
SMS_AD_OPT_OUT_NUMBER=080-123-4567
```

> 🚨 **이 번호가 없으면 광고성 SMS 를 보내지 않는다.** `sendSms({ advertising: true })` 는
> 번호가 비어 있으면 발송을 거부한다(조용히 링크로 대체하면 위법이므로 그렇게 하지 않는다).
> 거래성 SMS(예약확정·연체안내·작업배정)는 이 번호 없이도 나간다.

## 4. 충전

SOLAPI 는 선불이다. 잔액이 떨어지면 발송이 실패한다.
`smsBalance()` 로 조회할 수 있으므로, 운영 알림에 붙여 두면 조용한 실패를 막는다.

## 5. 개통 확인

점검 스크립트가 인증·발신번호·잔액·문안·알림톡 매핑을 한 번에 본다. **발송하지 않으므로
돈이 들지 않고**, 막힌 항목이 있으면 종료코드 1 로 끝난다.

```bash
cd artifacts/api-server
DATABASE_URL=… node scripts/sms-preflight.mjs

# 실제 한 통까지 확인
DATABASE_URL=… node scripts/sms-preflight.mjs --send 01012345678
```

관리자 화면(설정 → 통합 → 문자)의 **잔액 조회 / 테스트 발송** 버튼이 같은 일을 한다.
번호를 비우고 누르면 잔액만 조회하므로, 키가 맞는지 확인하는 데는 요금이 들지 않는다.

값은 **DB(관리자 화면) → 환경변수** 순서로 읽는다 — 스크립트도 서버와 같은 순서를 쓰므로
"화면에는 들어 있는데 점검은 없다고 한다" 같은 어긋남이 생기지 않는다.

---

## 발송 규격 (SOLAPI 기준)

| 타입 | 한도 | 제목 | 비고 |
|---|---|---|---|
| SMS | 90 bytes (한글 45자) | 미지원 | 가장 싸다 — 기본 목표 |
| LMS | 2,000 bytes | 지원 | SMS 의 3배 안팎 |

- 바이트: 영문·숫자·공백·**줄바꿈 1byte**, 한글 1자당 2bytes
- 🚨 **제목을 넣으면 본문이 90 bytes 이하라도 LMS 로 전환된다.** 그래서 SMS 템플릿은
  `subject` 를 `null` 로 저장하고 `sendSms()` 도 제목을 보내지 않는다.
- 이모지·특수문자는 EUC-KR 로 인코딩되지 않아 깨지거나 거부된다 → `nonEucKrChars()` 가
  발송 전에 막는다.

문안 24종은 전부 SMS 등급(최대 88B / 평균 78B)이다. 문안을 고칠 때는 시드 검증기
(`DRY_RUN=1 node scripts/seed-metheim-email-templates.mjs`)가 표본값을 치환해 길이를
다시 재므로, 90 bytes 를 넘기면 배포 전에 걸린다.

## 야간 발송

광고성 SMS 는 21–08시에 보낼 수 없다(별도 동의 필요, 우리는 받지 않는다).
이메일과 같은 `MARKETING_QUIET_HOURS` / `MARKETING_TZ` 를 쓰므로 따로 설정할 것이 없다.

## 알림톡을 붙인다면

국내 실무에서 **카카오 알림톡**은 SMS 보다 싸고 도달률이 높다. 붙인다면:

1. 카카오 비즈니스 채널 개설 → SOLAPI 에 연결
2. 지금 만든 24개 문안을 그대로 **템플릿 심사**에 올린다 (변수는 `#{변수}` 형식으로 변환)
3. 발송 시 알림톡을 먼저 시도하고 실패하면 SMS 로 대체(`fallback`)

심사는 광고성 문구를 걸러낸다. 24종을 거래성만 골라 둔 것이 여기서 그대로 유리하게 작용한다.

## 어떤 사건에서 문자가 나가나 (배선 현황)

호출부는 전부 `lib/notify.ts` 의 `notifySms()` 를 거친다 — 수신자 조회·중복 방지·이력이
한 곳에 모여 있어야 한 군데만 빠뜨리는 사고가 나지 않는다.

| 사건 | 문안 | 수신자 | 위치 |
|---|---|---|---|
| 납부 기한 3일 전 | `sms.rent_due` | 세입자 | `lib/billing/rentDunning.ts` (크론) |
| 연체 1·2·3차 | `sms.rent_overdue` | 세입자 | `lib/billing/rentDunning.ts` (크론) |
| 인보이스 수납 | `sms.payment_received` | 세입자 | `POST /v1/invoices/:id/pay` |
| 작업 파트너 배정 | `sms.job_assigned` | 서비스 호스트 | `lib/dispatch/workOrderDispatch.ts` |
| 접수확인 SLA 초과 | `sms.staff_system_alert` | 당번(`STAFF_ALERT_MOBILES`) | 〃 (SLA 크론) |
| 작업 확인 서명 링크 | `sms.signature_request` | 시설 담당자 | `POST /v1/work-orders/:id/sign-link` (`mobile`) |
| 방문 확정 | `sms.inspection_notice` / `sms.appointment_reminder` | 입회자 | `POST /v1/work-orders/:id/send-confirmation` |
| 보증금 정산 확정 | `sms.moveout_settlement` | 임차인 | `POST /v1/deposit-settlements/:id/finalize` |
| 정산 확인 서명 링크 | `sms.signature_request` | 임차인 | `POST /v1/deposit-settlements/:id/sign-link` (`send_sms`) |
| 소유주·파트너·에이전트 지급 | `sms.owner_payout_sent` / `sms.host_payout_sent` / `sms.commission_paid` | 수취인 | `paySettlement()` — 개별 지급·페이런 공통 |

이력은 `email_log` 에 남는다(`template_code` = 문안 키, `to_email` 칸에 번호). 테이블
이름은 이메일이지만 이 로그가 답하는 질문은 "이 건은 통보했는가" 이고 그건 채널과
무관하다. 실패도 `status='Failed'` 로 남으므로 조용한 실패가 없다.

### 아직 트리거가 없는 문안

문안은 있으나 그 사건 자체가 시스템에 없어 걸 곳이 없는 것들이다. 기능이 생길 때 함께
배선한다 — `sms.auth_code`(휴대폰 인증 플로우 없음), `sms.booking_confirmed` ·
`sms.checkin_guide`(게스트 예약은 이메일 경로), `sms.defect_registered` ·
`sms.maintenance_notice` · `sms.owner_approval_request` · `sms.referral_status` ·
`sms.job_reminder` · `sms.job_changed` · `sms.job_cancelled` · `sms.report_required` ·
`sms.staff_urgent_ticket`.

---

# 카카오 알림톡 (선택 — SMS 보다 싸고 도달률이 높다)

## 왜 붙이나

| | 알림톡 | 친구톡 | SMS |
|---|---|---|---|
| 대상 | 채널 친구가 **아니어도** | 채널 친구만 | 전화번호만 있으면 |
| 내용 | **정보성만** | 광고 가능 | 제한 없음 |
| 템플릿 심사 | **필수** | 불필요 | 불필요 |

우리 SMS 24종은 전부 거래성이라 **알림톡 대상**이다. `marketing.*` 은 알림톡으로 보낼 수
없고 친구톡이나 SMS 로 간다.

## 절차

1. **카카오톡 채널 개설** — business.kakao.com, 사업자등록증 필요
2. **Solapi 에 채널 연동** → `pfId`(발신프로필 키) 발급 → `KAKAO_PF_ID` 에 설정
3. **템플릿 심사 등록** — [KAKAO_ALIMTALK_TEMPLATES.md](KAKAO_ALIMTALK_TEMPLATES.md) 의
   22종을 그대로 복사해 등록한다. 그 문서는 SMS 문안에서 자동 생성되므로
   문안을 고치면 다시 뽑는다:
   ```bash
   node scripts/gen-kakao-templates.mjs > docs/KAKAO_ALIMTALK_TEMPLATES.md
   ```
4. 승인되면 `templateId` 를 연결한다 (배포 불필요):
   ```bash
   DATABASE_URL=… node scripts/set-kakao-template-id.mjs sms.booking_confirmed TX_0001
   DATABASE_URL=… node scripts/set-kakao-template-id.mjs sms.rent_due TX_0002 --button "청구서 보기"
   DATABASE_URL=… node scripts/set-kakao-template-id.mjs --list      # 연결 현황
   DATABASE_URL=… node scripts/set-kakao-template-id.mjs sms.rent_due --clear   # 되돌리기
   ```

## 동작 방식

`sendSms()` 는 아래를 **모두** 만족할 때만 알림톡을 시도한다. 하나라도 빠지면 조용히
SMS 로 나간다 — 알림톡은 최적화지 필수 경로가 아니므로 설정 미비로 발송이 멈추면 안 된다.

- `KAKAO_PF_ID` 가 있다
- 해당 템플릿에 `templateId` 가 연결돼 있다
- 광고성이 아니다 (`advertising: false`)
- `smsOnly: true` 가 아니다

알림톡 발송이 실패하면 **같은 문구가 SMS 로 자동 대체발송**된다(`disableSms: false`).
따로 구현할 것이 없고, 이 때문에 문안의 `[브랜드]` 접두를 유지한다.

## 주의

- 🚨 **알림톡 본문은 승인된 템플릿과 글자가 일치해야 한다.** DB 문안을 고치면 심사를
  다시 넣어야 하고 그 전까지 알림톡 발송이 거부된다(SMS 로는 나간다).
- 심사에서 걸릴 만한 것은 생성 문서에 `⚠️ 심사 유의` 로 표시해 두었다. 특히
  `sms.rent_overdue` 는 채권추심으로 읽힐 수 있어 임대차 계약에 따른 납부 안내라는
  발송 근거를 함께 제출한다.
- 내부 직원용 2종(`staff_*`)은 심사에 올리지 않는다. 고객 채널로 보낼 대상이 아니다.

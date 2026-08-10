# 카카오 알림톡 템플릿 심사 등록 목록

> **생성물이다. 손으로 고치지 말 것.**
> `node scripts/gen-kakao-templates.mjs > docs/KAKAO_ALIMTALK_TEMPLATES.md` 로 다시 뽑는다.
> SMS 문안(`scripts/lib/email-templates/sms-*.mjs`)이 정본이고 이 문서는 그 파생이다.

## 등록 전에 확인할 것

1. **카카오톡 채널**을 먼저 개설한다 (business.kakao.com, 사업자등록증 필요).
2. Solapi 콘솔에서 채널을 연동해 **`pfId`(발신프로필 키)** 를 받는다.
3. 아래 템플릿을 하나씩 등록한다. 심사는 영업일 1~3일.
4. 승인되면 **`templateId`** 가 나온다 — 이 문서의 템플릿 코드와 짝지어 기록해 둔다.
   코드가 그 매핑을 읽어 발송한다.

## 규칙

- 변수는 `#{변수명}` 형식이다. SMS 문안의 `{{변수}}` 를 자동 변환했다.
- **변수만으로 이루어진 문장은 반려된다.** 아래 문안은 전부 고정 문구를 포함한다.
- 알림톡은 **정보성만** 허용된다. 광고성(`marketing.*`)은 등록 대상이 아니며 친구톡 또는 SMS 로 보낸다.
- `[#{brand}]` 접두는 **유지한다.** 알림톡은 채널명이 상단에 뜨지만, 알림톡이 실패하면
  같은 문구가 SMS 로 대체발송되므로(`disableSms: false`) 접두가 없으면 SMS 쪽이 어색해진다.
- 알림톡 본문 한도는 1,000자로 여유가 크다. SMS 90바이트에 맞춘 문안이라 길이는 문제되지 않는다.

**등록 대상 22종** (전체 24종 중 2종 제외)

---

## B2C — 고객·세입자

### 인증번호

| | |
|---|---|
| 템플릿 코드 | `sms.auth_code` |
| 용도 | 본인 확인 6자리. 다른 안내를 붙이지 않는다 — 인증번호만 있는 문자가 가장 안전하다. |
| 변수 | `#{brand}` · `#{code}` · `#{expiry_minutes}` |
| ⚠️ 심사 유의 | 인증번호는 별도 카테고리(인증)로 등록해야 하는 경우가 있다. 심사 화면에서 유형을 확인할 것 |

**등록할 내용** (그대로 복사)

```
[#{brand}] 인증번호 #{code}
#{expiry_minutes}분 내 입력해 주세요. 타인에게 알려주지 마세요.
```

<details><summary>치환 예시</summary>

```
[메트하임] 인증번호 384712
10분 내 입력해 주세요. 타인에게 알려주지 마세요.
```
</details>

### 예약 확정

| | |
|---|---|
| 템플릿 코드 | `sms.booking_confirmed` |
| 용도 | 예약이 잡혔을 때. 상세는 링크로. |
| 변수 | `#{brand}` · `#{space_name}` · `#{date}` · `#{url}` |
| 버튼 제안 | `WL` **자세히 보기** → `#{url}` |

**등록할 내용** (그대로 복사)

```
[#{brand}] 예약이 확정되었습니다.
#{space_name} / #{date}
상세 #{url}
```

<details><summary>치환 예시</summary>

```
[메트하임] 예약이 확정되었습니다.
101동 1203호 / 8월 25일(화)
상세 https://mth.kr/a1B2c3
```
</details>

### 입실 안내

| | |
|---|---|
| 템플릿 코드 | `sms.checkin_guide` |
| 용도 | 입실 당일. 출입 방법이 핵심이라 SMS 가 이메일보다 낫다. |
| 변수 | `#{brand}` · `#{address}` · `#{space_name}` · `#{access_code}` · `#{contact_phone}` |

**등록할 내용** (그대로 복사)

```
[#{brand}] 입실 안내
#{address} #{space_name}
출입 #{access_code}
문의 #{contact_phone}
```

<details><summary>치환 예시</summary>

```
[메트하임] 입실 안내
전남 여수시 좌수영로 101 101동 1203호
출입 #1234*
문의 061-123-4567
```
</details>

### 납부 기한 안내

| | |
|---|---|
| 템플릿 코드 | `sms.rent_due` |
| 용도 | 기한 며칠 전. 금액과 날짜만. |
| 변수 | `#{brand}` · `#{due_date}` · `#{amount}` · `#{url}` |
| 버튼 제안 | `WL` **자세히 보기** → `#{url}` |

**등록할 내용** (그대로 복사)

```
[#{brand}] #{due_date}까지 #{amount} 납부 부탁드립니다.
청구서 #{url}
```

<details><summary>치환 예시</summary>

```
[메트하임] 8월 25일까지 1,250,000원 납부 부탁드립니다.
청구서 https://mth.kr/a1B2c3
```
</details>

### 연체 안내

| | |
|---|---|
| 템플릿 코드 | `sms.rent_overdue` |
| 용도 | 연체 발생. 독촉 수위는 이메일이 담당하고 SMS 는 사실만 알린다. |
| 변수 | `#{brand}` · `#{amount}` · `#{days_overdue}` · `#{contact_phone}` |
| ⚠️ 심사 유의 | 미납 독촉으로 읽히면 반려될 수 있다. **임대차 계약에 따른 납부 안내**라는 발송 근거를 심사 시 함께 제출할 것 |

**등록할 내용** (그대로 복사)

```
[#{brand}] #{amount}이 #{days_overdue}일째 미납입니다.
확인 부탁드립니다. 문의 #{contact_phone}
```

<details><summary>치환 예시</summary>

```
[메트하임] 1,250,000원이 15일째 미납입니다.
확인 부탁드립니다. 문의 061-123-4567
```
</details>

### 입금 확인

| | |
|---|---|
| 템플릿 코드 | `sms.payment_received` |
| 용도 | 입금 확인. 안심시키는 용도라 짧을수록 좋다. |
| 변수 | `#{brand}` · `#{amount}` · `#{date}` |

**등록할 내용** (그대로 복사)

```
[#{brand}] #{amount} 입금 확인했습니다. (#{date})
감사합니다.
```

<details><summary>치환 예시</summary>

```
[메트하임] 1,250,000원 입금 확인했습니다. (8월 25일(화))
감사합니다.
```
</details>

### 방문 전일 알림

| | |
|---|---|
| 템플릿 코드 | `sms.appointment_reminder` |
| 용도 | 약속 하루 전. 시간·장소만. |
| 변수 | `#{brand}` · `#{purpose}` · `#{date}` · `#{time_window}` · `#{contact_phone}` |

**등록할 내용** (그대로 복사)

```
[#{brand}] 내일 #{purpose} 예정입니다.
#{date} #{time_window}
변경 #{contact_phone}
```

<details><summary>치환 예시</summary>

```
[메트하임] 내일 세대 점검 예정입니다.
8월 25일(화) 14시–16시
변경 061-123-4567
```
</details>

### 세대 점검 방문 통지

| | |
|---|---|
| 템플릿 코드 | `sms.inspection_notice` |
| 용도 | 세대 안에 들어가는 방문은 사전 통지가 원칙. SMS 로도 남긴다. |
| 변수 | `#{brand}` · `#{space_name}` · `#{date}` · `#{time_window}` · `#{contact_phone}` |

**등록할 내용** (그대로 복사)

```
[#{brand}] #{space_name} 점검 방문 예정
#{date} #{time_window}
조정 #{contact_phone}
```

<details><summary>치환 예시</summary>

```
[메트하임] 101동 1203호 점검 방문 예정
8월 25일(화) 14시–16시
조정 061-123-4567
```
</details>

### 서명 요청

| | |
|---|---|
| 템플릿 코드 | `sms.signature_request` |
| 용도 | 전자서명 링크. 링크가 본문의 전부다. |
| 변수 | `#{brand}` · `#{url}` · `#{due_date}` |
| 버튼 제안 | `WL` **서명하기** → `#{url}` |

**등록할 내용** (그대로 복사)

```
[#{brand}] 계약서 서명을 부탁드립니다.
#{url}
#{due_date}까지 유효합니다.
```

<details><summary>치환 예시</summary>

```
[메트하임] 계약서 서명을 부탁드립니다.
https://mth.kr/a1B2c3
8월 25일까지 유효합니다.
```
</details>

### 하자 접수 확인

| | |
|---|---|
| 템플릿 코드 | `sms.defect_registered` |
| 용도 | 신고가 들어갔음을 즉시 알린다. 접수만 알려도 불안이 크게 준다. |
| 변수 | `#{brand}` · `#{ref}` · `#{date}` |

**등록할 내용** (그대로 복사)

```
[#{brand}] 하자 신고를 접수했습니다. (#{ref})
#{date} 방문 예정입니다.
```

<details><summary>치환 예시</summary>

```
[메트하임] 하자 신고를 접수했습니다. (INV-2026-00123)
8월 25일(화) 방문 예정입니다.
```
</details>

### 단수·정전 공지

| | |
|---|---|
| 템플릿 코드 | `sms.maintenance_notice` |
| 용도 | 생활에 직접 영향. 이메일만으로는 늦는다. |
| 변수 | `#{brand}` · `#{date}` · `#{time_window}` · `#{purpose}` |

**등록할 내용** (그대로 복사)

```
[#{brand}] #{date} #{time_window} #{purpose} 예정입니다.
미리 준비 부탁드립니다.
```

<details><summary>치환 예시</summary>

```
[메트하임] 8월 25일(화) 14시–16시 세대 점검 예정입니다.
미리 준비 부탁드립니다.
```
</details>

### 보증금 정산 완료

| | |
|---|---|
| 템플릿 코드 | `sms.moveout_settlement` |
| 용도 | 돈이 걸린 확인. 금액과 입금 예정만. |
| 변수 | `#{brand}` · `#{amount}` · `#{date}` · `#{url}` |
| 버튼 제안 | `WL` **내역 보기** → `#{url}` |
| ⚠️ 심사 유의 | 금액 정산 안내다. 계약 종료에 따른 정산임을 설명에 적을 것 |

**등록할 내용** (그대로 복사)

```
[#{brand}] 보증금 #{amount} 정산 완료.
#{date} 입금 예정
#{url}
```

<details><summary>치환 예시</summary>

```
[메트하임] 보증금 1,250,000원 정산 완료.
8월 25일(화) 입금 예정
https://mth.kr/a1B2c3
```
</details>

---

## B2B — 파트너·서비스호스트·소유주

### 작업 배정

| | |
|---|---|
| 템플릿 코드 | `sms.job_assigned` |
| 용도 | 새 작업. 언제·어디서·무엇 세 가지만. |
| 변수 | `#{brand}` · `#{date}` · `#{time_window}` · `#{space_name}` · `#{job_type}` · `#{url}` |
| 버튼 제안 | `WL` **자세히 보기** → `#{url}` |

**등록할 내용** (그대로 복사)

```
[#{brand}] 작업배정 #{date} #{time_window}
#{space_name} #{job_type}
#{url}
```

<details><summary>치환 예시</summary>

```
[메트하임] 작업배정 8월 25일(화) 14시–16시
101동 1203호 입주청소
https://mth.kr/a1B2c3
```
</details>

### 작업 전일 알림

| | |
|---|---|
| 템플릿 코드 | `sms.job_reminder` |
| 용도 | 내일 작업. 시간과 장소만. |
| 변수 | `#{brand}` · `#{date}` · `#{time_window}` · `#{address}` · `#{space_name}` |

**등록할 내용** (그대로 복사)

```
[#{brand}] 내일 작업
#{date} #{time_window}
#{address} #{space_name}
```

<details><summary>치환 예시</summary>

```
[메트하임] 내일 작업
8월 25일(화) 14시–16시
전남 여수시 좌수영로 101 101동 1203호
```
</details>

### 작업 변경

| | |
|---|---|
| 템플릿 코드 | `sms.job_changed` |
| 용도 | 일정·장소 변경. 이미 출발했을 수 있어 즉시성이 중요하다. |
| 변수 | `#{brand}` · `#{date}` · `#{time_window}` · `#{space_name}` · `#{url}` |
| 버튼 제안 | `WL` **자세히 보기** → `#{url}` |

**등록할 내용** (그대로 복사)

```
[#{brand}] 작업변경 #{date} #{time_window}
#{space_name}
#{url}
```

<details><summary>치환 예시</summary>

```
[메트하임] 작업변경 8월 25일(화) 14시–16시
101동 1203호
https://mth.kr/a1B2c3
```
</details>

### 작업 취소

| | |
|---|---|
| 템플릿 코드 | `sms.job_cancelled` |
| 용도 | 취소. 헛걸음을 막는 것이 목적이므로 가장 빨리 나가야 한다. |
| 변수 | `#{brand}` · `#{date}` · `#{space_name}` · `#{contact_phone}` |

**등록할 내용** (그대로 복사)

```
[#{brand}] #{date} #{space_name} 작업 취소.
출발 전이면 연락 주세요 #{contact_phone}
```

<details><summary>치환 예시</summary>

```
[메트하임] 8월 25일(화) 101동 1203호 작업 취소.
출발 전이면 연락 주세요 061-123-4567
```
</details>

### 완료 보고 요청

| | |
|---|---|
| 템플릿 코드 | `sms.report_required` |
| 용도 | 보고 누락 시. 정산과 직결됨을 짧게 알린다. |
| 변수 | `#{brand}` · `#{space_name}` · `#{url}` |
| 버튼 제안 | `WL` **사진 등록** → `#{url}` |

**등록할 내용** (그대로 복사)

```
[#{brand}] #{space_name} 완료 보고 미등록
#{url}
사진 올려야 정산됩니다
```

<details><summary>치환 예시</summary>

```
[메트하임] 101동 1203호 완료 보고 미등록
https://mth.kr/a1B2c3
사진 올려야 정산됩니다
```
</details>

### 정산금 지급

| | |
|---|---|
| 템플릿 코드 | `sms.host_payout_sent` |
| 용도 | 호스트 정산 송금 완료. |
| 변수 | `#{brand}` · `#{period}` · `#{net_amount}` · `#{date}` |

**등록할 내용** (그대로 복사)

```
[#{brand}] #{period} 정산금 #{net_amount}을 #{date} 송금했습니다.
```

<details><summary>치환 예시</summary>

```
[메트하임] 2026년 7월 정산금 820,000원을 8월 25일(화) 송금했습니다.
```
</details>

### 소개 건 진행 변경

| | |
|---|---|
| 템플릿 코드 | `sms.referral_status` |
| 용도 | 파트너가 고객에게 답할 수 있게 하는 최소 정보. |
| 변수 | `#{brand}` · `#{client_name}` · `#{status}` · `#{url}` |
| 버튼 제안 | `WL` **자세히 보기** → `#{url}` |

**등록할 내용** (그대로 복사)

```
[#{brand}] #{client_name} 건 상태: #{status}
상세 #{url}
```

<details><summary>치환 예시</summary>

```
[메트하임] 박지연 건 상태: 계약 완료
상세 https://mth.kr/a1B2c3
```
</details>

### 수수료 지급

| | |
|---|---|
| 템플릿 코드 | `sms.commission_paid` |
| 용도 | 수수료 송금 완료. 계좌는 끝자리만. |
| 변수 | `#{brand}` · `#{period}` · `#{net_amount}` · `#{date}` |

**등록할 내용** (그대로 복사)

```
[#{brand}] #{period} 수수료 #{net_amount}을 #{date} 송금했습니다.
```

<details><summary>치환 예시</summary>

```
[메트하임] 2026년 7월 수수료 820,000원을 8월 25일(화) 송금했습니다.
```
</details>

### 소유주 정산금 지급

| | |
|---|---|
| 템플릿 코드 | `sms.owner_payout_sent` |
| 용도 | 정산 송금 완료. 임차인은 특정하지 않는다. |
| 변수 | `#{brand}` · `#{period}` · `#{net_amount}` · `#{date}` |

**등록할 내용** (그대로 복사)

```
[#{brand}] #{period} 정산금 #{net_amount}을 #{date} 송금했습니다.
```

<details><summary>치환 예시</summary>

```
[메트하임] 2026년 7월 정산금 820,000원을 8월 25일(화) 송금했습니다.
```
</details>

### 소유주 수선 승인 요청

| | |
|---|---|
| 템플릿 코드 | `sms.owner_approval_request` |
| 용도 | 금액이 걸린 결정. 기한이 있으면 SMS 가 맞다. |
| 변수 | `#{brand}` · `#{space_name}` · `#{amount}` · `#{url}` |
| 버튼 제안 | `WL` **확인하기** → `#{url}` |

**등록할 내용** (그대로 복사)

```
[#{brand}] #{space_name} 수선 승인 요청
견적 #{amount}
확인 #{url}
```

<details><summary>치환 예시</summary>

```
[메트하임] 101동 1203호 수선 승인 요청
견적 1,250,000원
확인 https://mth.kr/a1B2c3
```
</details>

### 긴급 CS 배정

| | |
|---|---|
| 템플릿 코드 | `sms.staff_urgent_ticket` |
| 용도 | 누수·정전 등 즉시 대응. 이메일로는 늦는다. |
| **심사 제외** | 내부 직원용 — 고객 채널로 보낼 대상이 아니다 |

### 시스템 장애 알림

| | |
|---|---|
| 템플릿 코드 | `sms.staff_system_alert` |
| 용도 | 야간·주말 장애. 운영 담당에게. |
| **심사 제외** | 내부 직원용 — 장애 알림은 SMS·슬랙이 맞다 |

---

## 승인 후 기록표

승인된 `templateId` 를 여기에 적어 두면 코드 매핑에 그대로 쓴다.

| 템플릿 코드 | templateId | 승인일 | 비고 |
|---|---|---|---|
| `sms.auth_code` | | | |
| `sms.booking_confirmed` | | | |
| `sms.checkin_guide` | | | |
| `sms.rent_due` | | | |
| `sms.rent_overdue` | | | |
| `sms.payment_received` | | | |
| `sms.appointment_reminder` | | | |
| `sms.inspection_notice` | | | |
| `sms.signature_request` | | | |
| `sms.defect_registered` | | | |
| `sms.maintenance_notice` | | | |
| `sms.moveout_settlement` | | | |
| `sms.job_assigned` | | | |
| `sms.job_reminder` | | | |
| `sms.job_changed` | | | |
| `sms.job_cancelled` | | | |
| `sms.report_required` | | | |
| `sms.host_payout_sent` | | | |
| `sms.referral_status` | | | |
| `sms.commission_paid` | | | |
| `sms.owner_payout_sent` | | | |
| `sms.owner_approval_request` | | | |


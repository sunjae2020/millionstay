# 회계 설계 스펙 — Metheim(Millionstay) · AusBridge 공용 참조

> **상태**: 제안 (v2, 2026-08-03)
> **성격**: **설계 참조 문서**. Metheim과 AusBridge는 **각각 독립된 별도의 앱**이며,
> 데이터·계정과목·마이그레이션을 공유하지 않는다. 이 문서는 **같은 설계를 각자 구현**하기 위한 공용 청사진이다.
> Edubee-CRM은 참조 구현이며 구현 대상이 아니다.

두 제품은 같은 코드 계보(`artifacts/api-server` + `property-admin` + `lib/billing/gl.ts`)를 쓰고,
같은 자금 흐름 — **고객이 낸다 → 우리가 홀딩한다 → 공급처·에이전트에 분배한다 → 남은 것이 실 매출** — 을 다룬다.
따라서 **모델과 알고리즘은 공유하고, 계정 코드와 데이터는 각자 소유한다.**

> ⚠️ **각 앱의 계정과목은 그 앱의 프로덕션 데이터가 결정한다.** 상대 앱에 맞추려고 코드를 옮기지 말 것.
> 코드가 서로 달라도 **역할(role)이 같으면 설계는 이식 가능**하다 — §1의 역할 축을 기준으로 읽는다.

---

## 0. 정본 자금 흐름

```
       고객 / 에이전트
             │  ① 결제 (AR)
             ▼
    ┌──────────────────────┐
    │   Metheim / AusBridge │  ② 홀딩
    │      (수취 계좌)        │
    └──────────────────────┘
             │  ③ 분배 (AP legs)
     ┌───────┼────────┬──────────────┐
     ▼       ▼        ▼              ▼
   집주인   서비스    에이전트      유보(retained)
   렌트    파트너    Referral      = 실 매출
```

**불변식 (이 문서 전체의 핵심):**

```
① 수취액 = ③ 분배 legs 합계
실 매출  = 수취액 − 집주인 렌트 − 파트너 비용 − 에이전트 Referral
        = retained leg
```

실 매출은 **리포트에서 빼기로 구하는 값이 아니라, 원장에 실재하는 leg**다.
합이 안 맞으면 `balanced = false`로 화면에 뜬다. 이것이 Edubee `assembleSplitBreakdown()`의
`balanced: Math.abs(received - legsTotal) < 0.01` 규약이며, 그대로 채택한다.

---

## 1. 계정 역할 축 — 코드가 아니라 **역할**을 공유한다

두 앱은 독립이므로 계정 코드를 맞추지 않는다. 대신 **9개 역할(role)**을 정의하고,
각 앱은 자기 코드를 그 역할에 매핑한다. 이식할 때는 코드가 아니라 역할을 보고 옮긴다.

| 역할 (role) | 유형 | 용도 | Metheim 코드 | AusBridge 코드 |
|---|---|---|---|---|
| `CASH` | asset | 현금·예금 | 1000 | 1000 |
| `AR` | asset | 매출채권 (발행 시점) | **1100 (신규)** | 1100 |
| `COMMISSION_PAYABLE` | liability | 에이전트 커미션 미지급 | 2000 | 2000 |
| `DEPOSIT_HELD` | liability | 예수보증금 | 2100 | *(해당 시 자체 배정)* |
| `PROVIDER_PAYABLE` | liability | 공급처 미지급 (집주인·파트너) | 2200 | 2100 |
| `REVENUE` | revenue | 매출 | 4000 | 4000 |
| `COMMISSION_EXPENSE` | expense | 에이전트 커미션 원가 | 5000 | 5000 |
| `PROVIDER_COST` | expense | 파트너 외주비 | 5100 | 5100 |
| `OWNER_RENT_COST` | expense | **집주인 렌트** | **5300 임차료** | *(해당 시 자체 배정)* |

**실 매출 = REVENUE − COMMISSION_EXPENSE − PROVIDER_COST − OWNER_RENT_COST.** 손익계산서에서 바로 나온다.

> ⚠️ **`2100`은 두 앱에서 다른 뜻이다** — Metheim은 예수보증금, AusBridge는 매입채무.
> 각자 프로덕션 데이터가 이미 그 코드에 붙어 있으므로 **어느 쪽도 이동하지 않는다.**
> 상대 앱의 코드를 그대로 복사해 오지 말 것. `gl.ts`의 `ACCOUNTS` 상수는 각 앱이 독립적으로 소유한다.

### Metheim 측 변경 (구현 완료)

- **`1100 매출채권`** — 인보이스 발행 분개가 없어 미수·Aging이 성립하지 않던 것을 해소.
  Metheim COA에 이미 같은 뜻으로 존재해 그대로 사용.
- **`5300 임차료` = 집주인 렌트** — 부동산 임대 원가를 서비스 외주비(5100)와 섞으면
  마진 분석이 불가능하므로 분리.
- **2100(예수보증금) · 2200(미지급금) · 5100(지급수수료)은 현행 유지.**

> 🔴 **왜 5200이 아니라 5300인가** — 번호 순서상 5200이 자연스러워 보이지만,
> **한국 표준 계정과목에서 5200은 급여**다(Metheim DB 실측 확인). 여기에 집주인 렌트를 찍으면
> **최대 원가 항목이 인건비 안에 파묻힌다.** 5300 임차료는 "임대인에게 지급하는 차임"이라는
> 뜻이 이미 정확히 일치하므로 새 계정을 만들지 않고 재사용한다.
>
> **교훈**: 계정 코드를 번호 순서로 고르지 말 것. 반드시 대상 인스턴스의 COA를 먼저 조회한다.

### ⚠️ 기존 코드 의미 불일치 (본 작업 범위 밖, 후속 과제)

`gl.ts`의 영문 계정명과 Metheim COA의 한국어 계정명이 **원래부터** 어긋나 있는 항목이 있다.
분개 자체는 `journal_lines.account_name`에 영문명을 함께 저장하므로 동작하지만,
**COA 코드로 그룹핑하는 리포트에서는 라벨이 잘못 보인다.**

| 코드 | gl.ts 의도 | Metheim COA 실제 | 영향 |
|---|---|---|---|
| 2000 | Commission Payable | 매입채무 | 커미션 미지급이 매입채무로 표시 |
| 5000 | Agent Commission Expense | 매출원가 | 커미션 비용이 매출원가로 표시 |
| 5100 | Contractor Expense | 지급수수료 | 의미 근접, 영향 경미 |

근본 해결책은 **계정 코드를 인스턴스별 설정으로 빼는 것**(Metheim이 통화·문서 언어를 env로
오버라이드하는 방식과 동일). 기존 분개 데이터가 걸려 있어 단순 코드 변경은 불가하므로
별도 과제로 다룬다.

**규약**: `gl.ts`의 하드코딩 `ACCOUNTS`가 분개의 단일 소스이고, `chart_of_accounts` 테이블은
**표시·확장용 마스터**다. 현재 Metheim은 한국식 36계정을 시드해 두었으나 분개가 이를 참조하지 않으므로,
위 9개 코드에 해당하는 행이 COA 마스터에 존재하도록 시드를 정렬한다 (두 체계가 서로 모르는 현 상태 해소).

---

## 2. 지급 조건 — `contract_payout_terms` (신규)

집주인·파트너·에이전트의 지급 규칙을 **계약에 붙은 N행**으로 통일한다.
현재 Metheim은 집주인 조건을 담을 곳이 없고(`contract_related_costs`는 GL 미연동 자유텍스트 메모),
에이전트는 `agent_commission_ledger.placement_id NOT NULL` 때문에 홈스테이 배정에만 붙는다. 둘 다 해소한다.

```ts
// lib/db/src/schema/contract_payout_terms.ts
export const contractPayoutTermsTable = pgTable("contract_payout_terms", {
  id: serial("id").primaryKey(),
  contract_id: integer("contract_id").notNull(),

  // landlord | service_host | agent
  party_type: text("party_type").notNull(),
  payee_account_id: integer("payee_account_id"),   // accounts.id
  payee_name: text("payee_name").notNull().default(""),  // 계정 미등록 수취인 폴백

  // percent_of_rent | fixed_monthly | fixed_once
  basis: text("basis").notNull(),
  rate: numeric("rate", { precision: 5, scale: 2 }),        // basis=percent_of_rent
  amount: numeric("amount", { precision: 14, scale: 2 }),   // basis=fixed_*
  currency: text("currency").notNull().default("KRW"),

  // on_ar_paid (기본) | on_schedule | manual
  trigger: text("trigger").notNull().default("on_ar_paid"),
  // monthly | once | per_job
  cadence: text("cadence").notNull().default("monthly"),

  coa_ap_code: text("coa_ap_code").notNull(),   // 2000 | 2200
  coa_cost_code: text("coa_cost_code").notNull(), // 5000 | 5100 | 5200

  effective_from: text("effective_from"),  // YYYY-MM-DD, null = 계약 시작일
  effective_to: text("effective_to"),
  status: text("status").notNull().default("Active"),
  notes: text("notes"),
  deleted_at: timestamp("deleted_at"),
  // created_at / updated_at
});
```

### 기본값 (합의된 업무 규칙)

| 수취인 | 기본 | 계약별 대체 | cadence |
|---|---|---|---|
| **집주인** | `percent_of_rent` — **순수 월세의 %** | `fixed_monthly` — 월 고정액 | `monthly` |
| **에이전트 Referral** | `fixed_once` — **고객 최초 결제 전액 기준 고정액** | `percent_of_rent` — 월 순수 월세의 % | `once` |
| **서비스 파트너** | `fixed_once` — 작업지시 단가 | `percent_of_rent` | `per_job` |

### `percent_of_rent`의 base = **순수 월세분만**

확정된 업무 규칙 2개:

1. **관리비 · 수도세 · 전기세는 세입자가 관리사무소 · 관계 기관에 직접 납부한다.**
   → **우리 장부를 통과하지 않는다.** 인보이스에도, 수취에도, AR에도 존재하지 않는다.
2. 부가세는 월세와 별도다.

따라서 실무상 **수취액 ≈ 월세**이며 base 계산은 단순하다. 그럼에도 base를 총액이 아니라
**월세 항목 합계**로 정의하는 이유는 월세 외 항목이 인보이스에 섞이는 경우가 실재하기 때문이다 —
**입주청소비 · 위약금 · 연체이자 · 보증금**. 이것들이 base에 들어가면 집주인 지급액이 과다 산정된다.

```
base = Σ invoice_line_items.total_amount  WHERE charge_kind = 'rent'
```

이를 위해 `invoice_line_items`에 **`charge_kind` 컬럼을 신설**한다.
(현재 `line_type`은 `revenue | deposit` 2값뿐이라 월세와 청소비·위약금을 구분하지 못한다.)

```ts
// invoice_line_items 확장
charge_kind: text("charge_kind").notNull().default("rent"),
//   rent     월세      ← percent_of_rent의 유일한 base
//   vat      부가세     (과세 대상 계약만)
//   deposit  보증금     (기존 line_type='deposit'과 정합)
//   other    기타       (입주청소비·위약금·연체이자 등 일회성)
//
// 관리비/공과금 값은 두지 않는다 — 세입자 직납이라 우리 인보이스에 존재할 수 없다.
// 만약 이 값이 필요해지는 계약이 생기면, 그것은 우리가 대납·정산하는 구조로
// 업무가 바뀐 것이므로 스펙을 먼저 갱신한다.
```

> **백필**: 기존 라인은 전부 `charge_kind='rent'`로 들어간다. 관리비·공과금이 섞일 일이 없으므로
> 대체로 안전하나, **입주청소비·위약금이 월세 인보이스에 합산된 건**이 있으면 base가 부풀려진다.
> 마이그레이션 후 여수 실계약 인보이스를 표본 확인한 뒤 자동 leg 생성을 켠다.

**Edubee와의 base 차이**: Edubee는 계약 총액 기준(`총액 × rate/100`)이다. 우리는 **회차별 순수 월세 기준**이라
공식이 다르다 — 코드를 복사할 때 base 해석을 그대로 가져오면 안 된다.

**단일 소스 규약**: 프론트 자동계산은 서버 `calcPayout(term, invoice)` 한 함수만 호출한다.
화면의 "73.5%"와 장부의 "73.5%"가 갈리지 않게 한다 (Edubee가 `calcCommissionAmount` 중복 구현으로 겪은 드리프트).

### 에이전트 Referral — 최초 수취 1회 한정

확정된 업무 규칙: **최초 결제 수취 즉시 지급**. 따라서 `trigger='on_ar_paid'` + `cadence='once'`이고,
**월 수취마다 반복 발생하지 않도록 멱등 가드가 필수**다.

```
cadence='once' 인 term은 (contract_id, term_id) 당 provider_settlements 행이 최대 1건.
   → UNIQUE (term_id) WHERE cadence='once' AND deleted_at IS NULL
```

이 가드가 없으면 **매월 커미션이 재발생**한다. 자동 생성 로직의 최우선 검증 항목.

### 기본값 승계

계약 생성 시 `contract_payout_terms`를 자동 시드한다:
- 집주인 % → 공간/프로퍼티의 소유주 계약 조건 (없으면 테넌트 기본값)
- 파트너 단가 → 기존 `rental_fee_schedules`(타입별 수수료 기준표) 재사용 — **새 요율 체계를 만들지 않는다**
- 에이전트 → 기존 `commissions` 요율 마스터 재사용

---

## 3. Legs — 입금 1건 → 지급 N건 (Edubee `split` 이식)

### 3.1 정산 원장 `provider_settlements` (AusBridge에서 이식 + 확장)

AusBridge의 [`provider_settlements`](../../../ausbridge/lib/db/src/schema/provider_settlements.ts)를
정본으로 채택한다. `party_type` + `cadence` 제네릭 설계가 이미 다수 수취인을 커버한다.

**확장 4개:**

```ts
  // ① 수취인 축 확장: provider | partner → + landlord | service_host | agent
  party_type: text("party_type").notNull(),
  landlord_account_id: integer("landlord_account_id"),

  // ② LEG 링크 (Edubee parent_transaction_id + split_role)
  source_type: text("source_type"),       // invoice | placement_payment
  source_id: integer("source_id"),        // 이 분배를 낳은 수취 건
  split_role: text("split_role").notNull().default("external_payment"),
  //   external_payment = 외부 지급 (집주인·파트너·에이전트)
  //   internal_transfer = 유보분 = 실 매출

  // ③ 산출 근거 (감사 추적)
  term_id: integer("term_id"),            // contract_payout_terms.id
  basis_snapshot: text("basis_snapshot"), // 'percent_of_receipt'
  rate_snapshot: numeric("rate_snapshot", { precision: 5, scale: 2 }),
  base_amount: numeric("base_amount", { precision: 14, scale: 2 }),

  // ④ 계약 축
  contract_id: integer("contract_id"),
```

기존 컬럼 의미는 유지: `gross_amount − deduction_amount = amount`(NET 지급액),
상태 `due → approved → paid (+ cancelled)`.

### 3.2 자동 생성 (`on_ar_paid`)

인보이스가 Paid로 전이하는 **바로 그 트랜잭션 훅**에서:

```
1. invoice → contract_id 해석
2. rentBase = Σ invoice_line_items.total_amount WHERE charge_kind='rent'
   (보증금 라인은 제외 — 이미 2100 예수보증금으로 분리되어 매출이 아니다)
3. contract_payout_terms 중 trigger='on_ar_paid' AND 유효기간 내 조회
4. 각 term에 대해:
     cadence='once' 이고 이미 정산 행이 있으면 → SKIP (멱등 가드)
     basis='percent_of_rent'  → amount = rentBase × rate/100
     basis='fixed_monthly'    → amount = term.amount
     basis='fixed_once'       → amount = term.amount  (최초 수취에만)
   → provider_settlements 1행 (split_role='external_payment', status='due')
     basis_snapshot / rate_snapshot / base_amount 박제
5. 잔액 = 수취총액 − Σ(생성된 legs) → retained leg 1행
     split_role = 'internal_transfer', status = 'paid'
6. balanced 검증: |수취총액 − Σ legs| < 0.01. 실패 시 legs 롤백 + 경고 로그
```

> **4단계의 base와 5단계의 base가 다르다** — 지급액은 *월세 항목*으로 계산하지만,
> 대사는 *수취 총액*으로 맞춘다. 관리비·공과금은 세입자 직납이라 애초에 여기 없고,
> 차액이 생기는 경우는 월세 인보이스에 **입주청소비·위약금·부가세**가 함께 청구된 건뿐이다.
> 그 차액은 **retained에 흡수**된다 — 집주인 몫이 아닌 우리 수입이므로 정확한 처리다.

관리자가 하는 일은 **[지급] 버튼**뿐이다. 금액 계산·수취인 결정·계정 배정은 전부 자동이다.

> **best-effort 원칙 유지**: GL 포스팅과 마찬가지로 leg 생성 실패가 결제 플로우를 절대 깨뜨리면 안 된다.
> 실패 시 로그 + `settlement_generation_failed` 플래그, 정산 보드에 ⚠️ 배지. 결제는 성공 처리한다.

### 3.3 분개 규칙

| 이벤트 | 차변 | 대변 |
|---|---|---|
| 인보이스 발행 | 1100 매출채권 | 4000 매출 |
| 인보이스 수납 | 1000 현금 | 1100 매출채권 |
| ├ 보증금 라인 | 1000 현금 | 2100 예수보증금 |
| leg 승인 — 집주인 | 5200 집주인 렌트 | 2200 공급처 미지급금 |
| leg 승인 — 파트너 | 5100 파트너 외주비 | 2200 공급처 미지급금 |
| leg 승인 — 에이전트 | 5000 커미션 | 2000 커미션 미지급금 |
| leg 지급 | 2200 / 2000 | 1000 현금 |
| retained leg | *(분개 없음 — 파생값)* | |
| 퇴거 정산 | 2100 예수보증금 | 1000 현금(환급) + 4000 매출(공제) |

### 3.4 retained leg는 분개하지 않는다 — **권장 확정**

**결론: 분개하지 않는다.** retained는 원장의 파생값이지 별도 거래가 아니다.

이유 — 위 분개표를 그대로 따르면 실 매출은 **이미 원장에서 나온다**:

```
4000 매출          1,700,000   (수취 시 전액 인식)
5200 집주인 렌트   −1,250,000
5100 파트너 외주비    −88,000
5000 에이전트 커미션  −50,000
──────────────────────────────
매출총이익           312,000   ← 이것이 retained
```

여기에 retained를 또 분개하면 **같은 이익을 두 번 계상**하게 되고, 대차를 맞추려면
의미 없는 상대계정을 만들어야 한다. 정보는 하나도 늘지 않고 대사만 복잡해진다.

따라서 retained leg는 **`posting_key = NULL`인 대사 전용 행**이다. 역할은 두 가지:
1. `received === Σlegs` 불변식을 성립시켜 **분배 누락을 탐지**한다
2. 정산 보드에서 건별 실 매출을 **한 줄로 보여준다**

> **참고 — 이 결정의 배경에 있는 진짜 질문**: 우리가 본인(principal)인가 대리인(agent)인가.
> 현 설계는 **본인 모델**(총액 매출 + 원가)이다. 대리인 모델이라면 집주인 렌트는 애초에 매출을 거치지 않고
> 예수금으로 처리되며, 매출은 마진만 인식한다. Edubee는 이를 `revenue_model: 'trust' | 'buy_sell'`로
> 명시 모델링한다. **마진 숫자는 두 모델이 동일**하므로 지금 바꿀 이유는 없으나,
> 세무·감사 요구가 생기면 `contract_payout_terms`에 `revenue_model` 플래그를 추가하는 것으로 확장 가능하다.
> 현 단계에서는 **총액 모델 유지 + retained 미분개**를 권장한다.

### 3.5 신규 이식 항목

**`postInvoiceIssued`가 Metheim에 없다** — 이것을 추가해야 1100 매출채권이 생기고, 미수·Aging이 성립한다.
AusBridge `gl.ts:146`에 이미 구현되어 있으므로 **설계를 참조해 Metheim 코드로 재작성**한다
(계정 코드가 다르므로 파일 복사가 아니라 역할 매핑 후 이식).

`posting_key` 멱등 규약은 양쪽 동일하게 유지:
`invoice_issued:{id}` · `invoice_paid:{id}` · `settlement_approved:{id}` · `settlement_paid:{id}`

---

## 4. 연결(Linking) — 모든 돈은 역추적 가능해야 한다

Edubee가 모든 재무 행에 링크 컬럼을 심어 둔 이유는 **"이 돈이 왜 나갔는가"를 클릭 한 번으로 되짚기 위함**이다.
동일 규약을 채택한다.

| 링크 | 컬럼 | 의미 |
|---|---|---|
| 계약 | `contract_id` | 어느 계약의 돈인가 |
| 수취 원본 | `source_type` + `source_id` | 어느 입금에서 갈라져 나왔나 |
| 지급 조건 | `term_id` + `rate_snapshot` | 왜 이 금액인가 |
| 분개 | `posting_key` | 장부의 어느 줄인가 |
| 은행 | `bank_transaction_id` | 실제로 통장에서 나갔나 |
| 수취인 | `*_account_id` ∥ `payee_name` | 누구에게 갔나 |

**규약 3개:**
1. **`payee_account_id`가 없으면 `payee_name`(자유 텍스트)을 필수로 한다.** Edubee가 `counterpartyName`을
   추가한 이유 — 수취인 미상인 지급 행은 감사 불가.
2. **`rate_snapshot` / `base_amount`는 계산 시점에 박제한다.** 나중에 요율 마스터를 고쳐도 과거 정산은 불변.
3. **정산된 행(`approved`/`paid`)은 읽기 전용.** 금액 수정 시 403/409. 정정은 취소 후 재발행 경로로만.
   (Edubee `lineLock.ts` / `amountChangeBlocked` 규약)

---

## 5. Transaction(범용 거래 + 승인 워크플로) — 채택 여부

Edubee `transactions`는 `draft → submitted → journal_posted → confirmed → paid` 5단계 승인 워크플로와
문서 OCR 추출, 중복 검사, 분할 제안(`split-suggest`)까지 갖춘 3,158줄짜리 모듈이다.

**판단: 지금은 채택하지 않는다. Phase 3로 유보.**

이유 — Metheim/AusBridge에는 이미 `invoices`(유입)와 `journal_entries`(원장)가 있다.
여기에 세 번째 자금 테이블을 넣으면 **3자 대사 문제**가 생긴다(Edubee는 이미
`aud_equivalent`/`exchange_rate_to_aud` 컬럼이 "아무도 안 쓰는 죽은 컬럼"으로 남는 부채를 겪었다).

**단, 다음 두 요소는 지금 가져온다:**
- **`split-suggest`의 발상** → §3.2 자동 leg 생성으로 흡수 (이미 반영됨)
- **승인 단계** → `provider_settlements.status`의 `due → approved → paid`가 이미 3단계 승인이다.
  별도 워크플로 엔진 불필요.

**Phase 3에서 `transactions`가 필요해지는 시점**: 인보이스에 걸리지 않는 **일반 경비**(사무실 임차료, 급여,
마케팅비)를 장부에 넣어야 할 때. 그때는 Edubee 모듈을 통째로 이식하되 `expense_category` +
`workflow_status`만 취하고 split 로직은 §3의 leg 모델로 대체한다.

---

## 6. 관리자 UI — 정산 보드 하나

여러 회계 메뉴를 돌아다니지 않게 한다. **계약 1건 = 1행**, 펼치면 그 건의 자금 흐름 전체:

```
┌ C-2026-0117 · 여수 A동 302호 · 김OO ──────────── 실 매출 ₩312,000 (18.4%) ✅
│
│  받을 돈 (AR)   3월분 청구             ₩1,750,000   3/25 입금완료
│                   ├ 월세                ₩1,700,000   ← % 산정 base
│                   └ 입주청소비           ₩   50,000
│  ────────────────────────────────────────────────────────────────
│  줄 돈 (AP)     집주인 홍OO   월세의 73.5%  ₩1,250,000  3/28 대기 ⏳ [지급]
│                 청소 (주)OO   건당 고정      ₩   88,000  3/30 대기 ⏳ [지급]
│                 에이전트 이OO  1회 고정      ₩   50,000  승인대기   [승인]
│  ────────────────────────────────────────────────────────────────
│  유보 (실 매출)                          ₩  362,000
│
│  ℹ 관리비·공과금은 세입자 직납 — 이 장부에 나타나지 않음
```

- **AR을 항목별로 펼쳐 보인다** — `charge_kind`별 소계. **% 산정 base가 월세 줄임을 화면에서 증명**한다.
  (base가 총액인지 월세인지 눈으로 확인되지 않으면 지급액 오류를 아무도 못 잡는다.)
- **세입자 직납 항목은 안내 문구로만 표시.** 금액을 넣지 않는다 — 우리가 수취하지 않은 돈이 장부에
  숫자로 등장하면 대사가 영구히 안 맞는다.
- **`실 매출` 줄이 곧 retained leg.** 대시보드 매출은 이 값의 합계로 교체한다.
- **각 금액 옆에 산출 근거**(`월세의 73.5%`)를 표시 — `basis_snapshot` + `rate_snapshot`에서 렌더.
- **`balanced=false`면 행 전체가 ⚠️ 경고 색**으로 뜬다.
- **주간 Pay Run**: AusBridge `/v1/ap/pay-run`을 그대로 쓴다. 수취인별로 묶어 일괄 승인 → 이체 CSV →
  은행 임포트 대사. 관리자 주간 루틴이 클릭 3번.

**⚠️ 통화 합계 규약**: 모든 합계는 `GROUP BY currency` 필수.
(Edubee가 THB+AUD를 더해 `A$422,246`을 표시한 사고 — 다국 통화 테넌트가 있는 우리는 동일 위험군이다.)

---

## 7. 단계별 구현

각 앱이 **독립적으로** 진행한다. 아래는 Metheim 기준이며, AusBridge는 이미 보유한 단계를 건너뛴다.

| 단계 | 산출물 | Metheim | AusBridge 상태 |
|---|---|---|---|
| **0** ✅ | 계정 정비 | `1100 매출채권` · `5300 임차료`, COA 시드 정렬 | 보유 (자체 코드) |
| **1** ✅ | 청구 항목 분해 | `invoice_line_items.charge_kind` | 자체 판단 |
| **2** ✅ | AR 성립 | `postInvoiceIssued` (1100), 발행 경로 연결 | 보유 |
| **3** ✅ | 지급 조건 | `contract_payout_terms` + CRUD API | 신규 |
| **4** ✅ | 정산 원장 | `provider_settlements` + 정산보드/PayRun/Aging API | 보유 → 확장분만 |
| **5** ✅ | 자동 leg 생성 | `on_ar_paid` 훅 + `calcPayout()` + 멱등 가드 | 신규 |
| **6** ✅ | 실 매출 전환 | dashboard KPI + finance/summary·revenue/monthly에 net | 신규 |
| **7** ✅ | 화면 | 정산 보드 탭 + Pay Run 페이지 | Aging/Reports 보유 |
| **8** ✅ | 은행 대사 | `bank_accounts` / `bank_transactions` + 매칭·대사 UI | 보유 |
| **(후순위)** | 범용 Transaction | 유보 — §5 조건 충족 시 | 유보 |

**0~8단계 완료 (2026-08-04~05, 마이그레이션 0039·0040 양 DB 적용).**

### 8단계 설계 요점

- **`amount`는 부호를 갖는다** (+입금 / −출금). 이 한 가지 규약 덕분에 명세 라인을
  분개의 현금계정 순증감과 **직접 비교**할 수 있다.
- **`dedupe_key`로 재임포트 무효화.** 실무자는 겹치는 기간을 반복 내보내므로,
  한 달치가 조용히 두 배가 되는 것보다 **아무것도 안 들어오는 편이 낫다.**
  화면은 항상 "40건 중 40건 가져옴 / 20건 건너뜀"을 표시한다.
- **분개 1건 = 명세 1줄** (부분 유니크 인덱스). 한 번의 지급으로 서로 다른 두 입출금을
  "설명해 버리는" 것을 막는다.
- **미대사 0건만으로는 대사 완료가 아니다.** 전 라인이 매칭돼도 잔액 차이가 남을 수 있다.
  `fully_reconciled`는 **미대사 0 AND 잔액차 0** 둘 다 충족할 때만 참이다.
- **존재하지 않는 계정 코드는 거부**(400). 오타 난 코드로 균형만 맞는 분개를 만들면
  나중에 아무도 그 라인을 찾을 수 없다.

> ⚠️ **1단계(`charge_kind` 백필 확인)를 5단계보다 반드시 먼저 끝낼 것.** 순서가 뒤집히면
> 입주청소비·위약금이 섞인 base로 **집주인 지급액이 과다 산정된 채 실제 송금이 나간다.**

### 참조 방향 (코드 복사가 아니라 설계 참조)

두 앱은 독립이므로 **파일을 그대로 복사하지 않는다.** 계정 코드·스키마가 다르므로
§1 역할 축으로 매핑한 뒤 각자 코드로 재작성한다.

- **AusBridge에서 참조할 것** (구현이 앞서 있음): `postInvoiceIssued`, `provider_settlements` 설계,
  `finance-reports.ts`(AR/AP Aging · P&L · BS · Pay Run), 은행 대사 매칭 로직,
  화면 7종(`Aging` / `AccountLedger` / `FinanceReports` / `SettlementList` / `BankReconciliation` /
  `ChartOfAccounts` / `JournalEntryNew`)
- **AusBridge에 제공할 것**: `contract_payout_terms` 모델, 집주인(landlord) 축,
  `charge_kind` 기반 base 분리, `deposit_settlements`(예수보증금 릴리스)
- **Edubee에서 참조할 것**: leg/split 발상, 링크 6축 규약, 정산 행 잠금 규약 — **설계만** 가져온다
  (Edubee는 멀티테넌트 스키마·uuid PK라 코드 이식 불가)

---

## 8. 결정 사항 · 남은 항목

### ✅ 확정 (2026-08-03)

| # | 항목 | 결정 |
|---|---|---|
| ① | 앱 간 관계 | **완전 독립.** 업무 참조만 하며 데이터·계정과목·마이그레이션 미공유 (→ §1 역할 축) |
| ② | retained leg 분개 | **분개하지 않는다.** 파생값이며 분개 시 이익 이중계상 (→ §3.4) |
| ③ | 집주인 % base | **순수 월세만.** 부가세 별도 (→ §2 `charge_kind`) |
| ④ | 에이전트 Referral 시점 | **최초 결제 수취 즉시.** `on_ar_paid` + `cadence='once'` + 멱등 가드 (→ §2) |
| ⑤ | 관리비·수도세·전기세 | **세입자가 관리사무소·관계 기관에 직접 납부.** 우리 장부를 통과하지 않으므로 인보이스·AR·leg 어디에도 넣지 않는다 |

### 🟡 남은 항목

1. **`charge_kind` 백필 확인** — 기존 인보이스 라인이 전부 `rent`로 들어간다. 관리비는 애초에 없으므로
   대체로 안전하나, **입주청소비·위약금이 월세 인보이스에 합산된 건**이 있으면 base가 부풀려진다.
   자동 leg 생성을 켜기 전 여수 실계약 표본 확인 (→ §2).
2. **부가세 적용 여부** — 주거용 임대는 면세, 상업용은 과세다. 여수 세대가 전부 주거용이면
   `charge_kind='vat'` 라인은 실제로 생기지 않는다. 컬럼은 두되 **사용 여부는 계약 유형 확인 후 결정**.
   매출세액/매입세액 분리 계정과 신고 산출은 현 스펙 범위 밖.
3. **퇴거 시 미납 공과금 공제** — 세입자 직납 구조에서는 미납 공과금이 **우리 장부에 잡히지 않는다.**
   그런데 실무상 퇴거 정산에서 미납분을 보증금에서 공제하는 경우가 있다. 이는 `deposit_settlements`의
   공제 항목으로 처리하면 되므로 본 스펙 변경은 불필요하나, **퇴거 정산 화면에 "외부 미납금" 공제
   항목이 있는지** 확인이 필요하다. (해당 시 §3.3의 퇴거 분개 그대로 — 2100 차변 / 4000 대변)

---

## 참조

- Metheim 현재 원장: [gl.ts](../../artifacts/api-server/src/lib/billing/gl.ts) · [journal.ts](../../lib/db/src/schema/journal.ts)
- AusBridge 회계: `ausbridge/artifacts/api-server/src/routes/{accounting,finance-reports,settlements,bank}.ts`
- Edubee 참조 구현: `Edubee-CRM/artifacts/api-server/src/routes/accounting-{arap,transactions}.ts` ·
  `lib/db/src/schema/finance.ts` (`contract_finance_items`) · `contracts.ts` (`contract_products` AR/AP 컬럼)
- 관련 문서: [CONDITION_REPORTS_SETTLEMENT.md](CONDITION_REPORTS_SETTLEMENT.md) (퇴거 정산 · 2100 릴리스)

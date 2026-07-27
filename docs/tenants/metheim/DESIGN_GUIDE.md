# Metheim — 테넌트 디자인 가이드

> **파일 위치:** `docs/tenants/metheim/DESIGN_GUIDE.md`
> **테넌트 코드:** `metheim` · **버전:** v1.0 · **브랜드 방향:** Urban Teal / *Night Harbor*
> **정본 출처:** `METHEIM-YEOSU-Brand-Guidelines.md` (브랜드) + 테넌트 디자인 가이드 표준 양식(시스템)

---

## 0. 이 문서를 쓰는 법 (Claude Code 규칙)

1. **이 문서가 단일 소스**다. 색·폰트·간격 값이 코드와 다르면 이 문서를 먼저 고치고 코드를 맞춘다.
2. **컴포넌트에서 raw hex 금지.** 항상 시맨틱 토큰(`bg-background`, `text-foreground`, `border-border` 등)을 쓴다.
   원시 팔레트 hex는 `brand.overrides.css` / `theme.ts` **단 두 곳에만** 존재한다.
3. **상태 표기 규칙** — 문서 전체에서 아래 기호를 사용한다.
   - ✅ **확정** : 그대로 구현
   - ⚠️ **미확정** : 임의 값 입력 금지, 담당자 확인 후 기입
   - 🅿️ **제안** : 브랜드 정본에 정의가 없어 본 문서가 제안한 값. 구현 가능하나 승인 필요
4. ⚠️ 표시된 값을 **추측해서 채우지 않는다.** 플레이스홀더(`—`)를 남기고 §부록 B 체크리스트에 올린다.
5. 브랜드 가이드에 없는 신규 컴포넌트는 §A6의 토큰·상태 규칙을 상속해 만들고, 확정 후 이 문서에 추가한다.

---

## 0-1. 테넌트 메타

| 항목 | 값 | 실제 매핑 | 상태 |
|---|---|---|---|
| 테넌트 코드 | `metheim` | 배포 slug / 워크트리 | ✅ |
| 브랜드 표기(UI 본문) | `Metheim` | `VITE_APP_NAME` | ✅ |
| 브랜드 표기(로고·워드마크) | `METHEIM YEOSU` (전부 대문자) | SVG 자산 | ✅ |
| 금지 표기 | `MetHeim` `Met Heim` `메트하임여수`(붙여쓰기) | — | ✅ |
| 한글 표기 | 메트하임 여수 | i18n `ko` | ✅ |
| 태그라인 | PREMIUM URBAN SMALL APARTMENT | 히어로 eyebrow | ✅ |
| 사이트 모드 | `development` (단일 건물) | `VITE_SITE_MODE` | ✅ |
| 상품 유형 | 도시형 생활주택 · 풀옵션 소형 | 카피/메타 | ✅ |
| 지원 로케일 | `ko` (기본) / `en`·`ja`·`zh` 확장 후보 | i18n | ⚠️ 확장 범위 미확정 |
| 도메인 | `metheim-web` / `-admin` / `-owner` / `-agent` / `-host` | Vercel / Railway | ⚠️ 사용할 포털 종류 미확정 |
| 운영 형태 | 장기임대 / 단기·숙박 / 병행 | 모듈 on-off 분기 | ⚠️ **미확정 — 모듈 구성의 선행 조건** |

> **표기 충돌 정리** — 시스템 표준 양식은 `Metheim` 단일 표기를 요구하고, 브랜드 정본은 `METHEIM YEOSU`를 워드마크로 쓴다.
> **해결:** 로고·워드마크·문서 표지 = `METHEIM YEOSU` / UI 본문·이메일 텍스트·코드 문자열 = `Metheim` / slug·env = `metheim`.

---

# Part A — 화면 · 디지털 가이드

## A1. 로고

### A1-1. 자산 목록

| 용도 | 파일 | 매핑 |
|---|---|---|
| 라이트 배경(기본) | `metheim-logo-horizontal-teal.svg` | `VITE_LOGO_URL` (빌드타임) |
| 다크 배경 | `metheim-logo-horizontal-white.svg` | `branding_settings.logo_dark_url` (런타임) — **`VITE_LOGO_URL_DARK`는 존재하지 않음** |
| 티일 패널(브랜드 면 위) | `metheim-symbol-champagne.svg` | 히어로·사이드바 |
| 심볼(라이트) | `metheim-symbol-teal.svg` | `VITE_LOGO_MARK_URL` / `BrandMark` |
| 심볼(다크·티일) | `metheim-symbol-champagne.svg` | 다크 헤더 |
| 파비콘 | `favicon.svg` | `VITE_FAVICON` / `branding_settings.favicon_url` |

> 실제 존재하는 자산: `tenants/metheim/logos/` = teal/white 가로 락업 + teal/champagne 심볼 + favicon. `-gold` 심볼, `-32.png`, `apple-touch-icon.png`는 미제작(필요 시 락업에서 재추출).

### A1-2. 다크모드 처리

- **"흰색 필터 + 2x" 규칙을 쓰지 않는다.** 전용 White SVG가 있으므로 **자산 교체 방식**으로 처리한다.
- CSS `filter: brightness(0) invert(1)` 사용 금지 — 심볼 내부 골드 요소가 함께 뭉개진다.
- 다크 로고 URL의 정본은 **런타임 `branding_settings.logo_dark_url`**(Settings → Design & Branding, 또는 [tenants/metheim/branding-settings.seed.sql](../../../tenants/metheim/branding-settings.seed.sql)). 빌드타임 `VITE_LOGO_URL_DARK`는 어느 앱도 읽지 않으므로 만들지 않는다.

```tsx
// 관리자 다크 사이드바: 런타임 branding 값을 읽어 자산 교체
const logo = darkSurface ? branding.logo_dark_url : branding.logo_url;
```

### A1-3. 여백 · 최소 크기

| 항목 | 값 |
|---|---|
| 보호 여백(clear space) | 로고 사방으로 워드마크 **"M" 높이 이상** |
| 최소 크기 — 가로 조합 | `120px` |
| 최소 크기 — 심볼 단독 | `24px` |
| 파비콘 | `16px`까지 대응 |
| 헤더 로고 높이 | 랜딩 `32px` / 관리자 크롬 `28px` / 로그인 화면 `40px` / 문서 `40px` |

### A1-4. 금지

비율 왜곡 · 회전 · 기울임 · 팔레트 외 색상 · 그라데이션 · 그림자(`drop-shadow`) · 심볼 요소 재배열 · 저대비 배경 배치.

---

## A2. 색상

### A2-1. 원시 팔레트 (Raw palette — `brand.overrides.css`에만 존재)

**Brand**

| 토큰 | HEX | 용도 |
|---|---|---|
| `--teal` | `#005F73` | 주색. 헤더 · Primary · 강조 |
| `--teal-900` | `#00323D` | 밤바다. 사이드바 · 다크 면 |
| `--teal-700` | `#004E5F` | Primary hover |
| `--teal-050` | `#E7F0F1` | 틴트 배경 · 행 hover · 태그 |
| `--champagne` | `#E6D5B8` | 티일 위 로고 · 장식 |
| `--gold` | `#C6942E` | Accent CTA · 강조선 |
| `--gold-700` | `#A87C1F` | Accent hover |
| `--brick` | `#EE9B00` | 포인트 전용(≤3%) |
| `--cream` | `#F4EFE1` | 따뜻한 라이트 배경 |

**Neutral**

| 토큰 | HEX | 토큰 | HEX |
|---|---|---|---|
| `--ink` | `#12232B` | `--gray-300` | `#C7D0D3` |
| `--slate` | `#33474F` | `--gray-200` | `#E4E9EA` |
| `--gray-500` | `#78868C` | `--gray-100` | `#F1F4F4` |
| `--gray-400` | `#9FABB0` 🅿️ (placeholder 전용) | `--white` | `#FFFFFF` |

**Semantic (상태)**

| 토큰 | HEX | 용도 |
|---|---|---|
| `--success` | `#1F8A70` | 완료 · 정상 · 거주중 |
| `--warning` | `#E8A317` | 대기 · 주의 |
| `--danger` | `#C24A3A` | 오류 · 삭제 · 연체 |
| `--info` | `#227C93` | 안내 |

### A2-2. 시맨틱 토큰 매핑 (라이트 / 다크)

다크 값은 브랜드 정본에 정의가 없어 **전부 🅿️ 제안**이다. 관리자 다크모드 승인 전까지 라이트만 배포한다.

| 시맨틱 토큰 | Light | Dark 🅿️ | 비고 |
|---|---|---|---|
| `--background` | `#F1F4F4` | `#0B1A20` | 관리자 본문 바탕 |
| `--foreground` | `#12232B` | `#E7EDEF` | |
| `--card` | `#FFFFFF` | `#12232B` | |
| `--card-foreground` | `#12232B` | `#E7EDEF` | |
| `--muted` | `#F1F4F4` | `#16272F` | |
| `--muted-foreground` | `#78868C` | `#93A3A9` | |
| `--border` | `#E4E9EA` | `#24363E` | |
| `--input` | `#C7D0D3` | `#33474F` | 입력 테두리 |
| `--ring` | `rgba(0,95,115,.14)` | `rgba(77,179,199,.22)` | 포커스 링 |
| `--primary` | `#005F73` | `#3D9DB2` | 다크는 대비 확보용 명도 상향 |
| `--primary-foreground` | `#FFFFFF` | `#00232B` | |
| `--secondary` | `#E7F0F1` | `#1B333C` | |
| `--accent` | `#C6942E` | `#D9A94A` | 골드 |
| `--accent-foreground` | `#3A2B08` | `#231903` | |
| `--destructive` | `#C24A3A` | `#D9634F` | |
| `--success` | `#1F8A70` | `#37A98D` | |
| `--warning` | `#E8A317` | `#F0B740` | |
| `--info` | `#227C93` | `#3D9DB2` | |
| `--sidebar` | `#00323D` | `#00232B` | 라이트에서도 사이드바는 딥 티일 고정 |
| `--sidebar-foreground` | `#E6EEF0` | `#E6EEF0` | |
| `--sidebar-accent` | `#C6942E` | `#D9A94A` | 활성 메뉴 인디케이터 |

> 프로젝트 토큰 포맷이 HSL 채널 방식(`--primary: 191 100% 23%`)이면 위 hex를 변환해 넣는다. 값의 정본은 hex다.

### A2-3. 사용 비율 — 60 · 30 · 10

| 비율 | 색 | 역할 |
|---|---|---|
| 60% | 크림 · 화이트 · 그레이 | 넓은 바탕 |
| 30% | Urban Teal | 헤더 · 사이드바 · 핵심 면 |
| 7% | Gold | CTA · 강조선 · 아이콘 |
| 3% | Brick | 최소 포인트 |

- 골드·브릭을 **넓은 면(배경·섹션 전체)에 채우지 않는다.** 포인트 색이 면적을 차지하면 프리미엄이 아니라 산만함으로 읽힌다.
- 랜딩: 크림/화이트 비중 상향, 티일은 히어로·CTA에 집중.
- 관리자: 사이드바만 티일, 본문은 무채색 + 상태색. 골드는 절제, 브릭은 '주의' 신호에만.

### A2-4. 대비 기준

- 본문 텍스트 대비 **4.5:1 이상**, 큰 제목(18pt/24px+ 또는 14pt bold+) **3:1 이상**.
- 금지 조합: 크림(`#F4EFE1`) 위 골드(`#C6942E`) 본문 텍스트, 티일(`#005F73`) 위 브릭(`#EE9B00`) 텍스트.
- 골드 버튼의 텍스트는 흰색이 아니라 **`#3A2B08`**(다크 브라운). 흰색은 대비 미달.

---

## A3. 폰트

| 역할 | 서체 | 웨이트 | 매핑 |
|---|---|---|---|
| Display(제목·숫자 강조) | **Montserrat** | 600 / 700 / 800 | `--font-display` |
| Body / UI | **Pretendard** | 400 / 500 / 600 | `--font-body` |
| Mono(데이터·코드·오버라인) | **JetBrains Mono** | 400 / 500 | `--font-mono` |

```css
--font-display: 'Montserrat', 'Pretendard', sans-serif;
--font-body: 'Pretendard', 'Montserrat', -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
```

**다국어 폴백** — `'Pretendard', 'Noto Sans KR', 'Noto Sans JP', 'Noto Sans SC', 'Noto Sans TC', 'Noto Sans Thai', sans-serif`.
Montserrat에는 한글 글리프가 없다. **한글 제목도 Montserrat 스택으로 두면 자동으로 Pretendard로 폴백**되므로 혼용 문제 없음. 단, 한·영 혼합 제목은 자간이 어긋나 보일 수 있으니 `-0.01em` 이상 좁히지 않는다.

### A3-1. 타입 스케일

| 단계 | 크기 / 행간 | 웨이트 | 자간 | 서체 |
|---|---|---|---|---|
| Display | 48 / 50 | 800 | -0.02em | Display |
| H1 | 36 / 40 | 700 | -0.01em | Display |
| H2 | 28 / 32 | 700 | — | Display |
| H3 | 21 / 28 | 600 | — | Display |
| Body L | 18 / 29 | 400 | — | Body |
| Body | 16 / 26 | 400 | — | Body |
| Small | 14 / 21 | 400 | — | Body |
| Overline | 12 | 500 | +0.16em, 대문자 | Mono |

**모바일(≤640px) 축소 🅿️** — Display 34/38 · H1 28/34 · H2 22/28 · H3 18/24 · 본문은 유지.

---

## A4. 화면별 적용 (표면 3종)

### A4-1. 랜딩 (공개)

| 항목 | 값 |
|---|---|
| 셸 | `DevLayout` (`DevNavbar` / `DevFooter`) — dev-site 공용 셸 사용 |
| 헤더 | 배경 흰색 + 하단 `1px #E4E9EA`, 스크롤 시 `sh-1`. 로고 Teal 32px |
| 헤더 메뉴 | 브랜드 소개 · 평면·옵션 · 위치 · 입주 안내 · 문의 / 우측 Accent CTA 1개 |
| 히어로 | `radial-gradient` 딥 티일(`#00323D`→`#005F73`) + 샴페인 eyebrow + White 로고 |
| 이후 섹션 | 크림(`#F4EFE1`) / 화이트 교차, 섹션 상하 패딩 96px(모바일 48) |
| 푸터 | 배경 `#00323D`, 텍스트 `#E6EEF0`, 운영사 정보 + 사업자 정보(§B5) |
| CTA 규칙 | **화면당 골드 Accent 버튼 1개.** 반복 CTA는 Primary(티일)로 위계 하향 |
| 카피 폭 | 한 줄 40자 내외로 끊기. 1단 스크롤 서사, 섹션마다 메시지 하나 |

### A4-2. 관리자 (admin)

| 항목 | 값 |
|---|---|
| 레이아웃 | 좌측 고정 사이드바 `240px` (`#00323D`) + 본문 `#F1F4F4` |
| 로그인 로고 | 라이트 = Teal / 다크 = White, 높이 40px |
| 사이드바 활성 항목 | 배경 `rgba(255,255,255,.08)` + 좌측 `3px` 골드 인디케이터 |
| 콘텐츠 카드 | `#FFFFFF`, radius `md(10)`, `sh-1` |
| 밀도 | 테이블 행 높이 44~48px, 셀 패딩 12/16 |
| 색 사용 | 사이드바만 티일. 본문은 무채색 + 상태색 |
| 메뉴 구성 | 대시보드 · 호실 · 입주자 · 계약 · 문의 · 정산 (+ 운영 형태 확정 시 예약/하우스키핑) ⚠️ |
| 모듈 분기 | `HOMESTAY_MODULE_ENABLED` 등 ⚠️ 운영 형태 확정 후 결정 |
| 일관성 | 같은 행동은 같은 이름·같은 색. 동사 유지("저장 → 저장됨") |

### A4-3. 포털 (owner / agent / host)

| 항목 | 값 |
|---|---|
| 로그인 로고 | Teal 40px, 크림 배경 카드 위 |
| 크롬 로고 | 심볼 단독 28px |
| 대시보드 강조색 | Owner = Teal / Agent = Info(`#227C93`) 🅿️ / Host = Success(`#1F8A70`) 🅿️ |
| 공통 | 관리자와 동일 컴포넌트·토큰. 색만 강조 계열로 구분 |
| 사용 포털 | ⚠️ 어떤 포털을 운영할지 미확정 |

---

## A5. 지역화 · 표기 규칙

| 필드 | 값 | 매핑 |
|---|---|---|
| 기본 통화 | KRW (₩) | `VITE_DEFAULT_CURRENCY` |
| 소수점 | **0자리** (KRW는 ZERO_DECIMAL) | `ZERO_DECIMAL_CURRENCIES` |
| 금액 표기 | `₩680,000` — 3자리 콤마, 기호 앞 붙임 | 포매터 |
| 가격 단위 | `₩…/월` | `VITE_PRICE_UNIT` |
| 날짜 형식(화면·데이터) | `YYYY-MM-DD` 🅿️ | `VITE_DATE_FORMAT` |
| 날짜 형식(고객 노출 카피) | `2026년 3월 15일` | i18n |
| 시간 | 24시간제 `HH:mm` | |
| 타임존 | `Asia/Seoul` | `branding.timezone` |
| 국기 오버라이드 | `en → US flag` | `VITE_FLAG_OVERRIDES` |
| 전화 표기 | `061-000-0000` / `010-0000-0000` | 마스킹 시 `010-****-1234` |
| 주소 표기 | 도로명 우선, 시·도 → 시 → 도로명 순 | |

> ⚠️ 표준 양식 기본값은 `YYYY/MM/DD`다. 정렬·CSV 내보내기 일관성 때문에 `YYYY-MM-DD`를 제안하나 **둘 중 하나로 확정 필요**.

---

## A6. 컴포넌트 규격

### A6-1. 버튼

| Variant | 배경 | 텍스트 | 테두리 | 용도 |
|---|---|---|---|---|
| Primary | `--primary` | `#FFFFFF` | — | 기본 행동 (예약하기) |
| Accent | `--accent` | `#3A2B08` | — | 핵심 CTA (상담 신청) |
| Secondary | 투명 | `--primary` | `1.5px --primary` | 보조 (평면도 보기) |
| Ghost | 투명 | `--slate` | — | 낮은 위계 |
| Danger | `--destructive` | `#FFFFFF` | — | 삭제·파괴적 행동 |

**크기** — Small `7/14`, 13px · Medium `11/20`, 15px · Large `15/28`, 16px (패딩 = 상하/좌우 px)

**상태**

| 상태 | Primary | Accent | Secondary |
|---|---|---|---|
| Hover | `#004E5F` + `sh-2` | `#A87C1F` | 배경 `#E7F0F1` |
| Active | `#00323D` | `#8E6817` 🅿️ | 배경 `#D7E5E7` 🅿️ |
| Focus | 링 `0 0 0 4px rgba(0,95,115,.14)` | 골드 링 `rgba(198,148,46,.20)` 🅿️ | 티일 링 |
| Disabled | `opacity .45`, `cursor: not-allowed` | 동일 | 동일 |
| Loading 🅿️ | 스피너 + 라벨 유지, 클릭 차단 | 동일 | 동일 |

- 한 화면에 Accent 버튼은 **하나**. 포커스 링은 어떤 경우에도 제거하지 않는다.
- 버튼 라벨은 사용자가 하는 행동을 그대로 쓴다. "제출" ✕ → "예약하기" ○.

### A6-2. 폼 · 입력

| 요소 | 스펙 |
|---|---|
| Label | 13px / 600 / `#33474F`, 입력창 **위** 고정 |
| Input | 패딩 `11/14`, 테두리 `1.5px #C7D0D3`, radius `6` |
| Placeholder | `#9FABB0` (라벨 대체 금지) |
| Focus | 테두리 `#005F73` + 링 `0 0 0 4px rgba(0,95,115,.14)` |
| Error | 테두리 `#C24A3A` + 하단 도움말 `#C24A3A` 13px |
| Disabled | 배경 `#F1F4F4`, 텍스트 `#9FABB0` |
| 필수 표시 | 라벨 뒤 `*` `#C24A3A` |

**오류 문구 규칙** — 사과하지 않고 *원인 + 해결*을 쓴다.
- ○ `번호 11자리를 정확히 입력해 주세요.`
- ✕ `죄송합니다. 오류가 발생했습니다.`
- 성공: `예약이 접수되었습니다. 담당자가 1영업일 내 연락드립니다.`

### A6-3. 테이블

| 요소 | 스펙 |
|---|---|
| 테두리 | `1px #E4E9EA` |
| 헤더 | 배경 `#F1F4F4`, 볼드, 대문자, **가로 가운데정렬** |
| 본문 셀 | 패딩 `12/16`, **세로 가운데정렬**, 좌측정렬 기본 |
| 숫자 열 | 우측정렬 + Mono |
| 상태 열 | 배지 색 코딩, 가운데정렬 |
| 행 Hover | 배경 `#E7F0F1` |
| Zebra(선택) | 짝수 행 `#F1F4F4` |
| 빈 상태 | 아이콘 + 한 줄 안내 + 다음 행동 버튼 |

### A6-4. 배지 · 태그

| 상태 | 텍스트/테두리 | 배경 🅿️ |
|---|---|---|
| 거주중 (ok) | `#1F8A70` | `rgba(31,138,112,.10)` |
| 계약대기 (wait) | `#9A6B00` | `rgba(232,163,23,.12)` |
| 연체 (stop) | `#C24A3A` | `rgba(194,74,58,.10)` |
| 공실 (idle) 🅿️ | `#566268` | `#F1F4F4` |

**태그** — 배경 `#E7F0F1`, 텍스트 `#005F73`, `pill`, 12px/500. 예: `풀옵션` `주차가능` `역세권`

### A6-5. 알림 (Alert)

| 종류 | 배경 | 테두리 · 텍스트 |
|---|---|---|
| Info | `rgba(34,124,147,.07)` | `#227C93` |
| Success | `rgba(31,138,112,.08)` | `#1F8A70` |
| Warning | `rgba(232,163,23,.10)` | `#E8A317` |
| Error | `rgba(194,74,58,.08)` | `#C24A3A` |

좌측 `3px` 컬러 바 + 아이콘 20px + 본문 14px. 토스트는 `sh-3`, 우상단, 기본 4초 🅿️.

### A6-6. 지표 카드 (Stat)

- 라벨: 12px 대문자 `#78868C` (Mono, +0.16em)
- 값: Montserrat 800 / 34px / `#005F73`
- 증감: 호전 `#1F8A70` · 중립 `#78868C` · 악화 `#C24A3A`
- 카드: 흰 배경, radius `md`, 패딩 24, `sh-1`

---

## A7. 간격 · 라운드 · 그림자

- **Spacing (4pt 그리드):** `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96` (px)
- **Radius:** `xs 4` · `sm 6` · `md 10` · `lg 16` · `xl 22` · `pill 999`
- **Elevation:**
  - `--sh-1: 0 1px 3px rgba(18,35,43,.08)` — 카드 기본
  - `--sh-2: 0 6px 18px rgba(18,35,43,.10)` — 호버 · 팝오버
  - `--sh-3: 0 18px 44px rgba(18,35,43,.18)` — 모달 · 토스트
- **컨테이너 최대 폭 🅿️:** 랜딩 `1200px` / 관리자 콘텐츠 `1440px` / 폼 단일 컬럼 `640px`
- **브레이크포인트 🅿️:** `sm 640 · md 768 · lg 1024 · xl 1280`
- 라운드는 부드럽되 과하지 않게, 그림자는 얕고 은은하게. `sh-3`은 모달·토스트 외 사용 금지.

---

## A8. 이미지 · 아이콘

### A8-1. 사진 톤

| 톤 | 컬러 | 쓰임 |
|---|---|---|
| Deep Teal | `#00323D` → `#005F73` | 밤바다 · 야경 |
| Teal→Gold 듀오톤 | `#00323D` → `#C6942E` | 항구 불빛 |
| Champagne | `#E6D5B8` → `#C6942E` | 따뜻한 실내 |

| ✅ 권장 | ❌ 지양 |
|---|---|
| 자연광 · 저녁 온기, 정돈된 미니멀 공간 | 채도 높은 원색 · 형광, 어수선한 배경 |
| 건축 라인 · 질감 클로즈업, 여백 있는 구도 | 과도한 HDR · 비네팅, 값싸 보이는 스톡컷 |
| 톤이 튈 땐 티일 오버레이 10~20% | 사람 얼굴 클로즈업 위주 (공간이 주인공) |

**규격 🅿️** — 히어로 `2400×1350`(16:9) / 카드 `1200×900`(4:3) / 썸네일 `600×600`. WebP 우선, JPEG 폴백, 히어로 200KB 이하 목표. `alt`는 공간을 설명한다("연등동 원룸 주방 전경").

### A8-2. 아이콘

- 라인 아이콘 · 선 굵기 **1.75px** · 둥근 캡/조인 · **24px 그리드**
- 채움(fill)은 강조 시에만. 브랜드 모티프(열쇠 · 별 · 물결 · 집) 우선
- 크기 스케일 🅿️: `16 / 20 / 24 / 32`

### A8-3. 상징 사용 원칙

열쇠구멍 = 나만의 안전한 공간 · 등대와 별 = 집으로 이끄는 불빛 · 물결 = 여수 바다.
카피와 그래픽은 이 세 은유를 벗어나지 않되, **한 화면에 두 개 이상 겹쳐 쓰지 않는다.**

---

# Part B — 서류 · 문서 가이드

> **적용 범위** — 시스템이 자동 생성하는 PDF·이메일 문서(`theme.ts`의 `DOC_TOKENS` + `renderDocumentShell()`, HTML → Puppeteer → PDF).
> 사람이 직접 작성하는 기획서·보고서(Word)는 **SOHOLUTION 표준 폼**을 따르며 이 파트의 적용 대상이 아니다. (§부록 C)

## B1. 페이지 규격

| 필드 | 값 | 매핑 |
|---|---|---|
| 용지 | A4 | `@page { size: A4 }` |
| 페이지 여백 | `0` (내부 패딩으로 제어) | `@page { margin: 0 }` |
| 본문 패딩 | `32px` (compact `24px`) | `.doc-body` |
| 상단 브랜드 바 | `4px` `#005F73` | `.container` border-top |
| 카드 라운드 | 화면 `14px` / 인쇄 `0` | `DOC_TOKENS.radius` |
| 행간 | `1.5` | `DOC_TOKENS.lineHeight` |
| 페이지 분할 | 표 헤더 반복, 행 중간 분할 금지 | `break-inside: avoid` |

## B2. 문서 색상 토큰

| 토큰 키 | 값 | 비고 |
|---|---|---|
| `brand` | `#005F73` | 상단 바 · 라벨 · 합계 박스 |
| `brandHover` | `#004E5F` | 링크 hover(이메일 HTML) |
| `ink` | `#12232B` | 본문. 엔진 기본 `#111111` 대신 브랜드 잉크 사용 |
| `inkMuted` | `#566268` | 보조 텍스트 |
| `inkFaint` | `#9FABB0` | 캡션 · 주석 |
| `pageBg` | `#F1F4F4` | 페이지 배경 |
| `cardBg` | `#FFFFFF` | 카드 |
| `border` | `#E4E9EA` | 경계선 |
| `accentBg` | `#E7F0F1` | 강조 박스 배경 |
| `accentBorder` | `#B9D2D8` 🅿️ | 강조 박스 테두리 |

**워터마크 색 (`WATERMARK_COLORS`)** — `PAID #1F8A70` · `DRAFT #78868C` · `VOID #C24A3A` · `OVERDUE #E8A317` · `EXPIRED #78868C`. 대각선 45°, `opacity .10`.

> 안내·환영 성격의 문서(입주 안내문 등)에 한해 강조 박스를 샴페인 계열(`#FBF7EF` / `#E6D5B8`)로 대체할 수 있다 🅿️. 청구·계약 문서는 티일 고정.

## B3. 문서 폰트 · 타이포

| 필드 | 값 |
|---|---|
| 본문 폰트 | `'Noto Sans KR', 'Noto Sans', 'Noto Sans JP', 'Noto Sans SC', 'Noto Sans TC', 'Noto Sans Thai', sans-serif` |
| 제목·문서타입 라벨 | `'Montserrat', 'Noto Sans KR', sans-serif` |
| 숫자·모노 | `SFMono-Regular, Menlo, monospace` |
| 문서 타입 라벨 | 13px / 700 / 대문자 / 자간 `.08em` / `#005F73` |
| 섹션 제목 | 11px / 700 / 대문자 / 자간 `.08em` |
| 표 헤더 | 11px / 대문자 / 자간 `.06em` / 배경 `#F1F4F4` |
| 합계 박스 | 배경 `#005F73` + 흰 글자 22px (Montserrat 700) |
| 본문 | 11pt 상당 |

> PDF는 Puppeteer 렌더링이므로 **Pretendard를 쓰지 않는다.** 웹폰트 로딩 실패 시 글자 밀림이 발생한다. 문서는 Noto Sans 스택으로 고정.

## B4. 문서 구조

| 영역 | 내용 | 매핑 |
|---|---|---|
| 헤더 | 로고(높이 40px, Teal 버전) + 문서 타입 + 발행사(법인명 / 사업자등록번호 / 이메일) | `.doc-header` + `company` |
| 바닥글 | `© {연도} {법인명} · 주소 · 웹 · 이메일` / 우측 `p.n/N` | `.doc-footer` |
| 워터마크 | PAID / DRAFT / VOID / OVERDUE 대각선 | `.watermark` |

## B5. 발행사 정보 (`company_info` blob)

⚠️ **전 항목 확인 필요.** 서류 헤더·푸터·법적 표기에 그대로 노출되므로 추정값 입력 금지.

| 필드 | 값 | 키 | 상태 |
|---|---|---|---|
| 법인명 | — | `company_name` | ⚠️ |
| 상호/거래명 | Metheim | `trading_name` | ✅ |
| 사업자등록번호 | — | `biz_no` | ⚠️ |
| 대표자 | — | `ceo` | ⚠️ |
| 개인정보책임자 | — | `privacy_officer` | ⚠️ |
| 주소 | 전라남도 여수시 (연등동 일대) | `address1/2/suburb/state/postcode/country` | ⚠️ 상세 주소·우편번호 미확정 |
| 전화 | — | `phone` | ⚠️ |
| 이메일 | — | `email` | ⚠️ |
| 웹 | — | `website` | ⚠️ |
| 타임존 | `Asia/Seoul` | `timezone` | ✅ |
| 문서 로고 URL | `metheim-logo-horizontal-teal.svg` | `logo_url` (→ `EMAIL_LOGO_URL` 폴백) | ✅ |

> 표준 양식 예시에 있던 `(주)메트하임` · `좌수영로 101`은 **양식의 예시값**이며, 프로젝트 정본은 소재지를 연등동으로 명시한다. 실제 등기 정보로 교체할 것.

## B6. 문서 종류별 스펙

공통: 통화 `KRW` 0소수점, 날짜 `YYYY-MM-DD`, 개인정보는 필요한 필드만 노출.

| 문서 | 파일 | 제목 라벨 | 섹션 순서 | 워터마크 |
|---|---|---|---|---|
| 인보이스 | `invoiceDocument.ts` | `INVOICE / 청구서` | 발행사 → 수신자 → 청구기간 → 라인아이템 → 합계 → 납부 안내 | `OVERDUE`(기한 초과), `PAID`(완납) |
| 견적서 | `quoteDocument.ts` | `QUOTE / 견적서` | 발행사 → 수신자 → 유효기간 → 항목 → 합계 → 조건 | `ACCEPTED` / `EXPIRED` |
| 영수증 | `receiptDocument.ts` | `RECEIPT / 영수증` | 발행사 → 수신자 → 수납 내역 → 수납 방법 → 합계 | `PAID` |
| 계약서 | `contractDocument.ts` | `CONTRACT / 계약서` | 당사자 → 목적물 → 기간·금액 → 조항 → 서명란 | `DRAFT` |
| 신청서 | `applicationPdf.ts` | `APPLICATION / 입주 신청서` | 신청자 → 희망 조건 → 첨부 → 동의 | `DRAFT` |
| 서비스 브리프 | `serviceBrief.ts` | `SERVICE BRIEF` | 대상 호실 → 작업 내용 → 일정 → 비고 | — |

**개인정보 처리**
- 서비스 브리프·작업 지시서: 입주자 성명 마스킹(`김*준`), 연락처는 담당자 전용 필드로만.
- 계좌번호는 인보이스 납부 안내에만, 뒷 4자리 외 마스킹은 하지 않되 문서 접근 권한을 제한한다.
- 문서 예시·테스트 데이터는 반드시 가명 사용.

**금액·문구 금지 규정**
- "확정 수익 보장", "100% 만실", "무조건", "국내 유일" 등 표현 금지 (「표시·광고의 공정화에 관한 법률」).
- 세금·수수료는 계산 근거를 항목으로 분리해 표기.

---

# 부록

## 부록 A. `brand.overrides.css` (붙여넣기용)

```css
:root{
  /* ── Brand (raw) ── */
  --teal:#005F73;      --teal-900:#00323D;  --teal-700:#004E5F;
  --teal-050:#E7F0F1;  --champagne:#E6D5B8;
  --gold:#C6942E;      --gold-700:#A87C1F;  --brick:#EE9B00;  --cream:#F4EFE1;

  /* ── Neutral ── */
  --ink:#12232B;   --slate:#33474F;    --gray-500:#78868C;  --gray-400:#9FABB0;
  --gray-300:#C7D0D3;  --gray-200:#E4E9EA;  --gray-100:#F1F4F4;

  /* ── Semantic (state) ── */
  --success:#1F8A70;  --warning:#E8A317;  --danger:#C24A3A;  --info:#227C93;

  /* ── Semantic (surface) ── */
  --background:#F1F4F4;  --foreground:#12232B;
  --card:#FFFFFF;        --card-foreground:#12232B;
  --muted:#F1F4F4;       --muted-foreground:#78868C;
  --border:#E4E9EA;      --input:#C7D0D3;
  --primary:#005F73;     --primary-foreground:#FFFFFF;
  --secondary:#E7F0F1;   --secondary-foreground:#005F73;
  --accent:#C6942E;      --accent-foreground:#3A2B08;
  --destructive:#C24A3A; --destructive-foreground:#FFFFFF;
  --ring:rgba(0,95,115,.14);
  --sidebar:#00323D;     --sidebar-foreground:#E6EEF0;  --sidebar-accent:#C6942E;

  /* ── Radius ── */
  --r-xs:4px; --r-sm:6px; --r-md:10px; --r-lg:16px; --r-xl:22px; --r-pill:999px;

  /* ── Elevation ── */
  --sh-1:0 1px 3px rgba(18,35,43,.08);
  --sh-2:0 6px 18px rgba(18,35,43,.10);
  --sh-3:0 18px 44px rgba(18,35,43,.18);

  /* ── Type ── */
  --font-display:'Montserrat','Pretendard',sans-serif;
  --font-body:'Pretendard','Noto Sans KR',sans-serif;
  --font-mono:'JetBrains Mono',ui-monospace,SFMono-Regular,monospace;

  /* ── Spacing (4pt): 4 8 12 16 24 32 48 64 96 ── */
}

/* 🅿️ 제안 — 승인 전 배포 금지 */
.dark{
  --background:#0B1A20;  --foreground:#E7EDEF;
  --card:#12232B;        --card-foreground:#E7EDEF;
  --muted:#16272F;       --muted-foreground:#93A3A9;
  --border:#24363E;      --input:#33474F;
  --primary:#3D9DB2;     --primary-foreground:#00232B;
  --secondary:#1B333C;   --secondary-foreground:#CFE3E7;
  --accent:#D9A94A;      --accent-foreground:#231903;
  --destructive:#D9634F;
  --success:#37A98D;  --warning:#F0B740;  --info:#3D9DB2;
  --ring:rgba(77,179,199,.22);
  --sidebar:#00232B;
}
```

## 부록 B. 확정 필요 체크리스트

| # | 항목 | 영향 범위 | 우선순위 |
|---|---|---|---|
| 1 | 운영 형태(장기임대 / 단기·숙박 / 병행) | 관리자 모듈, 도메인 모델, 문서 종류 | **높음** |
| 2 | 발행사 정보 15필드(§B5) | 모든 PDF·이메일 헤더·푸터 | **높음** |
| 3 | 사용할 포털 종류(owner/agent/host) | 배포 도메인, 로그인 화면 | 높음 |
| 4 | 지원 로케일 확장 범위 | i18n, 폰트 스택, 국기 | 중간 |
| 5 | 날짜 형식 확정(`YYYY-MM-DD` vs `YYYY/MM/DD`) | 화면·CSV·PDF 공통 | 중간 |
| 6 | 관리자 다크모드 도입 여부 | §A2-2 제안값 승인 | 중간 |
| 7 | 로고 자산 실제 파일 경로·CDN URL | `VITE_LOGO_URL` 전 표면 | 중간 |
| 8 | 총 세대수·평형·임대료 | 랜딩 카피, 시드 데이터 | 낮음(디자인 무관) |

> ⚠️ 과거 시안에 등장한 "48세대 / ₩680,000 / ₩920,000 / 공실률 4.2%"는 **디자인 더미 데이터**다.
> 코드 시드·목업·문서 어디에도 실제 값으로 넣지 않는다. 목업이 필요하면 `[예시값]` 주석을 단다.

## 부록 C. 수기 작성 문서 서식 (SOHOLUTION 표준 폼)

기획서·제안서·보고서를 Word로 만들 때의 기본값. Part B(시스템 PDF)와 별개다.

- A4, 여백 상·하·좌·우 `1cm`
- 본문 Noto Sans 11pt, 줄간격 1.0
- 제목 위계(Noto Sans 볼드, 거의 검정): 제목 26pt → 제목1 18pt → 제목2 14pt → 제목3 12pt
- 부제만 Georgia 14pt, 회색 80%(`#333333`)
- 표: 테두리 1pt 회색 실선, 셀 세로 가운데정렬, 헤더 행 가로 가운데정렬 + 연회색 음영 + 볼드
- 푸터: 좌측 `SOHOLUTION`, 우측 페이지 번호(회색)
- 파일명: `METHEIM_[문서종류]_[YYYYMMDD].[확장자]`

## 부록 D. 보이스 & 톤 (UI 문구용 요약)

- 담백하고 분명하게. 짧은 문장, 능동태. 과장 없이 생활의 편의를 구체적으로.
- 버튼·링크는 **사용자가 하는 행동**을 그대로 이름 붙인다. (`제출` ✕ → `예약하기` ○)
- 오류는 사과가 아니라 해결 방법. 성공은 다음에 일어날 일을 알려준다.
- 지양: 모호한 미사여구, 부동산 상투어("초역세권 대박"), 불안 조성형 카피, 근거 없는 최상급.
- 타깃은 2030 1~2인 가구. 가족 단위 소구 문법(학군·평수 자랑)을 쓰지 않는다.

---

## 변경 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| v1.0 | 2026-07-27 | 최초 작성. 브랜드 가이드 v1.0 + 테넌트 표준 양식 통합 |

*Metheim — Tenant Design Guide v1.0 · Urban Teal / Night Harbor*

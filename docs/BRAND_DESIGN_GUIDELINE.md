# Million Stay — Brand & Design Guideline

**Version 2.0** · One platform. Two sites. One roof.

Master brand **Million Stay** (`www.millionstay.com`) 와 서브 브랜드 **Million Homestay** (`homestay.millionstay.com`) 를 위한 브랜드 및 디자인 가이드라인입니다. 두 사이트는 하나의 MillionStay 모노레포 안에서 분리 운영되며, 하나의 디자인 시스템과 공유 API(`/api/v1/`) 위에서 동작합니다.

| 항목 | 값 |
|---|---|
| Master brand | Million Stay · `www.millionstay.com` |
| Sub-brand | Million Homestay · `homestay.millionstay.com` |
| Supported locales | en · ja · ko · th · vi · zh (6개) |
| Address | Suite 804, 343 Little Collins Street, Melbourne VIC 3000 Australia |
| Email | millionstay.com@gmail.com |

---

## 1. Brand Architecture — 하나의 플랫폼, 분리된 두 경험

로고의 "두 박공지붕(twin-gable)" 실루엣은 그대로 브랜드 구조의 은유입니다. 같은 지붕(플랫폼) 아래, 서로 다른 타깃을 위한 두 출입구가 있습니다. 프론트엔드는 분리돼 있지만 토대는 하나입니다.

```
                    ┌──────────────────────────────┐
                    │        MILLION STAY           │
                    │   Master · 게스트 부킹 포털      │
                    └───────────────┬──────────────┘
              ┌─────────────────────┴─────────────────────┐
   ┌──────────▼───────────┐                  ┌────────────▼───────────┐
   │  Million Stay (www)   │                  │   Million Homestay     │
   │  www.millionstay.com  │                  │  homestay.millionstay  │
   │  일반 숙박 게스트         │                  │  유학생 ↔ 홈스테이 호스트   │
   │  단기·장기 숙박 예약       │                  │  신청→매칭→전자서명        │
   └──────────┬───────────┘                  └────────────┬───────────┘
              └─────────────────────┬─────────────────────┘
                    ┌───────────────▼──────────────┐
                    │  One monorepo · Shared API     │
                    │  /api/v1/ · One design system  │
                    └────────────────────────────────┘
```

**진행 중인 작업** — `homestay/self-board/share` 를 short-term 의 **Booking 엔티티**로 통합하는 방향입니다. 두 사이트가 결국 같은 예약 시스템을 재사용하므로, 디자인 시스템도 부킹 관련 컴포넌트를 공유 가능하게 설계합니다.

---

## 2. www vs homestay — 핵심 차이

디자인·콘텐츠 작업 시 어느 사이트의 맥락인지 먼저 확인하세요. 같은 시각 시스템을 쓰되, 흐름과 톤이 다릅니다.

| 구분 | www (Million Stay) | homestay (Million Homestay) |
|---|---|---|
| 제품 | 단기 · 장기 숙박 예약 | 유학생 홈스테이 매칭 |
| 대상 | 일반 숙박 게스트 | 유학생 ↔ 홈스테이 호스트 |
| 워크플로우 | 일반 부킹 | 학생 신청 → 매칭 → 전자서명 |
| 콘텐츠 | 일반 CMS 페이지 | `homestay-*` 페이지 + 전용 블로그 |
| 페이지 소비 | 일반 라우팅 | `usePageContent` 오버레이 |
| 시그니처 액센트 | Orange 중심 | Teal 포인트로 차별화 |

---

## 3. Logo & Lockups — 한 마크, 두 워드마크

트윈 게이블 하우스 마크는 두 브랜드가 공유합니다. 두 개의 박공지붕은 "여러 사람이 함께 머무는 셰어 하우스"를, 작은 창문은 "나만의 방"을 상징합니다.

### 워드마크 시스템 규칙

- **"Million" 은 항상 Deep Navy (고정)** — 두 브랜드를 묶는 상수.
- **제품 단어("Stay" / "Homestay") 는 Million Orange (변수)** — 브랜드를 구분하는 변수.
- 이 한 규칙이 두 브랜드의 형제 관계를 시각적으로 묶습니다.

| 락업 | 용도 |
|---|---|
| `[mark] Million Stay` | Master · 게스트 (www.millionstay.com) |
| `[mark] Million Homestay` | Sub-brand · 유학생 (homestay.millionstay.com) |

### 사용 버전

- **Primary** — Orange `#E8621A` (크림·화이트 배경)
- **On Navy** — 화이트 녹아웃
- **On Orange** — 화이트 녹아웃
- **On Teal** — 화이트 녹아웃 (Homestay 전용)

### 규칙

- **여백** — 마크 높이의 ½ 이상을 사방 여백으로 확보.
- **최소 크기** — 디지털 24px / 인쇄 10mm.
- **금지** — 색 변경, 그라데이션·그림자·외곽선 추가, 비율 왜곡, 회전, 화이트 네거티브 스페이스(작은 창문) 채우기, 복잡한 사진 위 보호막 없이 사용.

---

## 4. Color System — 컬러 시스템

두 브랜드는 같은 팔레트를 공유합니다. **Million Orange** 가 공통 심장이며, 서브 브랜드 Homestay 는 **Teal** 을 시그니처 액센트로 더해 차별화합니다.

| 역할 | 이름 | HEX | RGB | 비고 |
|---|---|---|---|---|
| Primary (공통) | Million Orange | `#E8621A` | 232 · 98 · 26 | token: million-stay-web |
| Secondary | Deep Navy | `#16263F` | 22 · 38 · 63 | 제목 · 신뢰 · 다크 UI |
| Homestay Accent | Explore Teal | `#2A9D8F` | 42 · 157 · 143 | Homestay 시그니처 |
| Base | Warm Cream | `#FAF5EC` | 250 · 245 · 236 | 배경 |
| Orange Dark | Burnt Orange | `#BF4E10` | — | hover / press |
| Orange Soft | Apricot Tint | `#FBE0CB` | — | 배경 / 태그 |
| Text | Ink | `#2A2620` | — | 본문 |
| Paper | Pure White | `#FFFFFF` | 255 · 255 · 255 | 카드 |

### 권장 사용 비율

```
Cream · White  ████████████████████████  60%
Navy           ██████████                25%
Orange         █████                     12%
Teal           █                          3%
```

오렌지는 면적을 넓게 칠하기보다 버튼·아이콘·키워드처럼 시선을 모으는 곳에 강조용으로 사용하세요.

> **⚠️ 토큰 정렬 필요** — 정식 브랜드 컬러는 `#E8621A` (million-stay-web 토큰)입니다. 다만 현재 로고 에셋은 `#EE6B19` 로 렌더링되어 있어 미세한 차이가 있습니다. 로고 SVG/PNG 와 디자인 토큰을 모두 `#E8621A` 로 통일할 것을 권장합니다.

---

## 5. Typography & Multi-locale — 타이포그래피 & 다국어

로고의 기하학적이고 둥근 느낌을 잇는 **Poppins** 를 디스플레이로, 가독성 높은 **Inter** 를 본문으로 사용합니다. 한글은 **Pretendard** 로 통일합니다.

| 역할 | 폰트 | 굵기 | 사용 |
|---|---|---|---|
| Display / Headline | Poppins | Bold 700 · ExtraBold 800 | 제목 · 히어로 / letter-spacing −0.02em |
| Subhead | Poppins | SemiBold 600 · 700 | 소제목 · 카드 타이틀 |
| Body | Inter / Pretendard | Regular 400 · Medium 500 | 본문 16px / 행간 1.65 |
| Caption / Label | Inter | SemiBold 600 · UPPERCASE | 라벨 · 태그 / letter-spacing +0.14em |

### 다국어 폰트 폴백 (6 locales)

| Locale | 샘플 | 폰트 |
|---|---|---|
| EN · English | Your stay | Poppins / Inter |
| KO · 한국어 | 당신의 머무름 | Pretendard |
| JA · 日本語 | あなたの滞在 | Noto Sans JP |
| ZH · 中文 | 您的住宿 | Noto Sans SC |
| TH · ไทย | ที่พักของคุณ | Noto Sans Thai |
| VI · Tiếng Việt | Kỳ nghỉ của bạn | Poppins / Inter |

**권장 폰트 스택**

```css
font-family: "Poppins", "Pretendard", "Noto Sans JP",
             "Noto Sans SC", "Noto Sans Thai", sans-serif;
```

Vietnamese 성조 부호(diacritics) 렌더링을 위해 Poppins/Inter 의 Vietnamese subset 을 반드시 포함하세요.

---

## 6. Voice by Audience — 한 목소리, 두 청중

공통 톤은 **따뜻하고 명료하며 정직**합니다. 다만 청중이 다릅니다 — www 는 "예약하는 게스트"에게, homestay 는 "처음 유학 오는 학생"에게 말합니다.

### Million Stay (www · guest)

예약을 결정하는 일반 게스트 — 빠르고 자신감 있게.

- *"원하는 날짜를 고르면, 가격이 바로 보입니다."* → 명확·효율 중심. 가격과 조건을 앞단에 투명하게.
- *"단기든 장기든, 한 곳에서 예약하세요."* → 선택의 폭을 강조하되 군더더기 없이.

### Million Homestay (homestay · student)

처음 해외에 오는 유학생 — 다정하고 안심시키는.

- *"처음이라 막막하셨죠? 한 단계씩 함께 진행해요."* → 불안을 인정하는 공감 톤. 'we'가 곁에 있음.
- *"서류 업로드부터 전자서명까지, 저희가 안내할게요."* → 워크플로우의 각 단계를 손 잡아주듯 설명.

### 공통 원칙

쉬운 단어, 능동형, 문장형 대소문자. 과장·전문용어·딱딱한 행정체는 피합니다. 6개 로케일 번역 시에도 이 톤을 유지합니다.

---

## Brand Essence — 무드 키워드

> **Warm · Friendly · Welcoming · Safe · Modern · Reliable · Youthful · Airbnb-quality**

낯선 도시에 처음 도착한 게스트와 학생이 "여기라면 안심하고 지낼 수 있겠다"고 느끼게 하는 것. 모든 디자인은 이 한 문장에서 출발합니다.

---

*Million Stay · Suite 804, 343 Little Collins Street, Melbourne VIC 3000 Australia · millionstay.com@gmail.com*
*Brand & Design Guideline v2.0 · One monorepo · Shared API `/api/v1/`*

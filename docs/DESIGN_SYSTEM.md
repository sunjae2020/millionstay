# Design System — Frontend Conventions (million-stay-web)

브랜드 팔레트/타이포의 **단일 소스**는 [BRAND_DESIGN_GUIDELINE.md](BRAND_DESIGN_GUIDELINE.md)
+ `@workspace/design-tokens`(`lib/design-tokens/src/brand.css`). 이 문서는 그 위에서
**앱 코드가 토큰을 어떻게 쓰는지** — 시맨틱 토큰 관례, 다크모드, 공용 컴포넌트,
마이그레이션 레시피 — 를 정의합니다. 원칙: **갈아엎지 말고 진화**(브랜드 #E8621A ·
Poppins/Inter · 4/8 간격 유지, 하드코딩만 토큰으로 흡수).

> 적용 현황(2026-07-19): 게스트 포털·인증·admin·마케팅 표면은 아래 관례로 이관 완료.
> 나머지는 "화면 이름만 바꿔 반복"하는 기계적 작업 (§6 백로그).

---

## 1. 토큰 3계층

`primitive`(brand.css) → `semantic`(각 앱 `src/index.css`) → `component`(유틸 클래스).
**컴포넌트에서 raw hex/gray를 쓰지 말고 시맨틱 토큰 유틸리티를 쓴다.** 라이트 값이
기존 색과 동일하게 매핑돼 있어 외관은 보존되고 다크가 자동으로 따라온다.

| 용도 | 시맨틱 유틸리티 | 대체 대상(하드코딩) |
| --- | --- | --- |
| 페이지 배경 | `bg-background` | `bg-gray-50` |
| 카드 표면 | `bg-card` | `bg-white` |
| 본문 텍스트 | `text-foreground` | `text-gray-900` |
| 보조 텍스트 | `text-muted-foreground` | `text-gray-500/400` |
| 카드 텍스트 | `text-card-foreground` | `text-gray-800/900` |
| 경계선 | `border-border` / `border-card-border` | `border-gray-100/200` |
| 브랜드 | `text-primary` `bg-primary` `border-primary` (+`/불투명도`) | `[#E8621A]`, `text-orange-600` |
| 브랜드 위 텍스트 | `text-primary-foreground` | `text-white`(버튼 등) |

`--primary`는 `var(--brand-orange)`를 가리키므로 인스턴스별 리브랜드가 자동 반영된다.

---

## 2. 다크모드 — 화면 범위(screen-scoped) + 시스템 자동

- `.dark` 팔레트 토큰은 `million-stay-web/src/index.css`의 `.dark {}`에 정의(웜 뉴트럴,
  primary 56% L로 대비 확보). 시맨틱 토큰 유틸리티는 `.dark` 조상이 있으면 자동 전환.
- **현재 다크가 켜지는 화면은 `/portal` 대시보드뿐**. 나머지 포털 페이지는 `bg-white`
  하드코딩이라 라이트 전용. seam(흰 chrome + 다크 콘텐츠)을 피하려고 **대시보드 마운트
  시에만 `prefers-color-scheme`에 따라 `.dark`를 걸고 언마운트 시 제거**한다:

  ```tsx
  // portal.tsx — screen-scoped dark, no global toggle
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", mq.matches);
    apply(); mq.addEventListener("change", apply);
    return () => { mq.removeEventListener("change", apply); document.documentElement.classList.remove("dark"); };
  }, []);
  ```

- **다크를 다른 화면으로 확장하려면**: 그 화면(+공용 chrome)을 §1 시맨틱 토큰 + `dark:`
  변형으로 옮긴 뒤, 위 마운트 이펙트를 붙이거나(화면 범위) 장기적으로 전역 테마 토글로
  승격한다. 전역 토글은 라이트 하드코딩 페이지가 모두 이관된 뒤에 도입할 것.
- `PortalLayout` chrome(사이드바/모바일 헤더/드로어/언어 스위처)에는 이미 `dark:` 변형이
  들어가 있어 대시보드 다크와 정합.

---

## 3. 공용 컴포넌트 (단일 소스)

`million-stay-web/src/components/` — 화면별 복붙 대신 아래를 재사용한다.

| 컴포넌트 | 시그니처 | 용도 / 규칙 |
| --- | --- | --- |
| [`StatusBadge`](../artifacts/million-stay-web/src/components/status-badge.tsx) | `{status, label?, icon?, size?}` | 모든 상태 pill의 단일 소스. tone은 정규화된 status→tone 맵에서 결정. **새 상태는 `STATUS_TONE`에 추가**(색을 페이지에서 다시 정의하지 말 것). 커스텀 표시는 `label`/`icon`으로 전달(예: invoice `Sent`→"Unpaid"). 색은 항상 텍스트와 함께(색 단독 금지). |
| [`StatCard`](../artifacts/million-stay-web/src/components/stat-card.tsx) | `{icon, label, value, sub?, tone?, href?, cta?}` | KPI 타일. `tone`=default/primary/warn. **화면당 primary CTA 1개 원칙** — `href`+`cta`는 강조 카드 하나에만. |
| [`EmptyState`](../artifacts/million-stay-web/src/components/empty-state.tsx) | `{icon, title, description?, ctaLabel?, ctaHref?}` | 목록 빈 상태. 토큰 표면이라 다크 대응. |
| [`AuthLayout`](../artifacts/million-stay-web/src/components/auth-layout.tsx) | `{children, maxWidth?}` | 인증 화면 셸(브랜드 워시 + 로고 + 카드). login/register/forgot/reset/host-login이 사용. 셸 복붙 금지. |

### status → tone 참조 (StatusBadge, `STATUS_TONE` 기준)
`success`(초록): active, paid, approved, verified, resolved ·
`info`(파랑): confirmed, completed, sent, submitted, open ·
`warn`(앰버): pending, pendingpayment, pendingapproval, unpaid, required, under_review, inprogress ·
`danger`(빨강): cancelled, overdue, rejected ·
`indigo`: checkedout ·
`neutral`(회색): draft, void, closed, 미매핑.
> 미매핑 status는 neutral로 폴백 — 새 상태는 반드시 `STATUS_TONE`에 등록.

---

## 4. 상태(state) 기본 규격

모든 목록/폼 화면은 아래를 갖춘다(공용 컴포넌트에 내장):

- **loading**: `Skeleton`(>300ms), 레이아웃 예약(CLS 방지)
- **empty**: `EmptyState`(안내 + 액션)
- **error**: 재시도 경로 제시
- **interaction**: hover/active 150–300ms, `disabled` opacity-50, focus-visible 링 유지,
  `motion-reduce:animate-none` 존중, 터치 타깃 ≥44px

---

## 5. 마이그레이션 레시피 (화면 단위 점진 적용)

한 번에 대량 수정 금지. 화면 하나씩:

1. **하드코딩 뉴트럴 → 시맨틱 토큰** (§1 표). 라이트 외관 동일, 다크 대응 확보.
2. **브랜드 색**: `[#E8621A]` 임의값 → `primary` 유틸리티(`text-primary` 등). 인라인
   `#E8621A` 또는 `const BRAND = "#E8621A"` → `hsl(var(--primary))`.
3. **로컬 재정의 컴포넌트 → 공용**: 페이지 로컬 `function StatusBadge`/상태 색 맵 →
   `@/components/status-badge`(라벨/아이콘은 prop으로 보존). 인증 셸 → `AuthLayout`.
4. **누락 상태 보강**(§4) + 반응형(375/768/1024) + 다크(해당 시).
5. 검증: `pnpm --filter @workspace/million-stay-web typecheck && build`. diff로 Before/After
   확인, 기능·데이터 흐름 불변.

---

## 6. 마이그레이션 현황 / 백로그

**완료(2026-07-19)**: 게스트 포털(dashboard·bookings·invoices·cs·documents),
인증 5화면(login·register·forgot·reset·host-login), admin(bookings·dashboard·booking-detail
StatusBadge 통일), 마케팅(blog·blog-post·about 브랜드 토큰화), receipt/payment `BRAND`
토큰화. → `src/pages`에 로컬 StatusBadge 정의 0개, 앱 전역 하드코딩 브랜드 헥스 41→13.

**남은 백로그(반복 작업)**:
- admin-guests / admin-spaces의 인라인 `isActive` 토글 → `StatusBadge status="Active|Inactive"`
- 목록/상세 페이지 잔여 `bg-white`/`text-gray-*` → 시맨틱 토큰(대량, §1)
- 다크모드를 대시보드 밖으로 확장(§2) — 라이트 하드코딩 페이지 이관 후 전역 토글 검토
- **제외(의도적)**: `homestay/*`(Million Homestay 서브브랜드 — 별도 브랜드라 하드코딩 유지,
  잔여 브랜드 헥스 13개가 여기에 해당)

> 새 화면/컴포넌트를 만들 땐 이 문서의 §1·§3·§4를 기본값으로 적용한다.

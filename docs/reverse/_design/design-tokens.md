# Design Tokens

> ✅ **T006-REWRITE** 2026-04-27 (T001 시점 83L NEEDS REVISION → 본 90L; T002 5 artifact + T003 _context/domain-logic-portal-{guest,partner}.md + T004 _rules/architecture-rules.md §5 (5-artifact 중복 = DEAD/duplicate cross-ref) 통합).
> **상위 source**: 5 artifact `src/index.css` (`agent-portal` / `million-stay-web` / `owner-portal` / `property-admin` / `service-host-portal`; mockup-sandbox 제외) + Tailwind v4 inline-theme.
> **Cross-ref**: component-library.md §1 (shadcn/ui 5 artifact 중복) + admin-layout.md §3 (property-admin theme override) + guest-portal-layout.md §3 (million-stay-web portal theme).

---

## §1 TAILWIND v4 INLINE-THEME — 5 artifact 중복 (architecture-rules §5 DEAD/duplicate carrier)

각 artifact 의 `src/index.css` 안 `@theme inline { ... }` block 에 token 정의 — **공유 design package 부재 = 5-way 중복**:

```css
@import "tailwindcss";
@import "tw-animate-css";
@plugin "@tailwindcss/typography";
@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: hsl(var(--background));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-destructive: hsl(var(--destructive));
  --color-muted: hsl(var(--muted));
  --color-accent: hsl(var(--accent));
  --color-border: hsl(var(--border));
  /* ...12+ semantic color tokens */
}
```

**5-way 중복 anchor** (`rg "@theme inline" -l artifacts/`):
- artifacts/agent-portal/src/index.css
- artifacts/million-stay-web/src/index.css
- artifacts/owner-portal/src/index.css
- artifacts/property-admin/src/index.css
- artifacts/service-host-portal/src/index.css

→ token schema 동일 + brand color/font/radius 만 artifact 별 차등. **5x duplicate maintenance burden**. Phase 2 prescription = `packages/design-tokens/` workspace package 추출 + `@import "@workspace/design-tokens"` 단일 source.

---

## §2 ARTIFACT 별 BRAND 차이 매트릭스 (5-way drift)

| artifact | primary HSL | radius | font | 비고 |
|----------|-------------|--------|------|------|
| million-stay-web (guest) | `hsl(24 93% 53%)` ≈ `#F97316` | `0.75rem` | Inter + Noto Sans JP/Thai fallback | guest-facing 비-라틴 fallback |
| property-admin | `hsl(21 82% 51%)` deep orange | `0.375rem` | Inter | admin 더 tight radius |
| agent-portal | (admin 동일 또는 유사 deep orange) | `0.375rem` | Inter | partner-side 표준 |
| owner-portal | (agent 와 동일 portal 표준) | `0.375rem` | Inter | partner-side 표준 |
| service-host-portal | (portal 표준) | `0.375rem` | Inter | partner-side 표준 (CF-005 portal_type drift cross-pack) |

**관찰**: guest 도메인 1 artifact = larger radius (0.75rem) + 비-라틴 font fallback / partner 도메인 4 artifact = tight radius (0.375rem) + Inter only. **2-tier visual identity** confirmed.

---

## §3 다크 모드 — 정의 부재

`@custom-variant dark (&:is(.dark *))` selector 정의됨 + CSS variable 안 `--color-*` dark variant 미정의 + UI 어디서도 `.dark` class toggle 0 hit (`rg "\\.dark" artifacts/ --type=tsx` = 0). **dark mode = 코드상 0 작동 site**. admin-layout.md §6 known UI debt cross-ref.

**Phase 2 prescription**: (1) `packages/design-tokens/` 추출 (5x → 1x source) / (2) brand color 2-tier (guest vs partner) 명시 enum / (3) dark mode 활성화 또는 selector 제거 / (4) shared font loader (Noto Sans JP/Thai partner 도메인 도입 또는 명시 미사용).

---

## §4 자가 검증 (3 spot-check ✅)

- C1 `@theme inline` 5 hits = 5 artifact (mockup-sandbox 제외) 모두 중복 (architecture-rules §5 DEAD/duplicate carrier)
- C2 million-stay-web `--primary: 24 93% 53%` = `#F97316` (guest) vs property-admin `--primary: 21 82% 51%` = deep orange (admin) — 2-tier 차이 confirmed
- C3 `.dark` class toggle 0 hit (`rg "className.*dark" artifacts/` 어떤 active toggle 도 부재) — dark mode dormant

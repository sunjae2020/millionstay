# Design Tokens

> ⚠️ **NEEDS REVISION** — see `docs/reverse/_audit/T001_RECON_REPORT.md` §g for specific corrections required. Will be rewritten in T002–T007 when its domain folder is processed.


Tailwind v4 inline-theme is used. Tokens live in each artifact's `src/index.css` under `@theme inline { ... }`. There is **no shared design package** — tokens are duplicated per artifact (a known maintenance gap).

## 1. Color tokens (HSL)

### `million-stay-web` (public + guest portal)

| Token | Light | Dark |
|---|---|---|
| `--background` | `0 0% 100%` | `222 47% 11%` |
| `--foreground` | `222 47% 11%` | `210 40% 98%` |
| `--primary` | `24 93% 53%` (#F97316 orange) | same |
| `--primary-foreground` | `0 0% 100%` | `0 0% 100%` |
| `--secondary` | `210 40% 96%` | `217 33% 17%` |
| `--accent` | `210 40% 96%` | `217 33% 17%` |
| `--destructive` | `0 84% 60%` | `0 62% 30%` |
| `--muted` | `210 40% 96%` | `217 33% 17%` |
| `--border` | `214 32% 91%` | `217 33% 17%` |
| `--ring` | `24 93% 53%` | same |

Status colors used in badges (Tailwind class names, not tokens):

| Status | Bg | Fg |
|---|---|---|
| success / Active / Paid | `green-100` | `green-800` |
| pending / Sent | `amber-100` | `amber-800` |
| info / Confirmed | `blue-100` | `blue-800` |
| highlight / CheckedOut | `purple-100` | `purple-800` |
| danger / Cancelled / Overdue | `red-100` | `red-800` |
| neutral / Draft / Inactive | `gray-100` | `gray-700` |

### `property-admin`

Same structure as web, but `--primary` = `21 82% 51%` (deeper burnt orange) and `--radius` = `0.375rem`.

## 2. Typography

| Token | Value |
|---|---|
| `--font-sans` | `"Inter", "Noto Sans JP", "Noto Sans Thai", system-ui, sans-serif` |
| `--font-mono` | `"JetBrains Mono", ui-monospace, monospace` |

Sizes follow Tailwind defaults (`text-xs … text-4xl`). Headings use `text-2xl` / `text-3xl` typically.

## 3. Spacing scale

`--spacing: 0.25rem;` → Tailwind v4 default scale (`p-4` = 1rem, etc.). No custom additions.

## 4. Radius

| Artifact | `--radius` |
|---|---|
| `million-stay-web` | `0.75rem` (rounded marketing feel) |
| `property-admin` | `0.375rem` (compact admin feel) |
| Partner portals (agent/owner/service-host) | `0.5rem` |

## 5. Shadows

Tailwind defaults (`shadow-sm`, `shadow`, `shadow-lg`). No custom elevation tokens.

## 6. Breakpoints

Tailwind defaults — `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`. Sidebar collapse triggers at `< lg`.

## 7. Motion

`framer-motion` for page transitions on the public portal. Admin uses `transition-all duration-150 ease-out` on hover/focus only — no entry animations.

## 8. Iconography

`lucide-react` exclusively. Default size 16px in dense table contexts, 20px in card headers, 24px+ in dashboard KPIs.

## 9. Token gaps

- No semantic tokens for "info / warning / success / error" — components reach into Tailwind palette directly. **Recommend** adding `--success`, `--warning`, `--info` to the theme.
- No spacing scale for negative margins or fluid type.
- No prefers-reduced-motion handling.
- No dark-mode toggle UI exists, although dark-mode CSS variables are defined.
- No shared tokens package — each artifact owns its CSS file.

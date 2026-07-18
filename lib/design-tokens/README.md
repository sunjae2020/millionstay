# @workspace/design-tokens

Single source of truth for the **Million Stay Brand & Design Guideline v2.0**
(`docs/BRAND_DESIGN_GUIDELINE.md`). Extracts the guideline palette and typography
stacks into one shared CSS file so every frontend app renders the same brand.

## Usage

1. Add the dependency to the app's `package.json`:

   ```json
   "@workspace/design-tokens": "workspace:*"
   ```

2. Import it near the top of the app's `src/index.css`, right after
   `@import "tailwindcss";`:

   ```css
   @import "@workspace/design-tokens/brand.css";
   ```

3. Point the app's semantic tokens at the brand primitives (keeps the existing
   shadcn `hsl(var(--x))` pipeline unchanged):

   ```css
   :root {
     --primary: var(--brand-orange);
     --ring: var(--brand-orange);
     --sidebar-primary: var(--brand-orange);
     --app-font-sans: var(--brand-font-sans);
   }
   ```

4. Load the guideline fonts via `<link>` tags in the app's `index.html`
   (Poppins, Inter, Pretendard, Noto Sans JP/SC/Thai).

## Tokens

| Token (HSL var)   | Hex        | Name           | Role                     |
| ----------------- | ---------- | -------------- | ------------------------ |
| `--brand-orange`  | `#E8621A`  | Million Orange | Primary (공통)           |
| `--brand-navy`    | `#16263F`  | Deep Navy      | 제목·신뢰·다크 UI        |
| `--brand-teal`    | `#2A9D8F`  | Explore Teal   | Homestay 시그니처 액센트 |
| `--brand-cream`   | `#FAF5EC`  | Warm Cream     | 배경                     |
| `--brand-burnt`   | `#BF4E10`  | Burnt Orange   | hover / press            |
| `--brand-apricot` | `#FBE0CB`  | Apricot Tint   | 배경 / 태그              |
| `--brand-ink`     | `#2A2620`  | Ink            | 본문                     |
| `--brand-white`   | `#FFFFFF`  | Pure White     | 카드                     |

Utilities registered via `@theme inline`: `bg-brand-orange`, `text-brand-navy`,
`bg-brand-teal`, `border-brand-cream`, … and `font-display` (Poppins stack).

Font stacks: `--brand-font-display` (Poppins → Pretendard → Noto → sans) and
`--brand-font-sans` (Inter → Pretendard → Noto → sans).

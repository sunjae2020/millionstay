# Development-site shared shell (header / footer) convention

**Rule:** On the single-building **development** instance (`VITE_SITE_MODE=development`,
e.g. MetHeim `metheim-web`), every shared page that is mounted underneath the
development site must render the **DevLayout** shell — the `DevNavbar` logo/menu
header and the navy `DevFooter` — so the header, mobile hamburger menu and footer
read **identically to the landing page** on both desktop and mobile. Standard
instances keep the MillionStay `Navbar` / `Footer`.

## Why

The development site (`DevRouter`) mounts the shared short-term booking engine
(`/search`, `/spaces/:id`, `/booking/*`) underneath its own marketing site. Those
shared pages historically shipped the MillionStay `Navbar` (menu items: Search /
Stay Plans / About / For Students / …) and the standard `Footer`. On MetHeim that
produced a jarring split: the landing pages showed the MetHeim menu
(Home / About / Buy / Rent / Management / Directions) and the navy operator
footer, but `/search` and the booking flow showed a different header, a different
mobile menu, and a different footer. The mobile view was the most obviously
inconsistent.

## How to apply

1. Export the shell from
   [`components/development/DevLayout.tsx`](../artifacts/million-stay-web/src/components/development/DevLayout.tsx):
   `DevNavbar` and `DevFooter` are exported for reuse.
2. In the shared page, branch on the site mode:
   ```tsx
   import { DevNavbar, DevFooter } from "@/components/development/DevLayout";
   import { isDevelopmentSite } from "@/lib/site-mode";

   const DEV_SITE = isDevelopmentSite();   // module scope — evaluated once
   // …
   {DEV_SITE ? <DevNavbar /> : <Navbar />}
   // …
   {DEV_SITE ? <DevFooter /> : <Footer />}
   ```
3. **Sticky offsets** must track the taller dev header. `DevNavbar` on non-home
   pages is `sticky top-0` at `h-20 lg:h-24` (80 / 96 px), vs the standard
   `Navbar`'s `h-16` (64 px). Any element that stuck to the standard header
   height must become conditional, e.g. the search page's sticky filter bar:
   ```tsx
   className={`sticky ${DEV_SITE ? "top-20 lg:top-24" : "top-16"} z-40 …`}
   ```

## Pages currently wearing the shared shell

- [`pages/search.tsx`](../artifacts/million-stay-web/src/pages/search.tsx) — header, sticky filter offset, footer
- [`pages/space-detail.tsx`](../artifacts/million-stay-web/src/pages/space-detail.tsx) — header (loading / not-found / main), footer
- [`pages/booking.tsx`](../artifacts/million-stay-web/src/pages/booking.tsx) — header (no footer on this checkout page, unchanged)
- [`pages/booking-new.tsx`](../artifacts/million-stay-web/src/pages/booking-new.tsx) — header, footer

When adding a **new** shared page under `DevRouter`, follow this rule as part of
the same change — do not ship a shared page with the standard `Navbar` / `Footer`
on the development site.

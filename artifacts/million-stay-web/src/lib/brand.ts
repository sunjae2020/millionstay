/**
 * Per-instance brand assets (white-label, spec §2.4).
 *
 * Logo images and favicon default to the bundled MillionStay art, but a
 * white-label instance can point them at hosted URLs via build-time env:
 *   VITE_LOGO_URL       horizontal wordmark (navbar, footer, auth pages)
 *   VITE_LOGO_MARK_URL  square mark (mobile navbar, favicon fallback)
 *   VITE_FAVICON        browser-tab icon (applied in main.tsx)
 *
 * Unset → the imported asset URL, so the primary instance is unaffected.
 */
import logoHorizontalDefault from "@assets/06.OR_NB_horizontal_ver_1775381659303.png";
import logoMarkDefault from "@assets/05.OR_NB_Mark_simple_ver_1775381659302.png";

export const LOGO_HORIZONTAL: string =
  import.meta.env.VITE_LOGO_URL?.trim() || logoHorizontalDefault;

export const LOGO_MARK: string =
  import.meta.env.VITE_LOGO_MARK_URL?.trim() || logoMarkDefault;

/** Empty string when unset, so callers can skip overriding the static <link>. */
export const FAVICON_URL: string = import.meta.env.VITE_FAVICON?.trim() || "";

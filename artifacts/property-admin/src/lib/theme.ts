import { apiJson } from "./apiFetch";

export interface ThemeSettings {
  brand_name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  sidebar_theme: string;
  logo: string | null;
  favicon: string | null;
  logo_dark: string | null;
  favicon_dark: string | null;
  custom_css: string | null;
  dark_mode: boolean;
  date_format: string;
  currency: string;
  currency_position: string;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const match = hex.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;

  let body = match[1];
  if (body.length === 3) body = body.split("").map((c) => c + c).join("");

  const r = parseInt(body.slice(0, 2), 16) / 255;
  const g = parseInt(body.slice(2, 4), 16) / 255;
  const b = parseInt(body.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function readableForeground(hex: string): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return "0 0% 100%";
  return hsl.l > 60 ? "222 47% 11%" : "0 0% 100%";
}

export function applyPrimaryColor(hex: string) {
  const hsl = hexToHsl(hex);
  if (!hsl) return;

  const val = `${hsl.h} ${hsl.s}% ${hsl.l}%`;
  const root = document.documentElement;

  root.style.setProperty("--primary", val);
  root.style.setProperty("--ring", val);
  root.style.setProperty("--sidebar-primary", val);
  root.style.setProperty("--sidebar-ring", val);
  root.style.setProperty("--primary-foreground", readableForeground(hex));
  root.style.setProperty("--sidebar-primary-foreground", readableForeground(hex));
}

export function applySecondaryColor(hex: string) {
  const hsl = hexToHsl(hex);
  if (!hsl) return;
  const root = document.documentElement;
  root.style.setProperty("--secondary", `${hsl.h} ${hsl.s}% ${hsl.l}%`);
  root.style.setProperty("--secondary-foreground", readableForeground(hex));
}

export function applyAccentColor(hex: string) {
  const hsl = hexToHsl(hex);
  if (!hsl) return;
  const root = document.documentElement;
  root.style.setProperty("--accent", `${hsl.h} ${hsl.s}% ${hsl.l}%`);
  root.style.setProperty("--accent-foreground", readableForeground(hex));
}

const SIDEBAR_VARS = [
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-border",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
];

export function applySidebarTheme(theme: string) {
  const root = document.documentElement;
  // In full dark mode, let the .dark CSS rules govern the sidebar.
  if (root.classList.contains("dark")) {
    SIDEBAR_VARS.forEach((p) => root.style.removeProperty(p));
    return;
  }
  if (theme === "light") {
    root.style.setProperty("--sidebar", "0 0% 98%");
    root.style.setProperty("--sidebar-foreground", "222 47% 15%");
    root.style.setProperty("--sidebar-border", "220 13% 88%");
    root.style.setProperty("--sidebar-accent", "220 14% 93%");
    root.style.setProperty("--sidebar-accent-foreground", "222 47% 15%");
  } else {
    // dark sidebar in light app (default)
    root.style.setProperty("--sidebar", "222 47% 11%");
    root.style.setProperty("--sidebar-foreground", "210 40% 90%");
    root.style.setProperty("--sidebar-border", "222 40% 18%");
    root.style.setProperty("--sidebar-accent", "222 40% 18%");
    root.style.setProperty("--sidebar-accent-foreground", "210 40% 90%");
  }
}

const CUSTOM_CSS_ID = "ms-custom-css";

export function applyCustomCss(css: string | null | undefined) {
  let el = document.getElementById(CUSTOM_CSS_ID) as HTMLStyleElement | null;
  if (!css) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("style");
    el.id = CUSTOM_CSS_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

export function applyDarkMode(enabled: boolean, sidebarTheme?: string) {
  const root = document.documentElement;
  if (enabled) {
    root.classList.add("dark");
    // Clear any per-color sidebar overrides so .dark rules win.
    SIDEBAR_VARS.forEach((p) => root.style.removeProperty(p));
  } else {
    root.classList.remove("dark");
    applySidebarTheme(sidebarTheme ?? loadTheme().sidebar_theme ?? "dark");
  }
}

export function applyFavicon(url: string | null | undefined) {
  if (typeof document === "undefined") return;
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!url) {
    // Don't remove a default; just no-op.
    return;
  }
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = url;
}

const THEME_KEY = "ms_theme_settings";

export function saveTheme(settings: Partial<ThemeSettings>) {
  const existing = loadTheme();
  localStorage.setItem(THEME_KEY, JSON.stringify({ ...existing, ...settings }));
}

export function loadTheme(): Partial<ThemeSettings> {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return raw ? (JSON.parse(raw) as Partial<ThemeSettings>) : {};
  } catch {
    return {};
  }
}

/** Apply a full theme snapshot to the running page (colours, dark mode, css, favicon). */
export function applyThemeSettings(theme: Partial<ThemeSettings>) {
  // Dark mode first so applySidebarTheme can branch correctly.
  applyDarkMode(theme.dark_mode === true, theme.sidebar_theme ?? "dark");
  if (theme.primary_color) applyPrimaryColor(theme.primary_color);
  if (theme.secondary_color) applySecondaryColor(theme.secondary_color);
  if (theme.accent_color) applyAccentColor(theme.accent_color);
  applyCustomCss(theme.custom_css);
  // Favicon: prefer dark variant when in dark mode.
  const fav = theme.dark_mode && theme.favicon_dark ? theme.favicon_dark : theme.favicon ?? null;
  applyFavicon(fav);
}

export function initTheme() {
  applyThemeSettings(loadTheme());
}

/* ── Server-persisted branding (shared across admins/devices) ─────────────────
   The DB row uses snake_case `*_url` asset columns; the client/localStorage uses
   `logo`/`favicon`/`logo_dark`/`favicon_dark`. These two helpers bridge the two. */

const BRANDING_API = "/api/v1/branding";

interface BrandingRow {
  brand_name: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  sidebar_theme: string;
  logo_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  favicon_dark_url: string | null;
  custom_css: string | null;
  dark_mode: boolean;
  date_format: string;
  currency: string;
  currency_position: string;
}

function rowToTheme(row: BrandingRow): Partial<ThemeSettings> {
  return {
    brand_name: row.brand_name ?? undefined,
    primary_color: row.primary_color,
    secondary_color: row.secondary_color,
    accent_color: row.accent_color,
    sidebar_theme: row.sidebar_theme,
    logo: row.logo_url,
    logo_dark: row.logo_dark_url,
    favicon: row.favicon_url,
    favicon_dark: row.favicon_dark_url,
    custom_css: row.custom_css,
    dark_mode: row.dark_mode,
    date_format: row.date_format,
    currency: row.currency,
    currency_position: row.currency_position,
  };
}

function themeToRow(t: Partial<ThemeSettings>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const passthrough = [
    "brand_name", "primary_color", "secondary_color", "accent_color",
    "sidebar_theme", "custom_css", "dark_mode", "date_format",
    "currency", "currency_position",
  ] as const;
  for (const k of passthrough) if (t[k] !== undefined) body[k] = t[k];
  if (t.logo !== undefined) body["logo_url"] = t.logo;
  if (t.logo_dark !== undefined) body["logo_dark_url"] = t.logo_dark;
  if (t.favicon !== undefined) body["favicon_url"] = t.favicon;
  if (t.favicon_dark !== undefined) body["favicon_dark_url"] = t.favicon_dark;
  return body;
}

/** Fetch the server branding row, cache it to localStorage and apply it.
 *  Public endpoint → works pre-login. On any failure keeps the localStorage
 *  copy (offline-tolerant). Returns the applied theme, or null if none/failed. */
export async function hydrateBrandingFromApi(): Promise<Partial<ThemeSettings> | null> {
  try {
    const res = await apiJson<{ success: boolean; data: BrandingRow | null }>(BRANDING_API);
    if (!res?.data) return null;
    const theme = rowToTheme(res.data);
    saveTheme(theme);
    applyThemeSettings(theme);
    return theme;
  } catch {
    return null;
  }
}

/** Persist branding to the server (admin only). Throws on failure. */
export async function saveBrandingToApi(settings: Partial<ThemeSettings>): Promise<void> {
  await apiJson(BRANDING_API, { method: "PUT", body: JSON.stringify(themeToRow(settings)) });
}

/** Upload a logo/favicon file; returns the stored URL. Throws on failure. */
export async function uploadBrandingImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("image", file);
  const res = await apiJson<{ success: boolean; url: string }>(
    `${BRANDING_API}/upload-image`,
    { method: "POST", body: fd },
  );
  return res.url;
}

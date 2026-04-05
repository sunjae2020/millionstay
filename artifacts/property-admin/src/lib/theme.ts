export interface ThemeSettings {
  primary_color: string;
  brand_name: string;
  sidebar_theme: string;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const match = hex.match(/^#([0-9a-f]{6})$/i);
  if (!match) return null;

  const r = parseInt(match[1].slice(0, 2), 16) / 255;
  const g = parseInt(match[1].slice(2, 4), 16) / 255;
  const b = parseInt(match[1].slice(4, 6), 16) / 255;

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

export function applyPrimaryColor(hex: string) {
  const hsl = hexToHsl(hex);
  if (!hsl) return;

  const val = `${hsl.h} ${hsl.s}% ${hsl.l}%`;
  const root = document.documentElement;

  root.style.setProperty("--primary", val);
  root.style.setProperty("--ring", val);
  root.style.setProperty("--sidebar-primary", val);
  root.style.setProperty("--sidebar-ring", val);
  root.style.setProperty("--primary-foreground", "0 0% 100%");
  root.style.setProperty("--sidebar-primary-foreground", "0 0% 100%");
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

export function initTheme() {
  const theme = loadTheme();
  if (theme.primary_color) {
    applyPrimaryColor(theme.primary_color);
  }
}

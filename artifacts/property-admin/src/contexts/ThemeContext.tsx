import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import {
  loadTheme,
  applySidebarTheme,
  applyDarkMode,
  applyFavicon,
  saveTheme,
  hydrateBrandingFromApi,
} from "@/lib/theme";
import { APP_NAME } from "@/lib/appName";

interface BrandState {
  logo: string | null;
  logoDark: string | null;
  brandName: string;
  sidebarTheme: string;
  darkMode: boolean;
  currency: string;
  currencyPosition: string;
}

interface ThemeContextValue extends BrandState {
  refresh: () => void;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  logo: null,
  logoDark: null,
  brandName: APP_NAME,
  sidebarTheme: "dark",
  darkMode: false,
  currency: "AUD",
  currencyPosition: "prefix",
  refresh: () => {},
  toggleDarkMode: () => {},
});

function readState(): BrandState {
  const theme = loadTheme();
  return {
    logo: theme.logo ?? null,
    logoDark: theme.logo_dark ?? null,
    brandName: theme.brand_name ?? APP_NAME,
    sidebarTheme: theme.sidebar_theme ?? "dark",
    darkMode: theme.dark_mode === true,
    currency: theme.currency ?? "AUD",
    currencyPosition: theme.currency_position ?? "prefix",
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BrandState>(readState);

  // On mount, pull the server-persisted branding (shared across admins/devices)
  // and apply it over the instant localStorage paint. Public endpoint → also
  // themes the login screen before authentication.
  useEffect(() => {
    let alive = true;
    hydrateBrandingFromApi().then((theme) => {
      if (alive && theme) setState(readState());
    });
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(() => {
    const theme = loadTheme();
    applyDarkMode(theme.dark_mode === true, theme.sidebar_theme ?? "dark");
    applySidebarTheme(theme.sidebar_theme ?? "dark");
    const fav = theme.dark_mode && theme.favicon_dark ? theme.favicon_dark : theme.favicon ?? null;
    applyFavicon(fav);
    setState(readState());
  }, []);

  const toggleDarkMode = useCallback(() => {
    const theme = loadTheme();
    const next = !(theme.dark_mode === true);
    saveTheme({ dark_mode: next });
    applyDarkMode(next, theme.sidebar_theme ?? "dark");
    const fav = next && theme.favicon_dark ? theme.favicon_dark : theme.favicon ?? null;
    applyFavicon(fav);
    setState(readState());
  }, []);

  return (
    <ThemeContext.Provider value={{ ...state, refresh, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useBrand() {
  return useContext(ThemeContext);
}

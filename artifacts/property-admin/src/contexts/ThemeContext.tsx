import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { loadTheme, applySidebarTheme, applyDarkMode, applyFavicon, saveTheme } from "@/lib/theme";

interface BrandState {
  logo: string | null;
  logoDark: string | null;
  brandName: string;
  sidebarTheme: string;
  darkMode: boolean;
}

interface ThemeContextValue extends BrandState {
  refresh: () => void;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  logo: null,
  logoDark: null,
  brandName: "MillionStay",
  sidebarTheme: "dark",
  darkMode: false,
  refresh: () => {},
  toggleDarkMode: () => {},
});

function readState(): BrandState {
  const theme = loadTheme();
  return {
    logo: theme.logo ?? null,
    logoDark: theme.logo_dark ?? null,
    brandName: theme.brand_name ?? "MillionStay",
    sidebarTheme: theme.sidebar_theme ?? "dark",
    darkMode: theme.dark_mode === true,
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BrandState>(readState);

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

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { loadTheme, applySidebarTheme } from "@/lib/theme";

interface BrandState {
  logo: string | null;
  brandName: string;
  sidebarTheme: string;
}

interface ThemeContextValue extends BrandState {
  refresh: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  logo: null,
  brandName: "MillionStay",
  sidebarTheme: "dark",
  refresh: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BrandState>(() => {
    const theme = loadTheme();
    return {
      logo: theme.logo ?? null,
      brandName: theme.brand_name ?? "MillionStay",
      sidebarTheme: theme.sidebar_theme ?? "dark",
    };
  });

  const refresh = useCallback(() => {
    const theme = loadTheme();
    const sidebarTheme = theme.sidebar_theme ?? "dark";
    applySidebarTheme(sidebarTheme);
    setState({
      logo: theme.logo ?? null,
      brandName: theme.brand_name ?? "MillionStay",
      sidebarTheme,
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ ...state, refresh }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useBrand() {
  return useContext(ThemeContext);
}

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { loadTheme } from "@/lib/theme";

interface BrandState {
  logo: string | null;
  brandName: string;
}

interface ThemeContextValue extends BrandState {
  refresh: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  logo: null,
  brandName: "MillionStay",
  refresh: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BrandState>(() => {
    const theme = loadTheme();
    return {
      logo: theme.logo ?? null,
      brandName: theme.brand_name ?? "MillionStay",
    };
  });

  const refresh = useCallback(() => {
    const theme = loadTheme();
    setState({
      logo: theme.logo ?? null,
      brandName: theme.brand_name ?? "MillionStay",
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

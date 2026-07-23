import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getApiBase } from "@/lib/api-base";
import { DEFAULT_CURRENCY, FORCE_DISPLAY_CURRENCY } from "@/lib/defaultCurrency";

export type RateInfo = { rate: number; inverse: number; source: string; effective_date: string };
export type RatesMap = Record<string, RateInfo>;

const API_BASE = `${getApiBase()}/api/v1`;

const LS_RATES = "millionstay_exchange_rates";
const LS_RATES_TS = "millionstay_rates_timestamp";
const LS_DISPLAY = "millionstay_display_currency";
const CACHE_TTL_MS = 60 * 60 * 1000;

const DEFAULT_BY_LANG: Record<string, string> = {
  ko: "KRW",
  ja: "JPY",
  zh: "CNY",
  th: "THB",
  ms: "MYR",
  "en-AU": "AUD",
};

function detectDefaultCurrency(): string {
  // A per-instance pin (VITE_DEFAULT_CURRENCY) always wins over the browser
  // heuristic so a single-currency white-label (e.g. MetHeim → KRW) is stable
  // regardless of the visitor's locale.
  if (DEFAULT_CURRENCY) return DEFAULT_CURRENCY;
  if (typeof navigator === "undefined") return "AUD";
  const lang = navigator.language || "en";
  if (DEFAULT_BY_LANG[lang]) return DEFAULT_BY_LANG[lang];
  const short = lang.split("-")[0];
  if (DEFAULT_BY_LANG[short]) return DEFAULT_BY_LANG[short];
  if (lang.startsWith("en")) return "AUD";
  return "USD";
}

const ZERO_DECIMAL = new Set(["KRW", "JPY", "THB", "PHP", "VND", "IDR"]);
const SYMBOL: Record<string, string> = {
  AUD: "A$",
  USD: "US$",
  KRW: "₩",
  JPY: "¥",
  CNY: "¥",
  THB: "฿",
  PHP: "₱",
  MYR: "RM ",
  SGD: "S$",
  EUR: "€",
  GBP: "£",
  VND: "₫",
  IDR: "Rp ",
};

export function formatCurrencyAmount(amount: number, ccy: string): string {
  if (!Number.isFinite(amount)) return "";
  const code = (ccy || "AUD").toUpperCase();
  const sym = SYMBOL[code] ?? "";
  const decimals = ZERO_DECIMAL.has(code) ? 0 : 2;
  const rounded = Number(amount.toFixed(decimals));
  const formatted = rounded.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return sym ? `${sym}${formatted}` : `${formatted} ${code}`;
}

type Ctx = {
  rates: RatesMap;
  updatedAt: string | null;
  isLoading: boolean;
  displayCurrency: string;
  setDisplayCurrency: (c: string) => void;
  /** True when this instance is pinned to a single display currency (VITE_DEFAULT_CURRENCY). */
  forceDisplayCurrency: boolean;
  /** Convert `amount` from `from` ccy to `to` ccy via AUD. Returns null if rates unavailable. */
  convertPrice: (amount: number, from: string, to: string) => number | null;
  /** Returns "≈ ₩123,456" for the user-selected display currency, or null if same as `from` or no rate. */
  formatReference: (amount: number, from: string) => string | null;
  /**
   * Format a price for display. On a single-currency instance the amount is
   * converted into the display currency and shown as the primary price (no
   * reference line). Otherwise the primary price stays in the listing's own
   * currency, with a converted "≈" reference for the visitor's display currency.
   */
  formatDisplayPrice: (amount: number, from: string) => { primary: string; reference: string | null };
  refresh: () => Promise<void>;
};

const DisplayCurrencyContext = createContext<Ctx | null>(null);

export function DisplayCurrencyProvider({ children }: { children: ReactNode }) {
  const [rates, setRates] = useState<RatesMap>({});
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [displayCurrency, setDisplayCurrencyState] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_CURRENCY || "AUD";
    return localStorage.getItem(LS_DISPLAY) || detectDefaultCurrency();
  });

  const setDisplayCurrency = useCallback((c: string) => {
    setDisplayCurrencyState(c);
    try { localStorage.setItem(LS_DISPLAY, c); } catch {}
  }, []);

  const fetchRates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/public/exchange-rates`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const map: RatesMap = json?.data?.rates ?? {};
      const ts: string | null = json?.data?.updatedAt ?? null;
      setRates(map);
      setUpdatedAt(ts);
      try {
        localStorage.setItem(LS_RATES, JSON.stringify({ rates: map, updatedAt: ts }));
        localStorage.setItem(LS_RATES_TS, String(Date.now()));
      } catch {}
    } catch {
      // keep whatever rates are in memory
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const tsRaw = localStorage.getItem(LS_RATES_TS);
      const cached = localStorage.getItem(LS_RATES);
      if (tsRaw && cached) {
        const ageMs = Date.now() - Number(tsRaw);
        const parsed = JSON.parse(cached);
        if (parsed?.rates) {
          setRates(parsed.rates);
          setUpdatedAt(parsed.updatedAt ?? null);
        }
        if (ageMs < CACHE_TTL_MS) return;
      }
    } catch {}
    fetchRates();
  }, [fetchRates]);

  const convertPrice = useCallback(
    (amount: number, from: string, to: string): number | null => {
      if (!Number.isFinite(amount)) return null;
      const a = (from || "AUD").toUpperCase();
      const b = (to || "AUD").toUpperCase();
      if (a === b) return amount;
      const rA = a === "AUD" ? 1 : rates[a]?.rate;
      const rB = b === "AUD" ? 1 : rates[b]?.rate;
      if (!rA || !rB) return null;
      // amount in AUD = amount * rA;  in B = (amount * rA) / rB
      return (amount * rA) / rB;
    },
    [rates],
  );

  const formatReference = useCallback(
    (amount: number, from: string): string | null => {
      const a = (from || "AUD").toUpperCase();
      const b = displayCurrency.toUpperCase();
      if (a === b) return null;
      const v = convertPrice(amount, a, b);
      if (v == null) return null;
      return `≈ ${formatCurrencyAmount(v, b)}`;
    },
    [convertPrice, displayCurrency],
  );

  const formatDisplayPrice = useCallback(
    (amount: number, from: string): { primary: string; reference: string | null } => {
      const src = (from || "AUD").toUpperCase();
      if (FORCE_DISPLAY_CURRENCY) {
        const conv = convertPrice(amount, src, displayCurrency);
        // Rates may not be loaded on first paint — fall back to the source
        // amount (never show another instance's currency as the primary once
        // rates arrive, though: convertPrice returns identity when src == display).
        if (conv != null) return { primary: formatCurrencyAmount(conv, displayCurrency), reference: null };
        return { primary: formatCurrencyAmount(amount, src), reference: null };
      }
      return { primary: formatCurrencyAmount(amount, src), reference: formatReference(amount, src) };
    },
    [convertPrice, displayCurrency, formatReference],
  );

  const value = useMemo<Ctx>(
    () => ({
      rates,
      updatedAt,
      isLoading,
      displayCurrency,
      setDisplayCurrency,
      forceDisplayCurrency: FORCE_DISPLAY_CURRENCY,
      convertPrice,
      formatReference,
      formatDisplayPrice,
      refresh: fetchRates,
    }),
    [rates, updatedAt, isLoading, displayCurrency, setDisplayCurrency, convertPrice, formatReference, formatDisplayPrice, fetchRates],
  );

  return <DisplayCurrencyContext.Provider value={value}>{children}</DisplayCurrencyContext.Provider>;
}

export function useDisplayCurrency(): Ctx {
  const ctx = useContext(DisplayCurrencyContext);
  if (!ctx) throw new Error("useDisplayCurrency must be used within DisplayCurrencyProvider");
  return ctx;
}

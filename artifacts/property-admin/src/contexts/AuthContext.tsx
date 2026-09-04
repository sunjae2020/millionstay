import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import {
  getStoredToken,
  getStoredRefreshToken,
  storeSession,
  onTokenChange,
  refreshAccessToken,
  msUntilTokenExpiry,
  rememberLoginEmail,
  apiJson,
  ApiError,
} from "@/lib/apiFetch";

export interface AuthUser {
  id: number;
  email: string;
  role: string;
  first_name?: string;
  last_name?: string;
  force_password_change?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshNow: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Renew this long before the access token (1h) actually expires, so a slow
// network or a sleeping laptop still has room to recover before anything 401s.
const RENEW_LEAD_MS = 10 * 60 * 1000;
const MIN_RENEW_DELAY_MS = 15 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [isLoading, setIsLoading] = useState(true);

  // Keep an always-current ref so refresh timer / interceptors get the latest.
  const tokenRef = useRef<string | null>(token);
  tokenRef.current = token;

  useEffect(() => {
    // The generated client asks for a token before every request; renew a
    // spent one here so those calls never 401 on a stale token either.
    setAuthTokenGetter(async () => {
      const remaining = msUntilTokenExpiry(getStoredToken());
      if ((remaining == null || remaining < 30_000) && getStoredRefreshToken()) {
        await refreshAccessToken();
      }
      return getStoredToken() ?? tokenRef.current;
    });
    return () => setAuthTokenGetter(null);
  }, []);

  // A refresh can be triggered from anywhere (a stray API call retrying a 401).
  // Mirror the stored token into React state whenever that happens.
  useEffect(() => onTokenChange((t) => setToken(t)), []);

  const refreshNow = useCallback(() => refreshAccessToken(), []);

  const logout = useCallback(() => {
    const rt = getStoredRefreshToken();
    const t = tokenRef.current;
    fetch("/api/v1/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
      body: JSON.stringify({ refresh_token: rt }),
    }).catch(() => {});
    storeSession(null, null);
    setUser(null);
  }, []);

  useEffect(() => {
    const stored = getStoredToken();
    // An expired access token is recoverable as long as the 30-day refresh
    // token is still there — don't bounce the user to /login over it.
    if (!stored && !getStoredRefreshToken()) { setIsLoading(false); return; }

    (async () => {
      const me = async () => {
        const t = getStoredToken();
        if (!t) return null;
        const r = await fetch("/api/v1/auth/me", { headers: { Authorization: `Bearer ${t}` } });
        return r.ok ? await r.json() : null;
      };

      try {
        let data = await me();
        if (!data && await refreshAccessToken()) data = await me();
        if (!data) throw new Error("auth_failed");
        setUser(data.user);
        setToken(getStoredToken());
      } catch {
        storeSession(null, null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Renew the access token ahead of its own expiry rather than on a fixed
  // interval, and re-arm from the new token each time.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const arm = () => {
      const remaining = msUntilTokenExpiry(getStoredToken());
      // Unreadable expiry → fall back to the old fixed cadence.
      const delay = remaining == null
        ? 50 * 60 * 1000
        : Math.max(remaining - RENEW_LEAD_MS, MIN_RENEW_DELAY_MS);
      timer = setTimeout(async () => {
        if (cancelled) return;
        await refreshAccessToken();
        if (!cancelled) arm();
      }, delay);
    };
    arm();

    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [token]);

  // Timers don't fire reliably in a background tab and stop entirely while the
  // machine sleeps — which is exactly when the token quietly expires. Catch up
  // whenever the tab comes back or the network returns.
  useEffect(() => {
    if (!getStoredRefreshToken()) return;
    const catchUp = () => {
      if (document.visibilityState === "hidden") return;
      const remaining = msUntilTokenExpiry(getStoredToken());
      if (remaining == null || remaining < RENEW_LEAD_MS) void refreshAccessToken();
    };
    document.addEventListener("visibilitychange", catchUp);
    window.addEventListener("focus", catchUp);
    window.addEventListener("online", catchUp);
    return () => {
      document.removeEventListener("visibilitychange", catchUp);
      window.removeEventListener("focus", catchUp);
      window.removeEventListener("online", catchUp);
    };
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    let data: any;
    try {
      data = await apiJson<{ success: boolean; token: string; refresh_token?: string; user: AuthUser; error?: string }>(
        "/api/v1/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }) },
      );
    } catch (err) {
      // ApiError already carries a friendly message. Surface it as-is.
      throw err instanceof ApiError ? err : new Error("Login failed. Please try again.");
    }
    if (!data?.success) {
      throw new ApiError(401, "LOGIN_FAILED", data?.error ?? "Invalid email or password.");
    }
    storeSession(data.token, data.refresh_token ?? undefined);
    rememberLoginEmail(email);
    setUser(data.user);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshNow }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

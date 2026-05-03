import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getStoredToken, apiJson, ApiError } from "@/lib/apiFetch";

const TOKEN_KEY = "ms_auth_token";
const REFRESH_KEY = "ms_refresh_token";

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

function getRefreshToken(): string | null {
  try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
}
function setRefreshToken(t: string | null) {
  try {
    if (t) localStorage.setItem(REFRESH_KEY, t);
    else localStorage.removeItem(REFRESH_KEY);
  } catch {}
}

async function postRefresh(refresh_token: string): Promise<{ token: string; refresh_token: string } | null> {
  try {
    const res = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) return null;
    return { token: data.token, refresh_token: data.refresh_token };
  } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [isLoading, setIsLoading] = useState(true);

  // Keep an always-current ref so refresh timer / interceptors get the latest.
  const tokenRef = useRef<string | null>(token);
  tokenRef.current = token;

  useEffect(() => {
    setAuthTokenGetter(() => tokenRef.current);
    return () => setAuthTokenGetter(null);
  }, []);

  const refreshNow = useCallback(async (): Promise<boolean> => {
    const rt = getRefreshToken();
    if (!rt) return false;
    const out = await postRefresh(rt);
    if (!out) return false;
    localStorage.setItem(TOKEN_KEY, out.token);
    setRefreshToken(out.refresh_token);
    setToken(out.token);
    return true;
  }, []);

  const logout = useCallback(() => {
    const rt = getRefreshToken();
    const t = tokenRef.current;
    fetch("/api/v1/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
      body: JSON.stringify({ refresh_token: rt }),
    }).catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    setRefreshToken(null);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) { setIsLoading(false); return; }
    fetch("/api/v1/auth/me", { headers: { Authorization: `Bearer ${stored}` } })
      .then(async (r) => {
        if (r.ok) return r.json();
        // Try refresh once on 401
        if (r.status === 401) {
          const ok = await refreshNow();
          if (ok) {
            const t = tokenRef.current;
            const r2 = await fetch("/api/v1/auth/me", { headers: { Authorization: `Bearer ${t}` } });
            if (r2.ok) return r2.json();
          }
        }
        throw new Error("auth_failed");
      })
      .then((data) => {
        setUser(data.user);
        setToken(getStoredToken());
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setRefreshToken(null);
        setToken(null);
      })
      .finally(() => setIsLoading(false));
  }, [refreshNow]);

  // Background access-token refresh: every 50 minutes (TTL is 60 min).
  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => { refreshNow(); }, 50 * 60 * 1000);
    return () => clearInterval(id);
  }, [token, refreshNow]);

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
    localStorage.setItem(TOKEN_KEY, data.token);
    if (data.refresh_token) setRefreshToken(data.refresh_token);
    setToken(data.token);
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

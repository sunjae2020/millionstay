import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import {
  apiPost,
  apiGet,
  getStoredToken,
  getStoredRefreshToken,
  storeSession,
  onTokenChange,
  refreshAccessToken,
  msUntilTokenExpiry,
  rememberLoginEmail,
} from "./api";
import { passkeySignIn } from "./passkey";

// Renew well before the access token (1h) expires, so a slow network or a
// sleeping laptop still has room to recover before anything 401s.
const RENEW_LEAD_MS = 10 * 60 * 1000;
const MIN_RENEW_DELAY_MS = 15 * 1000;

interface PartnerUser {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  portal_type: string;
  account_id: number;
  /** 담당자가 발급한 임시 비밀번호 상태 — 바꾸기 전까지 포털을 쓸 수 없다. */
  force_password_change?: boolean;
  /** 관리자가 "대신 열기"로 연 세션 — 상단 배너를 띄운다. */
  impersonated?: boolean;
}

interface AuthContextType {
  user: PartnerUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Passkey sign-in — no identifier typed; the authenticator names the user. */
  loginWithPasskey: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PartnerUser | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // SSO hand-off from the unified partner login on the landing site: after the
    // partner authenticates there, the token is passed cross-origin in the URL
    // fragment (#sso=...). Consume it, persist it, then strip it from the URL.
    try {
      const m = window.location.hash.match(/[#&]sso=([^&]+)/);
      if (m && m[1]) {
        const handed = decodeURIComponent(m[1]);
        // 관리자 "대신 열기" 토큰(impersonated_by 클레임)은 refresh 없이 30분만
        // 산다. 이 브라우저에 남아 있던 다른 세션의 refresh 토큰으로 갱신되며
        // 엉뚱한 사람으로 바뀌지 않도록, 그 경우엔 refresh 토큰을 지운다.
        let impersonation = false;
        try {
          const claims = JSON.parse(atob(handed.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")));
          impersonation = !!claims?.impersonated_by;
        } catch { /* not a decodable JWT — the server will reject it anyway */ }
        if (impersonation) storeSession(handed, null);
        else storeSession(handed);
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    } catch { /* ignore malformed fragment */ }

    // An expired access token is recoverable while the 30-day refresh token
    // lives, so don't drop the session over it.
    if (!getStoredToken() && !getStoredRefreshToken()) { setLoading(false); return; }
    apiGet<{ success: boolean; user: PartnerUser }>("/v1/auth/partner/me")
      .then((d) => { if (d.success) setUser(d.user); })
      .catch(() => storeSession(null, null))
      .finally(() => setLoading(false));
  }, []);

  // Any API call may rotate the token; mirror that into React state, and drop
  // the user when a session actually ends (the login screen renders in place,
  // on the same route, so the partner comes back to the page they were on).
  useEffect(() => onTokenChange((t) => {
    setToken(t);
    if (!t) setUser(null);
  }), []);

  // Renew ahead of the token's own expiry, re-arming from each new token.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const arm = () => {
      const remaining = msUntilTokenExpiry(getStoredToken());
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

  // Timers are throttled in background tabs and stop while the machine sleeps,
  // which is exactly when the token expires. Catch up on return.
  useEffect(() => {
    const catchUp = () => {
      if (document.visibilityState === "hidden" || !getStoredRefreshToken()) return;
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

  async function login(email: string, password: string) {
    const d = await apiPost<{ success: boolean; token: string; refresh_token?: string; user: PartnerUser }>(
      "/v1/auth/partner/login",
      { email, password }
    );
    storeSession(d.token, d.refresh_token ?? undefined);
    rememberLoginEmail(email);
    setUser(d.user);
    // Only leave sign-in-only routes; otherwise stay where the partner was.
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const here = window.location.pathname.slice(base.length) || "/";
    if (/^\/(apply|forgot-password|reset-password)/.test(here)) {
      window.history.replaceState(null, "", `${base}/`);
    }
  }

  async function loginWithPasskey() {
    const d = await passkeySignIn();
    storeSession(d.token, d.refresh_token ?? undefined);
    rememberLoginEmail(d.user.email);
    setUser(d.user);
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const here = window.location.pathname.slice(base.length) || "/";
    if (/^\/(apply|forgot-password|reset-password)/.test(here)) {
      window.history.replaceState(null, "", `${base}/`);
    }
  }

  function logout() {
    const rt = getStoredRefreshToken();
    if (rt) void apiPost("/v1/auth/partner/logout", { refresh_token: rt }).catch(() => {});
    storeSession(null, null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, loginWithPasskey, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

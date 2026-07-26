import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { apiPost, apiGet } from "./api";

interface PartnerUser {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  portal_type: string;
  account_id: number;
}

interface AuthContextType {
  user: PartnerUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PartnerUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // SSO hand-off from the unified partner login on the landing site: after the
    // partner authenticates there, the token is passed cross-origin in the URL
    // fragment (#sso=...). Consume it, persist it, then strip it from the URL.
    try {
      const m = window.location.hash.match(/[#&]sso=([^&]+)/);
      if (m && m[1]) {
        localStorage.setItem("partner_token", decodeURIComponent(m[1]));
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    } catch { /* ignore malformed fragment */ }

    const token = localStorage.getItem("partner_token");
    if (!token) { setLoading(false); return; }
    apiGet<{ success: boolean; user: PartnerUser }>("/v1/auth/partner/me")
      .then((d) => { if (d.success) setUser(d.user); })
      .catch(() => localStorage.removeItem("partner_token"))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const d = await apiPost<{ success: boolean; token: string; user: PartnerUser }>(
      "/v1/auth/partner/login",
      { email, password }
    );
    localStorage.setItem("partner_token", d.token);
    setUser(d.user);
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    if (window.location.pathname !== `${base}/`) {
      window.history.replaceState(null, "", `${base}/`);
    }
  }

  function logout() {
    localStorage.removeItem("partner_token");
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

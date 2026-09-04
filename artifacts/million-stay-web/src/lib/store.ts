import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { getApiBase } from "./api-base";

const API_BASE = getApiBase();
if (API_BASE) setBaseUrl(API_BASE);

export interface GuestInfo {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone?: string | null;
  account_id: number | null;
  avatar_url?: string | null;
}

interface AuthState {
  token: string | null;
  guest: GuestInfo | null;
  setAuth: (token: string, guest: GuestInfo, refreshToken?: string | null) => void;
  setGuest: (guest: GuestInfo) => void;
  logout: () => void;
}

const GUEST_TOKEN_KEY = "ms_guest_token";
const GUEST_REFRESH_KEY = "ms_guest_refresh_token";
const LAST_EMAIL_KEY = "ms_guest_last_email";

/** Renew this long before the access token (1h) expires. */
const RENEW_LEAD_MS = 10 * 60 * 1000;
const MIN_RENEW_DELAY_MS = 15 * 1000;

export function getGuestToken(): string | null {
  try { return localStorage.getItem(GUEST_TOKEN_KEY); } catch { return null; }
}

export function getGuestRefreshToken(): string | null {
  try { return localStorage.getItem(GUEST_REFRESH_KEY); } catch { return null; }
}

/** Remember the address the guest signed in with, so the form can prefill it. */
export function rememberLoginEmail(email: string): void {
  try { localStorage.setItem(LAST_EMAIL_KEY, email); } catch {}
}

export function getRememberedLoginEmail(): string {
  try { return localStorage.getItem(LAST_EMAIL_KEY) ?? ""; } catch { return ""; }
}

/** Milliseconds until the access token expires (negative once expired). */
export function msUntilTokenExpiry(token: string | null = getGuestToken()): number | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp * 1000 - Date.now() : null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const remaining = msUntilTokenExpiry(token);
  return remaining == null || remaining <= 0;
}

function writeTokens(token: string | null, refreshToken?: string | null): void {
  try {
    if (token) localStorage.setItem(GUEST_TOKEN_KEY, token);
    else localStorage.removeItem(GUEST_TOKEN_KEY);
    if (refreshToken !== undefined) {
      if (refreshToken) localStorage.setItem(GUEST_REFRESH_KEY, refreshToken);
      else localStorage.removeItem(GUEST_REFRESH_KEY);
    }
  } catch {}
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Exchange the 30-day refresh token for a fresh access token.
 *
 * Single-flight: rotation revokes the presented refresh token, so two of these
 * running at once would end the session instead of extending it.
 */
export function refreshGuestToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const rt = getGuestRefreshToken();
    if (!rt) return false;
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/guest/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: rt }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data.token) return false;
      writeTokens(data.token, data.refresh_token ?? undefined);
      useAuthStore.setState({ token: data.token });
      scheduleRenewal();
      return true;
    } catch {
      // Network blip — keep the session; the next call or timer retries.
      return false;
    }
  })();

  const pending = refreshInFlight;
  pending.finally(() => { if (refreshInFlight === pending) refreshInFlight = null; });
  return pending;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      guest: null,
      setAuth: (token, guest, refreshToken) => {
        set({ token, guest });
        writeTokens(token, refreshToken ?? undefined);
        scheduleRenewal();
      },
      setGuest: (guest) => set({ guest }),
      logout: () => {
        const rt = getGuestRefreshToken();
        if (rt) {
          fetch(`${API_BASE}/api/v1/auth/guest/logout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: rt }),
          }).catch(() => {});
        }
        set({ token: null, guest: null });
        writeTokens(null, null);
        clearRenewal();
      },
    }),
    {
      name: "ms-guest-storage",
      onRehydrateStorage: () => (state) => {
        // An expired access token is recoverable while the refresh token
        // lives — renew rather than dropping the guest's session.
        if (state?.token && isTokenExpired(state.token)) {
          if (getGuestRefreshToken()) void refreshGuestToken();
          else state.logout();
        } else if (state?.token) {
          scheduleRenewal();
        }
      },
    }
  )
);

/* ── Keeping the access token alive ──────────────────────────────────────
 * Renew from the token's own expiry rather than a fixed interval, and catch
 * up when the tab returns: timers are throttled in background tabs and stop
 * entirely while the machine sleeps, which is exactly when a token lapses.
 */

let renewTimer: ReturnType<typeof setTimeout> | undefined;

function clearRenewal(): void {
  if (renewTimer) { clearTimeout(renewTimer); renewTimer = undefined; }
}

function scheduleRenewal(): void {
  clearRenewal();
  if (!getGuestRefreshToken()) return;
  const remaining = msUntilTokenExpiry();
  const delay = remaining == null
    ? MIN_RENEW_DELAY_MS
    : Math.max(remaining - RENEW_LEAD_MS, MIN_RENEW_DELAY_MS);
  renewTimer = setTimeout(async () => {
    await refreshGuestToken();
    scheduleRenewal();
  }, delay);
}

if (typeof window !== "undefined") {
  const catchUp = () => {
    if (document.visibilityState === "hidden" || !getGuestRefreshToken()) return;
    const remaining = msUntilTokenExpiry();
    if (remaining == null || remaining < RENEW_LEAD_MS) void refreshGuestToken();
    else scheduleRenewal();
  };
  document.addEventListener("visibilitychange", catchUp);
  window.addEventListener("focus", catchUp);
  window.addEventListener("online", catchUp);
  scheduleRenewal();
}

// Initialize token getter for custom fetch
setAuthTokenGetter(async () => {
  const token = getGuestToken();
  const remaining = msUntilTokenExpiry(token);
  // A spent token is renewed in place, so generated-client calls never 401
  // on an expiry the app could have handled.
  if ((token || getGuestRefreshToken()) && (remaining == null || remaining < 30_000)) {
    if (getGuestRefreshToken()) {
      await refreshGuestToken();
    } else if (token) {
      writeTokens(null, null);
      return null;
    }
  }
  return getGuestToken();
});

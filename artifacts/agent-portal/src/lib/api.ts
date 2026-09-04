/**
 * Unified API helper — partner portal (agent).
 *
 * - Always throws `ApiError` with a friendly user-facing message.
 * - 401 on a protected route → auto-logout + redirect to /.
 * - Network errors / empty bodies handled gracefully.
 */

// Resolve the API base URL.
//
// Dev: VITE_API_URL points at the local API server (e.g. http://localhost:5100).
// Prod: when running under millionstay.com we hit the production Railway host
//       directly. We do NOT use VITE_API_URL here because `.env.local` leaks
//       the localhost value into production builds, which breaks the deployed
//       portal ("Cannot connect to the server").
const PROD_API = "https://workspaceapi-server-production-ff8e.up.railway.app";

function apiBase(): string {
  if (typeof window !== "undefined" && window.location.hostname.endsWith("millionstay.com")) {
    return PROD_API;
  }
  return (import.meta.env.VITE_API_URL ?? "").trim();
}

const BASE = `${apiBase()}/api`;
const TOKEN_KEY = "partner_token";
const REFRESH_KEY = "partner_refresh_token";
const LAST_EMAIL_KEY = "partner_last_email";

/* ── Session token plumbing ─────────────────────────────────────────────
 * The access token lives an hour; the refresh token lives 30 days. The auth
 * context subscribes here so a refresh triggered by any API call keeps the
 * signed-in state in sync — an expired access token must never end the session.
 */

type TokenListener = (token: string | null) => void;
const tokenListeners = new Set<TokenListener>();

export function onTokenChange(listener: TokenListener): () => void {
  tokenListeners.add(listener);
  return () => { tokenListeners.delete(listener); };
}

export function getStoredToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function getStoredRefreshToken(): string | null {
  try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
}

export function storeSession(token: string | null, refreshToken?: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    if (refreshToken !== undefined) {
      if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
      else localStorage.removeItem(REFRESH_KEY);
    }
  } catch {}
  for (const l of tokenListeners) l(token);
}

/** Remember the address the partner signed in with, so the form can prefill it. */
export function rememberLoginEmail(email: string): void {
  try { localStorage.setItem(LAST_EMAIL_KEY, email); } catch {}
}

export function getRememberedLoginEmail(): string {
  try { return localStorage.getItem(LAST_EMAIL_KEY) ?? ""; } catch { return ""; }
}

/** Milliseconds until the access token expires (negative once expired). */
export function msUntilTokenExpiry(token: string | null = getStoredToken()): number | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload?.exp === "number" ? payload.exp * 1000 - Date.now() : null;
  } catch { return null; }
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Exchange the refresh token for a fresh access token.
 *
 * Single-flight: rotation revokes the presented refresh token, so two of these
 * in parallel would invalidate the session instead of extending it.
 */
export function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const rt = getStoredRefreshToken();
    if (!rt) return false;
    try {
      const res = await fetch(`${BASE}/v1/auth/partner/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: rt }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data.token) return false;
      storeSession(data.token, data.refresh_token ?? undefined);
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

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly payload: unknown;
  constructor(status: number, code: string, message: string, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

function friendlyMessage(status: number, serverError?: unknown): string {
  const serverMsg =
    typeof serverError === "string" && serverError.length > 0 && serverError.length < 500
      ? serverError
      : null;
  if (status === 0) return "Cannot connect to the server. Please check your network or try again later.";
  if (status === 400) return serverMsg ?? "The request was invalid. Please check your input and try again.";
  if (status === 401) return serverMsg ?? "Invalid email or password.";
  if (status === 403) return serverMsg ?? "You don't have permission to perform this action.";
  if (status === 404) return serverMsg ?? "The requested resource was not found.";
  if (status === 408 || status === 504) return "The server is taking too long to respond. Please try again.";
  if (status === 409) return serverMsg ?? "Duplicate or conflicting request.";
  if (status === 413) return "File is too large.";
  if (status === 429) return serverMsg ?? "Too many requests. Please wait a moment and try again.";
  if (status === 502 || status === 503) return "The server is temporarily unavailable. Please try again shortly.";
  if (status >= 500) return "A server error occurred. Please try again later.";
  return serverMsg ?? `Something went wrong (HTTP ${status}). Please try again.`;
}

async function safeReadJson(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { _raw: text }; }
}

function isLoginPath(path: string): boolean {
  return /\/auth\/(partner\/login|partner\/refresh|passkey\/login)/.test(path);
}

function endSession(): void {
  // Clear the tokens and let the app re-render its login screen in place: the
  // route stays put, so signing back in returns the partner to the same page.
  storeSession(null, null);
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const send = async (): Promise<Response> => {
    const token = getStoredToken();
    const isFormData = options?.body instanceof FormData;
    const headers: HeadersInit = {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    };
    try {
      return await fetch(`${BASE}${path}`, { ...options, headers });
    } catch (err) {
      throw new ApiError(0, "NETWORK", friendlyMessage(0), { cause: String(err) });
    }
  };

  const res = await send();
  // An expired access token is not the end of the session: rotate it and
  // replay the request once, so the hour boundary goes unnoticed.
  if (res.status === 401 && !isLoginPath(path) && await refreshAccessToken()) {
    return send();
  }
  return res;
}

async function handleResponse<T>(res: Response, path: string): Promise<T> {
  const body = await safeReadJson(res);
  if (res.status === 401) {
    // apiFetch already tried to refresh — reaching here means the session is
    // genuinely over.
    if (!isLoginPath(path)) endSession();
    const serverErr = (body as any)?.error ?? (body as any)?.message;
    throw new ApiError(401, "UNAUTHORIZED", friendlyMessage(401, serverErr), body);
  }
  if (!res.ok) {
    const serverErr = (body as any)?.error ?? (body as any)?.message;
    throw new ApiError(res.status, "HTTP_" + res.status, friendlyMessage(res.status, serverErr), body);
  }
  return body as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const r = await apiFetch(path);
  return handleResponse<T>(r, path);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const r = await apiFetch(path, { method: "POST", body: body == null ? undefined : JSON.stringify(body) });
  return handleResponse<T>(r, path);
}

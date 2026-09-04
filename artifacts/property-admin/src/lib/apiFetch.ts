/**
 * Unified API fetch helper.
 *
 * Goals:
 * - Always returns predictable errors (`ApiError`) instead of cryptic
 *   "Failed to execute 'json' on 'Response': Unexpected end of JSON input".
 * - 401 from a protected endpoint → auto-logout + redirect.
 * - Network errors / empty responses get friendly messages.
 */

const TOKEN_KEY = "ms_auth_token";
const REFRESH_KEY = "ms_refresh_token";
const LAST_EMAIL_KEY = "ms_last_email";

export function getStoredToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function getStoredRefreshToken(): string | null {
  try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
}

/** Remember the address the user signed in with, so the login form can prefill it. */
export function rememberLoginEmail(email: string): void {
  try { localStorage.setItem(LAST_EMAIL_KEY, email); } catch {}
}

export function getRememberedLoginEmail(): string {
  try { return localStorage.getItem(LAST_EMAIL_KEY) ?? ""; } catch { return ""; }
}

/* ── Session token plumbing ─────────────────────────────────────────────
 * The access token lives an hour; the refresh token lives 30 days. Anything
 * that observes a token change (AuthContext) subscribes here, so a refresh
 * triggered by a stray API call keeps React state in sync.
 */

type TokenListener = (token: string | null) => void;
const tokenListeners = new Set<TokenListener>();

export function onTokenChange(listener: TokenListener): () => void {
  tokenListeners.add(listener);
  return () => { tokenListeners.delete(listener); };
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

/** Seconds-since-epoch expiry of a JWT, or null when it can't be read. */
export function getTokenExpiry(token: string | null): number | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload?.exp === "number" ? payload.exp : null;
  } catch { return null; }
}

/** Milliseconds until the stored access token expires (negative once expired). */
export function msUntilTokenExpiry(token: string | null = getStoredToken()): number | null {
  const exp = getTokenExpiry(token);
  return exp == null ? null : exp * 1000 - Date.now();
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Exchange the refresh token for a fresh access token.
 *
 * Single-flight: concurrent callers (the scheduled refresh, a 401 retry, a
 * second API call) share one request. Rotation revokes the old refresh token,
 * so firing two of these at once used to invalidate the whole session.
 */
export function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const rt = getStoredRefreshToken();
    if (!rt) return false;
    try {
      const res = await fetch("/api/v1/auth/refresh", {
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

/** Structured API error. Always thrown by `apiJson`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Original server payload, if any. */
  readonly payload: unknown;
  constructor(status: number, code: string, message: string, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

/** Friendly human messages keyed by HTTP status. Server-supplied error wins
 *  over the default if it's plausibly user-facing (length-bounded, no stack). */
function friendlyMessage(status: number, serverError?: unknown): string {
  const serverMsg =
    typeof serverError === "string" && serverError.length > 0 && serverError.length < 500
      ? serverError
      : null;

  // 0 == fetch threw (network down, CORS, server completely offline).
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

/** Where to send the user back after a re-login. Same-origin paths only. */
export function loginUrlFor(currentPath?: string): string {
  const here = currentPath ?? window.location.pathname + window.location.search + window.location.hash;
  const isPublic = /^\/(login|register|forgot-password|reset-password)/.test(here);
  if (isPublic || !here.startsWith("/")) return "/login";
  return `/login?next=${encodeURIComponent(here)}`;
}

function clearAuthAndRedirect(): void {
  storeSession(null, null);
  // Avoid loops: don't redirect if already on a public page.
  const here = window.location.pathname;
  if (!/^\/(login|register|forgot-password|reset-password)/.test(here)) {
    const target = loginUrlFor();
    window.location.href = target === "/login"
      ? "/login?reason=session_expired"
      : `${target}&reason=session_expired`;
  }
}

function isLoginPath(path: string): boolean {
  return /\/auth\/(login|guest\/login|partner\/login|refresh|passkey\/login)/.test(path);
}

/**
 * Low-level fetch — returns a raw Response. Use this only when you need to
 * inspect headers/streams. For everything else, prefer `apiJson`.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const send = async (): Promise<Response> => {
    const token = getStoredToken();
    const isFormData = init?.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers as Record<string, string> ?? {}),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      return await fetch(path, { ...init, headers });
    } catch (err) {
      // fetch only throws on network failure, CORS denial, or aborted requests.
      throw new ApiError(0, "NETWORK", friendlyMessage(0), { cause: String(err) });
    }
  };

  const res = await send();
  // An expired access token is not the end of the session: rotate it and
  // replay the request once, so the user never notices the hour boundary.
  if (res.status === 401 && !isLoginPath(path) && await refreshAccessToken()) {
    return send();
  }
  return res;
}

/**
 * High-level helper: fetches and parses JSON. Throws `ApiError` on any
 * non-2xx response or unparseable body, with a user-facing message.
 */
export async function apiJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  const body = await safeReadJson(res);

  if (res.status === 401) {
    // Login attempt itself returns 401 with body — surface the message.
    // Otherwise the session is genuinely gone (apiFetch already tried to
    // refresh): log out and redirect, remembering where the user was.
    if (!isLoginPath(path)) {
      clearAuthAndRedirect();
    }
    const serverErr = (body as any)?.error ?? (body as any)?.message;
    throw new ApiError(401, "UNAUTHORIZED", friendlyMessage(401, serverErr), body);
  }

  if (!res.ok) {
    const serverErr = (body as any)?.error ?? (body as any)?.message;
    throw new ApiError(res.status, "HTTP_" + res.status, friendlyMessage(res.status, serverErr), body);
  }

  return body as T;
}

/** Shorthand for `apiJson(path, { method: "POST", body: JSON.stringify(body) })`. */
export function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  return apiJson<T>(path, { method: "POST", body: body == null ? undefined : JSON.stringify(body) });
}

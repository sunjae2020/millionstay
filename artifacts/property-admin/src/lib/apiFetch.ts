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

export function getStoredToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
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

function clearAuthAndRedirect(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch {}
  // Avoid loops: don't redirect if already on a public page.
  const here = window.location.pathname;
  if (!/^\/(login|register|forgot-password|reset-password)/.test(here)) {
    window.location.href = "/login?reason=session_expired";
  }
}

/**
 * Low-level fetch — returns a raw Response. Use this only when you need to
 * inspect headers/streams. For everything else, prefer `apiJson`.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
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
    // Otherwise this is an expired session: log out and redirect.
    const isLoginAttempt = /\/auth\/(login|guest\/login|partner\/login)/.test(path);
    if (!isLoginAttempt) {
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

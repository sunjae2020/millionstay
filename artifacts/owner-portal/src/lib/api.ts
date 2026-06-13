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

function clearAuthAndRedirect(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
  const here = window.location.pathname;
  if (!/^\/(forgot-password|reset-password|apply)/.test(here)) {
    window.location.href = "/?reason=session_expired";
  }
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
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
}

async function handleResponse<T>(res: Response, path: string): Promise<T> {
  const body = await safeReadJson(res);
  if (res.status === 401) {
    const isLoginAttempt = /\/auth\/(login|guest\/login|partner\/login)/.test(path);
    if (!isLoginAttempt) clearAuthAndRedirect();
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

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const r = await apiFetch(path, { method: "PUT", body: body == null ? undefined : JSON.stringify(body) });
  return handleResponse<T>(r, path);
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const r = await apiFetch(path, { method: "PATCH", body: body == null ? undefined : JSON.stringify(body) });
  return handleResponse<T>(r, path);
}

export async function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  const r = await apiFetch(path, { method: "DELETE", body: body == null ? undefined : JSON.stringify(body) });
  return handleResponse<T>(r, path);
}

/** Multipart upload — apiFetch omits the JSON Content-Type for FormData bodies. */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const r = await apiFetch(path, { method: "POST", body: formData });
  return handleResponse<T>(r, path);
}

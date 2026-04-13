const BASE = "/api";

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = localStorage.getItem("partner_token");
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers ?? {}),
  };
  return fetch(`${BASE}${path}`, { ...options, headers });
}

export async function apiGet<T>(path: string): Promise<T> {
  const r = await apiFetch(path);
  if (!r.ok) throw new Error(`API error ${r.status}`);
  return r.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const r = await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? `API error ${r.status}`);
  return data;
}

const TOKEN_KEY = "ms_auth_token";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getStoredToken();
  // FormData는 브라우저가 Content-Type + boundary를 자동 설정 — 절대 덮어쓰면 안 됨
  const isFormData = init?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(init?.headers as Record<string, string> ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(path, { ...init, headers });
}

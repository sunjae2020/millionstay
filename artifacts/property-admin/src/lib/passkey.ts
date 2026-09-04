/**
 * Passkey (WebAuthn) sign-in for the admin app.
 *
 * Passwords still work — a passkey is an extra way in, registered per device
 * from 설정 → 보안. Sign-in is discoverable: click the button and the browser
 * offers whichever passkey it holds for this host, so no identifier is typed.
 */
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { apiJson, apiPost } from "./apiFetch";

export interface PasskeyCredential {
  id: number;
  device_name: string | null;
  device_type: string | null;
  backed_up: boolean;
  last_used_at: string | null;
  created_at: string;
}

export interface PasskeyLoginResult {
  token: string;
  refresh_token?: string;
  user: {
    id: number;
    email: string;
    role: string;
    first_name: string | null;
    last_name: string | null;
    force_password_change?: boolean;
  };
}

const AUDIENCE = "admin";

export function passkeysSupported(): boolean {
  return typeof window !== "undefined" && browserSupportsWebAuthn();
}

/** The user dismissed the OS prompt — not an error worth shouting about. */
export function isPasskeyCancel(err: unknown): boolean {
  const name = (err as { name?: string })?.name ?? "";
  return name === "NotAllowedError" || name === "AbortError";
}

export async function passkeySignIn(): Promise<PasskeyLoginResult> {
  const start = await apiPost<{ data: { challenge_id: number; options: Record<string, unknown> } }>(
    "/api/v1/auth/passkey/login/options",
    { audience: AUDIENCE },
  );
  const response = await startAuthentication({ optionsJSON: start.data.options as never });
  return apiPost<PasskeyLoginResult>("/api/v1/auth/passkey/login/verify", {
    audience: AUDIENCE,
    challenge_id: start.data.challenge_id,
    response,
  });
}

export async function registerPasskey(deviceName?: string): Promise<PasskeyCredential> {
  const start = await apiPost<{ data: { challenge_id: number; options: Record<string, unknown> } }>(
    "/api/v1/auth/passkey/register/options",
  );
  const response = await startRegistration({ optionsJSON: start.data.options as never });
  const done = await apiPost<{ data: PasskeyCredential }>("/api/v1/auth/passkey/register/verify", {
    challenge_id: start.data.challenge_id,
    response,
    device_name: deviceName,
  });
  return done.data;
}

export async function listPasskeys(): Promise<PasskeyCredential[]> {
  const r = await apiJson<{ data: PasskeyCredential[] }>("/api/v1/auth/passkey/credentials");
  return r.data ?? [];
}

export async function renamePasskey(id: number, deviceName: string): Promise<void> {
  await apiJson(`/api/v1/auth/passkey/credentials/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ device_name: deviceName }),
  });
}

export async function deletePasskey(id: number): Promise<void> {
  await apiJson(`/api/v1/auth/passkey/credentials/${id}`, { method: "DELETE" });
}

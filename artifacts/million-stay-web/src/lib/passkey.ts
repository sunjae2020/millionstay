/**
 * Passkey (WebAuthn) sign-in for the guest web app.
 *
 * The password login is untouched — a passkey is an additional way in, added
 * per device from the account page. Sign-in is discoverable, so the guest taps
 * once and the phone offers the passkey it holds for this site.
 */
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { apiFetch, type GuestAuthResponse } from "./guest-api";

export interface PasskeyCredential {
  id: number;
  device_name: string | null;
  device_type: string | null;
  backed_up: boolean;
  last_used_at: string | null;
  created_at: string;
}

const AUDIENCE = "guest";

export function passkeysSupported(): boolean {
  return typeof window !== "undefined" && browserSupportsWebAuthn();
}

/** The user dismissed the OS prompt — not an error worth shouting about. */
export function isPasskeyCancel(err: unknown): boolean {
  const name = (err as { name?: string })?.name ?? "";
  return name === "NotAllowedError" || name === "AbortError";
}

export async function passkeySignIn(): Promise<GuestAuthResponse> {
  const start = await apiFetch<{ data: { challenge_id: number; options: Record<string, unknown> } }>(
    "/auth/passkey/login/options",
    { method: "POST", body: JSON.stringify({ audience: AUDIENCE }) },
  );
  const response = await startAuthentication({ optionsJSON: start.data.options as never });
  return apiFetch<GuestAuthResponse>("/auth/passkey/login/verify", {
    method: "POST",
    body: JSON.stringify({ audience: AUDIENCE, challenge_id: start.data.challenge_id, response }),
  });
}

export async function registerPasskey(deviceName?: string): Promise<PasskeyCredential> {
  const start = await apiFetch<{ data: { challenge_id: number; options: Record<string, unknown> } }>(
    "/auth/passkey/register/options",
    { method: "POST" },
  );
  const response = await startRegistration({ optionsJSON: start.data.options as never });
  const done = await apiFetch<{ data: PasskeyCredential }>("/auth/passkey/register/verify", {
    method: "POST",
    body: JSON.stringify({ challenge_id: start.data.challenge_id, response, device_name: deviceName }),
  });
  return done.data;
}

export async function listPasskeys(): Promise<PasskeyCredential[]> {
  const r = await apiFetch<{ data: PasskeyCredential[] }>("/auth/passkey/credentials");
  return r.data ?? [];
}

export async function deletePasskey(id: number): Promise<void> {
  await apiFetch(`/auth/passkey/credentials/${id}`, { method: "DELETE" });
}

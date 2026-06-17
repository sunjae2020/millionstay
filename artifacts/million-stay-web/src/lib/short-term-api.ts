// Public short-term accommodation application API. No auth — intake is open,
// review is admin-brokered. On success returns a signing token; the applicant
// is sent to /sign/:token to e-sign the application / T&C.
import { getApiBase } from "./api-base";

export interface ShortTermPreferences {
  budget_weekly?: string;
  move_in_flexible?: boolean;
  notes?: string;
}

export interface ShortTermApplicationInput {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  nationality?: string;
  check_in?: string;
  check_out?: string;
  guests?: number;
  preferred_area?: string;
  property_type?: string;
  preferences: ShortTermPreferences;
  terms_accepted: boolean;
}

export interface ShortTermApplicationResult {
  success: boolean;
  request_ref: string;
  signing_token: string;
}

export async function submitShortTermApplication(input: ShortTermApplicationInput): Promise<ShortTermApplicationResult> {
  const res = await fetch(`${getApiBase()}/api/v1/public/short-term-applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? "Failed to submit application.");
  return body as ShortTermApplicationResult;
}

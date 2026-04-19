/**
 * Password policy — Sprint B-6
 *
 * Enforced ONLY on new password creation (registration, change, reset).
 * Existing accounts continue to log in with their current password until they
 * change it.
 *
 * Rules:
 *   - Min length 12
 *   - At least one lowercase letter
 *   - At least one uppercase letter
 *   - At least one digit
 *   - At least one special character (any non-alphanumeric)
 */
export interface PolicyResult {
  ok: boolean;
  error?: string;
}

const MIN_LEN = 12;

export function validatePassword(password: string): PolicyResult {
  if (typeof password !== "string") return { ok: false, error: "Password is required." };
  if (password.length < MIN_LEN) {
    return { ok: false, error: `Password must be at least ${MIN_LEN} characters.` };
  }
  if (!/[a-z]/.test(password)) {
    return { ok: false, error: "Password must contain a lowercase letter." };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, error: "Password must contain an uppercase letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, error: "Password must contain a digit." };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { ok: false, error: "Password must contain a special character." };
  }
  return { ok: true };
}

/**
 * Per-instance language-flag overrides (white-label, spec §2.3 sibling of
 * defaultCurrency).
 *
 * Injected at build time via VITE_FLAG_OVERRIDES as a comma-separated list of
 * `<lang-code>:<iso-country>` pairs, e.g. `en:us` for the Metheim instance so the
 * English language switcher shows the US flag instead of the primary MillionStay
 * default (Australia). The DB `languages.flag_iso` is shared across instances, so
 * this override is applied purely in the guest frontend and leaves the primary
 * MillionStay site's Australian flag untouched.
 *
 * Unset (primary MillionStay) → no overrides → behaviour unchanged.
 */
const OVERRIDES: Record<string, string> = Object.fromEntries(
  ((import.meta.env.VITE_FLAG_OVERRIDES as string | undefined) ?? "")
    .split(",")
    .map((pair) => pair.trim().toLowerCase())
    .filter(Boolean)
    .map((pair) => pair.split(":").map((s) => s.trim()))
    .filter(([code, iso]) => code && iso) as [string, string][],
);

/** Override ISO country code for a language, or undefined if none configured. */
export function flagOverride(code: string): string | undefined {
  return OVERRIDES[code.toLowerCase()];
}

/** Resolve a language's flag ISO, honouring per-instance overrides. */
export function flagIsoFor(code: string, fallbackIso: string): string {
  return flagOverride(code) ?? fallbackIso;
}

/** Regional-indicator flag emoji for an ISO-3166 alpha-2 country code. */
export function flagEmoji(iso: string): string {
  const cc = iso.trim().toUpperCase();
  if (cc.length !== 2) return "";
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

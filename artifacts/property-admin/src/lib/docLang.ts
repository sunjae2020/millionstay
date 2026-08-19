/**
 * Tenant default document/template language.
 *
 * White-label instances are single-language shops in practice: a Korean
 * instance (Metheim) issues Korean paperwork and its ops team edits the Korean
 * copy first. `VITE_DEFAULT_DOC_LANG` mirrors the server-side `DEFAULT_DOC_LANG`
 * (tenants/metheim/config.env → `ko`) so both ends agree on which locale is the
 * default, and every locale picker in the console opens on it and lists it
 * first. Unset (MillionStay) keeps English as the default.
 */
export const DOC_LOCALES_ALL = ["en", "ko", "ja", "zh", "th", "vi"] as const;
export type DocLocale = (typeof DOC_LOCALES_ALL)[number];

function resolve(): DocLocale {
  const raw = (import.meta.env.VITE_DEFAULT_DOC_LANG ?? "").toLowerCase().slice(0, 2);
  return (DOC_LOCALES_ALL as readonly string[]).includes(raw) ? (raw as DocLocale) : "en";
}

/** The tenant's default document language (Metheim = "ko"). */
export const DEFAULT_DOC_LANG: DocLocale = resolve();

/** All document locales, tenant default first. */
export const DOC_LOCALES: DocLocale[] = [
  DEFAULT_DOC_LANG,
  ...DOC_LOCALES_ALL.filter((l) => l !== DEFAULT_DOC_LANG),
];

/** Order a locale list so the tenant default comes first. */
export function orderLocales(locales: string[]): string[] {
  return [...locales].sort((a, b) => {
    if (a === b) return 0;
    if (a === DEFAULT_DOC_LANG) return -1;
    if (b === DEFAULT_DOC_LANG) return 1;
    return DOC_LOCALES.indexOf(a as DocLocale) - DOC_LOCALES.indexOf(b as DocLocale);
  });
}

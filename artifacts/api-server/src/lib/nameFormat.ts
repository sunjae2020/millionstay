// App-wide person-name formatting rule (homestay students + host families):
//   first name → first letter UPPER, rest lower   ("YUYA"  → "Yuya")
//   last name  → ALL UPPERCASE                     ("Fujii" → "FUJII")
// Applied at write time so stored names are canonical everywhere (admin, e-sign
// documents, emails, exports, all apps).
export function formatFirstName(s?: string | null): string {
  const v = (s ?? "").trim();
  return v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : "";
}

export function formatLastName(s?: string | null): string {
  return (s ?? "").trim().toUpperCase();
}

export function formatPersonName(first?: string | null, last?: string | null): string {
  return `${formatFirstName(first)} ${formatLastName(last)}`.trim();
}

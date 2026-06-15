// App-wide person-name formatting rule (homestay students + host families):
//   first name → first letter UPPER, rest lower   ("YUYA"  → "Yuya")
//   last name  → ALL UPPERCASE                     ("Fujii" → "FUJII")
// Used at display sites to render existing records consistently; new records are
// also normalized server-side on write.
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

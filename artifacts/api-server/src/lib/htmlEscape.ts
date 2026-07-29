/**
 * HTML escaping for email/document templates. Lives in its own module so both
 * `email.ts` and `emailBrand.ts` can use it without an import cycle.
 */
export function escapeHtml(input: string | null | undefined): string {
  if (input == null) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

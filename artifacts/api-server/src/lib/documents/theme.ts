/**
 * Document Hub — shared brand theme (Phase 1)
 *
 * Single source of truth for the visual identity of all customer-facing
 * documents (invoices, receipts, quotes, contracts) AND transactional emails.
 *
 * The same HTML/CSS shell is used both for:
 *   - Email bodies (sent via Resend), and
 *   - PDF rendering (HTML → Puppeteer → PDF),
 * so colour, font, letter-spacing and spacing are defined exactly once and can
 * never drift between the two channels.
 *
 * Token values mirror the existing brand usage in `lib/email.ts` and the guest
 * portal (`design-tokens.md`): brand orange #E8621A, Inter typeface, etc.
 */

/** Brand + typographic design tokens. Keep in sync with the proposal §5.1. */
export const DOC_TOKENS = {
  brand: "#E8621A",
  brandHover: "#F97316",
  ink: "#111111",
  inkMuted: "#555555",
  inkFaint: "#999999",
  pageBg: "#f9fafb",
  cardBg: "#ffffff",
  border: "#f0f0f0",
  accentBg: "#FFF7F0",
  accentBorder: "#FCD9B6",
  font: `'Inter', 'Noto Sans KR', 'Noto Sans JP', 'Noto Sans SC', 'Noto Sans TC', 'Noto Sans Thai', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
  monoFont: `'SFMono-Regular', ui-monospace, Menlo, Consolas, monospace`,
  radius: "14px",
  lineHeight: "1.5",
} as const;

/** Company / issuer details for document headers + footers. Env-overridable. */
export interface CompanyInfo {
  legalName: string;
  tradingName: string;
  abn: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  logoUrl: string;
  /** Per-tenant brand color for document shell accents. Falls back to
   *  DOC_TOKENS.brand (#E8621A) when unset so the primary AU instance is orange. */
  brandColor?: string;
}

export function getCompanyInfo(): CompanyInfo {
  return {
    legalName: process.env.COMPANY_LEGAL_NAME ?? "MillionStay Pty Ltd",
    tradingName: process.env.COMPANY_TRADING_NAME ?? "MillionStay",
    abn: process.env.COMPANY_ABN ?? "",
    email: process.env.SUPPORT_EMAIL ?? "millionstay.com@gmail.com",
    phone: process.env.COMPANY_PHONE ?? "",
    website: process.env.PUBLIC_WEB_URL ?? "https://www.millionstay.com",
    address: process.env.COMPANY_ADDRESS ?? "Melbourne, VIC, Australia",
    logoUrl: process.env.EMAIL_LOGO_URL ?? "https://www.millionstay.com/millionstay-logo.png",
  };
}

// Currency formatting for documents. Mirrors the guest web's
// `formatCurrencyAmount` (DisplayCurrencyContext) so invoices/receipts/quotes/
// contracts render the correct symbol per currency — e.g. ₩450,000 for a Korean
// (Metheim) KRW invoice instead of the old hard-coded "450,000.00 AUD".
const CURRENCY_SYMBOL: Record<string, string> = {
  AUD: "A$", USD: "US$", KRW: "₩", JPY: "¥", CNY: "¥", THB: "฿",
  PHP: "₱", MYR: "RM ", SGD: "S$", EUR: "€", GBP: "£", VND: "₫", IDR: "Rp ",
};
const ZERO_DECIMAL_CURRENCIES = new Set(["KRW", "JPY", "THB", "PHP", "VND", "IDR"]);

/** Format a monetary amount in its own currency: `₩450,000`, `A$1,234.56`. */
export function formatDocMoney(
  amount: string | number | null | undefined,
  currency: string | null | undefined,
): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  const code = (currency || "AUD").toUpperCase();
  const sym = CURRENCY_SYMBOL[code] ?? "";
  const decimals = ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2;
  const rounded = Number(n.toFixed(decimals));
  const formatted = rounded.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return sym ? `${sym}${formatted}` : `${formatted} ${code}`;
}

/** HTML-escape user-supplied text before interpolating into templates. */
export function escapeHtml(input: string | null | undefined): string {
  if (input == null) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface RenderShellOptions {
  /** Document title (also used as the <title> and document type label). */
  docType: string;
  /** Pre-rendered, already-escaped inner HTML for the document body. */
  bodyHtml: string;
  company?: CompanyInfo;
  /** When true, render print/PDF-optimised CSS (A4 page, no page background). */
  forPrint?: boolean;
  /** Diagonal status watermark (e.g. PAID / DRAFT / VOID), colour-coded. */
  watermark?: { text: string; color: string } | null;
  /** When true, tighten spacing so a short (single-item) document fits one A4 page. */
  compact?: boolean;
}

/**
 * Colour for the diagonal status watermark, shared by invoice/quote/receipt.
 * Green = settled, red = cancelled/expired, blue = in-flight, amber = attention,
 * grey = draft/archived. Unknown statuses fall back to neutral grey.
 */
const WATERMARK_COLORS: Record<string, string> = {
  Draft: "#9ca3af",
  Sent: "#2563eb",
  Paid: "#16a34a",
  Accepted: "#16a34a",
  Void: "#dc2626",
  Declined: "#dc2626",
  Overdue: "#dc2626",
  Expired: "#d97706",
  Archived: "#9ca3af",
};

export function statusWatermarkColor(status: string): string {
  return WATERMARK_COLORS[status] ?? "#9ca3af";
}

/**
 * Wrap a document body in the branded shell: logo header, content card, footer.
 * Returns a full standalone HTML document suitable for both email and PDF.
 */
export function renderDocumentShell(opts: RenderShellOptions): string {
  const t = DOC_TOKENS;
  const company = opts.company ?? getCompanyInfo();
  // Per-tenant brand color, falling back to the default orange (#E8621A) so the
  // primary AU instance is unchanged while MetHeim documents render teal.
  const brand = company.brandColor || DOC_TOKENS.brand;
  const year = new Date().getFullYear();
  const print = opts.forPrint ?? false;
  const watermark = opts.watermark;
  const compact = opts.compact ?? false;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(opts.docType)} · ${escapeHtml(company.tradingName)}</title>
<!-- Brand font (Inter) + Noto fallbacks so non-Latin text (ko/ja/zh/th) renders
     correctly in headless Chromium, which ships no CJK/Thai fonts. pdf.ts waits
     for document.fonts.ready before printing so these are embedded, not tofu. -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700&family=Noto+Sans+SC:wght@400;500;700&family=Noto+Sans+TC:wght@400;500;700&family=Noto+Sans+Thai:wght@400;500;700&display=swap" />
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body {
    font-family: ${t.font};
    margin: 0; padding: 0;
    background: ${print ? "#ffffff" : t.pageBg};
    color: ${t.ink};
    line-height: ${t.lineHeight};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .container {
    max-width: ${print ? "100%" : "640px"};
    margin: ${print ? "0" : "32px auto"};
    background: ${t.cardBg};
    border-radius: ${print ? "0" : t.radius};
    overflow: hidden;
    border-top: 4px solid ${brand};
    ${print ? "" : "box-shadow: 0 2px 8px rgba(0,0,0,0.08);"}
  }
  .doc-header {
    padding: 32px;
    border-bottom: 1px solid ${t.border};
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }
  .doc-header img { height: 40px; width: auto; display: block; }
  .doc-header .doc-type {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: ${brand};
    text-align: right;
  }
  .doc-header .issuer {
    font-size: 12px;
    color: ${t.inkFaint};
    text-align: right;
    margin-top: 4px;
    line-height: 1.4;
  }
  .doc-body { padding: 32px; }
  .doc-footer {
    padding: 20px 32px;
    border-top: 1px solid ${t.border};
    font-size: 12px;
    color: ${t.inkFaint};
    text-align: center;
    line-height: 1.5;
  }
  h1, h2, h3 { color: ${t.ink}; }
  /* Each section is a light, rounded card so groups are clearly separated. */
  .section {
    margin-bottom: 16px;
    padding: 18px 20px;
    background: ${t.cardBg};
    border: 1px solid ${t.border};
    border-radius: 12px;
  }
  .section:last-child { margin-bottom: 0; }
  .section h3 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    color: ${brand};
    margin: 0 0 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid ${t.border};
  }
  .row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid ${t.border};
    font-size: 14px;
  }
  .row:last-child { border-bottom: none; }
  .row .label { color: ${t.inkMuted}; }
  .row .value { font-weight: 600; color: ${t.ink}; }
  .ref-chip {
    font-family: ${t.monoFont};
    letter-spacing: 0.05em;
    font-weight: 700;
    color: ${brand};
  }
  table.lines { width: 100%; border-collapse: collapse; margin: 8px 0 0; font-size: 14px; }
  table.lines th {
    text-align: left;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: ${t.inkFaint};
    padding: 8px 0;
    border-bottom: 2px solid ${t.border};
  }
  table.lines th.num, table.lines td.num { text-align: right; }
  table.lines td { padding: 12px 0; border-bottom: 1px solid ${t.border}; vertical-align: top; }
  .total-box {
    background: ${brand};
    border-radius: 12px;
    padding: 16px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 20px;
  }
  .total-box span { color: #ffffff; font-weight: 700; font-size: 15px; }
  .total-box .amount { font-size: 22px; }
  .info-box {
    background: ${t.accentBg};
    border: 1px solid ${t.accentBorder};
    border-radius: 10px;
    padding: 16px;
    margin-top: 20px;
    font-size: 13px;
    color: ${t.inkMuted};
  }
  .badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  /* Diagonal status watermark — colour conveys the document state at a glance.
     position:fixed makes Chromium repeat it on every printed page; the low
     opacity keeps the body text fully legible underneath. */
  .watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-32deg);
    font-size: 150px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
    opacity: 0.12;
    z-index: 2147483000;
    pointer-events: none;
    -webkit-user-select: none;
    user-select: none;
  }
  /* Keep cards/rows from splitting awkwardly across a page boundary. */
  .section, .total-box, .info-box { page-break-inside: avoid; }
  table.lines tr { page-break-inside: avoid; }
  /* Compact layout for short (single-item) documents so they fit one A4 page. */
  body.compact .doc-body { padding: 24px 32px; }
  body.compact .section { margin-bottom: 10px; padding: 12px 16px; }
  body.compact .section h3 { margin: 0 0 8px; padding-bottom: 6px; }
  body.compact .total-box { margin-top: 12px; padding: 12px 20px; }
  body.compact .info-box { margin-top: 12px; padding: 12px 14px; }
  body.compact .row { padding: 6px 0; }
  body.compact table.lines td { padding: 8px 0; }
</style>
</head>
<body${compact ? ' class="compact"' : ""}>
  ${watermark?.text ? `<div class="watermark" style="color:${escapeHtml(watermark.color)};">${escapeHtml(watermark.text)}</div>` : ""}
  <div class="container">
    <div class="doc-header">
      <img src="${escapeHtml(company.logoUrl)}" alt="${escapeHtml(company.tradingName)}" />
      <div>
        <div class="doc-type">${escapeHtml(opts.docType)}</div>
        <div class="issuer">
          ${escapeHtml(company.legalName)}${company.abn ? `<br/>ABN ${escapeHtml(company.abn)}` : ""}<br/>
          ${escapeHtml(company.email)}
        </div>
      </div>
    </div>
    <div class="doc-body">
      ${opts.bodyHtml}
    </div>
    <div class="doc-footer">
      © ${year} ${escapeHtml(company.legalName)} · ${escapeHtml(company.address)}<br/>
      ${escapeHtml(company.website)} · ${escapeHtml(company.email)}
    </div>
  </div>
</body>
</html>`;
}

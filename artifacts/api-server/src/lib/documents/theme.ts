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
  font: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans Thai', sans-serif`,
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
}

/**
 * Wrap a document body in the branded shell: logo header, content card, footer.
 * Returns a full standalone HTML document suitable for both email and PDF.
 */
export function renderDocumentShell(opts: RenderShellOptions): string {
  const t = DOC_TOKENS;
  const company = opts.company ?? getCompanyInfo();
  const year = new Date().getFullYear();
  const print = opts.forPrint ?? false;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(opts.docType)} · ${escapeHtml(company.tradingName)}</title>
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
    color: ${t.brand};
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
  .section { margin-bottom: 24px; }
  .section h3 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: ${t.inkFaint};
    margin: 0 0 10px;
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
    color: ${t.brand};
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
    background: ${t.brand};
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
</style>
</head>
<body>
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

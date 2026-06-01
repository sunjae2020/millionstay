/**
 * Document Hub — HTML → PDF renderer (Phase 1)
 *
 * Uses a single lazily-launched headless Chromium (Puppeteer) shared across
 * requests. Puppeteer is imported dynamically so the API server still boots in
 * environments where Chromium is not installed — the PDF endpoint then returns
 * a clear 503 rather than crashing the process at startup.
 */

// Minimal structural types so this module type-checks without @types/puppeteer
// in scope. The dynamic import is resolved at runtime.
type PdfPage = {
  setContent(html: string, opts: { waitUntil: string; timeout: number }): Promise<void>;
  pdf(opts: Record<string, unknown>): Promise<Uint8Array>;
  close(): Promise<void>;
};
type PdfBrowser = {
  newPage(): Promise<PdfPage>;
  close(): Promise<void>;
  connected?: boolean;
  isConnected?: () => boolean;
};

let browserPromise: Promise<PdfBrowser> | null = null;

export class PdfUnavailableError extends Error {
  readonly name = "PdfUnavailableError";
}

async function launchBrowser(): Promise<PdfBrowser> {
  let puppeteer: any;
  try {
    puppeteer = (await import("puppeteer")).default;
  } catch (err) {
    throw new PdfUnavailableError(
      "PDF generation is unavailable: the 'puppeteer' package is not installed.",
    );
  }
  try {
    return (await puppeteer.launch({
      headless: true,
      // Flags required to run Chromium inside containers (Railway, Docker).
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    })) as PdfBrowser;
  } catch (err) {
    throw new PdfUnavailableError(
      `PDF generation is unavailable: Chromium failed to launch (${(err as Error).message}).`,
    );
  }
}

function browserAlive(b: PdfBrowser): boolean {
  if (typeof b.isConnected === "function") return b.isConnected();
  if (typeof b.connected === "boolean") return b.connected;
  return true;
}

async function getBrowser(): Promise<PdfBrowser> {
  if (browserPromise) {
    try {
      const existing = await browserPromise;
      if (browserAlive(existing)) return existing;
    } catch {
      // fall through to relaunch
    }
  }
  browserPromise = launchBrowser();
  return browserPromise;
}

/**
 * Render a full HTML document to a PDF buffer (A4, print backgrounds on).
 * Throws {@link PdfUnavailableError} when Chromium cannot be used.
 */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  let page: PdfPage | null = null;
  try {
    page = await browser.newPage();
    // "load" fires once all resources (incl. the logo image) have finished or
    // errored — robust against a slow/unreachable logo CDN, unlike networkidle0
    // which can hang the whole render if a single request never settles.
    await page.setContent(html, { waitUntil: "load", timeout: 20_000 });
    const bytes = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
    });
    return Buffer.from(bytes);
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

/** Best-effort browser shutdown for graceful server termination. */
export async function closePdfBrowser(): Promise<void> {
  if (!browserPromise) return;
  try {
    const b = await browserPromise;
    await b.close();
  } catch {
    // ignore
  } finally {
    browserPromise = null;
  }
}

import type { Response } from "express";

/**
 * Download-filename convention for every generated document:
 *
 *   `문서이름-고객이름_YYYYMMDD.pdf`   e.g. `세대점검표-재원산업_20260729.pdf`
 *
 * The document name is the localised doc-type label (so a Korean tenant gets
 * Korean filenames) and the date is the day the file was produced, not the
 * document date — this is the "출력 날짜". The customer segment is dropped when
 * we have no name for the counterparty rather than leaving a dangling dash.
 *
 * The server is the single source of truth: `setDocumentDownloadHeaders` writes
 * the name into Content-Disposition and the admin/portal preview modal reads it
 * back off the response, so the browser save dialog matches the API exactly.
 */

/** Characters that are illegal (or merely annoying) in a filename, per OS. */
// eslint-disable-next-line no-control-regex
const ILLEGAL = /[\u0000-\u001f\u007f/\\:*?"<>|]+/g;

/** Trim a filename segment down to something every filesystem accepts. */
function sanitiseSegment(input: string | null | undefined): string {
  return (input ?? "")
    .replace(ILLEGAL, " ")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 60);
}

/** `YYYYMMDD` in the server's local time — the day the document was produced. */
export function documentDateStamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

export interface DocFilenameParts {
  /** Localised document name, e.g. "청구서" / "Tax Invoice" / "세대점검표". */
  docName: string;
  /** Counterparty the document is about — tenant, account, applicant, guest. */
  customerName?: string | null;
  /** Defaults to now. Pass a date only when reproducing an earlier filename. */
  date?: Date;
  /** Defaults to "pdf". */
  extension?: string;
}

/** Build `문서이름-고객이름_YYYYMMDD.pdf`. Falls back gracefully at every step. */
export function buildDocumentFilename(parts: DocFilenameParts): string {
  const doc = sanitiseSegment(parts.docName) || "document";
  const customer = sanitiseSegment(parts.customerName);
  const stamp = documentDateStamp(parts.date);
  const ext = (parts.extension ?? "pdf").replace(/^\./, "");
  return `${customer ? `${doc}-${customer}` : doc}_${stamp}.${ext}`;
}

/**
 * ASCII-only fallback for the plain `filename=` parameter. Non-Latin names
 * (Korean, Japanese, …) would be mangled by legacy clients, so they get the
 * transliteration-free fallback while `filename*` carries the real name.
 */
function asciiFallback(filename: string): string {
  const cleaned = filename.replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "").replace(/\s+/g, " ").trim();
  // Strip a leading separator left behind when the whole doc name was non-ASCII.
  const trimmed = cleaned.replace(/^[-_\s]+/, "");
  return trimmed.length > 4 ? trimmed : `document_${documentDateStamp()}.pdf`;
}

/**
 * Write Content-Type + Content-Disposition for a generated document.
 *
 * Uses RFC 5987 `filename*=UTF-8''…` so Korean/Japanese/Thai filenames survive
 * the trip, with an ASCII `filename=` fallback for old clients.
 */
export function setDocumentDownloadHeaders(
  res: Response,
  filename: string,
  opts: { disposition?: "inline" | "attachment"; contentType?: string } = {},
): void {
  const disposition = opts.disposition ?? "inline";
  res.setHeader("Content-Type", opts.contentType ?? "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `${disposition}; filename="${asciiFallback(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  // The preview modal reads the filename off the response; without this the
  // browser hides Content-Disposition from cross-origin XHR.
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
}

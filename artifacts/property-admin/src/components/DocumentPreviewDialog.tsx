import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, Download, Mail, X, ExternalLink, AlertTriangle, FileQuestion, FolderOpen, ArrowUpRight } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { DocumentEmailDialog, type DocumentEmailTarget } from "@/components/DocumentEmailDialog";

/**
 * Where the previewed document comes from.
 * - `api`  — an authenticated API path fetched with `apiFetch` (contracts,
 *            invoices, quotes, inspections, samples … everything we render
 *            server-side with puppeteer).
 * - `url`  — an already-signed/public URL (Cloudinary snapshots, uploaded
 *            account/contact documents). Fetched cross-origin is unreliable,
 *            so it is handed straight to the iframe.
 */
/**
 * Pull the filename out of a Content-Disposition header, preferring the RFC
 * 5987 `filename*=UTF-8''…` form so Korean/Japanese names survive intact.
 */
function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const extended = /filename\*=\s*UTF-8''([^;]+)/i.exec(header);
  if (extended?.[1]) {
    try { return decodeURIComponent(extended[1].trim()); } catch { /* fall through */ }
  }
  const plain = /filename\s*=\s*"([^"]+)"/i.exec(header) ?? /filename\s*=\s*([^;]+)/i.exec(header);
  return plain?.[1]?.trim() || null;
}

export type DocumentPreviewSource =
  | { kind: "api"; path: string; init?: RequestInit }
  | { kind: "url"; href: string };

export interface DocumentPreviewConfig {
  /** Dialog heading — usually the document ref. */
  title: string;
  /** Filename used by the Download button. */
  filename: string;
  source: DocumentPreviewSource;
  /**
   * Content type, when the caller already knows it.
   *
   * Only PDFs and images render inline; a Word/Excel/HWP/ZIP attachment handed
   * to an iframe either shows a blank pane or triggers a surprise download —
   * bulk-uploaded paperwork is not all PDFs. For `api` sources this is inferred
   * from the fetched blob, so it is only needed for `url` sources.
   */
  mimeType?: string | null;
  /**
   * 이메일 버튼은 **모든 문서에** 뜬다. 전용 발송 경로가 없는 문서는 지금 화면에
   * 떠 있는 바이트를 그대로 첨부해 보내는 공통 경로로 나간다
   * (`POST /v1/documents/email-attachment`).
   *
   * 아래 두 칸은 그 기본 동작을 대신하고 싶을 때만 준다 — 전용 경로가 있는
   * 문서(청구서·계약서 …)는 수신자 후보를 레코드에서 뽑아 채워 주고 문서
   * 종류에 맞는 본문을 쓰므로 그쪽이 낫다.
   *
   * Prefer `email`: it opens the recipient editor (prefilled with the
   * customer's / 담당자's address, editable, multiple addresses) before
   * sending. `onEmail` stays for flows that already own a send dialog.
   */
  onEmail?: () => Promise<void> | void;
  /** Sends through the shared recipient editor. Takes precedence over `onEmail`. */
  email?: {
    /** GET endpoint returning `{ default, candidates }` for the prefill. */
    recipientsPath?: string;
    send: (to: string[]) => Promise<void>;
  };
  /** Overrides the default "Send email" label. */
  emailLabel?: string;
  /**
   * Where this document is filed, shown under the title with a shortcut to the
   * record. Opened from the document library a preview is otherwise
   * context-free — you can read the page but not tell which contract it hangs
   * off, which is the first thing anyone asks next.
   */
  location?: {
    /** Human label, e.g. "계약 · MS-C-2026-014 · 1513호 후승재". */
    label: string;
    /** In-app route to the owning record. Omitted when there is nothing to open. */
    href?: string;
  };
}

interface Props {
  /** Non-null opens the dialog. */
  config: DocumentPreviewConfig | null;
  onClose: () => void;
}

/**
 * Shared document viewer: renders the document inline and offers
 * Print / Download / Email / Close. Replaces the old straight-to-download
 * behaviour everywhere a PDF, report or sample is produced.
 */
export function DocumentPreviewDialog({ config, onClose }: Props) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  // Filename the server put in Content-Disposition — the API owns the
  // 문서이름-고객이름_YYYYMMDD convention, so prefer it over the caller's guess.
  const [serverFilename, setServerFilename] = useState<string | null>(null);
  /** What the bytes actually are — decides whether the iframe can show them. */
  const [contentType, setContentType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailTarget, setEmailTarget] = useState<DocumentEmailTarget | null>(null);

  const open = config !== null;
  // An unknown type is treated as renderable: server-rendered PDFs are the
  // common case, and a missing Content-Type must not hide a document that
  // would have displayed perfectly well.
  const inlineRenderable =
    !contentType ||
    contentType.startsWith("application/pdf") ||
    contentType.startsWith("image/") ||
    contentType.startsWith("text/plain");
  const source = config?.source ?? null;
  const sourceKey = source
    ? source.kind === "api"
      ? `api:${source.path}`
      : `url:${source.href}`
    : null;

  // Fetch (or pass through) the document whenever the dialog opens on a new source.
  useEffect(() => {
    if (!source || !open) return;
    let cancelled = false;
    let created: string | null = null;

    if (source.kind === "url") {
      setObjectUrl(source.href);
      setServerFilename(null);
      setContentType(config?.mimeType ?? null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setObjectUrl(null);
    setServerFilename(null);
    setContentType(config?.mimeType ?? null);
    void (async () => {
      try {
        const res = await apiFetch(source.path, source.init);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        const fromHeader = filenameFromContentDisposition(res.headers.get("Content-Disposition"));
        const blob = await res.blob();
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        // The blob's own type is the honest answer — a caller's hint can be
        // stale, and an intake upload can be any file the office had.
        setContentType(blob.type || config?.mimeType || null);
        setObjectUrl(created);
        if (fromHeader) setServerFilename(fromHeader);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (created) setTimeout(() => URL.revokeObjectURL(created!), 60_000);
    };
    // `open` is a dep so reopening the same document refetches after the close
    // handler below cleared the last preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, open]);

  // Drop the preview when the dialog closes so reopening always refetches.
  useEffect(() => {
    if (!open) {
      setEmailTarget(null);
      setObjectUrl(null);
      setServerFilename(null);
      setContentType(null);
      setError(null);
      setEmailBusy(false);
    }
  }, [open]);

  const handlePrint = useCallback(() => {
    const frame = frameRef.current;
    try {
      if (frame?.contentWindow) {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        return;
      }
    } catch {
      /* cross-origin frame — fall through to a new window */
    }
    if (objectUrl) {
      const w = window.open(objectUrl, "_blank", "noopener,noreferrer");
      w?.addEventListener?.("load", () => w.print());
    }
  }, [objectUrl]);

  const handleDownload = useCallback(() => {
    if (!objectUrl || !config) return;
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = serverFilename ?? config.filename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [objectUrl, config, serverFilename]);

  /**
   * 전용 발송 경로가 없는 문서의 기본 발송. 미리보기가 이미 받아 둔 바이트를
   * 그대로 되돌려 보내므로, 새 문서 종류가 생겨도 발송 경로를 따로 만들 필요가
   * 없다. 수신자는 공용 수신자 편집기에서 적는다.
   */
  const sendGeneric = useCallback(async (to: string[]) => {
    if (!objectUrl || !config) throw new Error(t("doc_preview.email_not_ready", "The document is still loading."));
    const blob = await (await fetch(objectUrl)).blob();
    const name = serverFilename ?? config.filename;
    const form = new FormData();
    form.append("file", new File([blob], name, { type: contentType ?? blob.type ?? "application/pdf" }));
    form.append("filename", name);
    form.append("doc_type_label", config.title);
    form.append("ref", name.replace(/\.[^.]+$/, ""));
    form.append("to", JSON.stringify(to));
    const res = await apiFetch("/api/v1/documents/email-attachment", { method: "POST", body: form });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error?.message ?? t("doc_preview.email_failed", "Could not send the email."));
  }, [objectUrl, config, serverFilename, contentType, t]);

  const handleEmail = useCallback(async () => {
    // Preferred path: let the admin review/edit the recipients first.
    if (config?.email) {
      setEmailTarget({
        title: config.title,
        recipientsPath: config.email.recipientsPath,
        send: config.email.send,
      });
      return;
    }
    if (config?.onEmail) {
      setEmailBusy(true);
      try {
        await config.onEmail();
      } finally {
        setEmailBusy(false);
      }
      return;
    }
    // 전용 경로가 없는 문서 — 같은 수신자 편집기로, 공통 발송을 쓴다.
    if (!config) return;
    setEmailTarget({ title: config.title, send: sendGeneric });
  }, [config, sendGeneric]);

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl w-[95vw] h-[92vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-5 py-3 border-b shrink-0">
          <DialogTitle className="text-base truncate pr-8">
            {config?.title ?? t("doc_preview.title", "Document preview")}
          </DialogTitle>
          {config?.location && (
            <div className="flex items-center gap-1.5 pr-8 text-xs text-muted-foreground">
              <FolderOpen className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{config.location.label}</span>
              {config.location.href && (
                <button
                  type="button"
                  // Navigating away closes the dialog first: leaving a modal
                  // open over a page the user just moved to is disorienting.
                  onClick={() => { const href = config.location!.href!; onClose(); setLocation(href); }}
                  className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
                >
                  {t("doc_preview.open_record", "Go to record")}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 bg-muted/40">
          {loading && (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">{t("doc_preview.loading", "Preparing the document…")}</p>
            </div>
          )}
          {!loading && error && (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground px-6 text-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <p className="text-sm font-medium text-foreground">
                {t("doc_preview.failed", "The document could not be loaded.")}
              </p>
              <p className="text-xs">{error}</p>
            </div>
          )}
          {!loading && !error && objectUrl && inlineRenderable && (
            <iframe
              ref={frameRef}
              src={objectUrl}
              title={config?.title ?? "document"}
              className="w-full h-full border-0 bg-white"
            />
          )}
          {/* Word, Excel, HWP, ZIP … — stored and downloadable, but with no
              in-browser renderer. Say so instead of handing the iframe a file
              it will either blank on or quietly download. */}
          {!loading && !error && objectUrl && !inlineRenderable && (
            <div className="h-full flex flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
              <FileQuestion className="h-8 w-8" />
              <p className="text-sm font-medium text-foreground">
                {t("doc_preview.no_inline", "This file type cannot be previewed in the browser.")}
              </p>
              <p className="text-xs">
                {t(
                  "doc_preview.no_inline_hint",
                  "Only PDFs and images render here. Download it to open the file — {{name}}",
                  { name: config?.filename ?? "" },
                )}
              </p>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t flex flex-wrap items-center justify-end gap-2 shrink-0">
          {objectUrl && (
            <Button variant="ghost" size="sm" asChild>
              <a href={objectUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1.5" />
                {t("doc_preview.new_tab", "Open in new tab")}
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={!objectUrl || !inlineRenderable}>
            <Printer className="h-4 w-4 mr-1.5" />
            {t("doc_preview.print", "Print")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!objectUrl}>
            <Download className="h-4 w-4 mr-1.5" />
            {t("doc_preview.download", "Download")}
          </Button>
          {/* 이메일은 문서 종류를 가리지 않는다 — 전용 경로가 없으면 공통 발송. */}
          {config && (
            <Button variant="outline" size="sm" onClick={() => void handleEmail()}
              disabled={emailBusy || (!config.email && !config.onEmail && !objectUrl)}>
              {emailBusy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Mail className="h-4 w-4 mr-1.5" />}
              {config.emailLabel ?? t("doc_preview.email", "Send email")}
            </Button>
          )}
          <Button variant="default" size="sm" onClick={onClose}>
            <X className="h-4 w-4 mr-1.5" />
            {t("doc_preview.close", "Close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Recipient editor — sibling, not nested, so the two modals stack cleanly. */}
    <DocumentEmailDialog target={emailTarget} onClose={() => setEmailTarget(null)} />
    </>
  );
}

/** Convenience state holder so call sites stay one-liners. */
export function useDocumentPreview() {
  const [config, setConfig] = useState<DocumentPreviewConfig | null>(null);
  return {
    previewConfig: config,
    openPreview: (next: DocumentPreviewConfig) => setConfig(next),
    closePreview: () => setConfig(null),
  };
}

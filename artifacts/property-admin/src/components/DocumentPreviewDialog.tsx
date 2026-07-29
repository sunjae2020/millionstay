import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, Download, Mail, X, ExternalLink, AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

/**
 * Where the previewed document comes from.
 * - `api`  — an authenticated API path fetched with `apiFetch` (contracts,
 *            invoices, quotes, inspections, samples … everything we render
 *            server-side with puppeteer).
 * - `url`  — an already-signed/public URL (Cloudinary snapshots, uploaded
 *            account/contact documents). Fetched cross-origin is unreliable,
 *            so it is handed straight to the iframe.
 */
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
   * Optional — only documents that have a recipient (invoice, quote, contract,
   * receipt, settlement …) get an email button.
   */
  onEmail?: () => Promise<void> | void;
  /** Overrides the default "Send email" label. */
  emailLabel?: string;
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
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const open = config !== null;
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
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setObjectUrl(null);
    void (async () => {
      try {
        const res = await apiFetch(source.path, source.init);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        const blob = await res.blob();
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setObjectUrl(created);
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
      setObjectUrl(null);
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
    a.download = config.filename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [objectUrl, config]);

  const handleEmail = useCallback(async () => {
    if (!config?.onEmail) return;
    setEmailBusy(true);
    try {
      await config.onEmail();
    } finally {
      setEmailBusy(false);
    }
  }, [config]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl w-[95vw] h-[92vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-5 py-3 border-b shrink-0">
          <DialogTitle className="text-base truncate pr-8">
            {config?.title ?? t("doc_preview.title", "Document preview")}
          </DialogTitle>
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
          {!loading && !error && objectUrl && (
            <iframe
              ref={frameRef}
              src={objectUrl}
              title={config?.title ?? "document"}
              className="w-full h-full border-0 bg-white"
            />
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
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={!objectUrl}>
            <Printer className="h-4 w-4 mr-1.5" />
            {t("doc_preview.print", "Print")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!objectUrl}>
            <Download className="h-4 w-4 mr-1.5" />
            {t("doc_preview.download", "Download")}
          </Button>
          {config?.onEmail && (
            <Button variant="outline" size="sm" onClick={() => void handleEmail()} disabled={emailBusy}>
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

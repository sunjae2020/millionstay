import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, Mail, X, ExternalLink, Loader2 } from "lucide-react";

export interface DocumentPreviewConfig {
  /** Dialog heading — usually the document name. */
  title: string;
  /** Filename used by the Download button. */
  filename: string;
  /** Directly loadable document URL (token-gated public endpoint or signed URL). */
  href: string;
  /** Only documents that can be re-sent get an email button. */
  onEmail?: () => Promise<void> | void;
  emailLabel?: string;
}

interface Props {
  /** Non-null opens the dialog. */
  config: DocumentPreviewConfig | null;
  onClose: () => void;
}

/**
 * Shared document viewer for guest/applicant-facing pages: preview the document
 * inline, then print, download, optionally email it on, or close.
 */
export function DocumentPreviewDialog({ config, onClose }: Props) {
  const { t } = useTranslation();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const handlePrint = useCallback(() => {
    const frame = frameRef.current;
    try {
      if (frame?.contentWindow) {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        return;
      }
    } catch {
      /* cross-origin frame — fall through */
    }
    if (config) window.open(config.href, "_blank", "noopener,noreferrer");
  }, [config]);

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
    <Dialog open={config !== null} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl w-[95vw] h-[92vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-5 py-3 border-b shrink-0">
          <DialogTitle className="text-base truncate pr-8">
            {config?.title ?? t("doc_preview.title", "Document preview")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 bg-muted/40">
          {config && (
            <iframe
              ref={frameRef}
              src={config.href}
              title={config.title}
              className="w-full h-full border-0 bg-white"
            />
          )}
        </div>

        <div className="px-5 py-3 border-t flex flex-wrap items-center justify-end gap-2 shrink-0">
          {config && (
            <Button variant="ghost" size="sm" asChild>
              <a href={config.href} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-1.5" />
                {t("doc_preview.new_tab", "Open in new tab")}
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={!config}>
            <Printer className="w-4 h-4 mr-1.5" />
            {t("doc_preview.print", "Print")}
          </Button>
          {config && (
            <Button variant="outline" size="sm" asChild>
              <a href={config.href} download={config.filename} target="_blank" rel="noopener noreferrer">
                <Download className="w-4 h-4 mr-1.5" />
                {t("doc_preview.download", "Download")}
              </a>
            </Button>
          )}
          {config?.onEmail && (
            <Button variant="outline" size="sm" onClick={() => void handleEmail()} disabled={emailBusy}>
              {emailBusy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Mail className="w-4 h-4 mr-1.5" />}
              {config.emailLabel ?? t("doc_preview.email", "Send email")}
            </Button>
          )}
          <Button size="sm" onClick={onClose}>
            <X className="w-4 h-4 mr-1.5" />
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

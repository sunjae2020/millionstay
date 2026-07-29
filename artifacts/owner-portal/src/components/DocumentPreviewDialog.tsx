import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, X, ExternalLink } from "lucide-react";

export interface DocumentPreviewConfig {
  /** Dialog heading — usually the file name or document ref. */
  title: string;
  /** Filename used by the Download button. */
  filename: string;
  /** Already-signed, directly loadable document URL. */
  href: string;
}

interface Props {
  /** Non-null opens the dialog. */
  config: DocumentPreviewConfig | null;
  onClose: () => void;
}

/**
 * Shared read-only document viewer for the owner portal: preview inline, then
 * print, download or close. Owners never send documents, so there is no email
 * action here.
 */
export function DocumentPreviewDialog({ config, onClose }: Props) {
  const { t } = useTranslation();
  const frameRef = useRef<HTMLIFrameElement>(null);

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

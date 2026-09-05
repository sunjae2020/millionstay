import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, Mail, X, ExternalLink, Loader2, Check } from "lucide-react";
import { apiFetch } from "@/lib/api";

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
 * 오너 포털의 공용 문서 뷰어 — 미리보기 후 인쇄 · 다운로드 · **내 메일로 받기** · 닫기.
 *
 * 메일은 로그인한 오너 **본인의 등록 주소로만** 간다. 포털에서 임의 주소로 문서를
 * 보낼 수 있으면 그 자체가 유출 경로이기 때문이다. 서버(`/v1/partner/documents/
 * email-copy`)가 화면이 보낸 주소를 무시하고 토큰의 주소를 쓴다.
 */
export function DocumentPreviewDialog({ config, onClose }: Props) {
  const { t } = useTranslation();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleEmail = useCallback(async () => {
    if (!config) return;
    setEmailError(null);
    setEmailBusy(true);
    try {
      const blob = await (await fetch(config.href)).blob();
      const form = new FormData();
      form.append("file", new File([blob], config.filename, { type: blob.type || "application/pdf" }));
      form.append("filename", config.filename);
      form.append("doc_type_label", config.title);
      const res = await apiFetch("/v1/partner/documents/email-copy", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message ?? t("doc_preview.email_failed", "Could not send the email."));
      setEmailSent(true);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : t("doc_preview.email_failed", "Could not send the email."));
    } finally {
      setEmailBusy(false);
    }
  }, [config, t]);

  const close = useCallback(() => {
    setEmailSent(false);
    setEmailError(null);
    onClose();
  }, [onClose]);

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
    <Dialog open={config !== null} onOpenChange={(v) => { if (!v) close(); }}>
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

        {emailError && (
          <p className="px-5 pt-2 text-sm text-red-600 shrink-0">{emailError}</p>
        )}
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
          {config && (
            <Button variant="outline" size="sm" onClick={() => void handleEmail()} disabled={emailBusy || emailSent}>
              {emailBusy
                ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                : emailSent ? <Check className="w-4 h-4 mr-1.5" /> : <Mail className="w-4 h-4 mr-1.5" />}
              {emailSent ? t("doc_preview.email_sent", "Sent") : t("doc_preview.email_me", "Email me a copy")}
            </Button>
          )}
          <Button size="sm" onClick={close}>
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

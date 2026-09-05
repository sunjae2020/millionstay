import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, Mail, X, ExternalLink, Loader2, Check } from "lucide-react";
import { getApiBase } from "@/lib/api-base";

export interface DocumentPreviewConfig {
  /** Dialog heading — usually the document name. */
  title: string;
  /** Filename used by the Download button. */
  filename: string;
  /** Directly loadable document URL (token-gated public endpoint or signed URL). */
  href: string;
  /**
   * 이 문서가 딸린 링크 토큰. 주면 "내 메일로 받기" 버튼이 뜬다 — 받는 주소는
   * 서버가 링크 원장에서 고른다. 화면이 주소를 정하지 않는 이유는, 링크가 남의
   * 손에 들어갔을 때 임의 주소로 문서를 빼낼 수 있게 되기 때문이다.
   */
  token?: string | null;
  /** 자체 발송 흐름을 이미 가진 화면만. 없으면 위의 토큰 발송을 쓴다. */
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
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

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
    if (!config) return;
    setEmailError(null);
    setEmailBusy(true);
    try {
      if (config.onEmail) {
        await config.onEmail();
      } else if (config.token) {
        // 지금 보고 있는 문서를 그대로 첨부한다. 링크가 우리 API 를 가리키므로
        // 브라우저가 받을 수 있다 — 못 받으면 사유를 그대로 보여 준다.
        const blob = await (await fetch(config.href)).blob();
        const form = new FormData();
        form.append("file", new File([blob], config.filename, { type: blob.type || "application/pdf" }));
        form.append("filename", config.filename);
        form.append("doc_type_label", config.title);
        form.append("token", config.token);
        const res = await fetch(`${getApiBase()}/api/v1/public/documents/email-copy`, { method: "POST", body: form });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error?.message ?? t("doc_preview.email_failed", "Could not send the email."));
      }
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
          {(config?.onEmail || config?.token) && (
            <Button variant="outline" size="sm" onClick={() => void handleEmail()} disabled={emailBusy || emailSent}>
              {emailBusy
                ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                : emailSent ? <Check className="w-4 h-4 mr-1.5" /> : <Mail className="w-4 h-4 mr-1.5" />}
              {emailSent
                ? t("doc_preview.email_sent", "Sent")
                : config.emailLabel ?? t("doc_preview.email_me", "Email me a copy")}
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

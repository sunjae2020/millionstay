import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Eye, ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";

/**
 * How one list row maps onto a previewable document. Returned by the
 * `resolve` callback given to {@link useDocumentRowActions}; return `null`
 * for rows that have no document (e.g. a draft with nothing to render).
 */
export interface DocumentRowSpec {
  /** Document reference shown in the dialog heading (INV-0012, Q-0003 …). */
  ref: string;
  /** Already-translated document type label ("Invoice", "청구서" …). */
  typeLabel: string;
  /** Authenticated API path that renders the PDF. */
  pdfPath: string;
  /** POST endpoint that emails the document; omit/null hides the email button. */
  emailPath?: string | null;
  /** GET endpoint for the prefilled recipients. Derived from `emailPath` by default. */
  recipientsPath?: string;
  /** Record page opened by the second action button; omit to hide it. */
  detailUrl?: string | null;
  /** Download filename. Defaults to `<ref>.pdf`. */
  filename?: string;
}

/**
 * Shared "document row" actions for list pages — the same right-aligned
 * 미리보기 / 레코드 열기 pair the Documents hub uses, so every quote, invoice,
 * receipt and contract list opens its PDF in the shared preview modal instead
 * of downloading it.
 *
 * ```tsx
 * const { documentActionsColumn, documentPreview } = useDocumentRowActions<Invoice>((inv) => ({
 *   ref: inv.invoice_ref, typeLabel: t("nav.invoice"),
 *   pdfPath: `/api/v1/invoices/${inv.id}/pdf`,
 *   emailPath: `/api/v1/invoices/${inv.id}/email`,
 *   detailUrl: `/finance/invoices/${inv.id}`,
 * }));
 * // …columns: [...cols, documentActionsColumn] and render {documentPreview}
 * ```
 */
export function useDocumentRowActions<T>(resolve: (row: T) => DocumentRowSpec | null) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();
  const [busy, setBusy] = useState(false);

  // Keep the column identity stable even though call sites pass a fresh arrow.
  const resolveRef = useRef(resolve);
  resolveRef.current = resolve;

  const sendEmail = useCallback(
    async (spec: DocumentRowSpec, to: string[]) => {
      if (!spec.emailPath) return;
      setBusy(true);
      try {
        const res = await apiFetch(spec.emailPath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
        toast({
          title: t("document_hub.email_sent", "Email sent"),
          description: t("document_hub.email_sent_desc", "{{type}} emailed to {{recipient}}.", {
            type: spec.typeLabel,
            recipient: to.join(", "),
          }),
        });
      } catch (err) {
        // Rethrown so the recipient dialog stays open and shows the reason.
        toast({
          title: t("document_hub.email_failed", "Email failed"),
          description: err instanceof Error ? err.message : t("document_hub.error", "Error"),
          variant: "destructive",
        });
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [t, toast],
  );

  const handlePreview = useCallback(
    (spec: DocumentRowSpec) => {
      openPreview({
        title: `${spec.ref} · ${spec.typeLabel}`,
        filename: spec.filename ?? `${spec.ref}.pdf`,
        source: { kind: "api", path: spec.pdfPath },
        ...(spec.emailPath
          ? {
              email: {
                recipientsPath: spec.recipientsPath ?? spec.emailPath.replace(/\/email$/, "/email-recipients"),
                send: (to: string[]) => sendEmail(spec, to),
              },
            }
          : {}),
      });
    },
    [openPreview, sendEmail],
  );

  const documentActionsColumn: ColumnDef<T> = useMemo(
    () => ({
      key: ACTIONS_KEY,
      header: "",
      hideable: false,
      sortable: false,
      align: "right",
      defaultWidth: 100,
      cell: (row: T) => {
        const spec = resolveRef.current(row);
        if (!spec) return null;
        return (
          <div className="flex items-center gap-1 justify-end">
            <button
              type="button"
              className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-40"
              title={t("document_hub.preview", "Preview")}
              disabled={busy}
              onClick={() => handlePreview(spec)}
            >
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {spec.detailUrl && (
              <Link href={spec.detailUrl}>
                <button
                  type="button"
                  className="p-1.5 rounded hover:bg-muted transition-colors"
                  title={t("document_hub.open_record", "Open record")}
                >
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </Link>
            )}
          </div>
        );
      },
    }),
    [t, busy, handlePreview],
  );

  return {
    documentActionsColumn,
    /** Render once per page (outside the table). */
    documentPreview: <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />,
  };
}

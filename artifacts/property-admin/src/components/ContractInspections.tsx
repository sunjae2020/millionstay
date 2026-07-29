/**
 * 세대점검표 tab on the contract detail page.
 *
 * Every lease has exactly one checklist, so this is not a list — opening the tab
 * fetches (and on first open creates) the contract's single 점검표 and shows its
 * state: progress per phase, signatures, and the print/open actions. The
 * item-by-item filling happens on the mobile-friendly /inspections/:id page,
 * because it is done at the unit, on a phone.
 */
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, ExternalLink, FileText, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiJson } from "@/lib/apiFetch";
import { formatDate } from "@/lib/date";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";

interface InspectionItem {
  hidden: boolean;
  move_in_status: string | null;
  move_out_status: string | null;
}

interface Inspection {
  id: number;
  report_ref: string;
  title: string | null;
  title_display: string;
  status: string;
  created_at: string;
  items: InspectionItem[];
  signatures: Array<{ phase: string; role: string; signed_at: string }>;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  published: "bg-blue-100 text-blue-700",
  tenant_agreed: "bg-green-100 text-green-700",
  disputed: "bg-red-100 text-red-700",
  finalized: "bg-purple-100 text-purple-700",
};

export default function ContractInspections({ contractId }: { contractId: string | number }) {
  const { t, i18n } = useTranslation();
  const [, navigate] = useLocation();
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();

  const lang = i18n.language;
  const { data: report, isLoading, error } = useQuery({
    queryKey: ["contract-inspection", String(contractId), lang],
    // Get-or-create: the server hands back this lease's checklist, making one
    // the first time the tab is opened.
    queryFn: async () => (await apiJson<{ data: Inspection }>(`/api/v1/contracts/${contractId}/inspection?lang=${encodeURIComponent(lang)}`)).data,
  });

  // Both the blank form and the filled checklist open in the shared preview
  // (print / download / close). Checklists have no document-email endpoint —
  // the tenant gets a signing link instead, from the checklist page.
  function openPdf(path: string, filename: string, title: string) {
    openPreview({ title, filename, source: { kind: "api", path } });
  }

  const visible = (report?.items ?? []).filter((i) => !i.hidden);
  const progress = (phase: "move_in" | "move_out") => ({
    done: visible.filter((i) => (phase === "move_in" ? i.move_in_status : i.move_out_status)).length,
    total: visible.length,
    signed: (report?.signatures ?? []).some((s) => s.phase === phase && s.role === "tenant"),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div>
          <h4 className="font-medium text-sm">{t("inspection.tab_title")}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{t("inspection.tab_desc")}</p>
        </div>
        <Button
          size="sm" variant="outline"
          onClick={() => openPdf(`/api/v1/inspection-form/blank.pdf?lang=${encodeURIComponent(lang)}`, "unit-inspection-blank.pdf", t("inspection.blank_pdf"))}
        >
          <Printer className="w-3.5 h-3.5 mr-1" />{t("inspection.blank_pdf")}
        </Button>
      </div>

      {isLoading && (
        <div className="rounded-lg border bg-white py-12 text-center">
          <Loader2 className="w-5 h-5 animate-spin inline text-muted-foreground" />
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-lg border bg-white py-10 text-center text-sm text-muted-foreground">
          {t("inspection.load_failed")}
        </div>
      )}

      {report && (
        <div className="rounded-lg border bg-white p-4 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-medium flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-muted-foreground" />
                {report.title_display}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="font-mono">{report.report_ref}</span> · {formatDate(report.created_at)}
              </p>
            </div>
            <Badge className={`${STATUS_STYLES[report.status] ?? "bg-gray-100 text-gray-700"} hover:opacity-100`}>
              {t(`inspection.status_${report.status}`, report.status)}
            </Badge>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {(["move_in", "move_out"] as const).map((phase) => {
              const p = progress(phase);
              const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
              return (
                <div key={phase} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{t(`inspection.phase_${phase}`)}</span>
                    <span className="text-xs text-muted-foreground">{p.done}/{p.total}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {p.signed ? t("inspection.tenant_signed") : t("inspection.tenant_not_signed")}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => navigate(`/inspections/${report.id}`)}>
              <ExternalLink className="w-3.5 h-3.5 mr-1" />{t("inspection.open")}
            </Button>
            <Button
              size="sm" variant="outline"
              onClick={() => openPdf(`/api/v1/inspections/${report.id}/document.pdf?lang=${encodeURIComponent(lang)}`, `${report.report_ref}.pdf`, report.report_ref)}
            >
              <FileText className="w-3.5 h-3.5 mr-1" />{t("inspection.filled_pdf")}
            </Button>
          </div>
        </div>
      )}

      <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
    </div>
  );
}

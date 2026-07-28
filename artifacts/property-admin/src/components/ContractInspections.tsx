/**
 * 세대점검표 tab on the contract detail page.
 *
 * Management view only — create a checklist from a template, see each one's
 * progress and signature state, print the blank or the filled form. The actual
 * item-by-item filling happens on the mobile-friendly /inspections/:id page,
 * because it is done at the unit, on a phone.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, FileDown, Loader2, Plus, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch, apiJson } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/date";

interface InspectionRow {
  id: number;
  report_ref: string;
  title: string | null;
  status: string;
  template_key: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  published: "bg-blue-100 text-blue-700",
  tenant_agreed: "bg-green-100 text-green-700",
  disputed: "bg-red-100 text-red-700",
  finalized: "bg-purple-100 text-purple-700",
};

export default function ContractInspections({ contractId }: { contractId: string | number }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const queryKey = ["contract-inspections", String(contractId)];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => (await apiJson<{ data: InspectionRow[] }>(`/api/v1/contracts/${contractId}/inspections`)).data,
  });
  const rows = data ?? [];

  const create = useMutation({
    mutationFn: async () =>
      apiJson<{ data: { id: number } }>(`/api/v1/contracts/${contractId}/inspections`, { method: "POST", body: "{}" }),
    onSuccess: (res) => { void qc.invalidateQueries({ queryKey }); navigate(`/inspections/${res.data.id}`); },
    onError: (e: any) => toast({ title: t("inspection.create_failed"), description: e?.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => apiJson(`/api/v1/inspections/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  async function openPdf(path: string, filename: string) {
    setBusy(true);
    try {
      const res = await apiFetch(path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast({ title: t("inspection.pdf_failed"), description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div>
          <h4 className="font-medium text-sm">{t("inspection.tab_title")}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{t("inspection.tab_desc")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm" variant="outline" disabled={busy}
            onClick={() => openPdf("/api/v1/inspection-form/blank.pdf", "unit-inspection-blank.pdf")}
          >
            <Printer className="w-3.5 h-3.5 mr-1" />{t("inspection.blank_pdf")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => create.mutate()} disabled={create.isPending}>
            <Plus className="w-3.5 h-3.5 mr-1" />{t("inspection.new")}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {[t("inspection.col_ref"), t("common.name"), t("common.status"), t("common.created"), ""].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-10"><Loader2 className="w-4 h-4 animate-spin inline" /></td></tr>
            ) : !rows.length ? (
              <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">{t("inspection.none")}</td></tr>
            ) : rows.map((row) => (
              <tr key={row.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/inspections/${row.id}`)}>
                <td className="px-4 py-3 font-mono text-xs">{row.report_ref}</td>
                <td className="px-4 py-3 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-muted-foreground" />
                    {row.title || "—"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Badge className={`${STATUS_STYLES[row.status] ?? "bg-gray-100 text-gray-700"} hover:opacity-100`}>
                    {t(`inspection.status_${row.status}`, row.status)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(row.created_at)}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <Button
                      size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={busy}
                      onClick={() => openPdf(`/api/v1/inspections/${row.id}/document.pdf`, `${row.report_ref}.pdf`)}
                    >
                      <FileDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                      onClick={() => remove.mutate(row.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

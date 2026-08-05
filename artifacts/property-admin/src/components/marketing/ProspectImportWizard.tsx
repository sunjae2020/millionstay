import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  previewImport,
  commitImport,
  type ConsentBasis,
  type ImportPreview,
  type ImportPreviewRow,
} from "@/lib/marketing/api";

const PROSPECT_FIELDS = [
  "company_name", "email", "contact_name", "contact_title",
  "phone", "website", "segment", "country", "city", "notes",
] as const;

const VERDICT_STYLES: Record<ImportPreviewRow["verdict"], string> = {
  new: "text-green-700",
  duplicate: "text-amber-700",
  existing_account: "text-orange-700",
  suppressed: "text-red-700",
  error: "text-red-600",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

/**
 * Upload → column mapping → preview → commit.
 *
 * The preview step is not optional: an import that silently drops or duplicates
 * rows is discovered weeks later, in a campaign that went to the wrong people.
 * Every row is classified and the totals shown before anything is written.
 */
export function ProspectImportWizard({ open, onOpenChange, onImported }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const [segment, setSegment] = useState("");
  const [source, setSource] = useState("csv_import");
  const [sourceDetail, setSourceDetail] = useState("");
  const [consentBasis, setConsentBasis] = useState<ConsentBasis>("none");
  const [consentEvidence, setConsentEvidence] = useState("");
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "merge">("skip");

  function reset() {
    setFile(null);
    setPreview(null);
    setMapping({});
    setConsentBasis("none");
    setConsentEvidence("");
  }

  async function runPreview(nextFile: File, nextMapping?: Record<string, string>) {
    setBusy(true);
    try {
      const result = await previewImport(nextFile, nextMapping);
      setPreview(result);
      setMapping(result.mapping);
    } catch (err) {
      toast({
        title: t("marketing.import_preview_failed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    await runPreview(picked);
  }

  function changeMapping(header: string, field: string) {
    const next = { ...mapping, [header]: field === "__none" ? "" : field };
    setMapping(next);
    if (file) void runPreview(file, next);
  }

  const evidenceRequired = consentBasis !== "none" && consentEvidence.trim() === "";
  const importable = preview ? preview.total - (preview.counts.error ?? 0) : 0;

  async function handleCommit() {
    if (!file || !preview) return;
    setBusy(true);
    try {
      const result = await commitImport(file, {
        mapping,
        segment: segment || undefined,
        source,
        source_detail: sourceDetail || undefined,
        consent_basis: consentBasis,
        consent_evidence: consentEvidence,
        duplicate_strategy: duplicateStrategy,
      });
      toast({
        title: t("marketing.import_done"),
        description: t("marketing.import_summary", {
          inserted: result.inserted,
          merged: result.merged,
          skipped: result.skipped,
          errors: result.errors,
        }),
      });
      reset();
      onImported();
    } catch (err) {
      toast({
        title: t("marketing.import_failed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("marketing.import_prospects")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* 1. File */}
          <div className="space-y-2">
            <Label>{t("marketing.csv_file")}</Label>
            <div className="flex items-center gap-3">
              <Input type="file" accept=".csv,text/csv" onChange={handleFile} />
              {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <p className="text-xs text-muted-foreground">{t("marketing.csv_required_columns")}</p>
          </div>

          {/* 2. Column mapping */}
          {preview && preview.headers.length > 0 && (
            <div className="space-y-2">
              <Label>{t("marketing.column_mapping")}</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {preview.headers.map((header) => (
                  <div key={header} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground truncate w-24" title={header}>
                      {header}
                    </span>
                    <Select value={mapping[header] || "__none"} onValueChange={(v) => changeMapping(header, v)}>
                      <SelectTrigger className="h-8 flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">{t("marketing.field_ignore")}</SelectItem>
                        {PROSPECT_FIELDS.map((f) => (
                          <SelectItem key={f} value={f}>
                            {t(`marketing.field_${f}`, { defaultValue: f })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Preview */}
          {preview && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-3 text-sm">
                <Badge label={t("marketing.verdict_new")} value={preview.counts.new ?? 0} tone="green" />
                <Badge label={t("marketing.verdict_duplicate")} value={preview.counts.duplicate ?? 0} tone="amber" />
                <Badge label={t("marketing.verdict_existing_account")} value={preview.counts.existing_account ?? 0} tone="orange" />
                <Badge label={t("marketing.verdict_suppressed")} value={preview.counts.suppressed ?? 0} tone="red" />
                <Badge label={t("marketing.verdict_error")} value={preview.counts.error ?? 0} tone="red" />
                <span className="text-muted-foreground">{t("marketing.total_rows", { count: preview.total })}</span>
              </div>

              {(preview.counts.existing_account ?? 0) > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{t("marketing.existing_account_warning")}</span>
                </div>
              )}

              <div className="max-h-64 overflow-y-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 w-12">#</th>
                      <th className="text-left p-2">{t("marketing.company_name")}</th>
                      <th className="text-left p-2">{t("common.email")}</th>
                      <th className="text-left p-2">{t("marketing.verdict")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.row_no} className="border-t">
                        <td className="p-2 text-muted-foreground">{row.row_no}</td>
                        <td className="p-2">{row.company_name || "—"}</td>
                        <td className="p-2">{row.email || "—"}</td>
                        <td className={`p-2 ${VERDICT_STYLES[row.verdict]}`}>
                          {t(`marketing.verdict_${row.verdict}`)}
                          {row.message ? <span className="text-xs text-muted-foreground ml-1">({row.message})</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. Import settings */}
          {preview && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("marketing.segment")}</Label>
                <Select value={segment || "__none"} onValueChange={(v) => setSegment(v === "__none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("marketing.segment")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">{t("common.none")}</SelectItem>
                    {["owner", "agency", "corporate", "education", "service"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`marketing.segment_${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("marketing.duplicate_strategy")}</Label>
                <Select value={duplicateStrategy} onValueChange={(v) => setDuplicateStrategy(v as "skip" | "merge")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">{t("marketing.duplicate_skip")}</SelectItem>
                    <SelectItem value="merge">{t("marketing.duplicate_merge")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("marketing.source_detail")}</Label>
                <Input
                  value={sourceDetail}
                  onChange={(e) => setSourceDetail(e.target.value)}
                  placeholder={t("marketing.source_detail_ph")}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("marketing.consent_basis")}</Label>
                <Select value={consentBasis} onValueChange={(v) => setConsentBasis(v as ConsentBasis)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("marketing.consent_none")}</SelectItem>
                    <SelectItem value="inferred_b2b">{t("marketing.consent_inferred_b2b")}</SelectItem>
                    <SelectItem value="existing">{t("marketing.consent_existing")}</SelectItem>
                    <SelectItem value="express">{t("marketing.consent_express")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>
                  {t("marketing.consent_evidence")}
                  {consentBasis !== "none" && <span className="text-red-500 ml-1">*</span>}
                </Label>
                <Input
                  value={consentEvidence}
                  onChange={(e) => setConsentEvidence(e.target.value)}
                  placeholder={t("marketing.consent_evidence_ph")}
                />
                <p className="text-xs text-muted-foreground">{t("marketing.consent_evidence_help")}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleCommit} disabled={!preview || busy || importable === 0 || evidenceRequired}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileUp className="h-4 w-4 mr-2" />}
            {t("marketing.import_n_rows", { count: importable })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Badge({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "orange" | "red" }) {
  const tones = {
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    red: "bg-red-50 text-red-700 border-red-200",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${tones[tone]}`}>
      {value > 0 && tone === "green" ? <CheckCircle2 className="h-3 w-3" /> : null}
      {label}: {value}
    </span>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, FileText, Loader2, RefreshCw, Trash2, Upload, Wand2 } from "lucide-react";
import { apiFetch, apiJson } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/date";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";

/**
 * Bulk document intake — 서류 일괄 업로드 & 검토.
 *
 * Drop a folder of existing paperwork here; the server parks every file, reads
 * it, and proposes the record it belongs to. This screen is the review step:
 * nothing is filed against a contract or a person until someone confirms it on
 * this page.
 *
 * The left column is the queue, the right is the document itself next to what
 * the classifier read. That pairing is the whole point — a reviewer has to be
 * able to check the proposal against the page without downloading anything.
 */

interface MatchCandidate {
  entity_type: "contract" | "contact";
  entity_id: number;
  label: string;
  score: number;
  reason: string;
}

interface IntakeItem {
  id: string;
  document_id: string;
  batch_id: string;
  file_name: string;
  status: string;
  scan_source: string | null;
  scan_error: string | null;
  detected_doc_type: string | null;
  extracted: Record<string, unknown> | null;
  confidence: number | null;
  suggested_entity_type: string | null;
  suggested_entity_id: number | null;
  match_score: number | null;
  match_reason: string | null;
  candidates: MatchCandidate[];
  filed_entity_type: string | null;
  filed_entity_id: number | null;
  filed_doc_type: string | null;
  created_at: string | null;
  mime_type: string | null;
  file_size: number | null;
  file_url: string;
}

interface LookupOption {
  id: number;
  display: string;
}

/** Same keys the server accepts — each one sets the file's retention period. */
const DOC_TYPES = [
  "contract",
  "tax_invoice",
  "receipt",
  "property_document",
  "id_document",
  "visa_document",
  "brokerage_disclosure",
  "lease_report",
  "property_register",
  "building_ledger",
  "settlement_statement",
  "move_in_out_report",
  "repair_record",
  "bank_account_copy",
  "other",
] as const;

/** Identity documents may only be filed against a person. */
const PERSON_ONLY = new Set<string>(["id_document", "visa_document"]);

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  scanned: "bg-green-100 text-green-700",
  review: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-600",
  filed: "bg-blue-100 text-blue-700",
  discarded: "bg-gray-100 text-gray-400",
};

/** Fields worth showing, in the order a reviewer reads them off the page. */
const FIELD_ORDER = [
  "party_name",
  "counterparty_name",
  "unit_label",
  "building_name",
  "address",
  "start_date",
  "end_date",
  "document_date",
  "deposit_amount",
  "monthly_rent",
  "reference",
  "notes",
] as const;

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentIntake() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();

  const fileRef = useRef<HTMLInputElement>(null);
  const [statusFilter, setStatusFilter] = useState("review");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Reviewer overrides for the selected item, seeded from the suggestion.
  const [entityType, setEntityType] = useState<"contract" | "contact">("contract");
  const [entityId, setEntityId] = useState<number | null>(null);
  const [docType, setDocType] = useState<string>("other");
  const [search, setSearch] = useState("");

  const { data: items, isLoading } = useQuery<IntakeItem[]>({
    queryKey: ["document-intake", statusFilter],
    queryFn: () => apiJson<IntakeItem[]>(`/api/v1/document-intake?status=${statusFilter}`),
    // Scanning runs in the background after upload, so the queue has to catch up
    // on its own — a reviewer should not have to reload to see a file finish.
    refetchInterval: (query) =>
      (query.state.data ?? []).some((i) => i.status === "pending") ? 4000 : false,
  });

  const { data: summary } = useQuery<{ counts: Record<string, number>; total: number }>({
    queryKey: ["document-intake-summary"],
    queryFn: () => apiJson("/api/v1/document-intake/summary"),
    refetchInterval: 10000,
  });

  const selected = useMemo(
    () => items?.find((i) => i.id === selectedId) ?? null,
    [items, selectedId],
  );

  // Seed the filing form from whatever the classifier proposed, each time a
  // different item is opened.
  useEffect(() => {
    if (!selected) return;
    const suggestedType =
      selected.suggested_entity_type === "contact" ? "contact"
      : selected.suggested_entity_type === "contract" ? "contract"
      : PERSON_ONLY.has(selected.detected_doc_type ?? "") ? "contact" : "contract";
    setEntityType(suggestedType);
    setEntityId(selected.suggested_entity_id ?? null);
    setDocType(selected.detected_doc_type ?? "other");
    setSearch("");
  }, [selected?.id]);

  // Manual record picker, used when the proposal is wrong or missing.
  const { data: lookup } = useQuery<LookupOption[]>({
    queryKey: ["intake-lookup", entityType, search],
    queryFn: () =>
      apiJson<LookupOption[]>(
        `/api/v1/lookup/${entityType === "contact" ? "contacts" : "contracts"}?q=${encodeURIComponent(search)}`,
      ),
    enabled: Boolean(selected),
  });

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["document-intake"] });
    void qc.invalidateQueries({ queryKey: ["document-intake-summary"] });
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      for (const f of Array.from(files)) form.append("files", f);
      const res = await apiFetch("/api/v1/document-intake", { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Upload failed");
      const body = (await res.json()) as { uploaded: number; scanning: number; failed: Array<{ file_name: string }> };
      toast({
        title: t("intake.uploaded", "Uploaded"),
        description: t(
          "intake.uploadedDesc",
          "{{uploaded}} file(s) stored, {{scanning}} being read. {{failed}} failed.",
          { uploaded: body.uploaded, scanning: body.scanning, failed: body.failed.length },
        ),
      });
      setStatusFilter("_all");
      invalidate();
    } catch (err) {
      toast({
        title: t("intake.uploadFailed", "Upload failed"),
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleConfirm() {
    if (!selected || !entityId) return;
    setBusy(selected.id);
    try {
      const res = await apiFetch(`/api/v1/document-intake/${selected.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId, doc_type: docType }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Filing failed");
      toast({ title: t("intake.filed", "Filed"), description: selected.file_name });
      setSelectedId(null);
      invalidate();
    } catch (err) {
      toast({ title: t("intake.fileFailed", "Could not file"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function handleRescan(item: IntakeItem) {
    setBusy(item.id);
    try {
      const res = await apiFetch(`/api/v1/document-intake/${item.id}/rescan`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Re-scan failed");
      invalidate();
    } catch (err) {
      toast({ title: t("intake.rescanFailed", "Re-scan failed"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function handleDiscard(item: IntakeItem) {
    if (!window.confirm(t("intake.confirmDiscard", "Discard {{name}}? The file will be deleted.", { name: item.file_name }))) return;
    setBusy(item.id);
    try {
      const res = await apiFetch(`/api/v1/document-intake/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Discard failed");
      if (selectedId === item.id) setSelectedId(null);
      invalidate();
    } catch (err) {
      toast({ title: t("intake.discardFailed", "Could not discard"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  /** File every confidently-matched item in the batch the selection belongs to. */
  async function handleConfirmBatch(batchId: string) {
    setBusy(batchId);
    try {
      const res = await apiFetch("/api/v1/document-intake/confirm-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: batchId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Batch filing failed");
      const body = (await res.json()) as { filed: number; skipped: unknown[] };
      toast({
        title: t("intake.batchFiled", "Batch filed"),
        description: t("intake.batchFiledDesc", "{{filed}} filed, {{skipped}} left for review.", {
          filed: body.filed,
          skipped: body.skipped.length,
        }),
      });
      invalidate();
    } catch (err) {
      toast({ title: t("intake.fileFailed", "Could not file"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  const personMismatch = PERSON_ONLY.has(docType) && entityType !== "contact";
  const confidentBatch = items?.find((i) => i.status === "scanned")?.batch_id ?? null;

  return (
    <Layout>
      <PageHeader
        title={t("intake.title", "Bulk document intake")}
        subtitle={t(
          "intake.subtitle",
          "Upload existing paperwork in bulk. Each file is read, matched to a record, and filed only after you confirm it.",
        )}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => void handleUpload(e.target.files)}
        />
        <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {t("intake.upload", "Upload files")}
        </Button>

        {confidentBatch && (
          <Button
            variant="outline"
            disabled={busy === confidentBatch}
            onClick={() => void handleConfirmBatch(confidentBatch)}
          >
            <Wand2 className="mr-2 h-4 w-4" />
            {t("intake.fileConfident", "File all confident matches")}
          </Button>
        )}

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t("intake.status.all", "All")}</SelectItem>
            <SelectItem value="review">{t("intake.status.review", "Needs review")}</SelectItem>
            <SelectItem value="scanned">{t("intake.status.scanned", "Ready to file")}</SelectItem>
            <SelectItem value="pending">{t("intake.status.pending", "Reading")}</SelectItem>
            <SelectItem value="failed">{t("intake.status.failed", "Read failed")}</SelectItem>
            <SelectItem value="filed">{t("intake.status.filed", "Filed")}</SelectItem>
          </SelectContent>
        </Select>

        {summary && (
          <span className="text-sm text-muted-foreground">
            {t("intake.summary", "{{review}} awaiting review · {{ready}} ready · {{filed}} filed", {
              review: summary.counts["review"] ?? 0,
              ready: summary.counts["scanned"] ?? 0,
              filed: summary.counts["filed"] ?? 0,
            })}
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* ── Queue ───────────────────────────────────────────────────── */}
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-2 text-sm font-medium">
            {t("intake.queue", "Queue")}
          </div>
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">{t("common.loading", "Loading…")}</div>
          ) : !items?.length ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {t("intake.empty", "Nothing here. Upload a folder of documents to start.")}
            </div>
          ) : (
            <ul className="max-h-[70vh] divide-y overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 ${
                      selectedId === item.id ? "bg-muted" : ""
                    }`}
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.file_name}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge className={STATUS_STYLES[item.status] ?? ""} variant="secondary">
                          {t(`intake.status.${item.status}`, item.status)}
                        </Badge>
                        {item.detected_doc_type && (
                          <span className="text-xs text-muted-foreground">
                            {t(`doc_type.${item.detected_doc_type}`, item.detected_doc_type)}
                          </span>
                        )}
                        {item.match_score != null && (
                          <span className="text-xs text-muted-foreground">
                            {Math.round(item.match_score * 100)}%
                          </span>
                        )}
                      </span>
                      {item.match_reason && (
                        <span className="mt-1 block truncate text-xs text-muted-foreground">{item.match_reason}</span>
                      )}
                      {item.scan_error && (
                        <span className="mt-1 block truncate text-xs text-red-600">{item.scan_error}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Review pane ─────────────────────────────────────────────── */}
        <div className="rounded-lg border bg-card p-4">
          {!selected ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {t("intake.selectPrompt", "Pick a document from the queue to review it.")}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-medium">{selected.file_name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(selected.file_size)} · {formatDate(selected.created_at)}
                    {selected.scan_source && ` · ${t(`intake.source.${selected.scan_source}`, selected.scan_source)}`}
                    {selected.confidence != null && ` · ${Math.round(selected.confidence * 100)}%`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      openPreview({
                        title: selected.file_name,
                        filename: selected.file_name,
                        source: { kind: "api", path: selected.file_url },
                      })
                    }
                  >
                    <Eye className="mr-1 h-4 w-4" /> {t("common.preview", "Preview")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy === selected.id || selected.status === "filed"}
                    onClick={() => void handleRescan(selected)}
                  >
                    <RefreshCw className="mr-1 h-4 w-4" /> {t("intake.rescan", "Re-read")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600"
                    disabled={busy === selected.id || selected.status === "filed"}
                    onClick={() => void handleDiscard(selected)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* What the classifier read off the page. */}
              {selected.extracted && Object.keys(selected.extracted).length > 0 && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded border bg-muted/30 p-3 text-sm">
                  {FIELD_ORDER.filter((k) => selected.extracted?.[k]).map((k) => (
                    <div key={k} className="contents">
                      <dt className="text-muted-foreground">{t(`intake.field.${k}`, k)}</dt>
                      <dd className="truncate">{String(selected.extracted?.[k])}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {selected.status === "filed" ? (
                <p className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  {t("intake.alreadyFiled", "Filed against {{type}} #{{id}} as {{docType}}.", {
                    type: selected.filed_entity_type,
                    id: selected.filed_entity_id,
                    docType: selected.filed_doc_type,
                  })}
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Runner-up matches: one click instead of a search. */}
                  {selected.candidates.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        {t("intake.candidates", "Suggested records")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selected.candidates.map((c) => (
                          <button
                            key={`${c.entity_type}-${c.entity_id}`}
                            type="button"
                            onClick={() => {
                              setEntityType(c.entity_type);
                              setEntityId(c.entity_id);
                            }}
                            className={`rounded border px-2 py-1 text-xs hover:bg-muted ${
                              entityType === c.entity_type && entityId === c.entity_id
                                ? "border-primary bg-primary/10"
                                : ""
                            }`}
                            title={c.reason}
                          >
                            {c.label} · {Math.round(c.score * 100)}%
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="text-muted-foreground">{t("intake.docTypeLabel", "Document type")}</span>
                      <Select value={docType} onValueChange={setDocType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DOC_TYPES.map((d) => (
                            <SelectItem key={d} value={d}>{t(`doc_type.${d}`, d)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>

                    <label className="space-y-1 text-sm">
                      <span className="text-muted-foreground">{t("intake.entityTypeLabel", "File against")}</span>
                      <Select
                        value={entityType}
                        onValueChange={(v) => { setEntityType(v as "contract" | "contact"); setEntityId(null); }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contract">{t("intake.entity.contract", "Contract")}</SelectItem>
                          <SelectItem value="contact">{t("intake.entity.contact", "Person")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                  </div>

                  <div className="space-y-1">
                    <Input
                      placeholder={t("intake.searchRecord", "Search for a record…")}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <div className="max-h-40 overflow-y-auto rounded border">
                      {(lookup ?? []).map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => setEntityId(o.id)}
                          className={`block w-full truncate px-2 py-1.5 text-left text-xs hover:bg-muted ${
                            entityId === o.id ? "bg-primary/10" : ""
                          }`}
                        >
                          {o.display}
                        </button>
                      ))}
                      {!lookup?.length && (
                        <p className="px-2 py-2 text-xs text-muted-foreground">
                          {t("intake.noRecords", "No matching records.")}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Mirrors the server rule rather than trusting the reviewer to know it. */}
                  {personMismatch && (
                    <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                      {t(
                        "intake.personOnly",
                        "Identity and visa documents are destroyed after 30 days, so they must be filed against the person they identify — not a contract.",
                      )}
                    </p>
                  )}

                  <Button
                    className="w-full"
                    disabled={!entityId || personMismatch || busy === selected.id}
                    onClick={() => void handleConfirm()}
                  >
                    {busy === selected.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("intake.confirm", "File this document")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
    </Layout>
  );
}

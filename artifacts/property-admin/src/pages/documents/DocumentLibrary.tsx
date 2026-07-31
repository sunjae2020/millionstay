import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, ExternalLink, FileText, Pencil, Search, X } from "lucide-react";
import { apiFetch, apiJson } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/date";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";

/**
 * Document library — 문서 색인.
 *
 * Documents are uploaded against the record they belong to, which answers
 * "what is filed on this contract?" but not "where is the 2023 lease for unit
 * 1503?". This is that second view: every filed document across every record,
 * narrowed by year, by type and by keyword.
 *
 * The facet counts come from the server and describe everything the *other*
 * filters allow, so picking 2023 does not collapse the year list to just 2023.
 */

interface LibraryDocument {
  id: string;
  entity_type: string;
  entity_id: number;
  doc_type: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  version: number | null;
  doc_ref: string | null;
  title: string | null;
  doc_date: string | null;
  doc_year: number | null;
  tags: string[];
  created_at: string | null;
  file_url: string;
  entity_label: string | null;
  detail_url: string | null;
  /** The unit this document ultimately belongs to — via its contract, usually. */
  space_id: number | null;
  space_name: string | null;
}

interface Facet<T> {
  value: T;
  count: number;
}

interface LibraryResponse {
  documents: LibraryDocument[];
  facets: {
    years: Array<Facet<number | null>>;
    doc_types: Array<Facet<string>>;
    entity_types: Array<Facet<string>>;
    /** Units carry a label because there are hundreds of them, and they need a picker. */
    units: Array<{ value: number; label: string; count: number }>;
  };
  /** True when the result set hit the server's cap — narrow the filters. */
  truncated: boolean;
}

/**
 * Types a person may re-file a document as. `signed_contract` is deliberately
 * absent: it is set by the contract execution flow, marks the file as evidence,
 * and the API refuses it here — offering it would be a button that always fails.
 */
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

/** Sentinel used by both the UI and the API for "no year recorded". */
const NO_YEAR = "_none";



function formatSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentLibrary() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();

  /**
   * Label for a document type, from the one namespace both document screens
   * read. The per-record panel dropped its own `entity_docs.type_*` keys when
   * it stopped asking users for a type; keeping a second copy here would let
   * the same type read differently on two screens.
   */
  const typeLabel = (value: string) => t(`doc_type.${value}`, value);

  /** One description of where a document is filed, used by the row and the preview. */
  const locationLabel = (doc: { entity_type: string; entity_id: number; entity_label: string | null }) => {
    const kind = t(`library.entity.${doc.entity_type}`, doc.entity_type);
    return doc.entity_label ? `${kind} · ${doc.entity_label}` : `${kind} #${doc.entity_id}`;
  };

  const [search, setSearch] = useState("");
  // Committed separately from the input so every keystroke is not a request.
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<string>("_all");
  const [docType, setDocType] = useState<string>("_all");
  const [entityType, setEntityType] = useState<string>("_all");
  // Units are a dropdown, not chips: Metheim alone has 269 of them.
  const [unit, setUnit] = useState<string>("_all");

  const [editing, setEditing] = useState<LibraryDocument | null>(null);
  const [editYear, setEditYear] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editType, setEditType] = useState("other");
  const [saving, setSaving] = useState(false);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (query.trim()) p.set("q", query.trim());
    if (year !== "_all") p.set("year", year);
    if (docType !== "_all") p.set("doc_type", docType);
    if (entityType !== "_all") p.set("entity_type", entityType);
    if (unit !== "_all") p.set("space_id", unit);
    return p.toString();
  }, [query, year, docType, entityType, unit]);

  const { data, isLoading } = useQuery<LibraryResponse>({
    queryKey: ["document-library", params],
    queryFn: () => apiJson<LibraryResponse>(`/api/v1/documents/library?${params}`),
  });

  function openEditor(doc: LibraryDocument) {
    setEditing(doc);
    setEditYear(doc.doc_year != null ? String(doc.doc_year) : "");
    setEditTitle(doc.title ?? "");
    setEditTags(doc.tags.join(", "));
    setEditType(doc.doc_type);
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/v1/documents/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          // Empty means "unknown" — the server stores null and the document
          // shows up under the no-year facet rather than a guessed year.
          doc_year: editYear.trim() === "" ? null : Number(editYear),
          tags: editTags,
          doc_type: editType,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Save failed");
      toast({ title: t("library.saved", "Saved") });
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["document-library"] });
      void qc.invalidateQueries({ queryKey: ["entity-documents"] });
    } catch (err) {
      toast({ title: t("library.saveFailed", "Could not save"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const activeFilters = [year !== "_all", docType !== "_all", entityType !== "_all", unit !== "_all", Boolean(query)]
    .filter(Boolean).length;

  function clearFilters() {
    setYear("_all");
    setDocType("_all");
    setEntityType("_all");
    setUnit("_all");
    setSearch("");
    setQuery("");
  }

  /** A facet chip row — same shape for years, types and records. */
  function Chips<T extends string | number | null>({
    items, selected, onSelect, label,
  }: {
    items: Array<Facet<T>>;
    selected: string;
    onSelect: (v: string) => void;
    label: (v: T) => string;
  }) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onSelect("_all")}
          className={`rounded-full border px-2.5 py-1 text-xs ${selected === "_all" ? "border-primary bg-primary/10" : "hover:bg-muted"}`}
        >
          {t("library.all", "All")}
        </button>
        {items.map((f) => {
          const key = f.value == null ? NO_YEAR : String(f.value);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={`rounded-full border px-2.5 py-1 text-xs ${selected === key ? "border-primary bg-primary/10" : "hover:bg-muted"}`}
            >
              {label(f.value)} <span className="text-muted-foreground">{f.count}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <Layout>
      <PageHeader
        title={t("library.title", "Document index")}
        subtitle={t("library.subtitle", "Every filed document across all records — browse by year, type and keyword.")}
      />

      <div className="mb-4 space-y-3 rounded-lg border bg-card p-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => { e.preventDefault(); setQuery(search); }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("library.searchPlaceholder", "Search file name, title or keyword…")}
            />
          </div>
          <Button type="submit" variant="outline">{t("library.search", "Search")}</Button>
          {activeFilters > 0 && (
            <Button type="button" variant="ghost" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" />{t("library.clear", "Clear")}
            </Button>
          )}
        </form>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t("library.byYear", "Year")}</p>
          <Chips
            items={data?.facets.years ?? []}
            selected={year}
            onSelect={setYear}
            label={(v) => (v == null ? t("library.noYear", "No year") : String(v))}
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t("library.byType", "Document type")}</p>
          <Chips
            items={data?.facets.doc_types ?? []}
            selected={docType}
            onSelect={setDocType}
            label={(v) => typeLabel(String(v))}
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t("library.byUnit", "Unit")}</p>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="h-9 w-full max-w-xs rounded-md border bg-background px-2 text-sm"
          >
            <option value="_all">{t("library.allUnits", "All units")}</option>
            {(data?.facets.units ?? []).map((u) => (
              <option key={u.value} value={String(u.value)}>{u.label} ({u.count})</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t("library.byRecord", "Filed against")}</p>
          <Chips
            items={data?.facets.entity_types ?? []}
            selected={entityType}
            onSelect={setEntityType}
            label={(v) => t(`library.entity.${v}`, String(v))}
          />
        </div>
      </div>

      {data?.truncated && (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          {t("library.truncated", "Showing the first 500 matches — narrow the filters to see the rest.")}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              {["col_doc", "col_type", "col_year", "col_unit", "col_tags", "col_record", "col_size", "col_uploaded"].map((k) => (
                <th key={k} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t(`library.${k}`, k)}
                </th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">{t("common.loading", "Loading…")}</td></tr>
            ) : !data?.documents.length ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">{t("library.empty", "No documents match these filters.")}</td></tr>
            ) : (
              data.documents.map((d) => (
                <tr key={d.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{d.title || d.file_name}</span>
                    </span>
                    {d.title && <span className="block truncate text-xs text-muted-foreground">{d.file_name}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {typeLabel(d.doc_type)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{d.doc_year ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {d.space_name ? (
                      <button
                        type="button"
                        onClick={() => setUnit(String(d.space_id))}
                        className="hover:underline"
                      >
                        {d.space_name}
                      </button>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {d.tags.length ? (
                      <span className="flex flex-wrap gap-1">
                        {d.tags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            // Clicking a keyword searches it — the fastest way
                            // to get from one document to its siblings.
                            onClick={() => { setSearch(tag); setQuery(tag); }}
                            className="rounded bg-muted px-1.5 py-0.5 text-[11px] hover:bg-muted-foreground/20"
                          >
                            {tag}
                          </button>
                        ))}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {d.detail_url ? (
                      <Link href={d.detail_url} className="inline-flex items-center gap-1 text-primary hover:underline">
                        {locationLabel(d)}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      `${d.entity_type} #${d.entity_id}`
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatSize(d.file_size)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(d.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openPreview({
                        title: d.title || d.file_name,
                        filename: d.file_name,
                        source: { kind: "api", path: d.file_url },
                        location: { label: locationLabel(d), href: d.detail_url ?? undefined },
                      })}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Eye className="h-3.5 w-3.5" /> {t("common.preview", "Preview")}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditor(d)}
                      className="ml-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Pencil className="h-3.5 w-3.5" /> {t("library.edit", "Edit index")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Index editor. Only the index is editable — not the bytes, and not the
          record the document is filed against. */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md rounded-lg border bg-card p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 font-medium">{t("library.editTitle", "Edit filing index")}</h3>
            <p className="mb-3 truncate text-xs text-muted-foreground">{editing.file_name}</p>

            <div className="space-y-3">
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">{t("library.fieldTitle", "Title")}</span>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder={editing.file_name} />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">{t("library.fieldYear", "Year")}</span>
                  <Input type="number" value={editYear} onChange={(e) => setEditYear(e.target.value)} placeholder={t("library.noYear", "No year")} />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">{t("library.fieldType", "Type")}</span>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  >
                    {DOC_TYPES.map((dt) => (
                      <option key={dt} value={dt}>{typeLabel(dt)}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">{t("library.fieldTags", "Keywords (comma separated)")}</span>
                <Input value={editTags} onChange={(e) => setEditTags(e.target.value)} />
              </label>

              {/* Changing the type moves the destruction date, so say so. */}
              {editType !== editing.doc_type && (
                <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  {t("library.typeChangesRetention", "Changing the document type also changes how long it is kept before destruction.")}
                </p>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>{t("common.cancel", "Cancel")}</Button>
              <Button disabled={saving} onClick={() => void saveEdit()}>{t("common.save", "Save")}</Button>
            </div>
          </div>
        </div>
      )}

      <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
    </Layout>
  );
}

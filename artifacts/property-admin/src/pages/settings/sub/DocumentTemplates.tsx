import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import { SearchBox } from "@/components/list-filters";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Mail, FileCheck, FileType, Eye, Globe, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";

const API = "/api/v1/document-templates";

interface TemplateRow {
  id: number;
  kind: string;
  key: string;
  name: string;
  description?: string | null;
  category?: string | null;
  status: string;
  version: number;
  locales: string[];
  updated_at: string;
}

type Kind = "email" | "contract" | "pdf";

const KINDS = [
  { key: "email", icon: Mail },
  { key: "contract", icon: FileCheck },
  { key: "pdf", icon: FileType },
] as const;

/**
 * 수신자 그룹 (docs/EMAIL_TEMPLATE_SPEC.md §2). category 는 "누가 받는가" 를 담고,
 * 업무 도메인은 key 의 `<domain>.` 접두사가 담는다 — 두 축으로 탐색된다.
 * 라벨은 i18n `documentTemplate.cat_<slug>`.
 */
const CATEGORIES = ["common", "customer", "owner", "partner", "host", "staff", "marketing"] as const;
type Category = (typeof CATEGORIES)[number];

/** key 의 `<domain>.<event>` 중 도메인 부분. 점이 없는 레거시 키는 null. */
function keyDomain(key: string): string | null {
  const i = key.indexOf(".");
  return i > 0 ? key.slice(0, i) : null;
}

function statusBadge(s: string): string {
  if (s === "published") return "bg-green-100 text-green-700 border-green-200";
  if (s === "draft") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}

/** Modal to create a new template of the given kind, then jump to its editor. */
function CreateDialog({ kind, open, onOpenChange }: { kind: Kind; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");

  const reset = () => { setName(""); setKey(""); setDescription(""); };

  const create = useMutation({
    mutationFn: async (): Promise<TemplateRow> => {
      const res = await apiFetch(API, {
        method: "POST",
        body: JSON.stringify({ kind, key: key.trim(), name: name.trim(), description: description.trim() || null }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Failed to create template");
      return (await res.json()).data;
    },
    onSuccess: (row) => {
      toast({ title: t("documentTemplate.toast_created") });
      qc.invalidateQueries({ queryKey: ["document-templates"] });
      onOpenChange(false);
      reset();
      navigate(`/settings/document-templates/${row.id}`);
    },
    onError: (e: any) => toast({ title: t("documentTemplate.error"), description: e.message, variant: "destructive" }),
  });

  const canSubmit = name.trim().length > 0 && key.trim().length > 0 && !create.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("documentTemplate.create_title", { kind: t(`documentTemplate.kind_${kind}`) })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-1.5">
            <Label>{t("documentTemplate.f_name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("documentTemplate.f_name_ph")} autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("documentTemplate.f_key")}</Label>
            <Input value={key} onChange={(e) => setKey(e.target.value)} className="font-mono text-sm" placeholder="homestay.placement_terms" />
            <p className="text-[11px] text-muted-foreground">{t("documentTemplate.f_key_hint")}</p>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("documentTemplate.f_description")}</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("documentTemplate.f_description_ph")} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={() => create.mutate()} disabled={!canSubmit}>
            {create.isPending ? t("common.creating") : t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DocumentTemplates() {
  const { t } = useTranslation();
  const [kind, setKind] = useState<Kind>("email");
  const [cat, setCat] = useState<Category | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["document-templates", kind],
    queryFn: async (): Promise<TemplateRow[]> => {
      const res = await apiFetch(`${API}?kind=${kind}`);
      if (!res.ok) throw new Error("Failed to load templates");
      return (await res.json()).data ?? [];
    },
  });

  // 실제로 존재하는 카테고리만 칩으로 보여준다 (테넌트마다 쓰는 그룹이 다르다).
  const presentCats = useMemo(() => {
    const seen = new Set(rows.map((r) => r.category ?? "common"));
    return CATEGORIES.filter((c) => seen.has(c));
  }, [rows]);

  // 템플릿은 종류별로 수십 개다 — 수신자 그룹으로 좁힌 뒤 이름·키·설명을 키워드로 훑는다.
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (cat !== "all" && (r.category ?? "common") !== cat) return false;
      if (!term) return true;
      return [r.name, r.key, r.description, r.category].some((v) =>
        String(v ?? "").toLowerCase().includes(term));
    });
  }, [rows, q, cat]);

  const columns: ColumnDef<TemplateRow>[] = useMemo(() => [
    {
      key: "name",
      header: t("documentTemplate.col_name"),
      hideable: false,
      cell: (r) => (
        <>
          <Link href={`/settings/document-templates/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
          {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
        </>
      ),
    },
    {
      key: "key",
      header: t("documentTemplate.col_key"),
      cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.key}</span>,
    },
    {
      key: "category",
      header: t("documentTemplate.col_category"),
      sortAccessor: (r) => `${r.category ?? "common"} ${keyDomain(r.key) ?? ""}`,
      cell: (r) => {
        const c = r.category ?? "common";
        const domain = keyDomain(r.key);
        return (
          <>
            <span className="text-xs">
              {CATEGORIES.includes(c as Category) ? t(`documentTemplate.cat_${c}`) : c}
            </span>
            {domain && <div className="font-mono text-[11px] text-muted-foreground">{domain}</div>}
          </>
        );
      },
    },
    {
      key: "locales",
      header: t("documentTemplate.col_locales"),
      sortAccessor: (r) => r.locales.join(", "),
      cell: (r) => (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Globe className="h-3 w-3" /> {r.locales.join(", ") || "—"}</span>
      ),
    },
    {
      key: "status",
      header: t("documentTemplate.col_status"),
      cell: (r) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadge(r.status)}`}>
          {t(`documentTemplate.status_${r.status}`)}
        </span>
      ),
    },
    {
      key: ACTIONS_KEY,
      header: "",
      hideable: false,
      sortable: false,
      align: "right",
      cell: (r) => (
        <Link href={`/settings/document-templates/${r.id}`}>
          <Button size="sm" variant="ghost" className="gap-1.5"><Eye className="h-3.5 w-3.5" /> {t("common.edit")}</Button>
        </Link>
      ),
    },
  ], [t]);

  return (
    <Layout>
      <PageHeader
        title={<><FileText className="h-5 w-5" />{t("documentTemplate.title")}</>}
        subtitle={t("documentTemplate.subtitle")}
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("documentTemplate.btn_new")}
          </Button>
        }
      />
      <div className="px-6 py-6">
        <div className="flex gap-2 mb-4">
          {KINDS.map((k) => {
            const Icon = k.icon;
            const active = kind === k.key;
            return (
              <button
                key={k.key}
                onClick={() => setKind(k.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  active ? "bg-primary/15 text-primary border-primary/20" : "bg-white text-muted-foreground border-border hover:bg-muted/50"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {t(`documentTemplate.kind_${k.key}`)}
              </button>
            );
          })}
        </div>

        {/* 수신자 그룹 필터 — 147개 규모에서 종류 탭만으로는 목록이 무너진다. */}
        {presentCats.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {(["all", ...presentCats] as const).map((c) => {
              const active = cat === c;
              const count = c === "all" ? rows.length : rows.filter((r) => (r.category ?? "common") === c).length;
              return (
                <button
                  key={c}
                  onClick={() => setCat(c as Category | "all")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border transition-colors ${
                    active ? "bg-primary/10 text-primary border-primary/20" : "bg-white text-muted-foreground border-border hover:bg-muted/50"
                  }`}
                >
                  {c === "all" ? t("common.all") : t(`documentTemplate.cat_${c}`)}
                  <span className="text-[10px] opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        <DataTable
          tableKey="document-templates"
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          rowKey={(r) => r.id}
          emptyText={t("documentTemplate.empty")}
          toolbarExtra={<SearchBox value={q} onChange={setQ} placeholder={t("common.search_ph_generic")} />}
        />
      </div>

      <CreateDialog kind={kind} open={createOpen} onOpenChange={setCreateOpen} />
    </Layout>
  );
}

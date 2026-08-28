import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  BookOpen, ExternalLink, Pencil, Plus, Search, Sparkles, Trash2, Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";

const API = "/api/v1/help-docs";

interface HelpDoc {
  id: number;
  title: string;
  description: string | null;
  category: string;
  audience: "staff" | "tenant";
  url: string | null;
  route_pattern: string | null;
  issue_hint: string | null;
  tags: string[];
  sort_order: number;
  status: string;
}

const EMPTY: Partial<HelpDoc> = {
  title: "", description: "", category: "운영 가이드", audience: "staff",
  url: "", route_pattern: "", issue_hint: "", tags: [], sort_order: 100,
};

/**
 * 내부 문서함 — 운영 지도·정책 문서·세입자에게 나가는 링크를 한자리에.
 *
 * 신입 담당자가 "이 일은 어느 화면에서 하고 세입자에게는 뭐가 나가는가"를 물을
 * 곳이 없어 매번 사람에게 묻던 것을 대신한다. 카드를 누르면 **새 탭**으로 열린다 —
 * 교육 중에 자료를 열어 보다가 보던 목록을 잃지 않도록.
 *
 * 파일을 담지 않고 가리키기만 한다. 발행된 서류의 실물은 문서 라이브러리가 갖고
 * 있고, 여기에 또 두면 같은 문서가 두 곳에서 각자 낡는다.
 */
export default function HelpDocs() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [audience, setAudience] = useState<"" | "staff" | "tenant">("");
  const [editing, setEditing] = useState<Partial<HelpDoc> | null>(null);

  const { data: docs = [], refetch, isLoading } = useQuery({
    queryKey: ["help-docs"],
    queryFn: async (): Promise<HelpDoc[]> => {
      const res = await apiFetch(API);
      if (!res.ok) return [];
      return (await res.json()).data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return docs.filter((d) => {
      if (audience && d.audience !== audience) return false;
      if (!needle) return true;
      return [d.title, d.description, d.category, d.issue_hint, (d.tags ?? []).join(" ")]
        .filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [docs, q, audience]);

  const groups = useMemo(() => {
    const map = new Map<string, HelpDoc[]>();
    for (const d of filtered) {
      if (!map.has(d.category)) map.set(d.category, []);
      map.get(d.category)!.push(d);
    }
    return [...map.entries()];
  }, [filtered]);

  const seed = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`${API}/seed`, { method: "POST", body: "{}" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message ?? t("helpDocs.error_seed"));
      return body.data as { added: number; skipped: number };
    },
    onSuccess: (d) => { refetch(); toast({ title: t("helpDocs.toast_seeded", { count: d.added }) }); },
    onError: (e: any) => toast({ title: t("helpDocs.error_seed"), description: e.message, variant: "destructive" }),
  });

  const save = useMutation({
    mutationFn: async (doc: Partial<HelpDoc>) => {
      const body = JSON.stringify({ ...doc, tags: doc.tags ?? [] });
      const res = doc.id
        ? await apiFetch(`${API}/${doc.id}`, { method: "PUT", body })
        : await apiFetch(API, { method: "POST", body });
      const parsed = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(parsed?.error?.message ?? t("helpDocs.error_save"));
      return parsed;
    },
    onSuccess: () => { setEditing(null); refetch(); toast({ title: t("common.saved", "저장했습니다") }); },
    onError: (e: any) => toast({ title: t("helpDocs.error_save"), description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`${API}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => { setEditing(null); refetch(); toast({ title: t("helpDocs.toast_removed") }); },
  });

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold inline-flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" /> {t("helpDocs.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">{t("helpDocs.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={seed.isPending}
              onClick={() => seed.mutate()}>
              <Sparkles className="h-4 w-4" /> {t("helpDocs.btn_seed")}
            </Button>
            <Button type="button" size="sm" className="gap-1.5" onClick={() => setEditing({ ...EMPTY })}>
              <Plus className="h-4 w-4" /> {t("helpDocs.btn_add")}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={t("helpDocs.ph_search")} />
          </div>
          <div className="flex gap-1">
            {([["", "all"], ["staff", "staff"], ["tenant", "tenant"]] as const).map(([v, k]) => (
              <button type="button" key={k}
                onClick={() => setAudience(v as any)}
                className={`rounded-md border px-3 py-1.5 text-sm ${audience === v ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted/50"}`}>
                {t(`helpDocs.filter_${k}`)}
              </button>
            ))}
          </div>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}

        {!isLoading && docs.length === 0 && (
          <div className="rounded-lg border bg-white p-10 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 font-medium">{t("helpDocs.empty_title")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("helpDocs.empty_desc")}</p>
            <Button type="button" className="mt-4 gap-1.5" onClick={() => seed.mutate()} disabled={seed.isPending}>
              <Sparkles className="h-4 w-4" /> {t("helpDocs.btn_seed")}
            </Button>
          </div>
        )}

        {groups.map(([category, items]) => (
          <section key={category} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
              {category} <span className="ml-1 font-normal normal-case">{items.length}</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((d) => <DocCard key={d.id} doc={d} onEdit={() => setEditing(d)} />)}
            </div>
          </section>
        ))}

        {!isLoading && docs.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("helpDocs.no_match")}</p>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? t("helpDocs.dialog_edit") : t("helpDocs.dialog_new")}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3 py-1 text-sm max-h-[65vh] overflow-y-auto pr-1">
              <Field label={t("helpDocs.f_title")}>
                <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </Field>
              <Field label={t("helpDocs.f_description")}>
                <Textarea rows={3} value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("helpDocs.f_category")}>
                  <Input list="help-doc-categories" value={editing.category ?? ""}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
                  <datalist id="help-doc-categories">
                    {[...new Set(docs.map((d) => d.category))].map((c) => <option key={c} value={c} />)}
                  </datalist>
                </Field>
                <Field label={t("helpDocs.f_audience")}>
                  <select className="w-full rounded-md border px-2 py-2 text-sm bg-background"
                    value={editing.audience ?? "staff"}
                    onChange={(e) => setEditing({ ...editing, audience: e.target.value as any })}>
                    <option value="staff">{t("helpDocs.audience_staff")}</option>
                    <option value="tenant">{t("helpDocs.audience_tenant")}</option>
                  </select>
                </Field>
              </div>
              <Field label={t("helpDocs.f_url")} hint={t("helpDocs.hint_url")}>
                <Input value={editing.url ?? ""} onChange={(e) => setEditing({ ...editing, url: e.target.value })}
                  placeholder="https://… 또는 /documents/library" />
              </Field>
              <Field label={t("helpDocs.f_route_pattern")} hint={t("helpDocs.hint_route_pattern")}>
                <Input value={editing.route_pattern ?? ""}
                  onChange={(e) => setEditing({ ...editing, route_pattern: e.target.value })}
                  placeholder="https://…/pay/:token" />
              </Field>
              <Field label={t("helpDocs.f_issue_hint")}>
                <Input value={editing.issue_hint ?? ""}
                  onChange={(e) => setEditing({ ...editing, issue_hint: e.target.value })}
                  placeholder={t("helpDocs.ph_issue_hint")} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("helpDocs.f_tags")}>
                  <Input value={(editing.tags ?? []).join(", ")}
                    onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                </Field>
                <Field label={t("helpDocs.f_sort")}>
                  <Input type="number" value={editing.sort_order ?? 100}
                    onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
                </Field>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            {editing?.id ? (
              <Button type="button" variant="ghost" className="text-red-600 gap-1.5"
                onClick={() => { if (window.confirm(t("helpDocs.confirm_remove"))) remove.mutate(editing.id!); }}>
                <Trash2 className="h-4 w-4" /> {t("common.delete")}
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
              <Button type="button" onClick={() => editing && save.mutate(editing)} disabled={save.isPending || !editing?.title?.trim()}>
                {save.isPending ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * 카드 전체가 링크다. 새 탭으로 여는 이유는 교육 중에 자료를 하나씩 열어 보다가
 * 보던 목록을 잃지 않게 하기 위해서다. 수정 버튼만 링크 밖으로 빼 둔다.
 */
function DocCard({ doc, onEdit }: { doc: HelpDoc; onEdit: () => void }) {
  const { t } = useTranslation();
  const href = doc.url ?? undefined;
  const external = !!href && /^https?:\/\//i.test(href);

  return (
    <div className="group relative rounded-lg border bg-white p-4 hover:border-primary/50 hover:shadow-sm transition-colors">
      <button type="button"
        onClick={onEdit}
        className="absolute right-2 top-2 rounded p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted focus:opacity-100"
        title={t("helpDocs.dialog_edit")}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      <a
        href={href ?? "#"}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => { if (!href) e.preventDefault(); }}
        className={`block ${href ? "" : "cursor-default"}`}
      >
        <div className="flex items-center gap-2 pr-6">
          <span className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            doc.audience === "tenant" ? "bg-amber-100 text-amber-800" : "bg-primary/10 text-primary"}`}>
            {doc.audience === "tenant" ? <Users className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
            {t(`helpDocs.audience_${doc.audience}`)}
          </span>
          {external && <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        </div>

        <p className="mt-2 font-semibold leading-snug group-hover:text-primary">{doc.title}</p>
        {doc.description && (
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{doc.description}</p>
        )}

        {doc.route_pattern && (
          <code className="mt-2 block truncate rounded bg-muted px-2 py-1 text-[11px]">{doc.route_pattern}</code>
        )}
        {doc.issue_hint && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            <span className="font-medium">{t("helpDocs.issued_at")}</span> {doc.issue_hint}
          </p>
        )}
        {(doc.tags ?? []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {doc.tags.map((tag) => (
              <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">#{tag}</span>
            ))}
          </div>
        )}
      </a>
    </div>
  );
}

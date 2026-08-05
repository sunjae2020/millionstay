import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tag, Plus, Trash2, Check, X, Pencil, ArrowUp, ArrowDown, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";

import { CsvExportable } from "@/components/ui/ExportCsvButton";
type Category = { id: number; name: string; site_key: string; sort_order: number; is_active: boolean };

const API = "/api/v1/blog-categories";

async function fetchCategories(): Promise<Category[]> {
  const res = await apiFetch(API);
  if (!res.ok) throw new Error("Failed to load categories");
  return (await res.json()).data ?? [];
}

export default function BlogCategories({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: categories = [], isLoading } = useQuery({ queryKey: ["blog-categories"], queryFn: fetchCategories });

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["blog-categories"] });
    qc.invalidateQueries({ queryKey: ["public-blog-categories"] });
  };
  const fail = (e: any) => toast({ title: t("blog_categories.error", { defaultValue: "Something went wrong" }), description: String(e?.message ?? e), variant: "destructive" });

  const create = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiFetch(API, { method: "POST", body: JSON.stringify({ name, sort_order: (categories.at(-1)?.sort_order ?? 0) + 1 }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      return json;
    },
    onSuccess: () => { setNewName(""); invalidate(); toast({ title: t("blog_categories.added", { defaultValue: "Category added" }) }); },
    onError: fail,
  });

  const update = useMutation({
    mutationFn: async (p: { id: number; patch: Partial<Category> }) => {
      const res = await apiFetch(`${API}/${p.id}`, { method: "PUT", body: JSON.stringify(p.patch) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      return json;
    },
    onSuccess: () => { setEditingId(null); invalidate(); },
    onError: fail,
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`${API}/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
    },
    onSuccess: () => { setDeleteTarget(null); invalidate(); toast({ title: t("blog_categories.deleted", { defaultValue: "Category deleted" }) }); },
    onError: fail,
  });

  // Swap sort_order with the adjacent row to move a category up/down.
  function move(idx: number, dir: -1 | 1) {
    const a = categories[idx];
    const b = categories[idx + dir];
    if (!a || !b) return;
    update.mutate({ id: a.id, patch: { sort_order: b.sort_order } });
    update.mutate({ id: b.id, patch: { sort_order: a.sort_order } });
  }

  const Shell = embedded ? EmbeddedShell : Layout;

  return (
    <Shell>
      <PageHeader
        title={<><Tag className="h-5 w-5" />{t("blog_categories.title", { defaultValue: "Blog Categories" })}</>}
        subtitle={t("blog_categories.subtitle", { defaultValue: "Manage the categories available to blog posts and the public blog filter." })}
      />

      <div className="p-6 max-w-3xl">
        {/* Add */}
        <div className="flex items-center gap-2 mb-5">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) create.mutate(newName.trim()); }}
            placeholder={t("blog_categories.new_placeholder", { defaultValue: "New category name…" })}
            className="max-w-xs"
          />
          <Button onClick={() => create.mutate(newName.trim())} disabled={!newName.trim() || create.isPending}>
            {create.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            {t("blog_categories.add", { defaultValue: "Add" })}
          </Button>
        </div>

        <div className="border rounded-lg bg-white">
          <CsvExportable fileName="blog-categories"><Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>{t("blog_categories.col_name", { defaultValue: "Name" })}</TableHead>
                <TableHead className="w-28">{t("blog_categories.col_visible", { defaultValue: "Visible" })}</TableHead>
                <TableHead className="w-28 text-right">{t("blog_categories.col_actions", { defaultValue: "Actions" })}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
              ) : categories.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">{t("blog_categories.empty", { defaultValue: "No categories yet." })}</TableCell></TableRow>
              ) : categories.map((c, idx) => (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground">
                    <div className="flex flex-col">
                      <button className="hover:text-foreground disabled:opacity-30" disabled={idx === 0 || update.isPending} onClick={() => move(idx, -1)}><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button className="hover:text-foreground disabled:opacity-30" disabled={idx === categories.length - 1 || update.isPending} onClick={() => move(idx, 1)}><ArrowDown className="h-3.5 w-3.5" /></button>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {editingId === c.id ? (
                      <div className="flex items-center gap-1.5">
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 max-w-xs"
                          onKeyDown={(e) => { if (e.key === "Enter" && editName.trim()) update.mutate({ id: c.id, patch: { name: editName.trim() } }); if (e.key === "Escape") setEditingId(null); }} autoFocus />
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => editName.trim() && update.mutate({ id: c.id, patch: { name: editName.trim() } })}><Check className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <span className={c.is_active ? "" : "text-muted-foreground line-through"}>{c.name}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={c.is_active} onCheckedChange={(v) => update.mutate({ id: c.id, patch: { is_active: v } })} />
                      {!c.is_active && <Badge variant="outline" className="text-[10px]">{t("blog_categories.hidden", { defaultValue: "hidden" })}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {editingId !== c.id && (
                      <>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingId(c.id); setEditName(c.name); }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></CsvExportable>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          {t("blog_categories.note", { defaultValue: "Hiding or deleting a category does not change posts already using it — their category text is kept." })}
        </p>
      </div>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />{t("blog_categories.delete_title", { defaultValue: "Delete category" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("blog_categories.delete_confirm", { defaultValue: "Delete \"{{name}}\"? Posts already using it keep their category.", name: deleteTarget?.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button variant="destructive" onClick={() => deleteTarget && remove.mutate(deleteTarget.id)} disabled={remove.isPending}>
              {remove.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {t("blog_categories.delete", { defaultValue: "Delete" })}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
}

// When the categories screen is rendered inside the CMS blog tabs, the page
// chrome (sidebar Layout) is already provided by the parent route.
function EmbeddedShell({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

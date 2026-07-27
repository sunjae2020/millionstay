import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tag, Plus, Search, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";

const API = "/api/v1/product-types";

type ProductType = { id: number; name: string; description: string | null; created_at: string };

async function fetchTypes(showDeleted: boolean) {
  const res = await apiFetch(showDeleted ? `${API}?deleted=only` : API);
  if (!res.ok) throw new Error("Failed");
  const json = await res.json();
  return (json.data ?? []) as ProductType[];
}

const EMPTY = { name: "", description: "" };

export default function ProductTypesPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(EMPTY);
  const [showDeleted, setShowDeleted] = useState(false);

  const { data: types = [], isLoading } = useQuery({ queryKey: ["product-types", showDeleted], queryFn: () => fetchTypes(showDeleted) });

  const filtered = types.filter((ty) => !q || ty.name.toLowerCase().includes(q.toLowerCase()) || ty.description?.toLowerCase().includes(q.toLowerCase()));

  const columns: ColumnDef<ProductType>[] = useMemo(() => [
    {
      key: "name",
      header: t("common.name"),
      hideable: false,
      editable: { type: "text", getValue: (ty) => ty.name },
      cell: (ty) => <div className="font-medium">{ty.name}</div>,
    },
    {
      key: "description",
      header: t("common.description"),
      editable: { type: "text", getValue: (ty) => ty.description ?? "" },
      cell: (ty) => (
        <span className="text-sm text-muted-foreground max-w-xs truncate block">
          {ty.description || <span className="text-muted-foreground/40 italic">—</span>}
        </span>
      ),
    },
    {
      key: ACTIONS_KEY,
      header: "",
      hideable: false,
      sortable: false,
      align: "right",
      cell: (ty) => (
        <div className="flex gap-1 justify-end">
          <Button size="icon" variant="ghost" onClick={() => openEdit(ty)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(ty.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ], [t]);

  const save = useMutation({
    mutationFn: async () => {
      const url = editing ? `${API}/${editing.id}` : API;
      const method = editing ? "PUT" : "POST";
      const res = await apiFetch(url, { method, body: JSON.stringify(form) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: editing ? t("common.updated") : t("common.created"), description: t("productTypes.toast_saved") });
      qc.invalidateQueries({ queryKey: ["product-types"] });
      setOpen(false); setEditing(null); setForm(EMPTY);
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e.message || t("productTypes.toast_save_failed"), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`${API}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      toast({ title: t("common.deleted"), description: t("productTypes.toast_deleted") });
      qc.invalidateQueries({ queryKey: ["product-types"] });
      setDeleteId(null);
    },
    onError: () => toast({ title: t("common.error"), description: t("productTypes.toast_delete_failed"), variant: "destructive" }),
  });

  function openEdit(item: any) {
    setEditing(item);
    setForm({ name: item.name, description: item.description ?? "" });
    setOpen(true);
  }

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  return (
    <Layout>
      <PageHeader
        title={<><Tag className="h-5 w-5" />{t("nav.product_types")}</>}
        subtitle={t("productTypes.subtitle")}
      />

      <div className="px-8 py-6">
        <div className="flex gap-3 mb-4">
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />{t("productTypes.new_type")}</Button>
        </div>

        <DataTable
          tableKey="product-types"
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          rowKey={(ty) => ty.id}
          emptyText={t("productTypes.empty")}
          selection={{ enable: true, resource: "product-types", onChanged: () => qc.invalidateQueries({ queryKey: ["product-types"] }) }}
          editing={{ resource: "product-types", onEdited: () => qc.invalidateQueries({ queryKey: ["product-types"] }) }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder={t("productTypes.search_ph")} value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
          }
        />

        <p className="text-xs text-muted-foreground mt-3">{filtered.length} type{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? t("productTypes.edit_title") : t("productTypes.new_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{t("common.name")} *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1"
                placeholder={t("productTypes.name_ph")}
                autoFocus
              />
            </div>
            <div>
              <Label>{t("common.description")}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="mt-1 resize-none"
                rows={3}
                placeholder={t("productTypes.description_ph")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}>
              {save.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("productTypes.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("productTypes.delete_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button variant="destructive" onClick={() => deleteId !== null && remove.mutate(deleteId)}>
              {t("common.delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

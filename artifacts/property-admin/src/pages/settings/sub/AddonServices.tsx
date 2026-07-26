import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Search, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { ADDON_CATEGORY_OPTIONS, ADDON_UNIT_OPTIONS } from "@/lib/accommodationOptions";

const API = "/api/v1/addon-services";

type AddonService = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  category: string;
  base_price: number | null;
  currency: string;
  unit: string;
  is_active: boolean;
  sort_order: number;
};

async function fetchServices(showDeleted: boolean) {
  const res = await apiFetch(showDeleted ? `${API}?deleted=only` : API);
  if (!res.ok) throw new Error("Failed");
  const json = await res.json();
  return (json.data ?? []) as AddonService[];
}

const EMPTY = {
  code: "", name: "", description: "", category: "other",
  base_price: "", currency: "AUD", unit: "per_booking", sort_order: 0,
};

export default function AddonServicesPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<AddonService | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [showDeleted, setShowDeleted] = useState(false);

  const { data: services = [], isLoading } = useQuery({ queryKey: ["addon-services", showDeleted], queryFn: () => fetchServices(showDeleted) });

  const filtered = services.filter((s) =>
    !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.code.toLowerCase().includes(q.toLowerCase()));

  const columns: ColumnDef<AddonService>[] = useMemo(() => [
    {
      key: "name",
      header: t("accommodation_options.col_name", "Name"),
      hideable: false,
      cell: (item) => (
        <>
          <div className="font-medium">{item.name}</div>
          <div className="text-xs text-muted-foreground font-mono">{item.code}</div>
        </>
      ),
    },
    {
      key: "category",
      header: t("accommodation_options.col_category", "Category"),
      cell: (item) => <Badge variant="secondary">{t(`accommodation_options.addon_category.${item.category}`, item.category)}</Badge>,
    },
    {
      key: "base_price",
      header: t("accommodation_options.col_price", "Price"),
      cell: (item) => (
        <span className="text-sm">
          {item.base_price != null ? `${item.currency} ${item.base_price.toFixed(2)}` : <span className="text-muted-foreground/40 italic">—</span>}
        </span>
      ),
    },
    {
      key: "unit",
      header: t("accommodation_options.col_unit", "Unit"),
      cell: (item) => <span className="text-sm text-muted-foreground">{t(`accommodation_options.addon_unit.${item.unit}`, item.unit)}</span>,
    },
    {
      key: ACTIONS_KEY,
      header: "",
      hideable: false,
      sortable: false,
      align: "right",
      cell: (item) => (
        <div className="flex gap-1 justify-end">
          <Button size="icon" variant="ghost" onClick={() => openEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      ),
    },
  ], [t]);

  const save = useMutation({
    mutationFn: async () => {
      const url = editing ? `${API}/${editing.id}` : API;
      const method = editing ? "PUT" : "POST";
      const payload = {
        ...form,
        base_price: form.base_price === "" ? null : Number(form.base_price),
        sort_order: Number(form.sort_order) || 0,
      };
      const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: editing ? t("common.updated", "Updated") : t("common.created", "Created") });
      qc.invalidateQueries({ queryKey: ["addon-services"] });
      setOpen(false); setEditing(null); setForm(EMPTY);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`${API}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      toast({ title: t("common.deleted", "Deleted") });
      qc.invalidateQueries({ queryKey: ["addon-services"] });
      setDeleteId(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to delete.", variant: "destructive" }),
  });

  function openEdit(item: AddonService) {
    setEditing(item);
    setForm({
      code: item.code, name: item.name, description: item.description ?? "",
      category: item.category, base_price: item.base_price?.toString() ?? "",
      currency: item.currency, unit: item.unit, sort_order: item.sort_order,
    });
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
        title={<><Package className="h-5 w-5" />{t("nav.addon_services", "Add-on Services")}</>}
        subtitle={t("accommodation_options.addon_subtitle", "Services sold on top of accommodation")}
      />

      <div className="px-8 py-6">
        <div className="flex gap-3 mb-4">
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />{t("common.new", "New")}</Button>
        </div>

        <DataTable
          tableKey="addon-services"
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          rowKey={(s) => s.id}
          emptyText={t("accommodation_options.empty", "No add-on services")}
          selection={{ enable: true, resource: "addon-services", onChanged: () => qc.invalidateQueries({ queryKey: ["addon-services"] }) }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder={t("common.search", "Search…")} value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
          }
        />

        <p className="text-xs text-muted-foreground mt-3">{filtered.length} {t("nav.addon_services", "Add-on Services")}</p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t("accommodation_options.edit_addon", "Edit Add-on Service") : t("accommodation_options.new_addon", "New Add-on Service")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("accommodation_options.col_name", "Name")} *</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1" autoFocus />
              </div>
              <div>
                <Label>{t("accommodation_options.code", "Code")} *</Label>
                <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className="mt-1 font-mono" placeholder="airport_pickup" disabled={!!editing} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("accommodation_options.col_category", "Category")}</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ADDON_CATEGORY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{t(o.i18nKey)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("accommodation_options.col_unit", "Unit")}</Label>
                <Select value={form.unit} onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ADDON_UNIT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{t(o.i18nKey)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("accommodation_options.col_price", "Price")}</Label>
                <Input type="number" value={form.base_price} onChange={(e) => setForm((f) => ({ ...f, base_price: e.target.value }))} className="mt-1" placeholder="0.00" />
              </div>
              <div>
                <Label>{t("accommodation_options.currency", "Currency")}</Label>
                <Input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>{t("accommodation_options.description", "Description")}</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="mt-1 resize-none" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel", "Cancel")}</Button>
            <Button onClick={() => save.mutate()} disabled={!form.name.trim() || !form.code.trim() || save.isPending}>
              {save.isPending ? t("common.saving", "Saving…") : t("common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("accommodation_options.delete_addon", "Delete Add-on Service")}</AlertDialogTitle>
            <AlertDialogDescription>{t("accommodation_options.delete_confirm", "This will remove the add-on service. Accommodations using it will lose the link.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <Button variant="destructive" onClick={() => deleteId !== null && remove.mutate(deleteId)}>{t("common.delete", "Delete")}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

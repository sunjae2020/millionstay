import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layers, Plus, Search, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";

const API = "/api/v1/product-groups";

type ProductGroup = { id: number; name: string; display_order: number; created_at: string };

async function fetchGroups(showDeleted: boolean) {
  const res = await apiFetch(showDeleted ? `${API}?deleted=only` : API);
  if (!res.ok) throw new Error("Failed");
  const json = await res.json();
  return (json.data ?? []) as ProductGroup[];
}

const EMPTY = { name: "", display_order: 0 };

export default function ProductGroupsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(EMPTY);
  const [showDeleted, setShowDeleted] = useState(false);

  const { data: groups = [], isLoading } = useQuery({ queryKey: ["product-groups", showDeleted], queryFn: () => fetchGroups(showDeleted) });

  const filtered = groups.filter((g) => !q || g.name.toLowerCase().includes(q.toLowerCase()));

  const columns: ColumnDef<ProductGroup>[] = useMemo(() => [
    {
      key: "name",
      header: "Name",
      hideable: false,
      cell: (g) => <div className="font-medium">{g.name}</div>,
    },
    {
      key: "display_order",
      header: "Display Order",
      align: "right",
      cell: (g) => <span className="text-muted-foreground text-sm">{g.display_order}</span>,
    },
    {
      key: ACTIONS_KEY,
      header: "",
      hideable: false,
      sortable: false,
      align: "right",
      cell: (g) => (
        <div className="flex gap-1 justify-end">
          <Button size="icon" variant="ghost" onClick={() => openEdit(g)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(g.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ], []);

  const save = useMutation({
    mutationFn: async () => {
      const url = editing ? `${API}/${editing.id}` : API;
      const method = editing ? "PUT" : "POST";
      const res = await apiFetch(url, { method, body: JSON.stringify(form) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: editing ? "Updated" : "Created", description: "Product group saved." });
      qc.invalidateQueries({ queryKey: ["product-groups"] });
      setOpen(false); setEditing(null); setForm(EMPTY);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "Failed to save.", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`${API}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Product group removed." });
      qc.invalidateQueries({ queryKey: ["product-groups"] });
      setDeleteId(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to delete.", variant: "destructive" }),
  });

  function openEdit(g: any) {
    setEditing(g);
    setForm({ name: g.name, display_order: g.display_order });
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
        title={<><Layers className="h-5 w-5" />{t("nav.product_groups")}</>}
        subtitle="Organise products into logical groups"
      />

      <div className="px-8 py-6">
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search groups…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Group</Button>
        </div>

        <DataTable
          tableKey="product-groups"
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          rowKey={(g) => g.id}
          emptyText="No product groups found"
          selection={{ enable: true, resource: "product-groups", onChanged: () => qc.invalidateQueries({ queryKey: ["product-groups"] }) }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
        />

        <p className="text-xs text-muted-foreground mt-3">{filtered.length} group{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Product Group" : "New Product Group"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1"
                placeholder="e.g. Accommodation"
                autoFocus
              />
            </div>
            <div>
              <Label>Display Order</Label>
              <Input
                type="number"
                value={form.display_order}
                onChange={(e) => setForm((f) => ({ ...f, display_order: Number(e.target.value) }))}
                className="mt-1 w-28"
                min={0}
              />
              <p className="text-xs text-muted-foreground mt-1">Lower numbers appear first</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product Group</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the group. Products using this group will lose their group assignment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={() => deleteId !== null && remove.mutate(deleteId)}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

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
import { Wallet, Plus, Search, Pencil, Trash2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";

const API = "/api/v1/chart-of-accounts";

const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"] as const;
type AccountType = (typeof ACCOUNT_TYPES)[number];

type Account = {
  id: number;
  code: string;
  name: string;
  account_type: AccountType;
  parent_code: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

const TYPE_VARIANT: Record<AccountType, string> = {
  asset: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  liability: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  equity: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  revenue: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  expense: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

async function fetchAccounts(showDeleted: boolean): Promise<Account[]> {
  const res = await apiFetch(showDeleted ? `${API}?deleted=only` : API);
  if (!res.ok) throw new Error("Failed");
  const json = await res.json();
  return (json.data ?? []) as Account[];
}

const EMPTY = { code: "", name: "", account_type: "asset" as AccountType, parent_code: "", description: "" };

export default function CostCenterPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [showDeleted, setShowDeleted] = useState(false);

  const { data: accounts = [], isLoading } = useQuery({ queryKey: ["chart-of-accounts", showDeleted], queryFn: () => fetchAccounts(showDeleted) });

  const filtered = accounts.filter((a) => !q || a.code.toLowerCase().includes(q.toLowerCase()) || a.name.toLowerCase().includes(q.toLowerCase()));

  const columns: ColumnDef<Account>[] = useMemo(() => [
    {
      key: "code",
      header: t("coa.code"),
      hideable: false,
      cell: (a) => <span className="font-mono text-sm font-medium">{a.code}</span>,
    },
    {
      key: "name",
      header: t("common.name"),
      hideable: false,
      cell: (a) => (
        <div className="font-medium">
          {a.parent_code && <span className="text-muted-foreground/50 mr-1">└</span>}
          {a.name}
        </div>
      ),
    },
    {
      key: "account_type",
      header: t("coa.type"),
      cell: (a) => <Badge className={`${TYPE_VARIANT[a.account_type]} border-0 font-normal`}>{t(`coa.type_${a.account_type}`)}</Badge>,
    },
    {
      key: "parent_code",
      header: t("coa.parent"),
      cell: (a) => <span className="font-mono text-xs text-muted-foreground">{a.parent_code || <span className="text-muted-foreground/40">—</span>}</span>,
    },
    {
      key: ACTIONS_KEY,
      header: "",
      hideable: false,
      sortable: false,
      align: "right",
      cell: (a) => (
        <div className="flex gap-1 justify-end">
          <Button size="icon" variant="ghost" onClick={() => openEdit(a)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(a.id)}>
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
      const body = { ...form, parent_code: form.parent_code.trim() || null, description: form.description.trim() || null };
      const res = await apiFetch(url, { method, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: editing ? t("common.updated") : t("common.created"), description: t("coa.toast_saved") });
      qc.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      setOpen(false); setEditing(null); setForm(EMPTY);
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e.message || t("coa.toast_save_failed"), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`${API}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      toast({ title: t("common.deleted"), description: t("coa.toast_deleted") });
      qc.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      setDeleteId(null);
    },
    onError: () => toast({ title: t("common.error"), description: t("coa.toast_delete_failed"), variant: "destructive" }),
  });

  const seedDefaults = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`${API}/seed-defaults`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: t("coa.seeded_title"), description: t("coa.seeded_desc", { count: data?.inserted ?? 0 }) });
      qc.invalidateQueries({ queryKey: ["chart-of-accounts"] });
    },
    onError: () => toast({ title: t("common.error"), description: t("coa.toast_save_failed"), variant: "destructive" }),
  });

  function openEdit(a: Account) {
    setEditing(a);
    setForm({ code: a.code, name: a.name, account_type: a.account_type, parent_code: a.parent_code ?? "", description: a.description ?? "" });
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
        title={<><Wallet className="h-5 w-5" />{t("nav.cost_center")}</>}
        subtitle={t("coa.subtitle")}
      />

      <div className="px-8 py-6">
        <div className="flex flex-wrap gap-3 mb-4">
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />{t("coa.new_account")}</Button>
          {accounts.length === 0 && !isLoading && (
            <Button variant="outline" onClick={() => seedDefaults.mutate()} disabled={seedDefaults.isPending}>
              <Sparkles className="h-4 w-4 mr-2" />{seedDefaults.isPending ? t("common.saving") : t("coa.load_standard")}
            </Button>
          )}
        </div>

        <DataTable
          tableKey="chart-of-accounts"
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          rowKey={(a) => a.id}
          emptyText={t("coa.empty")}
          selection={{ enable: true, resource: "chart-of-accounts", onChanged: () => qc.invalidateQueries({ queryKey: ["chart-of-accounts"] }) }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder={t("coa.search_ph")} value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
          }
        />

        <p className="text-xs text-muted-foreground mt-3">{filtered.length} {t("coa.accounts_count")}</p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? t("coa.edit_title") : t("coa.new_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("coa.code")} *</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  className="mt-1 font-mono"
                  placeholder="4000"
                  autoFocus
                />
              </div>
              <div>
                <Label>{t("coa.type")} *</Label>
                <Select value={form.account_type} onValueChange={(v) => setForm((f) => ({ ...f, account_type: v as AccountType }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((ty) => (
                      <SelectItem key={ty} value={ty}>{t(`coa.type_${ty}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t("common.name")} *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1"
                placeholder={t("coa.name_ph")}
              />
            </div>
            <div>
              <Label>{t("coa.parent")}</Label>
              <Input
                value={form.parent_code}
                onChange={(e) => setForm((f) => ({ ...f, parent_code: e.target.value }))}
                className="mt-1 font-mono"
                placeholder={t("coa.parent_ph")}
              />
            </div>
            <div>
              <Label>{t("common.description")}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="mt-1 resize-none"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => save.mutate()} disabled={!form.code.trim() || !form.name.trim() || save.isPending}>
              {save.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("coa.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("coa.delete_desc")}</AlertDialogDescription>
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

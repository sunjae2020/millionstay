import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Search, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { matchesQuery } from "@/lib/search";

async function fetchContractTypes(showDeleted: boolean) {
  const res = await fetch(showDeleted ? "/api/v1/contract-types?deleted=only" : "/api/v1/contract-types");
  if (!res.ok) throw new Error("Failed");
  const json = await res.json();
  return json.data ?? [];
}

const SECURITY_OPTIONS = ["Public", "Private", "Confidential"];

export default function ContractTypesPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", contract_security: "Public",
    require_passport: false, require_visa: false, require_enrollment: false, is_active: true,
  });

  const { data: types = [], isLoading } = useQuery({ queryKey: ["contract-types", showDeleted], queryFn: () => fetchContractTypes(showDeleted) });

  const filtered = (types as any[]).filter((ct: any) => matchesQuery(q, ct.name, ct.description, ct.contract_security));

  const columns: ColumnDef<any>[] = useMemo(() => [
    {
      key: "name",
      header: t("common.name"),
      hideable: false,
      editable: { type: "text", getValue: (ct) => ct.name },
      cell: (ct) => (
        <>
          <div className="font-medium">{ct.name}</div>
          {ct.description && <div className="text-xs text-muted-foreground">{ct.description}</div>}
        </>
      ),
    },
    {
      key: "contract_security",
      header: t("contractTypes.col_security"),
      editable: {
        type: "select",
        getValue: (ct) => ct.contract_security,
        options: SECURITY_OPTIONS.map((s) => ({ value: s, label: s })),
      },
      cell: (ct) => <Badge variant="outline">{ct.contract_security}</Badge>,
    },
    {
      key: "require_passport",
      header: t("contractTypes.col_passport"),
      editable: { type: "boolean", getValue: (ct) => ct.require_passport },
      cell: (ct) => <span className="text-sm">{ct.require_passport ? "✓" : "—"}</span>,
    },
    {
      key: "require_visa",
      header: t("contractTypes.col_visa"),
      editable: { type: "boolean", getValue: (ct) => ct.require_visa },
      cell: (ct) => <span className="text-sm">{ct.require_visa ? "✓" : "—"}</span>,
    },
    {
      key: "require_enrollment",
      header: t("contractTypes.col_enrollment"),
      editable: { type: "boolean", getValue: (ct) => ct.require_enrollment },
      cell: (ct) => <span className="text-sm">{ct.require_enrollment ? "✓" : "—"}</span>,
    },
    {
      key: "is_active",
      header: t("common.status"),
      editable: { type: "boolean", getValue: (ct) => ct.is_active },
      cell: (ct) => (
        <Badge className={ct.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
          {ct.is_active ? t("common.active") : t("common.inactive")}
        </Badge>
      ),
    },
    {
      key: ACTIONS_KEY,
      header: "",
      hideable: false,
      sortable: false,
      align: "right",
      cell: (ct) => (
        <Button size="icon" variant="ghost" onClick={() => openEdit(ct)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ], [t]);

  const save = useMutation({
    mutationFn: async () => {
      const url = editing ? `/api/v1/contract-types/${editing.id}` : "/api/v1/contract-types";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: editing ? t("common.updated") : t("common.created"), description: t("contractTypes.toast_saved") });
      qc.invalidateQueries({ queryKey: ["contract-types"] });
      setOpen(false);
      setEditing(null);
      setForm({ name: "", description: "", contract_security: "Public", require_passport: false, require_visa: false, require_enrollment: false, is_active: true });
    },
    onError: () => toast({ title: t("common.error"), description: t("contractTypes.toast_save_failed"), variant: "destructive" }),
  });

  function openEdit(t: any) {
    setEditing(t);
    setForm({
      name: t.name, description: t.description ?? "",
      contract_security: t.contract_security,
      require_passport: t.require_passport, require_visa: t.require_visa,
      require_enrollment: t.require_enrollment, is_active: t.is_active,
    });
    setOpen(true);
  }

  function openNew() {
    setEditing(null);
    setForm({ name: "", description: "", contract_security: "Public", require_passport: false, require_visa: false, require_enrollment: false, is_active: true });
    setOpen(true);
  }

  return (
    <Layout>
      <PageHeader
        title={<><FileText className="h-5 w-5" />{t("nav.contract_types")}</>}
        subtitle={t("contractTypes.subtitle")}
      />
      <div className="px-8 py-6">
        <div className="flex gap-3 mb-4">
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />{t("contractTypes.new_type")}</Button>
        </div>

        <DataTable
          tableKey="contract-types"
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          rowKey={(ct) => ct.id}
          emptyText={t("contractTypes.empty")}
          selection={{ enable: true, resource: "contract-types", onChanged: () => qc.invalidateQueries({ queryKey: ["contract-types"] }) }}
          editing={{ resource: "contract-types", onEdited: () => qc.invalidateQueries({ queryKey: ["contract-types"] }) }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder={t("contractTypes.search_ph")} value={q} onChange={e => setQ(e.target.value)} />
              </div>
            </div>
          }
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t("contractTypes.edit_title") : t("contractTypes.new_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{t("common.name")} *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" placeholder={t("contractTypes.name_ph")} />
            </div>
            <div>
              <Label>{t("common.description")}</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>{t("contractTypes.label_security_level")}</Label>
              <Select value={form.contract_security} onValueChange={v => setForm(f => ({ ...f, contract_security: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SECURITY_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 pt-2">
              <Label className="text-sm font-medium">{t("contractTypes.label_requirements")}</Label>
              {(["require_passport", "require_visa", "require_enrollment"] as const).map((field) => (
                <div key={field} className="flex items-center gap-2">
                  <Switch checked={form[field]} onCheckedChange={v => setForm(f => ({ ...f, [field]: v }))} />
                  <Label className="font-normal">{t(`contractTypes.${field}`)}</Label>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label className="font-normal">{t("common.active")}</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending}>
              {save.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

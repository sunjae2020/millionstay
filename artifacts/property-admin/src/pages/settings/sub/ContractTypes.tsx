import { useState } from "react";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Search, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

async function fetchContractTypes() {
  const res = await fetch("/api/v1/contract-types");
  if (!res.ok) throw new Error("Failed");
  const json = await res.json();
  return json.data ?? [];
}

const SECURITY_OPTIONS = ["Public", "Private", "Confidential"];

export default function ContractTypesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: "", description: "", contract_security: "Public",
    require_passport: false, require_visa: false, require_enrollment: false, is_active: true,
  });

  const { data: types = [], isLoading } = useQuery({ queryKey: ["contract-types"], queryFn: fetchContractTypes });

  const filtered = (types as any[]).filter((t: any) =>
    !q || t.name.toLowerCase().includes(q.toLowerCase())
  );

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
      toast({ title: editing ? "Updated" : "Created", description: "Contract type saved." });
      qc.invalidateQueries({ queryKey: ["contract-types"] });
      setOpen(false);
      setEditing(null);
      setForm({ name: "", description: "", contract_security: "Public", require_passport: false, require_visa: false, require_enrollment: false, is_active: true });
    },
    onError: () => toast({ title: "Error", description: "Failed to save.", variant: "destructive" }),
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
        title={<><FileText className="h-5 w-5" />Contract Types</>}
        subtitle="Define contract type categories and requirements"
      />
      <div className="px-8 py-6">
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search types..." value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Type</Button>
        </div>

        <div className="border rounded-lg bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Security</TableHead>
                <TableHead>Passport</TableHead>
                <TableHead>Visa</TableHead>
                <TableHead>Enrollment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No contract types found</TableCell></TableRow>
              ) : filtered.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium">{t.name}</div>
                    {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                  </TableCell>
                  <TableCell><Badge variant="outline">{t.contract_security}</Badge></TableCell>
                  <TableCell className="text-sm">{t.require_passport ? "✓" : "—"}</TableCell>
                  <TableCell className="text-sm">{t.require_visa ? "✓" : "—"}</TableCell>
                  <TableCell className="text-sm">{t.require_enrollment ? "✓" : "—"}</TableCell>
                  <TableCell>
                    <Badge className={t.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                      {t.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Contract Type" : "New Contract Type"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" placeholder="e.g. Standard Residential" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Security Level</Label>
              <Select value={form.contract_security} onValueChange={v => setForm(f => ({ ...f, contract_security: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SECURITY_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 pt-2">
              <Label className="text-sm font-medium">Requirements</Label>
              {([["require_passport", "Passport"], ["require_visa", "Visa"], ["require_enrollment", "Enrollment"]] as const).map(([field, label]) => (
                <div key={field} className="flex items-center gap-2">
                  <Switch checked={form[field]} onCheckedChange={v => setForm(f => ({ ...f, [field]: v }))} />
                  <Label className="font-normal">Require {label}</Label>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label className="font-normal">Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending}>
              {save.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

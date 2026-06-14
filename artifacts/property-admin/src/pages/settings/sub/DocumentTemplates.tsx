import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const [createOpen, setCreateOpen] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["document-templates", kind],
    queryFn: async (): Promise<TemplateRow[]> => {
      const res = await apiFetch(`${API}?kind=${kind}`);
      if (!res.ok) throw new Error("Failed to load templates");
      return (await res.json()).data ?? [];
    },
  });

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
                  active ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-white text-muted-foreground border-border hover:bg-muted/50"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {t(`documentTemplate.kind_${k.key}`)}
              </button>
            );
          })}
        </div>

        <div className="border rounded-lg bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("documentTemplate.col_name")}</TableHead>
                <TableHead>{t("documentTemplate.col_key")}</TableHead>
                <TableHead>{t("documentTemplate.col_locales")}</TableHead>
                <TableHead>{t("documentTemplate.col_status")}</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">{t("documentTemplate.empty")}</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/settings/document-templates/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                    {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.key}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Globe className="h-3 w-3" /> {r.locales.join(", ") || "—"}</span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadge(r.status)}`}>
                      {t(`documentTemplate.status_${r.status}`)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Link href={`/settings/document-templates/${r.id}`}>
                      <Button size="sm" variant="ghost" className="gap-1.5"><Eye className="h-3.5 w-3.5" /> {t("common.edit")}</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <CreateDialog kind={kind} open={createOpen} onOpenChange={setCreateOpen} />
    </Layout>
  );
}

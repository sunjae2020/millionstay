import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { FileText, Mail, FileCheck, Eye, Globe } from "lucide-react";
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

const KINDS = [
  { key: "email", icon: Mail },
  { key: "contract", icon: FileCheck },
] as const;

function statusBadge(s: string): string {
  if (s === "published") return "bg-green-100 text-green-700 border-green-200";
  if (s === "draft") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}

export default function DocumentTemplates() {
  const { t } = useTranslation();
  const [kind, setKind] = useState<"email" | "contract">("email");

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
    </Layout>
  );
}

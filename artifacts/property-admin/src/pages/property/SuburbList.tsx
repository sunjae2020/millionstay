import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListSuburbs, useDeleteSuburb, getListSuburbsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SuburbList() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [state, setState] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const qc = useQueryClient();
  const { data: suburbs, isLoading } = useListSuburbs(
    { search: search || undefined, country_code: countryCode || undefined, state: state || undefined },
    { query: { queryKey: getListSuburbsQueryKey({ search: search || undefined, country_code: countryCode || undefined, state: state || undefined }) } }
  );

  const pagination = usePagination(suburbs ?? []);

  const deleteMutation = useDeleteSuburb({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSuburbsQueryKey() });
        setDeleteId(null);
      },
    },
  });

  return (
    <Layout>
      <PageHeader
        title={t("nav.suburb")}
        subtitle={`${suburbs?.length ?? 0} ${t("common.total")}`}
        actions={
          <Link href="/property/suburbs/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> {t("suburb.new") || `${t("common.new")} ${t("nav.suburb")}`}
            </Button>
          </Link>
        }
      />
      <div className="p-6">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t("suburb.search_placeholder") || t("common.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Select value={countryCode || "_all"} onValueChange={(v) => setCountryCode(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue placeholder={t("suburb.label_country") || "Country"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("suburb.all_countries") || "All Countries"}</SelectItem>
              <SelectItem value="AU">Australia</SelectItem>
              <SelectItem value="US">United States</SelectItem>
              <SelectItem value="GB">United Kingdom</SelectItem>
              <SelectItem value="NZ">New Zealand</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder={t("suburb.state_filter_placeholder") || "State filter..."}
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="w-32 h-8 text-sm"
          />
        </div>

        {/* Table */}
        <div className="rounded-md border bg-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("suburb.col_name")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("suburb.col_area")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("suburb.col_state")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("suburb.col_country")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("suburb.col_status")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("suburb.col_created")}</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">{t("common.loading")}</td>
                </tr>
              ) : suburbs?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">{t("suburb.no_records") || "No suburbs found"}</td>
                </tr>
              ) : (
                pagination.paginatedItems.map((suburb) => (
                  <tr key={suburb.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/property/suburbs/${suburb.id}`} className="hover:underline text-[#E8621A]">{suburb.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{suburb.area_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{suburb.state ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{suburb.country_code}</td>
                    <td className="px-4 py-3"><StatusBadge status={suburb.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {format(new Date(suburb.created_at), "dd MMM yyyy")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link href={`/property/suburbs/${suburb.id}`}>
                          <button className="p-1.5 rounded hover:bg-muted transition-colors">
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </Link>
                        <button
                          className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                          onClick={() => setDeleteId(suburb.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
        <TablePagination {...pagination} />
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("suburb.delete_title") || t("common.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("suburb.delete_desc") || t("common.cannot_undo")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

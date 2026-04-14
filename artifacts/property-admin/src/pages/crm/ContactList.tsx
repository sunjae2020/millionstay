import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useListContacts, useDeleteContact, getListContactsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, Globe, AlertTriangle } from "lucide-react";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiFetch";

export default function ContactList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SuperAdmin";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isPermanentDeleting, setIsPermanentDeleting] = useState(false);
  const qc = useQueryClient();

  const params = { search: search || undefined, status: statusFilter || undefined };
  const { data: contacts, isLoading } = useListContacts(params, {
    query: { queryKey: getListContactsQueryKey(params) },
  });

  const pagination = usePagination(contacts ?? []);

  const archiveMutation = useDeleteContact({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListContactsQueryKey() });
        setDeleteId(null);
      },
    },
  });

  const handlePermanentDelete = async () => {
    if (!deleteId) return;
    setIsPermanentDeleting(true);
    try {
      await apiFetch(`/api/v1/contacts/${deleteId}?permanent=true`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: getListContactsQueryKey() });
      setDeleteId(null);
    } finally {
      setIsPermanentDeleting(false);
    }
  };

  return (
    <Layout>
      <PageHeader
        title={t("nav.contact")}
        subtitle={`${contacts?.length ?? 0} ${t("common.total")}`}
        actions={
          <Link href="/crm/contacts/new">
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> {t("contact.new")}</Button>
          </Link>
        }
      />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder={t("contact.search_placeholder")} className="pl-8 h-8 text-sm" value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter || "__all"} onValueChange={(v) => setStatusFilter(v === "__all" ? "" : v)}>
            <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder={t("common.status")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">{t("contact.all_statuses")}</SelectItem>
              <SelectItem value="Active">{t("common.active")}</SelectItem>
              <SelectItem value="Inactive">{t("common.inactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("contact.col_name")}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("contact.col_email")}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("contact.col_mobile")}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("contact.col_nationality")}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("contact.col_portal")}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("contact.col_status")}</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pagination.paginatedItems.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/crm/contacts/${c.id}`} className="font-medium hover:underline">
                        {c.first_name} {c.last_name}
                      </Link>
                      {c.nationality && <span className="ml-1 text-xs text-muted-foreground">({c.nationality})</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.email}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.mobile_number ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.nationality ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {c.portal_enabled
                        ? <Badge variant="outline" className="gap-1 text-green-700 border-green-300"><Globe className="h-3 w-3" />{t("contact.portal_on")}</Badge>
                        : <span className="text-xs text-muted-foreground">{t("contact.portal_off")}</span>}
                    </td>
                    <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/crm/contacts/${c.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                        </Link>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!contacts || contacts.length === 0) && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{t("contact.no_contacts")}</td></tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}
        <TablePagination {...pagination} />
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {isSuperAdmin ? "Delete Contact" : "Archive Contact"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isSuperAdmin
                ? "Choose how to remove this contact. Archiving hides it from view but keeps the data. Permanent deletion cannot be undone."
                : "This contact will be archived and hidden from view. A Super Admin can restore it if needed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isSuperAdmin ? "flex-col sm:flex-row gap-2" : ""}>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={() => deleteId && archiveMutation.mutate({ id: deleteId })}
              disabled={archiveMutation.isPending}>
              Archive
            </Button>
            {isSuperAdmin && (
              <Button
                variant="destructive"
                onClick={handlePermanentDelete}
                disabled={isPermanentDeleting}>
                Delete Forever
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

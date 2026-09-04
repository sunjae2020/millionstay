import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  useDeleteContact,
  type ListContactsQueryResult,
} from "@workspace/api-client-react";
import { Plus, Search, Pencil, Trash2, Globe, AlertTriangle, User } from "lucide-react";
import { DataTable, useServerList, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiFetch";
import { formatPersonName, personSortKey, formatPersonLabel, formatPhone } from "@/lib/nameFormat";

type ContactRow = ListContactsQueryResult[number];

/** 서버가 정렬할 수 있는 컬럼(api-server routes/contacts.ts 의 CONTACT_SORT 와 1:1). */
const SORTABLE_KEYS = [
  "name", "email", "mobile_number", "nationality", "portal_enabled", "status",
  "created_at", "updated_at",
];

export default function ContactList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SuperAdmin";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isPermanentDeleting, setIsPermanentDeleting] = useState(false);

  const filters = {
    search: search || undefined,
    status: statusFilter || undefined,
    ...(showDeleted ? { deleted: "only" } : {}),
  };
  const { rows: contacts, total, isLoading, server, invalidate } = useServerList<ContactRow>(
    "/api/v1/contacts",
    { filters, sortableKeys: SORTABLE_KEYS, defaultSort: { key: "name", dir: "asc" } },
  );

  const archiveMutation = useDeleteContact({
    mutation: {
      onSuccess: () => {
        invalidate();
        setDeleteId(null);
      },
    },
  });

  const handlePermanentDelete = async () => {
    if (!deleteId) return;
    setIsPermanentDeleting(true);
    try {
      await apiFetch(`/api/v1/contacts/${deleteId}?permanent=true`, { method: "DELETE" });
      invalidate();
      setDeleteId(null);
    } finally {
      setIsPermanentDeleting(false);
    }
  };

  const columns: ColumnDef<ContactRow>[] = useMemo(
    () => [
      {
        key: "photo",
        header: "contact.col_photo",
        sortable: false,
        defaultWidth: 56,
        align: "center",
        cell: (c) => (
          <div className="mx-auto h-8 w-8 rounded-full border bg-muted/40 overflow-hidden flex items-center justify-center">
            {c.profile_photo_url
              ? <img src={c.profile_photo_url} alt="" className="h-full w-full object-cover" loading="lazy" />
              : <User className="h-4 w-4 text-muted-foreground" />}
          </div>
        ),
      },
      {
        key: "name",
        header: "contact.col_name",
        hideable: false,
        defaultWidth: 200,
        sortAccessor: (c) => personSortKey(c.first_name, c.last_name),
        cell: (c) => (
          <>
            {/* 임경임_010-5252-5232 — 한국식 이름은 공백 없이, 뒤에 휴대폰 번호. */}
            <Link href={`/crm/contacts/${c.id}`} className="font-medium hover:underline">
              {formatPersonLabel(c.first_name, c.last_name, c.mobile_number)}
            </Link>
            {c.nationality && <span className="ml-1 text-xs text-muted-foreground">({c.nationality})</span>}
          </>
        ),
      },
      {
        key: "email",
        header: "contact.col_email",
        editable: { type: "text", getValue: (c) => c.email ?? "" },
        cell: (c) => <span className="text-muted-foreground">{c.email}</span>,
      },
      {
        key: "mobile_number",
        header: "contact.col_mobile",
        editable: { type: "text", getValue: (c) => c.mobile_number ?? "" },
        cell: (c) => <span className="text-muted-foreground">{formatPhone(c.mobile_number) || "—"}</span>,
      },
      {
        key: "nationality",
        header: "contact.col_nationality",
        editable: { type: "text", getValue: (c) => c.nationality ?? "" },
        cell: (c) => <span className="text-muted-foreground">{c.nationality ?? "—"}</span>,
      },
      {
        key: "portal_enabled",
        header: "contact.col_portal",
        editable: { type: "boolean", getValue: (c) => !!c.portal_enabled },
        cell: (c) =>
          c.portal_enabled
            ? <Badge variant="outline" className="gap-1 text-green-700 border-green-300"><Globe className="h-3 w-3" />{t("contact.portal_on")}</Badge>
            : <span className="text-xs text-muted-foreground">{t("contact.portal_off")}</span>,
      },
      {
        key: "status",
        header: "contact.col_status",
        editable: {
          type: "select",
          getValue: (c) => c.status,
          options: [
            { value: "Active", label: t("common.active") },
            { value: "Inactive", label: t("common.inactive") },
          ],
        },
        cell: (c) => <StatusBadge status={c.status} />,
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        defaultWidth: 90,
        cell: (c) => (
          <div className="flex items-center justify-end gap-1">
            <Link href={`/crm/contacts/${c.id}`}>
              <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
            </Link>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
              onClick={() => setDeleteId(c.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [t],
  );

  return (
    <Layout>
      <PageHeader
        title={t("nav.contact")}
        subtitle={`${total} ${t("common.total")}`}
        actions={
          <Link href="/crm/contacts/new">
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> {t("contact.new")}</Button>
          </Link>
        }
      />
      <div className="p-6">
        <DataTable
          tableKey="contacts"
          columns={columns}
          data={contacts}
          server={server}
          isLoading={isLoading}
          rowKey={(c) => c.id}
          defaultSort={{ key: "name", dir: "asc" }}
          emptyText={t("contact.no_contacts")}
          selection={{
            enable: true,
            resource: "contacts",
            onChanged: () => invalidate(),
          }}
          editing={{ resource: "contacts", onEdited: () => invalidate() }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
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
          }
        />
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {isSuperAdmin ? t("common.del_dialog_title_delete", { entity: t("nav.contact") }) : t("common.del_dialog_title_archive", { entity: t("nav.contact") })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isSuperAdmin
                ? t("common.del_dialog_desc_super")
                : t("common.del_dialog_desc_plain")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isSuperAdmin ? "flex-col sm:flex-row gap-2" : ""}>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={() => deleteId && archiveMutation.mutate({ id: deleteId })}
              disabled={archiveMutation.isPending}>
              {t("common.archive")}
            </Button>
            {isSuperAdmin && (
              <Button
                variant="destructive"
                onClick={handlePermanentDelete}
                disabled={isPermanentDeleting}>
                {t("common.delete_forever")}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Trash2, Shield, User, Check, X, Clock, Loader2, RefreshCw, AlertTriangle, Archive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AdminUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  status: string;
  last_login_at: string | null;
  created_at: string;
}

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

function statusBadge(status: string, t: TFunc) {
  if (status === "pending") return (
    <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 gap-1">
      <Clock className="h-3 w-3" /> {t("settings_users.status_pending")}
    </Badge>
  );
  if (status === "rejected") return (
    <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50 gap-1">
      <X className="h-3 w-3" /> {t("settings_users.status_rejected")}
    </Badge>
  );
  return (
    <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 gap-1">
      <Check className="h-3 w-3" /> {t("common.active")}
    </Badge>
  );
}

function roleBadge(role: string, t: TFunc) {
  if (role === "SuperAdmin") return <Badge variant="destructive">{t("settings_users.role_superadmin")}</Badge>;
  if (role === "Admin") return <Badge>{t("settings_users.role_admin")}</Badge>;
  if (role === "Viewer") return <Badge variant="secondary">{t("settings_users.role_viewer")}</Badge>;
  return <Badge variant="secondary">{role}</Badge>;
}

export function UserManagement() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === "SuperAdmin";
  const qc = useQueryClient();
  const [actionLoading, setActionLoading] = useState<Record<number, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [isPermanentDeleting, setIsPermanentDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"archive" | "permanent" | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<{ success: boolean; users: AdminUser[] }>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/admin/users");
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
  });

  const users = data?.users ?? [];
  const pendingUsers = users.filter(u => u.status === "pending");
  const activeUsers = users.filter(u => u.status !== "pending");

  const selectableUsers = activeUsers.filter(u => u.id !== currentUser?.id && u.role !== "SuperAdmin");
  const allSelected = selectableUsers.length > 0 && selectableUsers.every(u => selectedIds.has(u.id));
  const someSelected = selectableUsers.some(u => selectedIds.has(u.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(prev => { const n = new Set(prev); selectableUsers.forEach(u => n.delete(u.id)); return n; });
    } else {
      setSelectedIds(prev => { const n = new Set(prev); selectableUsers.forEach(u => n.add(u.id)); return n; });
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const clearSelection = () => setSelectedIds(new Set());

  async function updateUser(id: number, payload: object, action: string) {
    setActionLoading(prev => ({ ...prev, [id]: action }));
    try {
      const res = await apiFetch(`/api/v1/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: action === "approve" ? t("settings_users.toast_user_approved") : action === "reject" ? t("settings_users.toast_user_rejected") : t("settings_users.toast_user_updated") });
    } catch (err: any) {
      toast({ title: t("settings_users.toast_error"), description: err.message ?? t("settings_users.toast_action_failed"), variant: "destructive" });
    } finally {
      setActionLoading(prev => { const n = { ...prev }; delete n[id]; return n; });
    }
  }

  async function archiveUser(id: number) {
    setActionLoading(prev => ({ ...prev, [id]: "delete" }));
    setDeleteTarget(null);
    try {
      const res = await apiFetch(`/api/v1/admin/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: t("settings_users.toast_user_archived"), description: t("settings_users.toast_user_archived_desc") });
    } catch (err: any) {
      toast({ title: t("settings_users.toast_error"), description: err.message ?? t("settings_users.toast_archive_failed"), variant: "destructive" });
    } finally {
      setActionLoading(prev => { const n = { ...prev }; delete n[id]; return n; });
    }
  }

  async function permanentDeleteUser(id: number) {
    setIsPermanentDeleting(true);
    setDeleteTarget(null);
    try {
      const res = await apiFetch(`/api/v1/admin/users/${id}?permanent=true`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: t("settings_users.toast_user_deleted"), description: t("settings_users.toast_user_deleted_desc") });
    } catch (err: any) {
      toast({ title: t("settings_users.toast_error"), description: err.message ?? t("settings_users.toast_delete_failed"), variant: "destructive" });
    } finally {
      setIsPermanentDeleting(false);
    }
  }

  const handleBulkDelete = async (permanent: boolean) => {
    setIsBulkLoading(true);
    setBulkAction(null);
    try {
      const res = await apiFetch("/api/v1/admin/users/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), permanent }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? t("settings_users.toast_bulk_delete_failed"));
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: permanent ? t("settings_users.toast_bulk_deleted", { count: data.affected }) : t("settings_users.toast_bulk_archived", { count: data.affected }) });
      clearSelection();
    } catch (err: any) {
      toast({ title: t("settings_users.toast_error"), description: err.message, variant: "destructive" });
    } finally {
      setIsBulkLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> {t("settings_users.loading_users")}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-sm text-muted-foreground">{t("settings_users.load_failed")}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> {t("settings_users.retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Pending Requests ────────────────────────────── */}
      {pendingUsers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{t("settings_users.access_requests_title")}</h3>
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
              {t("settings_users.pending_count", { count: pendingUsers.length })}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{t("settings_users.access_requests_desc")}</p>

          <div className="rounded-lg border border-amber-200 divide-y divide-amber-100 bg-amber-50/30">
            {pendingUsers.map(user => (
              <div key={user.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <User className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{user.first_name} {user.last_name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(user.status, t)}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-red-600 border-red-200 hover:bg-red-50"
                    disabled={!!actionLoading[user.id]}
                    onClick={() => updateUser(user.id, { status: "rejected" }, "reject")}
                  >
                    {actionLoading[user.id] === "reject"
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <X className="h-3.5 w-3.5" />
                    }
                    {t("common.reject")}
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 gap-1 bg-green-600 hover:bg-green-700"
                    disabled={!!actionLoading[user.id]}
                    onClick={() => updateUser(user.id, { status: "active" }, "approve")}
                  >
                    {actionLoading[user.id] === "approve"
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Check className="h-3.5 w-3.5" />
                    }
                    {t("common.approve")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Active Users ─────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">{t("settings_users.admin_accounts_title")}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{t("settings_users.admin_accounts_count", { count: activeUsers.length })}</p>
          </div>
          <div className="flex items-center gap-2">
            {isSuperAdmin && selectableUsers.length > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Checkbox
                  checked={allSelected}
                  data-state={someSelected && !allSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
                  onCheckedChange={toggleSelectAll}
                  aria-label={t("settings_users.select_all_aria")}
                />
                <span className="text-xs">{t("settings_users.select_all")}</span>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isSuperAdmin && selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-orange-50 border border-orange-200">
            <span className="text-sm font-medium text-orange-800">{t("settings_users.selected_count", { count: selectedIds.size })}</span>
            <button onClick={clearSelection} className="text-orange-500 hover:text-orange-700">
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="ml-auto flex items-center gap-2">
              {isBulkLoading && <Loader2 className="h-4 w-4 animate-spin text-orange-500" />}
              <Button size="sm" variant="outline" className="h-7 border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5"
                onClick={() => setBulkAction("archive")} disabled={isBulkLoading}>
                <Archive className="h-3.5 w-3.5" /> {t("settings_users.archive_selected")}
              </Button>
              <Button size="sm" variant="destructive" className="h-7 gap-1.5"
                onClick={() => setBulkAction("permanent")} disabled={isBulkLoading}>
                <Trash2 className="h-3.5 w-3.5" /> {t("settings_users.delete_forever")}
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-lg border divide-y">
          {activeUsers.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("settings_users.no_active_users")}</div>
          ) : (
            activeUsers.map(user => {
              const isSelectable = isSuperAdmin && user.id !== currentUser?.id && user.role !== "SuperAdmin";
              return (
                <div key={user.id} className={`flex items-center justify-between px-4 py-3 ${selectedIds.has(user.id) ? "bg-orange-50/50" : ""}`}>
                  <div className="flex items-center gap-3">
                    {isSuperAdmin && (
                      <div className="w-5">
                        {isSelectable && (
                          <Checkbox
                            checked={selectedIds.has(user.id)}
                            onCheckedChange={() => toggleSelect(user.id)}
                            aria-label={t("settings_users.select_user_aria", { name: `${user.first_name} ${user.last_name}` })}
                          />
                        )}
                      </div>
                    )}
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      {user.role === "SuperAdmin" ? (
                        <Shield className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {user.first_name} {user.last_name}
                        {!user.first_name && !user.last_name && <span className="text-muted-foreground">—</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {roleBadge(user.role, t)}
                    {statusBadge(user.status, t)}
                    {user.id !== currentUser?.id && user.role !== "SuperAdmin" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        disabled={!!actionLoading[user.id]}
                        onClick={() => setDeleteTarget(user)}
                      >
                        {actionLoading[user.id] === "delete" || (isPermanentDeleting && deleteTarget?.id === user.id)
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />
                        }
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">{t("settings_users.role_descriptions_title")}</h3>
        <div className="mt-3 space-y-2 text-sm">
          {[
            { role: "SuperAdmin", desc: t("settings_users.role_superadmin_desc") },
            { role: "Admin", desc: t("settings_users.role_admin_desc") },
            { role: "Viewer", desc: t("settings_users.role_viewer_desc") },
          ].map(({ role, desc }) => (
            <div key={role} className="flex items-start gap-2">
              {roleBadge(role, t)}
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Single Delete Dialog ─────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {isSuperAdmin ? t("settings_users.remove_user_title") : t("settings_users.archive_user_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <span>
                  <strong>{deleteTarget.first_name} {deleteTarget.last_name}</strong> ({deleteTarget.email})
                  {isSuperAdmin
                    ? t("settings_users.remove_user_desc_superadmin")
                    : t("settings_users.remove_user_desc_admin")}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isSuperAdmin ? "flex-col sm:flex-row gap-2" : ""}>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={() => deleteTarget && archiveUser(deleteTarget.id)}>
              {t("settings_users.archive")}
            </Button>
            {isSuperAdmin && (
              <Button
                variant="destructive"
                onClick={() => deleteTarget && permanentDeleteUser(deleteTarget.id)}
                disabled={isPermanentDeleting}>
                {t("settings_users.delete_forever")}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Bulk Delete Dialog ─────────────────────────────────── */}
      <AlertDialog open={bulkAction !== null} onOpenChange={(o) => !o && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {bulkAction === "permanent" ? t("settings_users.bulk_delete_title") : t("settings_users.bulk_archive_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "permanent"
                ? t("settings_users.bulk_delete_desc", { count: selectedIds.size })
                : t("settings_users.bulk_archive_desc", { count: selectedIds.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button
              variant={bulkAction === "permanent" ? "destructive" : "outline"}
              className={bulkAction !== "permanent" ? "border-amber-300 text-amber-700 hover:bg-amber-50" : ""}
              onClick={() => handleBulkDelete(bulkAction === "permanent")}>
              {bulkAction === "permanent" ? t("settings_users.delete_forever") : t("settings_users.archive_all")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

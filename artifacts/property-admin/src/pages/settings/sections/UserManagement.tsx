import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Trash2, Shield, User, Check, X, Clock, Loader2, RefreshCw, AlertTriangle, Archive, Search, RotateCcw, Ban, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatPersonName } from "@/lib/nameFormat";

interface AdminUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  status: string;
  deleted_at?: string | null;
  last_login_at: string | null;
  created_at: string;
}

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

type StatusFilter = "all" | "active" | "inactive" | "pending" | "rejected" | "archived";

function statusBadge(user: AdminUser, t: TFunc) {
  const status = user.status;
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
  if (status === "archived" || user.deleted_at) return (
    <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 bg-muted gap-1">
      <Archive className="h-3 w-3" /> {t("settings_users.status_archived")}
    </Badge>
  );
  if (!user.is_active) return (
    <Badge variant="outline" className="text-slate-600 border-slate-300 bg-slate-50 gap-1">
      <Ban className="h-3 w-3" /> {t("settings_users.status_inactive")}
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
  const isViewer = currentUser?.role === "Viewer";
  const qc = useQueryClient();
  const [actionLoading, setActionLoading] = useState<Record<number, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [isPermanentDeleting, setIsPermanentDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"archive" | "permanent" | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const showArchived = statusFilter === "archived";
  const [isRestoring, setIsRestoring] = useState(false);

  const emptyEditForm = { first_name: "", last_name: "", email: "", role: "Admin", is_active: true, password: "" };
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [isSaving, setIsSaving] = useState(false);

  const emptyForm = { first_name: "", last_name: "", email: "", password: "", role: "Admin" };
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [isCreating, setIsCreating] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<{ success: boolean; users: AdminUser[] }>({
    queryKey: ["admin-users", showArchived ? "archived" : "current"],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/admin/users${showArchived ? "?deleted=only" : ""}`);
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
  });

  const allUsers = data?.users ?? [];
  const q = search.trim().toLowerCase();
  const matchesSearch = (u: AdminUser) =>
    !q || `${u.first_name ?? ""} ${u.last_name ?? ""} ${u.email ?? ""}`.toLowerCase().includes(q);
  const matchesStatus = (u: AdminUser) => {
    const decided = u.status !== "pending" && u.status !== "rejected";
    switch (statusFilter) {
      case "active": return decided && u.is_active;
      case "inactive": return decided && !u.is_active;
      case "pending": return u.status === "pending";
      case "rejected": return u.status === "rejected";
      default: return true; // "all" and "archived" (the query is already scoped)
    }
  };
  const users = allUsers.filter(u => matchesSearch(u) && matchesStatus(u));
  const pendingUsers = users.filter(u => u.status === "pending");
  const activeUsers = users.filter(u => u.status !== "pending");
  const isFiltered = q.length > 0 || statusFilter !== "all";

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

  function openEdit(u: AdminUser) {
    setEditForm({
      first_name: u.first_name ?? "",
      last_name: u.last_name ?? "",
      email: u.email ?? "",
      role: u.role,
      is_active: u.is_active,
      password: "",
    });
    setEditTarget(u);
  }

  async function saveEdit() {
    if (!editTarget) return;
    // Names go to every write-capable admin; the privileged fields are only
    // sent when they actually changed, so a plain Admin's save never 403s.
    const payload: Record<string, unknown> = {
      first_name: editForm.first_name.trim(),
      last_name: editForm.last_name.trim(),
    };
    if (isSuperAdmin) {
      const email = editForm.email.trim().toLowerCase();
      if (email !== (editTarget.email ?? "").toLowerCase()) payload.email = email;
      if (editForm.role !== editTarget.role) payload.role = editForm.role;
      if (editForm.is_active !== editTarget.is_active) payload.is_active = editForm.is_active;
      if (editForm.password.trim()) payload.password = editForm.password;
    }
    setIsSaving(true);
    try {
      const res = await apiFetch(`/api/v1/admin/users/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? t("settings_users.toast_action_failed"));
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: t("settings_users.toast_user_updated") });
      setEditTarget(null);
    } catch (err: any) {
      toast({ title: t("settings_users.toast_error"), description: err.message ?? t("settings_users.toast_action_failed"), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  async function createUser() {
    setIsCreating(true);
    try {
      const res = await apiFetch("/api/v1/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? t("settings_users.toast_create_failed"));
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: t("settings_users.toast_user_created"), description: t("settings_users.toast_user_created_desc") });
      setCreateOpen(false);
      setCreateForm(emptyForm);
    } catch (err: any) {
      toast({ title: t("settings_users.toast_error"), description: err.message ?? t("settings_users.toast_create_failed"), variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  }

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

  async function restoreUsers(ids: number[]) {
    setIsRestoring(true);
    try {
      const res = await apiFetch("/api/v1/admin/users/bulk-restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? t("settings_users.toast_restore_failed"));
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: t("settings_users.toast_users_restored", { count: data.affected }) });
      clearSelection();
    } catch (err: any) {
      toast({ title: t("settings_users.toast_error"), description: err.message ?? t("settings_users.toast_restore_failed"), variant: "destructive" });
    } finally {
      setIsRestoring(false);
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
                    <p className="text-sm font-medium">{formatPersonName(user.first_name, user.last_name)}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(user, t)}
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
            <h3 className="text-base font-semibold">
              {showArchived ? t("settings_users.archived_accounts_title") : t("settings_users.admin_accounts_title")}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isFiltered
                ? t("settings_users.showing_count", { count: activeUsers.length, total: allUsers.filter(u => u.status !== "pending").length })
                : t("settings_users.admin_accounts_count", { count: activeUsers.length })}
            </p>
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
            <Button
              size="sm"
              className="gap-1.5"
              disabled={!isSuperAdmin}
              title={isSuperAdmin ? undefined : t("settings_users.superadmin_only")}
              onClick={() => { setCreateForm(emptyForm); setCreateOpen(true); }}
            >
              <UserPlus className="h-4 w-4" /> {t("settings_users.add_user")}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("settings_users.search_placeholder")}
              className="pl-8 pr-8"
              aria-label={t("settings_users.search_placeholder")}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={t("common.clear")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => { setStatusFilter(v as StatusFilter); clearSelection(); }}
          >
            <SelectTrigger className="sm:w-44" aria-label={t("settings_users.filter_status")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("settings_users.filter_all")}</SelectItem>
              <SelectItem value="active">{t("common.active")}</SelectItem>
              <SelectItem value="inactive">{t("settings_users.status_inactive")}</SelectItem>
              <SelectItem value="pending">{t("settings_users.status_pending")}</SelectItem>
              <SelectItem value="rejected">{t("settings_users.status_rejected")}</SelectItem>
              <SelectItem value="archived">{t("settings_users.status_archived")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isSuperAdmin && selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20">
            <span className="text-sm font-medium text-primary">{t("settings_users.selected_count", { count: selectedIds.size })}</span>
            <button onClick={clearSelection} className="text-primary hover:text-primary">
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="ml-auto flex items-center gap-2">
              {(isBulkLoading || isRestoring) && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {showArchived ? (
                <Button size="sm" variant="outline" className="h-7 gap-1.5"
                  onClick={() => restoreUsers(Array.from(selectedIds))} disabled={isRestoring || isBulkLoading}>
                  <RotateCcw className="h-3.5 w-3.5" /> {t("settings_users.restore_selected")}
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="h-7 border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5"
                  onClick={() => setBulkAction("archive")} disabled={isBulkLoading}>
                  <Archive className="h-3.5 w-3.5" /> {t("settings_users.archive_selected")}
                </Button>
              )}
              <Button size="sm" variant="destructive" className="h-7 gap-1.5"
                onClick={() => setBulkAction("permanent")} disabled={isBulkLoading}>
                <Trash2 className="h-3.5 w-3.5" /> {t("settings_users.delete_forever")}
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-lg border divide-y">
          {activeUsers.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {isFiltered ? t("settings_users.no_matching_users") : t("settings_users.no_active_users")}
            </div>
          ) : (
            activeUsers.map(user => {
              const isSelectable = isSuperAdmin && user.id !== currentUser?.id && user.role !== "SuperAdmin";
              return (
                <div key={user.id} className={`flex items-center justify-between px-4 py-3 ${selectedIds.has(user.id) ? "bg-primary/5" : ""}`}>
                  <div className="flex items-center gap-3">
                    {isSuperAdmin && (
                      <div className="w-5">
                        {isSelectable && (
                          <Checkbox
                            checked={selectedIds.has(user.id)}
                            onCheckedChange={() => toggleSelect(user.id)}
                            aria-label={t("settings_users.select_user_aria", { name: formatPersonName(user.first_name, user.last_name) })}
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
                        {formatPersonName(user.first_name, user.last_name)}
                        {!user.first_name && !user.last_name && <span className="text-muted-foreground">—</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {roleBadge(user.role, t)}
                    {statusBadge(user, t)}
                    {showArchived && isSuperAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5"
                        disabled={isRestoring}
                        onClick={() => restoreUsers([user.id])}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> {t("settings_users.restore")}
                      </Button>
                    )}
                    {!showArchived && !isViewer && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title={t("common.edit")}
                        aria-label={t("common.edit")}
                        onClick={() => openEdit(user)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {!showArchived && user.id !== currentUser?.id && user.role !== "SuperAdmin" && (
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
                  <strong>{formatPersonName(deleteTarget.first_name, deleteTarget.last_name)}</strong> ({deleteTarget.email})
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

      {/* ── Edit User Dialog ───────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o && !isSaving) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" /> {t("settings_users.edit_user_title")}
            </DialogTitle>
            <DialogDescription>
              {isSuperAdmin ? t("settings_users.edit_user_desc") : t("settings_users.edit_user_desc_admin")}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!isSaving) saveEdit(); }}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="eu-first">{t("settings_users.field_first_name")}</Label>
                <Input id="eu-first" value={editForm.first_name}
                  onChange={(e) => setEditForm(f => ({ ...f, first_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eu-last">{t("settings_users.field_last_name")}</Label>
                <Input id="eu-last" value={editForm.last_name}
                  onChange={(e) => setEditForm(f => ({ ...f, last_name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eu-email">{t("settings_users.field_email")}</Label>
              <Input id="eu-email" type="email" value={editForm.email} disabled={!isSuperAdmin}
                onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eu-role">{t("settings_users.field_role")}</Label>
              <Select
                value={editForm.role}
                disabled={!isSuperAdmin || editTarget?.id === currentUser?.id}
                onValueChange={(v) => setEditForm(f => ({ ...f, role: v }))}
              >
                <SelectTrigger id="eu-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">{t("settings_users.role_admin")}</SelectItem>
                  <SelectItem value="Viewer">{t("settings_users.role_viewer")}</SelectItem>
                  <SelectItem value="SuperAdmin">{t("settings_users.role_superadmin")}</SelectItem>
                </SelectContent>
              </Select>
              {editTarget?.id === currentUser?.id && (
                <p className="text-xs text-muted-foreground">{t("settings_users.self_edit_hint")}</p>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div>
                <Label htmlFor="eu-active" className="text-sm">{t("settings_users.field_is_active")}</Label>
                <p className="text-xs text-muted-foreground">{t("settings_users.field_is_active_hint")}</p>
              </div>
              <Switch
                id="eu-active"
                checked={editForm.is_active}
                disabled={!isSuperAdmin || editTarget?.id === currentUser?.id}
                onCheckedChange={(v) => setEditForm(f => ({ ...f, is_active: v }))}
              />
            </div>
            {isSuperAdmin && (
              <div className="space-y-1.5">
                <Label htmlFor="eu-password">{t("settings_users.field_reset_password")}</Label>
                <Input id="eu-password" type="text" autoComplete="off" value={editForm.password}
                  placeholder={t("settings_users.field_reset_password_ph")}
                  onChange={(e) => setEditForm(f => ({ ...f, password: e.target.value }))} />
                <p className="text-xs text-muted-foreground">{t("settings_users.field_reset_password_hint")}</p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)} disabled={isSaving}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isSaving} className="gap-1.5">
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Create User Dialog ─────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!isCreating) setCreateOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> {t("settings_users.add_user_title")}
            </DialogTitle>
            <DialogDescription>{t("settings_users.add_user_desc")}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); if (!isCreating) createUser(); }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cu-first">{t("settings_users.field_first_name")}</Label>
                <Input id="cu-first" value={createForm.first_name} required
                  onChange={(e) => setCreateForm(f => ({ ...f, first_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cu-last">{t("settings_users.field_last_name")}</Label>
                <Input id="cu-last" value={createForm.last_name} required
                  onChange={(e) => setCreateForm(f => ({ ...f, last_name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-email">{t("settings_users.field_email")}</Label>
              <Input id="cu-email" type="email" value={createForm.email} required
                onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-password">{t("settings_users.field_temp_password")}</Label>
              <Input id="cu-password" type="text" value={createForm.password} required autoComplete="off"
                onChange={(e) => setCreateForm(f => ({ ...f, password: e.target.value }))} />
              <p className="text-xs text-muted-foreground">{t("settings_users.field_temp_password_hint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-role">{t("settings_users.field_role")}</Label>
              <Select value={createForm.role} onValueChange={(v) => setCreateForm(f => ({ ...f, role: v }))}>
                <SelectTrigger id="cu-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">{t("settings_users.role_admin")}</SelectItem>
                  <SelectItem value="Viewer">{t("settings_users.role_viewer")}</SelectItem>
                  <SelectItem value="SuperAdmin">{t("settings_users.role_superadmin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={isCreating}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isCreating} className="gap-1.5">
                {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("settings_users.create_user")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

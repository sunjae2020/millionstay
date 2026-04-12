import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UserPlus, Trash2, Shield, User, Check, X, Clock, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";

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

function statusBadge(status: string) {
  if (status === "pending") return (
    <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 gap-1">
      <Clock className="h-3 w-3" /> Pending
    </Badge>
  );
  if (status === "rejected") return (
    <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50 gap-1">
      <X className="h-3 w-3" /> Rejected
    </Badge>
  );
  return (
    <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 gap-1">
      <Check className="h-3 w-3" /> Active
    </Badge>
  );
}

function roleBadge(role: string) {
  if (role === "SuperAdmin") return <Badge variant="destructive">Super Admin</Badge>;
  if (role === "Admin") return <Badge>Admin</Badge>;
  return <Badge variant="secondary">{role}</Badge>;
}

export function UserManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [actionLoading, setActionLoading] = useState<Record<number, string>>({});

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
      toast({ title: action === "approve" ? "User approved" : action === "reject" ? "User rejected" : "User updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "Action failed", variant: "destructive" });
    } finally {
      setActionLoading(prev => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    }
  }

  async function deleteUser(id: number) {
    if (!confirm("Remove this user? This cannot be undone.")) return;
    setActionLoading(prev => ({ ...prev, [id]: "delete" }));
    try {
      const res = await apiFetch(`/api/v1/admin/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "User removed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "Delete failed", variant: "destructive" });
    } finally {
      setActionLoading(prev => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading users…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-sm text-muted-foreground">Failed to load users.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Retry
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
            <h3 className="text-base font-semibold">Access Requests</h3>
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
              {pendingUsers.length} pending
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">These users have requested admin access and are awaiting approval.</p>

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
                  {statusBadge(user.status)}
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
                    Reject
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
                    Approve
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
            <h3 className="text-base font-semibold">Admin Accounts</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{activeUsers.length} user{activeUsers.length !== 1 ? "s" : ""} with admin access</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="rounded-lg border divide-y">
          {activeUsers.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No active users found.</div>
          ) : (
            activeUsers.map(user => (
              <div key={user.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
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
                  {roleBadge(user.role)}
                  {statusBadge(user.status)}
                  {user.role !== "SuperAdmin" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      disabled={!!actionLoading[user.id]}
                      onClick={() => deleteUser(user.id)}
                    >
                      {actionLoading[user.id] === "delete"
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />
                      }
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">Role Descriptions</h3>
        <div className="mt-3 space-y-2 text-sm">
          {[
            { role: "SuperAdmin", label: "Super Admin", desc: "Full access to all features including system settings and user management" },
            { role: "Admin", label: "Admin", desc: "Read and write access to all data, limited settings access" },
            { role: "Viewer", label: "Viewer", desc: "Read-only access across all modules" },
          ].map(({ role, label, desc }) => (
            <div key={role} className="flex items-start gap-2">
              {roleBadge(role)}
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

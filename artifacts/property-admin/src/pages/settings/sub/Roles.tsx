import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { apiJson } from "@/lib/apiFetch";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Plus, Trash2, Lock } from "lucide-react";

type Level = "none" | "read" | "write";
type Role = { id: number; name: string; description: string | null; is_system: boolean; permissions: Record<string, Level> };

const LEVELS: Level[] = ["none", "read", "write"];
const LEVEL_STYLE: Record<Level, string> = {
  none: "bg-gray-100 text-gray-500",
  read: "bg-blue-50 text-blue-700",
  write: "bg-green-50 text-green-700",
};

export default function RolesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { user } = useAuth() as any;
  const isSuper = user?.role === "SuperAdmin";

  const { data } = useQuery<{ data: Role[]; resources: string[] }>({
    queryKey: ["roles"],
    queryFn: () => apiJson("/api/v1/roles"),
  });
  const roles = data?.data ?? [];
  const resources = data?.resources ?? [];

  const patchMut = useMutation({
    mutationFn: (args: { id: number; permissions?: Record<string, Level>; description?: string }) =>
      apiJson(`/api/v1/roles/${args.id}`, { method: "PATCH", body: JSON.stringify(args) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roles"] }),
  });
  const createMut = useMutation({
    mutationFn: (body: { name: string; permissions: Record<string, Level> }) =>
      apiJson("/api/v1/roles", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { setCreating(false); setNewName(""); qc.invalidateQueries({ queryKey: ["roles"] }); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => apiJson(`/api/v1/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roles"] }),
  });

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  function setPerm(role: Role, resource: string, level: Level) {
    if (!isSuper) return;
    patchMut.mutate({ id: role.id, permissions: { ...role.permissions, [resource]: level } });
  }

  return (
    <Layout>
      <PageHeader
        title={<><ShieldCheck className="h-5 w-5" />{t("settings_roles.title", "Roles & Permissions")}</>}
        subtitle={t("settings_roles.subtitle", "Define what each role can read or modify. Write includes read.")}
      />
      <div className="px-8 py-6 space-y-6">
        {!isSuper && (
          <div className="rounded-lg border bg-amber-50 text-amber-800 text-sm px-4 py-2 flex items-center gap-2">
            <Lock className="h-4 w-4" /> {t("settings_roles.read_only_notice", "Only a SuperAdmin can edit the permission matrix.")}
          </div>
        )}

        {roles.map((role) => (
          <div key={role.id} className="rounded-lg border bg-white overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{role.name}</span>
                  {role.is_system && <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">{t("settings_roles.system", "system")}</span>}
                </div>
                {role.description && <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>}
              </div>
              {isSuper && !role.is_system && (
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => { if (confirm(t("settings_roles.confirm_delete", "Delete this role?"))) deleteMut.mutate(role.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {resources.map((res) => {
                    const level = (role.permissions?.[res] ?? "none") as Level;
                    const locked = role.name === "SuperAdmin"; // SuperAdmin always full
                    return (
                      <tr key={res} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium text-gray-700 capitalize">{t(`settings_roles.res_${res}`, res)}</td>
                        <td className="py-2">
                          <div className="flex gap-1">
                            {LEVELS.map((lv) => (
                              <button
                                key={lv}
                                disabled={!isSuper || locked}
                                onClick={() => setPerm(role, res, lv)}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${level === lv ? LEVEL_STYLE[lv] : "bg-transparent text-gray-400 hover:bg-gray-100"} ${(!isSuper || locked) ? "cursor-default opacity-70" : ""}`}
                              >
                                {t(`settings_roles.level_${lv}`, lv)}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {isSuper && (
          creating ? (
            <div className="rounded-lg border bg-white p-4 flex gap-2 items-end">
              <label className="text-sm flex-1 max-w-xs">
                <span className="block text-xs text-muted-foreground mb-1">{t("settings_roles.new_role_name", "New role name")}</span>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} className="border rounded px-2 py-1.5 text-sm w-full" placeholder={t("settings_roles.new_role_name_placeholder", "e.g. Finance")} />
              </label>
              <Button size="sm" disabled={!newName.trim() || createMut.isPending} onClick={() => createMut.mutate({ name: newName.trim(), permissions: Object.fromEntries(resources.map((r) => [r, "read"])) as Record<string, Level> })}>
                {t("common.create", "Create")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>{t("common.cancel", "Cancel")}</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5 mr-1" /> {t("settings_roles.add_role", "Add role")}</Button>
          )
        )}
      </div>
    </Layout>
  );
}

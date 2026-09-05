import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, Plus, Trash2, Users } from "lucide-react";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";

/**
 * 지점·팀 관리 + 회계 접근 범위 스위치.
 *
 * 지점이 여러 개인 운영에서 "다른 지점 장부가 다 보인다"는 것은 사고다. 여기서
 * 조직을 세우고, 직원 소속을 채운 **뒤에** 스위치를 켠다 — 순서를 바꾸면 아무도
 * 아무것도 못 본다.
 */

interface Branch {
  id: number; name: string; code: string | null; is_headquarters: boolean;
  address: string | null; phone: string | null; is_active: boolean;
  team_count: number; staff_count: number;
}
interface Team {
  id: number; branch_id: number; branch_name: string | null; name: string;
  code: string | null; is_active: boolean; staff_count: number;
}

export default function OrgUnitsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [branchOpen, setBranchOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [branchForm, setBranchForm] = useState({ name: "", code: "", is_headquarters: false, address: "", phone: "" });
  const [teamForm, setTeamForm] = useState({ branch_id: "", name: "", code: "" });

  const { data: branches, isLoading: bLoading } = useQuery<{ data: Branch[] }>({
    queryKey: ["branches"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/branches");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
  const { data: teams, isLoading: tLoading } = useQuery<{ data: Team[] }>({
    queryKey: ["teams"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/teams");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
  const { data: scope } = useQuery<{ data: { enabled: boolean; viewer: { unrestricted: boolean } } }>({
    queryKey: ["class-scope"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/accounting/class-scope");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["branches"] });
    qc.invalidateQueries({ queryKey: ["teams"] });
    qc.invalidateQueries({ queryKey: ["class-scope"] });
  };

  const mutate = (path: string, method: string) =>
    async (body?: unknown) => {
      const res = await apiFetch(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
      if (res.status === 204) return null;
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed");
      return payload;
    };

  const onError = (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" });

  const createBranch = useMutation({
    mutationFn: () => mutate("/api/v1/branches", "POST")({
      name: branchForm.name,
      code: branchForm.code || null,
      is_headquarters: branchForm.is_headquarters,
      address: branchForm.address || null,
      phone: branchForm.phone || null,
    }),
    onSuccess: () => { invalidate(); setBranchOpen(false); setBranchForm({ name: "", code: "", is_headquarters: false, address: "", phone: "" }); },
    onError,
  });
  const createTeam = useMutation({
    mutationFn: () => mutate("/api/v1/teams", "POST")({
      branch_id: Number(teamForm.branch_id), name: teamForm.name, code: teamForm.code || null,
    }),
    onSuccess: () => { invalidate(); setTeamOpen(false); setTeamForm({ branch_id: "", name: "", code: "" }); },
    onError,
  });
  const removeBranch = useMutation({ mutationFn: (id: number) => mutate(`/api/v1/branches/${id}`, "DELETE")(), onSuccess: invalidate, onError });
  const removeTeam = useMutation({ mutationFn: (id: number) => mutate(`/api/v1/teams/${id}`, "DELETE")(), onSuccess: invalidate, onError });
  const toggleScope = useMutation({
    mutationFn: (enabled: boolean) => mutate("/api/v1/accounting/class-scope", "PUT")({ enabled }),
    onSuccess: () => { invalidate(); toast({ title: t("common.saved") }); },
    onError,
  });

  const branchCols: ColumnDef<Branch>[] = useMemo(() => [
    {
      key: "name", header: "org_units.col_branch", hideable: false,
      cell: (b) => (
        <span className="flex items-center gap-1.5 font-medium">
          {b.name}
          {b.is_headquarters && <Badge variant="secondary">{t("org_units.hq")}</Badge>}
        </span>
      ),
    },
    { key: "code", header: "org_units.col_code", cell: (b) => <span className="text-muted-foreground">{b.code ?? "—"}</span> },
    { key: "team_count", header: "org_units.col_teams", align: "right", cell: (b) => <span className="tabular-nums">{b.team_count}</span> },
    { key: "staff_count", header: "org_units.col_staff", align: "right", cell: (b) => <span className="tabular-nums">{b.staff_count}</span> },
    {
      key: ACTIONS_KEY, header: "common.actions", hideable: false,
      cell: (b) => (
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
          onClick={() => removeBranch.mutate(b.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ], [t, removeBranch]);

  const teamCols: ColumnDef<Team>[] = useMemo(() => [
    { key: "name", header: "org_units.col_team", hideable: false, cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "branch_name", header: "org_units.col_branch", cell: (r) => <span className="text-muted-foreground">{r.branch_name ?? "—"}</span> },
    { key: "code", header: "org_units.col_code", cell: (r) => <span className="text-muted-foreground">{r.code ?? "—"}</span> },
    { key: "staff_count", header: "org_units.col_staff", align: "right", cell: (r) => <span className="tabular-nums">{r.staff_count}</span> },
    {
      key: ACTIONS_KEY, header: "common.actions", hideable: false,
      cell: (r) => (
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
          onClick={() => removeTeam.mutate(r.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ], [t, removeTeam]);

  const enabled = scope?.data.enabled ?? false;
  const hasHq = (branches?.data ?? []).some((b) => b.is_headquarters);

  return (
    <Layout>
      <PageHeader title={t("org_units.title")} subtitle={t("org_units.subtitle")} />
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
        {/* 접근 범위 스위치 — 조직을 세우기 전에 켜면 아무도 아무것도 못 본다. */}
        <div className="border rounded-lg bg-card px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-sm">{t("org_units.scope_title")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">{t("org_units.scope_desc")}</p>
            </div>
            <Switch checked={enabled} onCheckedChange={(v) => toggleScope.mutate(v)} disabled={toggleScope.isPending} />
          </div>
          {!enabled && (
            <p className="text-xs text-muted-foreground mt-2">{t("org_units.scope_off_hint")}</p>
          )}
          {enabled && !hasHq && (
            // 본사가 없으면 관리자 역할이 아닌 사람은 전 지점을 볼 방법이 없다.
            <p className="text-xs text-amber-600 mt-2">{t("org_units.scope_no_hq")}</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-muted-foreground" />{t("org_units.branches")}
            </h2>
            <Button size="sm" onClick={() => setBranchOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />{t("org_units.add_branch")}
            </Button>
          </div>
          <DataTable
            tableKey="branches" columns={branchCols} data={branches?.data ?? []}
            isLoading={bLoading} rowKey={(b) => b.id} emptyText={t("org_units.no_branches")}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />{t("org_units.teams")}
            </h2>
            <Button size="sm" onClick={() => setTeamOpen(true)} disabled={!(branches?.data ?? []).length}>
              <Plus className="h-3.5 w-3.5 mr-1" />{t("org_units.add_team")}
            </Button>
          </div>
          <DataTable
            tableKey="teams" columns={teamCols} data={teams?.data ?? []}
            isLoading={tLoading} rowKey={(r) => r.id} emptyText={t("org_units.no_teams")}
          />
        </div>
      </div>

      <Dialog open={branchOpen} onOpenChange={setBranchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("org_units.add_branch")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t("org_units.col_branch")}</Label>
              <Input value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{t("org_units.col_code")}</Label>
              <Input value={branchForm.code} onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })} />
            </div>
            <div className="flex items-center justify-between border rounded-md px-3 py-2">
              <div>
                <Label className="text-xs">{t("org_units.hq")}</Label>
                <p className="text-xs text-muted-foreground">{t("org_units.hq_hint")}</p>
              </div>
              <Switch checked={branchForm.is_headquarters}
                onCheckedChange={(v) => setBranchForm({ ...branchForm, is_headquarters: v })} />
            </div>
            <div>
              <Label className="text-xs">{t("org_units.address")}</Label>
              <Input value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBranchOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => createBranch.mutate()} disabled={!branchForm.name.trim() || createBranch.isPending}>
              {createBranch.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}{t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={teamOpen} onOpenChange={setTeamOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("org_units.add_team")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t("org_units.col_branch")}</Label>
              <Select value={teamForm.branch_id} onValueChange={(v) => setTeamForm({ ...teamForm, branch_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("org_units.pick_branch")} /></SelectTrigger>
                <SelectContent>
                  {(branches?.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("org_units.col_team")}</Label>
              <Input value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{t("org_units.col_code")}</Label>
              <Input value={teamForm.code} onChange={(e) => setTeamForm({ ...teamForm, code: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeamOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => createTeam.mutate()} disabled={!teamForm.name.trim() || !teamForm.branch_id || createTeam.isPending}>
              {createTeam.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}{t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

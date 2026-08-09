import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExportableTable } from "@/components/ui/ExportCsvButton";
import { apiFetch, apiJson } from "@/lib/apiFetch";
import { formatDate } from "@/lib/date";
import { formatPersonName } from "@/lib/nameFormat";
import { KeyRound, Mail, Trash2, UserPlus, Eye, EyeOff, ExternalLink, Pencil } from "lucide-react";

/**
 * 포털 사용 — per-person portal access for one account.
 *
 * One row = one login in `partner_users`: the email is the 아이디, the portal
 * picker decides which partner portal it opens, and the switch turns access on
 * and off (which also kills live sessions server-side). Passwords are write-only:
 * an operator either types one here or mails an invite/reset link.
 */

const PORTAL_TYPES = ["agent", "owner", "service_host"] as const;
type PortalType = (typeof PORTAL_TYPES)[number];

export interface PortalUser {
  id: number;
  account_id: number;
  portal_type: PortalType;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  display_name: string | null;
  portal_url: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

interface AccountContactLike {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  mobile_number?: string | null;
  office_number?: string | null;
}

interface Props {
  accountId: number;
  /** People already attached to the account — used to prefill a new login. */
  contacts?: AccountContactLike[];
  /** Account type ("Agent", "SpaceOwner" …) — picks the default portal. */
  accountType?: string | null;
}

const PORTAL_BADGE: Record<PortalType, string> = {
  agent: "bg-blue-100 text-blue-700",
  owner: "bg-emerald-100 text-emerald-700",
  service_host: "bg-purple-100 text-purple-700",
};

/** The portal an account of this type would normally use. */
function defaultPortalFor(accountType?: string | null): PortalType {
  switch (accountType) {
    case "SpaceOwner": return "owner";
    case "ServiceHost": return "service_host";
    default: return "agent";
  }
}

interface DraftForm {
  portal_type: PortalType;
  email: string;
  last_name: string;
  first_name: string;
  phone: string;
  is_active: boolean;
  password: string;
  /** false → create with no usable password and mail an invite link instead. */
  set_password: boolean;
}

export function AccountPortalUsers({ accountId, contacts, accountType }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const queryKey = ["account-portal-users", accountId];

  const { data: users, isLoading } = useQuery<PortalUser[]>({
    queryKey,
    queryFn: () => apiJson<PortalUser[]>(`/api/v1/accounts/${accountId}/portal-users`),
    enabled: !!accountId,
  });

  const [editing, setEditing] = useState<PortalUser | "new" | null>(null);
  const [pwTarget, setPwTarget] = useState<PortalUser | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey });

  async function call(path: string, init: RequestInit, failMsg: string): Promise<any> {
    const res = await apiFetch(path, init);
    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? failMsg);
    return data;
  }

  async function handleToggleActive(user: PortalUser, next: boolean) {
    setBusyId(user.id);
    setNotice(null);
    try {
      await call(
        `/api/v1/accounts/${accountId}/portal-users/${user.id}`,
        { method: "PUT", body: JSON.stringify({ is_active: next }) },
        t("account.portal_save_failed"),
      );
      refresh();
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : t("account.portal_save_failed") });
    } finally {
      setBusyId(null);
    }
  }

  async function handleSendReset(user: PortalUser) {
    setBusyId(user.id);
    setNotice(null);
    try {
      await call(
        `/api/v1/accounts/${accountId}/portal-users/${user.id}/send-reset`,
        { method: "POST" },
        t("account.portal_invite_failed"),
      );
      setNotice({ kind: "ok", text: t("account.portal_invite_sent", { email: user.email }) });
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : t("account.portal_invite_failed") });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(user: PortalUser) {
    if (!window.confirm(t("account.portal_delete_confirm", { email: user.email }))) return;
    setBusyId(user.id);
    setNotice(null);
    try {
      await call(`/api/v1/accounts/${accountId}/portal-users/${user.id}`, { method: "DELETE" }, t("account.portal_save_failed"));
      refresh();
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : t("account.portal_save_failed") });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-4xl space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("account.portal_hint")}</p>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setEditing("new")}>
          <UserPlus className="h-4 w-4" /> {t("account.portal_add")}
        </Button>
      </div>

      {notice && (
        <div className={`rounded-md border px-3 py-2 text-sm ${
          notice.kind === "ok"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-destructive/30 bg-destructive/10 text-destructive"
        }`}>
          {notice.text}
        </div>
      )}

      <div className="rounded-md border bg-card overflow-x-auto">
        <ExportableTable fileName="account-portal-users" className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("account.portal_col_portal")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("account.portal_col_username")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("account.portal_col_name")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("account.portal_col_last_login")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("account.portal_col_enabled")}</th>
              <th className="w-32" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">{t("common.loading")}</td></tr>
            ) : !users?.length ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">{t("account.portal_empty")}</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className={PORTAL_BADGE[u.portal_type]}>
                      {t(`account.portal_type_${u.portal_type}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{u.email}</span>
                    {u.portal_url && (
                      <a href={u.portal_url} target="_blank" rel="noreferrer"
                        className="ml-1.5 inline-flex align-middle text-muted-foreground hover:text-foreground"
                        title={t("account.portal_open")}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {u.display_name || formatPersonName(u.first_name, u.last_name) || "—"}
                    {u.phone ? <span className="block text-xs">{u.phone}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {u.last_login_at ? formatDate(u.last_login_at) : t("account.portal_never")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={u.is_active} disabled={busyId === u.id}
                        onCheckedChange={(v) => void handleToggleActive(u, v)} />
                      <span className="text-xs text-muted-foreground">
                        {u.is_active ? t("account.portal_enabled") : t("account.portal_disabled")}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title={t("account.portal_edit")}
                        onClick={() => setEditing(u)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title={t("account.portal_set_password")}
                        disabled={busyId === u.id} onClick={() => setPwTarget(u)}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title={t("account.portal_send_reset")}
                        disabled={busyId === u.id} onClick={() => void handleSendReset(u)}>
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title={t("account.portal_delete")}
                        disabled={busyId === u.id} onClick={() => void handleDelete(u)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </ExportableTable>
      </div>

      <PortalUserDialog
        accountId={accountId}
        target={editing}
        contacts={contacts}
        defaultPortal={defaultPortalFor(accountType)}
        onOpenChange={(open) => { if (!open) setEditing(null); }}
        onSaved={(msg) => { refresh(); if (msg) setNotice({ kind: "ok", text: msg }); }}
      />

      <SetPasswordDialog
        accountId={accountId}
        user={pwTarget}
        onOpenChange={(open) => { if (!open) setPwTarget(null); }}
        onSaved={() => setNotice({ kind: "ok", text: t("account.portal_password_saved") })}
      />
    </div>
  );
}

/* ── Create / edit ────────────────────────────────────────────────────────── */

function PortalUserDialog({
  accountId, target, contacts, defaultPortal, onOpenChange, onSaved,
}: {
  accountId: number;
  target: PortalUser | "new" | null;
  contacts?: AccountContactLike[];
  defaultPortal: PortalType;
  onOpenChange: (open: boolean) => void;
  onSaved: (message?: string) => void;
}) {
  const { t } = useTranslation();
  const isNew = target === "new";
  const user = target && target !== "new" ? target : null;
  const open = target !== null;

  const [form, setForm] = useState<DraftForm>(() => emptyDraft(defaultPortal));
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setShowPw(false);
    setForm(user
      ? {
          portal_type: user.portal_type,
          email: user.email,
          last_name: user.last_name ?? "",
          first_name: user.first_name ?? "",
          phone: user.phone ?? "",
          is_active: user.is_active,
          password: "",
          set_password: false,
        }
      : emptyDraft(defaultPortal));
  }, [open, user, defaultPortal]);

  // Prefilling from an attached contact saves retyping the person's details.
  const contactOptions = useMemo(
    () => (contacts ?? []).filter((c) => c.email || c.first_name || c.last_name),
    [contacts],
  );

  function applyContact(contactId: string) {
    const c = contactOptions.find((x) => String(x.id) === contactId);
    if (!c) return;
    setForm((f) => ({
      ...f,
      email: c.email ?? f.email,
      first_name: c.first_name ?? f.first_name,
      last_name: c.last_name ?? f.last_name,
      phone: c.mobile_number ?? c.office_number ?? f.phone,
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const base = {
        portal_type: form.portal_type,
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        is_active: form.is_active,
      };
      const path = isNew
        ? `/api/v1/accounts/${accountId}/portal-users`
        : `/api/v1/accounts/${accountId}/portal-users/${user!.id}`;
      const body = isNew && form.set_password ? { ...base, password: form.password } : base;

      const res = await apiFetch(path, { method: isNew ? "POST" : "PUT", body: JSON.stringify(body) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? t("account.portal_save_failed"));

      onSaved(isNew && !form.set_password
        ? (data?.invite_sent ? t("account.portal_invite_sent", { email: base.email }) : t("account.portal_invite_not_sent"))
        : undefined);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("account.portal_save_failed"));
    } finally {
      setSaving(false);
    }
  }

  const canSave = /\S+@\S+\.\S+/.test(form.email.trim())
    && (!isNew || !form.set_password || form.password.length >= 12);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? t("account.portal_add") : t("account.portal_edit")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isNew && contactOptions.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t("account.portal_from_contact")}</Label>
              <Select onValueChange={applyContact}>
                <SelectTrigger><SelectValue placeholder={t("account.portal_from_contact_ph")} /></SelectTrigger>
                <SelectContent>
                  {contactOptions.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {formatPersonName(c.first_name, c.last_name)}{c.email ? ` · ${c.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t("account.portal_col_portal")}</Label>
            <Select value={form.portal_type} onValueChange={(v) => setForm((f) => ({ ...f, portal_type: v as PortalType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PORTAL_TYPES.map((p) => (
                  <SelectItem key={p} value={p}>{t(`account.portal_type_${p}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("account.portal_col_username")}</Label>
            <Input type="email" value={form.email} autoComplete="off"
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <p className="text-xs text-muted-foreground">{t("account.portal_username_hint")}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("account.portal_last_name")}</Label>
              <Input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("account.portal_first_name")}</Label>
              <Input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("account.col_phone")}</Label>
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>

          {isNew && (
            <div className="rounded-md border p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{t("account.portal_set_password_now")}</p>
                  <p className="text-xs text-muted-foreground">{t("account.portal_password_choice_hint")}</p>
                </div>
                <Switch checked={form.set_password}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, set_password: v }))} />
              </div>
              {form.set_password && (
                <div className="space-y-1.5">
                  <Label>{t("account.portal_password")}</Label>
                  <div className="relative">
                    <Input type={showPw ? "text" : "password"} value={form.password} autoComplete="new-password"
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                    <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowPw((s) => !s)}>
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("account.portal_password_policy")}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{t("account.portal_col_enabled")}</p>
              <p className="text-xs text-muted-foreground">{t("account.portal_enabled_hint")}</p>
            </div>
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button disabled={!canSave || saving} onClick={() => void handleSave()}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function emptyDraft(portal: PortalType): DraftForm {
  return {
    portal_type: portal, email: "", last_name: "", first_name: "", phone: "",
    is_active: true, password: "", set_password: false,
  };
}

/* ── Set password ─────────────────────────────────────────────────────────── */

function SetPasswordDialog({
  accountId, user, onOpenChange, onSaved,
}: {
  accountId: number;
  user: PortalUser | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setPassword(""); setConfirm(""); setShowPw(false); setError(null);
  }, [user]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/accounts/${accountId}/portal-users/${user.id}/password`, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? t("account.portal_save_failed"));
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("account.portal_save_failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("account.portal_set_password")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("account.portal_set_password_for", { email: user?.email ?? "" })}</p>
          <div className="space-y-1.5">
            <Label>{t("account.portal_password")}</Label>
            <div className="relative">
              <Input type={showPw ? "text" : "password"} value={password} autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowPw((s) => !s)}>
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{t("account.portal_password_policy")}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t("account.portal_password_confirm")}</Label>
            <Input type={showPw ? "text" : "password"} value={confirm} autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">{t("account.portal_password_signout_hint")}</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button disabled={saving || password.length < 12 || password !== confirm} onClick={() => void handleSave()}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

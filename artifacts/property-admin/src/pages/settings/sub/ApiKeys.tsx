import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { formatDateTime } from "@/lib/date";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/apiFetch";
import {
  Loader2, Copy, CheckCircle2, KeyRound, Plus, Trash2, RefreshCw, ArrowLeft, AlertTriangle,
} from "lucide-react";
import { Link } from "wouter";
import { APP_NAME } from "@/lib/appName";
import { cn } from "@/lib/utils";

interface ApiCredential {
  id: number;
  name: string;
  key_id: string;
  secret_last4: string | null;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

// Mirrors API_SCOPES in the api-server. Grouped by domain for the UI.
const SCOPE_GROUPS: { domain: string; scopes: { value: string; action: string }[] }[] = [
  { domain: "Bookings", scopes: [{ value: "bookings:read", action: "Read" }, { value: "bookings:write", action: "Write" }] },
  { domain: "Availability", scopes: [{ value: "availability:read", action: "Read" }, { value: "availability:write", action: "Write" }] },
  { domain: "Pricing", scopes: [{ value: "pricing:read", action: "Read" }, { value: "pricing:write", action: "Write" }] },
  { domain: "Tasks", scopes: [{ value: "tasks:read", action: "Read" }, { value: "tasks:write", action: "Write" }] },
  { domain: "Homestay Students", scopes: [{ value: "homestay:read", action: "Read" }, { value: "homestay:write", action: "Write" }] },
];

function CopyField({ label, value }: { label: string; value: string }) {
  // label is passed pre-translated by callers
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <code className="text-xs bg-muted px-2 py-1.5 rounded font-mono flex-1 break-all">{value}</code>
        <Button
          size="sm" variant="outline" className="h-8 shrink-0"
          onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        >
          {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

// Shows a one-time secret (after create or rotate). Cannot be retrieved again.
function SecretReveal({ keyId, secret, onDismiss }: { keyId: string; secret: string; onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
      <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
        <AlertTriangle className="h-4 w-4" /> {t("apiKeys.save_secret_now")}
      </div>
      <CopyField label={t("apiKeys.api_key_label")} value={keyId} />
      <CopyField label={t("apiKeys.api_secret_label")} value={secret} />
      <div className="flex justify-end">
        <Button size="sm" onClick={onDismiss}>{t("apiKeys.saved_it")}</Button>
      </div>
    </div>
  );
}

function CreateForm({ onCreated, onCancel }: { onCreated: (keyId: string, secret: string) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(scope: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(scope) ? next.delete(scope) : next.add(scope);
      return next;
    });
  }

  async function submit() {
    if (!name.trim()) { setError(t("apiKeys.name_required")); return; }
    if (selected.size === 0) { setError(t("apiKeys.select_scope")); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/v1/api-credentials", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), scopes: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error ?? t("apiKeys.create_failed")); return; }
      onCreated(data.key_id, data.secret);
    } catch {
      setError(t("common.network_error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <h3 className="font-semibold text-sm">{t("apiKeys.new_credential")}</h3>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{t("apiKeys.app_name")}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("apiKeys.app_name_ph")} className="h-9 text-sm" autoFocus />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{t("apiKeys.permissions")}</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SCOPE_GROUPS.map((g) => (
            <div key={g.domain} className="rounded-lg border p-3">
              <div className="text-xs font-medium mb-2">{g.domain}</div>
              <div className="flex gap-3">
                {g.scopes.map((s) => (
                  <label key={s.value} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="checkbox" checked={selected.has(s.value)} onChange={() => toggle(s.value)} className="accent-primary" />
                    {s.action}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button>
        <Button size="sm" onClick={submit} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("common.create")}
        </Button>
      </div>
    </div>
  );
}

function CredentialRow({ cred, onChanged, onRotated }: {
  cred: ApiCredential;
  onChanged: () => void;
  onRotated: (keyId: string, secret: string) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function rotate() {
    if (!confirm(t("apiKeys.confirm_rotate", { name: cred.name }))) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/v1/api-credentials/${cred.id}/rotate`, { method: "POST" });
      const data = await res.json();
      if (res.ok) onRotated(data.key_id, data.secret);
    } finally { setBusy(false); }
  }

  async function revoke() {
    if (!confirm(t("apiKeys.confirm_revoke", { name: cred.name }))) return;
    setBusy(true);
    try {
      await apiFetch(`/api/v1/api-credentials/${cred.id}`, { method: "DELETE" });
      onChanged();
    } finally { setBusy(false); }
  }

  async function toggleActive() {
    setBusy(true);
    try {
      await apiFetch(`/api/v1/api-credentials/${cred.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !cred.is_active }),
      });
      onChanged();
    } finally { setBusy(false); }
  }

  const revoked = !!cred.revoked_at;

  return (
    <div className={cn("rounded-xl border bg-card p-4 space-y-3", revoked && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{cred.name}</span>
            {revoked
              ? <span className="text-xs px-2 py-0.5 rounded-full border bg-red-100 text-red-700 border-red-200">{t("apiKeys.status_revoked")}</span>
              : cred.is_active
                ? <span className="text-xs px-2 py-0.5 rounded-full border bg-green-100 text-green-800 border-green-200">{t("common.active")}</span>
                : <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-100 text-gray-600 border-gray-200">{t("common.disabled")}</span>}
          </div>
          <code className="text-xs text-muted-foreground font-mono">{cred.key_id}</code>
          {cred.secret_last4 && <span className="text-xs text-muted-foreground ml-2">{t("apiKeys.secret_masked", { last4: cred.secret_last4 })}</span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {cred.scopes.map((s) => (
          <span key={s} className="text-[11px] px-1.5 py-0.5 rounded bg-muted font-mono">{s}</span>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">
        {t("apiKeys.last_used", { value: cred.last_used_at ? formatDateTime(cred.last_used_at) : t("apiKeys.never") })}
      </div>
      {!revoked && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={toggleActive} disabled={busy}>
            {cred.is_active ? t("common.disable") : t("common.enable")}
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={rotate} disabled={busy}>
            <RefreshCw className="h-3.5 w-3.5" /> {t("apiKeys.rotate")}
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 text-red-600 hover:text-red-700" onClick={revoke} disabled={busy}>
            <Trash2 className="h-3.5 w-3.5" /> {t("apiKeys.revoke")}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function ApiKeysPage() {
  const { t } = useTranslation();
  const [creds, setCreds] = useState<ApiCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<{ keyId: string; secret: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/api-credentials");
      const data = await res.json();
      if (Array.isArray(data)) setCreds(data);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <Layout>
      <PageHeader
        title={t("nav.api_keys")}
        subtitle={t("apiKeys.subtitle", { app: APP_NAME })}
        actions={
          <div className="flex gap-2">
            <Link href="/settings">
              <Button variant="outline" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> {t("common.back_to_settings")}</Button>
            </Link>
            {!creating && (
              <Button size="sm" className="gap-1.5" onClick={() => { setCreating(true); setRevealed(null); }}>
                <Plus className="h-4 w-4" /> {t("apiKeys.new_api_key")}
              </Button>
            )}
          </div>
        }
      />
      <div className="p-6 max-w-3xl space-y-4">
        {revealed && (
          <SecretReveal keyId={revealed.keyId} secret={revealed.secret} onDismiss={() => { setRevealed(null); load(); }} />
        )}

        {creating && (
          <CreateForm
            onCreated={(keyId, secret) => { setCreating(false); setRevealed({ keyId, secret }); }}
            onCancel={() => setCreating(false)}
          />
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
          </div>
        ) : creds.length === 0 && !creating ? (
          <div className="text-center text-muted-foreground text-sm py-12 border rounded-xl">
            <KeyRound className="h-8 w-8 mx-auto mb-2 opacity-40" />
            {t("apiKeys.empty")}
          </div>
        ) : (
          <div className="space-y-3">
            {creds.map((c) => (
              <CredentialRow
                key={c.id}
                cred={c}
                onChanged={load}
                onRotated={(keyId, secret) => setRevealed({ keyId, secret })}
              />
            ))}
          </div>
        )}

        <div className="rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">{t("apiKeys.auth_title")}</p>
          <p>{t("apiKeys.send_headers")} <code className="font-mono">/api/ext/v1/*</code>:</p>
          <code className="block font-mono mt-1">X-API-Key: &lt;key&gt;</code>
          <code className="block font-mono">X-API-Secret: &lt;secret&gt;</code>
        </div>
      </div>
    </Layout>
  );
}

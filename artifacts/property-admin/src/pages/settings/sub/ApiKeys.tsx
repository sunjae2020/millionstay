import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/apiFetch";
import {
  Loader2, Copy, CheckCircle2, KeyRound, Plus, Trash2, RefreshCw, ArrowLeft, AlertTriangle,
} from "lucide-react";
import { Link } from "wouter";
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
];

function CopyField({ label, value }: { label: string; value: string }) {
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
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
      <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
        <AlertTriangle className="h-4 w-4" /> Save this secret now — it will not be shown again
      </div>
      <CopyField label="API Key (X-API-Key)" value={keyId} />
      <CopyField label="API Secret (X-API-Secret)" value={secret} />
      <div className="flex justify-end">
        <Button size="sm" onClick={onDismiss}>I've saved it</Button>
      </div>
    </div>
  );
}

function CreateForm({ onCreated, onCancel }: { onCreated: (keyId: string, secret: string) => void; onCancel: () => void }) {
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
    if (!name.trim()) { setError("Name is required"); return; }
    if (selected.size === 0) { setError("Select at least one scope"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/v1/api-credentials", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), scopes: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error ?? "Failed to create credential"); return; }
      onCreated(data.key_id, data.secret);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <h3 className="font-semibold text-sm">New API Credential</h3>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">App name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Owner mobile app" className="h-9 text-sm" autoFocus />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Permissions (scopes)</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SCOPE_GROUPS.map((g) => (
            <div key={g.domain} className="rounded-lg border p-3">
              <div className="text-xs font-medium mb-2">{g.domain}</div>
              <div className="flex gap-3">
                {g.scopes.map((s) => (
                  <label key={s.value} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="checkbox" checked={selected.has(s.value)} onChange={() => toggle(s.value)} className="accent-[#E8621A]" />
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
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={submit} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
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
  const [busy, setBusy] = useState(false);

  async function rotate() {
    if (!confirm(`Rotate the secret for "${cred.name}"? The current secret will stop working immediately.`)) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/v1/api-credentials/${cred.id}/rotate`, { method: "POST" });
      const data = await res.json();
      if (res.ok) onRotated(data.key_id, data.secret);
    } finally { setBusy(false); }
  }

  async function revoke() {
    if (!confirm(`Revoke "${cred.name}"? The external app will lose access immediately.`)) return;
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
              ? <span className="text-xs px-2 py-0.5 rounded-full border bg-red-100 text-red-700 border-red-200">Revoked</span>
              : cred.is_active
                ? <span className="text-xs px-2 py-0.5 rounded-full border bg-green-100 text-green-800 border-green-200">Active</span>
                : <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-100 text-gray-600 border-gray-200">Disabled</span>}
          </div>
          <code className="text-xs text-muted-foreground font-mono">{cred.key_id}</code>
          {cred.secret_last4 && <span className="text-xs text-muted-foreground ml-2">secret ••••{cred.secret_last4}</span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {cred.scopes.map((s) => (
          <span key={s} className="text-[11px] px-1.5 py-0.5 rounded bg-muted font-mono">{s}</span>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">
        Last used: {cred.last_used_at ? new Date(cred.last_used_at).toLocaleString() : "never"}
      </div>
      {!revoked && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={toggleActive} disabled={busy}>
            {cred.is_active ? "Disable" : "Enable"}
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={rotate} disabled={busy}>
            <RefreshCw className="h-3.5 w-3.5" /> Rotate
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 text-red-600 hover:text-red-700" onClick={revoke} disabled={busy}>
            <Trash2 className="h-3.5 w-3.5" /> Revoke
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
        subtitle="Issue API keys so external apps can connect to MillionStay"
        actions={
          <div className="flex gap-2">
            <Link href="/settings">
              <Button variant="outline" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back to Settings</Button>
            </Link>
            {!creating && (
              <Button size="sm" className="gap-1.5" onClick={() => { setCreating(true); setRevealed(null); }}>
                <Plus className="h-4 w-4" /> New API Key
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
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : creds.length === 0 && !creating ? (
          <div className="text-center text-muted-foreground text-sm py-12 border rounded-xl">
            <KeyRound className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No API keys yet. Create one to let an external app connect.
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
          <p className="font-medium text-foreground">How external apps authenticate</p>
          <p>Send both headers on every request to <code className="font-mono">/api/ext/v1/*</code>:</p>
          <code className="block font-mono mt-1">X-API-Key: &lt;key&gt;</code>
          <code className="block font-mono">X-API-Secret: &lt;secret&gt;</code>
        </div>
      </div>
    </Layout>
  );
}

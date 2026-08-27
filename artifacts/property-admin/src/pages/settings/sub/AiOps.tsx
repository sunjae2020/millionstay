import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/apiFetch";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Loader2, CheckCircle2, AlertCircle, AlertTriangle,
  Eye, EyeOff, ExternalLink, RefreshCw, Plus, Trash2,
} from "lucide-react";

/* ── Wire types (mirror routes/ai-ops.ts) ─────────────────────────────────── */

interface Capabilities {
  vision: boolean;
  pdf: boolean;
  tools: boolean;
  streaming: boolean;
  promptCache: boolean;
}

interface ProviderRow {
  id: string;
  label: string;
  key_env: string;
  base_url_env: string;
  base_url: string | null;
  console_url: string;
  wire: string;
  configured: boolean;
  masked_key: string;
  supports: Capabilities;
  note: string;
  custom: boolean;
  model_prefixes: string[];
}

interface TaskRow {
  task: string;
  label: string;
  area: string;
  provider: string;
  model: string;
  modelRef: string;
  configured: string;
  configured_via: "task_env" | "fallback_env" | "default";
  provider_configured: boolean;
  missing_capabilities: string[];
  env_key: string;
  default_model: string;
  volume: "high" | "medium" | "low";
  movable: "yes" | "verify" | "no";
  source: string;
  rationale: string;
  needs: string[];
  eligible_providers: string[];
  price_per_mtok: { input: number; output: number } | null;
}

interface UsageRow {
  key: string;
  calls: number;
  failures: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost_usd: number;
  avg_latency_ms: number | null;
}

interface UsagePayload {
  days: number;
  totals: UsageRow;
  by_task: UsageRow[];
  by_provider: UsageRow[];
  by_model: UsageRow[];
  by_day: UsageRow[];
}

/* ── Formatting ───────────────────────────────────────────────────────────── */

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Four decimals: a month of Haiku translation can still total under a cent. */
function formatUsd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

const CAPABILITY_KEYS: Array<keyof Capabilities> = ["vision", "pdf", "tools", "streaming", "promptCache"];

/* ── Small presentational pieces ──────────────────────────────────────────── */

function Chip({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "text-[11px] px-1.5 py-0.5 rounded border font-medium",
        on
          ? "bg-green-50 text-green-700 border-green-200"
          : "bg-gray-50 text-gray-400 border-gray-200 line-through",
      )}
    >
      {children}
    </span>
  );
}

function MovabilityBadge({ value }: { value: TaskRow["movable"] }) {
  const { t } = useTranslation();
  const styles: Record<TaskRow["movable"], string> = {
    yes: "bg-green-100 text-green-800 border-green-200",
    verify: "bg-amber-100 text-amber-800 border-amber-200",
    no: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap", styles[value])}>
      {t(`ai_ops.movable_${value}`)}
    </span>
  );
}

/* ── Provider card ────────────────────────────────────────────────────────── */

function ProviderCard({ provider, onChanged }: { provider: ProviderRow; onChanged: () => void }) {
  const { t } = useTranslation();
  const [editingKey, setEditingKey] = useState(false);
  const [keyVal, setKeyVal] = useState("");
  const [baseUrl, setBaseUrl] = useState(provider.base_url ?? "");
  const [testModel, setTestModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  async function saveEnv(key: string, value: string) {
    setBusy(true);
    setResult(null);
    try {
      const res = await apiFetch("/api/v1/integrations/update-env", {
        method: "POST",
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !(data as any).success) {
        setResult({ ok: false, msg: (data as any).error ?? t("ai_ops.save_failed") });
        return;
      }
      setEditingKey(false);
      setKeyVal("");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function removeEngine() {
    // The server refuses while a task still points here, so the confirm only has
    // to cover the ordinary case: the admin meant a different card.
    if (!window.confirm(t("ai_ops.remove_engine_confirm", { label: provider.label }))) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await apiFetch(`/api/v1/ai/providers/${provider.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !(data as any).success) {
        setResult({ ok: false, msg: (data as any).error ?? t("ai_ops.save_failed") });
        return;
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function runTest() {
    setBusy(true);
    setResult(null);
    try {
      const res = await apiFetch(`/api/v1/ai/providers/${provider.id}/test`, {
        method: "POST",
        body: JSON.stringify({ model: testModel.trim() }),
      });
      const data = await res.json() as { success: boolean; model?: string; latency_ms?: number; error?: string };
      setResult(
        data.success
          ? { ok: true, msg: t("ai_ops.test_ok", { model: data.model, ms: data.latency_ms }) }
          : { ok: false, msg: data.error ?? t("ai_ops.test_failed") },
      );
    } catch {
      setResult({ ok: false, msg: t("common.network_error") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-sm">{provider.label}</span>
        <span
          className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full border",
            provider.configured
              ? "bg-green-100 text-green-800 border-green-200"
              : "bg-gray-100 text-gray-600 border-gray-200",
          )}
        >
          {provider.configured ? t("ai_ops.badge_connected") : t("ai_ops.badge_not_configured")}
        </span>
        {provider.custom && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border bg-muted text-muted-foreground">
            {t("ai_ops.custom_engine")}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {provider.console_url && (
            <a
              href={provider.console_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              {t("ai_ops.get_key")} <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {provider.custom && (
            <button
              className="text-muted-foreground hover:text-red-600 transition-colors"
              title={t("ai_ops.remove_engine")}
              onClick={removeEngine}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {CAPABILITY_KEYS.map((k) => (
          <Chip key={k} on={provider.supports[k]}>{t(`ai_ops.cap_${k}`)}</Chip>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{provider.key_env}</Label>
        {editingKey ? (
          <div className="flex gap-2">
            <Input
              type="text"
              autoFocus
              value={keyVal}
              onChange={(e) => setKeyVal(e.target.value)}
              placeholder={provider.key_env}
              className="h-8 text-xs font-mono flex-1"
              onKeyDown={(e) => e.key === "Enter" && saveEnv(provider.key_env, keyVal.trim())}
            />
            <Button size="sm" className="h-8 text-xs" disabled={busy || !keyVal.trim()} onClick={() => saveEnv(provider.key_env, keyVal.trim())}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : t("common.save")}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setEditingKey(false); setKeyVal(""); }}>
              {t("common.cancel")}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
              {provider.masked_key || t("ai_ops.not_set")}
            </code>
            <button className="text-xs text-primary hover:underline" onClick={() => setEditingKey(true)}>
              {provider.configured ? t("ai_ops.change") : t("ai_ops.set")}
            </button>
          </div>
        )}
      </div>

      <button
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        onClick={() => setShowAdvanced((v) => !v)}
      >
        {showAdvanced ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        {t("ai_ops.advanced")}
      </button>

      {showAdvanced && (
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{provider.base_url_env}</Label>
          <div className="flex gap-2">
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={provider.base_url ?? ""}
              className="h-8 text-xs font-mono flex-1"
            />
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={busy} onClick={() => saveEnv(provider.base_url_env, baseUrl.trim())}>
              {t("common.save")}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">{t("ai_ops.base_url_hint")}</p>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Input
          value={testModel}
          onChange={(e) => setTestModel(e.target.value)}
          placeholder={t("ai_ops.test_model_ph")}
          className="h-8 text-xs font-mono flex-1"
          disabled={!provider.configured}
        />
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={busy || !provider.configured} onClick={runTest}>
          {busy && <Loader2 className="h-3 w-3 animate-spin" />}
          {t("ai_ops.test")}
        </Button>
      </div>

      {result && (
        <div className={cn(
          "flex items-start gap-2 text-xs rounded-lg px-3 py-2",
          result.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200",
        )}>
          {result.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
          <span className="break-all">{result.msg}</span>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-relaxed">{provider.note}</p>
    </div>
  );
}

/* ── Add a custom engine ──────────────────────────────────────────────────── */

const WIRES: Array<{ value: "anthropic" | "openai-compat"; labelKey: string }> = [
  { value: "anthropic", labelKey: "ai_ops.wire_anthropic" },
  { value: "openai-compat", labelKey: "ai_ops.wire_openai" },
];

function AddEngineForm({ onAdded }: { onAdded: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [wire, setWire] = useState<"anthropic" | "openai-compat">("anthropic");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [prefixes, setPrefixes] = useState("");
  const [supports, setSupports] = useState<Capabilities>({
    vision: false, pdf: false, tools: false, streaming: false, promptCache: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setId(""); setLabel(""); setWire("anthropic"); setBaseUrl(""); setApiKey(""); setPrefixes("");
    setSupports({ vision: false, pdf: false, tools: false, streaming: false, promptCache: false });
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/v1/ai/providers", {
        method: "POST",
        body: JSON.stringify({
          id: id.trim().toLowerCase(),
          label: label.trim() || id.trim(),
          wire,
          base_url: baseUrl.trim() || null,
          model_prefixes: prefixes.split(",").map((x) => x.trim()).filter(Boolean),
          supports,
          ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !(data as any).success) {
        const err = (data as any).error;
        setError(typeof err === "string" ? err : t("ai_ops.save_failed"));
        return;
      }
      reset();
      setOpen(false);
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> {t("ai_ops.add_engine")}
      </Button>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{t("ai_ops.add_engine")}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t("ai_ops.add_engine_desc")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("ai_ops.field_id")}</Label>
          <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="claude-au" className="h-8 text-xs font-mono" />
          <p className="text-[11px] text-muted-foreground">{t("ai_ops.field_id_hint")}</p>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("ai_ops.field_label")}</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Claude (AU account)" className="h-8 text-xs" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t("ai_ops.field_wire")}</Label>
        <div className="flex gap-2">
          {WIRES.map((w) => (
            <Button
              key={w.value}
              size="sm"
              variant={wire === w.value ? "default" : "outline"}
              className="h-7 text-[11px]"
              onClick={() => setWire(w.value)}
            >
              {t(w.labelKey)}
            </Button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">{t("ai_ops.field_wire_hint")}</p>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">
          {t("ai_ops.field_base_url")}
          {wire === "openai-compat" && <span className="text-red-600"> *</span>}
        </Label>
        <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" className="h-8 text-xs font-mono" />
        <p className="text-[11px] text-muted-foreground">
          {wire === "openai-compat" ? t("ai_ops.field_base_url_required") : t("ai_ops.field_base_url_optional")}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t("ai_ops.field_api_key")}</Label>
        <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." className="h-8 text-xs font-mono" />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t("ai_ops.field_prefixes")}</Label>
        <Input value={prefixes} onChange={(e) => setPrefixes(e.target.value)} placeholder="deepseek-, qwen-" className="h-8 text-xs font-mono" />
        <p className="text-[11px] text-muted-foreground">{t("ai_ops.field_prefixes_hint")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{t("ai_ops.field_supports")}</Label>
        <div className="flex flex-wrap gap-1.5">
          {CAPABILITY_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSupports((s2) => ({ ...s2, [k]: !s2[k] }))}
              className={cn(
                "text-[11px] px-2 py-1 rounded border font-medium transition-colors",
                supports[k]
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-muted text-muted-foreground border-transparent",
              )}
            >
              {t(`ai_ops.cap_${k}`)}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">{t("ai_ops.field_supports_hint")}</p>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <Button size="sm" className="h-8 text-xs" disabled={saving || !id.trim()} onClick={save}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : t("common.save")}
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { reset(); setOpen(false); }}>
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}

/* ── Task row ─────────────────────────────────────────────────────────────── */

function TaskModelCell({ task, onSaved }: { task: TaskRow; onSaved: () => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(task.configured);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/ai/tasks/${task.task}`, {
        method: "PUT",
        body: JSON.stringify({ model: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !(data as any).success) {
        setError((data as any).error ?? t("ai_ops.save_failed"));
        return;
      }
      setEditing(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-1 min-w-[240px]">
        <div className="flex gap-1.5">
          <Input
            autoFocus
            value={val}
            onChange={(e) => { setVal(e.target.value); setError(null); }}
            placeholder="kimi/kimi-k2-0905-preview"
            className="h-7 text-[11px] font-mono flex-1"
            onKeyDown={(e) => e.key === "Enter" && save(val.trim())}
          />
          <Button size="sm" className="h-7 text-[11px] px-2" disabled={saving} onClick={() => save(val.trim())}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : t("common.save")}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2" onClick={() => { setEditing(false); setVal(task.configured); setError(null); }}>
            {t("common.cancel")}
          </Button>
        </div>
        {/* Clearing the field is how an admin reverts to the registry default. */}
        <button className="text-[11px] text-muted-foreground hover:underline" onClick={() => save("")}>
          {t("ai_ops.reset_default", { model: task.default_model })}
        </button>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <button className="text-left group" onClick={() => setEditing(true)}>
        <code className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded group-hover:bg-primary/10">
          {task.modelRef}
        </code>
      </button>
      <div className="text-[11px] text-muted-foreground">
        {t(`ai_ops.via_${task.configured_via}`, { env: task.env_key })}
      </div>
      {!task.provider_configured && (
        <div className="text-[11px] text-red-600 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> {t("ai_ops.provider_key_missing")}
        </div>
      )}
      {task.missing_capabilities.length > 0 && (
        <div className="text-[11px] text-red-600 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {t("ai_ops.missing_caps", { caps: task.missing_capabilities.join(", ") })}
        </div>
      )}
    </div>
  );
}

/* ── Usage bars ───────────────────────────────────────────────────────────── */

function BarList({ rows, labelOf, days }: { rows: UsageRow[]; labelOf: (key: string) => string; days: number }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...rows.map((r) => r.cost_usd));
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground py-3">{t("ai_ops.no_usage", { days })}</p>;
  }
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-medium truncate">{labelOf(r.key)}</span>
            <span className="text-muted-foreground whitespace-nowrap">
              {r.calls.toLocaleString()} {t("ai_ops.calls")} · {formatUsd(r.cost_usd)}
              {r.failures > 0 && <span className="text-red-600"> · {t("ai_ops.failures", { n: r.failures })}</span>}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${(r.cost_usd / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

const PERIODS = [7, 30, 90];

export default function AiOpsPage() {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [usage, setUsage] = useState<UsagePayload | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const loadOverview = useCallback(async () => {
    const res = await apiFetch("/api/v1/ai/overview");
    const data = await res.json();
    if (data.success) {
      setProviders(data.data.providers);
      setTasks(data.data.tasks);
    }
  }, []);

  const loadUsage = useCallback(async (d: number) => {
    const res = await apiFetch(`/api/v1/ai/usage?days=${d}`);
    const data = await res.json();
    if (data.success) {
      setUsage(data.data);
      setUsageError(null);
    } else {
      setUsage(null);
      setUsageError(data.error ?? t("ai_ops.usage_unavailable"));
    }
  }, [t]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await Promise.all([loadOverview(), loadUsage(days)]);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadOverview, loadUsage, days]);

  const taskLabel = useCallback((id: string) => t(`ai_ops.task.${id}`, { defaultValue: id }), [t]);

  /** 30-day cost per task, joined onto the registry rows for the table. */
  const usageByTask = useMemo(() => {
    const map = new Map<string, UsageRow>();
    for (const r of usage?.by_task ?? []) map.set(r.key, r);
    return map;
  }, [usage]);

  const brokenCount = tasks.filter(
    (x) => !x.provider_configured || x.missing_capabilities.length > 0,
  ).length;

  return (
    <Layout>
      <PageHeader
        title={t("ai_ops.title")}
        subtitle={t("ai_ops.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { void loadOverview(); void loadUsage(days); }}>
              <RefreshCw className="h-4 w-4" /> {t("common.refresh")}
            </Button>
            <Link href="/settings/integrations">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> {t("nav.integrations")}
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-6 max-w-6xl space-y-8">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
          </div>
        ) : (
          <>
            {brokenCount > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{t("ai_ops.broken_banner", { count: brokenCount })}</span>
              </div>
            )}

            {/* ── Providers ── */}
            <section className="space-y-3">
              <div>
                <h2 className="text-base font-semibold">{t("ai_ops.providers_title")}</h2>
                <p className="text-xs text-muted-foreground">{t("ai_ops.providers_desc")}</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {providers.map((p) => (
                  <ProviderCard key={p.id} provider={p} onChanged={() => { void loadOverview(); }} />
                ))}
              </div>
              <AddEngineForm onAdded={() => { void loadOverview(); }} />
            </section>

            {/* ── Task registry ── */}
            <section className="space-y-3">
              <div>
                <h2 className="text-base font-semibold">{t("ai_ops.tasks_title")}</h2>
                <p className="text-xs text-muted-foreground">{t("ai_ops.tasks_desc")}</p>
              </div>
              <div className="rounded-xl border bg-card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-4 py-2.5">{t("ai_ops.col_task")}</th>
                      <th className="text-left font-medium px-4 py-2.5">{t("ai_ops.col_model")}</th>
                      <th className="text-left font-medium px-4 py-2.5">{t("ai_ops.col_needs")}</th>
                      <th className="text-left font-medium px-4 py-2.5">{t("ai_ops.col_movable")}</th>
                      <th className="text-right font-medium px-4 py-2.5">{t("ai_ops.col_usage", { days })}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tasks.map((task) => {
                      const u = usageByTask.get(task.task);
                      return (
                        <tr key={task.task} className="align-top">
                          <td className="px-4 py-3">
                            <div className="font-medium">{taskLabel(task.task)}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {t(`ai_ops.area_${task.area}`)} · {t(`ai_ops.volume_${task.volume}`)}
                            </div>
                            <code className="text-[10px] text-muted-foreground">{task.source}</code>
                          </td>
                          <td className="px-4 py-3">
                            <TaskModelCell task={task} onSaved={() => { void loadOverview(); }} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {task.needs.length === 0
                                ? <span className="text-[11px] text-muted-foreground">{t("ai_ops.needs_none")}</span>
                                : task.needs.map((n) => <Chip key={n} on>{t(`ai_ops.cap_${n}`)}</Chip>)}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-1">
                              {t("ai_ops.eligible", { list: task.eligible_providers.join(", ") })}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <MovabilityBadge value={task.movable} />
                            <p className="text-[11px] text-muted-foreground mt-1 max-w-[22rem] leading-relaxed">
                              {task.rationale}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="font-medium">{formatUsd(u?.cost_usd ?? 0)}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {(u?.calls ?? 0).toLocaleString()} {t("ai_ops.calls")}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {formatTokens((u?.input_tokens ?? 0) + (u?.output_tokens ?? 0))} tok
                            </div>
                            {u?.avg_latency_ms != null && (
                              <div className="text-[11px] text-muted-foreground">{u.avg_latency_ms}ms</div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Usage meter ── */}
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-base font-semibold">{t("ai_ops.usage_title")}</h2>
                  <p className="text-xs text-muted-foreground">{t("ai_ops.usage_desc")}</p>
                </div>
                <div className="flex gap-1">
                  {PERIODS.map((d) => (
                    <Button
                      key={d}
                      size="sm"
                      variant={days === d ? "default" : "outline"}
                      className="h-7 text-xs"
                      onClick={() => setDays(d)}
                    >
                      {t("ai_ops.days", { n: d })}
                    </Button>
                  ))}
                </div>
              </div>

              {usageError ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{usageError}</span>
                </div>
              ) : usage ? (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    {[
                      { label: t("ai_ops.total_cost"), value: formatUsd(usage.totals.cost_usd) },
                      { label: t("ai_ops.total_calls"), value: usage.totals.calls.toLocaleString() },
                      { label: t("ai_ops.total_input"), value: formatTokens(usage.totals.input_tokens) },
                      { label: t("ai_ops.total_output"), value: formatTokens(usage.totals.output_tokens) },
                      { label: t("ai_ops.cache_read"), value: formatTokens(usage.totals.cache_read_tokens) },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl border bg-card px-4 py-3">
                        <div className="text-[11px] text-muted-foreground">{s.label}</div>
                        <div className="text-lg font-semibold">{s.value}</div>
                      </div>
                    ))}
                  </div>
                  {usage.totals.failures > 0 && (
                    <p className="text-xs text-red-600">
                      {t("ai_ops.failed_calls", { n: usage.totals.failures })}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">{t("ai_ops.cost_estimate_note")}</p>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-xl border bg-card p-5 space-y-3">
                      <h3 className="text-sm font-semibold">{t("ai_ops.by_provider")}</h3>
                      <BarList rows={usage.by_provider} labelOf={(k) => providers.find((p) => p.id === k)?.label ?? k} days={days} />
                    </div>
                    <div className="rounded-xl border bg-card p-5 space-y-3">
                      <h3 className="text-sm font-semibold">{t("ai_ops.by_task")}</h3>
                      <BarList rows={usage.by_task} labelOf={taskLabel} days={days} />
                    </div>
                    <div className="rounded-xl border bg-card p-5 space-y-3 lg:col-span-2">
                      <h3 className="text-sm font-semibold">{t("ai_ops.by_model")}</h3>
                      <BarList rows={usage.by_model} labelOf={(k) => k} days={days} />
                    </div>
                  </div>
                </>
              ) : null}
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertCircle,
  Eye, EyeOff, Copy, ArrowLeft,
} from "lucide-react";
import { Link } from "wouter";
import { APP_NAME } from "@/lib/appName";
import { cn } from "@/lib/utils";

interface IntegrationStatus {
  stripe: { configured: boolean; mode: string | null; masked_key: string; error: string | null };
  cloudinary: { configured: boolean; cloud_name: string | null; masked_api_key: string; masked_api_secret: string; plan: string | null; storage_mb: string | null; error: string | null };
  resend: { configured: boolean; from_email: string | null; ops_email: string | null; masked_key: string; error: string | null };
  ai: {
    configured: boolean;
    masked_key: string;
    model: string | null;
    cs_translate_model?: string | null;
    error: string | null;
    providers?: Array<{
      id: string;
      label: string;
      key_env: string;
      console_url: string;
      custom?: boolean;
      configured: boolean;
      masked_key: string;
      task_count: number;
    }>;
    broken_tasks?: Array<{ task: string; provider: string; missing_capabilities: string[]; provider_configured: boolean }>;
  };
  sms: {
    provider: string;
    console_url: string;
    configured: boolean;
    api_key: boolean;
    api_secret: boolean;
    sender_number: string | null;
    ad_opt_out_number: string | null;
    advertising_ready: boolean;
    kakao_pf_id: boolean;
    missing: string[];
    masked_key: string;
  };
  maps: { provider: string; configured: boolean; note: string };
  ical: { provider: string; configured: boolean; note: string };
  billing?: { recurring_invoices_enabled: boolean; lease_rent_invoices_enabled?: boolean };
  modules?: { homestay_enabled: boolean };
}

type BadgeVariant = "connected" | "test" | "not-required" | "not-configured" | "error";

function StatusBadge({ variant, label }: { variant: BadgeVariant; label: string }) {
  const styles: Record<BadgeVariant, string> = {
    connected: "bg-green-100 text-green-800 border-green-200",
    test: "bg-amber-100 text-amber-800 border-amber-200",
    "not-required": "bg-blue-100 text-blue-800 border-blue-200",
    "not-configured": "bg-gray-100 text-gray-600 border-gray-200",
    error: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", styles[variant])}>
      {label}
    </span>
  );
}

function MaskedKeyInput({ value, envKey, onSaved }: { value: string; envKey: string; onSaved: () => void }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newVal, setNewVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    if (!newVal.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await apiFetch("/api/v1/integrations/update-env", {
        method: "POST",
        body: JSON.stringify({ key: envKey, value: newVal.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const err = (data as any).error;
        setSaveError(typeof err === "string" ? err : err?.message ?? t("integrations.save_failed", { status: res.status }));
        return;
      }
      setEditing(false);
      setNewVal("");
      setSaveError(null);
      onSaved();
    } catch {
      setSaveError(t("common.network_error"));
    } finally {
      setSaving(false);
    }
  }

  function handleCopy() {
    if (value) {
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  if (editing) {
    return (
      <div className="space-y-1">
        <div className="flex gap-2">
          <Input
            type="text"
            value={newVal}
            onChange={(e) => { setNewVal(e.target.value); setSaveError(null); }}
            placeholder={t("integrations.enter_key", { key: envKey })}
            className="h-8 text-xs font-mono flex-1"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={saving || !newVal.trim()}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : t("common.save")}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setEditing(false); setSaveError(null); }}>{t("common.cancel")}</Button>
        </div>
        {saveError && <p className="text-xs text-red-600">{saveError}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
        {value || t("integrations.not_set")}
      </code>
      {value && (
        <>
          <button onClick={() => setVisible((v) => !v)} className="text-muted-foreground hover:text-foreground transition-colors">
            {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <button onClick={handleCopy} className="text-muted-foreground hover:text-foreground transition-colors">
            {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </>
      )}
      <button className="text-xs text-primary hover:underline ml-1" onClick={() => setEditing(true)}>
        {value ? t("integrations.change") : t("integrations.set")}
      </button>
    </div>
  );
}

function StripeFields({ status, onRefresh }: { status: IntegrationStatus | null; onRefresh: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t("integrations.stripe_secret_key")}</Label>
        <MaskedKeyInput value={status?.stripe.masked_key ?? ""} envKey="STRIPE_SECRET_KEY" onSaved={onRefresh} />
      </div>
      {status?.stripe.mode && (
        <p className="text-xs text-muted-foreground">{t("integrations.mode")} <strong>{status.stripe.mode}</strong></p>
      )}
      {status?.stripe.error && <p className="text-xs text-red-600">{status.stripe.error}</p>}
    </div>
  );
}

function CloudinaryFields({ status, onRefresh }: { status: IntegrationStatus | null; onRefresh: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t("integrations.cloudinary_cloud_name")}</Label>
        <MaskedKeyInput value={status?.cloudinary.cloud_name ?? ""} envKey="CLOUDINARY_CLOUD_NAME" onSaved={onRefresh} />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t("integrations.cloudinary_api_key")}</Label>
        <MaskedKeyInput value={status?.cloudinary.masked_api_key ?? ""} envKey="CLOUDINARY_API_KEY" onSaved={onRefresh} />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t("integrations.cloudinary_api_secret")}</Label>
        <MaskedKeyInput value={status?.cloudinary.masked_api_secret ?? ""} envKey="CLOUDINARY_API_SECRET" onSaved={onRefresh} />
      </div>
      {status?.cloudinary.plan && (
        <p className="text-xs text-muted-foreground">
          Plan: <strong>{status.cloudinary.plan}</strong> · Storage: <strong>{status.cloudinary.storage_mb}MB</strong>
        </p>
      )}
      {status?.cloudinary.error && <p className="text-xs text-red-600">{status.cloudinary.error}</p>}
    </div>
  );
}

function ResendFields({ status, onRefresh }: { status: IntegrationStatus | null; onRefresh: () => void }) {
  const { t } = useTranslation();
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  async function sendTest() {
    setSending(true);
    setSendResult(null);
    try {
      const res = await apiFetch("/api/v1/integrations/resend/test", {
        method: "POST",
        body: JSON.stringify({ to_email: testEmail }),
      });
      const data = await res.json() as { success: boolean; message_id?: string; error?: string | { code?: string; message?: string } };
      const errMsg = typeof data.error === "string" ? data.error : data.error?.message ?? t("integrations.unknown_error");
      setSendResult(data.success ? t("integrations.send_success", { id: data.message_id }) : t("integrations.send_error", { msg: errMsg }));
    } catch {
      setSendResult(t("integrations.send_network_error"));
    } finally {
      setSending(false);
    }
  }

  const notConfigured = !status?.resend.configured;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t("integrations.resend_api_key")}</Label>
        <MaskedKeyInput value={status?.resend.masked_key ?? ""} envKey="RESEND_API_KEY" onSaved={onRefresh} />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t("integrations.from_email")}</Label>
        <MaskedKeyInput value={status?.resend.from_email ?? ""} envKey="EMAIL_FROM" onSaved={onRefresh} />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t("integrations.ops_email")}</Label>
        <MaskedKeyInput value={status?.resend.ops_email ?? ""} envKey="LEAD_NOTIFICATION_EMAIL" onSaved={onRefresh} />
        <p className="text-xs text-muted-foreground">
          {t("integrations.ops_email_hint")}
        </p>
      </div>
      <div className="space-y-1">
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder={t("integrations.test_recipient_ph")}
            className="h-8 text-xs flex-1"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            disabled={notConfigured}
          />
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={sendTest}
            disabled={sending || !testEmail || notConfigured}
          >
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("integrations.send_test")}
          </Button>
        </div>
        {notConfigured && (
          <p className="text-xs text-amber-600">
            {t("integrations.send_test_hint")}
          </p>
        )}
      </div>
      {sendResult && (
        <p className={`text-xs font-medium ${sendResult.startsWith("✓") ? "text-green-600" : "text-red-600"}`}>
          {sendResult}
        </p>
      )}
    </div>
  );
}

interface CardDef {
  id: string;
  emoji: string;
  name: string;
  description: string;
  getBadge: (status: IntegrationStatus | null) => { variant: BadgeVariant; label: string; labelVars?: { suffix?: string } };
  Fields: React.ComponentType<{ status: IntegrationStatus | null; onRefresh: () => void }>;
  testEndpoint?: string;
  testLabel?: string;
  isComingSoon?: boolean;
}

const MapsFields = () => {
  const { t } = useTranslation();
  return <p className="text-sm text-muted-foreground">{t("integrations.maps_body")}</p>;
};

const ICalFields = () => {
  const { t } = useTranslation();
  return <p className="text-sm text-muted-foreground">{t("integrations.ical_body")}</p>;
};

const AiFields = ({ status, onRefresh }: { status: IntegrationStatus | null; onRefresh: () => void }) => {
  const { t } = useTranslation();
  // Falls back to a single Anthropic row on an api-server that predates the
  // multi-provider roster, so the card never renders empty during a rollout.
  const providers = status?.ai.providers ?? [
    {
      id: "anthropic",
      label: "Anthropic (Claude)",
      key_env: "ANTHROPIC_API_KEY",
      console_url: "https://console.anthropic.com",
      configured: status?.ai.configured ?? false,
      masked_key: status?.ai.masked_key ?? "",
      task_count: 0,
    },
  ];
  const broken = status?.ai.broken_tasks ?? [];

  return (
    <div className="space-y-3">
      {providers.map((p) => (
        <div key={p.id} className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            {p.label}
            {p.task_count > 0 && (
              <span className="text-[10px] text-muted-foreground/70">
                {t("integrations.ai_task_count", { count: p.task_count })}
              </span>
            )}
          </Label>
          <MaskedKeyInput value={p.masked_key} envKey={p.key_env} onSaved={onRefresh} />
        </div>
      ))}

      {broken.length > 0 && (
        <p className="text-xs text-amber-600">
          {t("integrations.ai_broken_tasks", { count: broken.length })}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        {t("integrations.ai_key_hint")}
        {status?.ai.model && <> · {t("integrations.ai_model", { model: status.ai.model })}</>}
      </p>

      <div className="pt-1">
        <Link href="/settings/ai">
          <Button size="sm" className="h-8 text-xs">{t("integrations.open_ai_ops")}</Button>
        </Link>
      </div>

      {status?.ai.error && <p className="text-xs text-red-600">{status.ai.error}</p>}
    </div>
  );
};

const BillingFields = ({ status, onRefresh }: { status: IntegrationStatus | null; onRefresh: () => void }) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const enabled = status?.billing?.recurring_invoices_enabled ?? false;
  async function toggle() {
    setSaving(true);
    try {
      await apiFetch("/api/v1/integrations/update-env", {
        method: "POST",
        body: JSON.stringify({ key: "RECURRING_INVOICES_ENABLED", value: enabled ? "false" : "true" }),
      });
      onRefresh();
    } finally {
      setSaving(false);
    }
  }
  const leaseEnabled = status?.billing?.lease_rent_invoices_enabled ?? false;
  const [leaseSaving, setLeaseSaving] = useState(false);
  async function toggleLease() {
    setLeaseSaving(true);
    try {
      await apiFetch("/api/v1/integrations/update-env", {
        method: "POST",
        body: JSON.stringify({ key: "LEASE_RENT_INVOICES_ENABLED", value: leaseEnabled ? "false" : "true" }),
      });
      onRefresh();
    } finally {
      setLeaseSaving(false);
    }
  }
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Button size="sm" variant={enabled ? "outline" : "default"} className="h-8 text-xs" onClick={toggle} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : enabled ? t("common.disable") : t("common.enable")}
          </Button>
          <span className="text-sm">{enabled ? t("common.enabled") : t("common.disabled")}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          When enabled, a daily job (02:30 Sydney) auto-generates the next due invoice for any
          contract schedule set to <strong>incremental</strong> billing. Legacy contracts whose invoices
          were pre-generated up front are never affected. Off by default.
        </p>
      </div>
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center gap-3">
          <Button size="sm" variant={leaseEnabled ? "outline" : "default"} className="h-8 text-xs" onClick={toggleLease} disabled={leaseSaving}>
            {leaseSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : leaseEnabled ? t("common.disable") : t("common.enable")}
          </Button>
          <span className="text-sm">{t("integrations.lease_rent_title")} — {leaseEnabled ? t("common.enabled") : t("common.disabled")}</span>
        </div>
        <p className="text-xs text-muted-foreground">{t("integrations.lease_rent_desc")}</p>
      </div>
    </div>
  );
};

const ModulesFields = ({ status, onRefresh }: { status: IntegrationStatus | null; onRefresh: () => void }) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  // Defaults to enabled when the toggle has never been saved.
  const enabled = status?.modules?.homestay_enabled ?? true;
  async function toggle() {
    setSaving(true);
    try {
      await apiFetch("/api/v1/integrations/update-env", {
        method: "POST",
        body: JSON.stringify({ key: "HOMESTAY_MODULE_ENABLED", value: enabled ? "false" : "true" }),
      });
      onRefresh();
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button size="sm" variant={enabled ? "outline" : "default"} className="h-8 text-xs" onClick={toggle} disabled={saving}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : enabled ? t("common.disable") : t("common.enable")}
        </Button>
        <span className="text-sm">{enabled ? t("common.enabled") : t("common.disabled")}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("integrations.modules_body")}
      </p>
    </div>
  );
};

const GoogleSheetsFields = () => {
  const { t } = useTranslation();
  return (
  <div className="space-y-3 text-sm">
    <p className="text-muted-foreground">
      {t("integrations.sheets_body")}
    </p>
    <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground">
      <li>{t("integrations.sheets_step1")}</li>
      <li>{t("integrations.sheets_step2")}</li>
      <li>{t("integrations.sheets_step3", { menu: `${APP_NAME} → Pull latest` })}</li>
    </ol>
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <Link href="/settings/api-keys">
        <Button size="sm" className="h-8 text-xs">{t("integrations.issue_api_key")}</Button>
      </Link>
      <a
        href="https://github.com/sunjae2020/millionstay/blob/main/docs/integrations/google-sheets-homestay.md"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Button size="sm" variant="outline" className="h-8 text-xs">{t("integrations.setup_guide")}</Button>
      </a>
    </div>
  </div>
  );
};

/**
 * 문자·알림톡(SOLAPI). 개통을 막는 것은 대개 값 하나라서, 무엇이 비었는지를 먼저
 * 보여 주고 그다음에 입력칸을 준다. "연결 확인" 은 잔액 조회(무료)이고, 번호를 넣고
 * 누르면 그 번호로 실제 한 통이 나간다 — 발신번호 사전등록이 끝났는지는 그때 갈린다.
 */
const SmsFields = ({ status, onRefresh }: { status: IntegrationStatus | null; onRefresh: () => void }) => {
  const { t } = useTranslation();
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const sms = status?.sms;

  async function sendTest() {
    setSending(true);
    setResult(null);
    try {
      const res = await apiFetch("/api/v1/integrations/solapi/test", {
        method: "POST",
        body: JSON.stringify(to.trim() ? { to: to.trim() } : {}),
      });
      const data = await res.json();
      if (data.success) {
        setResult({
          ok: true,
          msg: to.trim()
            ? t("integrations.sms_test_sent")
            : t("integrations.sms_balance_ok", { balance: Number(data.balance ?? 0).toLocaleString() }),
        });
        onRefresh();
      } else {
        setResult({ ok: false, msg: data.error ?? t("integrations.test_failed") });
      }
    } catch {
      setResult({ ok: false, msg: t("integrations.request_failed") });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
      {sms && sms.missing.length > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {t("integrations.sms_missing", { keys: sms.missing.join(", ") })}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t("integrations.sms_api_key")}</Label>
        <MaskedKeyInput value={sms?.masked_key ?? ""} envKey="SOLAPI_API_KEY" onSaved={onRefresh} />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t("integrations.sms_api_secret")}</Label>
        <MaskedKeyInput value={sms?.api_secret ? "••••••••" : ""} envKey="SOLAPI_API_SECRET" onSaved={onRefresh} />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t("integrations.sms_sender")}</Label>
        <MaskedKeyInput value={sms?.sender_number ?? ""} envKey="SMS_SENDER_NUMBER" onSaved={onRefresh} />
        <p className="text-[11px] text-muted-foreground">{t("integrations.sms_sender_hint")}</p>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t("integrations.sms_opt_out")}</Label>
        <MaskedKeyInput value={sms?.ad_opt_out_number ?? ""} envKey="SMS_AD_OPT_OUT_NUMBER" onSaved={onRefresh} />
        <p className="text-[11px] text-muted-foreground">{t("integrations.sms_opt_out_hint")}</p>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t("integrations.sms_kakao_pf")}</Label>
        <MaskedKeyInput value={sms?.kakao_pf_id ? "••••••••" : ""} envKey="KAKAO_PF_ID" onSaved={onRefresh} />
        <p className="text-[11px] text-muted-foreground">{t("integrations.sms_kakao_hint")}</p>
      </div>

      <div className="border-t pt-3 space-y-2">
        <Label className="text-xs text-muted-foreground">{t("integrations.sms_test_title")}</Label>
        <div className="flex gap-2">
          <Input
            value={to}
            onChange={(e) => { setTo(e.target.value); setResult(null); }}
            placeholder={t("integrations.sms_test_placeholder")}
            className="h-8 text-xs font-mono flex-1"
          />
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={sendTest} disabled={sending}>
            {sending && <Loader2 className="h-3 w-3 animate-spin" />}
            {to.trim() ? t("integrations.sms_send_test") : t("integrations.sms_check_balance")}
          </Button>
        </div>
        {result && (
          <p className={cn("text-xs", result.ok ? "text-green-700" : "text-red-600")}>{result.msg}</p>
        )}
        <a href={sms?.console_url ?? "https://console.solapi.com"} target="_blank" rel="noopener noreferrer"
           className="text-xs text-primary hover:underline">
          {t("integrations.sms_console")} ↗
        </a>
      </div>
    </div>
  );
};

const CARDS: CardDef[] = [
  {
    id: "stripe",
    emoji: "💳",
    name: "integrations.card_stripe",
    description: "integrations.card_stripe_desc",
    getBadge: (s) => {
      if (!s) return { variant: "not-configured", label: "integrations.badge_not_configured" };
      if (s.stripe.error) return { variant: "error", label: "integrations.badge_error" };
      if (!s.stripe.configured) return { variant: "not-configured", label: "integrations.badge_not_configured" };
      return s.stripe.mode === "live"
        ? { variant: "connected", label: "integrations.badge_live" }
        : { variant: "test", label: "integrations.badge_test" };
    },
    Fields: StripeFields,
    testEndpoint: "/api/v1/integrations/stripe/test",
    testLabel: "integrations.test_stripe",
  },
  {
    id: "cloudinary",
    emoji: "☁️",
    name: "integrations.card_cloudinary",
    description: "integrations.card_cloudinary_desc",
    getBadge: (s) => {
      if (!s) return { variant: "not-configured", label: "integrations.badge_not_configured" };
      if (s.cloudinary.error) return { variant: "error", label: "integrations.badge_error_credentials" };
      if (!s.cloudinary.configured) return { variant: "not-configured", label: "integrations.badge_not_configured" };
      return { variant: "connected", label: "integrations.badge_connected", labelVars: s.cloudinary.storage_mb ? { suffix: ` · ${s.cloudinary.storage_mb}MB` } : undefined };
    },
    Fields: CloudinaryFields,
    testEndpoint: "/api/v1/integrations/cloudinary/test",
    testLabel: "integrations.test_cloudinary",
  },
  {
    id: "resend",
    emoji: "📧",
    name: "integrations.card_resend",
    description: "integrations.card_resend_desc",
    getBadge: (s) => {
      if (!s) return { variant: "not-configured", label: "integrations.badge_not_configured" };
      if (s.resend.error) return { variant: "error", label: "integrations.badge_error" };
      if (!s.resend.configured) return { variant: "not-configured", label: "integrations.badge_not_configured" };
      return { variant: "connected", label: "integrations.badge_connected" };
    },
    Fields: ResendFields,
  },
  {
    id: "sms",
    emoji: "💬",
    name: "integrations.card_sms",
    description: "integrations.card_sms_desc",
    getBadge: (s) => {
      if (!s?.sms) return { variant: "not-configured", label: "integrations.badge_not_configured" };
      if (!s.sms.configured) return { variant: "not-configured", label: "integrations.badge_not_configured" };
      // 알림톡까지 붙으면 그렇게 표시한다 — 요금과 도달률이 눈에 띄게 달라진다.
      return s.sms.kakao_pf_id
        ? { variant: "connected", label: "integrations.badge_connected", labelVars: { suffix: " · Kakao" } }
        : { variant: "connected", label: "integrations.badge_connected" };
    },
    Fields: SmsFields,
  },
  {
    id: "maps",
    emoji: "🗺️",
    name: "integrations.card_maps",
    description: "integrations.card_maps_desc",
    getBadge: () => ({ variant: "not-required", label: "integrations.badge_not_required" }),
    Fields: MapsFields,
  },
  {
    id: "ical",
    emoji: "📅",
    name: "integrations.card_ical",
    description: "integrations.card_ical_desc",
    getBadge: (s) => {
      if (!s) return { variant: "not-configured", label: "integrations.badge_not_configured" };
      return s.ical.configured
        ? { variant: "connected", label: "integrations.badge_connected" }
        : { variant: "not-configured", label: "integrations.badge_not_configured" };
    },
    Fields: ICalFields,
  },
  {
    id: "ai",
    emoji: "🤖",
    name: "integrations.card_ai",
    description: "integrations.card_ai_desc",
    getBadge: (s) => {
      if (!s) return { variant: "not-configured", label: "integrations.badge_not_configured" };
      if (s.ai.error) return { variant: "error", label: "integrations.badge_error" };
      if (!s.ai.configured) return { variant: "not-configured", label: "integrations.badge_not_configured" };
      return { variant: "connected", label: "integrations.badge_connected" };
    },
    Fields: AiFields,
    testEndpoint: "/api/v1/integrations/anthropic/test",
    testLabel: "integrations.test_ai",
  },
  {
    id: "google-sheets",
    emoji: "📊",
    name: "integrations.card_sheets",
    description: "integrations.card_sheets_desc",
    getBadge: () => ({ variant: "not-required", label: "integrations.badge_self_service" }),
    Fields: GoogleSheetsFields,
  },
  {
    id: "billing",
    emoji: "🔁",
    name: "integrations.card_billing",
    description: "integrations.card_billing_desc",
    getBadge: (s) => {
      if (!s) return { variant: "not-configured", label: "integrations.badge_not_configured" };
      return s.billing?.recurring_invoices_enabled
        ? { variant: "connected", label: "integrations.badge_enabled" }
        : { variant: "not-configured", label: "integrations.badge_disabled" };
    },
    Fields: BillingFields,
  },
  {
    id: "modules",
    emoji: "🧩",
    name: "integrations.card_modules",
    description: "integrations.card_modules_desc",
    getBadge: (s) => {
      if (!s) return { variant: "not-configured", label: "integrations.badge_not_configured" };
      return s.modules?.homestay_enabled ?? true
        ? { variant: "connected", label: "integrations.badge_enabled" }
        : { variant: "not-configured", label: "integrations.badge_disabled" };
    },
    Fields: ModulesFields,
  },
];

function IntegrationCard({
  card,
  status,
  onRefresh,
}: {
  card: CardDef;
  status: IntegrationStatus | null;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const { variant, label, labelVars } = card.getBadge(status);

  async function handleTest() {
    if (!card.testEndpoint) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiFetch(card.testEndpoint, { method: "POST", body: JSON.stringify({}) });
      const data = await res.json();
      if (data.success) {
        const details = data.mode ? ` · ${data.mode} mode` : data.storage_mb ? ` · ${data.storage_mb}MB` : "";
        setTestResult({ ok: true, msg: `${t("integrations.connected")}${details}` });
      } else {
        setTestResult({ ok: false, msg: data.error ?? t("integrations.test_failed") });
      }
    } catch {
      setTestResult({ ok: false, msg: t("integrations.request_failed") });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className={cn(
      "rounded-xl border bg-card transition-all",
      expanded && "ring-1 ring-primary/20",
      card.isComingSoon && "opacity-60",
    )}>
      <button
        className="w-full flex items-center gap-4 p-5 text-left"
        onClick={() => !card.isComingSoon && setExpanded((v) => !v)}
        disabled={card.isComingSoon}
      >
        <span className="text-2xl shrink-0">{card.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{t(card.name)}</span>
            <StatusBadge variant={variant} label={`${t(label)}${labelVars?.suffix ?? ""}`} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{t(card.description)}</p>
        </div>
        {!card.isComingSoon && (
          expanded
            ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t pt-4">
          <card.Fields status={status} onRefresh={onRefresh} />

          {testResult && (
            <div className={cn(
              "flex items-center gap-2 text-xs rounded-lg px-3 py-2",
              testResult.ok
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200",
            )}>
              {testResult.ok
                ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                : <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              }
              {testResult.msg}
            </div>
          )}

          {card.testEndpoint && (
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={handleTest}
                disabled={testing}
              >
                {testing && <Loader2 className="h-3 w-3 animate-spin" />}
                {card.testLabel ? t(card.testLabel) : t("integrations.test_connection")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function IntegrationsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "Super Admin";
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchStatus(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await apiFetch(`/api/v1/integrations/status?t=${Date.now()}`);
      const data = await res.json();
      if (data.success) setStatus(data.data);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => { fetchStatus(); }, []);

  return (
    <Layout>
      <PageHeader
        title={t("nav.integrations")}
        subtitle={t("integrations.subtitle")}
        actions={
          <Link href="/settings">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> {t("common.back_to_settings")}
            </Button>
          </Link>
        }
      />
      <div className="p-6 max-w-3xl">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("integrations.loading_status")}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CARDS.map((card) => (
              <IntegrationCard
                key={card.id}
                card={card}
                status={status}
                onRefresh={() => fetchStatus(true)}
              />
            ))}
          </div>
        )}
        {!isSuperAdmin && status && (
          <p className="text-xs text-muted-foreground mt-6">
            {t("integrations.super_admin_required")}
          </p>
        )}
      </div>
    </Layout>
  );
}

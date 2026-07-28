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
  ai: { configured: boolean; masked_key: string; model: string | null; error: string | null };
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
  getBadge: (status: IntegrationStatus | null) => { variant: BadgeVariant; label: string };
  Fields: React.ComponentType<{ status: IntegrationStatus | null; onRefresh: () => void }>;
  testEndpoint?: string;
  testLabel?: string;
  isComingSoon?: boolean;
}

const MapsFields = () => (
  <p className="text-sm text-muted-foreground">
    Uses <strong>OpenStreetMap / Nominatim</strong> for geocoding and Leaflet for map rendering.
    No API key or configuration needed.
  </p>
);

const ICalFields = () => (
  <p className="text-sm text-muted-foreground">
    Configure iCal Import URLs on each <strong>Space</strong> detail page under the OTA Sync section.
    Availability will be synced automatically.
  </p>
);

const AiFields = ({ status, onRefresh }: { status: IntegrationStatus | null; onRefresh: () => void }) => {
  const { t } = useTranslation();
  return (
  <div className="space-y-3">
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{t("integrations.anthropic_api_key")}</Label>
      <MaskedKeyInput value={status?.ai.masked_key ?? ""} envKey="ANTHROPIC_API_KEY" onSaved={onRefresh} />
    </div>
    <p className="text-xs text-muted-foreground">
      Powers the landing-page chat assistant. Get a key at{" "}
      <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
        console.anthropic.com
      </a>
      {status?.ai.model && <> · Model: <strong>{status.ai.model}</strong></>}.
    </p>
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
        When enabled, the sidebar shows the <strong>Homestay</strong> intake workflow —
        Homestay Applications, Student Requests and Homestay Placements. Turn it off for
        tenants that do not run homestay (the menus and their pages are hidden). Changes
        appear after the next refresh; reload the app to update the sidebar immediately.
      </p>
    </div>
  );
};

const GoogleSheetsFields = () => {
  const { t } = useTranslation();
  return (
  <div className="space-y-3 text-sm">
    <p className="text-muted-foreground">
      Sync the <strong>Homestay Student Applications</strong> ops queue with a Google Sheet.
      Editing a row's <strong>status</strong> or <strong>notes</strong> in the sheet updates the
      matching application in real time. Student/guardian details stay read-only.
    </p>
    <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground">
      <li>
        Issue an API key with the <code className="bg-muted px-1 rounded">homestay:read</code> and{" "}
        <code className="bg-muted px-1 rounded">homestay:write</code> scopes.
      </li>
      <li>In your Google Sheet, add the provided Apps Script and paste the key into Script Properties.</li>
      <li>Run the install step once, then use the sheet's <strong>{APP_NAME} → Pull latest</strong> menu.</li>
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

const CARDS: CardDef[] = [
  {
    id: "stripe",
    emoji: "💳",
    name: "Stripe Payments",
    description: "Process payments, subscriptions, and invoices",
    getBadge: (s) => {
      if (!s) return { variant: "not-configured", label: "Not Configured" };
      if (s.stripe.error) return { variant: "error", label: "Error" };
      if (!s.stripe.configured) return { variant: "not-configured", label: "Not Configured" };
      return s.stripe.mode === "live"
        ? { variant: "connected", label: "Live Mode" }
        : { variant: "test", label: "Test Mode" };
    },
    Fields: StripeFields,
    testEndpoint: "/api/v1/integrations/stripe/test",
    testLabel: "Test Stripe",
  },
  {
    id: "cloudinary",
    emoji: "☁️",
    name: "Cloudinary Storage",
    description: "Photo storage and automatic image optimisation",
    getBadge: (s) => {
      if (!s) return { variant: "not-configured", label: "Not Configured" };
      if (s.cloudinary.error) return { variant: "error", label: "Error — check credentials" };
      if (!s.cloudinary.configured) return { variant: "not-configured", label: "Not Configured" };
      return { variant: "connected", label: s.cloudinary.storage_mb ? `Connected · ${s.cloudinary.storage_mb}MB` : "Connected" };
    },
    Fields: CloudinaryFields,
    testEndpoint: "/api/v1/integrations/cloudinary/test",
    testLabel: "Test Cloudinary",
  },
  {
    id: "resend",
    emoji: "📧",
    name: "Resend Email",
    description: "Transactional emails for bookings, invoices, and notifications",
    getBadge: (s) => {
      if (!s) return { variant: "not-configured", label: "Not Configured" };
      if (s.resend.error) return { variant: "error", label: "Error" };
      if (!s.resend.configured) return { variant: "not-configured", label: "Not Configured" };
      return { variant: "connected", label: "Connected" };
    },
    Fields: ResendFields,
  },
  {
    id: "maps",
    emoji: "🗺️",
    name: "Maps",
    description: "Interactive maps and geocoding via OpenStreetMap — no API key required",
    getBadge: () => ({ variant: "not-required", label: "Not Required" }),
    Fields: MapsFields,
  },
  {
    id: "ical",
    emoji: "📅",
    name: "OTA / iCal Sync",
    description: "Sync availability from Airbnb, Booking.com and other OTA platforms via iCal",
    getBadge: (s) => {
      if (!s) return { variant: "not-configured", label: "Not Configured" };
      return s.ical.configured
        ? { variant: "connected", label: "Connected" }
        : { variant: "not-configured", label: "Not Configured" };
    },
    Fields: ICalFields,
  },
  {
    id: "ai",
    emoji: "🤖",
    name: "AI Chatbot",
    description: "AI-powered guest assistant for the landing-page chat widget",
    getBadge: (s) => {
      if (!s) return { variant: "not-configured", label: "Not Configured" };
      if (s.ai.error) return { variant: "error", label: "Error" };
      if (!s.ai.configured) return { variant: "not-configured", label: "Not Configured" };
      return { variant: "connected", label: "Connected" };
    },
    Fields: AiFields,
    testEndpoint: "/api/v1/integrations/anthropic/test",
    testLabel: "Test AI",
  },
  {
    id: "google-sheets",
    emoji: "📊",
    name: "Google Sheets",
    description: "Sync Homestay Student Applications with a Google Sheet (status & ops notes)",
    getBadge: () => ({ variant: "not-required", label: "Self-service" }),
    Fields: GoogleSheetsFields,
  },
  {
    id: "billing",
    emoji: "🔁",
    name: "Recurring Billing",
    description: "Auto-generate periodic rent invoices for long-term contracts on incremental billing",
    getBadge: (s) => {
      if (!s) return { variant: "not-configured", label: "Not Configured" };
      return s.billing?.recurring_invoices_enabled
        ? { variant: "connected", label: "Enabled" }
        : { variant: "not-configured", label: "Disabled" };
    },
    Fields: BillingFields,
  },
  {
    id: "modules",
    emoji: "🧩",
    name: "Homestay Module",
    description: "Show or hide the Homestay intake workflow (applications, student requests, placements)",
    getBadge: (s) => {
      if (!s) return { variant: "not-configured", label: "Not Configured" };
      return s.modules?.homestay_enabled ?? true
        ? { variant: "connected", label: "Enabled" }
        : { variant: "not-configured", label: "Disabled" };
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
  const { variant, label } = card.getBadge(status);

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
            <span className="font-semibold text-sm">{card.name}</span>
            <StatusBadge variant={variant} label={label} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{card.description}</p>
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
                {card.testLabel ?? t("integrations.test_connection")}
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

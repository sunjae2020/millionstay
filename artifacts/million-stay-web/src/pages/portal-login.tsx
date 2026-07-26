import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Loader2, ArrowLeft, Briefcase, Home, Wrench } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { getApiBase } from "@/lib/api-base";
import {
  partnerPortalLoginUrl,
  partnerApplyUrl,
  PARTNER_PORTAL_TYPES,
  type PartnerPortalType,
} from "@/lib/partner-portals";

type Mode = "signin" | "forgot";

const APPLY_META: Record<PartnerPortalType, { icon: typeof Briefcase; labelKey: string }> = {
  agent: { icon: Briefcase, labelKey: "portalLogin.role_agent" },
  owner: { icon: Home, labelKey: "portalLogin.role_owner" },
  service_host: { icon: Wrench, labelKey: "portalLogin.role_service_host" },
};

/**
 * Unified partner login for the landing site. One form authenticates any
 * partner (agent / owner / service host); the API returns portal_type, and we
 * redirect straight into that portal via a cross-origin SSO hand-off. Admins are
 * intentionally excluded — they use the separate admin portal.
 */
export default function PortalLogin() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/v1/auth/partner/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || t("portalLogin.invalid"));
        return;
      }
      const target = partnerPortalLoginUrl(data.user?.portal_type, data.token);
      if (!target) {
        setError(t("portalLogin.unknown_portal"));
        return;
      }
      window.location.href = target;
    } catch {
      setError(t("portalLogin.network_error"));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await fetch(`${getApiBase()}/api/v1/auth/partner/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      // Always report success — the API never reveals whether an account exists.
      setSent(true);
    } catch {
      setError(t("portalLogin.network_error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] flex flex-col">
      <div className="flex items-center justify-between px-4 sm:px-6 h-16 border-b border-gray-100 bg-white">
        <Link href="/" className="flex items-center">
          <BrandMark className="h-12 w-auto" />
        </Link>
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" /> {t("portalLogin.back_home")}
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-primary">
              {t("portalLogin.eyebrow")}
            </p>
            <h1 className="text-2xl font-bold text-slate-900 mt-2">
              {mode === "signin" ? t("portalLogin.title") : t("portalLogin.forgot_title")}
            </h1>
            <p className="text-slate-500 text-sm mt-1.5">
              {mode === "signin" ? t("portalLogin.subtitle") : t("portalLogin.forgot_subtitle")}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
            {mode === "forgot" && sent ? (
              <div className="text-center space-y-4 py-2">
                <p className="text-sm text-slate-600">{t("portalLogin.forgot_sent")}</p>
                <button
                  onClick={() => { setMode("signin"); setSent(false); }}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  {t("portalLogin.back_to_signin")}
                </button>
              </div>
            ) : (
              <form onSubmit={mode === "signin" ? handleSignIn : handleForgot} className="space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                    {t("portalLogin.email")}
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder={t("portalLogin.email_placeholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent"
                  />
                </div>

                {mode === "signin" && (
                  <div className="space-y-1.5">
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                      {t("portalLogin.password")}
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        placeholder={t("portalLogin.password_placeholder")}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-11 px-3 pr-10 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        tabIndex={-1}
                        aria-label={showPassword ? t("portalLogin.hide_password") : t("portalLogin.show_password")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === "signin"
                    ? (loading ? t("portalLogin.signing_in") : t("portalLogin.sign_in"))
                    : (loading ? t("portalLogin.sending") : t("portalLogin.send_reset"))}
                </button>

                <div className="text-right">
                  {mode === "signin" ? (
                    <button
                      type="button"
                      onClick={() => { setMode("forgot"); setError(""); }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {t("portalLogin.forgot_link")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setMode("signin"); setError(""); }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {t("portalLogin.back_to_signin")}
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>

          {mode === "signin" && (
            <div className="mt-6">
              <p className="text-center text-xs text-slate-400 mb-3">{t("portalLogin.apply_prompt")}</p>
              <div className="grid grid-cols-3 gap-2">
                {PARTNER_PORTAL_TYPES.map((type) => {
                  const { icon: Icon, labelKey } = APPLY_META[type];
                  const href = partnerApplyUrl(type);
                  if (!href) return null;
                  return (
                    <a
                      key={type}
                      href={href}
                      className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2 py-3 text-center hover:border-primary/50 hover:shadow-sm transition-all"
                    >
                      <Icon className="h-5 w-5 text-primary" />
                      <span className="text-xs font-medium text-slate-600">{t(labelKey)}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-center text-xs text-slate-400 mt-6">{t("portalLogin.secure")}</p>
        </div>
      </div>
    </div>
  );
}

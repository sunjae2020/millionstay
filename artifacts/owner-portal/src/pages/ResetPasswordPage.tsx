import { useEffect, useState, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { Lock, Eye, EyeOff, CheckCircle2, Loader2 } from "lucide-react";
import { APP_NAME } from "@/lib/appName";

const BRAND = "hsl(var(--brand-orange))";
const API_BASE = "/api/v1";
const POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

function readToken(loc: string): string {
  if (typeof window !== "undefined" && window.location.hash) {
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const t = h.get("token");
    if (t) return t;
  }
  const qs = new URLSearchParams(loc.split("?")[1] ?? "");
  return qs.get("token") ?? "";
}

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const [token, setToken] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { setToken(readToken(location)); }, [location]);

  const policyOk = POLICY_REGEX.test(pw);
  const pwMatches = pw && pw === pw2;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!policyOk) { setError(t("auth.err_policy")); return; }
    if (!pwMatches) { setError(t("auth.err_mismatch")); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/partner/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: pw }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) { setError(json?.error ?? t("auth.err_reset_failed")); setLoading(false); return; }
      setDone(true);
    } catch { setError(t("auth.err_network")); }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] p-6">
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-md p-8 space-y-6">
        <div>
          {import.meta.env.VITE_LOGO_MODE === "text" ? (
            <span className="font-display font-extrabold tracking-tight text-primary text-xl whitespace-nowrap block mb-6">{APP_NAME}</span>
          ) : (
            <img src={import.meta.env.VITE_LOGO_URL || `${import.meta.env.BASE_URL}logo-horizontal.png`} alt={APP_NAME} className={`mb-6 w-auto ${import.meta.env.VITE_LOGO_URL ? "h-11" : "h-7"}`} />
          )}
          <h1 className="text-2xl font-bold text-slate-900">{t("auth.reset_title")}</h1>
          <p className="text-slate-500 text-sm mt-1">{t("auth.reset_subtitle")}</p>
        </div>

        {!token && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {t("auth.reset_needs_link")}
          </div>
        )}

        {done ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <p className="text-slate-700 text-sm">{t("auth.reset_done")}</p>
            <button
              onClick={() => setLocation("/")}
              className="w-full h-11 rounded-lg text-sm font-semibold text-white shadow-md"
              style={{ background: `linear-gradient(135deg, ${BRAND} 0%, color-mix(in srgb, hsl(var(--brand-orange)) 72%, white) 100%)` }}
            >
              {t("auth.continue_to_login")}
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">{t("auth.new_password")}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showPw ? "text" : "password"}
                  required value={pw} onChange={(e) => setPw(e.target.value)}
                  className="w-full h-11 pl-9 pr-10 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2"
                  style={{ "--tw-ring-color": BRAND } as React.CSSProperties}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className={`text-xs mt-1 ${pw && !policyOk ? "text-red-600" : "text-slate-500"}`}>
                {t("auth.password_policy")}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">{t("auth.confirm_password")}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showPw ? "text" : "password"}
                  required value={pw2} onChange={(e) => setPw2(e.target.value)}
                  className="w-full h-11 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2"
                  style={{ "--tw-ring-color": BRAND } as React.CSSProperties}
                  autoComplete="new-password"
                />
              </div>
            </div>
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <button
              type="submit"
              disabled={loading || !token || !policyOk || !pwMatches}
              className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 shadow-md"
              style={{ background: `linear-gradient(135deg, ${BRAND} 0%, color-mix(in srgb, hsl(var(--brand-orange)) 72%, white) 100%)` }}
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("auth.updating")}</> : t("auth.set_new_password")}
            </button>
            <Link href="/"><a className="block text-center text-sm text-slate-500 hover:text-slate-700">{t("auth.back_to_login")}</a></Link>
          </form>
        )}
      </div>
    </div>
  );
}

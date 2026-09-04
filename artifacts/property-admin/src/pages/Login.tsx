import { useState, useRef, useEffect, FormEvent } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { getRememberedLoginEmail } from "@/lib/apiFetch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronDown, Eye, EyeOff, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import logoSrc from "/millionstay-logo.png";
import { APP_NAME } from "@/lib/appName";

// Honor the tenant's configured logo (VITE_LOGO_URL) and fall back to the bundled default.
const LOGO_URL = import.meta.env.VITE_LOGO_URL || logoSrc;
// White + enlarged treatment applies only to white-label tenants (those with a
// configured logo). The default MillionStay brand keeps its original styling.
const HAS_TENANT_LOGO = Boolean(import.meta.env.VITE_LOGO_URL);

const BRAND = "hsl(var(--primary))";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "th", label: "ภาษาไทย" },
  { code: "vi", label: "Tiếng Việt" },
];

function LoginLanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function changeLang(code: string) {
    i18n.changeLanguage(code);
    try { localStorage.setItem("ms_admin_language", code); } catch {}
    setOpen(false);
  }

  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors px-2 py-1.5 rounded-md hover:bg-slate-100"
      >
        <Globe className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="font-medium">{current.label}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[130px]">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => changeLang(l.code)}
              className={cn(
                "w-full text-left px-4 py-2 text-xs hover:bg-primary/10 transition-colors",
                l.code === i18n.language
                  ? "font-semibold text-primary"
                  : "text-slate-700"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Where the user was before the session ended — same-origin paths only. */
function returnPath(): string {
  try {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login")) {
      return next;
    }
  } catch {}
  return "/dashboard";
}

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  // Signing back in after a session ends shouldn't mean retyping the address.
  const [email, setEmail] = useState(getRememberedLoginEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate(returnPath());
    } catch (err: any) {
      setError(err.message ?? t("login.invalid"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel ── */}
      <div
        className="hidden lg:flex lg:w-[48%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(150deg, color-mix(in srgb, hsl(var(--brand-orange)) 10%, #0a0a0a) 0%, color-mix(in srgb, hsl(var(--brand-orange)) 18%, #0a0a0a) 55%, color-mix(in srgb, hsl(var(--brand-orange)) 10%, #0a0a0a) 100%)" }}
      >
        {/* Ambient glow blobs */}
        <div className="absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full opacity-25 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${BRAND}, transparent 70%)` }} />
        <div className="absolute -bottom-32 right-[-80px] w-[400px] h-[400px] rounded-full opacity-15 pointer-events-none"
          style={{ background: `radial-gradient(circle, color-mix(in srgb, hsl(var(--primary)) 72%, white), transparent 70%)` }} />

        {/* Logo */}
        <div className="relative z-10">
          {import.meta.env.VITE_LOGO_MODE === "text"
            ? <span className="font-display font-extrabold tracking-tight text-white text-xl whitespace-nowrap">{APP_NAME}</span>
            : <img src={LOGO_URL} alt={APP_NAME} className={HAS_TENANT_LOGO ? "h-[4.5rem] w-auto" : "h-9 w-auto"} style={HAS_TENANT_LOGO ? { filter: "brightness(0) invert(1)" } : undefined} />}
          <p className="text-white/30 text-[10px] tracking-[0.2em] uppercase mt-2 ml-0.5">
            {t("login.admin_portal")}
          </p>
        </div>

        {/* Hero copy */}
        <div className="relative z-10 space-y-7">
          <div>
            <h2 className="text-[2.4rem] font-bold text-white leading-[1.2]">
              {t("login.hero_line1")}<br />
              <span style={{ color: BRAND }}>{t("login.hero_line2")}</span><br />
              {t("login.hero_line3")}
            </h2>
            <p className="text-white/45 text-sm mt-4 leading-relaxed max-w-[280px]">
              {t("login.hero_subtitle")}
            </p>
          </div>

          <div className="flex gap-10">
            {[
              { num: "500+", label: t("login.stat_properties") },
              { num: "12k+", label: t("login.stat_bookings") },
              { num: "99.9%", label: t("login.stat_uptime") },
            ].map(({ num, label }) => (
              <div key={label}>
                <p className="text-white text-2xl font-bold">{num}</p>
                <p className="text-white/35 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-white/20 text-xs">{t("login.copyright", { year: 2026 })}</p>
        </div>
      </div>

      {/* ── Right login panel ── */}
      <div className="flex-1 flex flex-col bg-[#faf9f7]">
        {/* Top bar with language switcher */}
        <div className="flex justify-end items-center px-6 py-4">
          <LoginLanguageSwitcher />
        </div>

        {/* Centered login content */}
        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <div className="w-full max-w-[400px]">

            {/* Mobile logo */}
            <div className="lg:hidden flex justify-center mb-10">
              {import.meta.env.VITE_LOGO_MODE === "text"
                ? <span className="font-display font-extrabold tracking-tight text-primary text-xl whitespace-nowrap">{APP_NAME}</span>
                : <img src={LOGO_URL} alt={APP_NAME} className={HAS_TENANT_LOGO ? "h-16 w-auto" : "h-8 w-auto"} />}
            </div>

            {/* Heading */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900">{t("login.sign_in")}</h1>
              <p className="text-slate-500 text-sm mt-1">
                {t("login.subtitle")}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                  {t("login.email")}
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="h-11 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
                  style={{ "--tw-ring-color": BRAND } as React.CSSProperties}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                    {t("login.password")}
                  </Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium hover:underline"
                    style={{ color: BRAND }}
                  >
                    {t("login.forgot_password")}
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="h-11 bg-white border-slate-200 text-slate-900 pr-10 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 shadow-md"
                style={{ background: `linear-gradient(135deg, ${BRAND} 0%, color-mix(in srgb, hsl(var(--primary)) 72%, white) 100%)` }}
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("login.signing_in")}</>
                  : `${t("login.sign_in")} →`
                }
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-200 text-center space-y-2">
              <p className="text-xs text-slate-500">
                {t("login.no_account")}{" "}
                <Link href="/register" className="font-semibold hover:underline" style={{ color: BRAND }}>
                  {t("login.request_access")}
                </Link>
              </p>
              <p className="text-center text-xs text-slate-400">
                {t("login.secure_footer")}
              </p>
              <p className="text-center text-xs text-slate-400">
                <a
                  href="https://www.millionstay.com/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-slate-600 hover:underline"
                >
                  {t("login.privacy_policy")}
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

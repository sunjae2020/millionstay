import { useState, useRef, useEffect, FormEvent } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronDown, Eye, EyeOff, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import logoSrc from "/millionstay-logo.png";

const BRAND = "#E8621A";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "th", label: "ภาษาไทย" },
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
                "w-full text-left px-4 py-2 text-xs hover:bg-orange-50 transition-colors",
                l.code === i18n.language
                  ? "font-semibold text-[#E8621A]"
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

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
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
      navigate("/dashboard");
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
        style={{ background: "linear-gradient(150deg, #1c1008 0%, #2e1a06 55%, #1c1008 100%)" }}
      >
        {/* Ambient glow blobs */}
        <div className="absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full opacity-25 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${BRAND}, transparent 70%)` }} />
        <div className="absolute -bottom-32 right-[-80px] w-[400px] h-[400px] rounded-full opacity-15 pointer-events-none"
          style={{ background: `radial-gradient(circle, #FF9A50, transparent 70%)` }} />

        {/* Logo */}
        <div className="relative z-10">
          <img src={logoSrc} alt="MillionStay" className="h-9 w-auto" />
          <p className="text-white/30 text-[10px] tracking-[0.2em] uppercase mt-2 ml-0.5">
            Admin Portal
          </p>
        </div>

        {/* Hero copy */}
        <div className="relative z-10 space-y-7">
          <div>
            <h2 className="text-[2.4rem] font-bold text-white leading-[1.2]">
              Manage your<br />
              <span style={{ color: BRAND }}>properties</span><br />
              with confidence.
            </h2>
            <p className="text-white/45 text-sm mt-4 leading-relaxed max-w-[280px]">
              A unified platform for listings, bookings, contracts, and tenant relationships — all in one place.
            </p>
          </div>

          <div className="flex gap-10">
            {[
              { num: "500+", label: "Properties" },
              { num: "12k+", label: "Bookings" },
              { num: "99.9%", label: "Uptime" },
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
          <p className="text-white/20 text-xs">© 2026 MillionStay · All rights reserved</p>
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
              <img src={logoSrc} alt="MillionStay" className="h-8 w-auto" />
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
                  placeholder="admin@millionstay.com"
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
                    Forgot password?
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
                style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #FF8C3A 100%)` }}
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("login.signing_in")}</>
                  : `${t("login.sign_in")} →`
                }
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-200 text-center space-y-2">
              <p className="text-xs text-slate-500">
                Don't have an account?{" "}
                <Link href="/register" className="font-semibold hover:underline" style={{ color: BRAND }}>
                  Request Access
                </Link>
              </p>
              <p className="text-center text-xs text-slate-400">
                Secure access · MillionStay Admin v2
              </p>
              <p className="text-center text-xs text-slate-400">
                <a
                  href="https://www.millionstay.com/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-slate-600 hover:underline"
                >
                  Privacy Policy
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

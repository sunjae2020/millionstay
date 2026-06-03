import { useState, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiFetch";
import logoSrc from "/millionstay-logo.png";

const BRAND = "#E8621A";

export default function RegisterPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordStrength = (() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  })();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError(t("register.error_passwords_no_match"));
      return;
    }
    if (password.length < 8) {
      setError(t("register.error_password_too_short"));
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, email, password }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? t("register.error_registration_failed"));
      } else {
        setSuccess(true);
      }
    } catch {
      setError(t("register.error_registration_failed"));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-6">
        <div className="w-full max-w-[420px] text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ background: "#fff7f0", border: `2px solid ${BRAND}` }}>
              <CheckCircle className="h-8 w-8" style={{ color: BRAND }} />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("register.success_title")}</h1>
            <p className="text-slate-500 text-sm mt-2 leading-relaxed">
              {t("register.success_message")}
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full h-11 rounded-lg text-sm font-semibold text-white shadow-md"
            style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #FF8C3A 100%)` }}
          >
            {t("register.back_to_sign_in")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel ── */}
      <div
        className="hidden lg:flex lg:w-[44%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(150deg, #1c1008 0%, #2e1a06 55%, #1c1008 100%)" }}
      >
        <div className="absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full opacity-25 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${BRAND}, transparent 70%)` }} />
        <div className="absolute -bottom-32 right-[-80px] w-[400px] h-[400px] rounded-full opacity-15 pointer-events-none"
          style={{ background: `radial-gradient(circle, #FF9A50, transparent 70%)` }} />

        <div className="relative z-10">
          <img src={logoSrc} alt="MillionStay" className="h-9 w-auto" />
          <p className="text-white/30 text-[10px] tracking-[0.2em] uppercase mt-2 ml-0.5">{t("register.admin_portal")}</p>
        </div>

        <div className="relative z-10 space-y-5">
          <h2 className="text-[2rem] font-bold text-white leading-[1.2]">
            {t("register.brand_heading_line1")}<br />
            <span style={{ color: BRAND }}>MillionStay</span><br />
            {t("register.brand_heading_line3")}
          </h2>
          <p className="text-white/45 text-sm leading-relaxed max-w-[260px]">
            {t("register.brand_subtitle")}
          </p>
          <div className="space-y-3">
            {[
              t("register.step_fill_details"),
              t("register.step_admin_reviews"),
              t("register.step_get_notified"),
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold"
                  style={{ background: BRAND }}>
                  {i + 1}
                </div>
                <p className="text-white/60 text-sm">{step}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-white/20 text-xs">{t("register.copyright", { year: 2026 })}</p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center bg-[#faf9f7] px-6 py-12">
        <div className="w-full max-w-[420px]">

          <div className="lg:hidden flex justify-center mb-8">
            <img src={logoSrc} alt="MillionStay" className="h-8 w-auto" />
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-bold text-slate-900">{t("register.title")}</h1>
            <p className="text-slate-500 text-sm mt-1">
              {t("register.subtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="text-sm font-medium text-slate-700">{t("register.first_name")}</Label>
                <Input
                  id="firstName"
                  required
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder={t("register.first_name_placeholder")}
                  className="h-11 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName" className="text-sm font-medium text-slate-700">{t("register.last_name")}</Label>
                <Input
                  id="lastName"
                  required
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder={t("register.last_name_placeholder")}
                  className="h-11 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">{t("register.work_email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@millionstay.com"
                className="h-11 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">{t("register.password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t("register.password_placeholder")}
                  className="h-11 bg-white border-slate-200 text-slate-900 pr-10 placeholder:text-slate-400"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* Strength bar */}
              {password.length > 0 && (
                <div className="flex gap-1 mt-1.5">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={cn(
                      "h-1 flex-1 rounded-full transition-colors",
                      i <= passwordStrength
                        ? passwordStrength <= 1 ? "bg-red-400"
                          : passwordStrength <= 2 ? "bg-amber-400"
                          : passwordStrength <= 3 ? "bg-blue-400"
                          : "bg-green-500"
                        : "bg-slate-200"
                    )} />
                  ))}
                  <span className="text-[10px] text-slate-400 ml-1 whitespace-nowrap">
                    {["", t("register.strength_weak"), t("register.strength_fair"), t("register.strength_good"), t("register.strength_strong")][passwordStrength]}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">{t("register.confirm_password")}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder={t("register.confirm_password_placeholder")}
                  className={cn(
                    "h-11 bg-white border-slate-200 text-slate-900 pr-10 placeholder:text-slate-400",
                    confirmPassword && confirmPassword !== password && "border-red-300 focus:border-red-400"
                  )}
                />
                <button type="button" tabIndex={-1} onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
              className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 shadow-md mt-2"
              style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #FF8C3A 100%)` }}
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("register.submitting")}</> : t("register.submit_button")}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            {t("register.already_have_account")}{" "}
            <Link href="/login" className="font-semibold hover:underline" style={{ color: BRAND }}>
              {t("register.sign_in")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

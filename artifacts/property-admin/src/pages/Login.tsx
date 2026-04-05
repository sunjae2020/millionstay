import { useState, FormEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronDown, Eye, EyeOff } from "lucide-react";
import logoSrc from "/millionstay-logo.png";

const BRAND = "#E8621A";
const BRAND_DARK = "#C4511500";

const DEMO_ACCOUNTS = [
  { label: "Super Admin", email: "admin@millionstay.com.au", password: "MillionStay@2026!" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message ?? "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(account: (typeof DEMO_ACCOUNTS)[number]) {
    setEmail(account.email);
    setPassword(account.password);
    setDemoOpen(false);
    setError("");
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
      <div className="flex-1 flex items-center justify-center bg-[#faf9f7] px-6 py-12">
        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-10">
            <img src={logoSrc} alt="MillionStay" className="h-8 w-auto" />
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
            <p className="text-slate-500 text-sm mt-1">
              Enter your credentials to access the admin portal
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="admin@millionstay.com.au"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="h-11 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
                style={{ "--tw-ring-color": BRAND } as React.CSSProperties}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </Label>
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
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
                : "Sign In →"
              }
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-8 space-y-3">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center">
                <button
                  type="button"
                  onClick={() => setDemoOpen(v => !v)}
                  className="flex items-center gap-1.5 bg-[#faf9f7] px-3 text-xs text-slate-400 hover:text-slate-600 transition-colors select-none"
                >
                  Demo accounts
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${demoOpen ? "rotate-180" : ""}`} />
                </button>
              </div>
            </div>

            {demoOpen && (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100 shadow-sm">
                {DEMO_ACCOUNTS.map(account => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => fillDemo(account)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-orange-50 transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800 group-hover:text-[#E8621A] transition-colors">
                        {account.label}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{account.email}</p>
                    </div>
                    <span className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: BRAND }}>
                      Fill ↵
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="text-center text-xs text-slate-400 mt-8">
            Secure access · MillionStay Admin v2
          </p>
        </div>
      </div>
    </div>
  );
}

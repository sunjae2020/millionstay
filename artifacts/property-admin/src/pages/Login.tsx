import { useState, FormEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronDown, Eye, EyeOff } from "lucide-react";

const DEMO_ACCOUNTS = [
  { label: "Super Admin", email: "admin@millionstay.com.au", password: "MillionStay@2026!" },
];

function MillionStayLogo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="180" height="180" rx="36" fill="#FF3C00" />
      <path
        d="M30 130 L30 72 L90 36 L150 72 L150 130"
        stroke="white" strokeWidth="14" strokeLinejoin="round" strokeLinecap="round" fill="none"
      />
      <path
        d="M68 130 L68 100 Q68 90 78 90 L102 90 Q112 90 112 100 L112 130"
        fill="white"
      />
    </svg>
  );
}

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
      {/* Left brand panel */}
      <div
        className="hidden lg:flex lg:w-[46%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #1a0800 0%, #2d1000 50%, #1a0800 100%)" }}
      >
        {/* Decorative circles */}
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #FF3C00, transparent)" }}
        />
        <div
          className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #FF6A00, transparent)" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, #FF3C00, transparent)" }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <MillionStayLogo size={44} />
            <div>
              <p className="text-white text-xl font-bold tracking-tight">MillionStay</p>
              <p className="text-white/40 text-xs tracking-widest uppercase">Admin Portal</p>
            </div>
          </div>
        </div>

        {/* Center text */}
        <div className="relative z-10 space-y-6">
          <div>
            <h2 className="text-4xl font-bold text-white leading-tight">
              Manage your<br />
              <span style={{ color: "#FF3C00" }}>properties</span><br />
              with confidence.
            </h2>
            <p className="text-white/50 text-sm mt-4 leading-relaxed max-w-xs">
              A unified platform for property listings, bookings, contracts, and tenant relationships — all in one place.
            </p>
          </div>

          <div className="flex gap-8">
            {[
              { num: "500+", label: "Properties" },
              { num: "12k+", label: "Bookings" },
              { num: "99.9%", label: "Uptime" },
            ].map(({ num, label }) => (
              <div key={label}>
                <p className="text-white text-2xl font-bold">{num}</p>
                <p className="text-white/40 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-white/25 text-xs">© 2026 MillionStay · All rights reserved</p>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center bg-[#fafaf9] px-6 py-12">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10 justify-center">
            <MillionStayLogo size={36} />
            <span className="text-lg font-bold text-slate-900">MillionStay</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
            <p className="text-slate-500 text-sm mt-1">Enter your credentials to access the admin portal</p>
          </div>

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
                className="h-11 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#FF3C00] focus-visible:border-[#FF3C00]"
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
                  className="h-11 bg-white border-slate-200 text-slate-900 pr-10 placeholder:text-slate-400 focus-visible:ring-[#FF3C00] focus-visible:border-[#FF3C00]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
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
              className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-all duration-150 disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: loading ? "#cc3000" : "linear-gradient(135deg, #FF3C00, #FF6A00)" }}
              onMouseEnter={e => !loading && ((e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(135deg, #e63600, #e85e00)")}
              onMouseLeave={e => !loading && ((e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(135deg, #FF3C00, #FF6A00)")}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
              ) : (
                "Sign In →"
              )}
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
                  className="flex items-center gap-1.5 bg-[#fafaf9] px-3 text-xs text-slate-400 hover:text-slate-600 transition-colors select-none"
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
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800 group-hover:text-[#FF3C00] transition-colors">
                        {account.label}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{account.email}</p>
                    </div>
                    <span className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#FF3C00" }}>
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

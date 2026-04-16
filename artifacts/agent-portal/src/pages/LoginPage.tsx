import { useState, FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const BRAND = "#E8621A";

export default function LoginPage() {
  const { login } = useAuth();
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
    } catch (err: any) {
      setError(err.message ?? "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div
        className="hidden lg:flex lg:w-[48%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(150deg, #1c1008 0%, #2e1a06 55%, #1c1008 100%)" }}
      >
        <div className="absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full opacity-25 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${BRAND}, transparent 70%)` }} />
        <div className="absolute -bottom-32 right-[-80px] w-[400px] h-[400px] rounded-full opacity-15 pointer-events-none"
          style={{ background: `radial-gradient(circle, #FF9A50, transparent 70%)` }} />

        <div className="relative z-10">
          <img src={`${import.meta.env.BASE_URL}logo-horizontal.png`} alt="MillionStay" className="h-9 w-auto brightness-110" />
          <p className="text-white/30 text-[10px] tracking-[0.2em] uppercase mt-2 ml-0.5">
            Agent Portal
          </p>
        </div>

        <div className="relative z-10 space-y-7">
          <div>
            <h2 className="text-[2.4rem] font-bold text-white leading-[1.2]">
              Grow your book<br />
              with <span style={{ color: BRAND }}>confidence.</span>
            </h2>
            <p className="text-white/45 text-sm mt-4 leading-relaxed max-w-[280px]">
              Manage your listings, track commissions, and stay connected with your clients — all in one place.
            </p>
          </div>

          <div className="flex gap-10">
            {[
              { num: "500+", label: "Properties" },
              { num: "98%", label: "Satisfaction" },
              { num: "24/7", label: "Support" },
            ].map(({ num, label }) => (
              <div key={label}>
                <p className="text-white text-2xl font-bold">{num}</p>
                <p className="text-white/35 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-white/20 text-xs">© 2026 MillionStay · All rights reserved</p>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex flex-col bg-[#faf9f7]">
        <div className="flex justify-end items-center px-6 py-4" />

        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <div className="w-full max-w-[400px]">

            <div className="lg:hidden flex justify-center mb-10">
              <img src={`${import.meta.env.BASE_URL}logo-horizontal.png`} alt="MillionStay" className="h-8 w-auto" />
            </div>

            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
              <p className="text-slate-500 text-sm mt-1">Sign in to manage your listings</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="agent@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": BRAND } as React.CSSProperties}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full h-11 px-3 pr-10 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent"
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
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</>
                  : "Sign in →"
                }
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-200 text-center">
              <p className="text-center text-xs text-slate-400">
                Secure access · MillionStay Agent Portal
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

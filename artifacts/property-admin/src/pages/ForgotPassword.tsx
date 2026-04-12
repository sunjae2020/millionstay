import { useState, FormEvent } from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import logoSrc from "/millionstay-logo.png";

const BRAND = "#E8621A";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
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
          <p className="text-white/30 text-[10px] tracking-[0.2em] uppercase mt-2 ml-0.5">Admin Portal</p>
        </div>

        <div className="relative z-10 space-y-4">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(232,98,26,0.2)", border: "1px solid rgba(232,98,26,0.3)" }}>
            <Mail className="h-7 w-7" style={{ color: BRAND }} />
          </div>
          <h2 className="text-[2rem] font-bold text-white leading-[1.2]">
            Forgot your<br />
            <span style={{ color: BRAND }}>password?</span>
          </h2>
          <p className="text-white/45 text-sm leading-relaxed max-w-[260px]">
            No worries. Enter your registered email address and we'll send you a secure link to reset your password.
          </p>
        </div>

        <div className="relative z-10">
          <p className="text-white/20 text-xs">© 2026 MillionStay · All rights reserved</p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center bg-[#faf9f7] px-6 py-12">
        <div className="w-full max-w-[400px]">

          <div className="lg:hidden flex justify-center mb-8">
            <img src={logoSrc} alt="MillionStay" className="h-8 w-auto" />
          </div>

          {submitted ? (
            <div className="text-center space-y-5">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ background: "#fff7f0", border: `2px solid ${BRAND}` }}>
                  <Mail className="h-7 w-7" style={{ color: BRAND }} />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Check your email</h1>
                <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                  If an account exists for <strong>{email}</strong>, we've sent a password reset link. Please check your inbox (and spam folder).
                </p>
              </div>
              <p className="text-xs text-slate-400">
                The link will expire in <strong>1 hour</strong>.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center w-full h-11 rounded-lg text-sm font-semibold text-white shadow-md"
                style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #FF8C3A 100%)` }}
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <h1 className="text-2xl font-bold text-slate-900">Reset Password</h1>
                <p className="text-slate-500 text-sm mt-1">
                  Enter your email and we'll send you a reset link.
                </p>
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
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="h-11 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
                  />
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
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                    : "Send Reset Link →"
                  }
                </button>
              </form>

              <p className="text-center text-sm text-slate-500 mt-6">
                Remembered it?{" "}
                <Link href="/login" className="font-semibold hover:underline" style={{ color: BRAND }}>
                  Back to Sign In
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

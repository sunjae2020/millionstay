import { useState, FormEvent } from "react";
import { Link } from "wouter";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import { APP_NAME } from "@/lib/appName";

const BRAND = "#E8621A";
const API_BASE = "/api/v1";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`${API_BASE}/auth/partner/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {}
    setSubmitted(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] p-6">
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-md p-8 space-y-6">
        <div>
          {import.meta.env.VITE_LOGO_MODE === "text" ? (
            <span className="font-display font-extrabold tracking-tight text-primary text-xl whitespace-nowrap block mb-6">{APP_NAME}</span>
          ) : (
            <img src={`${import.meta.env.BASE_URL}logo-horizontal.png`} alt={APP_NAME} className="h-7 mb-6" />
          )}
          <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
          <p className="text-slate-500 text-sm mt-1">
            Enter your account email and we'll send you a reset link.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              If an account exists for <strong>{email}</strong>, a reset link has been sent. Please check your inbox.
              The link expires in 1 hour.
            </div>
            <Link href="/">
              <a className="flex items-center justify-center gap-2 w-full h-11 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <ArrowLeft className="h-4 w-4" /> Back to login
              </a>
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@partner.com"
                  className="w-full h-11 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": BRAND } as React.CSSProperties}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 shadow-md"
              style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #FF8C3A 100%)` }}
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : "Send reset link"}
            </button>
            <Link href="/">
              <a className="block text-center text-sm text-slate-500 hover:text-slate-700">Back to login</a>
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}

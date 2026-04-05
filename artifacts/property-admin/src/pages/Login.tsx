import { useState, FormEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBrand } from "@/contexts/ThemeContext";
import { Loader2, Lock, Mail, ChevronDown } from "lucide-react";

const DEMO_ACCOUNTS = [
  { label: "Super Admin", email: "admin@millionstay.com.au", password: "MillionStay@2026!" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const { brandName } = useBrand();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-10 text-white text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="bg-white/20 rounded-lg p-2">
                <Lock className="h-6 w-6" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">{brandName}</h1>
            <p className="text-blue-100 text-sm mt-1">Admin Portal</p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
            <div>
              <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="pl-10"
                  placeholder="admin@millionstay.com.au"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="pl-10"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Signing in...</>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="px-8 pb-6 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center">
                <button
                  type="button"
                  onClick={() => setDemoOpen(v => !v)}
                  className="flex items-center gap-1.5 bg-white px-3 text-xs text-muted-foreground hover:text-slate-700 transition-colors select-none"
                >
                  Demo accounts — click to fill
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${demoOpen ? "rotate-180" : ""}`} />
                </button>
              </div>
            </div>

            {demoOpen && (
              <div className="rounded-lg border border-slate-200 overflow-hidden divide-y divide-slate-100">
                {DEMO_ACCOUNTS.map(account => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => fillDemo(account)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors">
                        {account.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{account.email}</p>
                    </div>
                    <span className="text-xs text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Fill ↵
                    </span>
                  </button>
                ))}
              </div>
            )}

            <p className="text-center text-xs text-muted-foreground">
              Secure admin access · {brandName} v2
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

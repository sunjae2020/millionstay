import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { AuthLayout } from "../components/auth-layout";
import { Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiBase } from "@/lib/api-base";

const API_BASE = `${getApiBase()}/api/v1`;

// Password policy mirrors server (utils/passwordPolicy.ts): 12+ chars + lower + upper + digit + special
const POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

function readTokenFromHashOrQuery(loc: string): string {
  // Prefer URL fragment (preferred — never sent to the server in Referer)
  if (typeof window !== "undefined" && window.location.hash) {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const t = hashParams.get("token");
    if (t) return t;
  }
  // Fallback to query string for backwards compatibility
  const qs = new URLSearchParams(loc.split("?")[1] ?? "");
  return qs.get("token") ?? "";
}

export default function ResetPassword() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const [token, setToken] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setToken(readTokenFromHashOrQuery(location));
  }, [location]);

  const policyOk = POLICY_REGEX.test(pw);
  const pwMatches = pw && pw === pw2;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!policyOk) {
      setError("Password must be at least 12 characters and include uppercase, lowercase, digit, and special character.");
      return;
    }
    if (!pwMatches) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/guest/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: pw }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error ?? "Could not reset password. The link may have expired.");
        setLoading(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };

  return (
    <AuthLayout>
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-foreground">{t("auth.reset_title")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.reset_subtitle")}</p>
      </div>

            {!token && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                This page requires a reset link from your email. Please open the link in the message we sent you.
              </div>
            )}

            {done ? (
              <div className="space-y-4 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                <p className="text-gray-700">{t("auth.reset_done")}</p>
                <Button onClick={() => setLocation("/login")} className="w-full bg-primary hover:bg-primary/90 text-white h-11">
                  Continue to login
                </Button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">{t("auth.new_password")}</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type={showPw ? "text" : "password"}
                      required
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      className="pl-9 pr-10 h-11"
                      placeholder={t("auth.ph_min_chars")}
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className={`text-xs mt-1 ${pw && !policyOk ? "text-red-600" : "text-gray-500"}`}>
                    Min 12 chars · upper + lower + digit + special required.
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">{t("auth.confirm_password")}</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type={showPw ? "text" : "password"}
                      required
                      value={pw2}
                      onChange={(e) => setPw2(e.target.value)}
                      className="pl-9 h-11"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                {error && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
                )}
                <Button
                  type="submit"
                  disabled={loading || !token || !policyOk || !pwMatches}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl"
                >
                  {loading ? t("auth.updating") : t("auth.set_new_password")}
                </Button>
                <Link href="/login" className="block text-center text-sm text-muted-foreground hover:text-primary">
                  Back to login
                </Link>
              </form>
            )}
    </AuthLayout>
  );
}

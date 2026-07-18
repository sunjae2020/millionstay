import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Mail, Home } from "lucide-react";
import { BrandMark } from "../components/brand-mark";
import { hostLogin, setHomestayToken } from "@/lib/homestay-api";

export default function HostLogin() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await hostLogin(email.trim(), password);
      setHomestayToken(res.token);
      setLocation("/host-portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("homestay.login.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50 via-white to-orange-50/30">
      <div className="p-6">
        <Link href="/">
          <BrandMark className="h-8 w-auto" />
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-[480px]"
        >
          <div className="rounded-2xl border bg-white shadow-lg p-8 space-y-6">
            <div className="text-center space-y-1">
              <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <Home className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{t("homestay.login.title")}</h1>
              <p className="text-sm text-gray-500">{t("homestay.login.subtitle")}</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">{t("homestay.login.email")}</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("homestay.login.email_placeholder")}
                    className="pl-9 h-11"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">{t("homestay.login.password")}</label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type={showPw ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("homestay.login.password_placeholder")}
                    className="pl-9 pr-10 h-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl text-base mt-2"
                disabled={submitting}
              >
                {submitting ? t("homestay.login.signing_in") : t("homestay.login.submit")}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs text-gray-400">
                <span className="bg-white px-3">{t("homestay.login.new_applicant")}</span>
              </div>
            </div>

            <Link href="/for-homestay-host">
              <Button variant="outline" className="w-full h-11 font-semibold rounded-xl">
                {t("homestay.login.apply_link")}
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

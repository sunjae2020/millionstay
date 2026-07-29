import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Lock, Eye, EyeOff } from "lucide-react";

import { getApiBase } from "@/lib/api-base";
import { APP_NAME } from "../lib/appName";
const API = getApiBase();
const ADMIN_KEY = "ms_admin_key";

export default function AdminLogin() {
  const { t } = useTranslation();
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/admin/stats`, {
        headers: { "x-admin-api-key": key.trim() },
      });
      if (res.status === 401) {
        toast({ title: t("legacy_admin.err_invalid_key"), variant: "destructive" });
        return;
      }
      if (!res.ok) throw new Error("Server error");
      localStorage.setItem(ADMIN_KEY, key.trim());
      setLocation("/admin/dashboard");
    } catch {
      toast({ title: t("legacy_admin.err_connection"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-2xl mb-4">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t("legacy_admin.portal_title")}</h1>
          <p className="text-gray-500 text-sm mt-1">{APP_NAME} Management</p>
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">{t("legacy_admin.api_key")}</label>
              <div className="relative">
                <Input
                  type={show ? "text" : "password"}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder={t("legacy_admin.api_key_ph")}
                  className="h-11 pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !key.trim()}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl"
            >
              {loading ? t("legacy_admin.verifying") : t("legacy_admin.sign_in")}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          {APP_NAME} Admin · Melbourne, AU
        </p>
      </div>
    </div>
  );
}

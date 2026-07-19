import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGuestLogin } from "@/lib/guest-api";
import { useAuthStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Link } from "wouter";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { AuthLayout } from "../components/auth-layout";

export default function Login() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const { setAuth } = useAuthStore();
  const [showPw, setShowPw] = useState(false);

  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const redirectTo = params.get("redirect") ?? "/portal/bookings";
  const sessionExpired = params.get("reason") === "session_expired";

  const loginMutation = useGuestLogin();
  const loginSchema = useMemo(
    () =>
      z.object({
        email: z.string().email(t("auth.v_email")),
        password: z.string().min(1, t("auth.v_password")),
      }),
    [t]
  );
  type LoginFormData = z.infer<typeof loginSchema>;
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(
      { data },
      {
        onSuccess: (res) => {
          setAuth(res.token, res.user);
          setLocation(redirectTo);
        },
        onError: (error: unknown) => {
          const e = error as { message?: string; data?: { error?: string } };
          const msg = e?.message ?? e?.data?.error ?? t("auth.invalid_credentials");
          form.setError("password", { message: msg });
        },
      }
    );
  };

  return (
    <AuthLayout>
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-foreground">{t("auth.welcome_back")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.login_subtitle")}</p>
      </div>

            {sessionExpired && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
                <span className="text-base">⚠️</span>
                <span>{t("auth.session_expired")}</span>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">{t("auth.email_label")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            {...field}
                            type="email"
                            placeholder={t("auth.email_placeholder")}
                            className="pl-9 h-11"
                            data-testid="input-email"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between mb-1">
                        <FormLabel className="text-sm font-medium text-gray-700">{t("auth.password_label")}</FormLabel>
                        <Link
                          href="/forgot-password"
                          className="text-xs text-primary hover:underline"
                        >
                          {t("auth.forgot_password")}
                        </Link>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            {...field}
                            type={showPw ? "text" : "password"}
                            placeholder={t("auth.password_placeholder_login")}
                            className="pl-9 pr-10 h-11"
                            data-testid="input-password"
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl text-base mt-2"
                  disabled={loginMutation.isPending}
                  data-testid="button-submit-login"
                >
                  {loginMutation.isPending ? t("auth.signing_in") : t("auth.log_in")}
                </Button>
              </form>
            </Form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs text-muted-foreground">
          <span className="bg-card px-3">{t("auth.no_account")}</span>
        </div>
      </div>

      <Link href="/register">
        <Button variant="outline" className="w-full h-11 font-semibold rounded-xl">
          {t("auth.create_account")}
        </Button>
      </Link>
    </AuthLayout>
  );
}

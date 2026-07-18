import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGuestRegister } from "@/lib/guest-api";
import { useAuthStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { LOGO_HORIZONTAL as logoHorizontal } from "@/lib/brand";
import { APP_NAME } from "../lib/appName";

const COUNTRIES = [
  "Australia","South Korea","China","Japan","Vietnam","India","Philippines",
  "Indonesia","Malaysia","Thailand","Hong Kong","Taiwan","Singapore",
  "United Kingdom","United States","Canada","New Zealand","Brazil",
  "France","Germany","Italy","Spain","Mexico","Argentina","Other",
];

export default function Register() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const { setAuth } = useAuthStore();
  const { toast } = useToast();
  const [showPw, setShowPw] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);

  const search = location.includes("?") ? location.split("?")[1] : "";
  const params = new URLSearchParams(search ?? "");
  const redirectTo = params.get("redirect") ?? "/portal/bookings";

  const registerMutation = useGuestRegister();

  const registerSchema = useMemo(
    () =>
      z.object({
        first_name: z.string().min(1, t("auth.v_first_name")),
        last_name: z.string().min(1, t("auth.v_last_name")),
        email: z.string().email(t("auth.v_email")),
        password: z
          .string()
          .min(12, t("auth.v_pw_min"))
          .regex(/[a-z]/, t("auth.v_pw_lower"))
          .regex(/[A-Z]/, t("auth.v_pw_upper"))
          .regex(/[0-9]/, t("auth.v_pw_digit"))
          .regex(/[^A-Za-z0-9]/, t("auth.v_pw_special")),
        phone: z.string().optional(),
        nationality: z.string().optional(),
        terms: z.boolean().refine((v) => v === true, t("auth.v_terms")),
        marketing_consent: z.boolean().optional().default(false),
      }),
    [t]
  );
  type RegisterFormData = z.infer<typeof registerSchema>;

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      first_name: "", last_name: "", email: "",
      password: "", phone: "", nationality: "", terms: false,
      marketing_consent: false,
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    const rawPhone = data.phone ?? "";
    const phoneWithPrefix = rawPhone
      ? (rawPhone.startsWith("+") ? rawPhone : `+61${rawPhone.replace(/^0/, "")}`)
      : undefined;

    registerMutation.mutate(
      { data: { ...data, phone: phoneWithPrefix } },
      {
        onSuccess: (res) => {
          setAuth(res.token, res.user);
          const displayName = [res.user.first_name, res.user.last_name].filter(Boolean).join(" ") || res.user.email;
          toast({ title: t("auth.welcome_toast"), description: t("auth.welcome_desc", { name: displayName }) });
          setLocation(redirectTo);
        },
        onError: (error: unknown) => {
          const e = error as { message?: string; data?: { error?: string } };
          const msg = e?.message ?? e?.data?.error ?? t("auth.register_failed");
          toast({ title: t("auth.register_failed"), description: msg, variant: "destructive" });
        },
      }
    );
  };

  const filteredCountries = COUNTRIES.filter((c) =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50 via-white to-orange-50/30">
      <div className="p-6">
        <Link href="/">
          <img src={logoHorizontal} alt={APP_NAME} className="h-8 w-auto" />
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-[480px]"
        >
          <div className="rounded-2xl border bg-white shadow-lg p-8 space-y-5">
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold text-gray-900">{t("auth.create_account_title")}</h1>
              <p className="text-sm text-gray-500">{t("auth.register_subtitle")}</p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">{t("auth.first_name")} *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={t("auth.first_name_placeholder")} className="h-11" data-testid="input-first-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">{t("auth.last_name")} *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={t("auth.last_name_placeholder")} className="h-11" data-testid="input-last-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">{t("auth.email_label")} *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input {...field} type="email" placeholder={t("auth.email_placeholder")} className="pl-9 h-11" data-testid="input-email" />
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
                      <FormLabel className="text-sm font-medium">{t("auth.password_label")} *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            {...field}
                            type={showPw ? "text" : "password"}
                            placeholder={t("auth.password_placeholder_register")}
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

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">{t("auth.phone_label")}</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <div className="flex items-center px-3 h-11 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 shrink-0 font-medium">
                            🇦🇺 +61
                          </div>
                          <Input {...field} placeholder="04XX XXX XXX" className="h-11 flex-1" data-testid="input-phone" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nationality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">{t("auth.nationality_label")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <div
                            className="h-11 border border-gray-200 rounded-lg px-3 flex items-center justify-between cursor-pointer hover:border-primary/50 transition-colors bg-white"
                            onClick={() => setCountryOpen(!countryOpen)}
                            data-testid="select-nationality"
                          >
                            <span className={field.value ? "text-gray-900 text-sm" : "text-gray-400 text-sm"}>
                              {field.value || t("auth.select_country")}
                            </span>
                            <span className="text-gray-400 text-xs">▾</span>
                          </div>
                          {countryOpen && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-hidden">
                              <div className="p-2 border-b border-gray-100">
                                <input
                                  className="w-full text-sm px-2 py-1 outline-none"
                                  placeholder={t("auth.search_country")}
                                  value={countrySearch}
                                  onChange={(e) => setCountrySearch(e.target.value)}
                                  autoFocus
                                />
                              </div>
                              <div className="overflow-y-auto max-h-40">
                                {filteredCountries.map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 hover:text-primary transition-colors"
                                    onClick={() => {
                                      field.onChange(c);
                                      setCountryOpen(false);
                                      setCountrySearch("");
                                    }}
                                  >
                                    {c}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="terms"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          id="terms"
                          checked={field.value}
                          onChange={field.onChange}
                          className="mt-0.5 h-4 w-4 accent-primary cursor-pointer"
                          data-testid="checkbox-terms"
                        />
                        <label htmlFor="terms" className="text-sm text-gray-600 leading-relaxed cursor-pointer">
                          {t("auth.terms_intro")}{" "}
                          <Link href="/house-rules" className="text-primary hover:underline">{t("auth.terms_link")}</Link>
                          {" "}{t("auth.terms_and")}{" "}
                          <Link href="/privacy-policy" className="text-primary hover:underline">{t("auth.privacy_link")}</Link>
                        </label>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="marketing_consent"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          id="marketing_consent"
                          checked={field.value}
                          onChange={field.onChange}
                          className="mt-0.5 h-4 w-4 accent-primary cursor-pointer"
                          data-testid="checkbox-marketing-consent"
                        />
                        <label htmlFor="marketing_consent" className="text-sm text-gray-600 leading-relaxed cursor-pointer">
                          <span className="font-medium">{t("auth.marketing_optional")}</span> {t("auth.marketing_text")}
                          <span className="block text-xs text-gray-400 mt-0.5">{t("auth.marketing_help")}</span>
                        </label>
                      </div>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl text-base"
                  disabled={registerMutation.isPending}
                  data-testid="button-create-account"
                >
                  {registerMutation.isPending ? t("auth.creating_account") : t("auth.create_account_btn")}
                </Button>
              </form>
            </Form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs text-gray-400">
                <span className="bg-white px-3">{t("auth.have_account")}</span>
              </div>
            </div>

            <Link href="/login">
              <Button variant="outline" className="w-full h-11 font-semibold rounded-xl">
                {t("auth.log_in")}
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Mail, Zap } from "lucide-react";
import logoHorizontal from "@assets/06.OR_NB_horizontal_ver_1775381659303.png";

const loginSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(1, "Password required"),
});
type LoginFormData = z.infer<typeof loginSchema>;

const DEMO_EMAIL = "demo@millionstay.com.au";
const DEMO_PASSWORD = "Demo1234!";

export default function Login() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const { setAuth } = useAuthStore();
  const { toast } = useToast();
  const [showPw, setShowPw] = useState(false);
  const [demoFilled, setDemoFilled] = useState(false);

  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const redirectTo = params.get("redirect") ?? "/portal/bookings";

  const loginMutation = useGuestLogin();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const fillDemo = () => {
    form.setValue("email", DEMO_EMAIL, { shouldValidate: true });
    form.setValue("password", DEMO_PASSWORD, { shouldValidate: true });
    setDemoFilled(true);
    toast({ title: "Demo credentials filled!", description: "Click Log in to explore the portal." });
  };

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(
      { data },
      {
        onSuccess: (res) => {
          setAuth(res.token, res.guest);
          setLocation(redirectTo);
        },
        onError: (error: unknown) => {
          const msg = (error as { data?: { error?: string } })?.data?.error ?? "Invalid credentials";
          form.setError("password", { message: msg });
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50 via-white to-orange-50/30">
      <div className="p-6">
        <Link href="/">
          <img src={logoHorizontal} alt="Million Stay" className="h-8 w-auto" />
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
              <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
              <p className="text-sm text-gray-500">Sign in to manage your Melbourne room</p>
            </div>

            {/* Demo account banner */}
            <motion.button
              type="button"
              onClick={fillDemo}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full rounded-xl border-2 border-dashed px-4 py-3 text-left transition-all group ${
                demoFilled
                  ? "border-green-400 bg-green-50"
                  : "border-primary/40 bg-orange-50 hover:border-primary hover:bg-orange-100"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${demoFilled ? "bg-green-100" : "bg-primary/10"}`}>
                  <Zap className={`h-4 w-4 ${demoFilled ? "text-green-600" : "text-primary"}`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${demoFilled ? "text-green-700" : "text-primary"}`}>
                    {demoFilled ? "✓ Demo credentials filled — click Log in" : "Try demo account — click to fill"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{DEMO_EMAIL}</p>
                </div>
              </div>
            </motion.button>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Email address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            {...field}
                            type="email"
                            placeholder="your@email.com"
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
                        <FormLabel className="text-sm font-medium text-gray-700">Password</FormLabel>
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          tabIndex={-1}
                        >
                          Forgot password?
                        </button>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            {...field}
                            type={showPw ? "text" : "password"}
                            placeholder="Enter your password"
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
                  {loginMutation.isPending ? "Signing in..." : "Log in"}
                </Button>
              </form>
            </Form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs text-gray-400">
                <span className="bg-white px-3">Don't have an account?</span>
              </div>
            </div>

            <Link href="/register">
              <Button variant="outline" className="w-full h-11 font-semibold rounded-xl">
                Create account
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

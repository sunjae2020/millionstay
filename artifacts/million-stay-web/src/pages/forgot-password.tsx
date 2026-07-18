import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LOGO_HORIZONTAL as logoHorizontal } from "@/lib/brand";
import { getApiBase } from "@/lib/api-base";
import { APP_NAME } from "../lib/appName";

const API_BASE = `${getApiBase()}/api/v1`;

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Server always returns 200 to prevent enumeration; show generic UI either way.
      await fetch(`${API_BASE}/auth/guest/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {}
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50 via-white to-orange-50/30">
      <div className="p-6">
        <Link href="/">
          <img src={logoHorizontal} alt={APP_NAME} className="h-8 w-auto" />
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[480px]">
          <div className="rounded-2xl border bg-white shadow-lg p-8 space-y-6">
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold text-gray-900">Reset your password</h1>
              <p className="text-sm text-gray-500">
                Enter your email and we'll send you a link to set a new password.
              </p>
            </div>

            {submitted ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                  If an account exists for <strong>{email}</strong>, a reset link has been sent.
                  Please check your inbox (and spam folder). The link expires in 1 hour.
                </div>
                <Link href="/login" className="block w-full">
                  <Button variant="outline" className="w-full h-11">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to login
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="pl-9 h-11"
                      data-testid="input-email"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl"
                >
                  {loading ? "Sending..." : "Send reset link"}
                </Button>
                <Link href="/login" className="block text-center text-sm text-gray-500 hover:text-primary">
                  Back to login
                </Link>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

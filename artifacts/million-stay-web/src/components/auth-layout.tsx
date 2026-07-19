/**
 * Shared auth-page shell — brand wash + logo header + centered card.
 * Replaces the identical gradient/card wrapper that was copy-pasted across
 * login / register / forgot-password / reset-password / host-login. Card
 * surface is token-based (bg-card/border-border) so it stays consistent and
 * is dark-ready; the warm brand gradient is preserved.
 */
import type { ReactNode } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { BrandMark } from "./brand-mark";

export function AuthLayout({
  children, maxWidth = 480,
}: {
  children: ReactNode;
  /** card max width in px (login/register 480, some flows narrower) */
  maxWidth?: number;
}) {
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
          className="w-full"
          style={{ maxWidth }}
        >
          <div className="rounded-2xl border border-border bg-card shadow-lg p-8 space-y-6">
            {children}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

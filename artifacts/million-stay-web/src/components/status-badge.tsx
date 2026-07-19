/**
 * Canonical status badge — single source for booking / invoice / document / CS
 * statuses across the app. Replaces the per-page status→color maps that were
 * duplicated in 13 files. Tone-based (semantic) + dark-mode aware; colour is
 * always paired with the status text (never colour-alone).
 */
import type { ReactNode } from "react";

type Tone = "success" | "info" | "warn" | "danger" | "indigo" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  warn: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  danger: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  neutral: "bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300",
};

// Normalised (lowercased, no spaces) status → tone.
const STATUS_TONE: Record<string, Tone> = {
  draft: "neutral",
  pendingpayment: "warn",
  pendingapproval: "warn",
  pending: "warn",
  confirmed: "info",
  active: "success",
  checkedout: "indigo",
  completed: "info",
  cancelled: "danger",
  // invoices
  paid: "success",
  unpaid: "warn",
  overdue: "danger",
  void: "neutral",
  // documents
  approved: "success",
  verified: "success",
  rejected: "danger",
  required: "warn",
  submitted: "info",
  under_review: "warn",
  // CS
  open: "info",
  resolved: "success",
  closed: "neutral",
};

const PULSE = new Set(["pendingapproval", "active", "open"]);

function normalise(status: string) {
  return status.toLowerCase().replace(/[\s-]/g, "");
}

export function StatusBadge({ status, label }: { status: string; label?: ReactNode }) {
  const key = normalise(status);
  const tone = STATUS_TONE[key] ?? "neutral";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${TONE_CLASS[tone]}`}>
      {PULSE.has(key) && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse motion-reduce:animate-none" />}
      {label ?? status}
    </span>
  );
}

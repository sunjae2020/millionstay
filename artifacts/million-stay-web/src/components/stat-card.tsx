/**
 * KPI / stat card — label + big value + optional sub line + tinted icon.
 * Token-based (light + dark). `tone` drives emphasis; a card with `href`
 * becomes an actionable primary CTA (only one such card per view — the
 * primary-action rule). Extracted from the portal dashboard so other
 * dashboards can reuse it.
 */
import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

export type StatTone = "default" | "primary" | "warn";

const ICON_TONE: Record<StatTone, string> = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export function StatCard({
  icon: Icon, label, value, sub, tone = "default", href, cta,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  tone?: StatTone;
  href?: string;
  cta?: string;
}) {
  const emphasised = tone !== "default";
  const body = (
    <div
      className={`h-full rounded-2xl border bg-card p-4 sm:p-5 transition-shadow ${
        emphasised ? "border-primary/30" : "border-card-border"
      } ${href ? "hover:shadow-md focus-within:shadow-md cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className={`grid place-items-center h-8 w-8 rounded-full shrink-0 ${ICON_TONE[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl sm:text-[26px] font-bold text-card-foreground tabular-nums leading-none">{value}</p>
      {(sub || cta) && (
        <p className={`mt-1.5 text-xs font-medium ${tone === "primary" ? "text-primary" : "text-muted-foreground"}`}>
          {href && cta ? (
            <span className="inline-flex items-center gap-1">{cta} <ArrowRight className="h-3 w-3" /></span>
          ) : sub}
        </p>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      {body}
    </Link>
  ) : body;
}

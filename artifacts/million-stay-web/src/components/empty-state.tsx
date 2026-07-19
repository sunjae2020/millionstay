/**
 * Reusable empty state — icon + title + optional subtitle + optional CTA.
 * Token-based surface so it works in light and dark. Replaces the ad-hoc
 * "no data" blocks scattered across list pages.
 */
import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

export function EmptyState({
  icon: Icon, title, description, ctaLabel, ctaHref,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-card-border bg-card p-8 text-center">
      <Icon className="h-8 w-8 mx-auto text-muted-foreground/50" />
      <p className="mt-3 font-semibold text-card-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      {ctaLabel && ctaHref && (
        <Link href={ctaHref}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
          {ctaLabel} <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

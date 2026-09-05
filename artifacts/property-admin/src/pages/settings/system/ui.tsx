/* Shared presentational helpers for the System Map tabs.
 * Uses the app's shadcn design tokens (bg-card / text-foreground / …) so the
 * page is theme-aware and matches the rest of the admin. */
import type { ReactNode, ComponentType } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-card rounded-xl border ${className}`}>{children}</div>;
}

export function SectionTitle({
  icon: Icon,
  children,
  right,
}: {
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">{children}</h2>
      </div>
      {right}
    </div>
  );
}

export function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${ok ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
    />
  );
}

export function fmtWhen(ts: number | string | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

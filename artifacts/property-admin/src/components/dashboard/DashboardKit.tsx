import { cn } from "@/lib/utils";

/**
 * Shared dashboard design kit — Edubee-CRM-inspired visual language adapted to
 * MillionStay's orange brand (#E8621A / hsl(21 82% 51%)). All primitives use
 * Tailwind semantic tokens (bg-card, border, text-foreground, text-muted-foreground)
 * so they automatically respect light/dark mode.
 */

export const BRAND = "hsl(var(--primary))";
export const BRAND_SOFT = "color-mix(in srgb, hsl(var(--primary)) 12%, transparent)";

/** Palette for accent strips / icon tiles — keep semantic + on-brand. */
export const ACCENT = {
  brand:   { bar: BRAND,      bg: BRAND_SOFT,                 fg: BRAND },
  green:   { bar: "#16a34a",  bg: "rgba(22,163,74,0.12)",     fg: "#16a34a" },
  blue:    { bar: "#2563eb",  bg: "rgba(37,99,235,0.12)",     fg: "#2563eb" },
  amber:   { bar: "#d97706",  bg: "rgba(217,119,6,0.12)",     fg: "#d97706" },
  red:     { bar: "#dc2626",  bg: "rgba(220,38,38,0.12)",     fg: "#dc2626" },
  purple:  { bar: "#7c3aed",  bg: "rgba(124,58,237,0.12)",    fg: "#7c3aed" },
  indigo:  { bar: "#4f46e5",  bg: "rgba(79,70,229,0.12)",     fg: "#4f46e5" },
  slate:   { bar: "#64748b",  bg: "rgba(100,116,139,0.12)",   fg: "#64748b" },
} as const;

export type AccentKey = keyof typeof ACCENT;

type TrendType = "up" | "down" | "neutral" | "warning";

const TREND_CLASS: Record<TrendType, string> = {
  up:      "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  down:    "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  neutral: "bg-muted text-muted-foreground",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
};

export function Trend({ type = "neutral", children }: { type?: TrendType; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full", TREND_CLASS[type])}>
      {children}
    </span>
  );
}

export function KpiCard({
  icon: Icon, value, label, sublabel, accent = "brand",
  trend, trendType = "neutral", progress, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: React.ReactNode;
  label: string;
  sublabel?: string;
  accent?: AccentKey;
  trend?: React.ReactNode;
  trendType?: TrendType;
  progress?: number;
  onClick?: () => void;
}) {
  const a = ACCENT[accent];
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative bg-card rounded-xl border p-4 overflow-hidden transition-all duration-200",
        "hover:shadow-md hover:-translate-y-0.5",
        onClick && "cursor-pointer",
      )}
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: a.bar }} />
      <div className="flex items-center justify-between mb-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: a.bg, color: a.fg }}>
          <Icon className="h-5 w-5" />
        </div>
        {trend != null && <Trend type={trendType}>{trend}</Trend>}
      </div>
      <div className="text-[27px] leading-none font-bold tracking-tight text-foreground">{value}</div>
      <div className="text-[13px] text-muted-foreground mt-1.5 font-medium">{label}</div>
      {sublabel && <div className="text-[11.5px] text-muted-foreground/70 mt-0.5">{sublabel}</div>}
      {progress !== undefined && (
        <div className="h-1.5 bg-muted rounded-full mt-2.5 overflow-hidden">
          <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, Math.max(0, progress))}%`, background: a.bar }} />
        </div>
      )}
    </div>
  );
}

export function DashCard({
  title, icon: Icon, action, children, className, bodyClass,
}: {
  title?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <div className={cn("bg-card rounded-xl border", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
          <div className="flex items-center gap-2 min-w-0">
            {Icon && (
              <div className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: BRAND_SOFT, color: BRAND }}>
                <Icon className="h-3.5 w-3.5" />
              </div>
            )}
            {title && <h3 className="text-[13px] font-semibold truncate">{title}</h3>}
          </div>
          {action}
        </div>
      )}
      <div className={cn("p-4", bodyClass)}>{children}</div>
    </div>
  );
}

export interface TabDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function DashTabs({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="inline-flex gap-0.5 bg-muted border rounded-xl p-1 overflow-x-auto max-w-full">
      {tabs.map((tb) => {
        const on = tb.id === active;
        return (
          <button
            key={tb.id}
            onClick={() => onChange(tb.id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] whitespace-nowrap transition-all",
              on ? "bg-card font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground font-medium",
            )}
            style={on ? { color: BRAND } : undefined}
          >
            <tb.icon className="h-4 w-4" />
            {tb.label}
          </button>
        );
      })}
    </div>
  );
}

/** Simple pill badge for table/status use. */
export function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium", className)}>{children}</span>;
}

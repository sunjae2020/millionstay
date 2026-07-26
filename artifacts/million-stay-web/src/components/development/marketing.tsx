import { type ComponentType } from "react";

// Shared marketing building blocks for the Metheim development site. These give
// the Buy / Rent / Management pages a consistent "왜 메트하임 + 절차" rhythm while
// keeping each funnel visually distinct: Buy uses a gold vertical timeline, Rent
// a horizontal step row, Management an alternating zig-zag. All copy is passed in
// already resolved (CMS overlay on i18n) by the caller.

type IconType = ComponentType<{ className?: string }>;

export interface WhyItem { icon: IconType; title: string; body: string; }
export interface StepItem { title: string; body: string; }

// ── Section heading (eyebrow + title + subtitle) ────────────────────────────
export function SectionHeading({
  eyebrow, title, subtitle, align = "center",
}: { eyebrow?: string; title: string; subtitle?: string; align?: "center" | "left" }) {
  const wrap = align === "center" ? "text-center mx-auto max-w-2xl" : "max-w-2xl";
  return (
    <div className={wrap}>
      {eyebrow && (
        <p className="text-sm font-semibold tracking-widest uppercase text-primary">{eyebrow}</p>
      )}
      <h2 className="mt-3 font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
        {title}
      </h2>
      {subtitle && <p className="mt-3 text-gray-600 leading-relaxed">{subtitle}</p>}
    </div>
  );
}

// ── "왜 메트하임" — 3-up feature grid, accent-tinted icon tiles ──────────────
export function WhyGrid({ items }: { items: WhyItem[] }) {
  return (
    <div className="mt-12 grid gap-6 md:grid-cols-3">
      {items.map(({ icon: Icon, title, body }) => (
        <div key={title} className="rounded-2xl border border-gray-200 bg-white p-7 transition hover:shadow-md hover:-translate-y-0.5">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Icon className="w-6 h-6" />
          </div>
          <h3 className="mt-5 font-semibold text-lg text-[hsl(var(--brand-navy))]">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">{body}</p>
        </div>
      ))}
    </div>
  );
}

// ── Process variant A — BUY: gold vertical numbered timeline ────────────────
export function ProcessTimeline({ steps }: { steps: StepItem[] }) {
  return (
    <ol className="mt-12 relative max-w-3xl mx-auto">
      {/* vertical connector */}
      <span aria-hidden className="absolute left-6 top-2 bottom-2 w-px bg-[hsl(var(--brand-teal)/0.35)]" />
      {steps.map((s, i) => (
        <li key={i} className="relative pl-20 pb-10 last:pb-0">
          <span
            className="absolute left-0 top-0 w-12 h-12 rounded-full flex items-center justify-center font-display font-bold text-white shadow-sm"
            style={{ background: "hsl(var(--brand-teal))" }}
          >
            {i + 1}
          </span>
          <h3 className="font-semibold text-lg text-[hsl(var(--brand-navy))]">{s.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

// ── Process variant B — MANAGEMENT: alternating zig-zag rows ────────────────
export function ProcessZigzag({ steps }: { steps: StepItem[] }) {
  return (
    <div className="mt-12 max-w-3xl mx-auto space-y-4">
      {steps.map((s, i) => (
        <div
          key={i}
          className={`flex items-start gap-5 rounded-2xl border border-gray-200 bg-white p-6 ${
            i % 2 === 1 ? "md:flex-row-reverse md:text-right" : ""
          }`}
        >
          <span
            className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center font-display font-bold text-[hsl(var(--brand-navy))]"
            style={{ background: "hsl(var(--brand-apricot))" }}
          >
            {i + 1}
          </span>
          <div>
            <h3 className="font-semibold text-lg text-[hsl(var(--brand-navy))]">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{s.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

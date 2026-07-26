import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { format, differenceInCalendarDays, startOfMonth, subMonths, isSameMonth } from "date-fns";
import {
  CalendarClock, FileSignature, Wallet, FileClock,
  ChevronRight, MapPin, CalendarRange, PieChart, BarChart3,
} from "lucide-react";
import {
  useListMyBookings, useListMyInvoices, useListMyDocuments,
  getListMyBookingsQueryKey, type MyBooking, type MyInvoice, type MyDocument,
} from "@/lib/guest-api";
import { useAuthStore } from "@/lib/store";
import { PortalLayout } from "@/components/portal-layout";
import { StatusBadge } from "@/components/status-badge";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyAmount } from "@/contexts/DisplayCurrencyContext";

/* ── helpers ─────────────────────────────────────────────── */

function formatDate(d?: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "yyyy.MM.dd"); } catch { return d; }
}
function formatShort(d?: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "MM.dd"); } catch { return d; }
}
function money(amount: number, currency = "AUD") {
  return formatCurrencyAmount(Number(amount) || 0, currency);
}

const ACTIVE_STATUSES = ["Active", "Confirmed"];
const PENDING_DOC = ["pending", "required", "submitted", "under_review"];

function isUnpaid(inv: MyInvoice) {
  const s = (inv.status ?? "").toLowerCase();
  return !inv.paid_at && s !== "paid" && s !== "cancelled" && s !== "void";
}

// Contract-status → semantic colour bucket. Status colours (reserved), always
// paired with a text label + legend — never colour-alone.
type StatusBucket = "active" | "confirmed" | "pending" | "completed" | "cancelled" | "other";
function statusBucket(raw: string): StatusBucket {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("active")) return "active";
  if (s.includes("confirm")) return "confirmed";
  if (s.includes("pend") || s.includes("upcoming") || s.includes("review")) return "pending";
  if (s.includes("complete") || s.includes("past") || s.includes("ended") || s.includes("checkout")) return "completed";
  if (s.includes("cancel") || s.includes("void") || s.includes("reject")) return "cancelled";
  return "other";
}
const BUCKET_COLOR: Record<StatusBucket, string> = {
  active: "hsl(var(--primary))",
  confirmed: "#0ea5a4",   // teal
  pending: "#f59e0b",     // amber
  completed: "#94a3b8",   // slate
  cancelled: "#ef4444",   // red
  other: "#cbd5e1",       // light slate
};
const BUCKET_ORDER: StatusBucket[] = ["active", "confirmed", "pending", "completed", "cancelled", "other"];

/* ── Donut chart (contract status) ───────────────────────── */

function DonutChart({ data, total, centerLabel, centerValue }: {
  data: { key: StatusBucket; label: string; value: number; color: string }[];
  total: number;
  centerLabel: string;
  centerValue: string;
}) {
  const R = 52, C = 2 * Math.PI * R, GAP = 2; // 2px surface gap between arcs
  let offset = 0;
  const segs = data.filter((d) => d.value > 0);
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 130 130" className="h-32 w-32 shrink-0 -rotate-90">
        <circle cx="65" cy="65" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="14" opacity="0.35" />
        {total > 0 && segs.map((d) => {
          const frac = d.value / total;
          const len = Math.max(frac * C - GAP, 0);
          const dash = `${len} ${C - len}`;
          const el = (
            <circle key={d.key} cx="65" cy="65" r={R} fill="none" stroke={d.color} strokeWidth="14"
              strokeDasharray={dash} strokeDashoffset={-offset} strokeLinecap="round">
              <title>{`${d.label}: ${d.value}`}</title>
            </circle>
          );
          offset += frac * C;
          return el;
        })}
      </svg>
      <div className="min-w-0 flex-1">
        <div className="mb-2">
          <p className="text-2xl font-bold text-card-foreground tabular-nums leading-none">{centerValue}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{centerLabel}</p>
        </div>
        <ul className="space-y-1">
          {segs.map((d) => (
            <li key={d.key} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: d.color }} aria-hidden />
              <span className="text-muted-foreground truncate flex-1">{d.label}</span>
              <span className="tabular-nums font-medium text-card-foreground">{d.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── Bar chart (monthly payments) ────────────────────────── */

function BarChart({ bars, currency }: {
  bars: { label: string; value: number }[];
  currency: string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="flex items-end justify-between gap-2 h-32 pt-2">
      {bars.map((b, i) => {
        const h = b.value > 0 ? Math.max((b.value / max) * 100, 4) : 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5 group">
            <span className="text-[10px] tabular-nums font-medium text-card-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {b.value > 0 ? money(b.value, currency) : ""}
            </span>
            <div className="w-full flex items-end justify-center h-full">
              <div className="w-full max-w-[36px] rounded-t-md rounded-b-sm transition-all"
                style={{ height: `${h}%`, background: "hsl(var(--primary))", opacity: b.value > 0 ? 1 : 0.15 }}
                title={`${b.label}: ${b.value > 0 ? money(b.value, currency) : "—"}`} />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── mobile contract row ─────────────────────────────────── */

function ContractRowMobile({ b }: { b: MyBooking }) {
  const { t } = useTranslation();
  return (
    <Link href={`/portal/bookings/${b.id}`}
      className="flex flex-col gap-2 rounded-xl border border-card-border bg-card p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground truncate">{b.booking_reference ?? `#${b.id}`}</span>
        <StatusBadge status={b.booking_status} />
      </div>
      <p className="font-semibold text-sm text-card-foreground truncate">{b.space_name ?? b.property_name ?? t("portal.home.stay_fallback", "Stay")}</p>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><CalendarRange className="h-3.5 w-3.5" />{formatShort(b.check_in_date)} → {formatShort(b.check_out_date)}</span>
        {b.total_amount && <span className="tabular-nums font-medium text-card-foreground">{money(Number(b.total_amount), b.currency ?? "AUD")}</span>}
      </div>
    </Link>
  );
}

/* ── page ────────────────────────────────────────────────── */

export default function Portal() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { token, guest } = useAuthStore();

  useEffect(() => {
    if (!token) setLocation("/login?redirect=/portal");
  }, [token, setLocation]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      document.documentElement.classList.remove("dark");
    };
  }, []);

  const bookingsQ = useListMyBookings({ query: { enabled: !!token, queryKey: getListMyBookingsQueryKey() } });
  const invoicesQ = useListMyInvoices({ query: { enabled: !!token } });
  const documentsQ = useListMyDocuments({ query: { enabled: !!token } });

  const bookings: MyBooking[] = bookingsQ.data?.data ?? [];
  const invoices: MyInvoice[] = invoicesQ.data?.data ?? [];
  const documents: MyDocument[] = documentsQ.data?.data ?? [];
  const loading = bookingsQ.isLoading || invoicesQ.isLoading || documentsQ.isLoading;

  // ── KPI derivations ──
  const today = new Date();
  const upcoming = bookings
    .filter((b) => b.check_in_date && differenceInCalendarDays(new Date(b.check_in_date), today) >= 0)
    .sort((a, b) => new Date(a.check_in_date).getTime() - new Date(b.check_in_date).getTime());
  const nextStay = upcoming[0];
  const nextStayDays = nextStay ? differenceInCalendarDays(new Date(nextStay.check_in_date), today) : null;
  const nextStayValue = !nextStay ? "—"
    : nextStayDays === 0 ? t("portal.home.kpi_today")
    : nextStayDays === 1 ? t("portal.home.kpi_tomorrow")
    : t("portal.home.kpi_in_days", { count: nextStayDays as number });

  const activeCount = bookings.filter((b) => ACTIVE_STATUSES.includes(b.booking_status)).length;

  const unpaid = invoices.filter(isUnpaid);
  const balance = unpaid.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const displayCurrency = unpaid[0]?.currency ?? invoices[0]?.currency ?? bookings[0]?.currency ?? "AUD";

  const docsPending = documents.filter((d) => PENDING_DOC.includes((d.status ?? "").toLowerCase())).length;

  // ── Contract status distribution (donut) ──
  const bucketCounts = BUCKET_ORDER.map((key) => ({
    key,
    label: t(`portal.home.st_${key}`),
    value: bookings.filter((b) => statusBucket(b.booking_status) === key).length,
    color: BUCKET_COLOR[key],
  }));

  // ── Monthly payments (bar) — sum of PAID invoices per month, last 6 months ──
  const monthsBack = 6;
  const months = Array.from({ length: monthsBack }, (_, i) => startOfMonth(subMonths(today, monthsBack - 1 - i)));
  const paidInvoices = invoices.filter((i) => i.paid_at);
  const bars = months.map((m) => ({
    label: format(m, "M") + t("portal.home.month_suffix", "월"),
    value: paidInvoices
      .filter((inv) => inv.paid_at && isSameMonth(new Date(inv.paid_at), m))
      .reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0),
  }));
  const paidTotal = paidInvoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);

  // ── Active/current contract (for progress bar) ──
  const current = bookings.find((b) => {
    if (!b.check_in_date || !b.check_out_date) return false;
    const ci = new Date(b.check_in_date), co = new Date(b.check_out_date);
    return ci <= today && today <= co;
  }) ?? bookings.find((b) => ACTIVE_STATUSES.includes(b.booking_status));
  let stayPct = 0, stayElapsed = 0, stayTotal = 0, stayLeft = 0;
  if (current?.check_in_date && current?.check_out_date) {
    const ci = new Date(current.check_in_date), co = new Date(current.check_out_date);
    stayTotal = Math.max(1, differenceInCalendarDays(co, ci));
    stayElapsed = Math.min(stayTotal, Math.max(0, differenceInCalendarDays(today, ci)));
    stayLeft = Math.max(0, differenceInCalendarDays(co, today));
    stayPct = Math.round((stayElapsed / stayTotal) * 100);
  }

  const recent = [...bookings]
    .sort((a, b) => new Date(b.check_in_date).getTime() - new Date(a.check_in_date).getTime())
    .slice(0, 5);

  const hasData = bookings.length > 0 || invoices.length > 0;

  return (
    <PortalLayout active="/portal">
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        {/* Greeting */}
        <header className="mb-5 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {guest?.first_name
              ? t("portal.home.greeting", { name: guest.first_name })
              : t("portal.home.greeting_plain")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("portal.home.subtitle_contracts", "Your contracts, payments and documents at a glance.")}</p>
        </header>

        {/* KPI grid */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[110px] rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard icon={FileSignature} label={t("portal.home.kpi_active_contracts", "Active contracts")} value={String(activeCount)}
              sub={t("portal.home.kpi_active_sub")} />
            <StatCard icon={CalendarClock} label={t("portal.home.kpi_next_stay")} value={nextStayValue}
              sub={nextStay ? (nextStay.space_name ?? nextStay.property_name ?? undefined) : t("portal.home.kpi_next_stay_none")} />
            <StatCard icon={Wallet} label={t("portal.home.kpi_balance")}
              value={money(balance, displayCurrency)}
              tone={balance > 0 ? "primary" : "default"}
              sub={balance > 0 ? t("portal.home.kpi_balance_pay") : t("portal.home.kpi_balance_clear")}
              href={balance > 0 ? "/portal/invoices" : undefined}
              cta={balance > 0 ? t("portal.home.kpi_balance_pay") : undefined} />
            <StatCard icon={FileClock} label={t("portal.home.kpi_docs")} value={String(docsPending)}
              tone={docsPending > 0 ? "warn" : "default"}
              sub={docsPending > 0 ? t("portal.home.kpi_docs_sub") : t("portal.home.kpi_docs_clear")}
              href={docsPending > 0 ? "/portal/documents" : undefined} />
          </div>
        )}

        {/* Charts row */}
        {loading ? (
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 mt-4">
            <Skeleton className="h-52 rounded-2xl" />
            <Skeleton className="h-52 rounded-2xl" />
          </div>
        ) : hasData && (
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 mt-4">
            {/* Contract status donut */}
            <div className="rounded-2xl border border-card-border bg-card p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-card-foreground">{t("portal.home.chart_status_title", "Contract status")}</h2>
              </div>
              <DonutChart data={bucketCounts} total={bookings.length}
                centerValue={String(bookings.length)} centerLabel={t("portal.home.chart_status_center", "Total contracts")} />
            </div>
            {/* Monthly payments bar */}
            <div className="rounded-2xl border border-card-border bg-card p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-card-foreground">{t("portal.home.chart_payments_title", "Payments (6 months)")}</h2>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{money(paidTotal, displayCurrency)}</span>
              </div>
              <BarChart bars={bars} currency={displayCurrency} />
            </div>
          </div>
        )}

        {/* Active contract progress */}
        {!loading && current && stayTotal > 0 && (
          <section className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">{t("portal.home.active_contract_title", "Current contract")}</p>
                <p className="font-semibold text-card-foreground truncate mt-0.5">{current.space_name ?? current.property_name ?? t("portal.home.stay_fallback", "Stay")}</p>
                <p className="text-xs text-muted-foreground tabular-nums mt-0.5">{formatDate(current.check_in_date)} → {formatDate(current.check_out_date)}</p>
              </div>
              <Link href={`/portal/bookings/${current.id}?tab=contract`}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline shrink-0">
                {t("portal.home.view_contract", "View contract")} <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${stayPct}%` }} />
            </div>
            <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground tabular-nums">
              <span>{t("portal.home.days_elapsed", "Day {{n}}", { n: stayElapsed })} / {stayTotal}</span>
              <span>{t("portal.home.days_left", "{{n}} days left", { n: stayLeft })}</span>
            </div>
          </section>
        )}

        {/* Recent contracts */}
        <section className="mt-7 sm:mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-semibold text-foreground">{t("portal.home.recent_contracts_title", "My contracts")}</h2>
            <Link href="/portal/bookings"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
              {t("portal.home.view_all")} <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : recent.length === 0 ? (
            <EmptyState icon={MapPin}
              title={t("portal.home.empty_title")}
              description={t("portal.home.empty_sub")}
              ctaLabel={t("portal.home.empty_cta")}
              ctaHref="/" />
          ) : (
            <>
              {/* Mobile: stacked cards */}
              <div className="grid gap-2 md:hidden">
                {recent.map((b) => <ContractRowMobile key={b.id} b={b} />)}
              </div>
              {/* Desktop: table */}
              <div className="hidden md:block overflow-hidden rounded-2xl border border-card-border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="font-medium px-4 py-3">{t("portal.home.th_ref")}</th>
                      <th className="font-medium px-4 py-3">{t("portal.home.th_stay")}</th>
                      <th className="font-medium px-4 py-3">{t("portal.home.th_dates")}</th>
                      <th className="font-medium px-4 py-3">{t("portal.home.th_status")}</th>
                      <th className="font-medium px-4 py-3 text-right">{t("portal.home.th_amount")}</th>
                      <th className="font-medium px-4 py-3 w-8" aria-hidden />
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((b) => (
                      <tr key={b.id}
                        className="border-b border-card-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer group"
                        onClick={() => setLocation(`/portal/bookings/${b.id}`)}>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{b.booking_reference ?? `#${b.id}`}</td>
                        <td className="px-4 py-3 font-medium text-card-foreground">
                          <span className="block truncate max-w-[180px]">{b.space_name ?? b.property_name ?? t("portal.home.stay_fallback", "Stay")}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap tabular-nums">{formatDate(b.check_in_date)} → {formatDate(b.check_out_date)}</td>
                        <td className="px-4 py-3"><StatusBadge status={b.booking_status} /></td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-card-foreground whitespace-nowrap">
                          {b.total_amount ? money(Number(b.total_amount), b.currency ?? "AUD") : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </PortalLayout>
  );
}

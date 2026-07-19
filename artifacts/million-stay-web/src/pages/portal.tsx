import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { format, differenceInCalendarDays } from "date-fns";
import {
  CalendarClock, BedDouble, Wallet, FileClock,
  ChevronRight, MapPin, CalendarRange,
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

/* ── helpers ─────────────────────────────────────────────── */

function formatDate(d?: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM"); } catch { return d; }
}

function formatMoney(amount: number, currency = "AUD") {
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency", currency, maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

const ACTIVE_STATUSES = ["Active", "Confirmed"];
const PENDING_DOC = ["pending", "required", "submitted", "under_review"];

function isUnpaid(inv: MyInvoice) {
  const s = (inv.status ?? "").toLowerCase();
  return !inv.paid_at && s !== "paid" && s !== "cancelled" && s !== "void";
}

/* ── recent activity row ─────────────────────────────────── */

function ActivityRowMobile({ b }: { b: MyBooking }) {
  return (
    <Link href={`/portal/bookings/${b.id}`}
      className="flex flex-col gap-2 rounded-xl border border-card-border bg-card p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground truncate">{b.booking_reference ?? `#${b.id}`}</span>
        <StatusBadge status={b.booking_status} />
      </div>
      <p className="font-semibold text-sm text-card-foreground truncate">{b.space_name ?? b.property_name ?? "Stay"}</p>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><CalendarRange className="h-3.5 w-3.5" />{formatDate(b.check_in_date)} → {formatDate(b.check_out_date)}</span>
        {b.total_amount && <span className="tabular-nums font-medium text-card-foreground">{formatMoney(Number(b.total_amount), b.currency ?? "AUD")}</span>}
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

  // Screen-scoped dark mode: follow the OS preference while the dashboard is
  // mounted, and clean up on unmount so the (light-only) rest of the portal is
  // untouched. No global toggle. (spec: screen-scoped + system-driven)
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
    : t("portal.home.kpi_in_days", { count: nextStayDays });

  const activeCount = bookings.filter((b) => ACTIVE_STATUSES.includes(b.booking_status)).length;

  const unpaid = invoices.filter(isUnpaid);
  const balance = unpaid.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const balanceCurrency = unpaid[0]?.currency ?? "AUD";

  const docsPending = documents.filter((d) => PENDING_DOC.includes((d.status ?? "").toLowerCase())).length;

  const recent = [...bookings]
    .sort((a, b) => new Date(b.check_in_date).getTime() - new Date(a.check_in_date).getTime())
    .slice(0, 5);

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
          <p className="text-sm text-muted-foreground mt-0.5">{t("portal.home.subtitle")}</p>
        </header>

        {/* KPI grid */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[110px] rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard icon={CalendarClock} label={t("portal.home.kpi_next_stay")} value={nextStayValue}
              sub={nextStay ? (nextStay.space_name ?? nextStay.property_name ?? undefined) : t("portal.home.kpi_next_stay_none")} />
            <StatCard icon={BedDouble} label={t("portal.home.kpi_active")} value={String(activeCount)}
              sub={t("portal.home.kpi_active_sub")} />
            <StatCard icon={Wallet} label={t("portal.home.kpi_balance")}
              value={balance > 0 ? formatMoney(balance, balanceCurrency) : formatMoney(0, balanceCurrency)}
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

        {/* Recent activity */}
        <section className="mt-7 sm:mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-semibold text-foreground">{t("portal.home.recent_title")}</h2>
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
                {recent.map((b) => <ActivityRowMobile key={b.id} b={b} />)}
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
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((b) => (
                      <tr key={b.id}
                        className="border-b border-card-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => setLocation(`/portal/bookings/${b.id}`)}>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{b.booking_reference ?? `#${b.id}`}</td>
                        <td className="px-4 py-3 font-medium text-card-foreground">
                          <span className="block truncate max-w-[180px]">{b.space_name ?? b.property_name ?? "Stay"}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap tabular-nums">{formatDate(b.check_in_date)} → {formatDate(b.check_out_date)}</td>
                        <td className="px-4 py-3"><StatusBadge status={b.booking_status} /></td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-card-foreground whitespace-nowrap">
                          {b.total_amount ? formatMoney(Number(b.total_amount), b.currency ?? "AUD") : "—"}
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

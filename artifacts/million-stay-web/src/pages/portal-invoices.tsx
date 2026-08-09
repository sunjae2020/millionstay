import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useListMyInvoices, getListMyInvoicesQueryKey, type MyInvoice } from "@/lib/guest-api";
import { useAuthStore } from "@/lib/store";
import { PortalLayout } from "@/components/portal-layout";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Receipt, AlertCircle, Clock, CheckCircle2,
  CalendarDays, Home, ExternalLink, Layers, ChevronDown,
} from "lucide-react";
import { formatDate } from "@/lib/dateFormat";
import { formatCurrencyAmount } from "@/contexts/DisplayCurrencyContext";
import { DEFAULT_CURRENCY } from "@/lib/defaultCurrency";

const BRAND = "hsl(var(--primary))"; // instance primary (white-label)

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  Paid:    { label: "Paid",     cls: "bg-green-100 text-green-700 border border-green-200",  icon: CheckCircle2 },
  Sent:    { label: "Unpaid",   cls: "bg-blue-100 text-blue-700 border border-blue-200",     icon: Clock },
  Overdue: { label: "Overdue",  cls: "bg-red-100 text-red-600 border border-red-200",        icon: AlertCircle },
  Draft:   { label: "Draft",    cls: "bg-gray-100 text-gray-500 border border-gray-200",     icon: FileText },
  Void:    { label: "Void",     cls: "bg-gray-100 text-gray-400 border border-gray-200",     icon: FileText },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  card: "Credit Card",
  cash: "Cash",
  stripe: "Stripe",
  cheque: "Cheque",
};

function fmtAmt(n: number | null | undefined, currency?: string | null) {
  if (n == null) return "—";
  return formatCurrencyAmount(Number(n), (currency || DEFAULT_CURRENCY || "AUD").toUpperCase());
}

/**
 * 한 건의 청구서 카드.
 * 통합(단체) 청구서면 "통합 청구" 배지와 함께, 이번 달 묶인 공간별 내역(호실·기간·
 * 금액)과 공간별 인보이스를 펼쳐 볼 수 있다 — 세입자는 합계와 호실별 내역을 한 화면에서
 * 확인하고 통합 청구서 한 장으로 납부한다.
 */
function InvoiceCard({ inv, children = [] }: { inv: MyInvoice; children?: MyInvoice[] }) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const isConsolidated = inv.invoice_kind === "consolidated";
  const lines = inv.line_items ?? [];
  const cfg = STATUS_CONFIG[inv.status ?? ""] ?? STATUS_CONFIG.Draft;
  const StatusIcon = cfg.icon;
  const isPaid = inv.status === "Paid";
  const isOverdue = inv.status === "Overdue";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-2xl border overflow-hidden ${isOverdue ? "border-red-200 shadow-sm shadow-red-50" : "border-gray-100"}`}
    >
      {/* ── Top row ── */}
      <div className="flex items-start gap-4 px-5 pt-5 pb-4">
        {/* Icon */}
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isPaid ? "bg-green-50" : isOverdue ? "bg-red-50" : "bg-orange-50"}`}
        >
          {isConsolidated
            ? <Layers className={`h-5 w-5 ${isPaid ? "text-green-600" : isOverdue ? "text-red-500" : "text-primary"}`} />
            : <StatusIcon className={`h-5 w-5 ${isPaid ? "text-green-600" : isOverdue ? "text-red-500" : "text-primary"}`} />}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          {/* Invoice ref + status badge */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-sm font-semibold text-gray-800">
              {inv.invoice_ref ?? `INV-${inv.id}`}
            </span>
            {isConsolidated && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold px-2 py-0.5">
                <Layers className="h-3 w-3" />
                {t("portal.invoices.consolidated")}
              </span>
            )}
            <StatusBadge status={inv.status ?? "Draft"} label={t("portal.invoices.status_" + cfg.label.toLowerCase(), cfg.label)} icon={<StatusIcon className="h-3 w-3" />} />
          </div>

          {/* Description (monthly label) — prominent */}
          {inv.description && (
            <p className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              {inv.description}
            </p>
          )}

          {/* Property */}
          {inv.space_name && (
            <p className="text-xs text-gray-400 flex items-center gap-1.5 truncate">
              <Home className="h-3 w-3 shrink-0" />
              {inv.space_name}
              {inv.property_address && ` — ${inv.property_address}`}
            </p>
          )}
        </div>

        {/* Amount */}
        <div className="text-right shrink-0">
          <p className="text-base font-bold text-gray-900">{fmtAmt(inv.amount, inv.currency)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t("portal.invoices.due", "Due {{date}}", { date: formatDate(inv.due_date) })}</p>
        </div>
      </div>

      {/* ── 통합 청구서: 호실별 내역 ── */}
      {isConsolidated && (lines.length > 0 || children.length > 0) && (
        <div className="border-t border-gray-100">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <span>{t("portal.invoices.consolidated_breakdown", { count: lines.length || children.length })}</span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>

          {open && (
            <div className="px-5 pb-4 space-y-3">
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
                {lines.map((li, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 px-3 py-2.5 bg-white">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">{li.label}</p>
                      {li.description && (
                        <p className="text-[11px] text-gray-400 mt-0.5">{li.description}</p>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-gray-800 shrink-0">
                      {fmtAmt(Number(li.total_amount ?? 0), inv.currency ?? "AUD")}
                    </span>
                  </li>
                ))}
              </ul>

              {children.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                    {t("portal.invoices.per_space_invoices")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {children.map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-600"
                      >
                        <span className="font-mono font-medium text-gray-700">{c.invoice_ref ?? `INV-${c.id}`}</span>
                        {c.space_name && <span className="text-gray-400">· {c.space_name}</span>}
                        <span className="font-semibold text-gray-800">{fmtAmt(c.amount, c.currency ?? "AUD")}</span>
                        {c.status === "Paid" && (
                          <button
                            type="button"
                            className="text-green-700 underline underline-offset-2"
                            onClick={() => setLocation(`/portal/invoices/${c.id}/receipt`)}
                          >
                            {t("portal.invoices.view_receipt")}
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Bottom detail strip ── */}
      <div className={`px-5 py-3 flex items-center justify-between border-t ${isPaid ? "bg-green-50/50 border-green-100" : isOverdue ? "bg-red-50/50 border-red-100" : "bg-gray-50/60 border-gray-100"}`}>
        <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
          {inv.booking_ref && (
            <span>{t("portal.invoices.booking")}: <span className="font-mono font-medium text-gray-700">{inv.booking_ref}</span></span>
          )}
          {isPaid && inv.paid_at && (
            <span className="text-green-700 font-medium">
              {formatDate(inv.paid_at)}
              {inv.payment_method && ` · ${t("portal.invoices.pm_" + inv.payment_method, PAYMENT_METHOD_LABELS[inv.payment_method] ?? inv.payment_method)}`}
            </span>
          )}
          {!isPaid && isOverdue && (
            <span className="text-red-600 font-semibold">{t("portal.invoices.payment_overdue")}</span>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          {isPaid && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs border-green-200 text-green-700 hover:bg-green-50"
              onClick={() => setLocation(`/portal/invoices/${inv.id}/receipt`)}
            >
              <Receipt className="h-3.5 w-3.5" />
              {t("portal.invoices.view_receipt")}
              <ExternalLink className="h-3 w-3 opacity-60" />
            </Button>
          )}
          {!isPaid && (
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              style={{ backgroundColor: BRAND, borderColor: BRAND }}
              onClick={() => setLocation(`/portal/payment?invoice_id=${inv.id}`)}
            >
              {t("portal.invoices.pay_now")}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ tab }: { tab: string }) {
  const { t } = useTranslation();
  const msgs: Record<string, { icon: React.ElementType; title: string; sub: string }> = {
    all:     { icon: FileText,     title: t("portal.invoices.empty_all_title"),     sub: t("portal.invoices.empty_all_sub") },
    unpaid:  { icon: Clock,        title: t("portal.invoices.empty_unpaid_title"),  sub: t("portal.invoices.empty_unpaid_sub") },
    paid:    { icon: CheckCircle2, title: t("portal.invoices.empty_paid_title"),    sub: t("portal.invoices.empty_paid_sub") },
    overdue: { icon: AlertCircle,  title: t("portal.invoices.empty_overdue_title"), sub: t("portal.invoices.empty_overdue_sub") },
  };
  const m = msgs[tab] ?? msgs.all;
  const Icon = m.icon;
  return (
    <div className="text-center py-20 text-gray-400">
      <Icon className="h-10 w-10 mx-auto mb-3 opacity-25" />
      <p className="font-semibold text-gray-500">{m.title}</p>
      <p className="text-sm mt-1">{m.sub}</p>
    </div>
  );
}

export default function PortalInvoices() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { token } = useAuthStore();

  useEffect(() => {
    if (!token) setLocation("/login?redirect=/portal/invoices");
  }, [token, setLocation]);

  const { data, isLoading } = useListMyInvoices({
    query: { enabled: !!token, queryKey: getListMyInvoicesQueryKey() },
  });

  const invoices: MyInvoice[] = (data?.data ?? []) as MyInvoice[];

  // 통합(단체) 청구서에 묶인 공간별 인보이스는 목록에 따로 세우지 않고 통합 청구서
  // 카드 안에서 펼쳐 본다 — 같은 금액이 두 번 서 있는 것처럼 보이지 않게 한다.
  const childrenByParent = useMemo(() => {
    const map: Record<number, MyInvoice[]> = {};
    for (const inv of invoices) {
      if (inv.parent_invoice_id) (map[inv.parent_invoice_id] ??= []).push(inv);
    }
    return map;
  }, [invoices]);
  const topLevel = useMemo(() => invoices.filter((i) => !i.parent_invoice_id), [invoices]);

  function filterInvoices(tab: string) {
    if (tab === "unpaid") return topLevel.filter((i) => i.status === "Sent" || i.status === "Draft");
    if (tab === "paid") return topLevel.filter((i) => i.status === "Paid");
    if (tab === "overdue") return topLevel.filter((i) => i.status === "Overdue");
    return topLevel;
  }

  // Summary counts
  const paidCount = topLevel.filter(i => i.status === "Paid").length;
  const unpaidCount = topLevel.filter(i => i.status === "Sent" || i.status === "Draft").length;
  const overdueCount = topLevel.filter(i => i.status === "Overdue").length;

  if (!token) return null;

  return (
    <PortalLayout active="/portal/invoices">
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">

        {/* ── Page header ── */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-5 w-5" style={{ color: BRAND }} />
            {t("portal.invoices.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t("portal.invoices.subtitle")}</p>
        </div>

        {/* ── Summary strip ── */}
        {!isLoading && topLevel.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: t("portal.invoices.unpaid"), count: unpaidCount, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
              { label: t("portal.invoices.paid"),   count: paidCount,   color: "text-green-600", bg: "bg-green-50 border-green-100" },
              { label: t("portal.invoices.overdue"),count: overdueCount, color: "text-red-600", bg: "bg-red-50 border-red-100" },
            ].map(({ label, count, color, bg }) => (
              <div key={label} className={`rounded-xl border px-4 py-3 ${bg}`}>
                <p className={`text-2xl font-bold ${color}`}>{count}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Tabs ── */}
        <Tabs defaultValue="all">
          <TabsList className="mb-5 bg-white border w-full sm:w-auto">
            {[
              { value: "all",     label: `${t("portal.invoices.tab_all")} (${topLevel.length})` },
              { value: "unpaid",  label: `${t("portal.invoices.unpaid")} (${unpaidCount})` },
              { value: "paid",    label: `${t("portal.invoices.paid")} (${paidCount})` },
              { value: "overdue", label: `${t("portal.invoices.overdue")} (${overdueCount})` },
            ].map(({ value, label }) => (
              <TabsTrigger key={value} value={value} className="text-sm flex-1 sm:flex-none">{label}</TabsTrigger>
            ))}
          </TabsList>

          {["all", "unpaid", "paid", "overdue"].map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-3">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-2xl" />
                ))
              ) : filterInvoices(tab).length === 0 ? (
                <EmptyState tab={tab} />
              ) : (
                <AnimatePresence>
                  {filterInvoices(tab).map((inv) => (
                    <InvoiceCard key={inv.id} inv={inv} children={childrenByParent[inv.id] ?? []} />
                  ))}
                </AnimatePresence>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </PortalLayout>
  );
}

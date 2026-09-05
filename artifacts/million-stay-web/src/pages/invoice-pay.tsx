/**
 * 청구서 — 세입자용 조회 · 입금 통보 화면 (토큰 링크, 로그인 없음).
 *
 * 세입자가 링크를 열면 이번 달 청구 금액과 입금 계좌가 먼저 보이고, 계좌번호는
 * 한 번 눌러 복사된다(휴대폰 은행 앱으로 옮겨 붙이는 것이 실제 동선이다).
 * 입금을 마친 뒤에는 "입금했습니다"를 남겨 담당자가 통장을 확인할 수 있게 한다.
 *
 * 이 통보가 청구서를 납부 완료로 바꾸지는 않는다 — 수납 확인은 통장을 보는
 * 사람의 일이고, 여기서 자동으로 넘기면 미입금 건이 장부에서 사라진다.
 */
import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useTranslation } from "react-i18next";
import {
  AlertCircle, Banknote, Check, CheckCircle2, Copy, FileText, Loader2,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { DevNavbar, DevFooter } from "@/components/development/DevLayout";
import { isDevelopmentSite } from "@/lib/site-mode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";
import {
  getInvoicePay, invoicePdfUrl, reportPayment, TenantLinkError, type InvoicePayView,
} from "@/lib/tenant-link-api";

const DEV_SITE = isDevelopmentSite();

function money(amount: string | number | null | undefined, currency: string, locale: string): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return String(amount ?? "");
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: currency === "KRW" ? 0 : 2 }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString()}`;
  }
}

export default function InvoicePay() {
  const { t, i18n } = useTranslation();
  const [, params] = useRoute("/pay/:token");
  const token = params?.token ?? "";

  const [view, setView] = useState<InvoicePayView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [payer, setPayer] = useState("");
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getInvoicePay(token);
        if (cancelled) return;
        setView(data);
        setPayer((prev) => prev || (data.invoice.account_name ?? ""));
        setLoadError(null);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof TenantLinkError ? e.message : t("invoicePay.load_failed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen flex flex-col bg-background">
      {DEV_SITE ? <DevNavbar /> : <Navbar />}
      <main className="flex-1 w-full mx-auto max-w-2xl px-4 sm:px-6 py-8 sm:py-12">{children}</main>
      {DEV_SITE ? <DevFooter /> : <Footer />}
    </div>
  );

  if (loading) {
    return shell(<div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>);
  }

  if (loadError || !view) {
    return shell(
      <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 text-center">
        <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground" />
        <h1 className="mt-4 text-xl font-bold">{t("invoicePay.unavailable")}</h1>
        <p className="mt-2 text-muted-foreground">{loadError}</p>
      </div>,
    );
  }

  const inv = view.invoice;
  const locale = i18n.language || "en";
  const notices = done ? [{ payer_name: payer, paid_on: paidOn, amount: null, memo, at: "" }, ...view.notices] : view.notices;
  const reported = notices.length > 0;

  async function submit() {
    if (!payer.trim()) { setSubmitError(t("invoicePay.err_payer")); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await reportPayment(token, { payer_name: payer.trim(), paid_on: paidOn, memo: memo.trim() || null });
      setDone(true);
    } catch (e) {
      setSubmitError(e instanceof TenantLinkError ? e.message : t("invoicePay.err_submit"));
    } finally {
      setSubmitting(false);
    }
  }

  function copyAccount() {
    const acc = view!.bank_account;
    if (!acc?.account_number) return;
    navigator.clipboard?.writeText(acc.account_number.replace(/\s+/g, ""));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return shell(
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("invoicePay.title")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {inv.invoice_ref}{inv.billing_period ? ` · ${inv.billing_period}` : ""}
        </p>
      </div>

      {/* 금액 · 납기 */}
      <div className="rounded-xl border bg-card p-5">
        <p className="text-xs text-muted-foreground">{t("invoicePay.amount_due")}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{money(inv.total_amount, inv.currency, locale)}</p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {inv.due_date && (
            <span><span className="text-muted-foreground">{t("invoicePay.due_date")}</span> <b>{inv.due_date}</b></span>
          )}
          {inv.account_name && (
            <span><span className="text-muted-foreground">{t("invoicePay.billed_to")}</span> {inv.account_name}</span>
          )}
        </div>
        {inv.paid && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-green-700">
            <CheckCircle2 className="w-4 h-4" /> {t("invoicePay.already_paid")}
          </p>
        )}
      </div>

      {/* 청구 내역 */}
      {inv.line_items?.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b text-sm font-medium">{t("invoicePay.breakdown")}</div>
          <ul className="divide-y">
            {inv.line_items.map((li, i) => (
              <li key={i} className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm">
                <span>
                  {li.label}
                  {li.description && <span className="block text-xs text-muted-foreground">{li.description}</span>}
                </span>
                <span className="tabular-nums shrink-0">{money(li.total_amount, inv.currency, locale)}</span>
              </li>
            ))}
            {Number(inv.tax_amount ?? 0) > 0 && (
              <li className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm">
                <span>{t("invoicePay.vat")}</span>
                <span className="tabular-nums">{money(inv.tax_amount, inv.currency, locale)}</span>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* 입금 계좌 */}
      {view.bank_account && (
        <div className="rounded-xl border bg-card p-5">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium">
            <Banknote className="w-4 h-4 text-primary" /> {t("invoicePay.bank_title")}
          </p>
          <dl className="mt-3 space-y-1.5 text-sm">
            {[
              [t("invoicePay.bank_name"), view.bank_account.bank_name],
              [t("invoicePay.account_name"), view.bank_account.account_name],
              [t("invoicePay.bsb"), view.bank_account.bsb_number],
              [t("invoicePay.swift"), view.bank_account.swift_code],
            ].filter(([, v]) => !!v).map(([label, value]) => (
              <div key={String(label)} className="flex gap-3">
                <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
            {view.bank_account.account_number && (
              <div className="flex items-center gap-3">
                <dt className="w-28 shrink-0 text-muted-foreground">{t("invoicePay.account_number")}</dt>
                <dd className="flex items-center gap-2 font-semibold tabular-nums">
                  {view.bank_account.account_number}
                  <button onClick={copyAccount} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-normal hover:bg-muted/50">
                    {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? t("invoicePay.copied") : t("invoicePay.copy")}
                  </button>
                </dd>
              </div>
            )}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">{t("invoicePay.bank_hint")}</p>
        </div>
      )}

      <Button variant="outline" className="w-full" onClick={() => openPreview({
        title: inv.invoice_ref,
        filename: `${inv.invoice_ref}.pdf`,
        href: invoicePdfUrl(token, i18n.language),
        token,
      })}>
        <FileText className="w-4 h-4 mr-1.5" /> {t("invoicePay.view_pdf")}
      </Button>

      {/* 입금 통보 */}
      {reported ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5">
          <p className="inline-flex items-center gap-1.5 font-medium text-green-800">
            <CheckCircle2 className="w-5 h-5" /> {t("invoicePay.reported_title")}
          </p>
          <p className="mt-1.5 text-sm text-green-900">{t("invoicePay.reported_desc")}</p>
          <ul className="mt-3 space-y-1 text-sm text-green-900">
            {notices.map((n, i) => (
              <li key={i}>{n.payer_name} · {n.paid_on}{n.memo ? ` · ${n.memo}` : ""}</li>
            ))}
          </ul>
        </div>
      ) : !inv.paid && (
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <p className="text-sm font-medium">{t("invoicePay.report_title")}</p>
          <p className="text-sm text-muted-foreground">{t("invoicePay.report_desc")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted-foreground">{t("invoicePay.payer_name")}</span>
              <Input value={payer} onChange={(e) => setPayer(e.target.value)} />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted-foreground">{t("invoicePay.paid_on")}</span>
              <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </label>
          </div>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">{t("invoicePay.memo")}</span>
            <Textarea rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder={t("invoicePay.memo_ph")} />
          </label>
          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          <Button className="w-full" onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
            {t("invoicePay.report_submit")}
          </Button>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        {t("invoicePay.contact", { company: view.company.name })}
        {view.company.phone ? ` · ${view.company.phone}` : ""}
        {view.company.email ? ` · ${view.company.email}` : ""}
      </p>

      <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
    </div>,
  );
}

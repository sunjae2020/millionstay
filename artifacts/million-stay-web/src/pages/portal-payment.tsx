import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/lib/store";
import { PortalLayout } from "@/components/portal-layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard, Banknote, Lock, CheckCircle2,
  ChevronLeft, Sparkles, LayoutDashboard, AlertCircle,
  Copy, Check, Building2,
} from "lucide-react";
import { getApiBase } from "@/lib/api-base";
import { format } from "date-fns";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { apiFetch, useSupportEmail, type MyInvoice } from "@/lib/guest-api";
import { COMPANY } from "../lib/company";

const BRAND = "hsl(var(--primary))"; // instance primary (white-label)
const API = getApiBase();

/* ─── helpers ─── */
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy"); } catch { return d; }
}
function fmtAmt(n: number | null | undefined, currency = "AUD") {
  if (n == null) return "—";
  return `$${Number(n).toLocaleString("en-AU", { minimumFractionDigits: 2 })} ${currency}`;
}

/* ─── Bank Transfer Panel ─── */
function BankDetails({ amount, invoiceRef }: { amount: number; invoiceRef: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (val: string, key: string) => {
    navigator.clipboard.writeText(val).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const rows: [string, string, string][] = [
    ["Bank", COMPANY.bank.name, "bank"],
    ["Account Name", COMPANY.bank.accountName, "name"],
    ["BSB", COMPANY.bank.bsb, "bsb"],
    ["Account No.", COMPANY.bank.accountNo, "acc"],
    ["Amount", fmtAmt(amount), "amt"],
    ["Reference", invoiceRef, "ref"],
  ];

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Building2 className="h-5 w-5 text-blue-600" />
        <p className="font-semibold text-blue-800">Bank Transfer Details</p>
      </div>
      <div className="bg-white rounded-xl border border-blue-100 divide-y divide-blue-50">
        {rows.map(([label, value, key]) => (
          <div key={key} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="text-blue-600 font-medium w-28 shrink-0">{label}</span>
            <span className="font-mono font-semibold text-gray-800 flex-1">{value}</span>
            <button
              onClick={() => copy(value, key)}
              className="ml-2 text-gray-400 hover:text-blue-600 transition-colors"
              title="Copy"
            >
              {copied === key ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2 bg-white rounded-lg px-3 py-2.5 border border-blue-100">
        <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-gray-600">
          Please transfer within <strong>48 hours</strong> and use the invoice reference{" "}
          <strong className="font-mono">{invoiceRef}</strong> in your description.
          Your booking will be confirmed once payment is received.
        </p>
      </div>
    </div>
  );
}

/* ─── Stripe Card Form (inner, must be inside <Elements>) ─── */
function StripeCardForm({
  amount,
  currency,
  invoiceRef,
  invoiceId,
  token,
  onSuccess,
}: {
  amount: number;
  currency: string;
  invoiceRef: string;
  invoiceId: number;
  token: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [paying, setPaying] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setPaying(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });
    if (error) {
      toast({ title: error.message ?? "Payment failed", variant: "destructive" });
      setPaying(false);
    } else {
      // Payment succeeded (no redirect needed)
      onSuccess();
    }
  };

  return (
    <div className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      <p className="text-xs text-gray-400 flex items-center gap-1.5">
        <Lock className="h-3 w-3" /> Your payment is secured by Stripe. Card details are never stored on our servers.
      </p>
      <Button
        onClick={handlePay}
        disabled={!stripe || paying}
        className="w-full h-12 text-base font-bold rounded-xl"
        style={{ backgroundColor: BRAND }}
      >
        {paying ? (
          <span className="flex items-center gap-2"><span className="animate-spin rounded-full h-4 w-4 border-2 border-white/40 border-t-white" /> Processing…</span>
        ) : (
          <span className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Pay {fmtAmt(amount, currency)}</span>
        )}
      </Button>
    </div>
  );
}

/* ─── Invoice Summary Card ─── */
function InvoiceSummary({ inv }: { inv: MyInvoice }) {
  return (
    <div className="bg-white rounded-2xl border p-5 space-y-3 sticky top-24">
      <h3 className="font-semibold text-gray-800 text-sm">Invoice Summary</h3>
      <div className="flex justify-between text-sm border-b pb-2">
        <span className="text-gray-500">Invoice Ref</span>
        <span className="font-mono font-semibold text-gray-800">{inv.invoice_ref ?? `INV-${inv.id}`}</span>
      </div>
      {inv.description && (
        <div className="flex justify-between text-sm border-b pb-2">
          <span className="text-gray-500">Description</span>
          <span className="font-medium text-gray-800 text-right max-w-[160px]">{inv.description}</span>
        </div>
      )}
      {inv.space_name && (
        <div className="flex justify-between text-sm border-b pb-2">
          <span className="text-gray-500">Property</span>
          <span className="font-medium text-gray-800 text-right max-w-[160px]">{inv.space_name}</span>
        </div>
      )}
      {inv.due_date && (
        <div className="flex justify-between text-sm border-b pb-2">
          <span className="text-gray-500">Due Date</span>
          <span className="font-medium text-gray-800">{fmtDate(inv.due_date)}</span>
        </div>
      )}
      <div className="flex justify-between items-center pt-1">
        <span className="font-bold text-gray-900">Amount Due</span>
        <span className="font-black text-xl" style={{ color: BRAND }}>{fmtAmt(inv.amount, inv.currency ?? "AUD")}</span>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function PortalPayment() {
  const [, setLocation] = useLocation();
  const { token } = useAuthStore();
  const { toast } = useToast();
  const supportEmail = useSupportEmail();

  const params = new URLSearchParams(window.location.search);
  const invoiceId = params.get("invoice_id");

  useEffect(() => {
    if (!token) setLocation(`/login?redirect=/portal/payment${invoiceId ? `?invoice_id=${invoiceId}` : ""}`);
  }, [token]);

  /* ── Invoice data ── */
  const [invoice, setInvoice] = useState<MyInvoice | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(true);

  useEffect(() => {
    if (!token || !invoiceId) { setLoadingInvoice(false); return; }
    apiFetch<{ success: boolean; data: MyInvoice }>(`/guest/invoices/${invoiceId}`)
      .then((r) => { setInvoice(r.data); setLoadingInvoice(false); })
      .catch(() => { setLoadingInvoice(false); });
  }, [token, invoiceId]);

  /* ── Stripe config ── */
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeConfigured, setStripeConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`${API}/api/v1/stripe/config`)
      .then((r) => r.json())
      .then((cfg) => {
        setStripeConfigured(!!cfg.publishable_key);
        if (cfg.publishable_key) {
          setStripePromise(loadStripe(cfg.publishable_key));
        }
      })
      .catch(() => setStripeConfigured(false));
  }, []);

  /* ── Payment method ── */
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bank">("card");
  const [paid, setPaid] = useState(false);
  const [bankConfirmed, setBankConfirmed] = useState(false);
  const [confirmingBank, setConfirmingBank] = useState(false);

  /* ── Create Stripe PaymentIntent when card selected + Stripe configured ── */
  useEffect(() => {
    if (paymentMethod !== "card" || !stripeConfigured || !invoice || !token) return;
    if (clientSecret) return; // already created

    fetch(`${API}/api/v1/guest/payment/create-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ invoice_id: Number(invoiceId) }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data?.client_secret) setClientSecret(j.data.client_secret);
        else if (j.error) toast({ title: j.error, variant: "destructive" });
      })
      .catch(() => toast({ title: "Failed to initialise payment", variant: "destructive" }));
  }, [paymentMethod, stripeConfigured, invoice, token]);

  /* ── Bank transfer confirm ── */
  const handleBankConfirm = async () => {
    if (!token || !invoiceId) return;
    setConfirmingBank(true);
    try {
      const res = await fetch(`${API}/api/v1/guest/payment/invoice-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ invoice_id: Number(invoiceId), payment_method: "bank_transfer" }),
      });
      const j = await res.json();
      if (j.success) {
        setBankConfirmed(true);
      } else {
        toast({ title: j.error ?? "Confirmation failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setConfirmingBank(false);
    }
  };

  if (!token) return null;

  /* ── Success Screen ── */
  if (paid || bankConfirmed) {
    const isBank = bankConfirmed;
    return (
      <PortalLayout active="/portal/invoices">
        <div className="flex-1 max-w-lg mx-auto w-full px-4 py-12 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: isBank ? "#dbeafe" : "#dcfce7" }}
          >
            {isBank
              ? <Building2 className="h-10 w-10 text-blue-600" />
              : <Sparkles className="h-10 w-10 text-green-600" />}
          </motion.div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {isBank ? "Bank Transfer Initiated!" : "Payment Complete!"}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {isBank
              ? "Please complete your bank transfer within 48 hours using the details below. Your invoice will be marked as paid once payment is received."
              : "Your payment has been processed successfully. A receipt has been emailed to you."}
          </p>
          {isBank && invoice && (
            <div className="mb-6 text-left">
              <BankDetails amount={Number(invoice.amount)} invoiceRef={invoice.invoice_ref ?? `INV-${invoice.id}`} />
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => setLocation("/portal/invoices")}
              className="font-bold rounded-xl"
              style={{ backgroundColor: BRAND }}
            >
              <LayoutDashboard className="h-4 w-4 mr-2" /> Back to Invoices
            </Button>
            <Button variant="outline" onClick={() => setLocation("/portal/bookings")} className="rounded-xl">
              View Bookings
            </Button>
          </div>
        </div>
      </PortalLayout>
    );
  }

  /* ── Invoice not found ── */
  if (!loadingInvoice && !invoice) {
    return (
      <PortalLayout active="/portal/invoices">
        <div className="flex-1 max-w-lg mx-auto w-full px-4 py-16 text-center">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-4" />
          <p className="font-semibold text-gray-700 mb-2">Invoice not found</p>
          <p className="text-sm text-gray-400 mb-6">This invoice may not exist or you don't have access to it.</p>
          <Button onClick={() => setLocation("/portal/invoices")} variant="outline">Back to Invoices</Button>
        </div>
      </PortalLayout>
    );
  }

  /* ── Invoice already paid ── */
  if (!loadingInvoice && invoice?.status === "Paid") {
    return (
      <PortalLayout active="/portal/invoices">
        <div className="flex-1 max-w-lg mx-auto w-full px-4 py-16 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <p className="text-xl font-bold text-gray-800 mb-2">Already Paid</p>
          <p className="text-sm text-gray-500 mb-6">This invoice has been paid on {fmtDate(invoice.paid_at)}.</p>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => setLocation(`/portal/invoices/${invoice.id}/receipt`)}
              style={{ backgroundColor: BRAND }}
              className="text-white font-bold rounded-xl"
            >
              View Receipt
            </Button>
            <Button variant="outline" onClick={() => setLocation("/portal/invoices")} className="rounded-xl">
              Back to Invoices
            </Button>
          </div>
        </div>
      </PortalLayout>
    );
  }

  const amount = Number(invoice?.amount ?? 0);
  const currency = invoice?.currency ?? "AUD";
  const invoiceRef = invoice?.invoice_ref ?? `INV-${invoiceId}`;

  return (
    <PortalLayout active="/portal/invoices">
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {/* Back button */}
        <button
          onClick={() => setLocation("/portal/invoices")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Invoices
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left: Payment Panel ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Amount due banner */}
            {!loadingInvoice && invoice && (
              <div className="bg-white rounded-2xl border p-5">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Amount Due</p>
                <p className="text-3xl font-black" style={{ color: BRAND }}>{fmtAmt(amount, currency)}</p>
              </div>
            )}
            {loadingInvoice && <div className="h-20 bg-white rounded-2xl border animate-pulse" />}

            {/* Payment method toggle */}
            <div className="bg-white rounded-2xl border p-5 space-y-4">
              <p className="text-sm font-semibold text-gray-700">Select Payment Method</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ["card", CreditCard, "Credit / Debit Card"],
                  ["bank", Banknote, "Bank Transfer"],
                ] as const).map(([m, Icon, label]) => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`flex flex-col items-center justify-center gap-2 py-4 rounded-xl border-2 font-semibold text-sm transition-all ${
                      paymentMethod === m
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Card Payment ── */}
            <AnimatePresence mode="wait">
              {paymentMethod === "card" && (
                <motion.div
                  key="card"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="bg-white rounded-2xl border p-5 space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-gray-800">Card Payment</h3>
                    <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Secured by Stripe
                    </span>
                  </div>

                  {stripeConfigured === null && (
                    <div className="h-16 rounded-xl bg-gray-100 animate-pulse" />
                  )}

                  {stripeConfigured === false && (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700">
                      <p className="font-semibold mb-1">Online card payment is not available</p>
                      <p className="text-xs text-amber-600">Please use the bank transfer option or contact us at {supportEmail} to arrange payment.</p>
                    </div>
                  )}

                  {stripeConfigured && stripePromise && !clientSecret && !loadingInvoice && (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-gray-200 border-t-primary" />
                      Initialising secure payment…
                    </div>
                  )}

                  {stripeConfigured && stripePromise && clientSecret && (
                    <Elements
                      stripe={stripePromise}
                      options={{
                        clientSecret,
                        appearance: {
                          theme: "stripe",
                          variables: { colorPrimary: BRAND, borderRadius: "10px" },
                        },
                      }}
                    >
                      <StripeCardForm
                        amount={amount}
                        currency={currency}
                        invoiceRef={invoiceRef}
                        invoiceId={Number(invoiceId)}
                        token={token!}
                        onSuccess={() => setPaid(true)}
                      />
                    </Elements>
                  )}
                </motion.div>
              )}

              {/* ── Bank Transfer ── */}
              {paymentMethod === "bank" && (
                <motion.div
                  key="bank"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  <div className="bg-white rounded-2xl border p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-blue-600" />
                      <h3 className="font-semibold text-gray-800">Bank Transfer</h3>
                    </div>
                    <BankDetails amount={amount} invoiceRef={invoiceRef} />
                    <div className="pt-1">
                      <Button
                        onClick={handleBankConfirm}
                        disabled={confirmingBank || loadingInvoice}
                        className="w-full h-12 text-base font-bold rounded-xl"
                        style={{ backgroundColor: BRAND }}
                      >
                        {confirmingBank ? (
                          <span className="flex items-center gap-2">
                            <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/40 border-t-white" />
                            Confirming…
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Banknote className="h-5 w-5" />
                            I've Initiated the Bank Transfer
                          </span>
                        )}
                      </Button>
                      <p className="text-xs text-gray-400 text-center mt-2">
                        Click after you have completed the transfer. We'll confirm your payment upon receipt.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Right: Invoice Summary ── */}
          <div className="lg:col-span-1">
            {loadingInvoice ? (
              <div className="bg-white rounded-2xl border p-5 space-y-3 animate-pulse">
                {[70, 50, 80, 40, 60].map((w, i) => (
                  <div key={i} className="h-4 bg-gray-100 rounded" style={{ width: `${w}%` }} />
                ))}
              </div>
            ) : invoice ? (
              <InvoiceSummary inv={invoice} />
            ) : null}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}

import { useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store";
import { apiFetch, type MyInvoice } from "@/lib/guest-api";
import { Printer, ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const BRAND = "#E8621A";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  card: "Credit / Debit Card",
  cash: "Cash",
  stripe: "Stripe",
  cheque: "Cheque",
};

function fmt(d: string | null | undefined, pattern = "dd MMM yyyy") {
  if (!d) return "—";
  try { return format(new Date(d), pattern); } catch { return d; }
}

function fmtAmt(n: number | null | undefined, currency = "AUD") {
  if (n == null) return "—";
  return `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export default function PortalReceipt() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { token, guest } = useAuthStore();
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) setLocation(`/login?redirect=/portal/invoices/${id}/receipt`);
  }, [token, setLocation, id]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["guest", "invoice", id],
    queryFn: () => apiFetch<{ success: boolean; data: MyInvoice }>(`/guest/invoices/${id}`),
    enabled: !!token && !!id,
  });

  const inv = data?.data;

  const isPaid = inv?.status === "Paid";
  const tenantName = inv?.guest
    ? [inv.guest.first_name, inv.guest.last_name].filter(Boolean).join(" ") || guest?.email
    : [guest?.first_name, guest?.last_name].filter(Boolean).join(" ") || guest?.email;
  const tenantEmail = inv?.guest?.email ?? guest?.email ?? "";

  const propertyFull = [inv?.space_name, inv?.property_address, inv?.property_city, inv?.property_state]
    .filter(Boolean).join(", ");

  const handlePrint = () => window.print();

  if (!token) return null;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ─── Top action bar (hidden when printing) ─── */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setLocation("/portal/invoices")}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Invoices
        </button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" /> Print PDF
          </Button>
          <Button size="sm" onClick={handlePrint} className="gap-2" style={{ backgroundColor: BRAND, borderColor: BRAND }}>
            <Download className="h-4 w-4" /> Save as PDF
          </Button>
        </div>
      </div>

      {/* ─── Loading / Error states ─── */}
      {isLoading && (
        <div className="flex items-center justify-center py-32 text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-primary mr-3" />
          Loading receipt…
        </div>
      )}
      {error && (
        <div className="flex flex-col items-center justify-center py-32 text-red-500">
          <p className="font-semibold mb-2">Could not load receipt</p>
          <p className="text-sm text-gray-400">Please try again or contact support.</p>
        </div>
      )}

      {/* ─── Receipt document ─── */}
      {inv && (
        <div className="py-8 px-4 print:p-0 print:py-0">
          <div
            ref={printRef}
            className="w-full max-w-2xl mx-auto bg-white shadow-xl print:shadow-none print:max-w-none"
            style={{ fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}
          >
            {/* ── Header ── */}
            <div className="px-10 pt-10 pb-6" style={{ backgroundColor: BRAND }}>
              <div className="flex items-start justify-between">
                <div>
                  <img
                    src="/logo-horizontal.png"
                    alt="MillionStay"
                    className="h-10 w-auto brightness-0 invert"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <p className="text-orange-100 text-xs mt-2 font-medium tracking-wide uppercase">
                    Melbourne Student Accommodation
                  </p>
                </div>
                <div className="text-right">
                  <div
                    className="inline-block px-4 py-1.5 rounded-full text-sm font-bold"
                    style={{
                      backgroundColor: isPaid ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.15)",
                      color: "#fff",
                    }}
                  >
                    {isPaid ? "RECEIPT" : "INVOICE"}
                  </div>
                  <p className="text-white font-mono text-lg font-bold mt-2">
                    {inv.invoice_ref ?? `INV-${inv.id}`}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Status banner (Paid) ── */}
            {isPaid && (
              <div
                className="mx-10 -mt-3 mb-0 flex items-center gap-2 rounded-lg px-4 py-2.5"
                style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0" }}
              >
                <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: "#16a34a" }}>
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-green-700">Payment Confirmed</span>
                {inv.paid_at && (
                  <span className="text-xs text-green-600 ml-auto">Paid on {fmt(inv.paid_at, "dd MMM yyyy 'at' h:mm a")}</span>
                )}
              </div>
            )}

            {/* ── Meta grid ── */}
            <div className="px-10 pt-8 pb-6 grid grid-cols-2 gap-6 border-b border-gray-100">
              {/* Tenant */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Billed To</p>
                <p className="font-semibold text-gray-900">{tenantName || "—"}</p>
                {tenantEmail && <p className="text-sm text-gray-500">{tenantEmail}</p>}
              </div>

              {/* From */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Issued By</p>
                <p className="font-semibold text-gray-900">MillionStay Pty Ltd</p>
                <p className="text-sm text-gray-500">info@millionstay.com.au</p>
                <p className="text-sm text-gray-500">Melbourne, VIC, Australia</p>
              </div>

              {/* Dates */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Issue Date</p>
                <p className="text-sm font-medium text-gray-800">{fmt(inv.created_at)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Due Date</p>
                <p className="text-sm font-medium text-gray-800">{fmt(inv.due_date)}</p>
              </div>

              {/* Booking ref */}
              {inv.booking_ref && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Booking Reference</p>
                  <p className="text-sm font-mono font-medium text-gray-800">{inv.booking_ref}</p>
                </div>
              )}

              {/* Rental period */}
              {inv.check_in_date && inv.check_out_date && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Rental Period</p>
                  <p className="text-sm font-medium text-gray-800">
                    {fmt(inv.check_in_date)} – {fmt(inv.check_out_date)}
                  </p>
                </div>
              )}
            </div>

            {/* ── Property ── */}
            {propertyFull && (
              <div className="px-10 py-5 border-b border-gray-100">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Property</p>
                <p className="text-sm font-medium text-gray-800">{propertyFull}</p>
              </div>
            )}

            {/* ── Line items ── */}
            <div className="px-10 py-6 border-b border-gray-100">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-gray-400 pb-3">Description</th>
                    <th className="text-right text-xs font-semibold uppercase tracking-wider text-gray-400 pb-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="py-4">
                    <td className="pt-4 pb-2 pr-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {inv.description ?? "Monthly Rent"}
                      </p>
                      {inv.notes && (
                        <p className="text-xs text-gray-400 mt-0.5">{inv.notes}</p>
                      )}
                    </td>
                    <td className="pt-4 pb-2 text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {fmtAmt(inv.amount, inv.currency ?? "AUD")}
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── Totals ── */}
            <div className="px-10 py-5 border-b border-gray-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-500">Subtotal</span>
                <span className="text-sm text-gray-700">{fmtAmt(inv.amount, inv.currency ?? "AUD")}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-500">GST (10%)</span>
                <span className="text-sm text-gray-700">Included</span>
              </div>
              <div
                className="flex justify-between items-center pt-3 mt-1 border-t border-gray-100"
              >
                <span className="font-bold text-gray-900">Total Amount</span>
                <span className="font-bold text-xl" style={{ color: BRAND }}>
                  {fmtAmt(inv.amount, inv.currency ?? "AUD")}
                </span>
              </div>
            </div>

            {/* ── Payment details (for paid invoices) ── */}
            {isPaid && (
              <div className="px-10 py-6 border-b border-gray-100">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Payment Details</p>
                <div className="rounded-xl border border-green-100 bg-green-50/50 px-5 py-4 grid grid-cols-2 gap-y-3 gap-x-8">
                  <div>
                    <p className="text-xs text-gray-400">Status</p>
                    <p className="text-sm font-semibold text-green-700">Paid in Full</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Payment Method</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {PAYMENT_METHOD_LABELS[inv.payment_method ?? ""] ?? inv.payment_method ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Date Received</p>
                    <p className="text-sm font-semibold text-gray-800">{fmt(inv.paid_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Amount Received</p>
                    <p className="text-sm font-semibold text-gray-800">{fmtAmt(inv.amount, inv.currency ?? "AUD")}</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Footer ── */}
            <div className="px-10 py-6">
              <div className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: "#fff7f3", border: `1px solid ${BRAND}20` }}>
                <div className="w-1 h-12 rounded-full shrink-0" style={{ backgroundColor: BRAND }} />
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-0.5">Bank Transfer Details</p>
                  <p className="text-xs text-gray-500">Bank: Commonwealth Bank &nbsp;|&nbsp; BSB: 063-000 &nbsp;|&nbsp; Acc: 1234 5678</p>
                  <p className="text-xs text-gray-500">Account Name: MillionStay Pty Ltd &nbsp;|&nbsp; Reference: {inv.invoice_ref ?? `INV-${inv.id}`}</p>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-700">MillionStay Pty Ltd</p>
                  <p className="text-xs text-gray-400">ABN: 12 345 678 901 &nbsp;|&nbsp; info@millionstay.com.au</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Thank you for choosing</p>
                  <p className="text-xs font-semibold" style={{ color: BRAND }}>MillionStay</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Print styles ─── */}
      <style>{`
        @media print {
          @page { margin: 0; size: A4; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}

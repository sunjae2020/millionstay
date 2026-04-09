import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuthStore } from "@/lib/store";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  CreditCard, Banknote, Upload, X, Lock, CheckCircle2,
  Home, Calendar, ChevronLeft, Sparkles, LayoutDashboard, Mail,
} from "lucide-react";
import { format } from "date-fns";

/* ─────────────────────────────────────────────────── */
/*  Bank details                                       */
/* ─────────────────────────────────────────────────── */
function BankDetails({ total, ref_ }: { total: number; ref_: string }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Banknote className="h-5 w-5 text-blue-600" />
        <p className="font-semibold text-blue-800">Bank Transfer Details</p>
      </div>
      <div className="space-y-2">
        {[
          ["Bank",          "Commonwealth Bank of Australia"],
          ["Account Name",  "MillionStay Pty Ltd"],
          ["BSB",           "063-000"],
          ["Account No.",   "1234 5678"],
          ["Amount",        `AUD $${total.toLocaleString()}`],
          ["Reference",     ref_],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between text-sm border-b border-blue-100 pb-2 last:border-0 last:pb-0">
            <span className="text-blue-600 font-medium">{label}</span>
            <span className="text-gray-800 font-mono font-semibold">{value}</span>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2 bg-white rounded-lg px-3 py-2.5 border border-blue-100">
        <Mail className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-gray-600">
          Please transfer within <strong>48 hours</strong> using the reference above.
          Include the reference number in your bank transfer description.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────── */
/*  Booking summary                                    */
/* ─────────────────────────────────────────────────── */
function BookingSummary({ booking }: { booking: Record<string, unknown> | null }) {
  if (!booking) return null;
  const fmt = (d: string | null) => { try { return d ? format(new Date(d), "dd/MM/yyyy") : "—"; } catch { return d ?? "—"; } };
  const invoices = (booking.invoices as Array<{amount: number; status: string}>) ?? [];
  const totalDue = invoices.reduce((sum, inv) => sum + (inv.status !== "Paid" ? inv.amount : 0), 0);

  return (
    <div className="bg-white rounded-2xl border p-5 space-y-4 sticky top-24">
      <h3 className="font-semibold text-gray-800">Booking Summary</h3>
      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex items-start gap-2"><Home className="h-4 w-4 text-primary mt-0.5 shrink-0" /><span>{booking.space_name as string ?? "—"}</span></div>
        <div className="flex items-start gap-2"><Calendar className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <span>{fmt(booking.check_in_date as string)} → {fmt(booking.check_out_date as string)}</span>
        </div>
      </div>
      <Separator />
      {invoices.length > 0 ? (
        <div className="space-y-1.5">
          {invoices.map((inv, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className={inv.status === "Paid" ? "text-green-600 line-through" : "text-gray-600"}>Invoice #{i + 1}</span>
              <span className={inv.status === "Paid" ? "text-green-600" : "font-bold"}>${inv.amount.toLocaleString()} {inv.status === "Paid" ? "✓" : ""}</span>
            </div>
          ))}
          <Separator />
          <div className="flex justify-between font-bold">
            <span>Due Now</span><span className="text-primary">${totalDue.toLocaleString()}</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400">Invoice is being prepared.</p>
      )}
      <div className="text-xs text-gray-400">
        Ref: <span className="font-mono font-medium text-gray-600">{booking.booking_ref as string}</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────── */
/*  Portal side menu                                   */
/* ─────────────────────────────────────────────────── */
function PortalSideMenu({ active }: { active: string }) {
  const [, setLocation] = useLocation();
  const { logout } = useAuthStore();
  const items = [
    { href: "/portal/bookings",  label: "My Bookings", icon: "📋" },
    { href: "/portal/invoices",  label: "My Invoices", icon: "🧾" },
    { href: "/portal/documents", label: "Documents",   icon: "📎" },
    { href: "/portal/profile",   label: "My Profile",  icon: "👤" },
  ];
  return (
    <aside className="w-full md:w-56 shrink-0">
      <nav className="bg-white rounded-2xl border overflow-hidden">
        {items.map((item) => (
          <button key={item.href} onClick={() => setLocation(item.href)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium border-b last:border-b-0 transition-colors ${
              active === item.href ? "bg-orange-50 text-primary border-l-2 border-l-primary" : "text-gray-600 hover:bg-gray-50 hover:text-primary"
            }`}>
            <span>{item.icon}</span>{item.label}
          </button>
        ))}
        <button onClick={() => { logout(); setLocation("/"); }}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
          <span>🚪</span>Log out
        </button>
      </nav>
    </aside>
  );
}

/* ─────────────────────────────────────────────────── */
/*  Document types                                     */
/* ─────────────────────────────────────────────────── */
const DOC_TYPES = [
  { type: "passport",   label: "Passport / Photo ID",         required: true,  hint: "Photo page of your passport or national ID card" },
  { type: "visa",       label: "Student Visa / CoE",          required: true,  hint: "Visa grant letter or Confirmation of Enrolment" },
  { type: "enrollment", label: "Enrolment Letter",            required: false, hint: "University or college enrolment confirmation" },
  { type: "bank",       label: "Bank Statement / Proof of Funds", required: false, hint: "Proof of sufficient funds for your stay" },
];

/* ─────────────────────────────────────────────────── */
/*  Main page                                          */
/* ─────────────────────────────────────────────────── */
export default function PortalPayment() {
  const [, setLocation] = useLocation();
  const { token, guest } = useAuthStore();
  const { toast } = useToast();

  const bookingId = new URLSearchParams(window.location.search).get("booking_id");

  useEffect(() => {
    if (!token) setLocation(`/login?redirect=/portal/payment${bookingId ? `?booking_id=${bookingId}` : ""}`);
  }, [token]);

  const [booking, setBooking] = useState<Record<string, unknown> | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(true);

  useEffect(() => {
    if (!token || !bookingId) { setLoadingBooking(false); return; }
    fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/v1/guest/bookings/${bookingId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j) => { setBooking(j.data); setLoadingBooking(false); })
      .catch(() => setLoadingBooking(false));
  }, [token, bookingId]);

  /* Payment state */
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bank">("card");
  const [cardName, setCardName]     = useState(guest?.name ?? "");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc]       = useState("");
  const [paying, setPaying]         = useState(false);
  const [paid, setPaid]             = useState(false);

  /* Document state */
  const [documents, setDocuments] = useState<{ type: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  const invoices = (booking?.invoices as Array<{amount: number; status: string}>) ?? [];
  const totalDue = invoices.reduce((sum, inv) => sum + (inv.status !== "Paid" ? inv.amount : 0), 0) || 1500;
  const bookingRef = (booking?.booking_ref as string) ?? "";
  const guestName  = guest?.name ?? "Guest";

  const handleFileUpload = (docType: string, file: File) => {
    setDocuments((prev) => [...prev.filter((d) => d.type !== docType), { type: docType, name: file.name }]);
    toast({ title: `${docType} document ready`, description: "Will be submitted with your payment." });
  };

  const handlePayment = async () => {
    if (paymentMethod === "card" && (!cardName || !cardNumber || !cardExpiry || !cardCvc)) {
      toast({ title: "Please complete all card fields", variant: "destructive" });
      return;
    }
    if (!bookingId) {
      toast({ title: "Booking not found", variant: "destructive" });
      return;
    }
    setPaying(true);
    try {
      const apiMethod = paymentMethod === "card" ? "card" : "bank_transfer";
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/v1/guest/payment/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          booking_id: parseInt(bookingId, 10),
          amount: totalDue,
          payment_method: apiMethod,
        }),
      });
      if (!res.ok) throw new Error("Payment confirmation failed");
      setPaid(true);
    } catch {
      toast({ title: "Payment failed", description: "Please check your details and try again.", variant: "destructive" });
    } finally {
      setPaying(false);
    }
  };

  if (!token) return null;

  /* ── Confirmed screen ── */
  if (paid) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-12 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}
            className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <Sparkles className="h-10 w-10 text-green-600" />
          </motion.div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {paymentMethod === "bank" ? "Bank Transfer Initiated!" : "Payment Complete!"}
          </h2>
          <p className="text-sm text-gray-500 mb-2">
            {paymentMethod === "bank"
              ? "Please complete your bank transfer within 48 hours. Your booking will be confirmed once payment is received."
              : "Your payment has been processed. Our team will review and confirm your booking shortly."}
          </p>
          {documents.length > 0 && (
            <p className="text-sm text-gray-500 mb-6">
              {documents.length} document{documents.length > 1 ? "s" : ""} submitted for verification.
            </p>
          )}
          {paymentMethod === "bank" && (
            <div className="mb-6 text-left">
              <BankDetails total={totalDue} ref_={bookingRef || `${guestName} ${booking?.check_in_date ?? ""}`} />
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => setLocation("/portal/bookings")}
              className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl">
              <LayoutDashboard className="h-4 w-4 mr-2" /> View My Bookings
            </Button>
            <Button variant="outline" onClick={() => setLocation("/")} className="rounded-xl">Back to Home</Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <div className="bg-gradient-to-r from-[#c05010] via-[#e07828] to-[#c86820] py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <button onClick={() => setLocation("/portal/bookings")}
            className="flex items-center gap-1 text-white/70 hover:text-white text-sm mb-2 transition-colors">
            <ChevronLeft className="h-4 w-4" /> My Bookings
          </button>
          <p className="text-white/70 text-sm italic mb-1">Your account</p>
          <h1 className="text-2xl font-bold text-white tracking-wide">Payment & Documents</h1>
        </div>
      </div>

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <div className="flex flex-col md:flex-row gap-6">
          <PortalSideMenu active="/portal/payment" />

          <div className="flex-1 space-y-6">

            {/* Booking not found */}
            {!loadingBooking && !booking && (
              <div className="bg-white rounded-2xl border p-8 text-center">
                <p className="text-gray-500 mb-4">Booking not found or you don't have access to it.</p>
                <Button onClick={() => setLocation("/portal/bookings")} variant="outline" className="rounded-xl">
                  View My Bookings
                </Button>
              </div>
            )}

            {(loadingBooking || booking) && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">

                  {/* ── Payment Section ── */}
                  <div className="bg-white rounded-2xl border p-6 space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shrink-0">1</div>
                      <h2 className="font-semibold text-lg text-gray-800">Payment</h2>
                    </div>

                    {loadingBooking ? (
                      <div className="h-12 bg-gray-100 animate-pulse rounded-xl" />
                    ) : (
                      <div className="bg-orange-50 border border-orange-100 rounded-xl px-5 py-3 flex justify-between items-center">
                        <span className="text-sm text-gray-600">Amount Due</span>
                        <span className="font-black text-xl text-primary">${totalDue.toLocaleString()}</span>
                      </div>
                    )}

                    {/* Payment method toggle */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Payment Method</p>
                      <div className="flex rounded-xl overflow-hidden border border-gray-200">
                        {([
                          ["card", CreditCard, "Credit / Debit Card"],
                          ["bank", Banknote,   "Bank Transfer"],
                        ] as const).map(([m, Icon, label]) => (
                          <button key={m} onClick={() => setPaymentMethod(m as "card" | "bank")}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
                              paymentMethod === m ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-50"
                            }`}>
                            <Icon className="h-4 w-4" />{label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {paymentMethod === "card" ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Name on Card</label>
                          <Input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Jane Smith" className="mt-1 h-11" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Card Number</label>
                          <Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 16))}
                            placeholder="1234 5678 9012 3456" className="mt-1 h-11 font-mono" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Expiry</label>
                            <Input value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} placeholder="MM/YY" className="mt-1 h-11 font-mono" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">CVC</label>
                            <Input value={cardCvc} onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" className="mt-1 h-11 font-mono" />
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 flex items-center gap-1.5">
                          <Lock className="h-3 w-3" />Card details are encrypted and secure.
                        </p>
                      </div>
                    ) : (
                      <BankDetails total={totalDue} ref_={bookingRef || `${guestName} ${booking?.check_in_date ?? ""}`} />
                    )}
                  </div>

                  {/* ── Document Upload Section ── */}
                  <div className="bg-white rounded-2xl border p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shrink-0">2</div>
                      <div>
                        <h2 className="font-semibold text-lg text-gray-800">Upload Documents</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Required to verify your identity before check-in</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {DOC_TYPES.map(({ type, label, required, hint }) => {
                        const uploaded = documents.find((d) => d.type === type);
                        return (
                          <div key={type} className={`rounded-xl border-2 p-4 transition-all ${
                            uploaded ? "border-green-200 bg-green-50" : required ? "border-gray-200 bg-white" : "border-dashed border-gray-200 bg-white"
                          }`}>
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-medium text-sm text-gray-800">
                                  {label}{required && <span className="text-red-400 ml-0.5">*</span>}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
                              </div>
                              {uploaded && (
                                <button onClick={() => setDocuments((prev) => prev.filter((d) => d.type !== type))}>
                                  <X className="h-4 w-4 text-gray-400 hover:text-red-500" />
                                </button>
                              )}
                            </div>
                            {uploaded ? (
                              <div className="flex items-center gap-2 text-sm text-green-700">
                                <CheckCircle2 className="h-4 w-4" /><span>{uploaded.name}</span>
                              </div>
                            ) : (
                              <label className="flex flex-col items-center justify-center gap-1.5 py-3 cursor-pointer hover:bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                <Upload className="h-5 w-5 text-gray-400" />
                                <span className="text-sm text-gray-500">Drop file or <span className="text-primary font-medium">click to upload</span></span>
                                <span className="text-xs text-gray-400">JPG, PNG, PDF — max 10MB</span>
                                <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden"
                                  onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(type, e.target.files[0]); }} />
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-xs text-gray-400 flex items-center gap-1.5">
                      <Lock className="h-3 w-3 shrink-0" />
                      All documents are encrypted and only accessible to MillionStay management.
                    </p>

                    {documents.length === 0 && (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        You can still submit without documents, but your booking may be delayed until they are received.
                      </p>
                    )}
                  </div>

                  {/* ── Submit Button ── */}
                  <Button onClick={handlePayment} disabled={paying || loadingBooking}
                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-14 rounded-xl text-base">
                    {paying ? "Processing…" :
                      paymentMethod === "card"
                        ? `Pay $${totalDue.toLocaleString()} & Submit Documents`
                        : "Confirm Bank Transfer & Submit Documents"}
                    {paymentMethod === "card"
                      ? <CreditCard className="h-5 w-5 ml-2" />
                      : <Banknote className="h-5 w-5 ml-2" />}
                  </Button>

                  <p className="text-xs text-gray-400 text-center">
                    By submitting, you agree to our{" "}
                    <Link href="/house-rules" className="text-primary underline">House Rules</Link> and{" "}
                    <Link href="/privacy-policy" className="text-primary underline">Privacy Policy</Link>.
                  </p>
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-1">
                  {loadingBooking ? (
                    <div className="bg-white rounded-2xl border p-5 space-y-3">
                      {[60, 40, 80, 40].map((w, i) => (
                        <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" style={{ width: `${w}%` }} />
                      ))}
                    </div>
                  ) : (
                    <BookingSummary booking={booking} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

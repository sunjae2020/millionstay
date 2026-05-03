import React, { useEffect } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useAuthStore } from "@/lib/store";
import { PortalLayout } from "@/components/portal-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import {
  MapPin, Home, Calendar, Users, FileText, FileImage,
  CheckCircle2, Clock, AlertCircle, ChevronLeft,
  CreditCard, Receipt, ScrollText, Wrench, CalendarDays,
} from "lucide-react";
import { format } from "date-fns";
import { getApiBase } from "@/lib/api-base";

type BookingInvoice = {
  id: number;
  invoice_ref: string | null;
  amount: number;
  currency: string;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  description: string | null;
};

type BookingContract = {
  id: number;
  contract_ref: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  weekly_rate: number | null;
  total_rent: number | null;
  bond_amount: number | null;
  advance_amount: number | null;
  currency: string;
  document_url: string | null;
  terms_text: string | null;
  signed_at: string | null;
  effective_date: string | null;
};

type PaymentSchedule = {
  id: number;
  schedule_type: string;
  amount: string;
  currency: string;
  next_due_date: string;
  start_date: string;
  end_date: string | null;
  frequency: string;
  is_active: boolean;
};

type BookingService = {
  id: number;
  service_name: string;
  service_type: string | null;
  quantity: number | null;
  unit_price: string | null;
  total_price: string | null;
  billing_trigger: string | null;
  frequency: string | null;
  notes: string | null;
};

const CONTRACT_STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600",
  Sent: "bg-blue-100 text-blue-700",
  Signed: "bg-purple-100 text-purple-700",
  Active: "bg-green-100 text-green-700",
  Terminated: "bg-red-100 text-red-700",
  Expired: "bg-orange-100 text-orange-700",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy"); } catch { return d; }
}

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  PendingPayment: "bg-yellow-100 text-yellow-700",
  PendingApproval: "bg-amber-100 text-amber-700",
  Confirmed: "bg-blue-100 text-blue-700",
  Active: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-700",
  Completed: "bg-blue-100 text-blue-700",
};

const DOC_STATUS: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
  Pending: { color: "text-amber-600 bg-amber-50 border-amber-100", icon: Clock },
  Approved: { color: "text-green-700 bg-green-50 border-green-100", icon: CheckCircle2 },
  Rejected: { color: "text-red-600 bg-red-50 border-red-100", icon: AlertCircle },
};

export default function PortalBookingDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { token } = useAuthStore();

  useEffect(() => {
    if (!token) setLocation(`/login?redirect=/portal/bookings/${id}`);
  }, [token, setLocation, id]);

  const [bookingData, setBookingData] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!token || !id) return;
    fetch(`${getApiBase()}/api/v1/guest/bookings/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j) => { setBookingData(j.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token, id]);

  if (!token) return null;

  const b = bookingData;

  const invoices = (b?.invoices ?? []) as BookingInvoice[];
  const contract = b?.contract as BookingContract | null ?? null;
  const paymentSchedule = (b?.payment_schedule ?? []) as PaymentSchedule[];
  const services = (b?.services ?? []) as BookingService[];
  const firstPaidInvoice = invoices.find((inv) => inv.status === "Paid");

  const TIMELINE_EVENTS = b ? [
    { label: "Booking created", date: b.created_at as string, done: true },
    { label: "Payment received", date: firstPaidInvoice?.paid_at ?? null, done: !!firstPaidInvoice },
    { label: "Booking confirmed", date: null, done: b.contract_status === "Confirmed" || b.contract_status === "Active" },
    { label: "Check-in", date: b.check_in_date as string, done: false },
    { label: "Check-out", date: b.check_out_date as string, done: false },
  ] : [];

  return (
    <PortalLayout active="/portal/bookings">
      <div className="bg-gray-50 flex-1 flex flex-col">

      <div className="bg-gradient-to-r from-[#c05010] via-[#e07828] to-[#c86820] py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Link href="/portal/bookings">
            <button className="flex items-center gap-1 text-white/70 hover:text-white text-sm mb-2 transition-colors">
              <ChevronLeft className="h-4 w-4" /> Back to bookings
            </button>
          </Link>
          <p className="font-cursive text-white/80 text-sm italic mb-1">Your account</p>
          <h1 className="text-2xl font-bold uppercase text-white tracking-wide">
            {b ? (b.space_name as string) : "Booking Details"}
          </h1>
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : !b ? (
          <div className="text-center py-16 text-gray-400">
            <p>Booking not found</p>
            <Link href="/portal/bookings"><p className="text-primary mt-2 hover:underline">Return to bookings</p></Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status card */}
            <div className="bg-white rounded-2xl border p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold ${STATUS_COLORS[b.contract_status as string] ?? "bg-gray-100 text-gray-700"}`}>
                    {b.contract_status as string}
                  </span>
                </div>
                <p className="text-sm text-gray-500">Ref: <span className="font-mono font-semibold text-gray-700">{b.booking_ref as string}</span></p>
              </div>
              <div className="flex gap-3">
                {firstPaidInvoice ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-primary/30 text-primary hover:bg-orange-50"
                    onClick={() => setLocation(`/portal/invoices/${firstPaidInvoice.id}/receipt`)}
                  >
                    <Receipt className="h-4 w-4" /> Receipt
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setLocation("/portal/invoices")}
                  >
                    <FileText className="h-4 w-4" /> Invoices
                  </Button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview">
              <TabsList className="bg-white border mb-4 flex-wrap h-auto">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                {contract && <TabsTrigger value="contract" className="gap-1.5"><ScrollText className="h-3.5 w-3.5" />Contract</TabsTrigger>}
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="invoice">Invoices</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              {/* OVERVIEW */}
              <TabsContent value="overview">
                <div className="bg-white rounded-2xl border p-6 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    {[
                      { icon: Home, label: "Room", value: b.space_name as string },
                      { icon: MapPin, label: "Address", value: b.property_address as string },
                      { icon: Calendar, label: "Check-in", value: formatDate(b.check_in_date as string) },
                      { icon: Calendar, label: "Check-out", value: formatDate(b.check_out_date as string) },
                      { icon: Users, label: "Guests", value: String(b.num_guests) },
                      { icon: CreditCard, label: "Total Amount", value: b.total_rent ? `$${Number(b.total_rent).toLocaleString()} AUD` : "—" },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-start gap-3">
                        <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500">{label}</p>
                          <p className="font-medium text-gray-800">{value ?? "—"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {b.special_requests && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Special Requests</p>
                        <p className="text-sm text-gray-700">{b.special_requests as string}</p>
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>

              {/* CONTRACT — read-only */}
              <TabsContent value="contract">
                {!contract ? (
                  <div className="bg-white rounded-2xl border text-center py-12 text-gray-400">
                    <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No contract available for this booking yet.</p>
                    <p className="text-xs mt-1">Your contract will appear here once your booking is confirmed.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Contract summary card */}
                    <div className="bg-white rounded-2xl border p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                          <ScrollText className="h-4 w-4 text-primary" /> Contract Details
                        </h3>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${CONTRACT_STATUS_COLORS[contract.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {contract.status}
                        </span>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4 text-sm">
                        {[
                          { label: "Contract Ref", value: contract.contract_ref },
                          { label: "Status", value: contract.status },
                          { label: "Start Date", value: formatDate(contract.start_date) },
                          { label: "End Date", value: formatDate(contract.end_date) },
                          { label: "Weekly Rate", value: contract.weekly_rate ? `$${Number(contract.weekly_rate).toLocaleString()} ${contract.currency}` : "—" },
                          { label: "Total Rent", value: contract.total_rent ? `$${Number(contract.total_rent).toLocaleString()} ${contract.currency}` : "—" },
                          { label: "Bond", value: contract.bond_amount ? `$${Number(contract.bond_amount).toLocaleString()} ${contract.currency}` : "—" },
                          { label: "Advance", value: contract.advance_amount ? `$${Number(contract.advance_amount).toLocaleString()} ${contract.currency}` : "—" },
                          { label: "Signed Date", value: contract.signed_at ? formatDate(contract.signed_at) : "Pending" },
                          { label: "Effective Date", value: formatDate(contract.effective_date) },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <p className="text-xs text-gray-500">{label}</p>
                            <p className="font-medium text-gray-800">{value ?? "—"}</p>
                          </div>
                        ))}
                      </div>
                      {contract.document_url && (
                        <div className="pt-2">
                          <a href={contract.document_url} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-primary text-sm font-medium hover:underline">
                            <FileText className="h-4 w-4" /> View Signed Document
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Payment schedule */}
                    {paymentSchedule.length > 0 && (
                      <div className="bg-white rounded-2xl border overflow-hidden">
                        <div className="px-6 py-4 border-b flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-primary" />
                          <h3 className="font-semibold text-gray-900">Payment Schedule</h3>
                          <span className="text-xs text-gray-400 ml-auto">{paymentSchedule.length} schedule(s)</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                              <tr>
                                {["Type", "Amount", "Frequency", "Start Date", "End Date", "Next Due"].map((h) => (
                                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {paymentSchedule.map((s) => (
                                <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                                  <td className="px-4 py-3 font-medium text-gray-800">{s.schedule_type}</td>
                                  <td className="px-4 py-3 font-mono text-gray-900">${Number(s.amount).toFixed(2)} {s.currency}</td>
                                  <td className="px-4 py-3 text-gray-500 capitalize">{s.frequency}</td>
                                  <td className="px-4 py-3 text-gray-500">{formatDate(s.start_date)}</td>
                                  <td className="px-4 py-3 text-gray-500">{s.end_date ? formatDate(s.end_date) : "—"}</td>
                                  <td className="px-4 py-3">
                                    <span className="font-medium text-primary">{formatDate(s.next_due_date)}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Services */}
                    {services.length > 0 && (
                      <div className="bg-white rounded-2xl border overflow-hidden">
                        <div className="px-6 py-4 border-b flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-primary" />
                          <h3 className="font-semibold text-gray-900">Included Services</h3>
                          <span className="text-xs text-gray-400 ml-auto">{services.length} service(s)</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                              <tr>
                                {["Service", "Type", "Qty", "Unit Price", "Total", "Billing"].map((h) => (
                                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {services.map((s) => (
                                <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                                  <td className="px-4 py-3 font-medium text-gray-800">{s.service_name}</td>
                                  <td className="px-4 py-3 text-gray-500 capitalize">{s.service_type ?? "—"}</td>
                                  <td className="px-4 py-3 text-gray-500">{s.quantity ?? 1}</td>
                                  <td className="px-4 py-3 text-gray-500">{s.unit_price ? `$${Number(s.unit_price).toFixed(2)}` : "—"}</td>
                                  <td className="px-4 py-3 font-medium text-gray-800">{s.total_price ? `$${Number(s.total_price).toFixed(2)}` : "—"}</td>
                                  <td className="px-4 py-3 text-gray-500 capitalize">{s.billing_trigger ?? s.frequency ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Terms Text */}
                    {contract.terms_text && (
                      <div className="bg-white rounded-2xl border overflow-hidden">
                        <div className="px-6 py-4 border-b flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <h3 className="font-semibold text-gray-900">Contract Terms</h3>
                          <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Read Only</span>
                        </div>
                        <div className="p-6">
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans max-h-96 overflow-y-auto bg-gray-50 rounded-xl p-4 border">
                            {contract.terms_text}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* DOCUMENTS */}
              <TabsContent value="documents">
                <div className="space-y-3">
                  {((b.documents as Array<{id: number; document_type: string; status: string; uploaded_at: string | null}>) ?? []).length === 0 ? (
                    <div className="bg-white rounded-2xl border text-center py-12 text-gray-400">
                      <FileImage className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No documents uploaded for this booking</p>
                      <Link href="/portal/documents">
                        <Button variant="outline" size="sm" className="mt-3 gap-1.5">
                          <FileImage className="h-3.5 w-3.5" /> Upload documents
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    (b.documents as Array<{id: number; document_type: string; status: string; uploaded_at: string | null}>).map((doc) => {
                      const info = DOC_STATUS[doc.status] ?? DOC_STATUS["Pending"]!;
                      const Icon = info.icon;
                      return (
                        <div key={doc.id} className={`bg-white rounded-xl border p-4 flex items-center justify-between ${doc.status === "Rejected" ? "border-red-200" : ""}`}>
                          <div className="flex items-center gap-3">
                            <FileImage className="h-5 w-5 text-primary" />
                            <div>
                              <p className="text-sm font-medium text-gray-800 capitalize">{doc.document_type.replace("_", " ")}</p>
                              {doc.uploaded_at && <p className="text-xs text-gray-400">Uploaded {formatDate(doc.uploaded_at)}</p>}
                            </div>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${info.color}`}>
                            <Icon className="h-3 w-3" />
                            {doc.status}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </TabsContent>

              {/* INVOICES */}
              <TabsContent value="invoice">
                <div className="space-y-3">
                  {invoices.length === 0 ? (
                    <div className="bg-white rounded-2xl border text-center py-12 text-gray-400">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No invoices yet</p>
                    </div>
                  ) : (
                    invoices.map((inv) => (
                      <div key={inv.id} className="bg-white rounded-xl border p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-800">{inv.invoice_ref ?? `INV-${inv.id}`}</p>
                          <p className="text-xs text-gray-500 truncate">{inv.description ?? `Due ${formatDate(inv.due_date)}`}</p>
                          {inv.paid_at && <p className="text-xs text-green-600 mt-0.5">Paid {formatDate(inv.paid_at)}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            inv.status === "Paid" ? "bg-green-100 text-green-700" :
                            inv.status === "Overdue" ? "bg-red-100 text-red-700" :
                            "bg-amber-100 text-amber-700"
                          }`}>{inv.status}</span>
                          <p className="font-bold text-gray-900 text-sm">${Number(inv.amount).toLocaleString()}</p>
                          {inv.status === "Paid" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-orange-50"
                              onClick={() => setLocation(`/portal/invoices/${inv.id}/receipt`)}
                            >
                              <Receipt className="h-3 w-3" /> Receipt
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => setLocation("/portal/invoices")}
                            >
                              <FileText className="h-3 w-3" /> View
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* TIMELINE */}
              <TabsContent value="timeline">
                <div className="bg-white rounded-2xl border p-6">
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-100" />
                    <div className="space-y-6">
                      {TIMELINE_EVENTS.map(({ label, date, done }, i) => (
                        <div key={i} className="flex items-start gap-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${done ? "bg-primary" : "bg-gray-100 border-2 border-gray-200"}`}>
                            {done ? <CheckCircle2 className="h-4 w-4 text-white" /> : <div className="w-2 h-2 rounded-full bg-gray-300" />}
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${done ? "text-gray-900" : "text-gray-400"}`}>{label}</p>
                            {date && <p className="text-xs text-gray-400 mt-0.5">{formatDate(date)}</p>}
                            {!date && !done && <p className="text-xs text-gray-300 mt-0.5">Upcoming</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      </div>
    </PortalLayout>
  );
}

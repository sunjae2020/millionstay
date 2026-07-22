import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import AdminLayout from "@/components/admin-layout";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";
import { ChevronLeft, CheckCircle, XCircle, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

import { getApiBase } from "@/lib/api-base";
const API = getApiBase();
const ADMIN_KEY = "ms_admin_key";
function getKey() { return localStorage.getItem(ADMIN_KEY) ?? ""; }

type Doc = { id: number; documentType: string; fileUrl: string | null; status: string; uploadedAt: string | null };
type Invoice = { id: number; invoiceNumber: string | null; amount: string; status: string; dueDate: string | null };
type BookingDetail = {
  id: number; bookingRef: string; checkInDate: string | null; checkOutDate: string | null;
  numGuests: number; specialRequests: string | null; contractStatus: string; totalAmount: string | null;
  createdAt: string;
  guestFirstName: string; guestLastName: string; guestEmail: string;
  guestPhone: string | null; guestNationality: string | null;
  spaceName: string; spaceId: number;
  invoices: Invoice[]; documents: Doc[];
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy"); } catch { return d; }
}

const BOOKING_STATUSES = ["Draft", "PendingPayment", "Confirmed", "Active", "Cancelled", "Completed"];
const DOC_STATUSES = ["Pending", "Approved", "Rejected"];

export default function AdminBookingDetail({ params }: { params: { id: string } }) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);

  const load = () => {
    const key = getKey();
    if (!key) { setLocation("/admin"); return; }
    fetch(`${API}/api/v1/admin/bookings/${params.id}`, { headers: { "x-admin-api-key": key } })
      .then((r) => r.json())
      .then((d) => { if (d.success) setBooking(d.data); })
      .catch(() => setLocation("/admin/bookings"));
  };

  useEffect(load, [params.id]);

  const updateBookingStatus = async (status: string) => {
    if (!booking) return;
    setUpdating(true);
    try {
      const res = await fetch(`${API}/api/v1/admin/bookings/${booking.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-api-key": getKey() },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast({ title: `Status updated to ${status}` });
      load();
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const updateDocStatus = async (docId: number, status: string) => {
    try {
      const res = await fetch(`${API}/api/v1/admin/documents/${docId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-api-key": getKey() },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast({ title: `Document ${status}` });
      load();
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  if (!booking) {
    return (
      <AdminLayout>
        <div className="p-8 flex items-center justify-center min-h-96">
          <div className="animate-pulse text-gray-400">Loading…</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-8 max-w-5xl">
        <Link href="/admin/bookings">
          <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
            <ChevronLeft className="h-4 w-4" /> Back to Bookings
          </button>
        </Link>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-mono">{booking.bookingRef}</h1>
            <p className="text-gray-500 text-sm mt-1">Created {fmtDate(booking.createdAt)}</p>
          </div>
          <StatusBadge status={booking.contractStatus} size="md" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-2xl border p-6">
              <h2 className="font-semibold text-gray-800 mb-4">Booking Details</h2>
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                {[
                  ["Space", booking.spaceName],
                  ["Check In", fmtDate(booking.checkInDate)],
                  ["Check Out", fmtDate(booking.checkOutDate)],
                  ["Guests", String(booking.numGuests)],
                  ["Total Amount", booking.totalAmount ? `$${Number(booking.totalAmount).toLocaleString()}` : "—"],
                  ...(booking.specialRequests ? [["Special Requests", booking.specialRequests]] : []),
                ].map(([label, value]) => (
                  <div key={label} className="contents">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-gray-800 font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border p-6">
              <h2 className="font-semibold text-gray-800 mb-4">Guest Information</h2>
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                {[
                  ["Name", `${booking.guestFirstName} ${booking.guestLastName}`],
                  ["Email", booking.guestEmail],
                  ...(booking.guestPhone ? [["Phone", booking.guestPhone]] : []),
                  ...(booking.guestNationality ? [["Nationality", booking.guestNationality]] : []),
                ].map(([label, value]) => (
                  <div key={label} className="contents">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-gray-800 font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {booking.documents.length > 0 && (
              <div className="bg-white rounded-2xl border p-6">
                <h2 className="font-semibold text-gray-800 mb-4">Documents</h2>
                <div className="space-y-3">
                  {booking.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between border rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-800">{doc.documentType.replace(/_/g, " ")}</p>
                          <p className="text-xs text-gray-400">{doc.uploadedAt ? fmtDate(doc.uploadedAt) : "Not uploaded"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={doc.status} />
                        {doc.fileUrl && (
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        {doc.status === "Pending" && doc.fileUrl && (
                          <>
                            <button onClick={() => updateDocStatus(doc.id, "Approved")}
                              className="text-green-600 hover:text-green-700" title="Approve">
                              <CheckCircle className="h-5 w-5" />
                            </button>
                            <button onClick={() => updateDocStatus(doc.id, "Rejected")}
                              className="text-red-500 hover:text-red-600" title="Reject">
                              <XCircle className="h-5 w-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {booking.invoices.length > 0 && (
              <div className="bg-white rounded-2xl border p-6">
                <h2 className="font-semibold text-gray-800 mb-4">Invoices</h2>
                <div className="space-y-2">
                  {booking.invoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between text-sm border rounded-xl px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-800">{inv.invoiceNumber ?? `INV-${inv.id}`}</p>
                        <p className="text-gray-400 text-xs">Due: {fmtDate(inv.dueDate)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-gray-800">${Number(inv.amount).toLocaleString()}</span>
                        <StatusBadge status={inv.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-2xl border p-5">
              <h2 className="font-semibold text-gray-800 mb-4 text-sm uppercase tracking-wide">Update Status</h2>
              <div className="space-y-2">
                {BOOKING_STATUSES.map((s) => (
                  <Button
                    key={s}
                    variant={booking.contractStatus === s ? "default" : "outline"}
                    disabled={updating || booking.contractStatus === s}
                    onClick={() => updateBookingStatus(s)}
                    className={`w-full h-9 text-sm justify-start ${
                      booking.contractStatus === s
                        ? "bg-primary text-white hover:bg-primary/90"
                        : "text-gray-600 hover:border-primary hover:text-primary"
                    }`}
                  >
                    {booking.contractStatus === s && <span className="mr-2">✓</span>}
                    {s}
                  </Button>
                ))}
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-sm text-primary">
              <p className="font-semibold mb-1">Quick Guide</p>
              <ul className="space-y-1 text-xs text-primary">
                <li><strong>Draft</strong> — Initial booking</li>
                <li><strong>PendingPayment</strong> — Awaiting payment & docs</li>
                <li><strong>Confirmed</strong> — Docs verified, ready</li>
                <li><strong>Active</strong> — Guest is checked in</li>
                <li><strong>Completed</strong> — Stay finished</li>
                <li><strong>Cancelled</strong> — Booking cancelled</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

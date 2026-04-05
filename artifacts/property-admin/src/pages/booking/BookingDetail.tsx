import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useForm, Controller } from "react-hook-form";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  useGetBooking, useCreateBooking, useUpdateBooking,
  useSubmitBooking, useConfirmBooking, useRejectBooking,
  useCheckInBooking, useCheckOutBooking, useCancelBooking, useExtendBooking,
  useListBookingDocuments, useCreateBookingDocument, useVerifyBookingDocument, useRejectBookingDocument,
  getListBookingsQueryKey, getGetBookingQueryKey, getListBookingDocumentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, FileText, CheckCircle2, XCircle, Upload } from "lucide-react";
import { LookupSelect } from "@/components/LookupSelect";

const BASE = import.meta.env.BASE_URL;

const BOOKING_STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  PendingPayment: "bg-yellow-100 text-yellow-700",
  PendingApproval: "bg-amber-100 text-amber-800",
  Confirmed: "bg-blue-100 text-blue-700",
  Active: "bg-green-100 text-green-700",
  CheckedOut: "bg-indigo-100 text-indigo-700",
  Cancelled: "bg-red-100 text-red-700",
  NoShow: "bg-pink-100 text-pink-700",
};

const DOC_STATUS_COLORS: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-700",
  Verified: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
};

interface FormData {
  account_id: number | null;
  contact_id: number | null;
  booking_source: string;
  customer_notes: string;
  space_id: number | null;
  check_in_date: string;
  check_out_date: string;
  agreed_weekly_rate: string;
  currency: string;
  num_guests: number;
  contract_product_id: number | null;
  status: string;
}

function calcStay(checkIn: string, checkOut: string, rate: string) {
  if (!checkIn || !checkOut) return null;
  const cin = new Date(checkIn);
  const cout = new Date(checkOut);
  const nights = Math.round((cout.getTime() - cin.getTime()) / (1000 * 60 * 60 * 24));
  const weeks = parseFloat((nights / 7).toFixed(2));
  const total = rate ? parseFloat((weeks * parseFloat(rate)).toFixed(2)) : 0;
  return { nights, weeks, total };
}

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("details");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [rejectDocId, setRejectDocId] = useState<number | null>(null);
  const [uploadDocOpen, setUploadDocOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [extendDate, setExtendDate] = useState("");
  const [docType, setDocType] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [docExpiry, setDocExpiry] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const { data: booking, refetch } = useGetBooking(Number(id), { query: { enabled: !isNew } });
  const { data: documents } = useListBookingDocuments(Number(id), {
    query: { enabled: !isNew, queryKey: getListBookingDocumentsQueryKey(Number(id)) },
  });

  const { register, handleSubmit, reset, control, watch } = useForm<FormData>({
    defaultValues: {
      account_id: null, contact_id: null, booking_source: "", customer_notes: "",
      space_id: null, check_in_date: "", check_out_date: "", agreed_weekly_rate: "",
      currency: "AUD", num_guests: 1, contract_product_id: null, status: "Active",
    },
  });

  useEffect(() => {
    if (booking) {
      reset({
        account_id: booking.account_id ?? null,
        contact_id: booking.contact_id ?? null,
        booking_source: booking.booking_source ?? "",
        customer_notes: booking.customer_notes ?? "",
        space_id: booking.space_id ?? null,
        check_in_date: booking.check_in_date ?? "",
        check_out_date: booking.check_out_date ?? "",
        agreed_weekly_rate: booking.agreed_weekly_rate ?? "",
        currency: booking.currency ?? "AUD",
        num_guests: booking.num_guests ?? 1,
        contract_product_id: booking.contract_product_id ?? null,
        status: booking.status ?? "Active",
      });
    }
  }, [booking, reset]);

  const createMutation = useCreateBooking({
    mutation: { onSuccess: (data) => { qc.invalidateQueries({ queryKey: getListBookingsQueryKey({}) }); setLocation(`/booking/bookings/${data.id}`); } },
  });
  const updateMutation = useUpdateBooking({
    mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListBookingsQueryKey({}) }); refetch(); } },
  });

  const submitMutation = useSubmitBooking({ mutation: { onSuccess: () => refetch() } });
  const confirmMutation = useConfirmBooking({ mutation: { onSuccess: () => refetch() } });
  const rejectMutation = useRejectBooking({ mutation: { onSuccess: () => { refetch(); setCancelDialogOpen(false); } } });
  const checkInMutation = useCheckInBooking({ mutation: { onSuccess: () => refetch() } });
  const checkOutMutation = useCheckOutBooking({ mutation: { onSuccess: () => refetch() } });
  const cancelMutation = useCancelBooking({ mutation: { onSuccess: () => { refetch(); setCancelDialogOpen(false); } } });
  const extendMutation = useExtendBooking({ mutation: { onSuccess: () => { refetch(); setExtendDialogOpen(false); } } });
  const verifyDocMutation = useVerifyBookingDocument({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListBookingDocumentsQueryKey(Number(id)) }) } });
  const rejectDocMutation = useRejectBookingDocument({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListBookingDocumentsQueryKey(Number(id)) }); setRejectDocId(null); } } });
  const createDocMutation = useCreateBookingDocument({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListBookingDocumentsQueryKey(Number(id)) }); setUploadDocOpen(false); setDocType(""); setDocUrl(""); setDocExpiry(""); } } });

  const onSubmit = (data: FormData) => {
    const payload = { ...data, num_guests: Number(data.num_guests) };
    if (isNew) createMutation.mutate({ data: payload });
    else updateMutation.mutate({ id: Number(id), data: payload });
  };

  const watchCheckIn = watch("check_in_date");
  const watchCheckOut = watch("check_out_date");
  const watchRate = watch("agreed_weekly_rate");
  const stay = calcStay(watchCheckIn, watchCheckOut, watchRate);

  const status = booking?.booking_status ?? "Draft";
  const isReadOnly = ["CheckedOut", "Cancelled"].includes(status);

  function FSMActionBar() {
    return (
      <div className={`rounded-lg border-2 p-4 flex items-center justify-between ${status === "Draft" ? "border-gray-200 bg-gray-50" : status === "PendingPayment" ? "border-yellow-300 bg-yellow-50" : status === "PendingApproval" ? "border-amber-300 bg-amber-50" : status === "Confirmed" ? "border-blue-300 bg-blue-50" : status === "Active" ? "border-green-300 bg-green-50" : status === "CheckedOut" ? "border-indigo-200 bg-indigo-50" : "border-red-200 bg-red-50"}`}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Status:</span>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${BOOKING_STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"}`}>{status}</span>
          {status === "Cancelled" && booking?.cancellation_reason && (
            <span className="text-sm text-red-600 ml-2">Reason: {booking.cancellation_reason}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status === "Draft" && (
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => submitMutation.mutate({ id: Number(id) })}>
              Submit Request →
            </Button>
          )}
          {status === "PendingPayment" && (
            <>
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => confirmMutation.mutate({ id: Number(id) })}>
                Process Payment →
              </Button>
              <Button variant="outline" className="text-red-600 border-red-300" onClick={() => setCancelDialogOpen(true)}>Cancel ✕</Button>
            </>
          )}
          {status === "PendingApproval" && (
            <>
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => confirmMutation.mutate({ id: Number(id) })}>
                ✓ Confirm
              </Button>
              <Button variant="outline" className="text-red-600 border-red-300" onClick={() => { setCancelDialogOpen(true); }}>✕ Reject</Button>
            </>
          )}
          {status === "Confirmed" && (
            <>
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => checkInMutation.mutate({ id: Number(id) })}>✓ Check In</Button>
              <Button variant="outline" onClick={() => setExtendDialogOpen(true)}>Extend Stay</Button>
              <Button variant="outline" className="text-red-600 border-red-300" onClick={() => setCancelDialogOpen(true)}>Cancel ✕</Button>
            </>
          )}
          {status === "Active" && (
            <>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => checkOutMutation.mutate({ id: Number(id) })}>✓ Check Out</Button>
              <Button variant="outline" onClick={() => setExtendDialogOpen(true)}>Extend Stay</Button>
            </>
          )}
          {status === "CheckedOut" && (
            <span className="text-indigo-600 font-medium text-sm">✓ Completed</span>
          )}
          {status === "Cancelled" && (
            <span className="text-red-600 font-medium text-sm">Cancelled</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <PageHeader
        title={isNew ? "New Booking" : (booking?.booking_ref ?? "Booking")}
        subtitle={booking ? booking.name ?? undefined : undefined}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setLocation("/booking/bookings")}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
            {!isReadOnly && (
              <Button onClick={handleSubmit(onSubmit)} className="bg-blue-600 hover:bg-blue-700 text-white"><Save className="w-4 h-4 mr-1" /> Save</Button>
            )}
          </div>
        }
      />
      <div className="p-6 max-w-4xl space-y-6">
        {!isNew && <FSMActionBar />}

        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider border-b pb-2">GENERAL</h3>
          {!isNew && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-xs">Booking Ref</Label>
                <p className="font-mono text-sm mt-1">{booking?.booking_ref}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Name</Label>
                <p className="text-sm mt-1">{booking?.name ?? "—"}</p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider border-b pb-2">MAIN</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Account (Guest) *</Label>
              <Controller name="account_id" control={control} render={({ field }) => (
                <LookupSelect
                  lookupUrl={`${BASE}api/v1/lookup/accounts`}
                  placeholder="Search guest accounts..."
                  value={field.value}
                  onChange={field.onChange}
                  displayText={booking?.account_name ?? undefined}
                />
              )} />
            </div>
            <div>
              <Label>Contact</Label>
              <Controller name="contact_id" control={control} render={({ field }) => (
                <LookupSelect
                  lookupUrl={`${BASE}api/v1/lookup/contacts`}
                  placeholder="Search contacts..."
                  value={field.value}
                  onChange={field.onChange}
                  displayText={booking?.contact_name ?? undefined}
                />
              )} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Booking Source</Label>
              <Controller name="booking_source" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>
                    {["Direct", "Agent", "Website", "Referral", "Other"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>
          <div>
            <Label>Customer Notes</Label>
            <Textarea {...register("customer_notes")} rows={3} className="mt-1" placeholder="Notes from customer..." />
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider border-b pb-2">SPACE</h3>
          <div>
            <Label>Space *</Label>
            <Controller name="space_id" control={control} render={({ field }) => (
              <LookupSelect
                lookupUrl={`${BASE}api/v1/lookup/spaces`}
                placeholder="Search spaces..."
                value={field.value}
                onChange={field.onChange}
                displayText={booking?.space_name ?? undefined}
              />
            )} />
          </div>
          {booking?.space_type && (
            <div className="flex items-center gap-3">
              <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">{booking.space_type}</span>
              {booking?.booking_mode && (
                <span className={`text-xs px-2 py-1 rounded font-medium ${booking.booking_mode === "Instant" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {booking.booking_mode} Booking
                </span>
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider border-b pb-2">PERIOD</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Check-In Date *</Label>
              <Input type="date" {...register("check_in_date")} className="mt-1" />
            </div>
            <div>
              <Label>Check-Out Date *</Label>
              <Input type="date" {...register("check_out_date")} className="mt-1" />
            </div>
          </div>
          {stay && (
            <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
              {stay.weeks} weeks ({stay.nights} nights) × ${watchRate}/week = <strong>${stay.total.toFixed(2)} AUD</strong>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider border-b pb-2">PRICING</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Agreed Weekly Rate *</Label>
              <Input {...register("agreed_weekly_rate")} className="mt-1" placeholder="0.00" />
            </div>
            <div>
              <Label>Currency</Label>
              <Controller name="currency" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["AUD", "USD", "EUR", "GBP", "JPY"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div>
              <Label>Num Guests</Label>
              <Input type="number" min={1} {...register("num_guests", { valueAsNumber: true })} className="mt-1" />
            </div>
          </div>
        </div>

        {!isNew && (
          <>
            <div className="flex border-b gap-1">
              {["Documents", "Notes", "Activities"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab.toLowerCase())}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.toLowerCase() ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "documents" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-sm">KYC Documents</h4>
                  <Button size="sm" variant="outline" onClick={() => setUploadDocOpen(true)}>
                    <Upload className="w-3.5 h-3.5 mr-1" /> Upload Document
                  </Button>
                </div>
                <div className="rounded-lg border bg-white overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {["Doc Type", "File Name", "Status", "Expiry", "Uploaded", "Actions"].map((h) => (
                          <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {!documents?.length ? (
                        <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No documents uploaded</td></tr>
                      ) : documents.map((doc) => (
                        <tr key={doc.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">{doc.doc_type ?? "—"}</td>
                          <td className="px-4 py-3 text-blue-600">
                            {doc.file_url ? <a href={doc.file_url} target="_blank" rel="noreferrer" className="hover:underline">{doc.file_name ?? doc.file_url}</a> : doc.file_name ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${DOC_STATUS_COLORS[doc.verified_status] ?? "bg-gray-100 text-gray-700"}`}>
                              {doc.verified_status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{doc.expiry_date ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{new Date(doc.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              {doc.verified_status !== "Verified" && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-green-600" onClick={() => verifyDocMutation.mutate({ id: Number(id), docId: doc.id })}>
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Verify
                                </Button>
                              )}
                              {doc.verified_status !== "Rejected" && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" onClick={() => setRejectDocId(doc.id)}>
                                  <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "notes" && (
              <div className="rounded-lg border bg-white p-6 text-muted-foreground text-sm text-center py-12">
                Notes feature coming soon.
              </div>
            )}
            {activeTab === "activities" && (
              <div className="rounded-lg border bg-white p-6 text-muted-foreground text-sm text-center py-12">
                Activity log coming soon.
              </div>
            )}
          </>
        )}
      </div>

      {/* Cancel/Reject Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{status === "PendingApproval" ? "Reject Booking" : "Cancel Booking"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Reason *</Label>
            <Textarea rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Enter reason..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Back</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => {
              if (!cancelReason.trim()) return;
              if (status === "PendingApproval") rejectMutation.mutate({ id: Number(id), data: { reason: cancelReason } });
              else cancelMutation.mutate({ id: Number(id), data: { reason: cancelReason } });
            }}>
              {status === "PendingApproval" ? "Reject" : "Cancel Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Dialog */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Extend Stay</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>New Check-Out Date *</Label>
            <Input type="date" value={extendDate} onChange={(e) => setExtendDate(e.target.value)} min={booking?.check_out_date ?? ""} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendDialogOpen(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => {
              if (!extendDate) return;
              extendMutation.mutate({ id: Number(id), data: { new_check_out_date: extendDate } });
            }}>Extend</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={uploadDocOpen} onOpenChange={setUploadDocOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Document Type</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {["Passport", "Visa", "ID Card", "Driver License", "Proof of Income", "Other"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>File URL</Label>
              <Input value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="https://..." className="mt-1" />
            </div>
            <div>
              <Label>Document Expiry</Label>
              <Input type="date" value={docExpiry} onChange={(e) => setDocExpiry(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDocOpen(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => {
              createDocMutation.mutate({
                id: Number(id),
                data: { doc_type: docType || undefined, file_url: docUrl || undefined, file_name: docUrl?.split("/").pop() || undefined, expiry_date: docExpiry || undefined },
              });
            }}>Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Document Dialog */}
      <Dialog open={rejectDocId !== null} onOpenChange={() => setRejectDocId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Document</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Rejection Reason *</Label>
            <Textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Enter reason..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDocId(null)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => {
              if (!rejectReason.trim() || !rejectDocId) return;
              rejectDocMutation.mutate({ id: Number(id), docId: rejectDocId, data: { rejection_reason: rejectReason } });
            }}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

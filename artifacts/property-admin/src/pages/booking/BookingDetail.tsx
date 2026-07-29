import { useEffect, useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { formatDate } from "@/lib/date";
import { useForm, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
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
  useListInvoices,
  getListBookingsQueryKey, getGetBookingQueryKey, getListBookingDocumentsQueryKey,
  getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Save, FileText, CheckCircle2, XCircle, Upload, ExternalLink, Plus, Trash2, Camera } from "lucide-react";
import { LookupSelect } from "@/components/LookupSelect";
import { AccountLookupSelect } from "@/components/AccountLookupSelect";
import { apiFetch } from "@/lib/apiFetch";
import { useBrand } from "@/contexts/ThemeContext";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { BookingConditionReports } from "./BookingConditionReports";
import { BookingDepositSettlement } from "./BookingDepositSettlement";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";

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
  product_id: number | null;
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
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("details");
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();
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
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [editSvc, setEditSvc] = useState<any | null>(null);
  const [editSvcStatus, setEditSvcStatus] = useState("Active");
  const [editSvcNotes, setEditSvcNotes] = useState("");
  const [photosSvcId, setPhotosSvcId] = useState<number | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const { data: photosData } = useQuery({
    queryKey: ["booking-service-photos", id, photosSvcId],
    queryFn: async () => {
      const r = await apiFetch(`/api/v1/bookings/${id}/services/${photosSvcId}/photos`);
      return r.json();
    },
    enabled: !!photosSvcId && !isNew,
  });
  const photos: any[] = photosData?.data ?? [];
  const [svcName, setSvcName] = useState("");
  const [svcType, setSvcType] = useState("one_time");
  const [svcQty, setSvcQty] = useState("1");
  const [svcPrice, setSvcPrice] = useState("");
  const [svcFreq, setSvcFreq] = useState("");
  const [svcNotes, setSvcNotes] = useState("");
  const { currency: brandCurrency } = useBrand();
  function resetServiceForm() { setSvcName(""); setSvcType("one_time"); setSvcQty("1"); setSvcPrice(""); setSvcFreq(""); setSvcNotes(""); }

  const { data: booking, refetch } = useGetBooking(Number(id), { query: { enabled: !isNew, queryKey: getGetBookingQueryKey(Number(id)) } });
  const { data: documents } = useListBookingDocuments(Number(id), {
    query: { enabled: !isNew, queryKey: getListBookingDocumentsQueryKey(Number(id)) },
  });
  const { data: invoices } = useListInvoices({ booking_id: isNew ? undefined : Number(id) }, {
    query: { enabled: !isNew, queryKey: getListInvoicesQueryKey({ booking_id: isNew ? undefined : Number(id) }) },
  });

  const { data: linkedContract, refetch: refetchContract } = useQuery({
    queryKey: ["booking-contract", id],
    queryFn: async () => { const r = await apiFetch(`/api/v1/bookings/${id}/contract`); return r.json(); },
    enabled: !isNew,
  });
  const { data: servicesData, refetch: refetchServices } = useQuery({
    queryKey: ["booking-services", id],
    queryFn: async () => { const r = await apiFetch(`/api/v1/bookings/${id}/services`); return r.json(); },
    enabled: !isNew,
  });
  const bookingServices: any[] = servicesData?.data ?? [];

  const addServiceMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await apiFetch(`/api/v1/bookings/${id}/services`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      return r.json();
    },
    onSuccess: () => { refetchServices(); setAddServiceOpen(false); resetServiceForm(); },
  });
  const removeServiceMutation = useMutation({
    mutationFn: async (svcId: number) => {
      await apiFetch(`/api/v1/bookings/${id}/services/${svcId}`, { method: "DELETE" });
    },
    onSuccess: () => refetchServices(),
  });
  const updateServiceMutation = useMutation({
    mutationFn: async ({ svcId, payload }: { svcId: number; payload: any }) => {
      const r = await apiFetch(`/api/v1/bookings/${id}/services/${svcId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.success === false) {
        throw new Error(data?.error ?? data?.error?.message ?? `Failed to update service (HTTP ${r.status})`);
      }
      return data;
    },
    onSuccess: () => { refetchServices(); setEditSvc(null); },
    onError: (err: any) => { alert(err?.message ?? "Failed to update service"); },
  });
  const SVC_STATUSES = ["Active", "Processing", "Completed", "Cancelled"] as const;
  const SVC_STATUS_COLORS: Record<string, string> = {
    Active: "bg-gray-100 text-gray-700",
    Processing: "bg-blue-100 text-blue-700",
    Completed: "bg-green-100 text-green-700",
    Cancelled: "bg-red-100 text-red-700",
  };

  const { register, handleSubmit, reset, control, watch } = useForm<FormData>({
    defaultValues: {
      account_id: null, contact_id: null, booking_source: "", customer_notes: "",
      space_id: null, check_in_date: "", check_out_date: "", agreed_weekly_rate: "",
      currency: brandCurrency, num_guests: 1, product_id: null, status: "Active",
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
        currency: booking.currency ?? brandCurrency,
        num_guests: booking.num_guests ?? 1,
        product_id: (booking as any).product_id ?? null,
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
  const confirmMutation = useConfirmBooking({ mutation: { onSuccess: () => { refetch(); refetchContract(); } } });
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
      <div className={`rounded-lg border-2 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${status === "Draft" ? "border-gray-200 bg-gray-50" : status === "PendingPayment" ? "border-yellow-300 bg-yellow-50" : status === "PendingApproval" ? "border-amber-300 bg-amber-50" : status === "Confirmed" ? "border-blue-300 bg-blue-50" : status === "Active" ? "border-green-300 bg-green-50" : status === "CheckedOut" ? "border-indigo-200 bg-indigo-50" : "border-red-200 bg-red-50"}`}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-muted-foreground">{t("booking.status_label")}</span>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${BOOKING_STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"}`}>{status}</span>
          {status === "Cancelled" && booking?.cancellation_reason && (
            <span className="text-sm text-red-600 ml-2">{t("booking.reason_label")} {booking.cancellation_reason}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {status === "Draft" && (
            <Button className="bg-primary hover:bg-[#d4561a] text-white" onClick={() => submitMutation.mutate({ id: Number(id) })}>
              {t("booking.btn_submit")}
            </Button>
          )}
          {status === "PendingPayment" && (
            <>
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => confirmMutation.mutate({ id: Number(id) })}>
                {t("booking.btn_process_payment")}
              </Button>
              <Button variant="outline" className="text-red-600 border-red-300" onClick={() => setCancelDialogOpen(true)}>{t("booking.btn_cancel")}</Button>
            </>
          )}
          {status === "PendingApproval" && (
            <>
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => confirmMutation.mutate({ id: Number(id) })}>
                {t("booking.btn_confirm")}
              </Button>
              <Button variant="outline" className="text-red-600 border-red-300" onClick={() => { setCancelDialogOpen(true); }}>{t("booking.btn_reject")}</Button>
            </>
          )}
          {status === "Confirmed" && (
            <>
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => checkInMutation.mutate({ id: Number(id) })}>{t("booking.btn_checkin")}</Button>
              <Button variant="outline" onClick={() => setExtendDialogOpen(true)}>{t("booking.btn_extend")}</Button>
              <Button variant="outline" className="text-red-600 border-red-300" onClick={() => setCancelDialogOpen(true)}>{t("booking.btn_cancel")}</Button>
            </>
          )}
          {status === "Active" && (
            <>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => checkOutMutation.mutate({ id: Number(id) })}>{t("booking.btn_checkout")}</Button>
              <Button variant="outline" onClick={() => setExtendDialogOpen(true)}>{t("booking.btn_extend")}</Button>
            </>
          )}
          {linkedContract && (
            <Link href={`/contracts/contracts/${linkedContract.id}`}>
              <Button variant="outline" size="sm" className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50">
                <FileText className="h-3.5 w-3.5" />
                {t("booking.view_contract")} <span className="text-xs font-mono opacity-70">{linkedContract.contract_ref}</span>
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          )}
          {status === "CheckedOut" && (
            <span className="text-indigo-600 font-medium text-sm">{t("booking.btn_completed")}</span>
          )}
          {status === "Cancelled" && (
            <span className="text-red-600 font-medium text-sm">{t("common.cancelled")}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <PageHeader
        title={isNew ? `${t("common.new")} ${t("nav.booking")}` : (booking?.booking_ref ?? t("nav.booking"))}
        subtitle={booking ? booking.name ?? undefined : undefined}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setLocation("/booking/bookings")}><ArrowLeft className="w-4 h-4 mr-1" /> {t("common.back")}</Button>
            {!isReadOnly && (
              <Button onClick={handleSubmit(onSubmit)} className="bg-primary hover:bg-[#d4561a] text-white"><Save className="w-4 h-4 mr-1" /> {t("common.save")}</Button>
            )}
          </div>
        }
      />
      <div className="p-4 sm:p-6 max-w-4xl space-y-6">
        {!isNew && <FSMActionBar />}

        <div className="rounded-lg border bg-white p-4 sm:p-6 space-y-4">
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider border-b pb-2">{t("booking.section_general")}</h3>
          {!isNew && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-xs">{t("booking.label_booking_ref")}</Label>
                <p className="font-mono text-sm mt-1">{booking?.booking_ref}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">{t("booking.label_name")}</Label>
                <p className="text-sm mt-1">{booking?.name ?? "—"}</p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-white p-4 sm:p-6 space-y-4">
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider border-b pb-2">{t("booking.section_main")}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>{t("booking.label_account")} *</Label>
              <Controller name="account_id" control={control} render={({ field }) => (
                <AccountLookupSelect
                  lookupUrl="/api/v1/lookup/accounts"
                  placeholder={t("booking.placeholder_account")}
                  value={field.value}
                  onChange={field.onChange}
                  displayValue={booking?.account_name ?? undefined}
                />
              )} />
            </div>
            <div>
              <Label>{t("booking.label_contact")}</Label>
              <Controller name="contact_id" control={control} render={({ field }) => (
                <LookupSelect
                  lookupUrl="/api/v1/lookup/contacts"
                  placeholder={t("booking.placeholder_contact")}
                  value={field.value}
                  onChange={field.onChange}
                  displayValue={booking?.contact_name ?? undefined}
                />
              )} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>{t("booking.label_source")}</Label>
              <Controller name="booking_source" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t("booking.placeholder_source")} /></SelectTrigger>
                  <SelectContent>
                    {["Direct", "Agent", "Website", "Referral", "Other"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>
          <div>
            <Label>{t("booking.label_customer_notes")}</Label>
            <Textarea {...register("customer_notes")} rows={3} className="mt-1" placeholder={t("booking.placeholder_notes")} />
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4 sm:p-6 space-y-4">
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider border-b pb-2">{t("booking.section_space_product")}</h3>
          <div>
            <Label>{t("booking.label_space")} *</Label>
            <Controller name="space_id" control={control} render={({ field }) => (
              <LookupSelect
                lookupUrl="/api/v1/lookup/spaces"
                placeholder={t("booking.placeholder_space")}
                value={field.value}
                onChange={field.onChange}
                displayValue={booking?.space_name ?? undefined}
              />
            )} />
          </div>
          {booking?.space_type && (
            <div className="flex items-center gap-3">
              <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">{booking.space_type}</span>
              {booking?.booking_mode && (
                <span className={`text-xs px-2 py-1 rounded font-medium ${booking.booking_mode === "Instant" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {booking.booking_mode === "Instant" ? t("booking.instant_booking") : t("booking.request_booking")}
                </span>
              )}
            </div>
          )}
          <div>
            <Label>{t("booking.label_product")}</Label>
            <Controller name="product_id" control={control} render={({ field }) => (
              <LookupSelect
                lookupUrl="/api/v1/lookup/products"
                placeholder={t("booking.placeholder_product")}
                value={field.value}
                onChange={field.onChange}
                displayValue={(booking as any)?.product_name ?? (booking as any)?.contract_product_name ?? undefined}
              />
            )} />
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4 sm:p-6 space-y-4">
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider border-b pb-2">{t("booking.section_period")}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>{t("booking.label_checkin_date")} *</Label>
              <Controller name="check_in_date" control={control} render={({ field }) => (
                <DateInput value={field.value ?? ""} onChange={field.onChange} className="mt-1" />
              )} />
            </div>
            <div>
              <Label>{t("booking.label_checkout_date")} *</Label>
              <Controller name="check_out_date" control={control} render={({ field }) => (
                <DateInput value={field.value ?? ""} onChange={field.onChange} className="mt-1" />
              )} />
            </div>
          </div>
          {stay && (
            <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
              {t("booking.stay_summary", { weeks: stay.weeks, nights: stay.nights, rate: watchRate, total: stay.total.toFixed(2) })}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-white p-4 sm:p-6 space-y-4">
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider border-b pb-2">{t("booking.section_rate")}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>{t("booking.label_weekly_rate")} *</Label>
              <Input {...register("agreed_weekly_rate")} className="mt-1" placeholder="0.00" />
            </div>
            <div>
              <Label>{t("booking.label_currency")}</Label>
              <Controller name="currency" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div>
              <Label>{t("booking.label_num_guests")}</Label>
              <Input type="number" min={1} {...register("num_guests", { valueAsNumber: true })} className="mt-1" />
            </div>
          </div>
        </div>

        {!isNew && (
          <>
            <div className="flex border-b gap-1">
              {[
                { id: "documents", label: t("booking.tab_documents") },
                { id: "condition", label: t("booking.tab_condition") },
                { id: "services", label: `${t("booking.services")}${bookingServices.length ? ` (${bookingServices.length})` : ""}` },
                { id: "invoices", label: t("booking.tab_invoices") },
                { id: "notes", label: t("booking.tab_notes") },
                { id: "activities", label: t("booking.tab_activities") }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {tab.label}{tab.id === "invoices" && invoices?.length ? ` (${invoices.length})` : ""}
                </button>
              ))}
            </div>

            {activeTab === "documents" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-sm">{t("booking.kyc_documents")}</h4>
                  <Button size="sm" variant="outline" onClick={() => setUploadDocOpen(true)}>
                    <Upload className="w-3.5 h-3.5 mr-1" /> {t("booking.btn_upload_doc")}
                  </Button>
                </div>
                <div className="rounded-lg border bg-white overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {[
                          t("booking.col_doc_type"),
                          t("booking.col_file_name"),
                          t("common.status"),
                          t("booking.col_expiry"),
                          t("booking.col_uploaded"),
                          t("common.actions")
                        ].map((h) => (
                          <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {!documents?.length ? (
                        <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">{t("common.no_data")}</td></tr>
                      ) : documents.map((doc) => (
                        <tr key={doc.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">{doc.doc_type ?? "—"}</td>
                          <td className="px-4 py-3 text-primary">
                            {doc.file_url
                              ? <button type="button" className="hover:underline text-left"
                                  onClick={() => openPreview({ title: doc.file_name ?? doc.doc_type ?? "", filename: doc.file_name ?? "document", source: { kind: "url", href: doc.file_url! } })}>
                                  {doc.file_name ?? doc.file_url}
                                </button>
                              : doc.file_name ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${DOC_STATUS_COLORS[doc.verified_status] ?? "bg-gray-100 text-gray-700"}`}>
                              {doc.verified_status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{doc.expiry_date ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(doc.created_at)}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              {doc.verified_status !== "Verified" && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-green-600" onClick={() => verifyDocMutation.mutate({ id: Number(id), docId: doc.id })}>
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {t("booking.btn_verify")}
                                </Button>
                              )}
                              {doc.verified_status !== "Rejected" && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" onClick={() => setRejectDocId(doc.id)}>
                                  <XCircle className="w-3.5 h-3.5 mr-1" /> {t("booking.btn_reject_doc")}
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

            {activeTab === "condition" && (
              <>
                <BookingConditionReports bookingId={String(id)} />
                <BookingDepositSettlement bookingId={String(id)} />
              </>
            )}

            {activeTab === "services" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-sm">{t("booking.services")}</h4>
                  <Button size="sm" variant="outline" onClick={() => setAddServiceOpen(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> {t("booking.add_service")}
                  </Button>
                </div>
                <div className="rounded-lg border bg-white overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {[t("booking.col_service_name"), t("common.type"), t("booking.col_qty"), t("booking.col_unit_price"), t("common.total"), t("booking.col_billing"), t("booking.col_frequency"), t("common.status"), t("common.notes"), ""].map((h, i) => (
                          <th key={i} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {!bookingServices.length ? (
                        <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">{t("booking.no_services")}</td></tr>
                      ) : bookingServices.map((svc: any) => (
                        <tr key={svc.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{svc.service_name ?? svc.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{svc.service_type ?? "—"}</td>
                          <td className="px-4 py-3">{svc.quantity ?? 1}</td>
                          <td className="px-4 py-3">{svc.unit_price ? `$${Number(svc.unit_price).toFixed(2)}` : "—"}</td>
                          <td className="px-4 py-3">{svc.total_price ? `$${Number(svc.total_price).toFixed(2)}` : "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{svc.billing_trigger ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{svc.frequency ?? "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SVC_STATUS_COLORS[svc.status] ?? "bg-gray-100 text-gray-600"}`}>
                              {svc.status ?? "Active"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[200px]">
                            <span className="block truncate" title={svc.notes ?? ""}>{svc.notes || "—"}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" className="h-7" title={t("booking.edit_status_notes")} onClick={() => { setEditSvc(svc); setEditSvcStatus(svc.status ?? "Active"); setEditSvcNotes(svc.notes ?? ""); }}>
                                <FileText className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7" title={t("booking.view_job_photos")} onClick={() => setPhotosSvcId(svc.id)}>
                                <Camera className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-red-500 hover:text-red-700" onClick={() => removeServiceMutation.mutate(svc.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "invoices" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-sm">{t("booking.tab_invoices")}</h4>
                  <Link href={`/finance/invoices/new`}>
                    <button className="text-xs text-primary hover:underline">+ {t("invoice.new")}</button>
                  </Link>
                </div>
                <div className="rounded-lg border bg-white overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {[
                          t("booking.col_ref"),
                          t("common.amount"),
                          t("booking.label_currency"),
                          t("booking.col_due_date"),
                          t("common.status")
                        ].map((h) => (
                          <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {!invoices?.length ? (
                        <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">{t("common.no_data")}</td></tr>
                      ) : invoices.map((inv: any) => (
                        <tr key={inv.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <Link href={`/finance/invoices/${inv.id}`}>
                              <span className="text-primary hover:underline cursor-pointer">{inv.invoice_ref ?? `#${inv.id}`}</span>
                            </Link>
                          </td>
                          <td className="px-4 py-3">{inv.amount != null ? Number(inv.amount).toFixed(2) : "—"}</td>
                          <td className="px-4 py-3">{inv.currency ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{inv.due_date ?? "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${inv.status === "Paid" ? "bg-green-100 text-green-700" : inv.status === "Sent" ? "bg-blue-100 text-blue-700" : inv.status === "Void" ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600"}`}>
                              {inv.status ?? "Draft"}
                            </span>
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
                {t("booking.notes_coming_soon")}
              </div>
            )}
            {activeTab === "activities" && (
              <div className="rounded-lg border bg-white p-6 text-muted-foreground text-sm text-center py-12">
                {t("booking.activities_coming_soon")}
              </div>
            )}
          </>
        )}
      </div>

      {/* Cancel/Reject Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{status === "PendingApproval" ? t("booking.dlg_reject_title") : t("booking.dlg_cancel_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>{t("common.notes")} *</Label>
            <Textarea rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder={t("booking.dlg_reason_placeholder")} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>{t("common.back")}</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => {
              if (!cancelReason.trim()) return;
              if (status === "PendingApproval") rejectMutation.mutate({ id: Number(id), data: { reason: cancelReason } });
              else cancelMutation.mutate({ id: Number(id), data: { reason: cancelReason } });
            }}>
              {status === "PendingApproval" ? t("booking.dlg_reject_confirm") : t("booking.dlg_cancel_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Dialog */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("booking.dlg_extend_title")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>{t("booking.dlg_extend_new_checkout")} *</Label>
            <DateInput value={extendDate} onChange={setExtendDate} min={booking?.check_out_date ?? ""} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button className="bg-primary hover:bg-[#d4561a] text-white" onClick={() => {
              if (!extendDate) return;
              extendMutation.mutate({ id: Number(id), data: { new_check_out_date: extendDate } });
            }}>{t("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={uploadDocOpen} onOpenChange={setUploadDocOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("booking.dlg_upload_title")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("booking.dlg_doc_type")}</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t("booking.placeholder_source")} /></SelectTrigger>
                <SelectContent>
                  {t("booking.doc_types").split(",").map((typeItem) => (
                    <SelectItem key={typeItem} value={typeItem}>{typeItem}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("booking.dlg_file_url")}</Label>
              <Input value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder={t("booking.placeholder_url")} className="mt-1" />
            </div>
            <div>
              <Label>{t("booking.dlg_expiry_date")}</Label>
              <DateInput value={docExpiry} onChange={setDocExpiry} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDocOpen(false)}>{t("common.cancel")}</Button>
            <Button className="bg-primary hover:bg-[#d4561a] text-white" onClick={() => {
              createDocMutation.mutate({
                id: Number(id),
                data: { doc_type: docType || undefined, file_url: docUrl || undefined, file_name: docUrl?.split("/").pop() || undefined, expiry_date: docExpiry || undefined },
              });
            }}>{t("common.upload")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Service Dialog */}
      <Dialog open={addServiceOpen} onOpenChange={setAddServiceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("booking.add_service")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("booking.col_service_name")} *</Label>
              <Input value={svcName} onChange={(e) => setSvcName(e.target.value)} placeholder={t("booking.placeholder_service_name")} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("common.type")}</Label>
                <Select value={svcType} onValueChange={setSvcType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">{t("booking.type_one_time")}</SelectItem>
                    <SelectItem value="recurring">{t("booking.type_recurring")}</SelectItem>
                    <SelectItem value="scheduled">{t("common.scheduled")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("booking.label_quantity")}</Label>
                <Input type="number" value={svcQty} onChange={(e) => setSvcQty(e.target.value)} min={1} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("booking.label_unit_price_aud", { currency: brandCurrency })}</Label>
                <Input type="number" value={svcPrice} onChange={(e) => setSvcPrice(e.target.value)} placeholder="0.00" className="mt-1" />
              </div>
              <div>
                <Label>{t("booking.label_billing_frequency")}</Label>
                <Select value={svcFreq} onValueChange={setSvcFreq}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t("booking.placeholder_select")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">{t("common.weekly")}</SelectItem>
                    <SelectItem value="biweekly">{t("booking.freq_fortnightly")}</SelectItem>
                    <SelectItem value="monthly">{t("common.monthly")}</SelectItem>
                    <SelectItem value="once">{t("booking.freq_once")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t("common.notes")}</Label>
              <Textarea rows={2} value={svcNotes} onChange={(e) => setSvcNotes(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddServiceOpen(false); resetServiceForm(); }}>{t("common.cancel")}</Button>
            <Button className="bg-primary hover:bg-[#d4561a] text-white" disabled={!svcName.trim()} onClick={() => {
              const qty = Number(svcQty) || 1;
              const price = Number(svcPrice) || 0;
              addServiceMutation.mutate({
                service_name: svcName.trim(),
                service_type: svcType,
                quantity: qty,
                unit_price: price.toString(),
                total_price: (qty * price).toString(),
                billing_trigger: svcFreq || undefined,
                frequency: svcType === "recurring" ? (svcFreq || undefined) : undefined,
                notes: svcNotes || undefined,
              });
            }}>{t("common.add")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Service Status/Notes Dialog */}
      <Dialog open={editSvc !== null} onOpenChange={(open) => { if (!open) setEditSvc(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("booking.edit_service_title", { name: editSvc?.service_name ?? editSvc?.name })}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("common.status")}</Label>
              <Select value={editSvcStatus} onValueChange={setEditSvcStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SVC_STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("common.notes")}</Label>
              <Textarea rows={4} value={editSvcNotes} onChange={(e) => setEditSvcNotes(e.target.value)} className="mt-1" maxLength={5000} placeholder={t("booking.placeholder_service_notes")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSvc(null)}>{t("common.cancel")}</Button>
            <Button
              className="bg-primary hover:bg-[#d4561a] text-white"
              disabled={updateServiceMutation.isPending}
              onClick={() => editSvc && updateServiceMutation.mutate({ svcId: editSvc.id, payload: { status: editSvcStatus, notes: editSvcNotes || null } })}
            >
              {updateServiceMutation.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Document Dialog */}
      <Dialog open={photosSvcId !== null} onOpenChange={(open) => { if (!open) setPhotosSvcId(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-4 h-4" /> {t("booking.job_report_photos")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            {t("booking.job_photos_subtitle", { count: photos.length })}
          </p>
          {photos.length === 0 ? (
            <div className="border-2 border-dashed border-border rounded-lg p-12 text-center mt-2">
              <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t("booking.no_photos")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-2 max-h-[60vh] overflow-y-auto">
              {photos.map((p) => (
                <div key={p.id} className="aspect-square rounded-lg overflow-hidden border bg-gray-50">
                  <img
                    src={p.thumbnail_url ?? p.file_url}
                    alt={p.caption ?? "Job photo"}
                    loading="lazy"
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                    onClick={() => setPreviewPhotoUrl(p.file_url)}
                  />
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <img src={previewPhotoUrl} alt={t("common.preview")} className="max-w-full max-h-full rounded-lg" />
        </div>
      )}

      <Dialog open={rejectDocId !== null} onOpenChange={() => setRejectDocId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("booking.btn_reject_doc")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>{t("booking.reason_label")} *</Label>
            <Textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={t("booking.dlg_reason_placeholder")} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDocId(null)}>{t("common.cancel")}</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => {
              if (!rejectReason.trim() || !rejectDocId) return;
              rejectDocMutation.mutate({ id: Number(id), docId: rejectDocId, data: { rejection_reason: rejectReason } });
            }}>{t("common.reject")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
    </Layout>
  );
}

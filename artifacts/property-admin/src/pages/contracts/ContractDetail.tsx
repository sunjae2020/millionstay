import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { formatDate } from "@/lib/date";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm, Controller } from "react-hook-form";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  useGetContract, useCreateContract, useUpdateContract,
  useSendContract, useSignContract, useActivateContract,
  useTerminateContract, useExpireContract, useDeleteContract,
  getListContractsQueryKey, getGetContractQueryKey,
} from "@workspace/api-client-react";
import { LookupSelect } from "@/components/LookupSelect";
import { ArrowLeft, Save, Trash2, CalendarDays, Plus, Pencil, List, FileDown, Eye, Mail } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { DocumentVersions } from "@/components/DocumentVersions";
import { HomestaySignatureCard } from "@/components/HomestaySignatureCard";

const CURRENCIES = ["AUD", "USD", "SGD", "MYR", "GBP"];
const statusColors: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Sent: "bg-blue-100 text-blue-700",
  Signed: "bg-purple-100 text-purple-700",
  Active: "bg-green-100 text-green-700",
  Expired: "bg-orange-100 text-orange-700",
  Terminated: "bg-red-100 text-red-700",
};

interface FormData {
  booking_id: number | null;
  product_id: number | null;
  tenant_account_id: number | null;
  landlord_account_id: number | null;
  space_id: number | null;
  start_date: string;
  end_date: string;
  weekly_rate: string;
  total_rent: string;
  bond_amount: string;
  advance_amount: string;
  currency: string;
  document_url: string;
  terms_text: string;
  notes: string;
}

export default function ContractDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const isNew = id === "new";

  const [terminateOpen, setTerminateOpen] = useState(false);
  const [terminateReason, setTerminateReason] = useState("");
  const [signDocUrl, setSignDocUrl] = useState("");
  const [signOpen, setSignOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("line-items");

  // Payment Schedule dialog state
  const [schedDialogOpen, setSchedDialogOpen] = useState(false);
  const [schedEditItem, setSchedEditItem] = useState<any | null>(null);
  const [schedType, setSchedType] = useState("Rent");
  const [schedFreq, setSchedFreq] = useState("Biweekly");
  const [schedAmount, setSchedAmount] = useState("");
  const [schedCurrency, setSchedCurrency] = useState("AUD");
  const [schedStartDate, setSchedStartDate] = useState("");
  const [schedEndDate, setSchedEndDate] = useState("");
  const [schedNextDue, setSchedNextDue] = useState("");
  const [schedActive, setSchedActive] = useState(true);
  const [schedGst, setSchedGst] = useState(true);

  const resetSchedForm = () => {
    setSchedEditItem(null);
    setSchedType("Rent"); setSchedFreq("Biweekly"); setSchedAmount("");
    setSchedCurrency("AUD"); setSchedStartDate(""); setSchedEndDate("");
    setSchedNextDue(""); setSchedActive(true); setSchedGst(true);
  };

  // Line Items dialog state
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [lineEditItem, setLineEditItem] = useState<any | null>(null);
  const [lineItemType, setLineItemType] = useState("Service");
  const [lineName, setLineName] = useState("");
  const [lineTrigger, setLineTrigger] = useState("at_activation");
  const [lineFreq, setLineFreq] = useState("");
  const [lineUnitPrice, setLineUnitPrice] = useState("");
  const [lineQty, setLineQty] = useState("1");
  const [lineCurrency, setLineCurrency] = useState("AUD");
  const [lineGst, setLineGst] = useState(true);
  const [lineNotes, setLineNotes] = useState("");

  const resetLineForm = () => {
    setLineEditItem(null);
    setLineItemType("Service"); setLineName(""); setLineTrigger("at_activation");
    setLineFreq(""); setLineUnitPrice(""); setLineQty("1");
    setLineCurrency("AUD"); setLineGst(true); setLineNotes("");
  };

  const openAddLine = () => { resetLineForm(); setLineDialogOpen(true); };
  const openEditLine = (item: any) => {
    setLineEditItem(item);
    setLineItemType(item.item_type ?? "Service");
    setLineName(item.name ?? "");
    setLineTrigger(item.billing_trigger ?? "at_activation");
    setLineFreq(item.billing_frequency ?? "");
    setLineUnitPrice(item.unit_price != null ? String(item.unit_price) : "");
    setLineQty(item.quantity != null ? String(item.quantity) : "1");
    setLineCurrency(item.currency ?? "AUD");
    setLineGst(item.gst_included !== false);
    setLineNotes(item.notes ?? "");
    setLineDialogOpen(true);
  };

  const openAddSched = () => { resetSchedForm(); setSchedDialogOpen(true); };
  const openEditSched = (s: any) => {
    setSchedEditItem(s);
    setSchedType(s.schedule_type ?? "Rent");
    setSchedFreq(s.frequency ?? "Biweekly");
    setSchedAmount(s.amount != null ? String(s.amount) : "");
    setSchedCurrency(s.currency ?? "AUD");
    setSchedStartDate(s.start_date ?? "");
    setSchedEndDate(s.end_date ?? "");
    setSchedNextDue(s.next_due_date ?? "");
    setSchedActive(s.is_active !== false);
    setSchedGst(s.gst_included !== false);
    setSchedDialogOpen(true);
  };

  const { data: contract, refetch } = useGetContract(Number(id), {
    query: { enabled: !isNew, queryKey: getGetContractQueryKey(Number(id)) },
  });

  const { data: scheduleData } = useQuery({
    queryKey: ["contract-schedule", id],
    queryFn: async () => { const r = await apiFetch(`/api/v1/contracts/${id}/payment-schedule`); return r.json(); },
    enabled: !isNew,
  });
  const schedules: any[] = scheduleData?.data ?? [];

  const { data: lineItemsData } = useQuery({
    queryKey: ["contract-line-items", id],
    queryFn: async () => { const r = await apiFetch(`/api/v1/contracts/${id}/line-items`); return r.json(); },
    enabled: !isNew,
  });
  const lineItems: any[] = lineItemsData?.data ?? [];

  const { register, handleSubmit, reset, control } = useForm<FormData>({
    defaultValues: {
      booking_id: null, product_id: null, tenant_account_id: null,
      landlord_account_id: null, space_id: null,
      start_date: "", end_date: "", weekly_rate: "", total_rent: "",
      bond_amount: "", advance_amount: "", currency: "AUD",
      document_url: "", terms_text: "", notes: "",
    },
  });

  useEffect(() => {
    if (contract) {
      reset({
        booking_id: contract.booking_id ?? null,
        product_id: (contract as any).product_id ?? null,
        tenant_account_id: contract.tenant_account_id ?? null,
        landlord_account_id: contract.landlord_account_id ?? null,
        space_id: contract.space_id ?? null,
        start_date: contract.start_date ?? "",
        end_date: contract.end_date ?? "",
        weekly_rate: contract.weekly_rate != null ? String(contract.weekly_rate) : "",
        total_rent: contract.total_rent != null ? String(contract.total_rent) : "",
        bond_amount: contract.bond_amount != null ? String(contract.bond_amount) : "",
        advance_amount: contract.advance_amount != null ? String(contract.advance_amount) : "",
        currency: contract.currency ?? "AUD",
        document_url: contract.document_url ?? "",
        terms_text: contract.terms_text ?? "",
        notes: contract.notes ?? "",
      });
    }
  }, [contract, reset]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListContractsQueryKey() });
    if (!isNew) qc.invalidateQueries({ queryKey: getGetContractQueryKey(Number(id)) });
  };

  const createMutation = useCreateContract({ mutation: { onSuccess: (d) => { invalidate(); navigate(`/contracts/contracts/${d.id}`); } } });
  const updateMutation = useUpdateContract({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const sendMutation = useSendContract({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const signMutation = useSignContract({ mutation: { onSuccess: () => { invalidate(); refetch(); setSignOpen(false); } } });
  const activateMutation = useActivateContract({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const terminateMutation = useTerminateContract({ mutation: { onSuccess: () => { invalidate(); refetch(); setTerminateOpen(false); } } });
  const expireMutation = useExpireContract({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const deleteMutation = useDeleteContract({ mutation: { onSuccess: () => { invalidate(); navigate("/contracts/contracts"); } } });

  const invalidateSchedule = () => qc.invalidateQueries({ queryKey: ["contract-schedule", id] });
  const invalidateLineItems = () => qc.invalidateQueries({ queryKey: ["contract-line-items", id] });

  const addLineMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await apiFetch(`/api/v1/contracts/${id}/line-items`, { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
      if (!r.ok) throw new Error("Failed to add line item");
      return r.json();
    },
    onSuccess: () => { invalidateLineItems(); setLineDialogOpen(false); resetLineForm(); },
  });

  const updateLineMutation = useMutation({
    mutationFn: async ({ lineId, payload }: { lineId: number; payload: any }) => {
      const r = await apiFetch(`/api/v1/contracts/${id}/line-items/${lineId}`, { method: "PATCH", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
      if (!r.ok) throw new Error("Failed to update line item");
      return r.json();
    },
    onSuccess: () => { invalidateLineItems(); setLineDialogOpen(false); resetLineForm(); },
  });

  const deleteLineMutation = useMutation({
    mutationFn: async (lineId: number) => {
      const r = await apiFetch(`/api/v1/contracts/${id}/line-items/${lineId}`, { method: "DELETE" });
      if (!r.ok && r.status !== 204) throw new Error("Failed to delete line item");
    },
    onSuccess: () => invalidateLineItems(),
  });

  const submitLineForm = () => {
    const payload = {
      item_type: lineItemType, name: lineName, billing_trigger: lineTrigger,
      billing_frequency: lineTrigger === "recurring" ? (lineFreq || null) : null,
      unit_price: lineUnitPrice, quantity: Number(lineQty),
      currency: lineCurrency, gst_included: lineGst, notes: lineNotes || null,
    };
    if (lineEditItem) updateLineMutation.mutate({ lineId: lineEditItem.id, payload });
    else addLineMutation.mutate(payload);
  };

  const addSchedMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await apiFetch(`/api/v1/contracts/${id}/payment-schedule`, { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
      if (!r.ok) throw new Error("Failed to add schedule");
      return r.json();
    },
    onSuccess: () => { invalidateSchedule(); setSchedDialogOpen(false); resetSchedForm(); },
  });

  const updateSchedMutation = useMutation({
    mutationFn: async ({ schedId, payload }: { schedId: number; payload: any }) => {
      const r = await apiFetch(`/api/v1/contracts/${id}/payment-schedule/${schedId}`, { method: "PATCH", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
      if (!r.ok) throw new Error("Failed to update schedule");
      return r.json();
    },
    onSuccess: () => { invalidateSchedule(); setSchedDialogOpen(false); resetSchedForm(); },
  });

  const deleteSchedMutation = useMutation({
    mutationFn: async (schedId: number) => {
      const r = await apiFetch(`/api/v1/contracts/${id}/payment-schedule/${schedId}`, { method: "DELETE" });
      if (!r.ok && r.status !== 204) throw new Error("Failed to delete schedule");
    },
    onSuccess: () => invalidateSchedule(),
  });

  const submitSchedForm = () => {
    const payload = {
      schedule_type: schedType, frequency: schedFreq, amount: schedAmount,
      currency: schedCurrency, start_date: schedStartDate,
      end_date: schedEndDate || null, next_due_date: schedNextDue || schedStartDate,
      is_active: schedActive, gst_included: schedGst,
    };
    if (schedEditItem) updateSchedMutation.mutate({ schedId: schedEditItem.id, payload });
    else addSchedMutation.mutate(payload);
  };

  const buildPayload = (data: FormData) => ({
    booking_id: data.booking_id ?? null,
    product_id: data.product_id ?? null,
    tenant_account_id: data.tenant_account_id ?? null,
    landlord_account_id: data.landlord_account_id ?? null,
    space_id: data.space_id ?? null,
    start_date: data.start_date || null,
    end_date: data.end_date || null,
    weekly_rate: data.weekly_rate ? Number(data.weekly_rate) : null,
    total_rent: data.total_rent ? Number(data.total_rent) : null,
    bond_amount: data.bond_amount ? Number(data.bond_amount) : null,
    advance_amount: data.advance_amount ? Number(data.advance_amount) : null,
    currency: data.currency || "AUD",
    document_url: data.document_url || null,
    terms_text: data.terms_text || null,
    notes: data.notes || null,
  });

  const onSubmit = (data: FormData) => {
    if (isNew) createMutation.mutate({ data: buildPayload(data) });
    else updateMutation.mutate({ id: Number(id), data: buildPayload(data) });
  };

  const status = contract?.status ?? "Draft";

  const { toast } = useToast();
  const [pdfBusy, setPdfBusy] = useState(false);
  const handlePdf = async (mode: "download" | "preview") => {
    setPdfBusy(true);
    try {
      const path = mode === "preview"
        ? `/api/v1/contracts/${id}/pdf?format=html`
        : `/api/v1/contracts/${id}/pdf`;
      const res = await apiFetch(path);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const url = URL.createObjectURL(await res.blob());
      if (mode === "preview") {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${contract?.contract_ref ?? "contract"}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast({
        title: t('contract.toast_pdf_unavailable'),
        description: err instanceof Error ? err.message : t('contract.toast_pdf_failed'),
        variant: "destructive",
      });
    } finally {
      setPdfBusy(false);
    }
  };

  const handleEmail = async () => {
    if (!window.confirm(t('contract.confirm_email'))) return;
    setPdfBusy(true);
    try {
      const res = await apiFetch(`/api/v1/contracts/${id}/email`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      toast({ title: t('contract.toast_email_sent'), description: t('contract.toast_email_sent_desc', { to: body?.to ?? t('contract.recipient') }) });
      refetch();
    } catch (err) {
      toast({ title: t('contract.toast_email_failed'), description: err instanceof Error ? err.message : t('contract.error'), variant: "destructive" });
    } finally {
      setPdfBusy(false);
    }
  };

  const fsmActions = () => {
    if (isNew) return null;
    return (
      <div className="flex gap-2">
        {status === "Draft" && (
          <Button type="button" size="sm" className="bg-primary hover:bg-[#d4561a] text-white"
            onClick={() => sendMutation.mutate({ id: Number(id) })}>
            {t('contract.btn_send')}
          </Button>
        )}
        {(status === "Draft" || status === "Sent") && (
          <Button type="button" size="sm" variant="outline" className="border-purple-400 text-purple-700"
            onClick={() => setSignOpen(true)}>
            {t('contract.btn_sign')}
          </Button>
        )}
        {status === "Signed" && (
          <Button type="button" size="sm" className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => activateMutation.mutate({ id: Number(id) })}>
            {t('contract.btn_activate')}
          </Button>
        )}
        {status === "Active" && (
          <Button type="button" size="sm" variant="outline" className="text-orange-600"
            onClick={() => expireMutation.mutate({ id: Number(id) })}>
            {t('contract.btn_mark_expired')}
          </Button>
        )}
        {(status === "Draft" || status === "Sent" || status === "Signed" || status === "Active") && (
          <Button type="button" size="sm" variant="outline" className="text-red-600"
            onClick={() => setTerminateOpen(true)}>
            {t('contract.btn_terminate')}
          </Button>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="p-4 sm:p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-mono">
                {isNew ? t('contract.new') : contract?.contract_ref}
              </h1>
              {!isNew && <p className="text-sm text-muted-foreground">{t('contract.contract_number', { id })}</p>}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button type="button" variant="outline" onClick={() => navigate("/contracts/contracts")}>
                <ArrowLeft className="h-4 w-4 mr-2" />{t('common.back')}
              </Button>
              {!isNew && (
                <>
                  <Button type="button" variant="outline" disabled={pdfBusy} onClick={() => handlePdf("preview")}>
                    <Eye className="h-4 w-4 mr-2" />{t('contract.btn_preview')}
                  </Button>
                  <Button type="button" variant="outline" disabled={pdfBusy} onClick={() => handlePdf("download")}>
                    <FileDown className="h-4 w-4 mr-2" />PDF
                  </Button>
                  <Button type="button" variant="outline" disabled={pdfBusy} onClick={handleEmail}>
                    <Mail className="h-4 w-4 mr-2" />{t('contract.btn_email')}
                  </Button>
                  <DocumentVersions entityType="contract" entityId={Number(id)} freezeUrl={`/api/v1/contracts/${id}/freeze`} />
                </>
              )}
              {!isNew && (
                <Button type="button" variant="outline" className="text-red-600"
                  onClick={() => { if (confirm(t('contract.confirm_delete'))) deleteMutation.mutate({ id: Number(id) }); }}>
                  <Trash2 className="h-4 w-4 mr-2" />{t('common.delete')}
                </Button>
              )}
              <Button type="submit"><Save className="h-4 w-4 mr-2" />{t('common.save')}</Button>
            </div>
          </div>

          {/* Status bar */}
          {!isNew && contract && (
            <div className="border rounded-lg p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-blue-50/50">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium text-muted-foreground">{t('contract.status_label')}</span>
                <Badge className={statusColors[status] ?? ""}>{status}</Badge>
                {contract.sent_at && <span className="text-xs text-muted-foreground">{t('contract.sent_at_label', { date: formatDate(contract.sent_at) })}</span>}
                {contract.signed_at && <span className="text-xs text-muted-foreground">{t('contract.signed_at_label', { date: formatDate(contract.signed_at) })}</span>}
              </div>
              {fsmActions()}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 max-w-4xl">
            {/* E-signature */}
            {!isNew && contract && (
              <HomestaySignatureCard
                contextType="contract"
                contextId={Number(id)}
                entityType="contract"
                issuePath={`/api/v1/contracts/${id}/issue-signing`}
              />
            )}

            {/* General */}
            <div className="border rounded-lg bg-white p-4 sm:p-6">
              <h2 className="text-sm font-semibold uppercase text-primary tracking-wide mb-4">{t('contract.section_general')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{t('invoice.label_booking')}</Label>
                  <Controller name="booking_id" control={control} render={({ field }) => (
                    <LookupSelect
                      lookupUrl="/api/v1/lookup/bookings"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={t('contract.ph_search_bookings')}
                      displayValue={(contract as any)?.booking_ref ?? null}
                    />
                  )} />
                </div>
                <div>
                  <Label>{t('contract.label_product_package')}</Label>
                  <Controller name="product_id" control={control} render={({ field }) => (
                    <LookupSelect
                      lookupUrl="/api/v1/lookup/products"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={t('contract.ph_search_products')}
                      displayValue={(contract as any)?.product_name ?? (contract as any)?.contract_product_name ?? null}
                    />
                  )} />
                </div>
                <div>
                  <Label>{t('contract.label_space')}</Label>
                  <Controller name="space_id" control={control} render={({ field }) => (
                    <LookupSelect
                      lookupUrl="/api/v1/lookup/spaces"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={t('booking.placeholder_space')}
                      displayValue={(contract as any)?.space_name ?? null}
                    />
                  )} />
                </div>
              </div>
            </div>

            {/* Parties */}
            <div className="border rounded-lg bg-white p-4 sm:p-6">
              <h2 className="text-sm font-semibold uppercase text-primary tracking-wide mb-4">{t('contract.section_parties')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{t('contract.label_tenant')} *</Label>
                  <Controller name="tenant_account_id" control={control} render={({ field }) => (
                    <LookupSelect
                      lookupUrl="/api/v1/lookup/accounts"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={t('contract.ph_search_accounts')}
                      displayValue={(contract as any)?.tenant_name ?? null}
                    />
                  )} />
                </div>
                <div>
                  <Label>{t('contract.label_landlord')}</Label>
                  <Controller name="landlord_account_id" control={control} render={({ field }) => (
                    <LookupSelect
                      lookupUrl="/api/v1/lookup/accounts"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={t('contract.ph_search_accounts')}
                      displayValue={(contract as any)?.landlord_name ?? null}
                    />
                  )} />
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="border rounded-lg bg-white p-4 sm:p-6">
              <h2 className="text-sm font-semibold uppercase text-primary tracking-wide mb-4">{t('contract.section_financial')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{t('contract.label_start')}</Label>
                  <Controller name="start_date" control={control} render={({ field }) => (
                    <DateInput value={field.value ?? ""} onChange={field.onChange} />
                  )} />
                </div>
                <div>
                  <Label>{t('contract.label_end')}</Label>
                  <Controller name="end_date" control={control} render={({ field }) => (
                    <DateInput value={field.value ?? ""} onChange={field.onChange} />
                  )} />
                </div>
                <div>
                  <Label>{t('contract.label_currency')}</Label>
                  <Controller name="currency" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div>
                  <Label>{t('contract.label_weekly_rate')}</Label>
                  <Input {...register("weekly_rate")} type="number" step="0.01" min="0" />
                </div>
                <div>
                  <Label>{t('contract.label_total_rent')}</Label>
                  <Input {...register("total_rent")} type="number" step="0.01" min="0" />
                </div>
                <div>
                  <Label>{t('contract.label_bond')}</Label>
                  <Input {...register("bond_amount")} type="number" step="0.01" min="0" />
                </div>
                <div>
                  <Label>{t('contract.label_advance')}</Label>
                  <Input {...register("advance_amount")} type="number" step="0.01" min="0" />
                </div>
              </div>
            </div>

            {/* Document */}
            <div className="border rounded-lg bg-white p-4 sm:p-6">
              <h2 className="text-sm font-semibold uppercase text-primary tracking-wide mb-4">{t('contract.section_document')}</h2>
              <div className="space-y-4">
                <div>
                  <Label>{t('contract.label_document_url')}</Label>
                  <Input {...register("document_url")} placeholder="https://..." />
                </div>
                <div>
                  <Label>{t('contract.label_terms')}</Label>
                  <Textarea {...register("terms_text")} placeholder={t('contract.ph_terms')} rows={6} />
                </div>
                <div>
                  <Label>{t('contract.label_notes')}</Label>
                  <Textarea {...register("notes")} placeholder={t('contract.ph_notes')} rows={3} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Payment Schedule & Services Tabs */}
      {!isNew && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-8 space-y-4">
          <div className="flex border-b gap-1">
            {[
              { id: "line-items", label: `${t('contract.tab_line_items')}${lineItems.length ? ` (${lineItems.length})` : ""}`, icon: <List className="w-3.5 h-3.5" /> },
              { id: "schedule", label: `${t('contract.tab_schedule')}${schedules.length ? ` (${schedules.length})` : ""}`, icon: <CalendarDays className="w-3.5 h-3.5" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {activeTab === "line-items" && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium text-sm">{t('contract.line_items_title')}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('contract.line_items_desc')}</p>
                </div>
                <Button size="sm" variant="outline" onClick={openAddLine}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> {t('contract.btn_add_line')}
                </Button>
              </div>
              <div className="rounded-lg border bg-white overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {[t('common.type'), t('common.name'), t('contract.col_billing'), t('contract.col_frequency'), t('contract.col_unit_price'), t('contract.col_qty'), t('common.total'), t('contract.col_gst'), ""].map((h, hi) => (
                        <th key={hi} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!lineItems.length ? (
                      <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">{t('contract.no_line_items')}</td></tr>
                    ) : lineItems.map((item: any) => (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.item_type === "Rent" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                            {item.item_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">{item.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {item.billing_trigger === "recurring" ? t('contract.billing_recurring') : item.billing_trigger === "at_activation" ? t('contract.billing_onetime') : item.billing_trigger}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{item.billing_frequency ?? "—"}</td>
                        <td className="px-4 py-3 font-mono">{item.unit_price != null ? `$${Number(item.unit_price).toFixed(2)}` : "—"}</td>
                        <td className="px-4 py-3 text-center">{item.quantity ?? 1}</td>
                        <td className="px-4 py-3 font-mono font-medium">{item.total_price != null ? `$${Number(item.total_price).toFixed(2)}` : "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.gst_included ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                            {item.gst_included ? t('contract.gst_incl') : t('contract.gst_ex')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditLine(item)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => deleteLineMutation.mutate(item.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {lineItems.length > 0 && (
                    <tfoot className="bg-gray-50 border-t">
                      <tr>
                        <td colSpan={6} className="px-4 py-3 text-right font-medium text-sm text-muted-foreground">{t('contract.total_contract_value')}</td>
                        <td className="px-4 py-3 font-mono font-bold text-sm">
                          ${lineItems.reduce((sum: number, i: any) => sum + Number(i.total_price ?? 0), 0).toFixed(2)}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {activeTab === "schedule" && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-medium text-sm">{t('contract.tab_schedule')}</h4>
                <Button size="sm" variant="outline" onClick={openAddSched}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> {t('contract.btn_add_entry')}
                </Button>
              </div>
              <div className="rounded-lg border bg-white overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {[t('common.type'), t('common.amount'), t('contract.label_currency'), t('contract.label_start'), t('contract.label_end'), t('contract.col_next_due'), t('contract.col_frequency'), t('contract.col_gst'), t('common.active'), ""].map((h, hi) => (
                        <th key={hi} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!schedules.length ? (
                      <tr><td colSpan={10} className="text-center py-10 text-muted-foreground">{t('contract.no_schedule')}</td></tr>
                    ) : schedules.map((s: any) => (
                      <tr key={s.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{s.schedule_type ?? "Rent"}</td>
                        <td className="px-4 py-3 font-mono">{s.amount != null ? `$${Number(s.amount).toFixed(2)}` : "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{s.currency ?? "AUD"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{s.start_date ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{s.end_date ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{s.next_due_date ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{s.frequency ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.gst_included ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                            {s.gst_included ? t('contract.gst_incl') : t('contract.gst_ex')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                            {s.is_active ? t('common.active') : t('common.inactive')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditSched(s)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => deleteSchedMutation.mutate(s.id)}>
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

        </div>
      )}

      {/* Terminate Dialog */}
      <Dialog open={terminateOpen} onOpenChange={setTerminateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('contract.btn_terminate')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>{t('contract.label_termination_reason')} *</Label>
            <Textarea
              value={terminateReason}
              onChange={e => setTerminateReason(e.target.value)}
              placeholder={t('contract.ph_termination_reason')}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTerminateOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="destructive" disabled={!terminateReason}
              onClick={() => terminateMutation.mutate({ id: Number(id), data: { termination_reason: terminateReason } })}>
              {t('contract.btn_terminate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sign Dialog */}
      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('contract.btn_sign')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>{t('contract.label_signed_doc_url')}</Label>
            <Input
              value={signDocUrl}
              onChange={e => setSignDocUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignOpen(false)}>{t('common.cancel')}</Button>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => signMutation.mutate({ id: Number(id), data: { document_url: signDocUrl || null } })}>
              {t('contract.btn_confirm_signed')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Line Item Dialog */}
      <Dialog open={lineDialogOpen} onOpenChange={(open) => { if (!open) { setLineDialogOpen(false); resetLineForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{lineEditItem ? t('contract.dlg_edit_line') : t('contract.dlg_add_line')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('common.type')}</Label>
                <Select value={lineItemType} onValueChange={setLineItemType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      { v: "Rent", l: t('contract.item_type_rent') },
                      { v: "Service", l: t('contract.item_type_service') },
                      { v: "Bond", l: t('contract.item_type_bond') },
                      { v: "Admin Fee", l: t('contract.item_type_admin_fee') },
                      { v: "Other", l: t('contract.item_type_other') },
                    ].map(o => (
                      <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('contract.col_billing')}</Label>
                <Select value={lineTrigger} onValueChange={v => { setLineTrigger(v); if (v !== "recurring") setLineFreq(""); }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recurring">{t('contract.billing_recurring')}</SelectItem>
                    <SelectItem value="at_activation">{t('contract.billing_onetime_full')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t('common.name')} *</Label>
              <Input value={lineName} onChange={e => setLineName(e.target.value)} placeholder={t('contract.ph_line_name')} className="mt-1" />
            </div>
            {lineTrigger === "recurring" && (
              <div>
                <Label>{t('contract.col_frequency')}</Label>
                <Select value={lineFreq} onValueChange={setLineFreq}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t('contract.ph_select_frequency')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Weekly">{t('contract.freq_weekly')}</SelectItem>
                    <SelectItem value="Biweekly">{t('contract.freq_fortnightly')}</SelectItem>
                    <SelectItem value="Monthly">{t('contract.freq_monthly')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label>{t('contract.col_unit_price')} *</Label>
                <Input type="number" step="0.01" min="0" value={lineUnitPrice} onChange={e => setLineUnitPrice(e.target.value)} placeholder="0.00" className="mt-1" />
              </div>
              <div>
                <Label>{t('contract.col_qty')}</Label>
                <Input type="number" min="1" value={lineQty} onChange={e => setLineQty(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('contract.label_currency')}</Label>
                <Select value={lineCurrency} onValueChange={setLineCurrency}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={lineGst} onChange={e => setLineGst(e.target.checked)} className="rounded" />
                  {t('contract.gst_included')}
                </label>
              </div>
            </div>
            <div>
              <Label>{t('common.notes')}</Label>
              <Input value={lineNotes} onChange={e => setLineNotes(e.target.value)} placeholder={t('contract.ph_optional_notes')} className="mt-1" />
            </div>
            {lineUnitPrice && lineQty && (
              <div className="bg-gray-50 rounded p-3 text-sm">
                <span className="text-muted-foreground">{t('common.total')}: </span>
                <span className="font-mono font-bold">${(Number(lineUnitPrice) * Number(lineQty)).toFixed(2)} {lineCurrency}</span>
                {lineTrigger === "recurring" && lineFreq && <span className="text-muted-foreground ml-2">{t('contract.per_period', { period: lineFreq.toLowerCase() })}</span>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLineDialogOpen(false); resetLineForm(); }}>{t('common.cancel')}</Button>
            <Button
              className="bg-primary hover:bg-[#d4561a] text-white"
              disabled={!lineName || !lineUnitPrice || addLineMutation.isPending || updateLineMutation.isPending}
              onClick={submitLineForm}
            >
              {lineEditItem ? t('contract.btn_save_changes') : t('contract.dlg_add_line')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Payment Schedule Dialog */}
      <Dialog open={schedDialogOpen} onOpenChange={(open) => { if (!open) { setSchedDialogOpen(false); resetSchedForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{schedEditItem ? t('contract.dlg_edit_sched') : t('contract.dlg_add_sched')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('common.type')}</Label>
                <Select value={schedType} onValueChange={setSchedType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      { v: "Rent", l: t('contract.item_type_rent') },
                      { v: "Bond", l: t('contract.item_type_bond') },
                      { v: "Advance", l: t('contract.sched_type_advance') },
                      { v: "Water", l: t('contract.sched_type_water') },
                      { v: "Electricity", l: t('contract.sched_type_electricity') },
                      { v: "Gas", l: t('contract.sched_type_gas') },
                      { v: "Internet", l: t('contract.sched_type_internet') },
                      { v: "Parking", l: t('contract.sched_type_parking') },
                      { v: "Other", l: t('contract.item_type_other') },
                    ].map(o => (
                      <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('contract.col_frequency')}</Label>
                <Select value={schedFreq} onValueChange={setSchedFreq}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Weekly">{t('contract.freq_weekly')}</SelectItem>
                    <SelectItem value="Biweekly">{t('contract.freq_fortnightly')}</SelectItem>
                    <SelectItem value="Monthly">{t('contract.freq_monthly')}</SelectItem>
                    <SelectItem value="Quarterly">{t('contract.freq_quarterly')}</SelectItem>
                    <SelectItem value="Once">{t('contract.freq_once')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('common.amount')} *</Label>
                <Input type="number" step="0.01" min="0" value={schedAmount} onChange={e => setSchedAmount(e.target.value)} placeholder="0.00" className="mt-1" />
              </div>
              <div>
                <Label>{t('contract.label_currency')}</Label>
                <Select value={schedCurrency} onValueChange={setSchedCurrency}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('contract.label_start')} *</Label>
                <DateInput value={schedStartDate} onChange={setSchedStartDate} className="mt-1" />
              </div>
              <div>
                <Label>{t('contract.label_end')}</Label>
                <DateInput value={schedEndDate} onChange={setSchedEndDate} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>{t('contract.col_next_due')} *</Label>
              <DateInput value={schedNextDue} onChange={setSchedNextDue} className="mt-1" />
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={schedGst} onChange={e => setSchedGst(e.target.checked)} className="rounded" />
                {t('contract.gst_included')}
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={schedActive} onChange={e => setSchedActive(e.target.checked)} className="rounded" />
                {t('common.active')}
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSchedDialogOpen(false); resetSchedForm(); }}>{t('common.cancel')}</Button>
            <Button
              className="bg-primary hover:bg-[#d4561a] text-white"
              disabled={!schedAmount || !schedStartDate || addSchedMutation.isPending || updateSchedMutation.isPending}
              onClick={submitSchedForm}
            >
              {schedEditItem ? t('contract.btn_save_changes') : t('contract.btn_add_entry')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

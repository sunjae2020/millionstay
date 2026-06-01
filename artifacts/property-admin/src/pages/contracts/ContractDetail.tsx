import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
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
    query: { enabled: !isNew },
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
        title: "PDF unavailable",
        description: err instanceof Error ? err.message : "Failed to generate document.",
        variant: "destructive",
      });
    } finally {
      setPdfBusy(false);
    }
  };

  const handleEmail = async () => {
    if (!window.confirm("Email this agreement (PDF) to the tenant?")) return;
    setPdfBusy(true);
    try {
      const res = await apiFetch(`/api/v1/contracts/${id}/email`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      toast({ title: "Email sent", description: `Agreement emailed to ${body?.to ?? "recipient"}.` });
      refetch();
    } catch (err) {
      toast({ title: "Email failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setPdfBusy(false);
    }
  };

  const fsmActions = () => {
    if (isNew) return null;
    return (
      <div className="flex gap-2">
        {status === "Draft" && (
          <Button type="button" size="sm" className="bg-[#E8621A] hover:bg-[#d4561a] text-white"
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
            Mark Expired
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
              {!isNew && <p className="text-sm text-muted-foreground">Contract #{id}</p>}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button type="button" variant="outline" onClick={() => navigate("/contracts/contracts")}>
                <ArrowLeft className="h-4 w-4 mr-2" />{t('common.back')}
              </Button>
              {!isNew && (
                <>
                  <Button type="button" variant="outline" disabled={pdfBusy} onClick={() => handlePdf("preview")}>
                    <Eye className="h-4 w-4 mr-2" />Preview
                  </Button>
                  <Button type="button" variant="outline" disabled={pdfBusy} onClick={() => handlePdf("download")}>
                    <FileDown className="h-4 w-4 mr-2" />PDF
                  </Button>
                  <Button type="button" variant="outline" disabled={pdfBusy} onClick={handleEmail}>
                    <Mail className="h-4 w-4 mr-2" />Email
                  </Button>
                </>
              )}
              {!isNew && (
                <Button type="button" variant="outline" className="text-red-600"
                  onClick={() => { if (confirm("Delete this contract?")) deleteMutation.mutate({ id: Number(id) }); }}>
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
                <span className="text-sm font-medium text-muted-foreground">Status:</span>
                <Badge className={statusColors[status] ?? ""}>{status}</Badge>
                {contract.sent_at && <span className="text-xs text-muted-foreground">Sent: {new Date(contract.sent_at).toLocaleDateString()}</span>}
                {contract.signed_at && <span className="text-xs text-muted-foreground">Signed: {new Date(contract.signed_at).toLocaleDateString()}</span>}
              </div>
              {fsmActions()}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 max-w-4xl">
            {/* General */}
            <div className="border rounded-lg bg-white p-4 sm:p-6">
              <h2 className="text-sm font-semibold uppercase text-[#E8621A] tracking-wide mb-4">{t('contract.section_general')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{t('invoice.label_booking')}</Label>
                  <Controller name="booking_id" control={control} render={({ field }) => (
                    <LookupSelect
                      lookupUrl="/api/v1/lookup/bookings"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Search bookings..."
                      displayValue={(contract as any)?.booking_ref ?? null}
                    />
                  )} />
                </div>
                <div>
                  <Label>Product / Accommodation Package</Label>
                  <Controller name="product_id" control={control} render={({ field }) => (
                    <LookupSelect
                      lookupUrl="/api/v1/lookup/products"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Search products..."
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
                      placeholder="Search spaces..."
                      displayValue={(contract as any)?.space_name ?? null}
                    />
                  )} />
                </div>
              </div>
            </div>

            {/* Parties */}
            <div className="border rounded-lg bg-white p-4 sm:p-6">
              <h2 className="text-sm font-semibold uppercase text-[#E8621A] tracking-wide mb-4">{t('contract.section_parties')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{t('contract.label_tenant')} *</Label>
                  <Controller name="tenant_account_id" control={control} render={({ field }) => (
                    <LookupSelect
                      lookupUrl="/api/v1/lookup/accounts"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Search accounts..."
                      displayValue={(contract as any)?.tenant_name ?? null}
                    />
                  )} />
                </div>
                <div>
                  <Label>Landlord Account</Label>
                  <Controller name="landlord_account_id" control={control} render={({ field }) => (
                    <LookupSelect
                      lookupUrl="/api/v1/lookup/accounts"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Search accounts..."
                      displayValue={(contract as any)?.landlord_name ?? null}
                    />
                  )} />
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="border rounded-lg bg-white p-4 sm:p-6">
              <h2 className="text-sm font-semibold uppercase text-[#E8621A] tracking-wide mb-4">{t('contract.section_financial')}</h2>
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
                  <Label>Bond Amount</Label>
                  <Input {...register("bond_amount")} type="number" step="0.01" min="0" />
                </div>
                <div>
                  <Label>Advance Amount</Label>
                  <Input {...register("advance_amount")} type="number" step="0.01" min="0" />
                </div>
              </div>
            </div>

            {/* Document */}
            <div className="border rounded-lg bg-white p-4 sm:p-6">
              <h2 className="text-sm font-semibold uppercase text-[#E8621A] tracking-wide mb-4">Document & Terms</h2>
              <div className="space-y-4">
                <div>
                  <Label>Document URL (Signed Copy)</Label>
                  <Input {...register("document_url")} placeholder="https://..." />
                </div>
                <div>
                  <Label>Contract Terms</Label>
                  <Textarea {...register("terms_text")} placeholder="Enter contract terms and conditions..." rows={6} />
                </div>
                <div>
                  <Label>{t('contract.label_notes')}</Label>
                  <Textarea {...register("notes")} placeholder="Internal notes..." rows={3} />
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
              { id: "line-items", label: `Contract Lines${lineItems.length ? ` (${lineItems.length})` : ""}`, icon: <List className="w-3.5 h-3.5" /> },
              { id: "schedule", label: `Payment Schedule${schedules.length ? ` (${schedules.length})` : ""}`, icon: <CalendarDays className="w-3.5 h-3.5" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? "border-[#E8621A] text-[#E8621A]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {activeTab === "line-items" && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium text-sm">Contract Line Items</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">All billing lines — rent and services. Used to generate invoices on activation.</p>
                </div>
                <Button size="sm" variant="outline" onClick={openAddLine}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Line
                </Button>
              </div>
              <div className="rounded-lg border bg-white overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {["Type", "Name", "Billing", "Frequency", "Unit Price", "Qty", "Total", "GST", ""].map((h) => (
                        <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!lineItems.length ? (
                      <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">No line items yet. Activate contract to auto-generate from booking services.</td></tr>
                    ) : lineItems.map((item: any) => (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.item_type === "Rent" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                            {item.item_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">{item.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {item.billing_trigger === "recurring" ? "Recurring" : item.billing_trigger === "at_activation" ? "One-time" : item.billing_trigger}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{item.billing_frequency ?? "—"}</td>
                        <td className="px-4 py-3 font-mono">{item.unit_price != null ? `$${Number(item.unit_price).toFixed(2)}` : "—"}</td>
                        <td className="px-4 py-3 text-center">{item.quantity ?? 1}</td>
                        <td className="px-4 py-3 font-mono font-medium">{item.total_price != null ? `$${Number(item.total_price).toFixed(2)}` : "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.gst_included ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                            {item.gst_included ? "GST incl." : "Ex GST"}
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
                        <td colSpan={6} className="px-4 py-3 text-right font-medium text-sm text-muted-foreground">Total Contract Value</td>
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
                <h4 className="font-medium text-sm">Payment Schedule</h4>
                <Button size="sm" variant="outline" onClick={openAddSched}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Entry
                </Button>
              </div>
              <div className="rounded-lg border bg-white overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {["Type", "Amount", "Currency", "Start Date", "End Date", "Next Due Date", "Frequency", "GST", "Active", ""].map((h) => (
                        <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!schedules.length ? (
                      <tr><td colSpan={10} className="text-center py-10 text-muted-foreground">No payment schedule entries yet</td></tr>
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
                            {s.gst_included ? "GST incl." : "Ex GST"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                            {s.is_active ? "Active" : "Inactive"}
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
            <Label>Termination Reason *</Label>
            <Textarea
              value={terminateReason}
              onChange={e => setTerminateReason(e.target.value)}
              placeholder="Reason for termination..."
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
            <Label>Signed Document URL (Optional)</Label>
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
              Confirm Signed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Line Item Dialog */}
      <Dialog open={lineDialogOpen} onOpenChange={(open) => { if (!open) { setLineDialogOpen(false); resetLineForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{lineEditItem ? "Edit Line Item" : "Add Line Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={lineItemType} onValueChange={setLineItemType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Rent", "Service", "Bond", "Admin Fee", "Other"].map(v => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Billing</Label>
                <Select value={lineTrigger} onValueChange={v => { setLineTrigger(v); if (v !== "recurring") setLineFreq(""); }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recurring">Recurring</SelectItem>
                    <SelectItem value="at_activation">One-time (at activation)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Name *</Label>
              <Input value={lineName} onChange={e => setLineName(e.target.value)} placeholder="e.g. Cleaning Fee, Airport Pickup..." className="mt-1" />
            </div>
            {lineTrigger === "recurring" && (
              <div>
                <Label>Frequency</Label>
                <Select value={lineFreq} onValueChange={setLineFreq}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select frequency" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Biweekly">Fortnightly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label>Unit Price *</Label>
                <Input type="number" step="0.01" min="0" value={lineUnitPrice} onChange={e => setLineUnitPrice(e.target.value)} placeholder="0.00" className="mt-1" />
              </div>
              <div>
                <Label>Qty</Label>
                <Input type="number" min="1" value={lineQty} onChange={e => setLineQty(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Currency</Label>
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
                  GST Included
                </label>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={lineNotes} onChange={e => setLineNotes(e.target.value)} placeholder="Optional notes..." className="mt-1" />
            </div>
            {lineUnitPrice && lineQty && (
              <div className="bg-gray-50 rounded p-3 text-sm">
                <span className="text-muted-foreground">Total: </span>
                <span className="font-mono font-bold">${(Number(lineUnitPrice) * Number(lineQty)).toFixed(2)} {lineCurrency}</span>
                {lineTrigger === "recurring" && lineFreq && <span className="text-muted-foreground ml-2">per {lineFreq.toLowerCase()} period</span>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLineDialogOpen(false); resetLineForm(); }}>Cancel</Button>
            <Button
              className="bg-[#E8621A] hover:bg-[#d4561a] text-white"
              disabled={!lineName || !lineUnitPrice || addLineMutation.isPending || updateLineMutation.isPending}
              onClick={submitLineForm}
            >
              {lineEditItem ? "Save Changes" : "Add Line Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Payment Schedule Dialog */}
      <Dialog open={schedDialogOpen} onOpenChange={(open) => { if (!open) { setSchedDialogOpen(false); resetSchedForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{schedEditItem ? "Edit Payment Schedule Entry" : "Add Payment Schedule Entry"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={schedType} onValueChange={setSchedType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Rent", "Bond", "Advance", "Water", "Electricity", "Gas", "Internet", "Parking", "Other"].map(v => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Frequency</Label>
                <Select value={schedFreq} onValueChange={setSchedFreq}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Biweekly">Fortnightly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                    <SelectItem value="Once">Once</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount *</Label>
                <Input type="number" step="0.01" min="0" value={schedAmount} onChange={e => setSchedAmount(e.target.value)} placeholder="0.00" className="mt-1" />
              </div>
              <div>
                <Label>Currency</Label>
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
                <Label>Start Date *</Label>
                <Input type="date" value={schedStartDate} onChange={e => setSchedStartDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={schedEndDate} onChange={e => setSchedEndDate(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Next Due Date *</Label>
              <Input type="date" value={schedNextDue} onChange={e => setSchedNextDue(e.target.value)} className="mt-1" />
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={schedGst} onChange={e => setSchedGst(e.target.checked)} className="rounded" />
                GST Included
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={schedActive} onChange={e => setSchedActive(e.target.checked)} className="rounded" />
                Active
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSchedDialogOpen(false); resetSchedForm(); }}>Cancel</Button>
            <Button
              className="bg-[#E8621A] hover:bg-[#d4561a] text-white"
              disabled={!schedAmount || !schedStartDate || addSchedMutation.isPending || updateSchedMutation.isPending}
              onClick={submitSchedForm}
            >
              {schedEditItem ? "Save Changes" : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

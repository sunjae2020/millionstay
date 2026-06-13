import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { formatDate } from "@/lib/date";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetInvoice,
  useCreateInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
  useSendInvoice,
  usePayInvoice,
  useVoidInvoice,
  getGetInvoiceQueryKey,
  getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { LookupSelect } from "@/components/LookupSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Trash2, Save, FileDown, Eye, Mail } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { DocumentVersions } from "@/components/DocumentVersions";

const statusColors: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600",
  Sent: "bg-blue-100 text-blue-700",
  Paid: "bg-green-100 text-green-700",
  Void: "bg-red-100 text-red-600",
};

interface FormData {
  booking_id: number | null;
  contract_id: number | null;
  account_id: number | null;
  amount: string;
  currency: string;
  due_date: string;
  description: string;
  notes: string;
}

export default function InvoiceDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const isNew = id === "new";

  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState("BankTransfer");
  const [pdfBusy, setPdfBusy] = useState(false);
  const { toast } = useToast();

  // Generate the branded PDF, then either download it or open a preview tab.
  const handlePdf = async (mode: "download" | "preview") => {
    setPdfBusy(true);
    try {
      const path = mode === "preview"
        ? `/api/v1/invoices/${id}/pdf?format=html`
        : `/api/v1/invoices/${id}/pdf`;
      const res = await apiFetch(path);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (mode === "preview") {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${invoice?.invoice_ref ?? "invoice"}.pdf`;
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

  // Email the branded invoice PDF to the billing account.
  const handleEmail = async () => {
    if (!window.confirm("Email this invoice (PDF) to the linked account?")) return;
    setPdfBusy(true);
    try {
      const res = await apiFetch(`/api/v1/invoices/${id}/email`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      toast({ title: "Email sent", description: `Invoice emailed to ${body?.to ?? "recipient"}.` });
      refetch();
    } catch (err) {
      toast({ title: "Email failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setPdfBusy(false);
    }
  };

  const { data: invoice, refetch } = useGetInvoice(Number(id), {
    query: { enabled: !isNew, queryKey: getGetInvoiceQueryKey(Number(id)) },
  });

  const { register, handleSubmit, reset, control } = useForm<FormData>({
    defaultValues: {
      booking_id: null, contract_id: null, account_id: null,
      amount: "", currency: "AUD", due_date: "", description: "", notes: "",
    },
  });

  useEffect(() => {
    if (invoice) {
      reset({
        booking_id: invoice.booking_id ?? null,
        contract_id: invoice.contract_id ?? null,
        account_id: invoice.account_id ?? null,
        amount: invoice.amount != null ? String(invoice.amount) : "",
        currency: invoice.currency ?? "AUD",
        due_date: invoice.due_date ?? "",
        description: invoice.description ?? "",
        notes: invoice.notes ?? "",
      });
    }
  }, [invoice, reset]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
    if (!isNew) qc.invalidateQueries({ queryKey: getGetInvoiceQueryKey(Number(id)) });
  };

  const createMutation = useCreateInvoice({ mutation: { onSuccess: (d) => { invalidate(); navigate(`/finance/invoices/${d.id}`); } } });
  const updateMutation = useUpdateInvoice({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const sendMutation = useSendInvoice({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const payMutation = usePayInvoice({ mutation: { onSuccess: () => { invalidate(); refetch(); setPayOpen(false); } } });
  const voidMutation = useVoidInvoice({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const deleteMutation = useDeleteInvoice({ mutation: { onSuccess: () => { invalidate(); navigate("/finance/invoices"); } } });

  const buildPayload = (data: FormData) => ({
    booking_id: data.booking_id ?? null,
    contract_id: data.contract_id ?? null,
    account_id: data.account_id ?? null,
    amount: data.amount ? Number(data.amount) : 0,
    currency: data.currency || "AUD",
    due_date: data.due_date || null,
    description: data.description || null,
    notes: data.notes || null,
  });

  const onSubmit = (data: FormData) => {
    if (isNew) createMutation.mutate({ data: buildPayload(data) });
    else updateMutation.mutate({ id: Number(id), data: buildPayload(data) });
  };

  const status = invoice?.status ?? "Draft";

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {isNew ? t('invoice.new') : invoice?.invoice_ref ?? "Invoice"}
            </h1>
            {!isNew && <p className="text-sm text-muted-foreground">Invoice #{id}</p>}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => navigate("/finance/invoices")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> {t('common.back')}
            </Button>
            {!isNew && (
              <>
                <Button variant="outline" disabled={pdfBusy} onClick={() => handlePdf("preview")}>
                  <Eye className="h-4 w-4 mr-1" /> Preview
                </Button>
                <Button variant="outline" disabled={pdfBusy} onClick={() => handlePdf("download")}>
                  <FileDown className="h-4 w-4 mr-1" /> PDF
                </Button>
                <Button variant="outline" disabled={pdfBusy} onClick={handleEmail}>
                  <Mail className="h-4 w-4 mr-1" /> Email
                </Button>
                <DocumentVersions entityType="invoice" entityId={Number(id)} freezeUrl={`/api/v1/invoices/${id}/freeze`} />
              </>
            )}
            {!isNew && (
              <Button variant="destructive" onClick={() => deleteMutation.mutate({ id: Number(id) })}>
                <Trash2 className="h-4 w-4 mr-1" /> {t('common.delete')}
              </Button>
            )}
            <Button onClick={handleSubmit(onSubmit)}>
              <Save className="h-4 w-4 mr-1" /> {t('common.save')}
            </Button>
          </div>
        </div>

        {/* FSM Actions */}
        {!isNew && (
          <div className="border rounded-lg bg-white p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Status:</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[status] ?? "bg-gray-100 text-gray-600"}`}>
                {status}
              </span>
            </div>
            <div className="flex gap-2 sm:ml-auto flex-wrap">
              {status === "Draft" && (
                <Button variant="default" onClick={() => sendMutation.mutate({ id: Number(id) })}>
                  {t('invoice.btn_send')}
                </Button>
              )}
              {status === "Sent" && (
                <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => setPayOpen(true)}>
                  {t('invoice.btn_mark_paid')}
                </Button>
              )}
              {(status === "Draft" || status === "Sent") && (
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => voidMutation.mutate({ id: Number(id) })}>
                  {t('invoice.btn_void')}
                </Button>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Links */}
          <div className="border rounded-lg bg-white p-4 sm:p-6">
            <h2 className="text-sm font-semibold uppercase text-[#E8621A] tracking-wide mb-4">Links</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>{t('invoice.label_booking')}</Label>
                <Controller name="booking_id" control={control} render={({ field }) => (
                  <LookupSelect
                    lookupUrl="/api/v1/lookup/bookings"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Search bookings..."
                    displayValue={(invoice as any)?.booking_ref ?? null}
                  />
                )} />
              </div>
              <div>
                <Label>{t('invoice.label_contract')}</Label>
                <Controller name="contract_id" control={control} render={({ field }) => (
                  <LookupSelect
                    lookupUrl="/api/v1/lookup/contracts"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Search contracts..."
                    displayValue={(invoice as any)?.contract_ref ?? null}
                  />
                )} />
              </div>
              <div>
                <Label>{t('invoice.label_account')}</Label>
                <Controller name="account_id" control={control} render={({ field }) => (
                  <LookupSelect
                    lookupUrl="/api/v1/lookup/accounts"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Search accounts..."
                    displayValue={(invoice as any)?.account_name ?? null}
                  />
                )} />
              </div>
            </div>
          </div>

          {/* Financials */}
          <div className="border rounded-lg bg-white p-4 sm:p-6">
            <h2 className="text-sm font-semibold uppercase text-[#E8621A] tracking-wide mb-4">{t('invoice.section_general')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>{t('common.amount')} *</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register("amount")} />
              </div>
              <div>
                <Label>{t('invoice.label_currency')}</Label>
                <Controller name="currency" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUD">AUD</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="SGD">SGD</SelectItem>
                      <SelectItem value="NZD">NZD</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div>
                <Label>{t('invoice.label_due_date')}</Label>
                <Controller name="due_date" control={control} render={({ field }) => (
                  <DateInput value={field.value ?? ""} onChange={field.onChange} />
                )} />
              </div>
            </div>
          </div>

          {/* Paid info (read-only) */}
          {invoice?.status === "Paid" && (
            <div className="border rounded-lg bg-green-50 p-6">
              <h2 className="text-sm font-semibold uppercase text-green-600 tracking-wide mb-4">{t('invoice.section_payment')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('invoice.col_payment_method')}:</span>
                  <p className="font-medium mt-1">{invoice.payment_method ?? "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('invoice.col_payment_date')}:</span>
                  <p className="font-medium mt-1">{invoice.paid_at ? formatDate(invoice.paid_at) : "—"}</p>
                </div>
              </div>
            </div>
          )}

          {/* Description + Notes */}
          <div className="border rounded-lg bg-white p-4 sm:p-6">
            <h2 className="text-sm font-semibold uppercase text-[#E8621A] tracking-wide mb-4">Details</h2>
            <div className="space-y-4">
              <div>
                <Label>{t('invoice.label_item_desc')}</Label>
                <Input placeholder="Invoice description..." {...register("description")} />
              </div>
              <div>
                <Label>{t('invoice.label_notes')}</Label>
                <Textarea rows={3} placeholder="Internal notes..." {...register("notes")} />
              </div>
            </div>
          </div>
        </form>

        {/* Mark Paid Dialog */}
        <Dialog open={payOpen} onOpenChange={setPayOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('invoice.add_payment_title')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>{t('invoice.label_payment_method')}</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BankTransfer">Bank Transfer</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="CreditCard">Credit Card</SelectItem>
                    <SelectItem value="Stripe">Stripe</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayOpen(false)}>{t('common.cancel')}</Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => payMutation.mutate({ id: Number(id), data: { payment_method: payMethod } })}
              >
                Confirm Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

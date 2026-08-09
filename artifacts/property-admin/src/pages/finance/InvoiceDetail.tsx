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
import { AccountLookupSelect } from "@/components/AccountLookupSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useBrand } from "@/contexts/ThemeContext";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { ArrowLeft, Trash2, Save, FileText, Layers } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { DocumentVersions } from "@/components/DocumentVersions";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";

const statusColors: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600",
  Sent: "bg-blue-100 text-blue-700",
  Paid: "bg-green-100 text-green-700",
  Void: "bg-red-100 text-red-600",
};

/** 통합 청구서 한 줄(호실·기간·금액) — GET /v1/invoices/:id 의 line_items. */
interface ConsolidatedLine {
  id: number;
  label: string;
  description?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  total_amount?: string | number | null;
}

/** 통합 청구서에 묶인 공간별 인보이스 요약. */
interface ConsolidatedChild {
  id: number;
  invoice_ref: string;
  amount?: string | number | null;
}

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
  const { currency: brandCurrency } = useBrand();
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const isNew = !id || id === "new";

  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState("BankTransfer");
  const [pdfBusy, setPdfBusy] = useState(false);
  const { toast } = useToast();
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();

  // Email the branded invoice PDF to the billing account.
  const handleEmail = async (to: string[]) => {
    setPdfBusy(true);
    try {
      const res = await apiFetch(`/api/v1/invoices/${id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      toast({ title: t('invoice.email_sent'), description: t('invoice.email_sent_desc', { to: to.join(", ") }) });
      refetch();
    } catch (err) {
      toast({ title: t('invoice.email_failed'), description: err instanceof Error ? err.message : t('invoice.error'), variant: "destructive" });
      throw err;
    } finally {
      setPdfBusy(false);
    }
  };

  const handleCheckout = async () => {
    setPdfBusy(true);
    try {
      const res = await apiFetch(`/api/v1/invoices/${id}/checkout`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      if (body?.url) {
        await navigator.clipboard?.writeText(body.url).catch(() => {});
        window.open(body.url, "_blank", "noopener,noreferrer");
        toast({ title: t('invoice.pay_link_created'), description: t('invoice.pay_link_created_desc') });
      }
      refetch();
    } catch (err) {
      toast({ title: t('invoice.pay_link_failed'), description: err instanceof Error ? err.message : t('invoice.error'), variant: "destructive" });
    } finally {
      setPdfBusy(false);
    }
  };

  const { data: invoice, refetch } = useGetInvoice(Number(id), {
    query: { enabled: !isNew, queryKey: getGetInvoiceQueryKey(Number(id)) },
  });

  // 통합(단체) 청구서 상세 — 호실별 라인과 묶여 있는 공간별 인보이스.
  // 두 필드 모두 GET /v1/invoices/:id 가 함께 내려주므로 추가 요청이 없다.
  const isConsolidated = (invoice as any)?.invoice_kind === "consolidated";
  const lineItems: ConsolidatedLine[] = ((invoice as any)?.line_items ?? []) as ConsolidatedLine[];
  const children: ConsolidatedChild[] = ((invoice as any)?.children ?? []) as ConsolidatedChild[];

  const { register, handleSubmit, reset, control } = useForm<FormData>({
    defaultValues: {
      booking_id: null, contract_id: null, account_id: null,
      amount: "", currency: brandCurrency, due_date: "", description: "", notes: "",
    },
  });

  useEffect(() => {
    if (invoice) {
      reset({
        booking_id: invoice.booking_id ?? null,
        contract_id: invoice.contract_id ?? null,
        account_id: invoice.account_id ?? null,
        amount: invoice.amount != null ? String(invoice.amount) : "",
        currency: invoice.currency ?? brandCurrency,
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
    currency: data.currency || brandCurrency,
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
              {isNew ? t('invoice.new') : invoice?.invoice_ref ?? t('invoice.title')}
            </h1>
            {!isNew && <p className="text-sm text-muted-foreground">{t('invoice.number', { id })}</p>}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => navigate("/finance/invoices")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> {t('common.back')}
            </Button>
            {!isNew && (
              <>
                <Button
                  variant="outline"
                  disabled={pdfBusy}
                  onClick={() => openPreview({
                    title: invoice?.invoice_ref ?? t('invoice.title'),
                    filename: `${invoice?.invoice_ref ?? "invoice"}.pdf`,
                    source: { kind: "api", path: `/api/v1/invoices/${id}/pdf` },
                    email: {
                      recipientsPath: `/api/v1/invoices/${id}/email-recipients`,
                      send: handleEmail,
                    },
                    emailLabel: t('invoice.btn_email'),
                  })}
                >
                  <FileText className="h-4 w-4 mr-1" /> {t('invoice.btn_preview')}
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
              <span className="text-sm font-medium text-muted-foreground">{t('common.status')}:</span>
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
                <Button variant="outline" disabled={pdfBusy} onClick={handleCheckout}>
                  {t('invoice.btn_collect_payment')}
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
            <h2 className="text-sm font-semibold uppercase text-primary tracking-wide mb-4">{t('invoice.section_links')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>{t('invoice.label_booking')}</Label>
                <Controller name="booking_id" control={control} render={({ field }) => (
                  <LookupSelect
                    lookupUrl="/api/v1/lookup/bookings"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t('invoice.placeholder_booking')}
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
                    placeholder={t('invoice.placeholder_contract')}
                    displayValue={(invoice as any)?.contract_ref ?? null}
                  />
                )} />
              </div>
              <div>
                <Label>{t('invoice.label_account')}</Label>
                <Controller name="account_id" control={control} render={({ field }) => (
                  <AccountLookupSelect
                    lookupUrl="/api/v1/lookup/accounts"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t('invoice.placeholder_account')}
                    displayValue={(invoice as any)?.account_name ?? null}
                  />
                )} />
              </div>
            </div>
          </div>

          {/* Financials */}
          <div className="border rounded-lg bg-white p-4 sm:p-6">
            <h2 className="text-sm font-semibold uppercase text-primary tracking-wide mb-4">{t('invoice.section_general')}</h2>
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
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                      ))}
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
            <h2 className="text-sm font-semibold uppercase text-primary tracking-wide mb-4">{t('invoice.section_details')}</h2>
            <div className="space-y-4">
              <div>
                <Label>{t('invoice.label_item_desc')}</Label>
                <Input placeholder={t('invoice.placeholder_description')} {...register("description")} />
              </div>
              <div>
                <Label>{t('invoice.label_notes')}</Label>
                <Textarea rows={3} placeholder={t('invoice.placeholder_notes')} {...register("notes")} />
              </div>
            </div>
          </div>

          {/* 통합(단체) 청구서 — 호실별 내역과 묶여 있는 공간별 인보이스 */}
          {isConsolidated && (
            <div className="border rounded-lg bg-white p-4 sm:p-6 space-y-6">
              <div>
                <h2 className="text-sm font-semibold uppercase text-primary tracking-wide mb-1 flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  {t('invoice.section_consolidated')}
                </h2>
                <p className="text-xs text-muted-foreground mb-4">
                  {t('invoice.consolidated_hint', { period: (invoice as any)?.billing_period ?? "—" })}
                </p>
                <div className="overflow-x-auto border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground font-medium">{t('invoice.col_line_label')}</th>
                        <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground font-medium">{t('invoice.col_line_period')}</th>
                        <th className="text-right px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground font-medium">{t('common.amount')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {lineItems.map((li) => (
                        <tr key={li.id}>
                          <td className="px-4 py-2.5">
                            {li.label}
                            {li.description && <div className="text-xs text-muted-foreground mt-0.5">{li.description}</div>}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                            {li.period_start ? `${formatDate(li.period_start)} ~ ${formatDate(li.period_end)}` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {Number(li.total_amount ?? 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {children.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    {t('invoice.consolidated_children')}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {children.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => navigate(`/finance/invoices/${c.id}`)}
                        className="text-xs rounded-full border px-3 py-1 hover:bg-muted transition-colors"
                      >
                        <span className="font-medium text-primary">{c.invoice_ref}</span>
                        <span className="text-muted-foreground"> · {Number(c.amount ?? 0).toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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
                    <SelectItem value="BankTransfer">{t('invoice.method_bank_transfer')}</SelectItem>
                    <SelectItem value="Cash">{t('invoice.method_cash')}</SelectItem>
                    <SelectItem value="CreditCard">{t('invoice.method_credit_card')}</SelectItem>
                    <SelectItem value="Stripe">{t('invoice.method_stripe')}</SelectItem>
                    <SelectItem value="Cheque">{t('invoice.method_cheque')}</SelectItem>
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
                {t('invoice.btn_confirm_payment')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
      </div>
    </Layout>
  );
}

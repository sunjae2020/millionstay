import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useForm, Controller } from "react-hook-form";
import {
  useGetAccount, useCreateAccount, useUpdateAccount,
  useListBookings, useListContracts, useListInvoices,
  getListAccountsQueryKey, getGetAccountQueryKey,
  getListBookingsQueryKey, getListContractsQueryKey, getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import { LookupSelect } from "@/components/LookupSelect";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { formatDate } from "@/lib/date";
import { useBrand } from "@/contexts/ThemeContext";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  Guest: "bg-blue-100 text-blue-700 border-blue-200",
  SpaceOwner: "bg-purple-100 text-purple-700 border-purple-200",
  Broker: "bg-teal-100 text-teal-700 border-teal-200",
  Manager: "bg-cyan-100 text-cyan-700 border-cyan-200",
  RealEstateAgent: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ServiceHost: "bg-orange-100 text-orange-700 border-orange-200",
  Partner: "bg-indigo-100 text-indigo-700 border-indigo-200",
};

const ACCOUNT_TYPES_WITH_FINANCE = ["SpaceOwner", "Broker", "Manager", "RealEstateAgent", "ServiceHost", "Partner"];

const CURRENCIES = SUPPORTED_CURRENCIES.map((c) => c.code);

const BOOKING_STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600",
  PendingPayment: "bg-yellow-100 text-yellow-700",
  PendingApproval: "bg-amber-100 text-amber-800",
  Confirmed: "bg-blue-100 text-blue-700",
  Active: "bg-green-100 text-green-700",
  CheckedOut: "bg-indigo-100 text-indigo-700",
  Cancelled: "bg-red-100 text-red-700",
};

const CONTRACT_STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600",
  Active: "bg-green-100 text-green-700",
  Expired: "bg-yellow-100 text-yellow-700",
  Terminated: "bg-red-100 text-red-700",
};

const INVOICE_STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600",
  Sent: "bg-blue-100 text-blue-700",
  Paid: "bg-green-100 text-green-700",
  Void: "bg-red-100 text-red-600",
};

interface AccountForm {
  name: string;
  account_type: string;
  primary_contact_id: number | null;
  secondary_contact_id: number | null;
  account_email: string;
  website_url: string;
  phone1: string;
  phone2: string;
  address_line1: string;
  address_suburb: string;
  address_state: string;
  address_postcode: string;
  address_country: string;
  secondary_address_line1: string;
  secondary_address_suburb: string;
  secondary_address_state: string;
  secondary_address_postcode: string;
  secondary_address_country: string;
  payment_info_id: number | null;
  default_commission_id: number | null;
  default_currency: string;
  parent_account_id: number | null;
  description: string;
  manual_input: boolean;
  status: string;
}

export default function AccountDetail() {
  const { t } = useTranslation();
  const { currency: brandCurrency } = useBrand();
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const id = isNew ? null : parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: account, isLoading } = useGetAccount(
    id!, { query: { enabled: !isNew && !!id, queryKey: getGetAccountQueryKey(id!) } }
  );

  const { data: bookings } = useListBookings(
    { account_id: id ?? undefined },
    { query: { enabled: !isNew && !!id, queryKey: getListBookingsQueryKey({ account_id: id ?? undefined }) } }
  );

  const { data: contracts } = useListContracts(
    { tenant_account_id: id ?? undefined },
    { query: { enabled: !isNew && !!id, queryKey: getListContractsQueryKey({ tenant_account_id: id ?? undefined }) } }
  );

  const { data: invoices } = useListInvoices(
    { account_id: id ?? undefined },
    { query: { enabled: !isNew && !!id, queryKey: getListInvoicesQueryKey({ account_id: id ?? undefined }) } }
  );

  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<AccountForm>({
    defaultValues: {
      name: "", account_type: "Guest", primary_contact_id: null, secondary_contact_id: null,
      account_email: "", website_url: "", phone1: "", phone2: "",
      address_line1: "", address_suburb: "", address_state: "", address_postcode: "", address_country: "Australia",
      secondary_address_line1: "", secondary_address_suburb: "", secondary_address_state: "",
      secondary_address_postcode: "", secondary_address_country: "",
      payment_info_id: null, default_commission_id: null, default_currency: brandCurrency,
      parent_account_id: null, description: "", manual_input: false, status: "Active",
    },
  });

  const accountType = watch("account_type");
  const showFinance = ACCOUNT_TYPES_WITH_FINANCE.includes(accountType);
  const primaryContactId = watch("primary_contact_id");
  const secondaryContactId = watch("secondary_contact_id");

  useEffect(() => {
    if (account) {
      reset({
        name: account.name ?? "",
        account_type: account.account_type ?? "Guest",
        primary_contact_id: account.primary_contact_id ?? null,
        secondary_contact_id: account.secondary_contact_id ?? null,
        account_email: account.account_email ?? "",
        website_url: account.website_url ?? "",
        phone1: account.phone1 ?? "",
        phone2: account.phone2 ?? "",
        address_line1: account.address_line1 ?? "",
        address_suburb: account.address_suburb ?? "",
        address_state: account.address_state ?? "",
        address_postcode: account.address_postcode ?? "",
        address_country: account.address_country ?? "Australia",
        secondary_address_line1: account.secondary_address_line1 ?? "",
        secondary_address_suburb: account.secondary_address_suburb ?? "",
        secondary_address_state: account.secondary_address_state ?? "",
        secondary_address_postcode: account.secondary_address_postcode ?? "",
        secondary_address_country: account.secondary_address_country ?? "",
        payment_info_id: account.payment_info_id ?? null,
        default_commission_id: account.default_commission_id ?? null,
        default_currency: account.default_currency ?? brandCurrency,
        parent_account_id: account.parent_account_id ?? null,
        description: account.description ?? "",
        manual_input: account.manual_input ?? false,
        status: account.status ?? "Active",
      });
    }
  }, [account, reset]);

  const createMutation = useCreateAccount({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        navigate("/crm/accounts");
      },
    },
  });

  const updateMutation = useUpdateAccount({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        if (id) qc.invalidateQueries({ queryKey: getGetAccountQueryKey(id) });
        navigate("/crm/accounts");
      },
    },
  });

  const onSubmit = (values: AccountForm) => {
    const data = {
      name: values.name,
      account_type: values.account_type,
      primary_contact_id: values.primary_contact_id,
      secondary_contact_id: values.secondary_contact_id,
      account_email: values.account_email || null,
      website_url: values.website_url || null,
      phone1: values.phone1 || null,
      phone2: values.phone2 || null,
      address_line1: values.address_line1 || null,
      address_suburb: values.address_suburb || null,
      address_state: values.address_state || null,
      address_postcode: values.address_postcode || null,
      address_country: values.address_country || null,
      secondary_address_line1: values.secondary_address_line1 || null,
      secondary_address_suburb: values.secondary_address_suburb || null,
      secondary_address_state: values.secondary_address_state || null,
      secondary_address_postcode: values.secondary_address_postcode || null,
      secondary_address_country: values.secondary_address_country || null,
      payment_info_id: showFinance ? values.payment_info_id : null,
      default_commission_id: showFinance ? values.default_commission_id : null,
      default_currency: showFinance ? (values.default_currency || null) : null,
      parent_account_id: values.parent_account_id,
      description: values.description || null,
      manual_input: values.manual_input,
      status: values.status,
    };
    if (isNew) {
      createMutation.mutate({ data });
    } else {
      updateMutation.mutate({ id: id!, data });
    }
  };

  if (!isNew && isLoading) return <Layout><p className="p-6 text-sm text-muted-foreground">{t('common.loading')}</p></Layout>;

  const detailsContent = (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* Basic Info */}
        <div className="rounded-lg border p-4 space-y-4">
          <h3 className="font-semibold text-sm">{t('account.section_general')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('account.label_name')} *</Label>
              <Input {...register("name", { required: true })} placeholder={t('account.ph_name_example')} />
              {errors.name && <p className="text-xs text-destructive">{t('common.field_required')}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label>{t('account.label_type')}</Label>
              <Controller name="account_type" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Guest">{t('account.type_guest')}</SelectItem>
                    <SelectItem value="SpaceOwner">{t('account.type_space_owner')}</SelectItem>
                    <SelectItem value="Broker">{t('account.type_broker')}</SelectItem>
                    <SelectItem value="Manager">{t('account.type_manager')}</SelectItem>
                    <SelectItem value="RealEstateAgent">{t('account.type_real_estate_agent')}</SelectItem>
                    <SelectItem value="ServiceHost">{t('account.type_service_host')}</SelectItem>
                    <SelectItem value="Partner">{t('account.type_partner')}</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label>{t('account.label_primary_contact')}</Label>
                {primaryContactId && (
                  <Link href={`/crm/contacts/${primaryContactId}`}>
                    <span className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer">
                      <ExternalLink className="h-3 w-3" /> View
                    </span>
                  </Link>
                )}
              </div>
              <Controller name="primary_contact_id" control={control} render={({ field }) => (
                <LookupSelect
                  value={field.value}
                  onChange={field.onChange}
                  lookupUrl="/api/v1/lookup/contacts"
                  placeholder={t('contact.search_placeholder')}
                  displayValue={(account as any)?.primary_contact_name}
                />
              )} />
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label>{t('account.label_secondary_contact')}</Label>
                {secondaryContactId && (
                  <Link href={`/crm/contacts/${secondaryContactId}`}>
                    <span className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer">
                      <ExternalLink className="h-3 w-3" /> View
                    </span>
                  </Link>
                )}
              </div>
              <Controller name="secondary_contact_id" control={control} render={({ field }) => (
                <LookupSelect
                  value={field.value}
                  onChange={field.onChange}
                  lookupUrl="/api/v1/lookup/contacts"
                  placeholder={t('contact.search_placeholder')}
                  displayValue={(account as any)?.secondary_contact_name}
                />
              )} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('account.label_email')}</Label>
              <Input {...register("account_email")} type="email" />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('account.label_website')}</Label>
              <Input {...register("website_url")} placeholder="https://" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('account.label_phone')} 1</Label>
              <Input {...register("phone1")} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('account.label_phone')} 2</Label>
              <Input {...register("phone2")} />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="rounded-lg border p-4 space-y-4">
          <h3 className="font-semibold text-sm">{t('account.section_address')}</h3>
          <Input {...register("address_line1")} placeholder={t('account.label_address')} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2"><Input {...register("address_suburb")} placeholder={t('account.label_city')} /></div>
            <Input {...register("address_state")} placeholder={t('account.label_state')} />
            <Input {...register("address_postcode")} placeholder={t('account.label_postcode')} />
          </div>
          <Input {...register("address_country")} placeholder={t('account.label_country')} />
        </div>

        <div className="rounded-lg border p-4 space-y-4">
          <h3 className="font-semibold text-sm">{t('account.section_address')} {t('account.suffix_secondary')}</h3>
          <Input {...register("secondary_address_line1")} placeholder={t('account.label_address')} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2"><Input {...register("secondary_address_suburb")} placeholder={t('account.label_city')} /></div>
            <Input {...register("secondary_address_state")} placeholder={t('account.label_state')} />
            <Input {...register("secondary_address_postcode")} placeholder={t('account.label_postcode')} />
          </div>
          <Input {...register("secondary_address_country")} placeholder={t('account.label_country')} />
        </div>

        {/* Finance — only for non-Guest/Staff */}
        {showFinance && (
          <div className="rounded-lg border p-4 space-y-4">
            <h3 className="font-semibold text-sm">{t('account.section_finance')}</h3>
            <div className="grid gap-1.5">
              <Label>{t('account.label_default_currency')}</Label>
              <Controller name="default_currency" control={control} render={({ field }) => (
                <Select value={field.value || "__none"} onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('account.label_default_commission')}</Label>
              <Controller name="default_commission_id" control={control} render={({ field }) => (
                <LookupSelect
                  value={field.value}
                  onChange={field.onChange}
                  lookupUrl="/api/v1/lookup/commissions"
                  placeholder={t('account.ph_search_commissions')}
                  displayValue={(account as any)?.default_commission_name}
                />
              )} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('account.label_payment_info')}</Label>
              <Controller name="payment_info_id" control={control} render={({ field }) => (
                <LookupSelect
                  value={field.value}
                  onChange={field.onChange}
                  lookupUrl="/api/v1/lookup/payment-info"
                  placeholder={t('account.ph_search_payment_info')}
                  displayValue={(account as any)?.payment_info_name}
                />
              )} />
            </div>
          </div>
        )}
      </div>

      {/* Right column */}
      <div className="space-y-4">
        <div className="rounded-lg border p-4 space-y-4">
          <h3 className="font-semibold text-sm">{t('account.section_relationships')}</h3>
          <div className="grid gap-1.5">
            <Label>{t('account.label_parent_account')}</Label>
            <Controller name="parent_account_id" control={control} render={({ field }) => (
              <LookupSelect
                value={field.value}
                onChange={field.onChange}
                lookupUrl="/api/v1/lookup/accounts"
                placeholder={t('account.search_placeholder')}
                displayValue={(account as any)?.parent_account_name}
                excludeIds={!isNew && id ? [Number(id)] : undefined}
              />
            )} />
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-4">
          <h3 className="font-semibold text-sm">{t('account.label_status')}</h3>
          <div className="grid gap-1.5">
            <Label>{t('account.label_status')}</Label>
            <Controller name="status" control={control} render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">{t('common.active')}</SelectItem>
                  <SelectItem value="Inactive">{t('common.inactive')}</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>
          <div className="flex items-center justify-between">
            <Label>{t('common.manual_input')}</Label>
            <Controller name="manual_input" control={control} render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )} />
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-2">
          <Label>{t('account.label_notes')}</Label>
          <Input {...register("description")} placeholder={t('common.ph_internal_notes')} />
        </div>
      </div>
    </div>
  );

  return (
    <Layout>
      <PageHeader
        title={
          isNew ? `${t("common.new")} ${t("nav.account")}` : (
            <div className="flex items-center gap-2">
              <span>{account?.name ?? t("nav.account")}</span>
              {account && (
                <Badge variant="outline" className={`text-xs ${ACCOUNT_TYPE_COLORS[account.account_type] ?? ""}`}>
                  {account.account_type}
                </Badge>
              )}
            </div>
          )
        }
        actions={
          <div className="flex gap-2">
            <Link href="/crm/accounts">
              <Button variant="outline" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> {t('common.back')}</Button>
            </Link>
            <Button size="sm" className="gap-1.5" onClick={handleSubmit(onSubmit)}
              disabled={createMutation.isPending || updateMutation.isPending}>
              <Save className="h-4 w-4" /> {t('common.save')}
            </Button>
          </div>
        }
      />
      <div className="p-4 sm:p-6">
        {isNew ? (
          detailsContent
        ) : (
          <Tabs defaultValue="details">
            <TabsList className="mb-5">
              <TabsTrigger value="details">{t('account.tab_overview')}</TabsTrigger>
              <TabsTrigger value="bookings">
                {t('account.tab_bookings')}{bookings?.length ? ` (${bookings.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="contracts">
                {t('account.tab_documents')}{contracts?.length ? ` (${contracts.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="invoices">
                {t('account.tab_invoices')}{invoices?.length ? ` (${invoices.length})` : ""}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details">
              {detailsContent}
            </TabsContent>

            <TabsContent value="bookings">
              <div className="rounded-md border bg-card overflow-x-auto max-w-4xl">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_booking_ref')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_space')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_checkin')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_checkout')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {!bookings?.length ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">{t('account.empty_bookings')}</td>
                      </tr>
                    ) : (
                      (bookings as any[]).map((b: any) => (
                        <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">
                            <Link href={`/booking/bookings/${b.id}`}>
                              <span className="text-primary hover:underline cursor-pointer">{b.booking_ref ?? `#${b.id}`}</span>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{b.space_name ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(b.check_in_date)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(b.check_out_date)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BOOKING_STATUS_COLORS[b.booking_status] ?? "bg-gray-100 text-gray-600"}`}>
                              {b.booking_status ?? "—"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="contracts">
              <div className="rounded-md border bg-card overflow-x-auto max-w-4xl">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_invoice_ref')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_space')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_checkin')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_checkout')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {!contracts?.length ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">{t('account.empty_contracts')}</td>
                      </tr>
                    ) : (
                      (contracts as any[]).map((c: any) => (
                        <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">
                            <Link href={`/booking/contracts/${c.id}`}>
                              <span className="text-primary hover:underline cursor-pointer">{c.contract_ref ?? `#${c.id}`}</span>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{c.space_name ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(c.start_date)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(c.end_date)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CONTRACT_STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                              {c.status ?? "—"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="invoices">
              <div className="rounded-md border bg-card overflow-x-auto max-w-4xl">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_invoice_ref')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_amount')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_currency')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_due_date')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {!invoices?.length ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">{t('account.empty_invoices')}</td>
                      </tr>
                    ) : (
                      (invoices as any[]).map((inv: any) => (
                        <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">
                            <Link href={`/finance/invoices/${inv.id}`}>
                              <span className="text-primary hover:underline cursor-pointer">{inv.invoice_ref ?? `#${inv.id}`}</span>
                            </Link>
                          </td>
                          <td className="px-4 py-3">{inv.amount != null ? Number(inv.amount).toFixed(2) : "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{inv.currency ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.due_date)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${INVOICE_STATUS_COLORS[inv.status] ?? "bg-gray-100 text-gray-600"}`}>
                              {inv.status ?? "Draft"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
}

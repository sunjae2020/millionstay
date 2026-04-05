import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
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
} from "@workspace/api-client-react";
import { LookupSelect } from "@/components/LookupSelect";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, ExternalLink } from "lucide-react";
import { Link } from "wouter";

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  Guest: "bg-blue-100 text-blue-700 border-blue-200",
  SpaceOwner: "bg-purple-100 text-purple-700 border-purple-200",
  Landlord: "bg-purple-100 text-purple-700 border-purple-200",
  Agent: "bg-teal-100 text-teal-700 border-teal-200",
  ServiceHost: "bg-orange-100 text-orange-700 border-orange-200",
  Staff: "bg-gray-100 text-gray-700 border-gray-200",
  Partner: "bg-indigo-100 text-indigo-700 border-indigo-200",
};

const ACCOUNT_TYPES_WITH_FINANCE = ["SpaceOwner", "Agent", "ServiceHost", "Partner", "Landlord"];

const CURRENCIES = ["AUD", "USD", "CNY", "KRW", "JPY", "GBP", "EUR", "SGD", "NZD"];

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
    { query: { enabled: !isNew && !!id } }
  );

  const { data: contracts } = useListContracts(
    { tenant_account_id: id ?? undefined },
    { query: { enabled: !isNew && !!id } }
  );

  const { data: invoices } = useListInvoices(
    { account_id: id ?? undefined },
    { query: { enabled: !isNew && !!id } }
  );

  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<AccountForm>({
    defaultValues: {
      name: "", account_type: "Guest", primary_contact_id: null, secondary_contact_id: null,
      account_email: "", website_url: "", phone1: "", phone2: "",
      address_line1: "", address_suburb: "", address_state: "", address_postcode: "", address_country: "Australia",
      secondary_address_line1: "", secondary_address_suburb: "", secondary_address_state: "",
      secondary_address_postcode: "", secondary_address_country: "",
      payment_info_id: null, default_commission_id: null, default_currency: "AUD",
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
        default_currency: account.default_currency ?? "AUD",
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

  if (!isNew && isLoading) return <Layout><p className="p-6 text-sm text-muted-foreground">Loading…</p></Layout>;

  const detailsContent = (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* Basic Info */}
        <div className="rounded-lg border p-4 space-y-4">
          <h3 className="font-semibold text-sm">Basic Information</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Account Name *</Label>
              <Input {...register("name", { required: true })} placeholder="e.g. Sunjae KIM" />
              {errors.name && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="grid gap-1.5">
              <Label>Account Type</Label>
              <Controller name="account_type" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Guest">Guest</SelectItem>
                    <SelectItem value="SpaceOwner">Space Owner</SelectItem>
                    <SelectItem value="Landlord">Landlord</SelectItem>
                    <SelectItem value="Agent">Agent</SelectItem>
                    <SelectItem value="ServiceHost">Service Host</SelectItem>
                    <SelectItem value="Staff">Staff</SelectItem>
                    <SelectItem value="Partner">Partner</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label>Primary Contact</Label>
                {primaryContactId && (
                  <Link href={`/crm/contacts/${primaryContactId}`}>
                    <span className="text-xs text-[#E8621A] hover:underline flex items-center gap-1 cursor-pointer">
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
                  placeholder="Search contacts…"
                  displayValue={(account as any)?.primary_contact_name}
                />
              )} />
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label>Secondary Contact</Label>
                {secondaryContactId && (
                  <Link href={`/crm/contacts/${secondaryContactId}`}>
                    <span className="text-xs text-[#E8621A] hover:underline flex items-center gap-1 cursor-pointer">
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
                  placeholder="Search contacts…"
                  displayValue={(account as any)?.secondary_contact_name}
                />
              )} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Account Email</Label>
              <Input {...register("account_email")} type="email" />
            </div>
            <div className="grid gap-1.5">
              <Label>Website</Label>
              <Input {...register("website_url")} placeholder="https://" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Phone 1</Label>
              <Input {...register("phone1")} />
            </div>
            <div className="grid gap-1.5">
              <Label>Phone 2</Label>
              <Input {...register("phone2")} />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="rounded-lg border p-4 space-y-4">
          <h3 className="font-semibold text-sm">Primary Address</h3>
          <Input {...register("address_line1")} placeholder="Address Line 1" />
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2"><Input {...register("address_suburb")} placeholder="Suburb" /></div>
            <Input {...register("address_state")} placeholder="State" />
            <Input {...register("address_postcode")} placeholder="Postcode" />
          </div>
          <Input {...register("address_country")} placeholder="Country" />
        </div>

        <div className="rounded-lg border p-4 space-y-4">
          <h3 className="font-semibold text-sm">Secondary Address</h3>
          <Input {...register("secondary_address_line1")} placeholder="Address Line 1" />
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2"><Input {...register("secondary_address_suburb")} placeholder="Suburb" /></div>
            <Input {...register("secondary_address_state")} placeholder="State" />
            <Input {...register("secondary_address_postcode")} placeholder="Postcode" />
          </div>
          <Input {...register("secondary_address_country")} placeholder="Country" />
        </div>

        {/* Finance — only for non-Guest/Staff */}
        {showFinance && (
          <div className="rounded-lg border p-4 space-y-4">
            <h3 className="font-semibold text-sm">Finance</h3>
            <div className="grid gap-1.5">
              <Label>Default Currency</Label>
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
              <Label>Default Commission</Label>
              <Controller name="default_commission_id" control={control} render={({ field }) => (
                <LookupSelect
                  value={field.value}
                  onChange={field.onChange}
                  lookupUrl="/api/v1/lookup/commissions"
                  placeholder="Search commissions…"
                  displayValue={(account as any)?.default_commission_name}
                />
              )} />
            </div>
            <div className="grid gap-1.5">
              <Label>Payment Info</Label>
              <Controller name="payment_info_id" control={control} render={({ field }) => (
                <LookupSelect
                  value={field.value}
                  onChange={field.onChange}
                  lookupUrl="/api/v1/lookup/payment-info"
                  placeholder="Search payment info…"
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
          <h3 className="font-semibold text-sm">Relationships</h3>
          <div className="grid gap-1.5">
            <Label>Parent Account</Label>
            <Controller name="parent_account_id" control={control} render={({ field }) => (
              <LookupSelect
                value={field.value}
                onChange={field.onChange}
                lookupUrl="/api/v1/lookup/accounts"
                placeholder="Search accounts…"
                displayValue={(account as any)?.parent_account_name}
              />
            )} />
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-4">
          <h3 className="font-semibold text-sm">Settings</h3>
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Controller name="status" control={control} render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Manual Input</Label>
            <Controller name="manual_input" control={control} render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )} />
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-2">
          <Label>Description</Label>
          <Input {...register("description")} placeholder="Internal notes" />
        </div>
      </div>
    </div>
  );

  return (
    <Layout>
      <PageHeader
        title={
          isNew ? "New Account" : (
            <div className="flex items-center gap-2">
              <span>{account?.name ?? "Account"}</span>
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
              <Button variant="outline" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button>
            </Link>
            <Button size="sm" className="gap-1.5" onClick={handleSubmit(onSubmit)}
              disabled={createMutation.isPending || updateMutation.isPending}>
              <Save className="h-4 w-4" /> Save
            </Button>
          </div>
        }
      />
      <div className="p-6">
        {isNew ? (
          detailsContent
        ) : (
          <Tabs defaultValue="details">
            <TabsList className="mb-5">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="bookings">
                Bookings{bookings?.length ? ` (${bookings.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="contracts">
                Contracts{contracts?.length ? ` (${contracts.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="invoices">
                Invoices{invoices?.length ? ` (${invoices.length})` : ""}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details">
              {detailsContent}
            </TabsContent>

            <TabsContent value="bookings">
              <div className="rounded-md border bg-card overflow-hidden max-w-4xl">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Ref</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Space</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Check In</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Check Out</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {!bookings?.length ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">No bookings for this account</td>
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
                          <td className="px-4 py-3 text-muted-foreground">{b.check_in_date ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{b.check_out_date ?? "—"}</td>
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
              <div className="rounded-md border bg-card overflow-hidden max-w-4xl">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Ref</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Space</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Start Date</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">End Date</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {!contracts?.length ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">No contracts for this account</td>
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
                          <td className="px-4 py-3 text-muted-foreground">{c.start_date ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{c.end_date ?? "—"}</td>
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
              <div className="rounded-md border bg-card overflow-hidden max-w-4xl">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Ref</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Amount</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Currency</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Due Date</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {!invoices?.length ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">No invoices for this account</td>
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
                          <td className="px-4 py-3 text-muted-foreground">{inv.due_date ?? "—"}</td>
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

import { useEffect, useMemo, useRef, useState } from "react";
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
  useListBookings, useListContracts, useListInvoices, useListAccounts,
  getListAccountsQueryKey, getGetAccountQueryKey,
  getListBookingsQueryKey, getListContractsQueryKey, getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import { LookupSelect } from "@/components/LookupSelect";
import { AccountLookupSelect } from "@/components/AccountLookupSelect";
import { AccountIdentityPanel, type FillSource } from "@/components/AccountIdentityPanel";
import { EntityPreviewDialog, type EntityPreview } from "@/components/EntityPreviewDialog";
import { AddAccountContactDialog } from "@/components/AddAccountContactDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiJson } from "@/lib/apiFetch";
import { ArrowLeft, Save, ExternalLink, AlertTriangle, Building2, FileText, FolderUp, Eye, Upload, Trash2, UserPlus, X } from "lucide-react";
import { FileDropZone, DIRECTORY_INPUT_PROPS } from "@/components/FileDropZone";
import { Link } from "wouter";
import { useBrand } from "@/contexts/ThemeContext";
import { SUPPORTED_CURRENCIES, formatMoney } from "@/lib/currency";
import { accountTypeOptions, accountTypeLabel, accountTypeColor } from "@/lib/accountTypes";
import { COUNTRIES, normaliseCountry, defaultCountry } from "@/lib/countries";
import { formatPersonName } from "@/lib/nameFormat";
import { useModules } from "@/hooks/useModules";
import { KoreanAddressSearch, type KoreanAddress } from "@/components/KoreanAddressSearch";
import { formatDate } from "@/lib/date";
import { formatPostalAddress, orderFallbackFromLang, type AddressLang } from "@workspace/address";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";

const ACCOUNT_TYPES_WITH_FINANCE = ["SpaceOwner", "Agent", "ServiceHost", "Partner", "HomestayHost"];

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
  logo_url: string;
  biz_registration_no: string;
  ceo_name: string;
  manual_input: boolean;
  status: string;
}

/** Shape of GET /v1/accounts/:id/finance — see the route for the aggregation. */
interface FinanceTx {
  kind: "Invoice" | "Payout" | "Cost";
  id: number;
  ref: string;
  date: string | null;
  description: string;
  amount: number;
  currency: string;
  status: string;
  detail_url: string;
}
interface FinanceSummary {
  currency: string;
  receivable: {
    outstanding: Record<string, number>;
    overdue: Record<string, number>;
    paid: Record<string, number>;
    count: number;
  };
  payable: { outstanding: Record<string, number>; paid: Record<string, number>; count: number };
  costs: { total: Record<string, number> };
  transactions: FinanceTx[];
}
interface RelatedData {
  contacts: Array<Record<string, any>>;
  spaces: Array<Record<string, any>>;
  children: Array<Record<string, any>>;
}
interface AccountDocument {
  id: string;
  doc_type: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  signed_url: string;
}

/** "₩1,200,000 · $340.00" — accounts can transact in more than one currency. */
function formatTotals(totals: Record<string, number> | undefined, fallbackCurrency: string): string {
  const entries = Object.entries(totals ?? {}).filter(([, v]) => v);
  if (!entries.length) return formatMoney(0, fallbackCurrency);
  return entries.map(([currency, amount]) => formatMoney(amount, currency)).join(" · ");
}

const TX_KIND_COLORS: Record<string, string> = {
  Invoice: "bg-blue-100 text-blue-700",
  Payout: "bg-orange-100 text-orange-700",
  Cost: "bg-purple-100 text-purple-700",
};

export default function AccountDetail() {
  const { t, i18n } = useTranslation();
  const { currency: brandCurrency } = useBrand();
  const { homestayEnabled } = useModules();
  const typeOptions = accountTypeOptions(homestayEnabled);
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const id = isNew ? null : parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();
  // Addresses follow their own country's order; the UI language only picks the
  // country name (and the layout for records saved without a country).
  const addressLang = (i18n.language.slice(0, 2) || "en") as AddressLang;

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

  // Tab data that has no generated hook — these endpoints are account-specific.
  const { data: finance } = useQuery<FinanceSummary>({
    queryKey: ["account-finance", id],
    queryFn: () => apiJson<FinanceSummary>(`/api/v1/accounts/${id}/finance`),
    enabled: !isNew && !!id,
  });
  const { data: related } = useQuery<RelatedData>({
    queryKey: ["account-related", id],
    queryFn: () => apiJson<RelatedData>(`/api/v1/accounts/${id}/related`),
    enabled: !isNew && !!id,
  });
  const { data: accountDocs } = useQuery<AccountDocument[]>({
    queryKey: ["account-documents", id],
    queryFn: () => apiJson<AccountDocument[]>(`/api/v1/accounts/${id}/documents`),
    enabled: !isNew && !!id,
  });

  // Account files: upload / delete straight from the Files tab.
  const docInputRef = useRef<HTMLInputElement>(null);
  const docFolderRef = useRef<HTMLInputElement>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  /** Takes a whole selection — picked, dropped or pasted — one POST per file. */
  async function handleDocUpload(input?: FileList | File[] | null) {
    const files = (input ? Array.from(input) : []).filter((f) => f.size > 0);
    if (!files.length || !id) return;
    setUploadingDoc(true);
    setDocError(null);
    const failures: string[] = [];
    try {
      // One at a time so a single rejected file does not take the rest down.
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        const res = await apiFetch(`/api/v1/accounts/${id}/documents`, { method: "POST", body: form });
        const data = await res.json().catch(() => null);
        if (!res.ok) failures.push(`${file.name}: ${data?.error ?? res.status}`);
      }
      if (failures.length) setDocError(failures.join(" / "));
    } catch (err) {
      setDocError(err instanceof Error ? err.message : t('account.file_upload_failed'));
    } finally {
      setUploadingDoc(false);
      qc.invalidateQueries({ queryKey: ["account-documents", id] });
      if (docInputRef.current) docInputRef.current.value = "";
      if (docFolderRef.current) docFolderRef.current.value = "";
    }
  }

  async function handleDocDelete(docId: string) {
    if (!id) return;
    await apiFetch(`/api/v1/accounts/${id}/documents/${docId}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["account-documents", id] });
  }

  // Row → quick-look modal. One piece of state drives every tab.
  const [preview, setPreview] = useState<EntityPreview | null>(null);

  // ── Contacts tab: attach / detach people ──────────────────────────────
  const [addContactOpen, setAddContactOpen] = useState(false);

  /** Roles are free text apart from the two designated slots. */
  function contactRoleLabel(role?: string | null): string {
    if (role === "Primary") return t('account.role_primary');
    if (role === "Secondary") return t('account.role_secondary');
    if (role === "Member" || !role) return t('account.role_member');
    return role;
  }

  async function handleUnlinkContact(contactId: number) {
    if (!id) return;
    if (!window.confirm(t('account.unlink_contact_confirm'))) return;
    await apiFetch(`/api/v1/accounts/${id}/contacts/${contactId}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["account-related", id] });
    qc.invalidateQueries({ queryKey: getGetAccountQueryKey(id) });
  }


  // Verification + provenance live outside the form: they are set by the
  // identity panel, not typed, but must ride along on save.
  const [bizVerify, setBizVerify] = useState<{ status: string | null; verified_at: string | null }>({
    status: null, verified_at: null,
  });
  const [fieldSources, setFieldSources] = useState<Record<string, string>>({});

  const { register, handleSubmit, reset, control, watch, setValue, getValues, formState: { errors } } = useForm<AccountForm>({
    defaultValues: {
      name: "", account_type: "Tenant", primary_contact_id: null, secondary_contact_id: null,
      account_email: "", website_url: "", phone1: "", phone2: "",
      address_line1: "", address_suburb: "", address_state: "", address_postcode: "", address_country: defaultCountry(),
      secondary_address_line1: "", secondary_address_suburb: "", secondary_address_state: "",
      secondary_address_postcode: "", secondary_address_country: "",
      payment_info_id: null, default_commission_id: null, default_currency: brandCurrency,
      parent_account_id: null, description: "", logo_url: "", biz_registration_no: "", ceo_name: "",
      manual_input: false, status: "Active",
    },
  });

  const accountType = watch("account_type");
  const showFinance = ACCOUNT_TYPES_WITH_FINANCE.includes(accountType);
  const primaryContactId = watch("primary_contact_id");
  const secondaryContactId = watch("secondary_contact_id");
  const logoUrl = watch("logo_url");
  const websiteUrl = watch("website_url");
  const bizNo = watch("biz_registration_no");
  const nameValue = watch("name");

  useEffect(() => {
    if (account) {
      reset({
        name: account.name ?? "",
        account_type: account.account_type ?? "Tenant",
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
        address_country: normaliseCountry(account.address_country) || defaultCountry(),
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
        logo_url: (account as any).logo_url ?? "",
        biz_registration_no: (account as any).biz_registration_no ?? "",
        ceo_name: (account as any).ceo_name ?? "",
        manual_input: account.manual_input ?? false,
        status: account.status ?? "Active",
      });
      setBizVerify({
        status: (account as any).biz_verify_status ?? null,
        verified_at: (account as any).biz_verified_at ?? null,
      });
      setFieldSources(((account as any).field_sources ?? {}) as Record<string, string>);
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
      logo_url: values.logo_url || null,
      biz_registration_no: values.biz_registration_no || null,
      ceo_name: values.ceo_name || null,
      // Verification only means anything alongside the number it was run on —
      // clearing the number clears the verdict with it.
      biz_verify_status: values.biz_registration_no ? bizVerify.status : null,
      biz_verified_at: values.biz_registration_no ? bizVerify.verified_at : null,
      field_sources: Object.keys(fieldSources).length ? fieldSources : null,
      manual_input: values.manual_input,
      status: values.status,
    };
    if (isNew) {
      createMutation.mutate({ data });
    } else {
      updateMutation.mutate({ id: id!, data });
    }
  };

  /** Applies fields approved in the identity panel and records where they came from. */
  const handleApplyFields = (fields: Record<string, string>, source: FillSource) => {
    for (const [key, value] of Object.entries(fields)) {
      // A site may still print "KR" — store it the way we store countries.
      const v = key === "address_country" ? normaliseCountry(value) : value;
      setValue(key as keyof AccountForm, v as never, { shouldDirty: true });
    }
    setFieldSources((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(fields)) next[key] = source;
      return next;
    });
    // A re-scraped number has not been re-verified — drop the stale verdict.
    if (fields["biz_registration_no"]) setBizVerify({ status: null, verified_at: null });
  };

  // ── Duplicate guard ─────────────────────────────────────────────────────
  // Catching "㈜메트하임" being created twice is far cheaper here than merging
  // two accounts later. Name, business number and website domain all count.
  const { data: allAccounts } = useListAccounts(
    {}, { query: { queryKey: getListAccountsQueryKey({}) } },
  );
  const duplicates = useMemo(() => {
    const rows = (allAccounts as any[] | undefined) ?? [];
    const name = nameValue.trim().toLowerCase();
    const digits = bizNo.replace(/\D/g, "");
    const domain = (() => {
      const raw = websiteUrl.trim();
      if (!raw) return "";
      try {
        return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./, "").toLowerCase();
      } catch { return ""; }
    })();

    return rows.filter((a) => {
      if (!isNew && a.id === id) return false;
      if (name && String(a.name ?? "").trim().toLowerCase() === name) return true;
      if (digits.length === 10 && String(a.biz_registration_no ?? "").replace(/\D/g, "") === digits) return true;
      if (domain && String(a.website_url ?? "").toLowerCase().includes(domain)) return true;
      return false;
    });
  }, [allAccounts, nameValue, bizNo, websiteUrl, isNew, id]);

  if (!isNew && isLoading) return <Layout><p className="p-6 text-sm text-muted-foreground">{t('common.loading')}</p></Layout>;

  /** Writes a 우편번호-찾기 result onto either address block. */
  const applyKoreanAddress = (prefix: "" | "secondary_", a: KoreanAddress) => {
    const set = (suffix: string, value: string) =>
      setValue(`${prefix}address_${suffix}` as keyof AccountForm, value as never, { shouldDirty: true });
    set("line1", a.address);
    set("suburb", a.suburb);
    set("state", a.state);
    set("postcode", a.postcode);
    set("country", a.country);
  };

  /** Country picker that keeps free text working for anywhere unlisted. */
  const CountryField = ({ name }: { name: "address_country" | "secondary_address_country" }) => (
    <Controller name={name} control={control} render={({ field }) => {
      const current = normaliseCountry(field.value);
      const known = COUNTRIES.some((c) => c.value === current);
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select value={known ? current : "__other"} onValueChange={(v) => field.onChange(v === "__other" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder={t('account.label_country')} /></SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>)}
              <SelectItem value="__other">{t('account.country_other')}</SelectItem>
            </SelectContent>
          </Select>
          {!known && (
            <Input value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)}
              placeholder={t('account.label_country')} />
          )}
        </div>
      );
    }} />
  );

  const duplicateBanner = duplicates.length > 0 && (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3">
      <p className="text-sm font-medium text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
        <AlertTriangle className="h-4 w-4" /> {t("account.duplicate_warning")}
      </p>
      <ul className="mt-1.5 space-y-0.5">
        {duplicates.slice(0, 5).map((d) => (
          <li key={d.id} className="text-sm">
            <Link href={`/crm/accounts/${d.id}`}>
              <span className="text-primary hover:underline cursor-pointer">{d.name}</span>
            </Link>
            <span className="text-muted-foreground"> · {d.account_type}</span>
          </li>
        ))}
      </ul>
    </div>
  );

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
                    {typeOptions.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{t(d.labelKey)}</SelectItem>
                    ))}
                    {/* A legacy value still on the record stays selectable so
                        opening the page cannot silently retype the account. */}
                    {field.value && !typeOptions.some((d) => d.value === field.value) && (
                      <SelectItem value={field.value}>{field.value}</SelectItem>
                    )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('account.label_biz_no')}</Label>
              <Input {...register("biz_registration_no")} placeholder="000-00-00000" />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('account.label_ceo')}</Label>
              <Input {...register("ceo_name")} />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">{t('account.section_address')}</h3>
            <KoreanAddressSearch onSelect={(a) => applyKoreanAddress("", a)} />
          </div>
          <Input {...register("address_line1")} placeholder={t('account.label_address')} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2"><Input {...register("address_suburb")} placeholder={t('account.label_city')} /></div>
            <Input {...register("address_state")} placeholder={t('account.label_state')} />
            <Input {...register("address_postcode")} placeholder={t('account.label_postcode')} />
          </div>
          <CountryField name="address_country" />
        </div>

        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">{t('account.section_address')} {t('account.suffix_secondary')}</h3>
            <KoreanAddressSearch onSelect={(a) => applyKoreanAddress("secondary_", a)} />
          </div>
          <Input {...register("secondary_address_line1")} placeholder={t('account.label_address')} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2"><Input {...register("secondary_address_suburb")} placeholder={t('account.label_city')} /></div>
            <Input {...register("secondary_address_state")} placeholder={t('account.label_state')} />
            <Input {...register("secondary_address_postcode")} placeholder={t('account.label_postcode')} />
          </div>
          <CountryField name="secondary_address_country" />
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
        <AccountIdentityPanel
          currentValues={{
            name: getValues("name") ?? "",
            account_email: getValues("account_email") ?? "",
            website_url: getValues("website_url") ?? "",
            phone1: getValues("phone1") ?? "",
            phone2: getValues("phone2") ?? "",
            address_line1: getValues("address_line1") ?? "",
            address_suburb: getValues("address_suburb") ?? "",
            address_state: getValues("address_state") ?? "",
            address_postcode: getValues("address_postcode") ?? "",
            address_country: getValues("address_country") ?? "",
            biz_registration_no: getValues("biz_registration_no") ?? "",
            ceo_name: getValues("ceo_name") ?? "",
            description: getValues("description") ?? "",
          }}
          onApplyFields={handleApplyFields}
          logoUrl={logoUrl}
          onLogoChange={(url) => setValue("logo_url", url, { shouldDirty: true })}
          primaryContactId={primaryContactId}
          websiteUrl={websiteUrl}
          bizNo={bizNo}
          bizVerify={bizVerify}
          onBizVerified={setBizVerify}
          fieldSources={fieldSources}
        />

        <div className="rounded-lg border p-4 space-y-4">
          <h3 className="font-semibold text-sm">{t('account.section_relationships')}</h3>
          <div className="grid gap-1.5">
            <Label>{t('account.label_parent_account')}</Label>
            <Controller name="parent_account_id" control={control} render={({ field }) => (
              <AccountLookupSelect
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
              {logoUrl && (
                <img src={logoUrl} alt="" className="h-7 w-7 rounded border object-contain bg-background" />
              )}
              <span>{account?.name ?? t("nav.account")}</span>
              {account && (
                <Badge variant="outline" className={`text-xs ${accountTypeColor(account.account_type)}`}>
                  {accountTypeLabel(t, account.account_type)}
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
          <>
            {duplicateBanner}
            {detailsContent}
          </>
        ) : (
          <Tabs defaultValue="details">
            <TabsList className="mb-5 flex-wrap h-auto">
              <TabsTrigger value="details">{t('account.tab_overview')}</TabsTrigger>
              <TabsTrigger value="contacts">
                {t('account.tab_contacts')}{related?.contacts.length ? ` (${related.contacts.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="bookings">
                {t('account.tab_bookings')}{bookings?.length ? ` (${bookings.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="contracts">
                {t('account.tab_contracts')}{contracts?.length ? ` (${contracts.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="invoices">
                {t('account.tab_invoices')}{invoices?.length ? ` (${invoices.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="finance">{t('account.tab_finance')}</TabsTrigger>
              <TabsTrigger value="assets">
                {t('account.tab_assets')}{related?.spaces.length ? ` (${related.spaces.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="documents">
                {t('account.tab_files')}{accountDocs?.length ? ` (${accountDocs.length})` : ""}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details">
              {duplicateBanner}
              {detailsContent}
            </TabsContent>

            {/* ── Contacts ────────────────────────────────────────────── */}
            <TabsContent value="contacts">
              <div className="mb-3 flex justify-end max-w-4xl">
                <Button size="sm" className="gap-1.5" onClick={() => setAddContactOpen(true)}>
                  <UserPlus className="h-4 w-4" /> {t('account.add_contact')}
                </Button>
              </div>
              <div className="rounded-md border bg-card overflow-x-auto max-w-4xl">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_contact_name')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_role')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.label_email')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_phone')}</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {!related?.contacts.length ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">{t('account.empty_contacts')}</td></tr>
                    ) : (
                      related.contacts.map((c: any) => (
                        <tr key={c.id} className="hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setPreview({
                            title: formatPersonName(c.first_name, c.last_name),
                            subtitle: [c.job_title, c.company_name].filter(Boolean).join(" · ") || null,
                            badge: { label: contactRoleLabel(c.role) },
                            fields: [
                              { label: t('account.label_email'), value: c.email },
                              { label: t('account.col_mobile'), value: c.mobile_number },
                              { label: t('account.col_office'), value: c.office_number },
                              { label: t('account.label_department'), value: c.department },
                              { label: t('account.label_nationality'), value: c.nationality },
                              { label: t('account.label_website'), value: c.website },
                              { label: t('account.label_address'), wide: true, value: formatPostalAddress(
                                { line1: c.address_line1, suburb: c.suburb, state: c.state, postcode: c.postcode, country: c.country },
                                addressLang, { orderFallbackCountry: orderFallbackFromLang(addressLang) },
                              ) },
                              { label: t('account.label_notes'), wide: true, value: c.description },
                            ],
                            detailUrl: `/crm/contacts/${c.id}`,
                          })}>
                          <td className="px-4 py-3 font-medium">{formatPersonName(c.first_name, c.last_name)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{contactRoleLabel(c.role)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{c.mobile_number ?? c.office_number ?? "—"}</td>
                          <td className="px-2 py-3 text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              title={t('account.unlink_contact')}
                              onClick={(e) => { e.stopPropagation(); void handleUnlinkContact(c.id); }}>
                              <X className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* ── Finance (회계) ──────────────────────────────────────── */}
            <TabsContent value="finance">
              <div className="space-y-5 max-w-4xl">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('account.finance_receivable')}</p>
                    <p className="mt-1 text-lg font-semibold">
                      {formatTotals(finance?.receivable.outstanding, finance?.currency ?? "AUD")}
                    </p>
                    {Object.keys(finance?.receivable.overdue ?? {}).length > 0 && (
                      <p className="mt-0.5 text-xs text-destructive">
                        {t('account.finance_overdue')}: {formatTotals(finance?.receivable.overdue, finance?.currency ?? "AUD")}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t('account.finance_paid')}: {formatTotals(finance?.receivable.paid, finance?.currency ?? "AUD")}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('account.finance_payable')}</p>
                    <p className="mt-1 text-lg font-semibold">
                      {formatTotals(finance?.payable.outstanding, finance?.currency ?? "AUD")}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t('account.finance_paid')}: {formatTotals(finance?.payable.paid, finance?.currency ?? "AUD")}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('account.finance_costs')}</p>
                    <p className="mt-1 text-lg font-semibold">
                      {formatTotals(finance?.costs.total, finance?.currency ?? "AUD")}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t('account.finance_costs_hint')}</p>
                  </div>
                </div>

                <div className="rounded-md border bg-card overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_date')}</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_kind')}</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_reference')}</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_description')}</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_amount')}</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {!finance?.transactions.length ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">{t('account.empty_transactions')}</td></tr>
                      ) : (
                        finance.transactions.map((tx) => (
                          <tr key={`${tx.kind}-${tx.id}`} className="hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => setPreview({
                              title: tx.ref,
                              subtitle: tx.description || null,
                              badge: { label: t(`account.tx_${tx.kind.toLowerCase()}`), className: TX_KIND_COLORS[tx.kind] },
                              fields: [
                                { label: t('account.col_amount'), value: formatMoney(tx.amount, tx.currency) },
                                { label: t('account.col_date'), value: formatDate(tx.date) },
                                { label: t('account.col_status'), value: tx.status },
                                { label: t('account.col_currency'), value: tx.currency },
                              ],
                              detailUrl: tx.detail_url,
                            })}>
                            <td className="px-4 py-3 text-muted-foreground">{formatDate(tx.date)}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TX_KIND_COLORS[tx.kind] ?? "bg-gray-100 text-gray-600"}`}>
                                {t(`account.tx_${tx.kind.toLowerCase()}`)}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium">{tx.ref}</td>
                            <td className="px-4 py-3 text-muted-foreground">{tx.description || "—"}</td>
                            <td className="px-4 py-3 text-right">{formatMoney(tx.amount, tx.currency)}</td>
                            <td className="px-4 py-3 text-muted-foreground">{tx.status}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* ── Assets (owned spaces + sub-accounts) ────────────────── */}
            <TabsContent value="assets">
              <div className="space-y-5 max-w-4xl">
                <div className="rounded-md border bg-card overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_space')}</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_property')}</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_area')}</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {!related?.spaces.length ? (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">{t('account.empty_assets')}</td></tr>
                      ) : (
                        related.spaces.map((s: any) => (
                          <tr key={s.id} className="hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => setPreview({
                              title: s.name,
                              subtitle: s.property_name ?? null,
                              badge: { label: s.status },
                              fields: [
                                { label: t('account.col_type'), value: s.custom_type_name ?? s.space_type },
                                { label: t('account.col_floor'), value: s.floor_number },
                                { label: t('account.col_area'), value: s.exclusive_area_m2 ? `${s.exclusive_area_m2} ㎡` : null },
                                { label: t('account.col_monthly_rent'), value: s.monthly_rent != null ? formatMoney(s.monthly_rent, s.base_currency ?? brandCurrency) : null },
                                { label: t('account.col_deposit'), value: s.deposit_amount != null ? formatMoney(s.deposit_amount, s.base_currency ?? brandCurrency) : null },
                              ],
                              detailUrl: `/property/spaces/${s.id}`,
                            })}>
                            <td className="px-4 py-3 font-medium flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />{s.name}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{s.property_name ?? "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground">{s.exclusive_area_m2 ? `${s.exclusive_area_m2} ㎡` : "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground">{s.status}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {!!related?.children.length && (
                  <div>
                    <h3 className="font-semibold text-sm mb-2">{t('account.sub_accounts')}</h3>
                    <div className="flex flex-wrap gap-2">
                      {related.children.map((c: any) => (
                        <Link key={c.id} href={`/crm/accounts/${c.id}`}>
                          <Badge variant="outline" className="cursor-pointer hover:bg-muted">{c.name}</Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Files ───────────────────────────────────────────────── */}
            <TabsContent value="documents">
              <div className="max-w-4xl mb-3 flex items-center gap-3">
                <input ref={docInputRef} type="file" multiple className="hidden"
                  onChange={(e) => void handleDocUpload(e.target.files)} />
                <input ref={docFolderRef} type="file" multiple className="hidden"
                  {...DIRECTORY_INPUT_PROPS}
                  onChange={(e) => void handleDocUpload(e.target.files)} />
                <Button type="button" variant="outline" size="sm" className="gap-1.5"
                  disabled={uploadingDoc} onClick={() => docInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  {uploadingDoc ? t('common.loading') : t('account.upload_file')}
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-1.5"
                  disabled={uploadingDoc} onClick={() => docFolderRef.current?.click()}>
                  <FolderUp className="h-4 w-4" />
                  {t("file_drop.upload_folder", "Upload folder")}
                </Button>
                {docError && <p className="text-xs text-destructive">{docError}</p>}
              </div>
              <FileDropZone onFiles={(files) => void handleDocUpload(files)} busy={uploadingDoc} className="max-w-4xl">
              <div className="rounded-md border bg-card overflow-x-auto max-w-4xl">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_file')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_kind')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_date')}</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {!accountDocs?.length ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">{t('account.empty_files')}</td></tr>
                    ) : (
                      accountDocs.map((d) => (
                        <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />{d.file_name}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{d.doc_type}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(d.created_at)}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button type="button"
                              onClick={() => openPreview({ title: d.file_name, filename: d.file_name, source: { kind: "url", href: d.signed_url } })}
                              className="text-primary hover:underline inline-flex items-center gap-1 text-xs">
                              <Eye className="h-3.5 w-3.5" /> {t('common.preview', 'Preview')}
                            </button>
                            <button type="button" onClick={() => void handleDocDelete(d.id)}
                              className="ml-3 text-destructive hover:underline inline-flex items-center gap-1 text-xs">
                              <Trash2 className="h-3.5 w-3.5" /> {t('common.remove')}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              </FileDropZone>
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
                        <tr key={b.id} className="hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setPreview({
                            title: b.booking_ref ?? `#${b.id}`,
                            subtitle: b.space_name ?? null,
                            badge: { label: b.booking_status ?? "—", className: BOOKING_STATUS_COLORS[b.booking_status] },
                            fields: [
                              { label: t('account.col_space'), value: b.space_name },
                              { label: t('account.col_checkin'), value: formatDate(b.check_in_date) },
                              { label: t('account.col_checkout'), value: formatDate(b.check_out_date) },
                              { label: t('account.col_guests'), value: b.guest_count },
                              { label: t('account.col_amount'), value: b.total_amount != null ? formatMoney(b.total_amount, b.currency ?? brandCurrency) : null },
                              { label: t('account.col_notes'), wide: true, value: b.notes },
                            ],
                            detailUrl: `/booking/bookings/${b.id}`,
                          })}>
                          <td className="px-4 py-3 font-medium text-primary">{b.booking_ref ?? `#${b.id}`}</td>
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
              <div className="rounded-md border bg-card overflow-x-auto max-w-4xl">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_contract_ref')}</th>
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
                        <tr key={c.id} className="hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setPreview({
                            title: c.contract_ref ?? `#${c.id}`,
                            subtitle: c.space_name ?? null,
                            badge: { label: c.status ?? "—", className: CONTRACT_STATUS_COLORS[c.status] },
                            fields: [
                              { label: t('account.col_space'), value: c.space_name },
                              { label: t('account.col_checkin'), value: formatDate(c.start_date) },
                              { label: t('account.col_checkout'), value: formatDate(c.end_date) },
                              { label: t('account.col_monthly_rent'), value: c.monthly_rent != null ? formatMoney(c.monthly_rent, c.currency ?? brandCurrency) : null },
                              { label: t('account.col_deposit'), value: c.bond_amount != null ? formatMoney(c.bond_amount, c.currency ?? brandCurrency) : null },
                              { label: t('account.col_notes'), wide: true, value: c.notes },
                            ],
                            detailUrl: `/booking/contracts/${c.id}`,
                          })}>
                          <td className="px-4 py-3 font-medium text-primary">{c.contract_ref ?? `#${c.id}`}</td>
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
                        <tr key={inv.id} className="hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setPreview({
                            title: inv.invoice_ref ?? `#${inv.id}`,
                            subtitle: inv.description ?? null,
                            badge: { label: inv.status ?? "Draft", className: INVOICE_STATUS_COLORS[inv.status] },
                            fields: [
                              { label: t('account.col_amount'), value: formatMoney(inv.amount, inv.currency ?? brandCurrency) },
                              { label: t('account.col_due_date'), value: formatDate(inv.due_date) },
                              { label: t('account.col_status'), value: inv.status },
                              { label: t('account.col_payment_method'), value: inv.payment_method },
                              { label: t('account.col_notes'), wide: true, value: inv.notes },
                            ],
                            detailUrl: `/finance/invoices/${inv.id}`,
                          })}>
                          <td className="px-4 py-3 font-medium text-primary">{inv.invoice_ref ?? `#${inv.id}`}</td>
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

      {!isNew && id && (
        <AddAccountContactDialog
          accountId={id}
          open={addContactOpen}
          onOpenChange={setAddContactOpen}
          linkedContactIds={(related?.contacts ?? []).map((c: any) => c.id)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["account-related", id] });
            qc.invalidateQueries({ queryKey: getGetAccountQueryKey(id) });
          }}
        />
      )}
      <EntityPreviewDialog preview={preview} onClose={() => setPreview(null)} />
      <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
    </Layout>
  );
}

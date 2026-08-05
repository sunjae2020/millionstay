import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useForm, Controller } from "react-hook-form";
import {
  useGetContact, useCreateContact, useUpdateContact,
  getListContactsQueryKey, getGetContactQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, AlertTriangle, Link2, X } from "lucide-react";
import { Link } from "wouter";
import { ContactMediaPanel, type PendingCards } from "@/components/ContactMediaPanel";
import { apiFetch, apiJson } from "@/lib/apiFetch";
import { LinkContactAccountDialog } from "@/components/LinkContactAccountDialog";
import { accountTypeLabel } from "@/lib/accountTypes";
import { formatPersonName } from "@/lib/nameFormat";
import { COUNTRIES, normaliseCountry, defaultCountry } from "@/lib/countries";
import { KoreanAddressSearch } from "@/components/KoreanAddressSearch";
import { differenceInDays, parseISO } from "date-fns";

/**
 * Messenger the SNS id belongs to. Stored as the canonical English name; the
 * label is localised, so a Korean admin picks 카카오톡 and the row reads
 * "KakaoTalk" everywhere else.
 */
const SNS_TYPES = ["KakaoTalk", "LINE", "WhatsApp", "WeChat", "Telegram", "Instagram", "Facebook", "Other"] as const;

const SNS_PLACEHOLDER: Record<string, string> = {
  KakaoTalk: "kakao_id",
  LINE: "line_id",
  WhatsApp: "+82 10 1234 5678",
  WeChat: "wechat_id",
  Telegram: "@telegram",
  Instagram: "@instagram",
  Facebook: "facebook.com/…",
};

interface ContactForm {
  first_name: string;
  last_name: string;
  title: string;
  other_name: string;
  email: string;
  mobile_number: string;
  office_number: string;
  date_of_birth: string;
  nationality: string;
  gender: string;
  sns_id: string;
  sns_type: string;
  is_foreigner: boolean;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_email: string;
  company_name: string;
  job_title: string;
  department: string;
  website: string;
  passport_number: string;
  passport_expiry: string;
  visa_type: string;
  visa_expiry: string;
  address_line1: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
  portal_enabled: boolean;
  portal_user_id: string;
  profile_photo_url: string;
  description: string;
  manual_input: boolean;
  status: string;
}

/** Row shape of GET /v1/contacts/:id/accounts. */
interface LinkedAccount {
  id: number;
  name: string;
  account_type: string;
  status: string;
  role: string;
  link: "slot" | "link";
}

function ExpiryWarning({ label, dateStr }: { label: string; dateStr?: string | null }) {
  const { t } = useTranslation();
  if (!dateStr) return null;
  const days = differenceInDays(parseISO(dateStr), new Date());
  if (days > 90) return null;
  const color = days < 0 ? "text-red-600" : days < 30 ? "text-orange-600" : "text-yellow-600";
  return (
    <div className={`flex items-center gap-1 text-xs ${color} mt-0.5`}>
      <AlertTriangle className="h-3 w-3" />
      {days < 0 ? t('contact.expiry_expired', { label, days: -days }) : t('contact.expiry_expires', { label, days })}
    </div>
  );
}

export default function ContactDetail() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const id = isNew ? null : parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: contact, isLoading } = useGetContact(
    id!, { query: { enabled: !isNew && !!id, queryKey: getGetContactQueryKey(id!) } }
  );

  const { register, handleSubmit, reset, control, watch, setValue, getValues, formState: { errors } } = useForm<ContactForm>({
    defaultValues: {
      first_name: "", last_name: "", title: "", other_name: "", email: "",
      mobile_number: "", office_number: "", date_of_birth: "", nationality: "",
      gender: "", sns_id: "", sns_type: "", is_foreigner: false,
      emergency_contact_name: "", emergency_contact_phone: "", emergency_contact_email: "",
      company_name: "", job_title: "", department: "", website: "",
      passport_number: "", passport_expiry: "", visa_type: "",
      visa_expiry: "", address_line1: "", suburb: "", state: "", postcode: "",
      country: defaultCountry(), portal_enabled: false, portal_user_id: "", profile_photo_url: "",
      description: "", manual_input: false, status: "Active",
    },
  });

  const passportExpiry = watch("passport_expiry");
  const visaExpiry = watch("visa_expiry");
  const profilePhoto = watch("profile_photo_url");
  const snsType = watch("sns_type");
  const isForeigner = watch("is_foreigner");

  useEffect(() => {
    if (contact) {
      reset({
        first_name: contact.first_name ?? "",
        last_name: contact.last_name ?? "",
        title: contact.title ?? "",
        other_name: contact.other_name ?? "",
        email: contact.email ?? "",
        mobile_number: contact.mobile_number ?? "",
        office_number: contact.office_number ?? "",
        date_of_birth: contact.date_of_birth ?? "",
        nationality: normaliseCountry(contact.nationality),
        gender: contact.gender ?? "",
        sns_id: contact.sns_id ?? "",
        sns_type: contact.sns_type ?? "",
        is_foreigner: contact.is_foreigner ?? false,
        emergency_contact_name: contact.emergency_contact_name ?? "",
        emergency_contact_phone: contact.emergency_contact_phone ?? "",
        emergency_contact_email: contact.emergency_contact_email ?? "",
        company_name: contact.company_name ?? "",
        job_title: contact.job_title ?? "",
        department: contact.department ?? "",
        website: contact.website ?? "",
        passport_number: contact.passport_number ?? "",
        passport_expiry: contact.passport_expiry ?? "",
        visa_type: contact.visa_type ?? "",
        visa_expiry: contact.visa_expiry ?? "",
        address_line1: contact.address_line1 ?? "",
        suburb: contact.suburb ?? "",
        state: contact.state ?? "",
        postcode: contact.postcode ?? "",
        country: normaliseCountry(contact.country) || defaultCountry(),
        portal_enabled: contact.portal_enabled ?? false,
        portal_user_id: contact.portal_user_id ?? "",
        profile_photo_url: contact.profile_photo_url ?? "",
        description: contact.description ?? "",
        manual_input: contact.manual_input ?? false,
        status: contact.status ?? "Active",
      });
    }
  }, [contact, reset]);

  // ── Accounts tab: which companies this person belongs to ───────────────
  const [linkAccountOpen, setLinkAccountOpen] = useState(false);
  const { data: linkedAccounts } = useQuery<LinkedAccount[]>({
    queryKey: ["contact-accounts", id],
    queryFn: () => apiJson<LinkedAccount[]>(`/api/v1/contacts/${id}/accounts`),
    enabled: !isNew && !!id,
  });

  /** Roles are free text apart from the account's two designated slots. */
  function accountRoleLabel(role?: string | null): string {
    if (role === "Primary") return t('account.role_primary');
    if (role === "Secondary") return t('account.role_secondary');
    if (role === "Member" || !role) return t('account.role_member');
    return role;
  }

  async function handleUnlinkAccount(accountId: number) {
    if (!id) return;
    if (!window.confirm(t('contact.unlink_account_confirm'))) return;
    await apiFetch(`/api/v1/contacts/${id}/accounts/${accountId}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["contact-accounts", id] });
  }

  // Business cards are scanned before the contact necessarily exists, so the
  // uploaded images are held here and attached to the record once it is saved.
  const pendingCardsRef = useRef<PendingCards>({});
  const [docRefresh, setDocRefresh] = useState(0);

  async function attachPendingCards(contactId: number) {
    const cards = pendingCardsRef.current;
    if (!cards.front && !cards.back) return;
    try {
      await apiFetch(`/api/v1/contacts/${contactId}/business-card`, {
        method: "POST",
        body: JSON.stringify({
          ...(cards.front ? { front: cards.front } : {}),
          ...(cards.back ? { back: cards.back } : {}),
        }),
      });
      pendingCardsRef.current = {};
      setDocRefresh((n) => n + 1);
    } catch (err) {
      // The contact itself saved fine — surface the card failure without losing it.
      console.error("[contact] attaching business card failed", err);
    }
  }

  const createMutation = useCreateContact({
    mutation: {
      onSuccess: async (created) => {
        if (created?.id) await attachPendingCards(created.id);
        qc.invalidateQueries({ queryKey: getListContactsQueryKey() });
        navigate("/crm/contacts");
      },
    },
  });

  const updateMutation = useUpdateContact({
    mutation: {
      onSuccess: async () => {
        if (id) await attachPendingCards(id);
        qc.invalidateQueries({ queryKey: getListContactsQueryKey() });
        if (id) qc.invalidateQueries({ queryKey: getGetContactQueryKey(id) });
        navigate("/crm/contacts");
      },
    },
  });

  /**
   * Fill the address block from the 우편번호 lookup. Nationality follows the
   * address country as a default only — an existing value is never overwritten,
   * because a foreign national living in Korea has both, and they differ.
   */
  function applyAddress(a: { postcode: string; address: string; suburb: string; state: string; country: string }) {
    setValue("postcode", a.postcode, { shouldDirty: true });
    setValue("address_line1", a.address, { shouldDirty: true });
    setValue("suburb", a.suburb, { shouldDirty: true });
    setValue("state", a.state, { shouldDirty: true });
    const country = normaliseCountry(a.country);
    setValue("country", country, { shouldDirty: true });
    if (!getValues("nationality")) setValue("nationality", country, { shouldDirty: true });
  }

  /** Apply the OCR fields the admin ticked in the approval dialog. */
  function applyScannedFields(fields: Record<string, string>) {
    for (const [key, value] of Object.entries(fields)) {
      setValue(key as keyof ContactForm, value, { shouldDirty: true });
    }
  }

  const onSubmit = (values: ContactForm) => {
    const data = {
      ...values,
      date_of_birth: values.date_of_birth || null,
      nationality: values.nationality || null,
      gender: values.gender || null,
      mobile_number: values.mobile_number || null,
      office_number: values.office_number || null,
      passport_number: values.passport_number || null,
      passport_expiry: values.passport_expiry || null,
      visa_type: values.visa_type || null,
      visa_expiry: values.visa_expiry || null,
      address_line1: values.address_line1 || null,
      suburb: values.suburb || null,
      state: values.state || null,
      postcode: values.postcode || null,
      country: values.country || null,
      portal_user_id: values.portal_user_id || null,
      profile_photo_url: values.profile_photo_url || null,
      description: values.description || null,
      title: values.title || null,
      other_name: values.other_name || null,
      sns_id: values.sns_id || null,
      sns_type: values.sns_type || null,
      emergency_contact_name: values.emergency_contact_name || null,
      emergency_contact_phone: values.emergency_contact_phone || null,
      emergency_contact_email: values.emergency_contact_email || null,
      company_name: values.company_name || null,
      job_title: values.job_title || null,
      department: values.department || null,
      website: values.website || null,
    };
    if (isNew) {
      createMutation.mutate({ data });
    } else {
      updateMutation.mutate({ id: id!, data });
    }
  };

  if (!isNew && isLoading) return <Layout><p className="p-6 text-sm text-muted-foreground">{t('common.loading')}</p></Layout>;

  return (
    <Layout>
      <PageHeader
        title={isNew ? `${t("common.new")} ${t("nav.contact")}` : contact ? formatPersonName(contact.first_name, contact.last_name) : t("nav.contact")}
        actions={
          <div className="flex gap-2">
            <Link href="/crm/contacts">
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
        <Tabs defaultValue="details">
          <TabsList className="mb-5">
            <TabsTrigger value="details">{t('contact.tab_overview')}</TabsTrigger>
            <TabsTrigger value="bookings">{t('contact.tab_bookings')}</TabsTrigger>
            <TabsTrigger value="accounts">{t('contact.tab_accounts')}</TabsTrigger>
            <TabsTrigger value="documents">{t('contact.tab_documents')}</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Basic Info */}
                <div className="rounded-lg border p-4 space-y-4">
                  <h3 className="font-semibold text-sm">{t('contact.section_personal')}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="grid gap-1.5">
                      <Label>{t('common.title')}</Label>
                      <Controller name="title" control={control} render={({ field }) => (
                        <Select value={field.value || "__none"} onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}>
                          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">—</SelectItem>
                            <SelectItem value="Mr">Mr</SelectItem>
                            <SelectItem value="Ms">Ms</SelectItem>
                            <SelectItem value="Mrs">Mrs</SelectItem>
                            <SelectItem value="Dr">Dr</SelectItem>
                          </SelectContent>
                        </Select>
                      )} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_first_name')} *</Label>
                      <Input {...register("first_name", { required: true })} />
                      {errors.first_name && <p className="text-xs text-destructive">{t('common.field_required')}</p>}
                    </div>
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_last_name')} *</Label>
                      <Input {...register("last_name", { required: true })} />
                      {errors.last_name && <p className="text-xs text-destructive">{t('common.field_required')}</p>}
                    </div>
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_other_name')}</Label>
                      <Input {...register("other_name")} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_email')} *</Label>
                      <Input {...register("email", { required: true })} type="email" />
                      {errors.email && <p className="text-xs text-destructive">{t('common.field_required')}</p>}
                    </div>
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_mobile')}</Label>
                      <Input {...register("mobile_number")} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_office_phone')}</Label>
                      <Input {...register("office_number")} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_dob')}</Label>
                      <Controller name="date_of_birth" control={control} render={({ field }) => (
                        <DateInput value={field.value ?? ""} onChange={field.onChange} />
                      )} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_gender')}</Label>
                      <Controller name="gender" control={control} render={({ field }) => (
                        <Select value={field.value || "__none"} onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}>
                          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">—</SelectItem>
                            <SelectItem value="Male">{t('contact.gender_male')}</SelectItem>
                            <SelectItem value="Female">{t('contact.gender_female')}</SelectItem>
                            <SelectItem value="Other">{t('contact.gender_other')}</SelectItem>
                            <SelectItem value="PreferNotToSay">{t('contact.gender_prefer_not')}</SelectItem>
                          </SelectContent>
                        </Select>
                      )} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_nationality')}</Label>
                      <Controller name="nationality" control={control} render={({ field }) => (
                        <Select value={field.value || "__none"} onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}>
                          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">—</SelectItem>
                            {COUNTRIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )} />
                      {/* Defaults to the address country, then edited by hand when they differ. */}
                      <p className="text-xs text-muted-foreground">{t('contact.hint_nationality_follows_address')}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_sns_type')}</Label>
                      <Controller name="sns_type" control={control} render={({ field }) => (
                        <Select value={field.value || "__none"} onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}>
                          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">—</SelectItem>
                            {SNS_TYPES.map((n) => (
                              <SelectItem key={n} value={n}>{t(`contact.sns_${n.toLowerCase()}`)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )} />
                    </div>
                    <div className="grid gap-1.5 sm:col-span-2">
                      <Label>{t('contact.label_sns_id')}</Label>
                      <Input {...register("sns_id")} placeholder={SNS_PLACEHOLDER[snsType] ?? t('contact.ph_sns_id')} />
                    </div>
                  </div>
                </div>

                {/* Work — the fields a business card carries. */}
                <div className="rounded-lg border p-4 space-y-4">
                  <h3 className="font-semibold text-sm">{t('contact.section_work')}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_company')}</Label>
                      <Input {...register("company_name")} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_department')}</Label>
                      <Input {...register("department")} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_job_title')}</Label>
                      <Input {...register("job_title")} />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>{t('contact.label_website')}</Label>
                    <Input {...register("website")} placeholder="https://..." />
                  </div>
                </div>

                {/* Foreign-national details — passport/visa only matter for foreigners,
                    so the whole block is behind a toggle instead of sitting empty. */}
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-sm">{t('contact.section_foreigner')}</h3>
                      <p className="text-xs text-muted-foreground">{t('contact.hint_foreigner')}</p>
                    </div>
                    <Controller name="is_foreigner" control={control} render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    )} />
                  </div>
                  {isForeigner && (
                  <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_passport')}</Label>
                      <Input {...register("passport_number")} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_passport_expiry')}</Label>
                      <Controller name="passport_expiry" control={control} render={({ field }) => (
                        <DateInput value={field.value ?? ""} onChange={field.onChange} />
                      )} />
                      <ExpiryWarning label={t('contact.doc_passport')} dateStr={passportExpiry} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_visa_type')}</Label>
                      <Input {...register("visa_type")} placeholder={t('contact.ph_visa_example')} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_visa_expiry')}</Label>
                      <Controller name="visa_expiry" control={control} render={({ field }) => (
                        <DateInput value={field.value ?? ""} onChange={field.onChange} />
                      )} />
                      <ExpiryWarning label={t('contact.doc_visa')} dateStr={visaExpiry} />
                    </div>
                  </div>
                  </>
                  )}
                </div>

                {/* Address — looked up, not typed (see KoreanAddressSearch). */}
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-sm">{t('contact.section_address')}</h3>
                    <KoreanAddressSearch onSelect={applyAddress} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_postcode')}</Label>
                      <Input {...register("postcode")} placeholder="00000" />
                    </div>
                    <div className="grid gap-1.5 col-span-1 sm:col-span-3">
                      <Label>{t('contact.label_address')}</Label>
                      <Input {...register("address_line1")} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_state')}</Label>
                      <Input {...register("state")} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_city')}</Label>
                      <Input {...register("suburb")} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_country')}</Label>
                      <Controller name="country" control={control} render={({ field }) => (
                        <Select value={field.value || "__none"} onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}>
                          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">—</SelectItem>
                            {COUNTRIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )} />
                    </div>
                  </div>
                </div>

                {/* Emergency contact — next of kin, one inline entry. */}
                <div className="rounded-lg border p-4 space-y-4">
                  <h3 className="font-semibold text-sm">{t('contact.section_emergency')}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_emergency_name')}</Label>
                      <Input {...register("emergency_contact_name")} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_emergency_phone')}</Label>
                      <Input {...register("emergency_contact_phone")} placeholder="010-0000-0000" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_emergency_email')}</Label>
                      <Input {...register("emergency_contact_email")} type="email" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-4">
                {/* Profile photo + business card (upload, OCR, stored files) */}
                <ContactMediaPanel
                  contactId={id}
                  photoUrl={profilePhoto ?? ""}
                  onPhotoChange={(url) => setValue("profile_photo_url", url, { shouldDirty: true })}
                  getCurrentValues={() => getValues() as unknown as Record<string, string>}
                  onApplyFields={applyScannedFields}
                  onPendingCardsChange={(cards) => { pendingCardsRef.current = cards; }}
                  refreshToken={docRefresh}
                />

                {/* Portal */}
                <div className="rounded-lg border p-4 space-y-4">
                  <h3 className="font-semibold text-sm">{t('contact.section_portal')}</h3>
                  <div className="flex items-center justify-between">
                    <Label>{t('contact.label_portal_enabled')}</Label>
                    <Controller name="portal_enabled" control={control} render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    )} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>{t('contact.label_portal_email')}</Label>
                    <Input {...register("portal_user_id")} placeholder={t('contact.ph_linked_user_id')} />
                  </div>
                </div>

                {/* Settings */}
                <div className="rounded-lg border p-4 space-y-4">
                  <h3 className="font-semibold text-sm">{t('contact.section_settings')}</h3>
                  <div className="grid gap-1.5">
                    <Label>{t('contact.label_status')}</Label>
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

                {/* Notes */}
                <div className="rounded-lg border p-4 space-y-2">
                  <Label>{t('contact.label_description_notes')}</Label>
                  <Input {...register("description")} placeholder={t('common.ph_internal_notes')} />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bookings">
            <div className="p-8 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
              {t('contact.stub_bookings')}
            </div>
          </TabsContent>

          {/* ── Accounts this person belongs to ─────────────────────── */}
          <TabsContent value="accounts">
            {isNew ? (
              <div className="p-8 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                {t('contact.accounts_save_first')}
              </div>
            ) : (
              <>
                <div className="mb-3 flex justify-end max-w-3xl">
                  <Button size="sm" className="gap-1.5" onClick={() => setLinkAccountOpen(true)}>
                    <Link2 className="h-4 w-4" /> {t('contact.link_account')}
                  </Button>
                </div>
                <div className="rounded-md border bg-card overflow-x-auto max-w-3xl">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.label_name')}</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.label_type')}</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('account.col_role')}</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {!linkedAccounts?.length ? (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">{t('contact.empty_accounts')}</td></tr>
                      ) : (
                        linkedAccounts.map((a) => (
                          <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium">
                              <Link href={`/account/accounts/${a.id}`} className="text-primary hover:underline">{a.name}</Link>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{accountTypeLabel(t, a.account_type)}</td>
                            <td className="px-4 py-3 text-muted-foreground">{accountRoleLabel(a.role)}</td>
                            <td className="px-2 py-3 text-right">
                              <Button variant="ghost" size="icon" className="h-7 w-7"
                                title={t('contact.unlink_account')}
                                onClick={() => void handleUnlinkAccount(a.id)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </TabsContent>


          <TabsContent value="documents">
            <div className="p-8 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
              {t('contact.stub_documents')}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {!isNew && id && (
        <LinkContactAccountDialog
          contactId={id}
          open={linkAccountOpen}
          onOpenChange={setLinkAccountOpen}
          linkedAccountIds={(linkedAccounts ?? []).map((a) => a.id)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["contact-accounts", id] })}
        />
      )}
    </Layout>
  );
}

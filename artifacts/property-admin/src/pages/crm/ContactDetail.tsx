import { useEffect } from "react";
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
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { differenceInDays, parseISO } from "date-fns";

const COUNTRIES = [
  "Australia", "China", "South Korea", "Japan", "United States", "United Kingdom",
  "New Zealand", "Singapore", "India", "Canada", "Germany", "France", "Brazil",
  "Hong Kong", "Taiwan", "Vietnam", "Malaysia", "Indonesia", "Thailand",
];

const NATIONALITIES = COUNTRIES;

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

  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<ContactForm>({
    defaultValues: {
      first_name: "", last_name: "", title: "", other_name: "", email: "",
      mobile_number: "", office_number: "", date_of_birth: "", nationality: "",
      gender: "", sns_id: "", passport_number: "", passport_expiry: "", visa_type: "",
      visa_expiry: "", address_line1: "", suburb: "", state: "", postcode: "",
      country: "Australia", portal_enabled: false, portal_user_id: "", profile_photo_url: "",
      description: "", manual_input: false, status: "Active",
    },
  });

  const passportExpiry = watch("passport_expiry");
  const visaExpiry = watch("visa_expiry");
  const profilePhoto = watch("profile_photo_url");

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
        nationality: contact.nationality ?? "",
        gender: contact.gender ?? "",
        sns_id: contact.sns_id ?? "",
        passport_number: contact.passport_number ?? "",
        passport_expiry: contact.passport_expiry ?? "",
        visa_type: contact.visa_type ?? "",
        visa_expiry: contact.visa_expiry ?? "",
        address_line1: contact.address_line1 ?? "",
        suburb: contact.suburb ?? "",
        state: contact.state ?? "",
        postcode: contact.postcode ?? "",
        country: contact.country ?? "Australia",
        portal_enabled: contact.portal_enabled ?? false,
        portal_user_id: contact.portal_user_id ?? "",
        profile_photo_url: contact.profile_photo_url ?? "",
        description: contact.description ?? "",
        manual_input: contact.manual_input ?? false,
        status: contact.status ?? "Active",
      });
    }
  }, [contact, reset]);

  const createMutation = useCreateContact({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListContactsQueryKey() });
        navigate("/crm/contacts");
      },
    },
  });

  const updateMutation = useUpdateContact({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListContactsQueryKey() });
        if (id) qc.invalidateQueries({ queryKey: getGetContactQueryKey(id) });
        navigate("/crm/contacts");
      },
    },
  });

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
        title={isNew ? `${t("common.new")} ${t("nav.contact")}` : contact ? `${contact.first_name} ${contact.last_name}` : t("nav.contact")}
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
                            {NATIONALITIES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )} />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>{t('contact.label_sns_id')}</Label>
                    <Input {...register("sns_id")} placeholder="WeChat / KakaoTalk / LINE ID" />
                  </div>
                </div>

                {/* KYC */}
                <div className="rounded-lg border p-4 space-y-4">
                  <h3 className="font-semibold text-sm">{t('contact.section_identity')}</h3>
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
                </div>

                {/* Address */}
                <div className="rounded-lg border p-4 space-y-4">
                  <h3 className="font-semibold text-sm">{t('contact.section_address')}</h3>
                  <div className="grid gap-1.5">
                    <Label>{t('contact.label_address')}</Label>
                    <Input {...register("address_line1")} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="grid gap-1.5 col-span-2">
                      <Label>{t('contact.label_city')}</Label>
                      <Input {...register("suburb")} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_state')}</Label>
                      <Input {...register("state")} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>{t('contact.label_postcode')}</Label>
                      <Input {...register("postcode")} />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>{t('contact.label_country')}</Label>
                    <Controller name="country" control={control} render={({ field }) => (
                      <Select value={field.value || "__none"} onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">—</SelectItem>
                          {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )} />
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-4">
                {/* Photo */}
                {profilePhoto && (
                  <div className="rounded-lg border p-4">
                    <Label className="mb-2 block">{t('contact.photo_preview')}</Label>
                    <img src={profilePhoto} alt="Profile" className="w-full max-h-40 object-contain rounded" />
                  </div>
                )}
                <div className="rounded-lg border p-4 space-y-4">
                  <h3 className="font-semibold text-sm">{t('contact.section_photo_url')}</h3>
                  <Input {...register("profile_photo_url")} placeholder="https://..." />
                </div>

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

          <TabsContent value="accounts">
            <div className="p-8 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
              {t('contact.stub_accounts')}
            </div>
          </TabsContent>

          <TabsContent value="documents">
            <div className="p-8 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
              {t('contact.stub_documents')}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

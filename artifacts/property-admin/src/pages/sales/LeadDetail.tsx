import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { formatDateTime } from "@/lib/date";
import { formatPersonName } from "@/lib/nameFormat";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import {
  useGetLead, useCreateLead, useUpdateLead, useConvertLead, useMarkLeadLost,
  getListLeadsQueryKey, getGetLeadQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { TenantLinkCard } from "@/components/TenantLinkCard";
import { useBrand } from "@/contexts/ThemeContext";
import { ArrowLeft, Save, TrendingDown, ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import { LookupSelect } from "@/components/LookupSelect";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const LEAD_STATUS_COLORS: Record<string, string> = {
  New: "bg-gray-100 text-gray-700 border-gray-200",
  Contacted: "bg-blue-100 text-blue-700 border-blue-200",
  Qualified: "bg-amber-100 text-amber-700 border-amber-200",
  ConvertedToBooking: "bg-green-100 text-green-700 border-green-200",
  Lost: "bg-red-100 text-red-700 border-red-200",
};

function LeadStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const cls = LEAD_STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700";
  const label = status === "ConvertedToBooking" ? t("lead.status_converted_booking") : status;
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{label}</span>;
}

const COUNTRY_OPTIONS = [
  { code: "AU", label: "🇦🇺 Australia" }, { code: "CN", label: "🇨🇳 China" },
  { code: "KR", label: "🇰🇷 Korea" }, { code: "JP", label: "🇯🇵 Japan" },
  { code: "US", label: "🇺🇸 United States" }, { code: "GB", label: "🇬🇧 United Kingdom" },
  { code: "IN", label: "🇮🇳 India" }, { code: "NZ", label: "🇳🇿 New Zealand" },
  { code: "SG", label: "🇸🇬 Singapore" }, { code: "HK", label: "🇭🇰 Hong Kong" },
  { code: "TW", label: "🇹🇼 Taiwan" }, { code: "VN", label: "🇻🇳 Vietnam" },
  { code: "TH", label: "🇹🇭 Thailand" }, { code: "MY", label: "🇲🇾 Malaysia" },
  { code: "ID", label: "🇮🇩 Indonesia" }, { code: "PH", label: "🇵🇭 Philippines" },
  { code: "FR", label: "🇫🇷 France" }, { code: "DE", label: "🇩🇪 Germany" },
  { code: "IT", label: "🇮🇹 Italy" }, { code: "ES", label: "🇪🇸 Spain" },
];

interface LeadForm {
  first_name: string; last_name: string; email: string; phone: string;
  nationality: string; lead_source: string; lead_status: string;
  inquiry_type: string; message: string;
  preferred_space_type: string; preferred_check_in_date: string;
  preferred_duration_weeks: string; preferred_suburb_id: number | null;
  budget_min: string; budget_max: string; budget_currency: string;
  assigned_to: string; description: string; status: string;
}

interface ConvertForm {
  space_id: number | null;
  check_in_date: string;
  check_out_date: string;
  agreed_weekly_rate: string;
}

export default function LeadDetail() {
  const { t } = useTranslation();
  const { currency: brandCurrency } = useBrand();
  const params = useParams<{ id: string }>();
  const isNew = !params.id || params.id === "new";
  const id = isNew ? null : parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertForm, setConvertForm] = useState<ConvertForm>({
    space_id: null, check_in_date: "", check_out_date: "", agreed_weekly_rate: "",
  });

  const { data: lead, isLoading } = useGetLead(
    id!, { query: { enabled: !isNew && !!id, queryKey: getGetLeadQueryKey(id!) } }
  );

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<LeadForm>({
    defaultValues: {
      first_name: "", last_name: "", email: "", phone: "",
      nationality: "", lead_source: "", lead_status: "New",
      inquiry_type: "", message: "",
      preferred_space_type: "", preferred_check_in_date: "",
      preferred_duration_weeks: "", preferred_suburb_id: null,
      budget_min: "", budget_max: "", budget_currency: brandCurrency,
      assigned_to: "", description: "", status: "Active",
    },
  });

  useEffect(() => {
    if (lead) {
      reset({
        first_name: lead.first_name ?? "",
        last_name: lead.last_name ?? "",
        email: lead.email ?? "",
        phone: lead.phone ?? "",
        nationality: lead.nationality ?? "",
        lead_source: lead.lead_source ?? "",
        lead_status: lead.lead_status ?? "New",
        inquiry_type: lead.inquiry_type ?? "",
        message: lead.message ?? "",
        preferred_space_type: lead.preferred_space_type ?? "",
        preferred_check_in_date: lead.preferred_check_in_date ?? "",
        preferred_duration_weeks: lead.preferred_duration_weeks?.toString() ?? "",
        preferred_suburb_id: lead.preferred_suburb_id ?? null,
        budget_min: lead.budget_min?.toString() ?? "",
        budget_max: lead.budget_max?.toString() ?? "",
        budget_currency: lead.budget_currency ?? brandCurrency,
        assigned_to: lead.assigned_to ?? "",
        description: lead.description ?? "",
        status: lead.status ?? "Active",
      });
    }
  }, [lead, reset]);

  const createMutation = useCreateLead({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        navigate(`/sales/leads/${data.id}`);
      },
    },
  });

  const updateMutation = useUpdateLead({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        if (id) qc.invalidateQueries({ queryKey: getGetLeadQueryKey(id) });
      },
    },
  });

  const convertMutation = useConvertLead({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        if (id) qc.invalidateQueries({ queryKey: getGetLeadQueryKey(id) });
        setConvertOpen(false);
        alert(t("lead.convert_success", { ref: data.booking_ref }));
      },
    },
  });

  const markLostMutation = useMarkLeadLost({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        if (id) qc.invalidateQueries({ queryKey: getGetLeadQueryKey(id) });
      },
    },
  });

  const onSubmit = (values: LeadForm) => {
    const data = {
      first_name: values.first_name,
      last_name: values.last_name,
      email: values.email,
      phone: values.phone || null,
      nationality: values.nationality || null,
      lead_source: values.lead_source || null,
      lead_status: values.lead_status,
      inquiry_type: values.inquiry_type || null,
      message: values.message || null,
      preferred_space_type: values.preferred_space_type || null,
      preferred_check_in_date: values.preferred_check_in_date || null,
      preferred_duration_weeks: values.preferred_duration_weeks ? parseInt(values.preferred_duration_weeks, 10) : null,
      preferred_suburb_id: values.preferred_suburb_id ?? null,
      budget_min: values.budget_min || null,
      budget_max: values.budget_max || null,
      budget_currency: values.budget_currency || brandCurrency,
      assigned_to: values.assigned_to || null,
      description: values.description || null,
      status: values.status,
    };
    if (isNew) {
      createMutation.mutate({ data });
    } else {
      updateMutation.mutate({ id: id!, data });
    }
  };

  const canConvert = !isNew && lead?.lead_status !== "ConvertedToBooking" && lead?.lead_status !== "Lost";
  const canMarkLost = !isNew && lead?.lead_status !== "Lost" && lead?.lead_status !== "ConvertedToBooking";

  if (!isNew && isLoading) return <Layout><p className="p-6 text-sm text-muted-foreground">{t("common.loading")}</p></Layout>;

  return (
    <Layout>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {isNew ? `${t("common.new")} ${t("nav.lead")}` : formatPersonName(lead?.first_name, lead?.last_name)}
            {!isNew && lead && <LeadStatusBadge status={lead.lead_status} />}
          </span>
        }
        subtitle={!isNew && lead ? (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t("lead.label_ref")}:</span> {lead.lead_ref}
          </div>
        ) : undefined}
        actions={
          <div className="flex gap-2">
            <Link href="/sales/leads">
              <Button variant="outline" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> {t("common.back")}</Button>
            </Link>
            {canMarkLost && (
              <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50"
                onClick={() => markLostMutation.mutate({ id: id! })}
                disabled={markLostMutation.isPending}>
                <TrendingDown className="h-4 w-4" /> {t("lead.btn_mark_lost")}
              </Button>
            )}
            {canConvert && (
              <Button size="sm" variant="outline" className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
                onClick={() => setConvertOpen(true)}>
                <ArrowUpRight className="h-4 w-4" /> {t("lead.btn_convert")}
              </Button>
            )}
            <Button size="sm" className="gap-1.5" onClick={handleSubmit(onSubmit)}
              disabled={createMutation.isPending || updateMutation.isPending}>
              <Save className="h-4 w-4" /> {t("common.save")}
            </Button>
          </div>
        }
      />
      <div className="p-4 sm:p-6 max-w-2xl">
        <div className="grid gap-5">
          {/* General */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-primary/10 border-b px-4 py-2 text-xs font-semibold text-primary uppercase tracking-wider">{t("lead.section_general")}</div>
            <div className="p-4 grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>{t("lead.label_first_name")} *</Label>
                  <Input {...register("first_name", { required: true })} placeholder={t("lead.ph_first_name")} />
                  {errors.first_name && <p className="text-xs text-destructive">{t("lead.err_required")}</p>}
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("lead.label_last_name")} *</Label>
                  <Input {...register("last_name", { required: true })} placeholder={t("lead.ph_last_name")} />
                  {errors.last_name && <p className="text-xs text-destructive">{t("lead.err_required")}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>{t("lead.label_email")} *</Label>
                  <Input {...register("email", { required: true })} type="email" placeholder={t("lead.ph_email")} />
                  {errors.email && <p className="text-xs text-destructive">{t("lead.err_required")}</p>}
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("lead.label_phone")}</Label>
                  <Input {...register("phone")} placeholder={t("lead.ph_phone")} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>{t("lead.label_nationality")}</Label>
                <Controller name="nationality" control={control} render={({ field }) => (
                  <Select value={field.value || "__none"} onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder={t("lead.ph_nationality")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">{t("lead.opt_none")}</SelectItem>
                      {COUNTRY_OPTIONS.map((c) => (
                        <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
          </div>

          {/* Inquiry */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-primary/10 border-b px-4 py-2 text-xs font-semibold text-primary uppercase tracking-wider">{t("lead.section_contact")}</div>
            <div className="p-4 grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>{t("lead.label_source")}</Label>
                  <Controller name="lead_source" control={control} render={({ field }) => (
                    <Select value={field.value || "__none"} onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder={t("lead.ph_source")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">{t("lead.opt_none")}</SelectItem>
                        <SelectItem value="Website">{t("lead.source_website")}</SelectItem>
                        <SelectItem value="Agent">{t("lead.source_agent")}</SelectItem>
                        <SelectItem value="Referral">{t("lead.source_referral")}</SelectItem>
                        <SelectItem value="WalkIn">{t("lead.source_walkin")}</SelectItem>
                        <SelectItem value="OTA">{t("lead.source_ota")}</SelectItem>
                        <SelectItem value="Social">{t("lead.source_social")}</SelectItem>
                        <SelectItem value="Other">{t("lead.source_other")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("lead.label_status")}</Label>
                  <Controller name="lead_status" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="New">{t("lead.status_new")}</SelectItem>
                        <SelectItem value="Contacted">{t("lead.status_contacted")}</SelectItem>
                        <SelectItem value="Qualified">{t("lead.status_qualified")}</SelectItem>
                        <SelectItem value="ConvertedToBooking">{t("lead.status_converted_booking")}</SelectItem>
                        <SelectItem value="Lost">{t("lead.status_lost")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>{t("lead.label_inquiry_type")}</Label>
                <Input {...register("inquiry_type")} placeholder={t("lead.ph_inquiry_type")} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("lead.label_message")}</Label>
                <Textarea {...register("message")} placeholder={t("lead.ph_message")} rows={4} />
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-primary/10 border-b px-4 py-2 text-xs font-semibold text-primary uppercase tracking-wider">{t("lead.section_property")}</div>
            <div className="p-4 grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>{t("lead.label_property")}</Label>
                  <Controller name="preferred_space_type" control={control} render={({ field }) => (
                    <Select value={field.value || "__none"} onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder={t("lead.ph_space_type")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">{t("lead.opt_any")}</SelectItem>
                        <SelectItem value="EntireSpace">{t("lead.space_entire")}</SelectItem>
                        <SelectItem value="RoomSpace">{t("lead.space_room")}</SelectItem>
                        <SelectItem value="BedSpace">{t("lead.space_bed")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("lead.label_move_in")}</Label>
                  <Controller name="preferred_check_in_date" control={control} render={({ field }) => (
                    <DateInput value={field.value ?? ""} onChange={field.onChange} />
                  )} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>{t("lead.label_duration")}</Label>
                  <Input {...register("preferred_duration_weeks")} type="number" min={1} placeholder={t("lead.ph_duration")} />
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("lead.label_suburb")}</Label>
                  <Controller name="preferred_suburb_id" control={control} render={({ field }) => (
                    <LookupSelect
                      value={field.value}
                      onChange={field.onChange}
                      lookupUrl="/api/v1/lookup/suburbs"
                      placeholder={t("lead.ph_search_suburbs")}
                    />
                  )} />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label>{t("lead.label_budget", { currency: brandCurrency })}</Label>
                <div className="flex items-center gap-2">
                  <Controller name="budget_currency" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="KRW">KRW</SelectItem>
                        <SelectItem value="AUD">AUD</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="CNY">CNY</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                  <Input {...register("budget_min")} type="number" step="50" placeholder={t("lead.ph_min")} className="flex-1" />
                  <span className="text-muted-foreground text-sm">–</span>
                  <Input {...register("budget_max")} type="number" step="50" placeholder={t("lead.ph_max")} className="flex-1" />
                </div>
              </div>
            </div>
          </div>

          {/* Conversion info */}
          {!isNew && lead?.lead_status === "ConvertedToBooking" && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-green-50 border-b px-4 py-2 text-xs font-semibold text-green-700 uppercase tracking-wider">{t("lead.section_conversion")}</div>
              <div className="p-4 grid gap-2 text-sm">
                {lead.converted_booking_id && (
                  <div><span className="text-muted-foreground">{t("lead.label_booking_id")}</span> <span className="font-medium">{lead.converted_booking_id}</span></div>
                )}
                {lead.converted_at && (
                  <div><span className="text-muted-foreground">{t("lead.label_converted_at")}</span> <span className="font-medium">{formatDateTime(lead.converted_at)}</span></div>
                )}
              </div>
            </div>
          )}

          {/* Assignment */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-primary/10 border-b px-4 py-2 text-xs font-semibold text-primary uppercase tracking-wider">{t("lead.section_details")}</div>
            <div className="p-4">
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label>{t("lead.label_assigned")}</Label>
                  <Input {...register("assigned_to")} placeholder={t("lead.ph_assigned")} />
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-primary/10 border-b px-4 py-2 text-xs font-semibold text-primary uppercase tracking-wider">{t("lead.label_notes")}</div>
            <div className="p-4">
              <Textarea {...register("description")} placeholder={t("lead.ph_notes")} rows={3} />
            </div>
          </div>

          {/* Admin */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-primary/10 border-b px-4 py-2 text-xs font-semibold text-primary uppercase tracking-wider">{t("lead.section_admin")}</div>
            <div className="p-4 grid gap-4">
              <div className="grid gap-1.5">
                <Label>{t("lead.label_record_status")}</Label>
                <Controller name="status" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">{t("common.active")}</SelectItem>
                      <SelectItem value="Inactive">{t("common.inactive")}</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              {!isNew && lead && (
                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                  <div><span className="font-medium text-foreground">{t("common.created")}:</span> {formatDateTime(lead.created_at)}</div>
                  <div><span className="font-medium text-foreground">{t("common.updated")}:</span> {formatDateTime(lead.updated_at)}</div>
                </div>
              )}
            </div>
          </div>

          {/* 임차 신청서 — 계약보다 먼저 서는 단계라 문의에 붙는다. 승인하면
              연락처가 만들어지고, 그 연락처를 계약의 임차인 자리에 물린다. */}
          {!isNew && id && (
            <TenantLinkCard
              kind="application"
              issuePath={`/api/v1/leads/${id}/apply-link`}
              listPath={`/api/v1/leads/${id}/apply-link`}
              defaultEmail={lead?.email ?? null}
            />
          )}
        </div>
      </div>

      {/* Convert to Booking Dialog */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("lead.convert_title")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <p className="text-sm text-muted-foreground">{t("lead.convert_desc")}</p>
            <div className="grid gap-1.5">
              <Label>{t("lead.label_space")} *</Label>
              <LookupSelect
                value={convertForm.space_id}
                onChange={(val) => setConvertForm((f) => ({ ...f, space_id: val }))}
                lookupUrl="/api/v1/lookup/spaces"
                placeholder={t("lead.ph_search_spaces")}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t("lead.label_check_in")} *</Label>
                <DateInput value={convertForm.check_in_date}
                  onChange={(v) => setConvertForm((f) => ({ ...f, check_in_date: v }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("lead.label_check_out")} *</Label>
                <DateInput value={convertForm.check_out_date}
                  onChange={(v) => setConvertForm((f) => ({ ...f, check_out_date: v }))} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("lead.label_weekly_rate")}</Label>
              <Input type="number" step="0.01" placeholder={t("lead.ph_weekly_rate")} value={convertForm.agreed_weekly_rate}
                onChange={(e) => setConvertForm((f) => ({ ...f, agreed_weekly_rate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertOpen(false)}>{t("common.cancel")}</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={!convertForm.space_id || !convertForm.check_in_date || !convertForm.check_out_date || convertMutation.isPending}
              onClick={() => {
                if (!id || !convertForm.space_id) return;
                convertMutation.mutate({
                  id,
                  data: {
                    space_id: convertForm.space_id,
                    check_in_date: convertForm.check_in_date,
                    check_out_date: convertForm.check_out_date,
                    agreed_weekly_rate: convertForm.agreed_weekly_rate || null,
                  },
                });
              }}>
              {t("lead.btn_confirm_conversion")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

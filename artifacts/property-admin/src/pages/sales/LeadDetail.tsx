import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
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
  const cls = LEAD_STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700";
  const label = status === "ConvertedToBooking" ? "Converted to Booking" : status;
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
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
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
      budget_min: "", budget_max: "", budget_currency: "AUD",
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
        budget_currency: lead.budget_currency ?? "AUD",
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
        alert(`Converted! Booking Ref: ${data.booking_ref}`);
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
      budget_currency: values.budget_currency || "AUD",
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

  if (!isNew && isLoading) return <Layout><p className="p-6 text-sm text-muted-foreground">Loading…</p></Layout>;

  return (
    <Layout>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {isNew ? `${t("common.new")} ${t("nav.lead")}` : `${lead?.first_name ?? ""} ${lead?.last_name ?? ""}`}
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
                <TrendingDown className="h-4 w-4" /> Mark as Lost
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
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">{t("lead.section_general")}</div>
            <div className="p-4 grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>{t("lead.label_first_name")} *</Label>
                  <Input {...register("first_name", { required: true })} placeholder="First name" />
                  {errors.first_name && <p className="text-xs text-destructive">Required</p>}
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("lead.label_last_name")} *</Label>
                  <Input {...register("last_name", { required: true })} placeholder="Last name" />
                  {errors.last_name && <p className="text-xs text-destructive">Required</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>{t("lead.label_email")} *</Label>
                  <Input {...register("email", { required: true })} type="email" placeholder="email@example.com" />
                  {errors.email && <p className="text-xs text-destructive">Required</p>}
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("lead.label_phone")}</Label>
                  <Input {...register("phone")} placeholder="+61 4xx xxx xxx" />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Nationality</Label>
                <Controller name="nationality" control={control} render={({ field }) => (
                  <Select value={field.value || "__none"} onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Select nationality" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— None —</SelectItem>
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
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">{t("lead.section_contact")}</div>
            <div className="p-4 grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>{t("lead.label_source")}</Label>
                  <Controller name="lead_source" control={control} render={({ field }) => (
                    <Select value={field.value || "__none"} onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">— None —</SelectItem>
                        <SelectItem value="Website">Website</SelectItem>
                        <SelectItem value="Agent">Agent</SelectItem>
                        <SelectItem value="Referral">Referral</SelectItem>
                        <SelectItem value="WalkIn">Walk-In</SelectItem>
                        <SelectItem value="OTA">OTA</SelectItem>
                        <SelectItem value="Social">Social</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
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
                        <SelectItem value="New">New</SelectItem>
                        <SelectItem value="Contacted">Contacted</SelectItem>
                        <SelectItem value="Qualified">Qualified</SelectItem>
                        <SelectItem value="ConvertedToBooking">Converted to Booking</SelectItem>
                        <SelectItem value="Lost">Lost</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Inquiry Type</Label>
                <Input {...register("inquiry_type")} placeholder="e.g. Room rental enquiry" />
              </div>
              <div className="grid gap-1.5">
                <Label>Message</Label>
                <Textarea {...register("message")} placeholder="Enquiry message from lead…" rows={4} />
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">{t("lead.section_property")}</div>
            <div className="p-4 grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>{t("lead.label_property")}</Label>
                  <Controller name="preferred_space_type" control={control} render={({ field }) => (
                    <Select value={field.value || "__none"} onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Any type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">— Any —</SelectItem>
                        <SelectItem value="EntireSpace">Entire Space</SelectItem>
                        <SelectItem value="RoomSpace">Room Space</SelectItem>
                        <SelectItem value="BedSpace">Bed Space</SelectItem>
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
                  <Input {...register("preferred_duration_weeks")} type="number" min={1} placeholder="e.g. 12" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Preferred Suburb</Label>
                  <Controller name="preferred_suburb_id" control={control} render={({ field }) => (
                    <LookupSelect
                      value={field.value}
                      onChange={field.onChange}
                      lookupUrl="/api/v1/lookup/suburbs"
                      placeholder="Search suburbs…"
                    />
                  )} />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label>{t("lead.label_budget")}</Label>
                <div className="flex items-center gap-2">
                  <Controller name="budget_currency" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AUD">AUD</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="CNY">CNY</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                  <Input {...register("budget_min")} type="number" step="50" placeholder="Min" className="flex-1" />
                  <span className="text-muted-foreground text-sm">–</span>
                  <Input {...register("budget_max")} type="number" step="50" placeholder="Max" className="flex-1" />
                </div>
              </div>
            </div>
          </div>

          {/* Conversion info */}
          {!isNew && lead?.lead_status === "ConvertedToBooking" && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-green-50 border-b px-4 py-2 text-xs font-semibold text-green-700 uppercase tracking-wider">Conversion</div>
              <div className="p-4 grid gap-2 text-sm">
                {lead.converted_booking_id && (
                  <div><span className="text-muted-foreground">Booking ID:</span> <span className="font-medium">{lead.converted_booking_id}</span></div>
                )}
                {lead.converted_at && (
                  <div><span className="text-muted-foreground">Converted At:</span> <span className="font-medium">{new Date(lead.converted_at).toLocaleString()}</span></div>
                )}
              </div>
            </div>
          )}

          {/* Assignment */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">{t("lead.section_details")}</div>
            <div className="p-4">
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label>{t("lead.label_assigned")}</Label>
                  <Input {...register("assigned_to")} placeholder="Staff member name or ID" />
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">{t("lead.label_notes")}</div>
            <div className="p-4">
              <Textarea {...register("description")} placeholder="Internal notes…" rows={3} />
            </div>
          </div>

          {/* Admin */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">Admin</div>
            <div className="p-4 grid gap-4">
              <div className="grid gap-1.5">
                <Label>Record Status</Label>
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
              {!isNew && lead && (
                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                  <div><span className="font-medium text-foreground">Created:</span> {new Date(lead.created_at).toLocaleString()}</div>
                  <div><span className="font-medium text-foreground">Updated:</span> {new Date(lead.updated_at).toLocaleString()}</div>
                </div>
              )}
            </div>
          </div>
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
              <Label>Space *</Label>
              <LookupSelect
                value={convertForm.space_id}
                onChange={(val) => setConvertForm((f) => ({ ...f, space_id: val }))}
                lookupUrl="/api/v1/lookup/spaces"
                placeholder="Search spaces…"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Check-In Date *</Label>
                <DateInput value={convertForm.check_in_date}
                  onChange={(v) => setConvertForm((f) => ({ ...f, check_in_date: v }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>Check-Out Date *</Label>
                <DateInput value={convertForm.check_out_date}
                  onChange={(v) => setConvertForm((f) => ({ ...f, check_out_date: v }))} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Agreed Weekly Rate</Label>
              <Input type="number" step="0.01" placeholder="Auto-filled from space" value={convertForm.agreed_weekly_rate}
                onChange={(e) => setConvertForm((f) => ({ ...f, agreed_weekly_rate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertOpen(false)}>Cancel</Button>
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
              Confirm Conversion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

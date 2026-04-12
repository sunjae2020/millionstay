import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Calendar, Package, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-yellow-100 text-yellow-700",
  Archived: "bg-red-100 text-red-600",
};

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; description: string }> = {
  one_time:  { label: "One-time Fee",      icon: Zap,      description: "Flat fee charged once. e.g. Admission, Cleaning, Deposit." },
  scheduled: { label: "Scheduled Service", icon: Calendar, description: "Service that requires date/time scheduling. e.g. Airport Pickup." },
  physical:  { label: "Physical Product",  icon: Package,  description: "Tangible item delivered to the guest. e.g. SIM Card, Linen Pack." },
};

async function fetchService(id: string) {
  const res = await apiFetch(`/api/v1/services/${id}`);
  if (!res.ok) throw new Error("Not found");
  return res.json();
}

interface FormData {
  name: string;
  description: string;
  service_type: string;
  base_price: string;
  currency: string;
  is_optional: boolean;
  is_refundable: boolean;
  billing_trigger: string;
  gst_included: boolean;
  requires_scheduling: boolean;
  scheduling_notes: string;
  stock_tracked: boolean;
  stock_qty: string;
  has_variants: boolean;
  variant_options: string;
  display_on_booking_page: boolean;
  sort_order: string;
  status: string;
}

const DEFAULTS: FormData = {
  name: "", description: "", service_type: "one_time",
  base_price: "", currency: "AUD",
  is_optional: true, is_refundable: false, billing_trigger: "at_booking",
  gst_included: false, requires_scheduling: false, scheduling_notes: "",
  stock_tracked: false, stock_qty: "", has_variants: false, variant_options: "",
  display_on_booking_page: true, sort_order: "0", status: "Active",
};

export default function ServiceDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = id === "new";

  const { data: service } = useQuery({
    queryKey: ["service", id],
    queryFn: () => fetchService(id!),
    enabled: !isNew,
  });

  const { register, handleSubmit, setValue, watch, control } = useForm<FormData>({
    values: service ? {
      name:                   service.name ?? "",
      description:            service.description ?? "",
      service_type:           service.service_type ?? "one_time",
      base_price:             service.base_price != null ? String(service.base_price) : "",
      currency:               service.currency ?? "AUD",
      is_optional:            service.is_optional ?? true,
      is_refundable:          service.is_refundable ?? false,
      billing_trigger:        service.billing_trigger ?? "at_booking",
      gst_included:           service.gst_included ?? false,
      requires_scheduling:    service.requires_scheduling ?? false,
      scheduling_notes:       service.scheduling_notes ?? "",
      stock_tracked:          service.stock_tracked ?? false,
      stock_qty:              service.stock_qty != null ? String(service.stock_qty) : "",
      has_variants:           service.has_variants ?? false,
      variant_options:        service.variant_options ?? "",
      display_on_booking_page: service.display_on_booking_page ?? true,
      sort_order:             service.sort_order != null ? String(service.sort_order) : "0",
      status:                 service.status ?? "Active",
    } : DEFAULTS,
  });

  const watchedType = watch("service_type");
  const watchedScheduling = watch("requires_scheduling");
  const watchedStockTracked = watch("stock_tracked");
  const watchedHasVariants = watch("has_variants");

  const save = useMutation({
    mutationFn: async (values: FormData) => {
      const body = {
        ...values,
        base_price:  values.base_price  ? Number(values.base_price)  : null,
        sort_order:  values.sort_order  ? Number(values.sort_order)  : 0,
        stock_qty:   values.stock_qty   ? Number(values.stock_qty)   : null,
        requires_scheduling: values.service_type === "scheduled" ? values.requires_scheduling : false,
        stock_tracked:       values.service_type === "physical"  ? values.stock_tracked       : false,
        has_variants:        values.service_type === "physical"  ? values.has_variants        : false,
      };
      const url = isNew ? "/api/v1/services" : `/api/v1/services/${id}`;
      const res = await apiFetch(url, {
        method: isNew ? "POST" : "PUT",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Saved", description: "Service saved successfully." });
      qc.invalidateQueries({ queryKey: ["services"] });
      if (isNew) navigate(`/services/${data.id}`);
      else qc.invalidateQueries({ queryKey: ["service", id] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const typeConf = TYPE_CONFIG[watchedType];
  const Icon = typeConf?.icon ?? Zap;

  return (
    <Layout>
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/services")} className="p-1.5 rounded hover:bg-muted transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span>{isNew ? `${t("common.new")} ${t("nav.service")}` : (service?.name ?? t("nav.service"))}</span>
            {service?.status && (
              <Badge className={`text-xs ${STATUS_COLORS[service.status] ?? ""}`}>{service.status}</Badge>
            )}
          </div>
        }
        actions={
          <Button onClick={handleSubmit((d) => save.mutate(d))} disabled={save.isPending}>
            <Save className="h-4 w-4 mr-2" />{save.isPending ? t('common.saving') : t('common.save')}
          </Button>
        }
      />

      <form onSubmit={handleSubmit((d) => save.mutate(d))} className="p-6 max-w-3xl space-y-5">

        {/* Basic Info */}
        <div className="border rounded-lg bg-white overflow-hidden">
          <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">
            {t('service.section_general')}
          </div>
          <div className="p-5 space-y-4">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('service.label_name')} *</Label>
              <Input {...register("name")} placeholder="e.g. Airport Pickup — Melbourne" />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('service.label_description')}</Label>
              <Textarea {...register("description")} rows={3} placeholder={t('service.description_placeholder')} />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('service.label_type')} *</Label>
              <Controller name="service_type" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_CONFIG).map(([key, conf]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <conf.icon className="h-3.5 w-3.5" />
                          <span>{conf.label}</span>
                          <span className="text-xs text-muted-foreground hidden sm:inline">— {conf.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
              {typeConf && (
                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                  <Icon className="h-3 w-3" />{typeConf.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="border rounded-lg bg-white overflow-hidden">
          <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">
            {t('service.section_pricing')}
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('service.label_price')}</Label>
              <Input {...register("base_price")} type="number" step="0.01" min="0" placeholder="0.00" />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('service.label_billing_trigger')}</Label>
              <Controller name="billing_trigger" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="at_booking">{t('service.trigger_at_booking')}</SelectItem>
                    <SelectItem value="at_checkout">{t('service.trigger_at_checkout')}</SelectItem>
                    <SelectItem value="on_request">{t('service.trigger_on_request')}</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="flex items-center gap-3">
              <Controller name="is_refundable" control={control} render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )} />
              <div>
                <Label className="cursor-pointer">{t('service.label_refundable')}</Label>
                <p className="text-xs text-muted-foreground">{t('service.refundable_desc')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Controller name="gst_included" control={control} render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )} />
              <Label className="cursor-pointer">{t('service.label_gst_included')}</Label>
            </div>
          </div>
        </div>

        {/* Scheduled Service Fields */}
        {watchedType === "scheduled" && (
          <div className="border rounded-lg bg-white overflow-hidden">
            <div className="bg-purple-50 border-b px-4 py-2 text-xs font-semibold text-purple-700 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />{t('service.section_scheduling')}
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Controller name="requires_scheduling" control={control} render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )} />
                <div>
                  <Label className="cursor-pointer">{t('service.label_requires_scheduling')}</Label>
                  <p className="text-xs text-muted-foreground">{t('service.scheduling_desc')}</p>
                </div>
              </div>
              {watchedScheduling && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('service.label_scheduling_notes')}</Label>
                  <Textarea {...register("scheduling_notes")} rows={3}
                    placeholder="e.g. Please provide: arrival date, flight number, airline, number of passengers." />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Physical Product Fields */}
        {watchedType === "physical" && (
          <div className="border rounded-lg bg-white overflow-hidden">
            <div className="bg-amber-50 border-b px-4 py-2 text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-2">
              <Package className="h-3.5 w-3.5" />{t('service.section_physical')}
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Controller name="stock_tracked" control={control} render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )} />
                <div>
                  <Label className="cursor-pointer">{t('service.label_stock_tracked')}</Label>
                  <p className="text-xs text-muted-foreground">{t('service.stock_tracked_desc')}</p>
                </div>
              </div>
              {watchedStockTracked && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('service.label_stock_qty')}</Label>
                  <Input {...register("stock_qty")} type="number" min="0" placeholder="0" className="w-32" />
                </div>
              )}
              <Separator />
              <div className="flex items-center gap-3">
                <Controller name="has_variants" control={control} render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )} />
                <div>
                  <Label className="cursor-pointer">{t('service.label_has_variants')}</Label>
                  <p className="text-xs text-muted-foreground">{t('service.has_variants_desc')}</p>
                </div>
              </div>
              {watchedHasVariants && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('service.label_variant_options')}</Label>
                  <Input {...register("variant_options")} placeholder="e.g. Small, Medium, Large" />
                  <p className="text-xs text-muted-foreground mt-1">{t('service.variant_options_desc')}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Display & Status */}
        <div className="border rounded-lg bg-white overflow-hidden">
          <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">
            {t('service.section_display')}
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('service.label_sort_order')}</Label>
                <Input {...register("sort_order")} type="number" min="0" placeholder="0" className="w-28" />
                <p className="text-xs text-muted-foreground mt-1">{t('service.sort_order_desc')}</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('service.label_status')}</Label>
                <Controller name="status" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">{t('common.active')}</SelectItem>
                      <SelectItem value="Inactive">{t('common.inactive')}</SelectItem>
                      <SelectItem value="Archived">{t('common.archived')}</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Controller name="display_on_booking_page" control={control} render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )} />
              <div>
                <Label className="cursor-pointer">{t('service.label_display_on_booking')}</Label>
                <p className="text-xs text-muted-foreground">{t('service.display_on_booking_desc')}</p>
              </div>
            </div>
          </div>
        </div>

      </form>
    </Layout>
  );
}

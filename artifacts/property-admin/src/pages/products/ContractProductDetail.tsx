import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useForm, Controller } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetContractProduct, useCreateContractProduct, useUpdateContractProduct,
  useActivateContractProduct, useDeactivateContractProduct, useArchiveContractProduct,
  useDeleteContractProduct,
  getListContractProductsQueryKey, getGetContractProductQueryKey,
  useGetPromotion, getGetPromotionQueryKey,
} from "@workspace/api-client-react";
import { LookupSelect } from "@/components/LookupSelect";
import { useBrand } from "@/contexts/ThemeContext";
import { ArrowLeft, Save, Trash2, Tag } from "lucide-react";
import { Link } from "wouter";

const PRODUCT_TYPES = ["Room", "Suite", "Apartment", "House", "Studio", "Service"];
const CURRENCIES = ["KRW", "AUD", "USD", "SGD", "MYR", "GBP"];
const statusColors: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-yellow-100 text-yellow-700",
  Archived: "bg-red-100 text-red-700",
};
const TERM_COLORS: Record<string, string> = {
  ShortTerm: "bg-sky-100 text-sky-700 border-sky-200",
  MidTerm: "bg-violet-100 text-violet-700 border-violet-200",
  LongTerm: "bg-amber-100 text-amber-700 border-amber-200",
};

interface FormData {
  name: string;
  description: string;
  product_type: string;
  space_id: number | null;
  promotion_id: number | null;
  term_type: string;
  weekly_rate: string;
  monthly_rate: string;
  effective_weekly_rate: string;
  currency: string;
  billing_frequency: string;
  bond_weeks: string;
  advance_weeks: string;
  min_stay_weeks: string;
  max_stay_weeks: string;
  includes_wifi: boolean;
  includes_parking: boolean;
  includes_utilities: boolean;
  includes_meals: boolean;
  includes_laundry: boolean;
  includes_cleaning: boolean;
  extra_inclusions: string;
  notes: string;
}

export default function ContractProductDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const isNew = id === "new";
  const { currency: brandCurrency } = useBrand();

  const { data: product, refetch } = useGetContractProduct(Number(id), {
    query: { enabled: !isNew, queryKey: getGetContractProductQueryKey(Number(id)) },
  });

  const { register, handleSubmit, reset, control, watch, setValue } = useForm<FormData>({
    defaultValues: {
      name: "", description: "", product_type: "Room",
      space_id: null, promotion_id: null, term_type: "",
      weekly_rate: "", monthly_rate: "", effective_weekly_rate: "",
      currency: brandCurrency, billing_frequency: "Biweekly",
      bond_weeks: "4", advance_weeks: "2", min_stay_weeks: "1", max_stay_weeks: "",
      includes_wifi: false, includes_parking: false, includes_utilities: false,
      includes_meals: false, includes_laundry: false, includes_cleaning: false,
      extra_inclusions: "", notes: "",
    },
  });

  const watchedPromotionId = watch("promotion_id");
  const watchedWeeklyRate = watch("weekly_rate");
  const watchedTermType = watch("term_type");

  // Load promotion details when promotion_id changes
  const { data: selectedPromotion } = useGetPromotion(watchedPromotionId!, {
    query: { enabled: !!watchedPromotionId, queryKey: getGetPromotionQueryKey(watchedPromotionId!) },
  });

  // Auto-fill from promotion when it changes
  useEffect(() => {
    if (selectedPromotion) {
      setValue("term_type", selectedPromotion.term_type ?? "");
      if (selectedPromotion.min_stay_weeks != null) setValue("min_stay_weeks", String(selectedPromotion.min_stay_weeks));
      if (selectedPromotion.max_stay_weeks != null) setValue("max_stay_weeks", String(selectedPromotion.max_stay_weeks));
      else setValue("max_stay_weeks", "");
      if (selectedPromotion.billing_frequency) setValue("billing_frequency", selectedPromotion.billing_frequency);
    }
  }, [selectedPromotion, setValue]);

  // Auto-calculate effective_weekly_rate
  useEffect(() => {
    const rate = parseFloat(watchedWeeklyRate);
    const disc = selectedPromotion?.discount_percentage ?? 0;
    if (!isNaN(rate) && rate > 0) {
      setValue("effective_weekly_rate", (rate * (1 - disc / 100)).toFixed(2));
    } else {
      setValue("effective_weekly_rate", "");
    }
  }, [watchedWeeklyRate, selectedPromotion, setValue]);

  useEffect(() => {
    if (product) {
      reset({
        name: product.name ?? "",
        description: product.description ?? "",
        product_type: product.product_type ?? "Room",
        space_id: product.space_id ?? null,
        promotion_id: product.promotion_id ?? null,
        term_type: product.term_type ?? "",
        weekly_rate: product.weekly_rate != null ? String(product.weekly_rate) : "",
        monthly_rate: product.monthly_rate != null ? String(product.monthly_rate) : "",
        effective_weekly_rate: product.effective_weekly_rate != null ? String(product.effective_weekly_rate) : "",
        currency: product.currency ?? "AUD",
        billing_frequency: product.billing_frequency ?? "Biweekly",
        bond_weeks: product.bond_weeks != null ? String(product.bond_weeks) : "4",
        advance_weeks: product.advance_weeks != null ? String(product.advance_weeks) : "2",
        min_stay_weeks: product.min_stay_weeks != null ? String(product.min_stay_weeks) : "1",
        max_stay_weeks: product.max_stay_weeks != null ? String(product.max_stay_weeks) : "",
        includes_wifi: product.includes_wifi ?? false,
        includes_parking: product.includes_parking ?? false,
        includes_utilities: product.includes_utilities ?? false,
        includes_meals: product.includes_meals ?? false,
        includes_laundry: product.includes_laundry ?? false,
        includes_cleaning: product.includes_cleaning ?? false,
        extra_inclusions: product.extra_inclusions ?? "",
        notes: product.notes ?? "",
      });
    }
  }, [product, reset]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListContractProductsQueryKey() });
    if (!isNew) qc.invalidateQueries({ queryKey: getGetContractProductQueryKey(Number(id)) });
  };

  const createMutation = useCreateContractProduct({ mutation: { onSuccess: (d) => { invalidate(); navigate(`/products/contract-products/${d.id}`); } } });
  const updateMutation = useUpdateContractProduct({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const activateMutation = useActivateContractProduct({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const deactivateMutation = useDeactivateContractProduct({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const archiveMutation = useArchiveContractProduct({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const deleteMutation = useDeleteContractProduct({ mutation: { onSuccess: () => { invalidate(); navigate("/products/contract-products"); } } });

  const buildPayload = (data: FormData) => ({
    name: data.name,
    description: data.description || null,
    product_type: data.product_type || "Room",
    status: product?.status ?? "Draft",
    space_id: data.space_id ?? null,
    promotion_id: data.promotion_id ?? null,
    term_type: data.term_type || null,
    weekly_rate: data.weekly_rate ? Number(data.weekly_rate) : null,
    monthly_rate: data.monthly_rate ? Number(data.monthly_rate) : null,
    effective_weekly_rate: data.effective_weekly_rate ? Number(data.effective_weekly_rate) : null,
    currency: data.currency || "AUD",
    billing_frequency: data.billing_frequency || null,
    bond_weeks: data.bond_weeks ? Number(data.bond_weeks) : null,
    advance_weeks: data.advance_weeks ? Number(data.advance_weeks) : null,
    min_stay_weeks: data.min_stay_weeks ? Number(data.min_stay_weeks) : null,
    max_stay_weeks: data.max_stay_weeks ? Number(data.max_stay_weeks) : null,
    includes_wifi: data.includes_wifi,
    includes_parking: data.includes_parking,
    includes_utilities: data.includes_utilities,
    includes_meals: data.includes_meals,
    includes_laundry: data.includes_laundry,
    includes_cleaning: data.includes_cleaning,
    extra_inclusions: data.extra_inclusions || null,
    notes: data.notes || null,
  });

  const onSubmit = (data: FormData) => {
    if (isNew) createMutation.mutate({ data: buildPayload(data) });
    else updateMutation.mutate({ id: Number(id), data: buildPayload(data) });
  };

  const status = product?.status ?? "Draft";

  const termLabels: Record<string, string> = {
    ShortTerm: t('contract_product.term_short'),
    MidTerm: t('contract_product.term_mid'),
    LongTerm: t('contract_product.term_long'),
  };
  const productTypeLabels: Record<string, string> = {
    Room: t('contract_product.type_room'),
    Suite: t('contract_product.type_suite'),
    Apartment: t('contract_product.type_apartment'),
    House: t('contract_product.type_house'),
    Studio: t('contract_product.type_studio'),
    Service: t('contract_product.type_service'),
  };
  const statusLabels: Record<string, string> = {
    Draft: t('contract_product.status_draft'),
    Active: t('common.active'),
    Inactive: t('common.inactive'),
    Archived: t('contract_product.status_archived'),
  };

  return (
    <Layout>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="p-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link href="/products/contract-products">
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold">{isNew ? `${t('common.new')} ${t('nav.contract_product')}` : (product?.name ?? t('nav.contract_product'))}</h1>
                {!isNew && product && watchedTermType && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded border inline-block mt-0.5 ${TERM_COLORS[watchedTermType] ?? "bg-gray-100 text-gray-600"}`}>
                    {termLabels[watchedTermType] ?? watchedTermType}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {!isNew && (
                <Button type="button" variant="outline" size="sm" className="text-red-600 hover:text-red-700"
                  onClick={() => { if (confirm(t('common.confirm_delete'))) deleteMutation.mutate({ id: Number(id) }); }}>
                  <Trash2 className="h-4 w-4 mr-1" />{t('common.delete')}
                </Button>
              )}
              <Button type="submit" className="bg-primary hover:bg-[#d4561a] text-white">
                <Save className="h-4 w-4 mr-1" />{t('common.save')}
              </Button>
            </div>
          </div>

          {/* Status bar */}
          {!isNew && product && (
            <div className="border rounded-lg p-4 mb-5 flex items-center justify-between bg-primary/5">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">{t('common.status')}:</span>
                <Badge className={statusColors[status] ?? ""}>{statusLabels[status] ?? status}</Badge>
                {product.promotion_name && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Tag className="h-3.5 w-3.5" />{product.promotion_name}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {status === "Draft" && (
                  <Button type="button" size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => activateMutation.mutate({ id: Number(id) })}>{t('contract_product.activate')}</Button>
                )}
                {status === "Active" && (
                  <Button type="button" size="sm" variant="outline"
                    onClick={() => deactivateMutation.mutate({ id: Number(id) })}>{t('contract_product.deactivate')}</Button>
                )}
                {(status === "Draft" || status === "Inactive") && (
                  <Button type="button" size="sm" variant="outline" className="text-red-600"
                    onClick={() => archiveMutation.mutate({ id: Number(id) })}>{t('contract_product.archive')}</Button>
                )}
                {status === "Archived" && (
                  <Button type="button" size="sm" variant="outline"
                    onClick={() => activateMutation.mutate({ id: Number(id) })}>{t('contract_product.restore')}</Button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-5">
            {/* Space × Promotion */}
            <div className="border rounded-lg bg-white overflow-hidden">
              <div className="bg-primary/10 border-b px-4 py-2 text-xs font-semibold text-primary uppercase tracking-wider">{t('contract_product.section_space_promo')}</div>
              <div className="p-5 grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('contract_product.label_space')} *</Label>
                  <Controller name="space_id" control={control} render={({ field }) => (
                    <LookupSelect lookupUrl="/api/v1/lookup/spaces" value={field.value} onChange={field.onChange} placeholder={t('common.search')} />
                  )} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('contract_product.label_promotion')}</Label>
                  <Controller name="promotion_id" control={control} render={({ field }) => (
                    <LookupSelect lookupUrl="/api/v1/lookup/promotions" value={field.value} onChange={field.onChange} placeholder={t('common.search')} />
                  )} />
                </div>
                {watchedTermType && (
                  <div className="col-span-2">
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded border text-sm font-medium ${TERM_COLORS[watchedTermType] ?? "bg-gray-100 text-gray-600"}`}>
                      <Tag className="h-3.5 w-3.5" />
                      {termLabels[watchedTermType] ?? watchedTermType}
                      {selectedPromotion?.discount_percentage ? ` ${t('contract_product.discount_suffix', { percent: selectedPromotion.discount_percentage })}` : ""}
                      {selectedPromotion?.billing_frequency ? ` ${t('contract_product.billing_suffix', { freq: selectedPromotion.billing_frequency })}` : ""}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* General */}
            <div className="border rounded-lg bg-white overflow-hidden">
              <div className="bg-primary/10 border-b px-4 py-2 text-xs font-semibold text-primary uppercase tracking-wider">{t('contract_product.section_general')}</div>
              <div className="p-5 grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('contract_product.label_name')} *</Label>
                  <Input {...register("name", { required: true })} placeholder={t('contract_product.ph_name')} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('contract_product.label_type')}</Label>
                  <Controller name="product_type" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRODUCT_TYPES.map(itemType => <SelectItem key={itemType} value={itemType}>{productTypeLabels[itemType] ?? itemType}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('contract_product.label_description')}</Label>
                  <Textarea {...register("description")} placeholder={t('contract_product.ph_description')} rows={3} />
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="border rounded-lg bg-white overflow-hidden">
              <div className="bg-primary/10 border-b px-4 py-2 text-xs font-semibold text-primary uppercase tracking-wider">{t('contract_product.section_pricing')}</div>
              <div className="p-5 grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('contract_product.label_currency')}</Label>
                  <Controller name="currency" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  )} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('contract_product.label_rate')}</Label>
                  <Input {...register("weekly_rate")} type="number" step="0.01" min="0" placeholder="e.g. 430" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    {t('contract_product.label_effective_rate')}
                    {selectedPromotion?.discount_percentage ? ` (−${selectedPromotion.discount_percentage}%)` : ""}
                  </Label>
                  <Input {...register("effective_weekly_rate")} type="number" step="0.01" min="0"
                    className="bg-muted/50" placeholder={t('contract_product.ph_auto_calculated')} readOnly />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('contract_product.label_monthly_rate')}</Label>
                  <Input {...register("monthly_rate")} type="number" step="0.01" min="0" placeholder="e.g. 1720" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('contract_product.label_billing_frequency')}</Label>
                  <Controller name="billing_frequency" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Weekly">{t('contract_product.freq_weekly')}</SelectItem>
                        <SelectItem value="Biweekly">{t('contract_product.freq_biweekly')}</SelectItem>
                        <SelectItem value="Monthly">{t('contract_product.freq_monthly')}</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
              </div>
              <Separator className="my-0" />
              <div className="p-5 grid grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('contract_product.label_bond')}</Label>
                  <Input {...register("bond_weeks")} type="number" step="0.5" min="0" placeholder="4" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('contract_product.label_advance')}</Label>
                  <Input {...register("advance_weeks")} type="number" step="0.5" min="0" placeholder="2" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('contract_product.label_min_stay')}</Label>
                  <Input {...register("min_stay_weeks")} type="number" min="1" placeholder="1" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('contract_product.label_max_stay')}</Label>
                  <Input {...register("max_stay_weeks")} type="number" min="1" placeholder={t('contract_product.unlimited')} />
                </div>
              </div>
            </div>

            {/* Inclusions */}
            <div className="border rounded-lg bg-white overflow-hidden">
              <div className="bg-primary/10 border-b px-4 py-2 text-xs font-semibold text-primary uppercase tracking-wider">{t('contract_product.section_inclusions')}</div>
              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  {(["includes_wifi", "includes_parking", "includes_utilities", "includes_meals", "includes_laundry", "includes_cleaning"] as const).map(inclusionField => {
                    const labels: Record<string, string> = {
                      includes_wifi: t('contract_product.label_wifi'),
                      includes_parking: t('contract_product.label_parking'),
                      includes_utilities: t('contract_product.label_utilities'),
                      includes_meals: t('contract_product.label_meals'),
                      includes_laundry: t('contract_product.label_laundry'),
                      includes_cleaning: t('contract_product.label_cleaning'),
                    };
                    return (
                      <Controller key={inclusionField} name={inclusionField} control={control} render={({ field: f }) => (
                        <div className="flex items-center gap-2">
                          <Checkbox id={inclusionField} checked={!!f.value} onCheckedChange={f.onChange} />
                          <Label htmlFor={inclusionField} className="cursor-pointer">{labels[inclusionField]}</Label>
                        </div>
                      )} />
                    );
                  })}
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('contract_product.label_extra_inclusions')}</Label>
                  <Input {...register("extra_inclusions")} placeholder={t('contract_product.ph_extra_inclusions')} />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="border rounded-lg bg-white overflow-hidden">
              <div className="bg-primary/10 border-b px-4 py-2 text-xs font-semibold text-primary uppercase tracking-wider">{t('contract_product.section_notes')}</div>
              <div className="p-5">
                <Textarea {...register("notes")} placeholder={t('contract_product.ph_notes')} rows={4} />
              </div>
            </div>
          </div>
        </div>
      </form>
    </Layout>
  );
}

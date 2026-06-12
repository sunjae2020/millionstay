import { useEffect, useState } from "react";
import { useLocation, useParams, Link as WouterLink } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm, Controller } from "react-hook-form";
import {
  useGetPromotion, useCreatePromotion, useUpdatePromotion, useDeletePromotion,
  getListPromotionsQueryKey, getGetPromotionQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Tag, Trash2, Copy, Package, Wrench, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { apiFetch } from "@/lib/apiFetch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-yellow-100 text-yellow-700",
  Archived: "bg-gray-100 text-gray-600",
  Draft: "bg-blue-50 text-blue-600",
};

type AssocAccommodation = {
  id: number; name: string; status: string;
  price: number | null; currency: string;
  min_contract_period: number | null; min_contract_period_unit: string | null;
};
type AssocService = {
  id: number; name: string; status: string;
  base_price: number | null; currency: string; service_type: string;
};

const TERM_TYPE_META: Record<string, { label: string; minWeeks: string; maxWeeks: string; freq: string; color: string }> = {
  ShortTerm: { label: "Short-term", minWeeks: "1", maxWeeks: "3", freq: "Weekly", color: "bg-sky-50 border-sky-200 text-sky-700" },
  MidTerm:   { label: "Mid-term",   minWeeks: "4", maxWeeks: "25", freq: "Biweekly", color: "bg-violet-50 border-violet-200 text-violet-700" },
  LongTerm:  { label: "Long-term",  minWeeks: "26", maxWeeks: "", freq: "Monthly", color: "bg-amber-50 border-amber-200 text-amber-700" },
};

interface PromotionForm {
  name: string;
  code: string;
  term_type: string;
  promotion_type: string;
  discount_percentage: string;
  discount_amount: string;
  free_nights: string;
  min_stay_weeks: string;
  max_stay_weeks: string;
  min_stay_nights: string;
  billing_frequency: string;
  max_uses: string;
  max_uses_per_account: string;
  applicable_to: string;
  valid_from: string;
  valid_to: string;
  description: string;
  terms: string;
  status: string;
}

export default function PromotionDetail() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const id = isNew ? null : parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: promotion, isLoading } = useGetPromotion(
    id!, { query: { enabled: !isNew && !!id, queryKey: getGetPromotionQueryKey(id!) } }
  );

  const [assocAccommodations, setAssocAccommodations] = useState<AssocAccommodation[]>([]);
  const [assocServices, setAssocServices] = useState<AssocService[]>([]);
  const [assocLoading, setAssocLoading] = useState(false);

  useEffect(() => {
    if (!id || isNew) return;
    setAssocLoading(true);
    apiFetch(`/api/v1/promotions/${id}/associated-products`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(j => {
        if (j.success) {
          setAssocAccommodations(j.data.accommodations ?? []);
          setAssocServices(j.data.services ?? []);
        }
      })
      .catch(() => { /* silently ignore — show empty state */ })
      .finally(() => setAssocLoading(false));
  }, [id, isNew]);

  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<PromotionForm>({
    defaultValues: {
      name: "", code: "", term_type: "ShortTerm", promotion_type: "Percentage",
      discount_percentage: "", discount_amount: "", free_nights: "",
      min_stay_weeks: "1", max_stay_weeks: "3",
      min_stay_nights: "", billing_frequency: "Weekly",
      max_uses: "", max_uses_per_account: "",
      applicable_to: "AllSpaces", valid_from: "", valid_to: "",
      description: "", terms: "", status: "Active",
    },
  });

  const termType = watch("term_type");
  const promotionType = watch("promotion_type");

  // Auto-fill defaults when term_type changes
  const handleTermTypeChange = (val: string) => {
    const meta = TERM_TYPE_META[val];
    if (meta) {
      setValue("min_stay_weeks", meta.minWeeks);
      setValue("max_stay_weeks", meta.maxWeeks);
      setValue("billing_frequency", meta.freq);
    }
  };

  useEffect(() => {
    if (promotion) {
      reset({
        name: promotion.name ?? "",
        code: promotion.code ?? "",
        term_type: promotion.term_type ?? "ShortTerm",
        promotion_type: promotion.promotion_type ?? "Percentage",
        discount_percentage: promotion.discount_percentage?.toString() ?? "",
        discount_amount: promotion.discount_amount?.toString() ?? "",
        free_nights: promotion.free_nights?.toString() ?? "",
        min_stay_weeks: promotion.min_stay_weeks?.toString() ?? "",
        max_stay_weeks: promotion.max_stay_weeks?.toString() ?? "",
        min_stay_nights: promotion.min_stay_nights?.toString() ?? "",
        billing_frequency: promotion.billing_frequency ?? "Biweekly",
        max_uses: promotion.max_uses?.toString() ?? "",
        max_uses_per_account: promotion.max_uses_per_account?.toString() ?? "",
        applicable_to: promotion.applicable_to ?? "AllSpaces",
        valid_from: promotion.valid_from ?? "",
        valid_to: promotion.valid_to ?? "",
        description: promotion.description ?? "",
        terms: promotion.terms ?? "",
        status: promotion.status ?? "Active",
      });
    }
  }, [promotion, reset]);

  const createMutation = useCreatePromotion({
    mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListPromotionsQueryKey() }); navigate("/products/promotions"); } },
  });
  const updateMutation = useUpdatePromotion({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListPromotionsQueryKey() });
        if (id) qc.invalidateQueries({ queryKey: getGetPromotionQueryKey(id) });
        navigate("/products/promotions");
      },
    },
  });
  const deleteMutation = useDeletePromotion({
    mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListPromotionsQueryKey() }); navigate("/products/promotions"); } },
  });

  const onSubmit = (values: PromotionForm) => {
    const data = {
      name: values.name,
      code: values.code || null,
      term_type: values.term_type,
      promotion_type: values.promotion_type,
      discount_percentage: values.discount_percentage ? parseFloat(values.discount_percentage) : null,
      discount_amount: values.discount_amount ? parseFloat(values.discount_amount) : null,
      free_nights: values.free_nights ? parseInt(values.free_nights) : null,
      min_stay_weeks: values.min_stay_weeks ? parseInt(values.min_stay_weeks) : null,
      max_stay_weeks: values.max_stay_weeks ? parseInt(values.max_stay_weeks) : null,
      min_stay_nights: values.min_stay_nights ? parseInt(values.min_stay_nights) : null,
      billing_frequency: values.billing_frequency || null,
      max_uses: values.max_uses ? parseInt(values.max_uses) : null,
      max_uses_per_account: values.max_uses_per_account ? parseInt(values.max_uses_per_account) : null,
      applicable_to: values.applicable_to || null,
      valid_from: values.valid_from || null,
      valid_to: values.valid_to || null,
      description: values.description || null,
      terms: values.terms || null,
      status: values.status,
    };
    if (isNew) createMutation.mutate({ data });
    else if (id) updateMutation.mutate({ id, data });
  };

  const [isCloning, setIsCloning] = useState(false);

  async function handleClone() {
    if (!promotion) return;
    setIsCloning(true);
    try {
      const { id: _id, created_at, updated_at, code, ...rest } = promotion as any;
      const res = await apiFetch("/api/v1/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rest, name: `Copy of ${promotion.name}`, status: "Draft", code: null }),
      });
      if (!res.ok) throw new Error("Clone failed");
      const cloned = await res.json();
      qc.invalidateQueries({ queryKey: getListPromotionsQueryKey() });
      navigate(`/products/promotions/${cloned.id}`);
    } finally {
      setIsCloning(false);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const termMeta = TERM_TYPE_META[termType];

  if (!isNew && isLoading) {
    return <Layout><div className="p-8 text-center text-muted-foreground">Loading...</div></Layout>;
  }

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/products/promotions">
              <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">{isNew ? `${t('common.new')} ${t('nav.promotion')}` : (promotion?.name ?? t('nav.promotion'))}</h1>
            </div>
            {termMeta && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${termMeta.color}`}>{termMeta.label}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isNew && (
              <Button
                variant="outline" size="sm"
                disabled={isCloning}
                onClick={handleClone}
              >
                <Copy className={`h-3.5 w-3.5 mr-1 ${isCloning ? "animate-pulse" : ""}`} />
                {isCloning ? t('common.cloning') : t('common.clone')}
              </Button>
            )}
            {!isNew && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> {t('common.delete')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('promotion.delete_title')}</AlertDialogTitle>
                    <AlertDialogDescription>{t('promotion.delete_desc')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => id && deleteMutation.mutate({ id })}>{t('common.delete')}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button onClick={handleSubmit(onSubmit)} disabled={isSaving} className="bg-[#E8621A] hover:bg-[#d4561a] text-white">
              <Save className="h-4 w-4 mr-1" /> {isSaving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </div>

        <div className="space-y-5">
          {/* Term Type — most important, shown first */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">{t('promotion.section_term_type')}</div>
            <div className="p-5 grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('promotion.label_term_type')} *</Label>
                <Controller name="term_type" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => { field.onChange(v); handleTermTypeChange(v); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ShortTerm">{t('promotion.term_short')}</SelectItem>
                      <SelectItem value="MidTerm">{t('promotion.term_mid')}</SelectItem>
                      <SelectItem value="LongTerm">{t('promotion.term_long')}</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('promotion.label_min_stay')}</Label>
                <Input {...register("min_stay_weeks")} type="number" min="1" />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('promotion.label_max_stay')}{termType === "LongTerm" ? ` — ${t('common.unlimited_hint')}` : ""}</Label>
                <Input {...register("max_stay_weeks")} type="number" min="1" placeholder={termType === "LongTerm" ? t('common.unlimited') : ""} />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('promotion.label_billing_frequency')}</Label>
                <Controller name="billing_frequency" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Upfront">{t('common.upfront')}</SelectItem>
                      <SelectItem value="Weekly">{t('common.weekly')}</SelectItem>
                      <SelectItem value="Biweekly">{t('common.biweekly')}</SelectItem>
                      <SelectItem value="Monthly">{t('common.monthly')}</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('promotion.label_min_nights')}</Label>
                <Input {...register("min_stay_nights")} type="number" min="1" placeholder={t('common.optional')} />
              </div>
            </div>
          </div>

          {/* General */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">{t('promotion.section_general')}</div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('promotion.label_name')} *</Label>
                <Input {...register("name", { required: true })} placeholder="e.g. Mid-term 5% Discount" className={errors.name ? "border-destructive" : ""} />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('promotion.label_code')}</Label>
                <Input {...register("code")} placeholder="e.g. MID5" className="font-mono uppercase" />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('promotion.label_status')}</Label>
                <Controller name="status" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">{t('common.draft')}</SelectItem>
                      <SelectItem value="Scheduled">{t('common.scheduled')}</SelectItem>
                      <SelectItem value="Active">{t('common.active')}</SelectItem>
                      <SelectItem value="Expired">{t('common.expired')}</SelectItem>
                      <SelectItem value="Disabled">{t('common.disabled')}</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
          </div>

          {/* Discount */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">{t('promotion.section_discount')}</div>
            <div className="p-5 grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('promotion.label_type')}</Label>
                <Controller name="promotion_type" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Percentage">{t('promotion.type_percentage')}</SelectItem>
                      <SelectItem value="Fixed">{t('promotion.type_fixed')}</SelectItem>
                      <SelectItem value="FreeNights">{t('promotion.type_free_nights')}</SelectItem>
                      <SelectItem value="None">{t('common.none')}</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              {promotionType === "Percentage" && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('promotion.label_value')}</Label>
                  <Input {...register("discount_percentage")} type="number" step="0.5" min="0" max="100" placeholder="e.g. 5" />
                </div>
              )}
              {promotionType === "Fixed" && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('promotion.label_value')}</Label>
                  <Input {...register("discount_amount")} type="number" step="0.01" min="0" placeholder="e.g. 50" />
                </div>
              )}
              {promotionType === "FreeNights" && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('promotion.label_value')}</Label>
                  <Input {...register("free_nights")} type="number" min="1" placeholder="e.g. 7" />
                </div>
              )}
            </div>
          </div>

          {/* Validity & Limits */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">{t('promotion.section_validity')}</div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('promotion.label_valid_from')}</Label>
                <Controller name="valid_from" control={control} render={({ field }) => (
                  <DateInput value={field.value ?? ""} onChange={field.onChange} />
                )} />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('promotion.label_valid_to')}</Label>
                <Controller name="valid_to" control={control} render={({ field }) => (
                  <DateInput value={field.value ?? ""} onChange={field.onChange} />
                )} />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('promotion.label_max_uses')}</Label>
                <Input {...register("max_uses")} type="number" min="1" placeholder={t('common.unlimited')} />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('promotion.label_max_uses_account')}</Label>
                <Input {...register("max_uses_per_account")} type="number" min="1" placeholder={t('common.unlimited')} />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('promotion.label_applicable_to')}</Label>
                <Controller name="applicable_to" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AllSpaces">{t('promotion.app_all_spaces')}</SelectItem>
                      <SelectItem value="SelectedSpaces">{t('promotion.app_selected_spaces')}</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
          </div>

          {/* Description & Terms */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">{t('promotion.section_description')}</div>
            <div className="p-5 space-y-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('promotion.label_description')}</Label>
                <Textarea {...register("description")} rows={3} placeholder="Brief description..." />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('promotion.label_terms')}</Label>
                <Textarea {...register("terms")} rows={4} placeholder="Terms and conditions..." />
              </div>
            </div>
          </div>

          {/* Associated Products — shown only for existing promotions */}
          {!isNew && (
            <div className="bg-white border rounded-lg overflow-hidden">
              <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">Associated Products</div>
              {assocLoading ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Loading associated products…</div>
              ) : (assocAccommodations.length === 0 && assocServices.length === 0) ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No products are currently linked to this promotion.
                  <p className="text-xs mt-1">Assign this promotion to an Accommodation or Service product to see it here.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {/* Accommodation Products */}
                  {assocAccommodations.length > 0 && (
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Package className="h-4 w-4 text-[#E8621A]" />
                        <span className="text-sm font-semibold">Accommodation Products</span>
                        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">{assocAccommodations.length}</span>
                      </div>
                      <div className="space-y-2">
                        {assocAccommodations.map(a => (
                          <WouterLink key={a.id} href={`/products/products/${a.id}`}>
                            <div className="flex items-center justify-between p-3 rounded-lg border hover:border-[#E8621A]/40 hover:bg-orange-50/40 transition-colors cursor-pointer group">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium group-hover:text-[#E8621A] transition-colors">{a.name}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status] ?? "bg-gray-100 text-gray-600"}`}>{a.status}</span>
                                {a.min_contract_period && (
                                  <span className="text-xs text-muted-foreground">Min {a.min_contract_period} {a.min_contract_period_unit}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                {a.price != null && (
                                  <span className="text-xs">{a.currency} ${a.price.toFixed(2)}</span>
                                )}
                                <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          </WouterLink>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Service Products */}
                  {assocServices.length > 0 && (
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Wrench className="h-4 w-4 text-[#E8621A]" />
                        <span className="text-sm font-semibold">Service Products</span>
                        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">{assocServices.length}</span>
                      </div>
                      <div className="space-y-2">
                        {assocServices.map(s => (
                          <WouterLink key={s.id} href={`/services/${s.id}`}>
                            <div className="flex items-center justify-between p-3 rounded-lg border hover:border-[#E8621A]/40 hover:bg-orange-50/40 transition-colors cursor-pointer group">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium group-hover:text-[#E8621A] transition-colors">{s.name}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] ?? "bg-gray-100 text-gray-600"}`}>{s.status}</span>
                                <span className="text-xs text-muted-foreground capitalize">{s.service_type.replace("_", " ")}</span>
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                {s.base_price != null && (
                                  <span className="text-xs">{s.currency} ${s.base_price.toFixed(2)}</span>
                                )}
                                <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          </WouterLink>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

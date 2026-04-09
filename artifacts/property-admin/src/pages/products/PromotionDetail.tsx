import { useEffect, useState } from "react";
import { useLocation, useParams, Link as WouterLink } from "wouter";
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
import { ArrowLeft, Save, Tag, Trash2, Package, Wrench, ExternalLink } from "lucide-react";
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
              <h1 className="text-xl font-bold">{isNew ? "New Promotion" : (promotion?.name ?? "Promotion")}</h1>
            </div>
            {termMeta && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${termMeta.color}`}>{termMeta.label}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isNew && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Promotion</AlertDialogTitle>
                    <AlertDialogDescription>Are you sure you want to delete this promotion? This action cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => id && deleteMutation.mutate({ id })}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button onClick={handleSubmit(onSubmit)} disabled={isSaving} className="bg-[#E8621A] hover:bg-[#d4561a] text-white">
              <Save className="h-4 w-4 mr-1" /> {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div className="space-y-5">
          {/* Term Type — most important, shown first */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">Term Type &amp; Billing</div>
            <div className="p-5 grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Term Type *</Label>
                <Controller name="term_type" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => { field.onChange(v); handleTermTypeChange(v); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ShortTerm">Short-term (under 4 weeks)</SelectItem>
                      <SelectItem value="MidTerm">Mid-term (4–25 weeks)</SelectItem>
                      <SelectItem value="LongTerm">Long-term (26+ weeks)</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Min Stay (weeks)</Label>
                <Input {...register("min_stay_weeks")} type="number" min="1" />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Max Stay (weeks){termType === "LongTerm" ? " — blank = unlimited" : ""}</Label>
                <Input {...register("max_stay_weeks")} type="number" min="1" placeholder={termType === "LongTerm" ? "Unlimited" : ""} />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Billing Frequency</Label>
                <Controller name="billing_frequency" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Weekly">Weekly</SelectItem>
                      <SelectItem value="Biweekly">Biweekly (every 2 weeks)</SelectItem>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Min Stay (nights) — per space</Label>
                <Input {...register("min_stay_nights")} type="number" min="1" placeholder="Optional" />
              </div>
            </div>
          </div>

          {/* General */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">General</div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Promotion Name *</Label>
                <Input {...register("name", { required: true })} placeholder="e.g. Mid-term 5% Discount" className={errors.name ? "border-destructive" : ""} />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Promo Code</Label>
                <Input {...register("code")} placeholder="e.g. MID5" className="font-mono uppercase" />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Status</Label>
                <Controller name="status" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Scheduled">Scheduled</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Expired">Expired</SelectItem>
                      <SelectItem value="Disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
          </div>

          {/* Discount */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">Discount</div>
            <div className="p-5 grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Promotion Type</Label>
                <Controller name="promotion_type" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Percentage">Percentage (%)</SelectItem>
                      <SelectItem value="Fixed">Fixed Amount ($)</SelectItem>
                      <SelectItem value="FreeNights">Free Nights</SelectItem>
                      <SelectItem value="None">No Discount</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              {promotionType === "Percentage" && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Discount %</Label>
                  <Input {...register("discount_percentage")} type="number" step="0.5" min="0" max="100" placeholder="e.g. 5" />
                </div>
              )}
              {promotionType === "Fixed" && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Discount Amount ($)</Label>
                  <Input {...register("discount_amount")} type="number" step="0.01" min="0" placeholder="e.g. 50" />
                </div>
              )}
              {promotionType === "FreeNights" && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Free Nights</Label>
                  <Input {...register("free_nights")} type="number" min="1" placeholder="e.g. 7" />
                </div>
              )}
            </div>
          </div>

          {/* Validity & Limits */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">Validity &amp; Limits</div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Valid From</Label>
                <Controller name="valid_from" control={control} render={({ field }) => (
                  <DateInput value={field.value ?? ""} onChange={field.onChange} />
                )} />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Valid To</Label>
                <Controller name="valid_to" control={control} render={({ field }) => (
                  <DateInput value={field.value ?? ""} onChange={field.onChange} />
                )} />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Max Uses (total)</Label>
                <Input {...register("max_uses")} type="number" min="1" placeholder="Unlimited" />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Max Uses Per Account</Label>
                <Input {...register("max_uses_per_account")} type="number" min="1" placeholder="Unlimited" />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Applicable To</Label>
                <Controller name="applicable_to" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AllSpaces">All Spaces</SelectItem>
                      <SelectItem value="SelectedSpaces">Selected Spaces</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
          </div>

          {/* Description & Terms */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">Description &amp; Terms</div>
            <div className="p-5 space-y-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</Label>
                <Textarea {...register("description")} rows={3} placeholder="Brief description..." />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Terms &amp; Conditions</Label>
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
                          <WouterLink key={s.id} href={`/products/services/${s.id}`}>
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

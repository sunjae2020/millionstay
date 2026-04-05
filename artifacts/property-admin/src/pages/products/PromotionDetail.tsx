import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm, Controller } from "react-hook-form";
import {
  useGetPromotion, useCreatePromotion, useUpdatePromotion, useDeletePromotion,
  getListPromotionsQueryKey, getGetPromotionQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Tag, Trash2 } from "lucide-react";
import { Link } from "wouter";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PromotionForm {
  name: string;
  code: string;
  promotion_type: string;
  discount_percentage: string;
  discount_amount: string;
  free_nights: string;
  valid_from: string;
  valid_to: string;
  min_stay_nights: string;
  max_uses: string;
  max_uses_per_account: string;
  applicable_to: string;
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

  const { register, handleSubmit, reset, control, watch, formState: { errors, isDirty } } = useForm<PromotionForm>({
    defaultValues: {
      name: "", code: "", promotion_type: "Percentage",
      discount_percentage: "", discount_amount: "", free_nights: "",
      valid_from: "", valid_to: "", min_stay_nights: "",
      max_uses: "", max_uses_per_account: "",
      applicable_to: "AllSpaces", description: "", terms: "", status: "Draft",
    },
  });

  const promotionType = watch("promotion_type");

  useEffect(() => {
    if (promotion) {
      reset({
        name: promotion.name ?? "",
        code: promotion.code ?? "",
        promotion_type: promotion.promotion_type ?? "Percentage",
        discount_percentage: promotion.discount_percentage?.toString() ?? "",
        discount_amount: promotion.discount_amount?.toString() ?? "",
        free_nights: promotion.free_nights?.toString() ?? "",
        valid_from: promotion.valid_from ?? "",
        valid_to: promotion.valid_to ?? "",
        min_stay_nights: promotion.min_stay_nights?.toString() ?? "",
        max_uses: promotion.max_uses?.toString() ?? "",
        max_uses_per_account: promotion.max_uses_per_account?.toString() ?? "",
        applicable_to: promotion.applicable_to ?? "AllSpaces",
        description: promotion.description ?? "",
        terms: promotion.terms ?? "",
        status: promotion.status ?? "Draft",
      });
    }
  }, [promotion, reset]);

  const createMutation = useCreatePromotion({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListPromotionsQueryKey() });
        navigate("/products/promotions");
      },
    },
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
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListPromotionsQueryKey() });
        navigate("/products/promotions");
      },
    },
  });

  const onSubmit = (values: PromotionForm) => {
    const data = {
      name: values.name,
      code: values.code || null,
      promotion_type: values.promotion_type,
      discount_percentage: values.discount_percentage ? parseFloat(values.discount_percentage) : null,
      discount_amount: values.discount_amount ? parseFloat(values.discount_amount) : null,
      free_nights: values.free_nights ? parseInt(values.free_nights) : null,
      valid_from: values.valid_from || null,
      valid_to: values.valid_to || null,
      min_stay_nights: values.min_stay_nights ? parseInt(values.min_stay_nights) : null,
      max_uses: values.max_uses ? parseInt(values.max_uses) : null,
      max_uses_per_account: values.max_uses_per_account ? parseInt(values.max_uses_per_account) : null,
      applicable_to: values.applicable_to || null,
      description: values.description || null,
      terms: values.terms || null,
      status: values.status,
    };
    if (isNew) {
      createMutation.mutate({ data });
    } else if (id) {
      updateMutation.mutate({ id, data });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (!isNew && isLoading) {
    return (
      <Layout>
        <div className="p-8 text-center text-muted-foreground">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/products/promotions">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">{isNew ? "New Promotion" : (promotion?.name ?? "Promotion")}</h1>
            </div>
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
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => id && deleteMutation.mutate({ id })}
                    >Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button onClick={handleSubmit(onSubmit)} disabled={isSaving} className="bg-[#E8621A] hover:bg-[#d4561a] text-white">
              <Save className="h-4 w-4 mr-1" /> {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">General</div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name *</Label>
                <Input {...register("name", { required: true })} placeholder="e.g. Early Bird Discount" className={errors.name ? "border-destructive" : ""} />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Promo Code</Label>
                <Input {...register("code")} placeholder="e.g. EARLY10" className="font-mono uppercase" />
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

          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">Discount</div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Promotion Type</Label>
                <Controller name="promotion_type" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Percentage">Percentage (%)</SelectItem>
                      <SelectItem value="Fixed">Fixed Amount ($)</SelectItem>
                      <SelectItem value="FreeNights">Free Nights</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              {promotionType === "Percentage" && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Discount %</Label>
                  <Input {...register("discount_percentage")} type="number" step="0.01" min="0" max="100" placeholder="e.g. 10" />
                </div>
              )}
              {promotionType === "Fixed" && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Discount Amount ($)</Label>
                  <Input {...register("discount_amount")} type="number" step="0.01" min="0" placeholder="e.g. 200" />
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

          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">Validity & Limits</div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Valid From</Label>
                <Input {...register("valid_from")} type="date" />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Valid To</Label>
                <Input {...register("valid_to")} type="date" />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Min Stay (nights)</Label>
                <Input {...register("min_stay_nights")} type="number" min="1" placeholder="Leave blank for no minimum" />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Max Uses (total)</Label>
                <Input {...register("max_uses")} type="number" min="1" placeholder="Leave blank for unlimited" />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Max Uses Per Account</Label>
                <Input {...register("max_uses_per_account")} type="number" min="1" placeholder="Leave blank for unlimited" />
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

          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">Description & Terms</div>
            <div className="p-5 space-y-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</Label>
                <Textarea {...register("description")} rows={3} placeholder="Brief description of the promotion..." />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Terms & Conditions</Label>
                <Textarea {...register("terms")} rows={4} placeholder="Terms and conditions for this promotion..." />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

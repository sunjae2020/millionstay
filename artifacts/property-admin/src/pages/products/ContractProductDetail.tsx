import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
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
} from "@workspace/api-client-react";
import { LookupSelect } from "@/components/LookupSelect";
import { ArrowLeft, Save, Trash2 } from "lucide-react";

const PRODUCT_TYPES = ["Room", "Suite", "Apartment", "House", "Studio", "Service"];
const CURRENCIES = ["AUD", "USD", "SGD", "MYR", "GBP"];
const statusColors: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-yellow-100 text-yellow-700",
  Archived: "bg-red-100 text-red-700",
};

interface FormData {
  name: string;
  description: string;
  product_type: string;
  space_id: number | null;
  weekly_rate: string;
  monthly_rate: string;
  currency: string;
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
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const isNew = id === "new";

  const { data: product, refetch } = useGetContractProduct(Number(id), {
    query: { enabled: !isNew },
  });

  const { register, handleSubmit, reset, control, watch } = useForm<FormData>({
    defaultValues: {
      name: "", description: "", product_type: "Room", space_id: null,
      weekly_rate: "", monthly_rate: "", currency: "AUD",
      bond_weeks: "4", advance_weeks: "2", min_stay_weeks: "1", max_stay_weeks: "",
      includes_wifi: false, includes_parking: false, includes_utilities: false,
      includes_meals: false, includes_laundry: false, includes_cleaning: false,
      extra_inclusions: "", notes: "",
    },
  });

  useEffect(() => {
    if (product) {
      reset({
        name: product.name ?? "",
        description: product.description ?? "",
        product_type: product.product_type ?? "Room",
        space_id: product.space_id ?? null,
        weekly_rate: product.weekly_rate != null ? String(product.weekly_rate) : "",
        monthly_rate: product.monthly_rate != null ? String(product.monthly_rate) : "",
        currency: product.currency ?? "AUD",
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
    space_id: data.space_id ?? null,
    weekly_rate: data.weekly_rate ? Number(data.weekly_rate) : null,
    monthly_rate: data.monthly_rate ? Number(data.monthly_rate) : null,
    currency: data.currency || "AUD",
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

  return (
    <Layout>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">{isNew ? "New Contract Product" : product?.name}</h1>
              {!isNew && product && (
                <p className="text-sm text-muted-foreground">Contract Product #{product.id}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => navigate("/products/contract-products")}>
                <ArrowLeft className="h-4 w-4 mr-2" />Back
              </Button>
              {!isNew && (
                <Button type="button" variant="outline" className="text-red-600 hover:text-red-700"
                  onClick={() => { if (confirm("Delete this product?")) deleteMutation.mutate({ id: Number(id) }); }}>
                  <Trash2 className="h-4 w-4 mr-2" />Delete
                </Button>
              )}
              <Button type="submit"><Save className="h-4 w-4 mr-2" />Save</Button>
            </div>
          </div>

          {/* Status bar */}
          {!isNew && product && (
            <div className="border rounded-lg p-4 mb-6 flex items-center justify-between bg-blue-50/50">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">Status:</span>
                <Badge className={statusColors[status] ?? ""}>{status}</Badge>
              </div>
              <div className="flex gap-2">
                {status === "Draft" && (
                  <Button type="button" size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => activateMutation.mutate({ id: Number(id) })}>
                    Activate
                  </Button>
                )}
                {status === "Active" && (
                  <Button type="button" size="sm" variant="outline"
                    onClick={() => deactivateMutation.mutate({ id: Number(id) })}>
                    Deactivate
                  </Button>
                )}
                {(status === "Draft" || status === "Inactive") && (
                  <Button type="button" size="sm" variant="outline" className="text-red-600"
                    onClick={() => archiveMutation.mutate({ id: Number(id) })}>
                    Archive
                  </Button>
                )}
                {status === "Archived" && (
                  <Button type="button" size="sm" variant="outline"
                    onClick={() => activateMutation.mutate({ id: Number(id) })}>
                    Restore (Activate)
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 max-w-4xl">
            {/* General */}
            <div className="border rounded-lg bg-white p-6">
              <h2 className="text-sm font-semibold uppercase text-blue-600 tracking-wide mb-4">General</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Name *</Label>
                  <Input {...register("name", { required: true })} placeholder="e.g. Standard Room Weekly Package" />
                </div>
                <div>
                  <Label>Product Type</Label>
                  <Controller name="product_type" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRODUCT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div>
                  <Label>Linked Space</Label>
                  <Controller name="space_id" control={control} render={({ field }) => (
                    <LookupSelect
                      lookupUrl="/api/v1/lookup/spaces"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Search spaces..."
                    />
                  )} />
                </div>
                <div className="col-span-2">
                  <Label>Description</Label>
                  <Textarea {...register("description")} placeholder="Product description..." rows={3} />
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="border rounded-lg bg-white p-6">
              <h2 className="text-sm font-semibold uppercase text-blue-600 tracking-wide mb-4">Pricing</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Currency</Label>
                  <Controller name="currency" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div>
                  <Label>Weekly Rate</Label>
                  <Input {...register("weekly_rate")} type="number" step="0.01" min="0" placeholder="e.g. 430" />
                </div>
                <div>
                  <Label>Monthly Rate</Label>
                  <Input {...register("monthly_rate")} type="number" step="0.01" min="0" placeholder="e.g. 1720" />
                </div>
                <div>
                  <Label>Bond (weeks)</Label>
                  <Input {...register("bond_weeks")} type="number" step="0.5" min="0" placeholder="4" />
                </div>
                <div>
                  <Label>Advance (weeks)</Label>
                  <Input {...register("advance_weeks")} type="number" step="0.5" min="0" placeholder="2" />
                </div>
              </div>
              <Separator className="my-4" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Min Stay (weeks)</Label>
                  <Input {...register("min_stay_weeks")} type="number" min="1" placeholder="1" />
                </div>
                <div>
                  <Label>Max Stay (weeks)</Label>
                  <Input {...register("max_stay_weeks")} type="number" min="1" placeholder="Unlimited" />
                </div>
              </div>
            </div>

            {/* Inclusions */}
            <div className="border rounded-lg bg-white p-6">
              <h2 className="text-sm font-semibold uppercase text-blue-600 tracking-wide mb-4">Inclusions</h2>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {(["includes_wifi", "includes_parking", "includes_utilities", "includes_meals", "includes_laundry", "includes_cleaning"] as const).map(field => {
                  const labels: Record<string, string> = {
                    includes_wifi: "WiFi", includes_parking: "Parking", includes_utilities: "Utilities",
                    includes_meals: "Meals", includes_laundry: "Laundry", includes_cleaning: "Cleaning",
                  };
                  return (
                    <Controller key={field} name={field} control={control} render={({ field: f }) => (
                      <div className="flex items-center gap-2">
                        <Checkbox id={field} checked={!!f.value} onCheckedChange={f.onChange} />
                        <Label htmlFor={field} className="cursor-pointer">{labels[field]}</Label>
                      </div>
                    )} />
                  );
                })}
              </div>
              <div>
                <Label>Extra Inclusions</Label>
                <Input {...register("extra_inclusions")} placeholder="e.g. Pool access, Gym, Concierge" />
              </div>
            </div>

            {/* Notes */}
            <div className="border rounded-lg bg-white p-6">
              <h2 className="text-sm font-semibold uppercase text-blue-600 tracking-wide mb-4">Notes</h2>
              <Textarea {...register("notes")} placeholder="Internal notes..." rows={4} />
            </div>
          </div>
        </div>
      </form>
    </Layout>
  );
}

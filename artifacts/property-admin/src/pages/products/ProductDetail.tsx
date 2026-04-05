import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Package, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-yellow-100 text-yellow-700",
  Archived: "bg-red-100 text-red-700",
};

async function fetchProduct(id: string) {
  const res = await fetch(`/api/v1/products/${id}`);
  if (!res.ok) throw new Error("Not found");
  return res.json();
}

async function fetchLookup(url: string) {
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = id === "new";

  const { data: product } = useQuery({
    queryKey: ["product", id],
    queryFn: () => fetchProduct(id!),
    enabled: !isNew,
  });

  const { data: groups = [] } = useQuery({ queryKey: ["lookup-product-groups"], queryFn: () => fetchLookup("/api/v1/lookup/product-groups") });
  const { data: types = [] } = useQuery({ queryKey: ["lookup-product-types"], queryFn: () => fetchLookup("/api/v1/lookup/product-types") });

  const { register, handleSubmit, setValue, watch } = useForm({
    values: product ? {
      name: product.name ?? "",
      item_description: product.item_description ?? "",
      price: product.price ?? "",
      currency: product.currency ?? "AUD",
      product_group_id: product.product_group_id ?? "",
      product_type_id: product.product_type_id ?? "",
      gst_included: product.gst_included ?? false,
      min_contract_period: product.min_contract_period ?? "",
      min_contract_period_unit: product.min_contract_period_unit ?? "weeks",
      status: product.status ?? "Active",
      display_on_booking_page: product.display_on_booking_page ?? true,
      display_on_invoice: product.display_on_invoice ?? true,
    } : {
      name: "", item_description: "", price: "", currency: "AUD",
      product_group_id: "", product_type_id: "", gst_included: false,
      min_contract_period: "", min_contract_period_unit: "weeks",
      status: "Active", display_on_booking_page: true, display_on_invoice: true,
    },
  });

  const save = useMutation({
    mutationFn: async (values: any) => {
      const body = {
        ...values,
        price: values.price ? Number(values.price) : null,
        product_group_id: values.product_group_id ? Number(values.product_group_id) : null,
        product_type_id: values.product_type_id ? Number(values.product_type_id) : null,
        min_contract_period: values.min_contract_period ? Number(values.min_contract_period) : null,
      };
      const url = isNew ? "/api/v1/products" : `/api/v1/products/${id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Saved", description: "Product saved successfully." });
      qc.invalidateQueries({ queryKey: ["products"] });
      if (isNew) navigate(`/products/products/${data.id}`);
    },
    onError: () => toast({ title: "Error", description: "Failed to save product.", variant: "destructive" }),
  });

  return (
    <Layout>
      <div className="p-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/products/products")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">{isNew ? "New Product" : (product?.name ?? "Product")}</h1>
          </div>
          {product?.status && (
            <Badge className={STATUS_COLORS[product.status] ?? "bg-gray-100 text-gray-700"}>{product.status}</Badge>
          )}
        </div>

        <form onSubmit={handleSubmit(v => save.mutate(v))} className="space-y-6">
          <div className="bg-white border rounded-lg p-6 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Basic Information</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Product Name *</Label>
                <Input {...register("name")} placeholder="e.g. Standard Room Package" className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea {...register("item_description")} placeholder="Brief description" className="mt-1" rows={2} />
              </div>
              <div>
                <Label>Group</Label>
                <Select value={String(watch("product_group_id") || "")} onValueChange={v => setValue("product_group_id", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select group" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {(groups as any[]).map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.display}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={String(watch("product_type_id") || "")} onValueChange={v => setValue("product_type_id", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {(types as any[]).map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.display}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-lg p-6 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Pricing</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Price</Label>
                <Input {...register("price")} type="number" step="0.01" placeholder="0.00" className="mt-1" />
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={watch("currency")} onValueChange={v => setValue("currency", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUD">AUD</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 mt-6">
                <Switch checked={watch("gst_included")} onCheckedChange={v => setValue("gst_included", v)} />
                <Label>GST Included</Label>
              </div>
              <div>
                <Label>Min Contract Period</Label>
                <Input {...register("min_contract_period")} type="number" placeholder="e.g. 4" className="mt-1" />
              </div>
              <div>
                <Label>Unit</Label>
                <Select value={watch("min_contract_period_unit")} onValueChange={v => setValue("min_contract_period_unit", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="weeks">Weeks</SelectItem>
                    <SelectItem value="months">Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-lg p-6 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Display Options</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Switch checked={watch("display_on_booking_page")} onCheckedChange={v => setValue("display_on_booking_page", v)} />
                <Label>Display on Booking Page</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={watch("display_on_invoice")} onCheckedChange={v => setValue("display_on_invoice", v)} />
                <Label>Display on Invoice</Label>
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={watch("status")} onValueChange={v => setValue("status", v)}>
                <SelectTrigger className="mt-1 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={save.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {save.isPending ? "Saving..." : "Save Product"}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}

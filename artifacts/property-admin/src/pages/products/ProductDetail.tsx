import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Package, Save, Plus, Trash2, PackagePlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AccommodationOptionFields } from "@/components/AccommodationOptionFields";
import { HOMESTAY_ROOM_TYPE } from "@/lib/accommodationOptions";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-yellow-100 text-yellow-700",
  Archived: "bg-red-100 text-red-700",
};

async function fetchProduct(id: string) {
  const res = await apiFetch(`/api/v1/accommodations/${id}`);
  if (!res.ok) throw new Error("Not found");
  return res.json();
}

async function fetchLookup(url: string) {
  const res = await apiFetch(url);
  if (!res.ok) return [];
  return res.json();
}

type AccSvc = {
  id: number; accommodation_id: number; service_id: number;
  service_name: string; service_type: string;
  base_price: number | null; custom_price: number | null;
  currency: string; billing_trigger: string;
  is_optional: boolean; is_mandatory: boolean; sort_order: number;
};
type CatalogSvc = { id: number; name: string; service_type: string; base_price: number | null; currency: string; };

export default function ProductDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = id === "new";

  const [accSvcs, setAccSvcs] = useState<AccSvc[]>([]);
  const [catalogSvcs, setCatalogSvcs] = useState<CatalogSvc[]>([]);
  const [svcLoading, setSvcLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addId, setAddId] = useState("");
  const [addMandatory, setAddMandatory] = useState(false);
  const [addPrice, setAddPrice] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  const loadSvcs = async () => {
    if (!id || isNew) return;
    setSvcLoading(true);
    try {
      const [sRes, cRes] = await Promise.all([
        apiFetch(`/api/v1/accommodations/${id}/services`),
        apiFetch(`/api/v1/services?status=Active&limit=200`),
      ]);
      const sj = await sRes.json(); const cj = await cRes.json();
      if (sj.success) setAccSvcs(sj.data ?? []);
      if (cj.success) setCatalogSvcs(cj.data ?? []);
    } finally { setSvcLoading(false); }
  };

  useEffect(() => {
    if (!isNew) loadSvcs();
  }, [id]);

  const handleAddSvc = async () => {
    if (!id || !addId) return;
    setAddSaving(true);
    try {
      const res = await apiFetch(`/api/v1/accommodations/${id}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_id: parseInt(addId, 10), is_mandatory: addMandatory, custom_price: addPrice ? parseFloat(addPrice) : null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast({ title: "Service added" });
      setAddOpen(false); setAddId(""); setAddMandatory(false); setAddPrice("");
      await loadSvcs();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally { setAddSaving(false); }
  };

  const toggleMandatory = async (mapId: number, val: boolean) => {
    if (!id) return;
    await apiFetch(`/api/v1/accommodations/${id}/services/${mapId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_mandatory: val }),
    });
    setAccSvcs(prev => prev.map(s => s.id === mapId ? { ...s, is_mandatory: val } : s));
  };

  const removeSvc = async (mapId: number) => {
    if (!id || !confirm("Remove this service from the product?")) return;
    const res = await apiFetch(`/api/v1/accommodations/${id}/services/${mapId}`, { method: "DELETE" });
    if (res.ok) { toast({ title: "Service removed" }); setAccSvcs(prev => prev.filter(s => s.id !== mapId)); }
  };

  const { data: product } = useQuery({
    queryKey: ["product", id],
    queryFn: () => fetchProduct(id!),
    enabled: !isNew,
  });

  const { data: groups = [] } = useQuery({ queryKey: ["lookup-product-groups"], queryFn: () => fetchLookup("/api/v1/lookup/product-groups") });
  const { data: types = [] } = useQuery({ queryKey: ["lookup-product-types"], queryFn: () => fetchLookup("/api/v1/lookup/product-types") });
  const { data: promotions = [] } = useQuery({ queryKey: ["lookup-promotions"], queryFn: () => fetchLookup("/api/v1/lookup/promotions") });

  const { register, handleSubmit, setValue, watch } = useForm({
    values: product ? {
      name: product.name ?? "",
      item_description: product.item_description ?? "",
      price: product.price != null ? String(product.price) : "",
      weekly_rate: product.weekly_rate != null ? String(product.weekly_rate) : "",
      currency: product.currency ?? "AUD",
      product_group_id: product.product_group_id ?? "",
      product_type_id: product.product_type_id ?? "",
      promotion_id: product.promotion_id ?? "",
      gst_included: product.gst_included ?? false,
      min_contract_period: product.min_contract_period ?? "",
      min_contract_period_unit: product.min_contract_period_unit ?? "weeks",
      max_stay_weeks: product.max_stay_weeks ?? "",
      billing_frequency: product.billing_frequency ?? "Biweekly",
      term_type: product.term_type ?? "",
      contract_term: product.contract_term ?? "",
      room_type: product.room_type ?? "",
      meal_plan: product.meal_plan ?? "",
      guest_age: product.guest_age ?? "",
      bond_amount: product.bond_amount != null ? String(product.bond_amount) : "",
      bond_weeks: product.bond_weeks != null ? String(product.bond_weeks) : "4",
      advance_weeks: product.advance_weeks != null ? String(product.advance_weeks) : "2",
      admin_fee: product.admin_fee != null ? String(product.admin_fee) : "",
      cleaning_fee: product.cleaning_fee != null ? String(product.cleaning_fee) : "",
      includes_wifi: product.includes_wifi ?? false,
      includes_parking: product.includes_parking ?? false,
      includes_utilities: product.includes_utilities ?? false,
      includes_meals: product.includes_meals ?? false,
      includes_laundry: product.includes_laundry ?? false,
      includes_cleaning: product.includes_cleaning ?? false,
      extra_inclusions: product.extra_inclusions ?? "",
      status: product.status ?? "Active",
      display_on_booking_page: product.display_on_booking_page ?? true,
      display_on_invoice: product.display_on_invoice ?? true,
    } : {
      name: "", item_description: "", price: "", weekly_rate: "", currency: "AUD",
      product_group_id: "", product_type_id: "", promotion_id: "", gst_included: false,
      min_contract_period: "", min_contract_period_unit: "weeks",
      max_stay_weeks: "", billing_frequency: "Biweekly", term_type: "",
      contract_term: "", room_type: "", meal_plan: "", guest_age: "",
      bond_amount: "", bond_weeks: "4", advance_weeks: "2",
      admin_fee: "", cleaning_fee: "",
      includes_wifi: false, includes_parking: false, includes_utilities: false,
      includes_meals: false, includes_laundry: false, includes_cleaning: false,
      extra_inclusions: "",
      status: "Active", display_on_booking_page: true, display_on_invoice: true,
    },
  });

  const save = useMutation({
    mutationFn: async (values: any) => {
      const body = {
        ...values,
        price: values.price !== "" ? Number(values.price) : null,
        weekly_rate: values.weekly_rate !== "" ? Number(values.weekly_rate) : null,
        product_group_id: values.product_group_id ? Number(values.product_group_id) : null,
        product_type_id: values.product_type_id ? Number(values.product_type_id) : null,
        promotion_id: values.promotion_id ? Number(values.promotion_id) : null,
        min_contract_period: values.min_contract_period !== "" ? Number(values.min_contract_period) : null,
        max_stay_weeks: values.max_stay_weeks !== "" ? Number(values.max_stay_weeks) : null,
        bond_amount: values.bond_amount !== "" ? Number(values.bond_amount) : null,
        bond_weeks: values.bond_weeks !== "" ? Number(values.bond_weeks) : null,
        advance_weeks: values.advance_weeks !== "" ? Number(values.advance_weeks) : null,
        admin_fee: values.admin_fee !== "" ? Number(values.admin_fee) : null,
        cleaning_fee: values.cleaning_fee !== "" ? Number(values.cleaning_fee) : null,
        term_type: values.term_type || null,
        contract_term: values.contract_term || null,
        room_type: values.room_type || null,
        // meal_plan / guest_age only apply to homestay; clear otherwise
        meal_plan: values.room_type === HOMESTAY_ROOM_TYPE ? (values.meal_plan || null) : null,
        guest_age: values.room_type === HOMESTAY_ROOM_TYPE ? (values.guest_age || null) : null,
      };
      const url = isNew ? "/api/v1/accommodations" : `/api/v1/accommodations/${id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await apiFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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

  const availableToAdd = catalogSvcs.filter(c => !accSvcs.some(a => a.service_id === c.id));

  return (
    <Layout>
      <div className="p-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/products/products")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">{isNew ? `${t('common.new')} ${t('nav.products')}` : (product?.name ?? t('nav.products'))}</h1>
          </div>
          {product?.status && (
            <Badge className={STATUS_COLORS[product.status] ?? "bg-gray-100 text-gray-700"}>{product.status}</Badge>
          )}
        </div>

        <form onSubmit={handleSubmit(v => save.mutate(v))} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white border rounded-lg p-6 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{t('product.section_general')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>{t('product.label_name')} *</Label>
                <Input {...register("name")} placeholder="e.g. Standard Room Package" className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label>{t('product.label_description')}</Label>
                <Textarea {...register("item_description")} placeholder="Brief description" className="mt-1" rows={2} />
              </div>
              <div>
                <Label>{t('product.label_group')}</Label>
                <Select value={String(watch("product_group_id") || "_none")} onValueChange={v => setValue("product_group_id", v === "_none" ? "" : v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t('common.none')}</SelectItem>
                    {(groups as any[]).map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.display}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('product.label_type')}</Label>
                <Select value={String(watch("product_type_id") || "_none")} onValueChange={v => setValue("product_type_id", v === "_none" ? "" : v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t('common.none')}</SelectItem>
                    {(types as any[]).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.display}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>{t('product.label_promotion')}</Label>
                <Select value={String(watch("promotion_id") || "_none")} onValueChange={v => setValue("promotion_id", v === "_none" ? "" : v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t('product.label_no_promotion')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t('product.label_no_promotion')}</SelectItem>
                    {(promotions as any[]).map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.display}</SelectItem>)}
                  </SelectContent>
                </Select>
                {(() => {
                  const selPromo = (promotions as any[]).find((p: any) => String(p.id) === String(watch("promotion_id")));
                  if (!selPromo?.valid_from && !selPromo?.valid_to) return null;
                  const fmt = (v: string | null) => v ? new Date(v).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" }) : "—";
                  return (
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      Valid: {fmt(selPromo.valid_from)} – {fmt(selPromo.valid_to)}
                    </p>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white border rounded-lg p-6 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{t('product.section_pricing')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Weekly Rate (AUD)</Label>
                <Input {...register("weekly_rate")} type="number" step="0.01" placeholder="0.00" className="mt-1" />
              </div>
              <div>
                <Label>{t('product.label_price')} (List)</Label>
                <Input {...register("price")} type="number" step="0.01" placeholder="0.00" className="mt-1" />
              </div>
              <div>
                <Label>{t('product.label_currency')}</Label>
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
                <Label>{t('product.label_gst_included')}</Label>
              </div>
              <div>
                <Label>Admin Fee (AUD)</Label>
                <Input {...register("admin_fee")} type="number" step="0.01" placeholder="0.00" className="mt-1" />
              </div>
              <div>
                <Label>Cleaning Fee (AUD)</Label>
                <Input {...register("cleaning_fee")} type="number" step="0.01" placeholder="0.00" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Billing & Contract Terms */}
          <div className="bg-white border rounded-lg p-6 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Billing &amp; Contract Terms</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Billing Frequency</Label>
                <Select value={watch("billing_frequency")} onValueChange={v => setValue("billing_frequency", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Biweekly">Fortnightly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Term Type</Label>
                <Select value={watch("term_type") || "_none"} onValueChange={v => setValue("term_type", v === "_none" ? "" : v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— None —</SelectItem>
                    <SelectItem value="Fixed">Fixed Term</SelectItem>
                    <SelectItem value="Periodic">Periodic</SelectItem>
                    <SelectItem value="Open">Open Ended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Min Contract Period</Label>
                <div className="flex gap-2 mt-1">
                  <Input {...register("min_contract_period")} type="number" placeholder="e.g. 4" className="w-24" />
                  <Select value={watch("min_contract_period_unit")} onValueChange={v => setValue("min_contract_period_unit", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="weeks">Weeks</SelectItem>
                      <SelectItem value="months">Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Max Stay (weeks)</Label>
                <Input {...register("max_stay_weeks")} type="number" placeholder="e.g. 52" className="mt-1" />
              </div>
              <div>
                <Label>Bond (weeks)</Label>
                <Input {...register("bond_weeks")} type="number" step="0.5" placeholder="4" className="mt-1" />
              </div>
              <div>
                <Label>Advance Payment (weeks)</Label>
                <Input {...register("advance_weeks")} type="number" step="0.5" placeholder="2" className="mt-1" />
              </div>
              <div>
                <Label>Bond Amount (AUD override)</Label>
                <Input {...register("bond_amount")} type="number" step="0.01" placeholder="Leave blank to use bond weeks" className="mt-1" />
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2 mb-3">
                {t("accommodation_options.section", "Classification")}
              </h3>
              <AccommodationOptionFields
                value={{
                  contract_term: watch("contract_term"),
                  room_type: watch("room_type"),
                  meal_plan: watch("meal_plan"),
                  guest_age: watch("guest_age"),
                }}
                onChange={(patch) => {
                  for (const [k, v] of Object.entries(patch)) setValue(k as any, v as any);
                  // leaving homestay clears its meal/age sub-options
                  if (patch.room_type && patch.room_type !== HOMESTAY_ROOM_TYPE) {
                    setValue("meal_plan" as any, "");
                    setValue("guest_age" as any, "");
                  }
                }}
              />
            </div>

            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2 mb-3">Inclusions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(["includes_wifi", "includes_parking", "includes_utilities", "includes_meals", "includes_laundry", "includes_cleaning"] as const).map(field => (
                  <div key={field} className="flex items-center gap-2">
                    <Switch checked={watch(field as any)} onCheckedChange={v => setValue(field as any, v)} />
                    <Label className="text-sm capitalize">{field.replace("includes_", "").replace("_", " ")}</Label>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <Label>Extra Inclusions (free text)</Label>
                <Input {...register("extra_inclusions")} placeholder="e.g. Pool access, Gym" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Display Options */}
          <div className="bg-white border rounded-lg p-6 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{t('product.section_display')}</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Switch checked={watch("display_on_booking_page")} onCheckedChange={v => setValue("display_on_booking_page", v)} />
                <Label>{t('product.label_display_on_booking')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={watch("display_on_invoice")} onCheckedChange={v => setValue("display_on_invoice", v)} />
                <Label>{t('product.label_display_on_invoice')}</Label>
              </div>
            </div>
            <div>
              <Label>{t('product.label_status')}</Label>
              <Select value={watch("status")} onValueChange={v => setValue("status", v)}>
                <SelectTrigger className="mt-1 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">{t('common.active')}</SelectItem>
                  <SelectItem value="Inactive">{t('common.inactive')}</SelectItem>
                  <SelectItem value="Archived">{t('common.archived')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={save.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {save.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>

        {/* Packed Services — shown directly below form (existing products only) */}
        {!isNew && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{t('product.section_packed_services')}</h2>
                <p className="text-xs text-muted-foreground mt-1">{t('product.packed_services_desc')}</p>
              </div>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> {t('common.add_service')}
              </Button>
            </div>

            {svcLoading ? (
              <div className="text-sm text-muted-foreground py-8 text-center">{t('common.loading')}</div>
            ) : accSvcs.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                <PackagePlus className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{t('product.no_services_assigned')}</p>
                <p className="text-xs mt-1">{t('product.click_add_service')}</p>
              </div>
            ) : (
              <div className="border rounded-lg divide-y bg-white">
                {accSvcs.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{s.service_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.service_type} ·{" "}
                        {s.custom_price != null
                          ? `${s.currency} $${s.custom_price.toFixed(2)} (custom)`
                          : s.base_price != null
                          ? `${s.currency} $${s.base_price.toFixed(2)}`
                          : "No price"}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={s.is_mandatory}
                          onCheckedChange={v => toggleMandatory(s.id, v)}
                        />
                        <Label className={cn("text-xs", s.is_mandatory ? "text-orange-600 font-medium" : "text-muted-foreground")}>
                          {s.is_mandatory ? "Mandatory" : "Optional"}
                        </Label>
                      </div>
                      <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 h-8 w-8" onClick={() => removeSvc(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Service Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Service to Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Service *</Label>
              <Select value={addId} onValueChange={setAddId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select a service" /></SelectTrigger>
                <SelectContent>
                  {availableToAdd.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}{c.base_price != null ? ` — ${c.currency} $${c.base_price.toFixed(2)}` : ""}
                    </SelectItem>
                  ))}
                  {availableToAdd.length === 0 && <SelectItem value="_none" disabled>All services already added</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Custom Price (leave blank to use catalogue price)</Label>
              <Input type="number" step="0.01" min="0" value={addPrice} onChange={e => setAddPrice(e.target.value)} placeholder="e.g. 150.00" className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={addMandatory} onCheckedChange={setAddMandatory} />
              <Label>Mandatory (auto-selected for guests, cannot opt out)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSvc} disabled={!addId || addSaving}>{addSaving ? "Adding…" : "Add Service"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

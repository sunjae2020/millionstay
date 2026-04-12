import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { LookupField, MultiLookupField, LookupOption } from "@/components/LookupField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useForm, Controller } from "react-hook-form";
import {
  useGetSpace,
  useCreateSpace,
  useUpdateSpace,
  useListProperties,
  useListSpaces,
  useListSpacePolicies,
  useListSpaceOptions,
  useGetSpaceAvailability,
  useBlockSpaceAvailability,
  getListSpacesQueryKey,
  getGetSpaceQueryKey,
  getGetSpaceAvailabilityQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, CalendarDays, Images, Plus, Trash2, PackagePlus } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SpacePhotoManager } from "@/components/SpacePhotoManager";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

interface SpaceForm {
  name: string;
  manual_input: boolean;
  space_type: string;
  custom_type_name: string;
  max_occupancy: string;
  booking_mode: string;
  base_weekly_price: string;
  base_daily_price: string;
  base_currency: string;
  floor_number: string;
  floor_area_sqm: string;
  description: string;
  ical_import_url: string;
  status: string;
  landlord_account_id: string;
}

export default function SpaceDetail() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const id = isNew ? null : parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  // Lookup states
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [propertyName, setPropertyName] = useState<string | null>(null);
  const [propertySearch, setPropertySearch] = useState("");

  const [parentSpaceId, setParentSpaceId] = useState<number | null>(null);
  const [parentSpaceName, setParentSpaceName] = useState<string | null>(null);
  const [parentSpaceSearch, setParentSpaceSearch] = useState("");

  const [policyId, setPolicyId] = useState<number | null>(null);
  const [policyName, setPolicyName] = useState<string | null>(null);
  const [policySearch, setPolicySearch] = useState("");

  const [optionIds, setOptionIds] = useState<number[]>([]);
  const [optionNames, setOptionNames] = useState<string[]>([]);
  const [optionSearch, setOptionSearch] = useState("");

  // Privacy state
  const [privacyHideUnitNo, setPrivacyHideUnitNo] = useState(true);
  const [privacyHideStreetNo, setPrivacyHideStreetNo] = useState(true);
  const [privacyMapBlur, setPrivacyMapBlur] = useState(true);

  // Availability state
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  // Space services state
  type SpaceService = {
    id: number; space_id: number; service_id: number;
    service_name: string; service_type: string;
    base_price: number | null; custom_price: number | null;
    currency: string; billing_trigger: string;
    is_optional: boolean; is_mandatory: boolean;
    sort_order: number; status: string;
  };
  type CatalogService = { id: number; name: string; service_type: string; base_price: number | null; currency: string; status: string; };
  const [spaceServices, setSpaceServices] = useState<SpaceService[]>([]);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [svcLoading, setSvcLoading] = useState(false);
  const [addSvcOpen, setAddSvcOpen] = useState(false);
  const [addSvcId, setAddSvcId] = useState<string>("");
  const [addSvcMandatory, setAddSvcMandatory] = useState(false);
  const [addSvcPrice, setAddSvcPrice] = useState<string>("");
  const [addSvcSaving, setAddSvcSaving] = useState(false);
  const { toast } = useToast();

  const loadSpaceServices = async () => {
    if (!id) return;
    setSvcLoading(true);
    try {
      const [sRes, cRes] = await Promise.all([
        apiFetch(`/api/v1/spaces/${id}/services`),
        apiFetch(`/api/v1/services?status=Active&limit=200`),
      ]);
      const sJson = await sRes.json();
      const cJson = await cRes.json();
      if (sJson.success) setSpaceServices(sJson.data ?? []);
      if (cJson.success) setCatalogServices(cJson.data ?? []);
    } finally {
      setSvcLoading(false);
    }
  };

  const handleAddService = async () => {
    if (!id || !addSvcId) return;
    setAddSvcSaving(true);
    try {
      const res = await apiFetch(`/api/v1/spaces/${id}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: parseInt(addSvcId, 10),
          is_mandatory: addSvcMandatory,
          custom_price: addSvcPrice ? parseFloat(addSvcPrice) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add service");
      toast({ title: "Service added" });
      setAddSvcOpen(false);
      setAddSvcId(""); setAddSvcMandatory(false); setAddSvcPrice("");
      await loadSpaceServices();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setAddSvcSaving(false);
    }
  };

  const handleToggleMandatory = async (mapId: number, val: boolean) => {
    if (!id) return;
    await apiFetch(`/api/v1/spaces/${id}/services/${mapId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_mandatory: val }),
    });
    setSpaceServices(prev => prev.map(s => s.id === mapId ? { ...s, is_mandatory: val } : s));
  };

  const handleRemoveService = async (mapId: number) => {
    if (!id || !confirm("Remove this service from the space?")) return;
    const res = await apiFetch(`/api/v1/spaces/${id}/services/${mapId}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Service removed" });
      setSpaceServices(prev => prev.filter(s => s.id !== mapId));
    }
  };

  const { data: space, isLoading } = useGetSpace(
    id!,
    { query: { enabled: !isNew && !!id, queryKey: getGetSpaceQueryKey(id!) } }
  );

  const { data: properties } = useListProperties({ search: propertySearch || undefined });
  const { data: allSpaces } = useListSpaces({ search: parentSpaceSearch || undefined });
  const { data: policies } = useListSpacePolicies({ search: policySearch || undefined });
  const { data: spaceOptions } = useListSpaceOptions({ search: optionSearch || undefined });
  const { data: availability, refetch: refetchAvailability } = useGetSpaceAvailability(
    id!,
    { query: { enabled: !isNew && !!id, queryKey: getGetSpaceAvailabilityQueryKey(id!) } }
  );

  const propertyOptions: LookupOption[] = (properties ?? []).map((p) => ({
    id: p.id, label: p.name, sublabel: p.address ?? undefined,
  }));
  const spaceOptions2: LookupOption[] = (allSpaces ?? [])
    .filter((s) => s.id !== id)
    .map((s) => ({ id: s.id, label: s.name, sublabel: s.space_type ?? undefined }));
  const policyOptions: LookupOption[] = (policies ?? []).map((p) => ({
    id: p.id, label: p.name,
  }));
  const optionLookupOptions: LookupOption[] = (spaceOptions ?? []).map((o) => ({
    id: o.id, label: o.name, sublabel: o.display_name ?? undefined,
  }));

  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<SpaceForm>({
    defaultValues: {
      name: "", manual_input: false, space_type: "", custom_type_name: "",
      max_occupancy: "", booking_mode: "", base_weekly_price: "", base_daily_price: "", base_currency: "AUD",
      floor_number: "", floor_area_sqm: "", description: "",
      ical_import_url: "", status: "Active", landlord_account_id: "",
    },
  });

  const watchedSpaceType = watch("space_type");

  useEffect(() => {
    if (space) {
      reset({
        name: space.name ?? "",
        manual_input: space.manual_input ?? false,
        space_type: space.space_type ?? "",
        custom_type_name: space.custom_type_name ?? "",
        max_occupancy: space.max_occupancy?.toString() ?? "",
        booking_mode: space.booking_mode ?? "",
        base_weekly_price: space.base_weekly_price?.toString() ?? "",
        base_daily_price: space.base_daily_price?.toString() ?? "",
        base_currency: space.base_currency ?? "AUD",
        floor_number: space.floor_number?.toString() ?? "",
        floor_area_sqm: space.floor_area_sqm?.toString() ?? "",
        description: space.description ?? "",
        ical_import_url: space.ical_import_url ?? "",
        status: space.status ?? "Active",
        landlord_account_id: space.landlord_account_id?.toString() ?? "",
      });
      setPropertyId(space.property_id ?? null);
      setPropertyName(space.property_name ?? null);
      setParentSpaceId(space.parent_space_id ?? null);
      setParentSpaceName(space.parent_space_name ?? null);
      setPolicyId(space.space_policy_id ?? null);
      setPolicyName(space.policy_name ?? null);
      setOptionIds(space.space_option_ids ?? []);
      const names = (space.space_option_ids ?? []).map((oid) => {
        const opt = (spaceOptions ?? []).find((o) => o.id === oid);
        return opt?.name ?? `Option #${oid}`;
      });
      setOptionNames(names);
      setPrivacyHideUnitNo(space.privacy_hide_unit_no ?? true);
      setPrivacyHideStreetNo(space.privacy_hide_street_no ?? true);
      setPrivacyMapBlur(space.privacy_map_blur ?? true);
    }
  }, [space, reset]);

  const blockMutation = useBlockSpaceAvailability({
    mutation: {
      onSuccess: () => {
        if (id) qc.invalidateQueries({ queryKey: getGetSpaceAvailabilityQueryKey(id) });
        setSelectedDates([]);
        refetchAvailability();
      },
    },
  });

  const createMutation = useCreateSpace({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSpacesQueryKey() });
        navigate("/property/spaces");
      },
    },
  });

  const updateMutation = useUpdateSpace({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSpacesQueryKey() });
        if (id) qc.invalidateQueries({ queryKey: getGetSpaceQueryKey(id) });
        navigate("/property/spaces");
      },
    },
  });

  function onSubmit(data: SpaceForm) {
    const payload = {
      name: data.name,
      manual_input: data.manual_input,
      space_type: data.space_type || null,
      custom_type_name: data.custom_type_name || null,
      max_occupancy: data.max_occupancy ? parseInt(data.max_occupancy, 10) : null,
      booking_mode: data.booking_mode || null,
      base_weekly_price: data.base_weekly_price ? parseFloat(data.base_weekly_price) : null,
      base_daily_price: data.base_daily_price ? parseFloat(data.base_daily_price) : null,
      base_currency: data.base_currency || null,
      floor_number: data.floor_number ? parseInt(data.floor_number, 10) : null,
      floor_area_sqm: data.floor_area_sqm ? parseFloat(data.floor_area_sqm) : null,
      description: data.description || null,
      ical_import_url: data.ical_import_url || null,
      status: data.status,
      property_id: propertyId,
      parent_space_id: parentSpaceId,
      space_policy_id: policyId,
      landlord_account_id: data.landlord_account_id ? parseInt(data.landlord_account_id, 10) : null,
      space_option_ids: optionIds,
      privacy_hide_unit_no: privacyHideUnitNo,
      privacy_hide_street_no: privacyHideStreetNo,
      privacy_map_blur: privacyMapBlur,
    };
    if (isNew) {
      createMutation.mutate({ data: payload });
    } else if (id) {
      updateMutation.mutate({ id, data: payload });
    }
  }

  function toggleDate(date: string) {
    setSelectedDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    );
  }

  if (!isNew && isLoading) {
    return <Layout><PageHeader title={t("common.loading")} /><div className="p-6 text-sm text-muted-foreground">Loading...</div></Layout>;
  }

  return (
    <Layout>
      <PageHeader
        title={isNew ? `${t("common.new")} ${t("nav.space")}` : (space?.name ?? t("nav.space"))}
        subtitle={!isNew ? `ID: ${id}` : "Create a new rental space"}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/property/spaces">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            </Link>
            <Button size="sm" className="gap-1.5" onClick={handleSubmit(onSubmit)} disabled={createMutation.isPending || updateMutation.isPending}>
              <Save className="h-4 w-4" /> Save
            </Button>
          </div>
        }
      />

      <div className="p-6">
        <Tabs defaultValue="details" onValueChange={(v) => { if (v === "services") loadSpaceServices(); }}>
          <TabsList className="mb-5 flex-wrap h-auto gap-1">
            <TabsTrigger value="details">Details</TabsTrigger>
            {!isNew && <TabsTrigger value="availability">Availability</TabsTrigger>}
            {!isNew && (
              <TabsTrigger value="photos" className="gap-1.5">
                <Images className="h-3.5 w-3.5" /> Photos
              </TabsTrigger>
            )}
            {!isNew && (
              <TabsTrigger value="services" className="gap-1.5">
                <PackagePlus className="h-3.5 w-3.5" /> Services
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="details">
            <form className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl">

              {/* ① GENERAL — 기본 정보 */}
              <div className="col-span-2 bg-card rounded-lg border p-5 flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">General</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      {...register("name", { required: true })}
                      placeholder="Space name"
                      className={errors.name ? "border-destructive" : ""}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</Label>
                    <Controller
                      name="status"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                            <SelectItem value="Suspended">Suspended</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Controller
                      name="manual_input"
                      control={control}
                      render={({ field }) => (
                        <Checkbox
                          id="manual_input"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                    <Label htmlFor="manual_input" className="font-normal cursor-pointer text-sm">Manual Input</Label>
                  </div>
                </div>
              </div>

              {/* ② MAIN — 매물 유형 및 설정 */}
              <div className="col-span-2 bg-card rounded-lg border p-5 flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">Space Settings</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Space Type</Label>
                    <Controller
                      name="space_type"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Private Room">Private Room</SelectItem>
                            <SelectItem value="Shared Room">Shared Room</SelectItem>
                            <SelectItem value="Whole Property">Whole Property</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  {watchedSpaceType === "Other" && (
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custom Type Name</Label>
                      <Input {...register("custom_type_name")} placeholder="Custom space type" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Booking Mode</Label>
                    <Controller
                      name="booking_mode"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select mode" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Instant">Instant</SelectItem>
                            <SelectItem value="Request">Request</SelectItem>
                            <SelectItem value="Manual">Manual</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Max Occupancy</Label>
                    <Input {...register("max_occupancy")} type="number" min={1} placeholder="e.g. 2" />
                  </div>
                  <div className="col-span-2">
                    <MultiLookupField
                      label="Space Options / Amenities"
                      values={optionIds}
                      displayTexts={optionNames}
                      onSelect={(id, label) => {
                        setOptionIds((prev) => [...prev, id]);
                        setOptionNames((prev) => [...prev, label]);
                      }}
                      onRemove={(id) => {
                        const idx = optionIds.indexOf(id);
                        setOptionIds((prev) => prev.filter((x) => x !== id));
                        setOptionNames((prev) => prev.filter((_, i) => i !== idx));
                      }}
                      options={optionLookupOptions}
                      onSearch={setOptionSearch}
                      searchPlaceholder="Search space options..."
                    />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</Label>
                    <Textarea {...register("description")} rows={4} placeholder="Describe the space — layout, furnishings, highlights..." />
                  </div>
                </div>
              </div>

              {/* ③ PROPERTY & PARENT SPACE — 나란히 */}
              <div className="bg-card rounded-lg border p-5 flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">Property</h3>
                <LookupField
                  label="Property"
                  value={propertyId}
                  displayText={propertyName}
                  onSelect={(id, label) => { setPropertyId(id); setPropertyName(label); }}
                  onClear={() => { setPropertyId(null); setPropertyName(null); }}
                  options={propertyOptions}
                  onSearch={setPropertySearch}
                  searchPlaceholder="Search properties..."
                />
              </div>

              <div className="bg-card rounded-lg border p-5 flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">Parent Space</h3>
                <LookupField
                  label="Parent Space"
                  value={parentSpaceId}
                  displayText={parentSpaceName}
                  onSelect={(id, label) => { setParentSpaceId(id); setParentSpaceName(label); }}
                  onClear={() => { setParentSpaceId(null); setParentSpaceName(null); }}
                  options={spaceOptions2}
                  onSearch={setParentSpaceSearch}
                  searchPlaceholder="Search spaces..."
                />
              </div>

              {/* ④ PRICING & POLICY — 나란히 */}
              <div className="bg-card rounded-lg border p-5 flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">Pricing</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Weekly Price</Label>
                    <Input {...register("base_weekly_price")} type="number" step="0.01" min={0} placeholder="0.00" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Daily Price</Label>
                    <Input {...register("base_daily_price")} type="number" step="5" min={0} placeholder="0.00" />
                    <p className="text-xs text-muted-foreground">Auto: Weekly ÷ 2, rounded to $5</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Currency</Label>
                    <Input {...register("base_currency")} placeholder="AUD" maxLength={3} />
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-lg border p-5 flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">Policy</h3>
                <LookupField
                  label="Space Policy"
                  value={policyId}
                  displayText={policyName}
                  onSelect={(id, label) => { setPolicyId(id); setPolicyName(label); }}
                  onClear={() => { setPolicyId(null); setPolicyName(null); }}
                  options={policyOptions}
                  onSearch={setPolicySearch}
                  searchPlaceholder="Search policies..."
                />
              </div>

              {/* ⑤ PHYSICAL DETAILS & ACCOUNTS — 나란히 */}
              <div className="bg-card rounded-lg border p-5 flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">Physical Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Floor Number</Label>
                    <Input {...register("floor_number")} type="number" placeholder="e.g. 3" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Floor Area (sqm)</Label>
                    <Input {...register("floor_area_sqm")} type="number" step="0.1" placeholder="e.g. 25.5" />
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-lg border p-5 flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">Accounts</h3>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Landlord Account ID</Label>
                  <Input {...register("landlord_account_id")} type="number" placeholder="Account ID" />
                </div>
              </div>

              {/* ⑥ PRIVACY — 전체 너비 */}
              <div className="col-span-2 bg-card rounded-lg border p-5 flex flex-col gap-3">
                <div className="border-b pb-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Privacy</h3>
                  <p className="text-xs text-muted-foreground mt-1">Controls what address &amp; location information is shown to the public.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/40 border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium leading-tight">Hide Unit / Apt No.</p>
                      <p className="text-xs text-muted-foreground mt-1">"1/285 La Trobe" → "285 La Trobe St"</p>
                    </div>
                    <Switch checked={privacyHideUnitNo} onCheckedChange={setPrivacyHideUnitNo} className="shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/40 border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium leading-tight">Hide Street Number</p>
                      <p className="text-xs text-muted-foreground mt-1">"285 La Trobe" → "La Trobe St"</p>
                    </div>
                    <Switch checked={privacyHideStreetNo} onCheckedChange={setPrivacyHideStreetNo} className="shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/40 border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium leading-tight">Blur Map Location</p>
                      <p className="text-xs text-muted-foreground mt-1">Shows ~35 m offset with area circle</p>
                    </div>
                    <Switch checked={privacyMapBlur} onCheckedChange={setPrivacyMapBlur} className="shrink-0 mt-0.5" />
                  </div>
                </div>
              </div>

              {/* ⑦ OTA SYNC — 하단 고급 설정 */}
              <div className="col-span-2 bg-card rounded-lg border p-5 flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">OTA Sync</h3>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">iCal Import URL</Label>
                  <Input {...register("ical_import_url")} type="url" placeholder="https://..." />
                </div>
              </div>
            </form>
          </TabsContent>

          {!isNew && (
            <TabsContent value="availability">
              <div className="max-w-2xl">
                <div className="bg-card rounded-lg border p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-sm">30-Day Availability</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Click dates to select, then block or unblock them</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedDates.length > 0 && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => id && blockMutation.mutate({ id, data: { dates: selectedDates, action: "unblock" } })}
                            disabled={blockMutation.isPending}
                          >
                            Unblock ({selectedDates.length})
                          </Button>
                          <Button
                            size="sm"
                            className="text-xs"
                            onClick={() => id && blockMutation.mutate({ id, data: { dates: selectedDates, action: "block" } })}
                            disabled={blockMutation.isPending}
                          >
                            Block ({selectedDates.length})
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-green-100 border border-green-300 inline-block"></span>Available</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-rose-100 border border-rose-300 inline-block"></span>Blocked</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-primary/20 border border-primary/50 inline-block"></span>Selected</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {availability?.data?.calendar?.map((day) => {
                      const isSelected = selectedDates.includes(day.date);
                      const isBlocked = !day.is_available;
                      return (
                        <button
                          key={day.date}
                          type="button"
                          onClick={() => toggleDate(day.date)}
                          className={cn(
                            "text-xs p-2 rounded flex flex-col items-center transition-colors",
                            isSelected
                              ? "bg-primary/20 border border-primary/50 text-primary"
                              : isBlocked
                              ? "bg-rose-50 border border-rose-200 text-rose-600"
                              : "bg-green-50 border border-green-200 text-green-700 hover:bg-green-100"
                          )}
                        >
                          <span className="font-medium">{format(parseISO(day.date), "d")}</span>
                          <span className="text-[10px] opacity-70">{format(parseISO(day.date), "MMM")}</span>
                        </button>
                      );
                    })}
                    {!availability?.data?.calendar?.length && (
                      <div className="col-span-7 py-8 text-center text-sm text-muted-foreground">
                        Loading availability...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          )}

          {!isNew && id && (
            <TabsContent value="photos">
              <SpacePhotoManager spaceId={id} />
            </TabsContent>
          )}

          {!isNew && id && (
            <TabsContent value="services">
              <div className="max-w-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-base">Service Packages</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Services assigned to this space. Guests see only these services during booking.
                      {spaceServices.length === 0 && !svcLoading && (
                        <span className="text-amber-600"> (None assigned — all active services will be shown to guests)</span>
                      )}
                    </p>
                  </div>
                  <Button size="sm" className="gap-1.5" onClick={() => setAddSvcOpen(true)}>
                    <Plus className="h-4 w-4" /> Add Service
                  </Button>
                </div>

                {svcLoading ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
                ) : spaceServices.length === 0 ? (
                  <div className="border border-dashed rounded-lg py-12 text-center text-muted-foreground text-sm">
                    No services assigned yet. Click "Add Service" to get started.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-xs text-muted-foreground uppercase tracking-wider">
                          <th className="px-4 py-2.5 text-left font-medium">Service</th>
                          <th className="px-4 py-2.5 text-left font-medium">Type</th>
                          <th className="px-4 py-2.5 text-right font-medium">Price</th>
                          <th className="px-4 py-2.5 text-center font-medium">Mandatory</th>
                          <th className="px-4 py-2.5 text-center font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {spaceServices.map((svc, idx) => (
                          <tr key={svc.id} className={cn("border-b last:border-0", idx % 2 === 0 ? "bg-background" : "bg-muted/20")}>
                            <td className="px-4 py-3 font-medium">
                              {svc.service_name}
                              {!svc.is_optional && (
                                <Badge variant="secondary" className="ml-2 text-xs">Required</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground capitalize">
                              {svc.service_type.replace("_", " ")}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {svc.custom_price != null ? (
                                <span className="font-semibold text-orange-600">
                                  {svc.currency} {svc.custom_price.toFixed(2)}
                                  <span className="ml-1 text-xs text-muted-foreground font-normal">(custom)</span>
                                </span>
                              ) : svc.base_price != null ? (
                                <span>{svc.currency} {svc.base_price.toFixed(2)}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Switch
                                checked={svc.is_mandatory}
                                onCheckedChange={(val) => handleToggleMandatory(svc.id, val)}
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleRemoveService(svc.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Add Service Dialog */}
              <Dialog open={addSvcOpen} onOpenChange={setAddSvcOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Service to Space</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Service *</Label>
                      <Select value={addSvcId} onValueChange={setAddSvcId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a service…" />
                        </SelectTrigger>
                        <SelectContent>
                          {catalogServices
                            .filter(c => !spaceServices.some(s => s.service_id === c.id))
                            .map(c => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.name}
                                {c.base_price != null && (
                                  <span className="text-muted-foreground ml-1">({c.currency} {c.base_price})</span>
                                )}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Custom Price (AUD) — leave blank to use catalog price
                      </Label>
                      <Input
                        type="number" min="0" step="0.01"
                        placeholder="e.g. 50.00"
                        value={addSvcPrice}
                        onChange={e => setAddSvcPrice(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={addSvcMandatory} onCheckedChange={setAddSvcMandatory} id="mandatory-sw" />
                      <Label htmlFor="mandatory-sw" className="cursor-pointer text-sm font-normal">
                        Mandatory (auto-included in every booking)
                      </Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddSvcOpen(false)}>Cancel</Button>
                    <Button disabled={!addSvcId || addSvcSaving} onClick={handleAddService}>
                      {addSvcSaving ? "Adding…" : "Add Service"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}

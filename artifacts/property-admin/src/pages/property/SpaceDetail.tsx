import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
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
import { ArrowLeft, Save, CalendarDays, Images } from "lucide-react";
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
  base_currency: string;
  min_stay_weeks: string;
  floor_number: string;
  floor_area_sqm: string;
  description: string;
  ical_import_url: string;
  status: string;
  landlord_account_id: string;
}

export default function SpaceDetail() {
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

  // Availability state
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

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
      max_occupancy: "", booking_mode: "", base_weekly_price: "", base_currency: "AUD",
      min_stay_weeks: "", floor_number: "", floor_area_sqm: "", description: "",
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
        base_currency: space.base_currency ?? "AUD",
        min_stay_weeks: space.min_stay_weeks?.toString() ?? "",
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
      base_currency: data.base_currency || null,
      min_stay_weeks: data.min_stay_weeks ? parseInt(data.min_stay_weeks, 10) : null,
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
    return <Layout><PageHeader title="Loading..." /><div className="p-6 text-sm text-muted-foreground">Loading...</div></Layout>;
  }

  return (
    <Layout>
      <PageHeader
        title={isNew ? "New Space" : (space?.name ?? "Edit Space")}
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
        <Tabs defaultValue="details">
          <TabsList className="mb-5 flex-wrap h-auto gap-1">
            <TabsTrigger value="details">Details</TabsTrigger>
            {!isNew && <TabsTrigger value="availability">Availability</TabsTrigger>}
            {!isNew && (
              <TabsTrigger value="photos" className="gap-1.5">
                <Images className="h-3.5 w-3.5" /> Photos
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="details">
            <form className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl">

              {/* GENERAL */}
              <div className="col-span-2 bg-card rounded-lg border p-5 flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">General</h3>
                <div className="grid grid-cols-2 gap-4">
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
                  <div className="flex items-center gap-2 col-span-2">
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
                </div>
              </div>

              {/* PROPERTY */}
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

              {/* PARENT SPACE */}
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

              {/* MAIN */}
              <div className="col-span-2 bg-card rounded-lg border p-5 flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">Main</h3>
                <div className="grid grid-cols-2 gap-4">
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
                            <SelectItem value="Desk">Desk</SelectItem>
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
                      label="Space Options"
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
                </div>
              </div>

              {/* POLICY */}
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

              {/* PRICING */}
              <div className="bg-card rounded-lg border p-5 flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">Pricing</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Weekly Price</Label>
                    <Input {...register("base_weekly_price")} type="number" step="0.01" min={0} placeholder="0.00" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Currency</Label>
                    <Input {...register("base_currency")} placeholder="AUD" maxLength={3} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Min Stay (weeks)</Label>
                    <Input {...register("min_stay_weeks")} type="number" min={1} placeholder="e.g. 4" />
                  </div>
                </div>
              </div>

              {/* ACCOUNTS */}
              <div className="bg-card rounded-lg border p-5 flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">Accounts</h3>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Landlord Account ID</Label>
                  <Input {...register("landlord_account_id")} type="number" placeholder="Account ID" />
                </div>
              </div>

              {/* OTHERS */}
              <div className="bg-card rounded-lg border p-5 flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">Others</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Floor Number</Label>
                    <Input {...register("floor_number")} type="number" placeholder="e.g. 3" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Floor Area (sqm)</Label>
                    <Input {...register("floor_area_sqm")} type="number" step="0.1" placeholder="e.g. 25.5" />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</Label>
                    <Textarea {...register("description")} rows={3} placeholder="Space description..." />
                  </div>
                </div>
              </div>

              {/* OTA SYNC */}
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
        </Tabs>
      </div>
    </Layout>
  );
}

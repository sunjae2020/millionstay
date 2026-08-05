import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { LookupField, LookupOption } from "@/components/LookupField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useForm, Controller } from "react-hook-form";
import {
  useGetProperty,
  useCreateProperty,
  useUpdateProperty,
  useUpdatePropertyStatus,
  useListSuburbs,
  useListSpaces,
  getListPropertiesQueryKey,
  getGetPropertyQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, CheckCircle, Layers, MapPin, Loader2, Languages } from "lucide-react";
import { ContentTranslationsPanel } from "@/components/ContentTranslationsPanel";
import { Link } from "wouter";
import { format } from "date-fns";

import { ExportableTable } from "@/components/ui/ExportCsvButton";
interface PropertyForm {
  name: string;
  address: string;
  address2: string;
  city: string;
  state: string;
  postcode: string;
  country_code: string;
  lat: string;
  lng: string;
  approval_status: string;
  description: string;
  // Land/building registry details (등기부 표시) — printed on the 부동산의 표식
  // table of a Korean lease agreement's 별지.
  lot_address: string;
  building_use: string;
  building_structure: string;
  land_category: string;
  land_area_m2: string;
  land_right_type: string;
}

export default function PropertyDetail() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const isNew = !params.id || params.id === "new";
  const id = isNew ? null : parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [suburbId, setSuburbId] = useState<number | null>(null);
  const [suburbName, setSuburbName] = useState<string | null>(null);
  const [suburbSearch, setSuburbSearch] = useState("");

  const { data: property, isLoading } = useGetProperty(
    id!,
    { query: { enabled: !isNew && !!id, queryKey: getGetPropertyQueryKey(id!) } }
  );
  const { data: spaces } = useListSpaces(
    { property_id: id ?? undefined },
    { query: { enabled: !isNew && !!id, queryKey: ["list-spaces", id] } }
  );
  const { data: suburbs } = useListSuburbs(
    { search: suburbSearch || undefined },
    { query: { enabled: true, queryKey: ["list-suburbs", suburbSearch] } }
  );

  const suburbOptions: LookupOption[] = (suburbs ?? []).map((s) => ({
    id: s.id,
    label: s.name,
    sublabel: [s.state, s.country_code].filter(Boolean).join(", "),
  }));

  const [detectingCoords, setDetectingCoords] = useState(false);
  const [coordsMsg, setCoordsMsg] = useState("");

  const { register, handleSubmit, reset, control, setValue, watch, formState: { errors } } = useForm<PropertyForm>({
    defaultValues: {
      name: "", address: "", address2: "", city: "", state: "",
      postcode: "", country_code: "AU", lat: "", lng: "",
      approval_status: "Pending", description: "",
      lot_address: "", building_use: "", building_structure: "",
      land_category: "", land_area_m2: "", land_right_type: "",
    },
  });

  useEffect(() => {
    if (property) {
      reset({
        name: property.name ?? "",
        address: property.address ?? "",
        address2: property.address2 ?? "",
        city: property.city ?? "",
        state: property.state ?? "",
        postcode: property.postcode ?? "",
        country_code: property.country_code ?? "AU",
        lat: property.lat?.toString() ?? "",
        lng: property.lng?.toString() ?? "",
        approval_status: property.approval_status ?? "Pending",
        description: property.description ?? "",
        lot_address: property.lot_address ?? "",
        building_use: property.building_use ?? "",
        building_structure: property.building_structure ?? "",
        land_category: property.land_category ?? "",
        land_area_m2: property.land_area_m2?.toString() ?? "",
        land_right_type: property.land_right_type ?? "",
      });
      setSuburbId(property.suburb_id ?? null);
      setSuburbName(property.suburb_name ?? null);
    }
  }, [property, reset]);

  const createMutation = useCreateProperty({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
        navigate("/property/properties");
      },
    },
  });

  const updateMutation = useUpdateProperty({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
        if (id) qc.invalidateQueries({ queryKey: getGetPropertyQueryKey(id) });
        navigate("/property/properties");
      },
    },
  });

  const statusMutation = useUpdatePropertyStatus({
    mutation: {
      onSuccess: () => {
        if (id) qc.invalidateQueries({ queryKey: getGetPropertyQueryKey(id) });
        qc.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
      },
    },
  });

  const watchedAddress = watch("address");
  const watchedCity = watch("city");
  const watchedState = watch("state");
  const watchedPostcode = watch("postcode");

  async function handleAutoDetect() {
    const parts = [watchedAddress, watchedCity, watchedState, watchedPostcode, "Australia"].filter(Boolean);
    const q = parts.join(", ");
    if (!q.trim()) { setCoordsMsg(t("property.coords_enter_address")); return; }
    setDetectingCoords(true);
    setCoordsMsg("");
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      const data = await res.json();
      if (data.length > 0) {
        setValue("lat", parseFloat(data[0].lat).toFixed(6));
        setValue("lng", parseFloat(data[0].lon).toFixed(6));
        setCoordsMsg(t("property.coords_detected", { location: data[0].display_name.slice(0, 60) }));
      } else {
        setCoordsMsg(t("property.coords_not_found"));
      }
    } catch {
      setCoordsMsg(t("property.coords_failed"));
    } finally {
      setDetectingCoords(false);
    }
  }

  function onSubmit(data: PropertyForm) {
    const payload = {
      name: data.name,
      address: data.address || null,
      address2: data.address2 || null,
      city: data.city || null,
      state: data.state || null,
      postcode: data.postcode || null,
      country_code: data.country_code || null,
      lat: data.lat ? parseFloat(data.lat) : null,
      lng: data.lng ? parseFloat(data.lng) : null,
      approval_status: data.approval_status,
      suburb_id: suburbId,
      description: data.description || null,
      lot_address: data.lot_address || null,
      building_use: data.building_use || null,
      building_structure: data.building_structure || null,
      land_category: data.land_category || null,
      land_area_m2: data.land_area_m2 ? parseFloat(data.land_area_m2) : null,
      land_right_type: data.land_right_type || null,
    };
    if (isNew) {
      createMutation.mutate({ data: payload });
    } else if (id) {
      updateMutation.mutate({ id, data: payload });
    }
  }

  if (!isNew && isLoading) {
    return (
      <Layout>
        <PageHeader title={t("common.loading")} />
        <div className="p-6 text-muted-foreground text-sm">{t("common.loading")}</div>
      </Layout>
    );
  }

  const isPending = property?.approval_status === "Pending";

  return (
    <Layout>
      <PageHeader
        title={isNew ? `${t("common.new")} ${t("nav.property")}` : (property?.name ?? t("nav.property"))}
        subtitle={!isNew ? (
          <span className="flex items-center gap-2">
            ID: {id}
            {property && <StatusBadge status={property.approval_status} />}
          </span>
        ) as unknown as string : t("property.subtitle_new")}
        actions={
          <div className="flex items-center gap-2">
            {!isNew && isPending && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
                onClick={() => id && statusMutation.mutate({ id, data: { approval_status: "Active" } })}
                disabled={statusMutation.isPending}
              >
                <CheckCircle className="h-4 w-4" /> {t("common.approve")}
              </Button>
            )}
            <Link href="/property/properties">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> {t("common.back")}
              </Button>
            </Link>
            <Button size="sm" className="gap-1.5" onClick={handleSubmit(onSubmit)} disabled={createMutation.isPending || updateMutation.isPending}>
              <Save className="h-4 w-4" /> {t("common.save")}
            </Button>
          </div>
        }
      />

      <div className="p-6">
        <Tabs defaultValue="details">
          <TabsList className="mb-5">
            <TabsTrigger value="details">{t("property.tab_details")}</TabsTrigger>
            {!isNew && <TabsTrigger value="spaces">{t("property.tab_spaces")} ({spaces?.length ?? 0})</TabsTrigger>}
            {!isNew && <TabsTrigger value="translations" className="gap-1.5"><Languages className="h-3.5 w-3.5" /> {t("property.tab_translations")}</TabsTrigger>}
          </TabsList>

          <TabsContent value="details">
            <div className="max-w-2xl">
              <form className="bg-card rounded-lg border p-6 flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {t("property.label_name")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      {...register("name", { required: true })}
                      placeholder={t("property.placeholder_name")}
                      className={errors.name ? "border-destructive" : ""}
                    />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("property.label_address")}</Label>
                    <Input {...register("address")} placeholder={t("property.placeholder_address")} />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("property.label_address2")}</Label>
                    <Input {...register("address2")} placeholder={t("property.placeholder_address2")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("property.label_city")}</Label>
                    <Input {...register("city")} placeholder={t("property.label_city")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("property.label_state")}</Label>
                    <Input {...register("state")} placeholder={t("property.label_state")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("property.label_postcode")}</Label>
                    <Input {...register("postcode")} placeholder={t("property.label_postcode")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("property.label_country")}</Label>
                    <Controller
                      name="country_code"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("property.placeholder_country")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AU">AU — {t("suburb.country_au")}</SelectItem>
                            <SelectItem value="US">US — {t("suburb.country_us")}</SelectItem>
                            <SelectItem value="GB">GB — {t("suburb.country_gb")}</SelectItem>
                            <SelectItem value="NZ">NZ — {t("suburb.country_nz")}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("property.label_coords")}</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5"
                        onClick={handleAutoDetect}
                        disabled={detectingCoords}
                      >
                        {detectingCoords
                          ? <><Loader2 className="h-3 w-3 animate-spin" />{t("property.btn_detecting")}</>
                          : <><MapPin className="h-3 w-3" />{t("property.btn_autodetect")}</>
                        }
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input {...register("lat")} type="number" step="any" placeholder={t("property.placeholder_lat")} />
                      <Input {...register("lng")} type="number" step="any" placeholder={t("property.placeholder_lng")} />
                    </div>
                    {coordsMsg && (
                      <p className="text-xs text-muted-foreground">{coordsMsg}</p>
                    )}
                  </div>

                  <div className="col-span-2">
                    <LookupField
                      label={t("property.label_suburb")}
                      value={suburbId}
                      displayText={suburbName}
                      onSelect={(id, label) => { setSuburbId(id); setSuburbName(label); }}
                      onClear={() => { setSuburbId(null); setSuburbName(null); }}
                      options={suburbOptions}
                      onSearch={setSuburbSearch}
                      searchPlaceholder={t("property.placeholder_suburb")}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("property.label_approval_status")}</Label>
                    <Controller
                      name="approval_status"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pending">{t("common.pending")}</SelectItem>
                            <SelectItem value="Active">{t("common.active")}</SelectItem>
                            <SelectItem value="Suspended">{t("common.suspended")}</SelectItem>
                            <SelectItem value="Rejected">{t("common.rejected")}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="col-span-2 flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("property.label_description")}</Label>
                    <Textarea {...register("description")} placeholder={t("property.placeholder_description")} rows={4} />
                  </div>

                  {/* Land/building registry — printed on the 부동산의 표식 table
                      of a lease agreement's 별지. Per-unit areas live on spaces. */}
                  <div className="col-span-2 pt-2 border-t">
                    <h3 className="text-sm font-semibold">{t("property.registry_heading")}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("property.registry_hint")}</p>
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("property.label_lot_address")}</Label>
                    <Input {...register("lot_address")} placeholder={t("property.placeholder_lot_address")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("property.label_building_use")}</Label>
                    <Input {...register("building_use")} placeholder={t("property.placeholder_building_use")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("property.label_building_structure")}</Label>
                    <Input {...register("building_structure")} placeholder={t("property.placeholder_building_structure")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("property.label_land_category")}</Label>
                    <Input {...register("land_category")} placeholder={t("property.placeholder_land_category")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("property.label_land_area")}</Label>
                    <Input {...register("land_area_m2")} type="number" step="any" placeholder="3519" />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("property.label_land_right_type")}</Label>
                    <Input {...register("land_right_type")} placeholder={t("property.placeholder_land_right_type")} />
                  </div>
                </div>
              </form>
            </div>
          </TabsContent>

          {!isNew && (
            <TabsContent value="spaces">
              <div className="rounded-md border bg-card overflow-x-auto max-w-3xl">
                <ExportableTable fileName="property-detail" className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("property.col_space_name")}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("property.col_space_type")}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("property.col_space_status")}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("property.col_space_booking")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {!spaces?.length ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-sm">{t("property.no_spaces")}</td>
                      </tr>
                    ) : (
                      spaces.map((space) => (
                        <tr key={space.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">
                            <Link href={`/property/spaces/${space.id}`} className="text-primary hover:underline">
                              {space.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{space.space_type ?? "—"}</td>
                          <td className="px-4 py-3"><StatusBadge status={space.status} /></td>
                          <td className="px-4 py-3 text-muted-foreground">{space.booking_mode ?? "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </ExportableTable>
              </div>
            </TabsContent>
          )}
          {!isNew && id && (
            <TabsContent value="translations">
              <ContentTranslationsPanel entity="properties" id={id} sourceLang="ko" />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}

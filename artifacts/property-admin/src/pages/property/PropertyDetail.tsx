import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
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
import { ArrowLeft, Save, CheckCircle, Layers } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

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
}

export default function PropertyDetail() {
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
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
    { query: { enabled: !isNew && !!id } }
  );
  const { data: suburbs } = useListSuburbs(
    { search: suburbSearch || undefined },
    { query: { enabled: true } }
  );

  const suburbOptions: LookupOption[] = (suburbs ?? []).map((s) => ({
    id: s.id,
    label: s.name,
    sublabel: [s.state, s.country_code].filter(Boolean).join(", "),
  }));

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<PropertyForm>({
    defaultValues: {
      name: "", address: "", address2: "", city: "", state: "",
      postcode: "", country_code: "AU", lat: "", lng: "",
      approval_status: "Pending", description: "",
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
        <PageHeader title="Loading..." />
        <div className="p-6 text-muted-foreground text-sm">Loading property...</div>
      </Layout>
    );
  }

  const isPending = property?.approval_status === "Pending";

  return (
    <Layout>
      <PageHeader
        title={isNew ? "New Property" : (property?.name ?? "Edit Property")}
        subtitle={!isNew ? (
          <span className="flex items-center gap-2">
            ID: {id}
            {property && <StatusBadge status={property.approval_status} />}
          </span>
        ) as unknown as string : "Create a new property listing"}
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
                <CheckCircle className="h-4 w-4" /> Approve
              </Button>
            )}
            <Link href="/property/properties">
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
          <TabsList className="mb-5">
            <TabsTrigger value="details">Details</TabsTrigger>
            {!isNew && <TabsTrigger value="spaces">Spaces ({spaces?.length ?? 0})</TabsTrigger>}
          </TabsList>

          <TabsContent value="details">
            <div className="max-w-2xl">
              <form className="bg-card rounded-lg border p-6 flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      {...register("name", { required: true })}
                      placeholder="Property name"
                      className={errors.name ? "border-destructive" : ""}
                    />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Address Line 1</Label>
                    <Input {...register("address")} placeholder="Street address" />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Address Line 2</Label>
                    <Input {...register("address2")} placeholder="Unit, floor, suite..." />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">City</Label>
                    <Input {...register("city")} placeholder="City" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">State</Label>
                    <Input {...register("state")} placeholder="State" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Postcode</Label>
                    <Input {...register("postcode")} placeholder="Postcode" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Country Code</Label>
                    <Controller
                      name="country_code"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AU">AU — Australia</SelectItem>
                            <SelectItem value="US">US — United States</SelectItem>
                            <SelectItem value="GB">GB — United Kingdom</SelectItem>
                            <SelectItem value="NZ">NZ — New Zealand</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Latitude</Label>
                    <Input {...register("lat")} type="number" step="any" placeholder="e.g. -33.8688" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Longitude</Label>
                    <Input {...register("lng")} type="number" step="any" placeholder="e.g. 151.2093" />
                  </div>

                  <div className="col-span-2">
                    <LookupField
                      label="Suburb"
                      value={suburbId}
                      displayText={suburbName}
                      onSelect={(id, label) => { setSuburbId(id); setSuburbName(label); }}
                      onClear={() => { setSuburbId(null); setSuburbName(null); }}
                      options={suburbOptions}
                      onSearch={setSuburbSearch}
                      searchPlaceholder="Search suburbs..."
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Approval Status</Label>
                    <Controller
                      name="approval_status"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Suspended">Suspended</SelectItem>
                            <SelectItem value="Rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="col-span-2 flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</Label>
                    <Textarea {...register("description")} placeholder="Property description..." rows={4} />
                  </div>
                </div>
              </form>
            </div>
          </TabsContent>

          {!isNew && (
            <TabsContent value="spaces">
              <div className="rounded-md border bg-card overflow-hidden max-w-3xl">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Type</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Booking Mode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {!spaces?.length ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-sm">No spaces linked to this property</td>
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
                </table>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}

import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import {
  useGetSuburb,
  useCreateSuburb,
  useUpdateSuburb,
  getListSuburbsQueryKey,
  getGetSuburbQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "wouter";

interface SuburbForm {
  name: string;
  state: string;
  postcode: string;
  country_code: string;
  area_name: string;
  lat: string;
  lng: string;
  status: string;
}

export default function SuburbDetail() {
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const id = isNew ? null : parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: suburb, isLoading } = useGetSuburb(
    id!,
    { query: { enabled: !isNew && !!id, queryKey: getGetSuburbQueryKey(id!) } }
  );

  const { register, handleSubmit, reset, control, formState: { errors, isDirty } } = useForm<SuburbForm>({
    defaultValues: {
      name: "", state: "", postcode: "", country_code: "AU",
      area_name: "", lat: "", lng: "", status: "Active",
    },
  });

  useEffect(() => {
    if (suburb) {
      reset({
        name: suburb.name ?? "",
        state: suburb.state ?? "",
        postcode: suburb.postcode ?? "",
        country_code: suburb.country_code ?? "AU",
        area_name: suburb.area_name ?? "",
        lat: suburb.lat?.toString() ?? "",
        lng: suburb.lng?.toString() ?? "",
        status: suburb.status ?? "Active",
      });
    }
  }, [suburb, reset]);

  const createMutation = useCreateSuburb({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSuburbsQueryKey() });
        navigate("/property/suburbs");
      },
    },
  });

  const updateMutation = useUpdateSuburb({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSuburbsQueryKey() });
        if (id) qc.invalidateQueries({ queryKey: getGetSuburbQueryKey(id) });
        navigate("/property/suburbs");
      },
    },
  });

  function onSubmit(data: SuburbForm) {
    const payload = {
      name: data.name,
      state: data.state || null,
      postcode: data.postcode || null,
      country_code: data.country_code,
      area_name: data.area_name || null,
      lat: data.lat ? parseFloat(data.lat) : null,
      lng: data.lng ? parseFloat(data.lng) : null,
      status: data.status,
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
        <div className="p-6 text-muted-foreground text-sm">Loading suburb...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title={isNew ? "New Suburb" : (suburb?.name ?? "Edit Suburb")}
        subtitle={isNew ? "Create a new suburb" : `ID: ${id}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/property/suburbs">
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
        <div className="max-w-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="bg-card rounded-lg border p-6 flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  {...register("name", { required: true })}
                  placeholder="Suburb name"
                  className={errors.name ? "border-destructive" : ""}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Area Name</Label>
                <Input {...register("area_name")} placeholder="Area or precinct name" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">State</Label>
                <Input {...register("state")} placeholder="e.g. NSW, VIC" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Postcode</Label>
                <Input {...register("postcode")} placeholder="e.g. 2000" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Country Code <span className="text-destructive">*</span></Label>
                <Controller
                  name="country_code"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
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
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}

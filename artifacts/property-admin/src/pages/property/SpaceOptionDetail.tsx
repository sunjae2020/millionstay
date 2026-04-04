import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import {
  useGetSpaceOption,
  useCreateSpaceOption,
  useUpdateSpaceOption,
  getListSpaceOptionsQueryKey,
  getGetSpaceOptionQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "wouter";

interface OptionForm {
  name: string;
  display_name: string;
  category: string;
  status: string;
}

export default function SpaceOptionDetail() {
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const id = isNew ? null : parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: option, isLoading } = useGetSpaceOption(
    id!,
    { query: { enabled: !isNew && !!id, queryKey: getGetSpaceOptionQueryKey(id!) } }
  );

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<OptionForm>({
    defaultValues: { name: "", display_name: "", category: "", status: "Active" },
  });

  useEffect(() => {
    if (option) {
      reset({
        name: option.name ?? "",
        display_name: option.display_name ?? "",
        category: option.category ?? "",
        status: option.status ?? "Active",
      });
    }
  }, [option, reset]);

  const createMutation = useCreateSpaceOption({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSpaceOptionsQueryKey() });
        navigate("/property/space-options");
      },
    },
  });

  const updateMutation = useUpdateSpaceOption({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSpaceOptionsQueryKey() });
        if (id) qc.invalidateQueries({ queryKey: getGetSpaceOptionQueryKey(id) });
        navigate("/property/space-options");
      },
    },
  });

  function onSubmit(data: OptionForm) {
    const payload = {
      name: data.name,
      display_name: data.display_name || null,
      category: data.category || null,
      status: data.status,
    };
    if (isNew) {
      createMutation.mutate({ data: payload });
    } else if (id) {
      updateMutation.mutate({ id, data: payload });
    }
  }

  if (!isNew && isLoading) {
    return <Layout><PageHeader title="Loading..." /><div className="p-6 text-sm text-muted-foreground">Loading...</div></Layout>;
  }

  return (
    <Layout>
      <PageHeader
        title={isNew ? "New Space Option" : (option?.name ?? "Edit Space Option")}
        subtitle={isNew ? "Create a new amenity tag" : `ID: ${id}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/property/space-options">
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
        <div className="max-w-xl">
          <form className="bg-card rounded-lg border p-6 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                {...register("name", { required: true })}
                placeholder="Option name (internal)"
                className={errors.name ? "border-destructive" : ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Display Name</Label>
              <Input {...register("display_name")} placeholder="Display name (user facing)" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</Label>
              <Input {...register("category")} placeholder="e.g. Amenities, Utilities" />
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
          </form>
        </div>
      </div>
    </Layout>
  );
}

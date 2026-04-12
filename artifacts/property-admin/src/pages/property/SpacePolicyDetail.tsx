import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useForm, Controller } from "react-hook-form";
import {
  useGetSpacePolicy,
  useCreateSpacePolicy,
  useUpdateSpacePolicy,
  getListSpacePoliciesQueryKey,
  getGetSpacePolicyQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "wouter";

interface PolicyForm {
  name: string;
  same_gender: "yes" | "no";
  lady_only: "yes" | "no";
  no_pet: "yes" | "no";
  no_smoking: "yes" | "no";
  meal_option: "yes" | "no";
  minimum_age: string;
  status: string;
}

function BoolRadio({ label, name, control }: { label: string; name: keyof PolicyForm; control: any }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <RadioGroup
            value={field.value as string}
            onValueChange={field.onChange}
            className="flex items-center gap-4"
          >
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="yes" id={`${name}-yes`} />
              <Label htmlFor={`${name}-yes`} className="font-normal cursor-pointer">Yes</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="no" id={`${name}-no`} />
              <Label htmlFor={`${name}-no`} className="font-normal cursor-pointer">No</Label>
            </div>
          </RadioGroup>
        )}
      />
    </div>
  );
}

export default function SpacePolicyDetail() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const id = isNew ? null : parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: policy, isLoading } = useGetSpacePolicy(
    id!,
    { query: { enabled: !isNew && !!id, queryKey: getGetSpacePolicyQueryKey(id!) } }
  );

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<PolicyForm>({
    defaultValues: {
      name: "",
      same_gender: "no",
      lady_only: "no",
      no_pet: "no",
      no_smoking: "no",
      meal_option: "no",
      minimum_age: "",
      status: "Active",
    },
  });

  useEffect(() => {
    if (policy) {
      reset({
        name: policy.name ?? "",
        same_gender: policy.same_gender ? "yes" : "no",
        lady_only: policy.lady_only ? "yes" : "no",
        no_pet: policy.no_pet ? "yes" : "no",
        no_smoking: policy.no_smoking ? "yes" : "no",
        meal_option: policy.meal_option ? "yes" : "no",
        minimum_age: policy.minimum_age?.toString() ?? "",
        status: policy.status ?? "Active",
      });
    }
  }, [policy, reset]);

  const createMutation = useCreateSpacePolicy({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSpacePoliciesQueryKey() });
        navigate("/property/space-policies");
      },
    },
  });

  const updateMutation = useUpdateSpacePolicy({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSpacePoliciesQueryKey() });
        if (id) qc.invalidateQueries({ queryKey: getGetSpacePolicyQueryKey(id) });
        navigate("/property/space-policies");
      },
    },
  });

  function onSubmit(data: PolicyForm) {
    const payload = {
      name: data.name,
      same_gender: data.same_gender === "yes",
      lady_only: data.lady_only === "yes",
      no_pet: data.no_pet === "yes",
      no_smoking: data.no_smoking === "yes",
      meal_option: data.meal_option === "yes",
      minimum_age: data.minimum_age ? parseInt(data.minimum_age, 10) : null,
      status: data.status,
    };
    if (isNew) {
      createMutation.mutate({ data: payload });
    } else if (id) {
      updateMutation.mutate({ id, data: payload });
    }
  }

  if (!isNew && isLoading) {
    return <Layout><PageHeader title={t("common.loading")} /><div className="p-6 text-sm text-muted-foreground">Loading...</div></Layout>;
  }

  return (
    <Layout>
      <PageHeader
        title={isNew ? `${t("common.new")} ${t("nav.space_policy")}` : (policy?.name ?? t("nav.space_policy"))}
        subtitle={isNew ? "Create a new house rules template" : `ID: ${id}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/property/space-policies">
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
                Policy Name <span className="text-destructive">*</span>
              </Label>
              <Input
                {...register("name", { required: true })}
                placeholder="e.g. Standard Residential Policy"
                className={errors.name ? "border-destructive" : ""}
              />
            </div>

            <div className="border-t pt-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">House Rules</p>
              <div className="grid grid-cols-2 gap-5">
                <BoolRadio label="Same Gender" name="same_gender" control={control} />
                <BoolRadio label="Lady Only" name="lady_only" control={control} />
                <BoolRadio label="No Pets" name="no_pet" control={control} />
                <BoolRadio label="No Smoking" name="no_smoking" control={control} />
                <BoolRadio label="Meal Option" name="meal_option" control={control} />
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Minimum Age</Label>
                  <Input
                    {...register("minimum_age")}
                    type="number"
                    min={0}
                    max={99}
                    placeholder="e.g. 18"
                    className="w-32"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</Label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-40">
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
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}

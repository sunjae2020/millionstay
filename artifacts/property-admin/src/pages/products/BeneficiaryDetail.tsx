import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useForm, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useGetBeneficiary,
  getGetBeneficiaryQueryKey,
  useCreateBeneficiary,
  useUpdateBeneficiary,
  getListBeneficiariesQueryKey,
  useLookupAccounts,
  useLookupCommissions,
  useLookupContractProducts,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "wouter";

type FormValues = {
  name: string;
  account_id: number | null;
  contract_product_id: number | null;
  commission_id: number | null;
  commission_type: string;
  split_percentage: number | null;
  fixed_amount: number | null;
  priority: number;
  notes: string;
  status: string;
};

const NULL_VAL = "__none";

export default function BeneficiaryDetail() {
  const { t } = useTranslation();
  const params = useParams<{ id?: string }>();
  const isNew = !params.id || params.id === "new";
  const id = isNew ? null : Number(params.id);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: beneficiary, isLoading } = useGetBeneficiary(id!, {
    query: { queryKey: getGetBeneficiaryQueryKey(id!), enabled: !isNew },
  });

  const { data: accounts } = useLookupAccounts({});
  const { data: commissions } = useLookupCommissions({});
  const { data: contractProducts } = useLookupContractProducts({});

  const createMutation = useCreateBeneficiary({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getListBeneficiariesQueryKey() });
        navigate(`/products/beneficiaries/${data.id}`);
      },
    },
  });

  const updateMutation = useUpdateBeneficiary({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListBeneficiariesQueryKey() });
        if (id) qc.invalidateQueries({ queryKey: getGetBeneficiaryQueryKey(id) });
      },
    },
  });

  const { register, handleSubmit, control, watch, reset, setValue } = useForm<FormValues>({
    defaultValues: {
      name: "",
      account_id: null,
      contract_product_id: null,
      commission_id: null,
      commission_type: "Percentage",
      split_percentage: null,
      fixed_amount: null,
      priority: 1,
      notes: "",
      status: "Active",
    },
  });

  const commissionType = watch("commission_type");

  useEffect(() => {
    if (beneficiary) {
      reset({
        name: beneficiary.name ?? "",
        account_id: beneficiary.account_id ?? null,
        contract_product_id: beneficiary.contract_product_id ?? null,
        commission_id: beneficiary.commission_id ?? null,
        commission_type: beneficiary.commission_type ?? "Percentage",
        split_percentage: beneficiary.split_percentage ?? null,
        fixed_amount: beneficiary.fixed_amount ?? null,
        priority: beneficiary.priority ?? 1,
        notes: beneficiary.notes ?? "",
        status: beneficiary.status ?? "Active",
      });
    }
  }, [beneficiary, reset]);

  const onSubmit = (values: FormValues) => {
    const payload = {
      ...values,
      account_id: values.account_id ?? 0,
      split_percentage: commissionType === "Percentage" ? (values.split_percentage ?? null) : null,
      fixed_amount: commissionType === "Fixed" ? (values.fixed_amount ?? null) : null,
    };

    if (isNew) {
      createMutation.mutate({ data: payload });
    } else if (id) {
      updateMutation.mutate({ id, data: payload });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (!isNew && isLoading) {
    return (
      <Layout>
        <div className="p-8 text-center text-muted-foreground">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Link href="/products/beneficiaries" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            {isNew ? `${t("common.new")} ${t("nav.beneficiary")}` : (beneficiary?.name ?? t("nav.beneficiary"))}
          </span>
        }
        subtitle={!isNew ? `ID #${id}` : undefined}
        actions={
          !isNew && beneficiary?.status ? (
            <Badge className={`text-xs ${beneficiary.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
              {beneficiary.status}
            </Badge>
          ) : undefined
        }
      />

      <div className="p-6 max-w-3xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">Basic Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input {...register("name", { required: true })} placeholder="e.g. ABC Realty Commission" />
              </div>

              <div>
                <Label>Account <span className="text-destructive">*</span></Label>
                <Controller
                  name="account_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value != null ? String(field.value) : NULL_VAL}
                      onValueChange={(v) => field.onChange(v === NULL_VAL ? null : Number(v))}
                    >
                      <SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NULL_VAL}>— Select account —</SelectItem>
                        {(accounts ?? []).map((a) => (
                          <SelectItem key={a.id} value={String(a.id)}>{a.display ?? a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <Label>Contract Product <span className="text-muted-foreground text-xs">(optional — blank = all)</span></Label>
                <Controller
                  name="contract_product_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value != null ? String(field.value) : NULL_VAL}
                      onValueChange={(v) => field.onChange(v === NULL_VAL ? null : Number(v))}
                    >
                      <SelectTrigger><SelectValue placeholder="All contract products" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NULL_VAL}>All contract products</SelectItem>
                        {(contractProducts ?? []).map((cp) => (
                          <SelectItem key={cp.id} value={String(cp.id)}>{cp.display ?? cp.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <Label>Priority</Label>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  {...register("priority", { valueAsNumber: true })}
                  placeholder="1"
                />
                <p className="text-xs text-muted-foreground mt-1">Lower = processed first (e.g. fixed fees before % splits)</p>
              </div>

              <div>
                <Label>Status</Label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="Archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Commission Structure */}
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">Commission Structure</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Commission Template <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Controller
                  name="commission_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value != null ? String(field.value) : NULL_VAL}
                      onValueChange={(v) => field.onChange(v === NULL_VAL ? null : Number(v))}
                    >
                      <SelectTrigger><SelectValue placeholder="Custom (manual entry)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NULL_VAL}>Custom (manual entry)</SelectItem>
                        {(commissions ?? []).map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.display ?? c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <Label>Commission Type <span className="text-destructive">*</span></Label>
                <Controller
                  name="commission_type"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => {
                      field.onChange(v);
                      if (v === "Percentage") setValue("fixed_amount", null);
                      else setValue("split_percentage", null);
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Percentage">Percentage (%)</SelectItem>
                        <SelectItem value="Fixed">Fixed Amount ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {commissionType === "Percentage" ? (
                <div>
                  <Label>Split Percentage (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    {...register("split_percentage", { valueAsNumber: true })}
                    placeholder="e.g. 10"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Percentage of booking revenue allocated to this beneficiary</p>
                </div>
              ) : (
                <div>
                  <Label>Fixed Amount (AUD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    {...register("fixed_amount", { valueAsNumber: true })}
                    placeholder="e.g. 80.00"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Fixed amount charged per billing period (e.g. per week)</p>
                </div>
              )}

              <div className="md:col-span-2">
                <Label>Notes</Label>
                <Textarea {...register("notes")} placeholder="Additional notes..." rows={3} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Link href="/products/beneficiaries">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : isNew ? "Create Beneficiary" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}

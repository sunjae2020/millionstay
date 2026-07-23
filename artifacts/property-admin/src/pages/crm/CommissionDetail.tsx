import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import {
  useGetCommission, useCreateCommission, useUpdateCommission,
  getListCommissionsQueryKey, getGetCommissionQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "wouter";

interface CommissionForm {
  name: string;
  commission_type: string;
  commission_rate: string;
  commission_amount: string;
  description: string;
  status: string;
}

export default function CommissionDetail() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const id = isNew ? null : parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: commission, isLoading } = useGetCommission(
    id!, { query: { enabled: !isNew && !!id, queryKey: getGetCommissionQueryKey(id!) } }
  );

  const { register, handleSubmit, reset, control, watch, formState: { errors, isDirty } } = useForm<CommissionForm>({
    defaultValues: { name: "", commission_type: "Percentage", commission_rate: "", commission_amount: "", description: "", status: "Active" },
  });

  const commissionType = watch("commission_type");

  useEffect(() => {
    if (commission) {
      reset({
        name: commission.name ?? "",
        commission_type: commission.commission_type ?? "Percentage",
        commission_rate: commission.commission_rate?.toString() ?? "",
        commission_amount: commission.commission_amount?.toString() ?? "",
        description: commission.description ?? "",
        status: commission.status ?? "Active",
      });
    }
  }, [commission, reset]);

  const createMutation = useCreateCommission({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListCommissionsQueryKey() });
        navigate("/crm/commissions");
      },
    },
  });

  const updateMutation = useUpdateCommission({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListCommissionsQueryKey() });
        if (id) qc.invalidateQueries({ queryKey: getGetCommissionQueryKey(id) });
        navigate("/crm/commissions");
      },
    },
  });

  const onSubmit = (values: CommissionForm) => {
    const data = {
      name: values.name,
      commission_type: values.commission_type,
      commission_rate: values.commission_rate ? parseFloat(values.commission_rate) : null,
      commission_amount: values.commission_amount ? parseFloat(values.commission_amount) : null,
      description: values.description || null,
      status: values.status,
    };
    if (isNew) {
      createMutation.mutate({ data });
    } else {
      updateMutation.mutate({ id: id!, data });
    }
  };

  if (!isNew && isLoading) return <Layout><p className="p-6 text-sm text-muted-foreground">Loading…</p></Layout>;

  return (
    <Layout>
      <PageHeader
        title={isNew ? `${t("common.new")} ${t("nav.commission")}` : (commission?.name ?? t("nav.commission"))}
        actions={
          <div className="flex gap-2">
            <Link href="/crm/commissions">
              <Button variant="outline" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> {t("common.back")}</Button>
            </Link>
            <Button size="sm" className="gap-1.5" onClick={handleSubmit(onSubmit)}
              disabled={createMutation.isPending || updateMutation.isPending}>
              <Save className="h-4 w-4" /> {t("common.save")}
            </Button>
          </div>
        }
      />
      <div className="p-6 max-w-2xl">
        <h3 className="text-xs font-semibold text-primary uppercase tracking-wider border-b pb-2 mb-4">{t("commission.section_general")}</h3>
        <div className="grid gap-5">
          <div className="grid gap-1.5">
            <Label>{t("common.name")} *</Label>
            <Input {...register("name", { required: true })} placeholder="e.g. 10% Agent Commission" />
            {errors.name && <p className="text-xs text-destructive">Name is required</p>}
          </div>

          <div className="grid gap-1.5">
            <Label>{t("common.type")}</Label>
            <Controller name="commission_type" control={control} render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Percentage">Percentage</SelectItem>
                  <SelectItem value="FixedAmount">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>

          {commissionType === "Percentage" ? (
            <div className="grid gap-1.5">
              <Label>{t("commission.label_rate")}</Label>
              <Input {...register("commission_rate")} type="number" step="0.01" placeholder="e.g. 10" />
            </div>
          ) : (
            <div className="grid gap-1.5">
              <Label>{t("commission.label_amount")}</Label>
              <Input {...register("commission_amount")} type="number" step="0.01" placeholder="e.g. 500" />
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>{t("commission.label_notes")}</Label>
            <Input {...register("description")} placeholder="Optional notes" />
          </div>

          <div className="grid gap-1.5">
            <Label>{t("commission.label_status")}</Label>
            <Controller name="status" control={control} render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>
        </div>
      </div>
    </Layout>
  );
}

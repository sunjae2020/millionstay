import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { APP_NAME } from "@/lib/appName";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import {
  useGetPaymentInfo, useCreatePaymentInfo, useUpdatePaymentInfo,
  getListPaymentInfoQueryKey, getGetPaymentInfoQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "wouter";

interface PaymentInfoForm {
  name: string;
  payment_type: string;
  bank_name: string;
  swift_code: string;
  bsb_number: string;
  account_number: string;
  account_name: string;
  stripe_account_id: string;
  description: string;
  status: string;
}

export default function PaymentInfoDetail() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const isNew = !params.id || params.id === "new";
  const id = isNew ? null : parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: record, isLoading } = useGetPaymentInfo(
    id!, { query: { enabled: !isNew && !!id, queryKey: getGetPaymentInfoQueryKey(id!) } }
  );

  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<PaymentInfoForm>({
    defaultValues: {
      name: "", payment_type: "BankTransfer", bank_name: "", swift_code: "", bsb_number: "",
      account_number: "", account_name: "", stripe_account_id: "", description: "", status: "Active",
    },
  });

  const paymentType = watch("payment_type");

  useEffect(() => {
    if (record) {
      reset({
        name: record.name ?? "",
        payment_type: record.payment_type ?? "BankTransfer",
        bank_name: record.bank_name ?? "",
        swift_code: record.swift_code ?? "",
        bsb_number: record.bsb_number ?? "",
        account_number: record.account_number ?? "",
        account_name: record.account_name ?? "",
        stripe_account_id: record.stripe_account_id ?? "",
        description: record.description ?? "",
        status: record.status ?? "Active",
      });
    }
  }, [record, reset]);

  const createMutation = useCreatePaymentInfo({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListPaymentInfoQueryKey() });
        navigate("/crm/payment-info");
      },
    },
  });

  const updateMutation = useUpdatePaymentInfo({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListPaymentInfoQueryKey() });
        if (id) qc.invalidateQueries({ queryKey: getGetPaymentInfoQueryKey(id) });
        navigate("/crm/payment-info");
      },
    },
  });

  const onSubmit = (values: PaymentInfoForm) => {
    const data = {
      name: values.name,
      payment_type: values.payment_type,
      bank_name: values.bank_name || null,
      swift_code: values.swift_code || null,
      bsb_number: values.bsb_number || null,
      account_number: values.account_number || null,
      account_name: values.account_name || null,
      stripe_account_id: values.stripe_account_id || null,
      description: values.description || null,
      status: values.status,
    };
    if (isNew) {
      createMutation.mutate({ data });
    } else {
      updateMutation.mutate({ id: id!, data });
    }
  };

  if (!isNew && isLoading) return <Layout><p className="p-6 text-sm text-muted-foreground">{t("common.loading")}</p></Layout>;

  return (
    <Layout>
      <PageHeader
        title={isNew ? `${t("common.new")} ${t("nav.payment_info")}` : (record?.name ?? t("nav.payment_info"))}
        actions={
          <div className="flex gap-2">
            <Link href="/crm/payment-info">
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
        <div className="grid gap-5">
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider border-b pb-2">{t("payment_info.section_general")}</h3>
          <div className="grid gap-1.5">
            <Label>{t("common.name")} *</Label>
            <Input {...register("name", { required: true })} placeholder={t("payment_info.ph_name")} />
            {errors.name && <p className="text-xs text-destructive">{t("payment_info.name_required")}</p>}
          </div>

          <div className="grid gap-1.5">
            <Label>{t("payment_info.label_method")}</Label>
            <Controller name="payment_type" control={control} render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BankTransfer">{t("payment_info.type_bank_transfer")}</SelectItem>
                  <SelectItem value="Stripe">Stripe</SelectItem>
                  <SelectItem value="Cash">{t("payment_info.type_cash")}</SelectItem>
                  <SelectItem value="Other">{t("payment_info.type_other")}</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>

          {paymentType === "BankTransfer" && (
            <>
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider border-b pb-2 mt-4">{t("payment_info.section_bank")}</h3>
              <div className="grid gap-1.5">
                <Label>{t("payment_info.label_bank_name")}</Label>
                <Input {...register("bank_name")} placeholder={t("payment_info.ph_bank_name")} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>{t("payment_info.label_bsb")}</Label>
                  <Input {...register("bsb_number")} placeholder={t("payment_info.ph_bsb")} />
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("payment_info.label_account_number")}</Label>
                  <Input {...register("account_number")} placeholder={t("payment_info.ph_account_number")} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>{t("payment_info.label_account_name")}</Label>
                <Input {...register("account_name")} placeholder={t("payment_info.ph_account_name", { name: APP_NAME })} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("payment_info.label_swift")}</Label>
                <Input {...register("swift_code")} placeholder={t("payment_info.ph_swift")} />
              </div>
            </>
          )}

          {paymentType === "Stripe" && (
            <>
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider border-b pb-2 mt-4">{t("payment_info.section_stripe")}</h3>
              <div className="grid gap-1.5">
                <Label>{t("payment_info.label_stripe_id")}</Label>
                <Input {...register("stripe_account_id")} placeholder="acct_..." />
              </div>
            </>
          )}

          <div className="grid gap-1.5">
            <Label>{t("common.description")}</Label>
            <Input {...register("description")} placeholder={t("payment_info.ph_notes")} />
          </div>

          <div className="grid gap-1.5">
            <Label>{t("payment_info.label_status")}</Label>
            <Controller name="status" control={control} render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">{t("common.active")}</SelectItem>
                  <SelectItem value="Inactive">{t("common.inactive")}</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>
        </div>
      </div>
    </Layout>
  );
}

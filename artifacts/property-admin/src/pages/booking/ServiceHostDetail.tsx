import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useForm, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useGetServiceHost, useCreateServiceHost, useUpdateServiceHost,
  getListServiceHostsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { LookupSelect } from "@/components/LookupSelect";

const BASE = import.meta.env.BASE_URL;

interface FormData {
  name: string;
  account_id: number | null;
  contract_product_id: number | null;
  from_date: string;
  to_date: string;
  in_call: boolean;
  out_call: boolean;
  business_start_hour: number | null;
  business_end_hour: number | null;
  description: string;
  status: string;
}

export default function ServiceHostDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const { data: host } = useGetServiceHost({ id: Number(id) }, { query: { enabled: !isNew } });

  const { register, handleSubmit, reset, control, watch, setValue } = useForm<FormData>({
    defaultValues: {
      name: "", account_id: null, contract_product_id: null,
      from_date: "", to_date: "", in_call: false, out_call: false,
      business_start_hour: null, business_end_hour: null, description: "", status: "Active",
    },
  });

  useEffect(() => {
    if (host) reset({
      name: host.name ?? "",
      account_id: host.account_id ?? null,
      contract_product_id: host.contract_product_id ?? null,
      from_date: host.from_date ?? "",
      to_date: host.to_date ?? "",
      in_call: host.in_call ?? false,
      out_call: host.out_call ?? false,
      business_start_hour: host.business_start_hour ?? null,
      business_end_hour: host.business_end_hour ?? null,
      description: host.description ?? "",
      status: host.status ?? "Active",
    });
  }, [host, reset]);

  const createMutation = useCreateServiceHost({
    mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListServiceHostsQueryKey({}) }); setLocation("/booking/service-hosts"); } },
  });
  const updateMutation = useUpdateServiceHost({
    mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListServiceHostsQueryKey({}) }); setLocation("/booking/service-hosts"); } },
  });

  const onSubmit = (data: FormData) => {
    const payload = {
      ...data,
      business_start_hour: data.business_start_hour ? Number(data.business_start_hour) : null,
      business_end_hour: data.business_end_hour ? Number(data.business_end_hour) : null,
    };
    if (isNew) createMutation.mutate({ data: payload });
    else updateMutation.mutate({ id: Number(id), data: payload });
  };

  const inCallVal = watch("in_call");
  const outCallVal = watch("out_call");

  return (
    <Layout>
      <PageHeader
        title={isNew ? `${t("common.new")} ${t("nav.service_host")}` : (host?.name ?? t("nav.service_host"))}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setLocation("/booking/service-hosts")}><ArrowLeft className="w-4 h-4 mr-1" /> {t("common.back")}</Button>
            <Button onClick={handleSubmit(onSubmit)} className="bg-[#E8621A] hover:bg-[#d4561a] text-white"><Save className="w-4 h-4 mr-1" /> {t("common.save")}</Button>
          </div>
        }
      />
      <div className="p-6 max-w-3xl space-y-6">
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h3 className="text-xs font-semibold text-[#E8621A] uppercase tracking-wider border-b pb-2">{t("service_host.section_general")}</h3>
          <div>
            <Label>{t("common.name")} *</Label>
            <Input {...register("name")} className="mt-1" />
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h3 className="text-xs font-semibold text-[#E8621A] uppercase tracking-wider border-b pb-2">MAIN</h3>
          <div>
            <Label>{t("service_host.label_account")}</Label>
            <Controller
              name="account_id"
              control={control}
              render={({ field }) => (
                <LookupSelect
                  lookupUrl={`${BASE}api/v1/lookup/accounts`}
                  placeholder="Search accounts..."
                  value={field.value ?? null}
                  onChange={field.onChange}
                  displayText={(host as any)?.account_name}
                />
              )}
            />
          </div>
          <div>
            <Label>{t("service_host.label_service")}</Label>
            <Controller
              name="contract_product_id"
              control={control}
              render={({ field }) => (
                <LookupSelect
                  lookupUrl={`${BASE}api/v1/lookup/contract-products`}
                  placeholder="Search contract products..."
                  value={field.value ?? null}
                  onChange={field.onChange}
                  displayText={(host as any)?.contract_product_name}
                />
              )}
            />
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h3 className="text-xs font-semibold text-[#E8621A] uppercase tracking-wider border-b pb-2">{t("service_host.section_schedule")}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>{t("service_host.label_from_date")}</Label>
              <Controller name="from_date" control={control} render={({ field }) => (
                <DateInput value={field.value ?? ""} onChange={field.onChange} className="mt-1" />
              )} />
            </div>
            <div>
              <Label>{t("service_host.label_to_date")}</Label>
              <Controller name="to_date" control={control} render={({ field }) => (
                <DateInput value={field.value ?? ""} onChange={field.onChange} className="mt-1" />
              )} />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h3 className="text-xs font-semibold text-[#E8621A] uppercase tracking-wider border-b pb-2">OPTIONS</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <Label>{t("service_host.label_in_call")}</Label>
              <div className="flex gap-4 mt-2">
                {["Yes", "No"].map((opt) => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="in_call" value={opt} checked={inCallVal === (opt === "Yes")} onChange={() => setValue("in_call", opt === "Yes")} />
                    <span className="text-sm">{opt === "Yes" ? t("common.yes") : t("common.no")}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>{t("service_host.label_out_call")}</Label>
              <div className="flex gap-4 mt-2">
                {["Yes", "No"].map((opt) => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="out_call" value={opt} checked={outCallVal === (opt === "Yes")} onChange={() => setValue("out_call", opt === "Yes")} />
                    <span className="text-sm">{opt === "Yes" ? t("common.yes") : t("common.no")}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Business Start Hour (0-23)</Label>
              <Input type="number" min={0} max={23} {...register("business_start_hour", { valueAsNumber: true })} className="mt-1" />
            </div>
            <div>
              <Label>Business End Hour (0-23)</Label>
              <Input type="number" min={0} max={23} {...register("business_end_hour", { valueAsNumber: true })} className="mt-1" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h3 className="text-xs font-semibold text-[#E8621A] uppercase tracking-wider border-b pb-2">{t("service_host.label_notes")}</h3>
          <Textarea {...register("description")} rows={4} placeholder="Enter description..." />
        </div>

        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h3 className="text-xs font-semibold text-[#E8621A] uppercase tracking-wider border-b pb-2">ADMIN</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>{t("service_host.label_status")}</Label>
              <Controller name="status" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Active", "Inactive", "Deleted"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
            {!isNew && (
              <>
                <div><Label className="text-muted-foreground text-xs">{t("common.created_at")}</Label><p className="text-sm mt-1">{host?.created_at ? new Date(host.created_at).toLocaleString() : "—"}</p></div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

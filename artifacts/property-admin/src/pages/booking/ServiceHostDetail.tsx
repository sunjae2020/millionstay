import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { formatDateTime } from "@/lib/date";
import { useForm, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { ServiceHostAccounting, ServiceHostPhotos, ServiceHostCs } from "./ServiceHostTabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useGetServiceHost, useCreateServiceHost, useUpdateServiceHost,
  getListServiceHostsQueryKey, getGetServiceHostQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Upload, Trash2 } from "lucide-react";
import { LookupSelect } from "@/components/LookupSelect";
import { ProductLookupSelect } from "@/components/ProductLookupSelect";
import { AccountLookupSelect } from "@/components/AccountLookupSelect";
import { apiJson } from "@/lib/apiFetch";

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
  const isNew = !id || id === "new";
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const { data: host } = useGetServiceHost(Number(id), { query: { enabled: !isNew, queryKey: getGetServiceHostQueryKey(Number(id)) } });

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

  // Photos need a host id, which does not exist yet on the new-host screen. Files
  // picked before the first save are held here and uploaded right after create.
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const pendingRef = useRef<HTMLInputElement>(null);

  // Save errors used to be swallowed, so a rejected write looked like "nothing
  // happened". Surface them next to the Save button instead.
  const [saveError, setSaveError] = useState<string | null>(null);
  const finishSave = () => {
    setSaveError(null);
    qc.invalidateQueries({ queryKey: getListServiceHostsQueryKey({}) });
    setLocation("/booking/service-hosts");
  };
  const onSaveError = (e: any) => setSaveError(e?.message ?? t("common.save_failed", "저장에 실패했습니다."));

  const onCreated = async (created: any) => {
    const newId = created?.id;
    if (newId && pendingPhotos.length) {
      try {
        for (const file of pendingPhotos) {
          const fd = new FormData();
          fd.append("image", file);
          await apiJson(`/api/v1/service-hosts/${newId}/photos`, { method: "POST", body: fd });
        }
      } catch (e: any) {
        // The host itself saved — say so rather than implying the whole save failed.
        setSaveError(t("service_host.photo_upload_failed", "파트너는 저장됐지만 사진 업로드에 실패했습니다: ") + (e?.message ?? ""));
        setLocation(`/booking/service-hosts/${newId}`);
        return;
      }
    }
    finishSave();
  };

  const createMutation = useCreateServiceHost({ mutation: { onSuccess: onCreated, onError: onSaveError } });
  const updateMutation = useUpdateServiceHost({ mutation: { onSuccess: finishSave, onError: onSaveError } });

  const [tab, setTab] = useState("overview");
  const [specialties, setSpecialties] = useState<string[]>([]);
  useEffect(() => { if (host) setSpecialties(Array.isArray((host as any).specialties) ? (host as any).specialties : []); }, [host]);
  const toggleSpecialty = (s: string) => setSpecialties((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const onSubmit = (data: FormData) => {
    if (!data.name.trim()) { setSaveError(t("service_host.name_required", "이름을 입력하세요.")); return; }
    const payload: any = {
      ...data,
      name: data.name.trim(),
      // Empty date inputs must go over the wire as null — "" is not a date.
      from_date: data.from_date || null,
      to_date: data.to_date || null,
      business_start_hour: data.business_start_hour ? Number(data.business_start_hour) : null,
      business_end_hour: data.business_end_hour ? Number(data.business_end_hour) : null,
      specialties, // Phase 3 auto-dispatch — passed through to the backend.
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
            <Button onClick={handleSubmit(onSubmit)} className="bg-primary hover:bg-[#d4561a] text-white"><Save className="w-4 h-4 mr-1" /> {t("common.save")}</Button>
          </div>
        }
      />
      {saveError && (
        <div className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>
      )}
      {!isNew && (
        <div className="flex border-b gap-1 px-6">
          {[
            { id: "overview", label: t("service_host.tab_overview", "개요") },
            { id: "accounting", label: t("service_host.tab_accounting", "잡 & 정산") },
            { id: "photos", label: t("service_host.tab_photos", "사진") },
            { id: "cs", label: t("service_host.tab_cs", "CS 티켓") },
          ].map((tb) => (
            <button key={tb.id} type="button" onClick={() => setTab(tb.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === tb.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {tb.label}
            </button>
          ))}
        </div>
      )}
      {!isNew && tab === "accounting" && <div className="p-6 max-w-4xl"><ServiceHostAccounting hostId={String(id)} /></div>}
      {!isNew && tab === "photos" && <div className="p-6 max-w-4xl"><ServiceHostPhotos hostId={String(id)} /></div>}
      {!isNew && tab === "cs" && <div className="p-6 max-w-4xl"><ServiceHostCs hostId={String(id)} /></div>}
      {(isNew || tab === "overview") && (
      <div className="p-6 max-w-3xl space-y-6">
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider border-b pb-2">{t("service_host.section_general")}</h3>
          <div>
            <Label>{t("common.name")} *</Label>
            <Input {...register("name")} className="mt-1" />
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider border-b pb-2">{t("service_host.section_main")}</h3>
          <div>
            <Label>{t("service_host.label_account")}</Label>
            <Controller
              name="account_id"
              control={control}
              render={({ field }) => (
                <AccountLookupSelect
                  lookupUrl="/api/v1/lookup/accounts"
                  placeholder={t("service_host.search_account_placeholder")}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  displayValue={(host as any)?.account_name}
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
                <ProductLookupSelect
                  lookupUrl="/api/v1/lookup/products"
                  placeholder={t("service_host.search_service_placeholder")}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  displayValue={(host as any)?.contract_product_name}
                />
              )}
            />
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider border-b pb-2">{t("service_host.section_schedule")}</h3>
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
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider border-b pb-2">{t("service_host.section_options")}</h3>
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
              <Label>{t("service_host.label_business_start")}</Label>
              <Input type="number" min={0} max={23} {...register("business_start_hour", { valueAsNumber: true })} className="mt-1" />
            </div>
            <div>
              <Label>{t("service_host.label_business_end")}</Label>
              <Input type="number" min={0} max={23} {...register("business_end_hour", { valueAsNumber: true })} className="mt-1" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider border-b pb-2">{t("service_host.label_notes")}</h3>
          <Textarea {...register("description")} rows={4} placeholder={t("common.notes_placeholder")} />
        </div>

        {/* On a new host there is no id to upload against yet — stage the files and
            send them the moment the host is created. */}
        {isNew && (
          <div className="rounded-lg border bg-white p-6 space-y-3">
            <h3 className="text-xs font-semibold text-primary uppercase tracking-wider border-b pb-2">{t("service_host_photos.title", "사진")}</h3>
            <p className="text-xs text-muted-foreground">{t("service_host_photos.new_hint", "저장하면 선택한 사진이 함께 업로드됩니다.")}</p>
            <input
              ref={pendingRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => { if (e.target.files?.length) setPendingPhotos((prev) => [...prev, ...Array.from(e.target.files!)]); e.target.value = ""; }}
            />
            <Button type="button" size="sm" variant="outline" onClick={() => pendingRef.current?.click()}>
              <Upload className="w-3.5 h-3.5 mr-1" />{t("service_host_photos.upload", "사진 업로드")}
            </Button>
            {pendingPhotos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {pendingPhotos.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="relative group">
                    <img src={URL.createObjectURL(f)} alt={f.name} className="w-full aspect-square object-cover rounded-lg border" />
                    <button
                      type="button" title={t("common.delete", "삭제")}
                      onClick={() => setPendingPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1.5 right-1.5 rounded-full bg-white/90 border p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="rounded-lg border bg-white p-6 space-y-3">
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider border-b pb-2">{t("service_host.label_specialties", "Specialties (auto-dispatch)")}</h3>
          <p className="text-xs text-muted-foreground">{t("service_host.specialties_hint", "Trades this partner handles. Work orders with a matching category are auto-dispatched here.")}</p>
          <div className="flex flex-wrap gap-2">
            {["plumbing", "electrical", "cleaning", "general", "inspection", "linen", "hvac", "gardening", "pest"].map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => toggleSpecialty(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${specialties.includes(s) ? "bg-primary/10 text-primary border-primary/30" : "bg-transparent text-muted-foreground border-gray-200 hover:bg-gray-50"}`}
              >
                {t(`service_host.specialty_${s}`, s)}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider border-b pb-2">{t("service_host.section_admin")}</h3>
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
                <div><Label className="text-muted-foreground text-xs">{t("common.created_at")}</Label><p className="text-sm mt-1">{host?.created_at ? formatDateTime(host.created_at) : "—"}</p></div>
              </>
            )}
          </div>
        </div>
      </div>
      )}
    </Layout>
  );
}

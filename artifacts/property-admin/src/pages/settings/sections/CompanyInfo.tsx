import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Save, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { uploadBrandingImage } from "@/lib/theme";
import { useTranslation } from "react-i18next";
import { APP_NAME } from "@/lib/appName";

interface CompanyForm {
  company_name: string;
  trading_name: string;
  abn: string;
  phone: string;
  email: string;
  website: string;
  logo_url: string;
  stamp_url: string;
  address1: string;
  address2: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
  timezone: string;
  ceo: string;
  biz_no: string;
  /** 법인등록번호 — printed in the landlord block of a Korean lease agreement. */
  corp_no: string;
  /** 임대사무실 담당자 연락처 — quoted on the move-out settlement statement. */
  leasing_contact_phone: string;
  privacy_officer: string;
}

const DEFAULTS: CompanyForm = {
  company_name: `${APP_NAME} Pty Ltd`,
  trading_name: APP_NAME,
  abn: "",
  phone: "",
  email: "",
  website: "",
  logo_url: "",
  stamp_url: "",
  address1: "",
  address2: "",
  suburb: "",
  state: "VIC",
  postcode: "",
  country: "AU",
  timezone: "Australia/Melbourne",
  ceo: "",
  biz_no: "",
  corp_no: "",
  leasing_contact_phone: "",
  privacy_officer: "",
};

export function CompanyInfo() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  // Date format is stored on the global branding row (Settings → Design shares it),
  // NOT in the company_info blob — it governs every screen + document app-wide.
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [uploadingStamp, setUploadingStamp] = useState(false);
  const { register, handleSubmit, control, reset, setValue, watch } = useForm<CompanyForm>({ defaultValues: DEFAULTS });
  const stampUrl = watch("stamp_url");

  async function onStampFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setUploadingStamp(true);
    try {
      const url = await uploadBrandingImage(file);
      setValue("stamp_url", url, { shouldDirty: true });
    } catch {
      toast({ title: t("settings_company.save_failed_title"), description: t("settings_company.stamp_upload_failed"), variant: "destructive" });
    } finally {
      setUploadingStamp(false);
    }
  }

  // Load persisted company info (used as the issuer block on all documents).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiFetch("/api/v1/company-info");
        if (!res.ok) return;
        const data = await res.json();
        if (active && data && typeof data === "object") {
          reset({ ...DEFAULTS, ...data });
        }
      } catch { /* keep defaults */ }
    })();
    return () => { active = false; };
  }, [reset]);

  // Load the app-wide date format from the shared branding row.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiFetch("/api/v1/branding");
        if (!res.ok) return;
        const body = await res.json();
        const fmt = body?.data?.date_format;
        if (active && typeof fmt === "string" && fmt) setDateFormat(fmt);
      } catch { /* keep default */ }
    })();
    return () => { active = false; };
  }, []);

  async function onSubmit(data: CompanyForm) {
    setSaving(true);
    try {
      const res = await apiFetch("/api/v1/company-info", {
        method: "PUT",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) { const b = await res.json().catch(() => null); throw new Error(b?.error ?? `HTTP ${res.status}`); }
      // Persist the date format on the shared branding row (best-effort).
      const bres = await apiFetch("/api/v1/branding", {
        method: "PUT",
        body: JSON.stringify({ date_format: dateFormat }),
        headers: { "Content-Type": "application/json" },
      });
      if (!bres.ok) { const b = await bres.json().catch(() => null); throw new Error(b?.error ?? `HTTP ${bres.status}`); }
      toast({ title: t("settings_company.save_success_title"), description: t("settings_company.save_success_desc") });
    } catch (err) {
      toast({ title: t("settings_company.save_failed_title"), description: err instanceof Error ? err.message : t("settings_company.error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">{t("settings_company.basic_info_title")}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{t("settings_company.basic_info_subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>{t("settings_company.company_name_legal_label")}</Label>
          <Input {...register("company_name")} placeholder={`${APP_NAME} Pty Ltd`} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings_company.trading_name_label")}</Label>
          <Input {...register("trading_name")} placeholder={APP_NAME} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings_company.abn_label")}</Label>
          <Input {...register("abn")} placeholder="XX XXX XXX XXX" />
        </div>
        <div className="space-y-1.5">
          <Label>{t("common.phone")}</Label>
          <Input {...register("phone")} placeholder="+61 3 XXXX XXXX" />
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings_company.leasing_contact_phone_label")}</Label>
          <Input {...register("leasing_contact_phone")} placeholder="010-0000-0000" />
          <p className="text-xs text-muted-foreground">{t("settings_company.leasing_contact_phone_helper")}</p>
        </div>
        <div className="space-y-1.5">
          <Label>{t("common.email")}</Label>
          <Input {...register("email")} type="email" placeholder="admin@millionstay.com" />
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings_company.website_label")}</Label>
          <Input {...register("website")} placeholder="https://millionstay.com.au" />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label>{t("settings_company.logo_url_label")}</Label>
          <Input {...register("logo_url")} placeholder="https://www.millionstay.com/millionstay-logo.png" />
          <p className="text-xs text-muted-foreground">{t("settings_company.logo_url_helper")}</p>
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label>{t("settings_company.stamp_label")}</Label>
          <div className="flex items-center gap-3">
            {stampUrl ? (
              <div className="relative">
                <img src={stampUrl} alt="" className="h-16 w-16 rounded-md border object-contain bg-white p-1" />
                <button
                  type="button"
                  onClick={() => setValue("stamp_url", "", { shouldDirty: true })}
                  className="absolute -right-2 -top-2 rounded-full border bg-white p-0.5 text-muted-foreground hover:text-red-600"
                  aria-label={t("common.remove")}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed text-[10px] text-muted-foreground">
                {t("settings_company.stamp_none")}
              </div>
            )}
            <div className="space-y-1.5">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted/50">
                <Upload className="h-3.5 w-3.5" />
                {uploadingStamp ? t("common.uploading") : t("settings_company.stamp_upload")}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onStampFile} disabled={uploadingStamp} />
              </label>
              <p className="text-xs text-muted-foreground">{t("settings_company.stamp_helper")}</p>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">{t("settings_company.operator_title")}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{t("settings_company.operator_subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>{t("settings_company.ceo_label")}</Label>
          <Input {...register("ceo")} placeholder={t("settings_company.ceo_placeholder")} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings_company.biz_no_label")}</Label>
          <Input {...register("biz_no")} placeholder="000-00-00000" />
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings_company.corp_no_label")}</Label>
          <Input {...register("corp_no")} placeholder="000000-0000000" />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label>{t("settings_company.privacy_officer_label")}</Label>
          <Input {...register("privacy_officer")} placeholder={t("settings_company.privacy_officer_placeholder")} />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">{t("settings_company.address_title")}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{t("settings_company.address_subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label>{t("settings_company.address_line1_label")}</Label>
          <Input {...register("address1")} placeholder={t("settings_company.address_line1_placeholder")} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>{t("settings_company.address_line2_label")}</Label>
          <Input {...register("address2")} placeholder={t("settings_company.address_line2_placeholder")} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings_company.suburb_label")}</Label>
          <Input {...register("suburb")} placeholder="Melbourne" />
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings_company.state_label")}</Label>
          <Input {...register("state")} placeholder={t("settings_company.state_placeholder")} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings_company.postcode_label")}</Label>
          <Input {...register("postcode")} placeholder="3000" />
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings_company.country_label")}</Label>
          <Input {...register("country")} placeholder={t("settings_company.country_placeholder")} />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">{t("settings_company.regional_title")}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{t("settings_company.regional_subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>{t("settings_company.timezone_label")}</Label>
          <Controller
            name="timezone"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Seoul">Asia/Seoul (KST)</SelectItem>
                  <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                  <SelectItem value="Asia/Shanghai">Asia/Shanghai (CST)</SelectItem>
                  <SelectItem value="Asia/Hong_Kong">Asia/Hong_Kong (HKT)</SelectItem>
                  <SelectItem value="Asia/Singapore">Asia/Singapore (SGT)</SelectItem>
                  <SelectItem value="Asia/Bangkok">Asia/Bangkok (ICT)</SelectItem>
                  <SelectItem value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (ICT)</SelectItem>
                  <SelectItem value="Australia/Sydney">Australia/Sydney (AEST)</SelectItem>
                  <SelectItem value="Australia/Melbourne">Australia/Melbourne (AEST)</SelectItem>
                  <SelectItem value="Australia/Brisbane">Australia/Brisbane (AEST)</SelectItem>
                  <SelectItem value="Australia/Perth">Australia/Perth (AWST)</SelectItem>
                  <SelectItem value="Australia/Adelaide">Australia/Adelaide (ACST)</SelectItem>
                  <SelectItem value="Australia/Darwin">Australia/Darwin (ACST)</SelectItem>
                  <SelectItem value="Australia/Hobart">Australia/Hobart (AEST)</SelectItem>
                  <SelectItem value="Pacific/Auckland">Pacific/Auckland (NZST)</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings_company.date_format_label")}</Label>
          <Select value={dateFormat} onValueChange={setDateFormat}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
              <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
              <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              <SelectItem value="YYYY/MM/DD">YYYY/MM/DD</SelectItem>
              <SelectItem value="D MMM YYYY">D MMM YYYY</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("settings_company.date_format_helper")}</p>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}

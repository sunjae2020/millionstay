import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
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
  address1: string;
  address2: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
  timezone: string;
}

const DEFAULTS: CompanyForm = {
  company_name: `${APP_NAME} Pty Ltd`,
  trading_name: APP_NAME,
  abn: "",
  phone: "",
  email: "",
  website: "",
  logo_url: "",
  address1: "",
  address2: "",
  suburb: "",
  state: "VIC",
  postcode: "",
  country: "AU",
  timezone: "Australia/Melbourne",
};

export function CompanyInfo() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, control, reset } = useForm<CompanyForm>({ defaultValues: DEFAULTS });

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

  async function onSubmit(data: CompanyForm) {
    setSaving(true);
    try {
      const res = await apiFetch("/api/v1/company-info", {
        method: "PUT",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) { const b = await res.json().catch(() => null); throw new Error(b?.error ?? `HTTP ${res.status}`); }
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
          <Controller
            name="state"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings_company.postcode_label")}</Label>
          <Input {...register("postcode")} placeholder="3000" />
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings_company.country_label")}</Label>
          <Controller
            name="country"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AU">{t("settings_company.country_au")}</SelectItem>
                  <SelectItem value="NZ">{t("settings_company.country_nz")}</SelectItem>
                  <SelectItem value="US">{t("settings_company.country_us")}</SelectItem>
                  <SelectItem value="GB">{t("settings_company.country_gb")}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
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

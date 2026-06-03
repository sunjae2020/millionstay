import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Save, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SecurityForm {
  session_timeout: string;
  min_password_length: string;
  require_uppercase: boolean;
  require_number: boolean;
  require_special: boolean;
  login_attempt_limit: string;
  lockout_duration: string;
}

export function Security() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [twoFa, setTwoFa] = useState(false);

  const { register, handleSubmit, control } = useForm<SecurityForm>({
    defaultValues: {
      session_timeout: "480",
      min_password_length: "8",
      require_uppercase: true,
      require_number: true,
      require_special: false,
      login_attempt_limit: "5",
      lockout_duration: "30",
    },
  });

  function onSubmit(_data: SecurityForm) {
    toast({ title: t("settings_security.toast_saved_title"), description: t("settings_security.toast_saved_desc") });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">{t("settings_security.session_title")}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{t("settings_security.session_desc")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>{t("settings_security.session_timeout_label")}</Label>
          <Controller
            name="session_timeout"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">{t("settings_security.timeout_1_hour")}</SelectItem>
                  <SelectItem value="240">{t("settings_security.timeout_4_hours")}</SelectItem>
                  <SelectItem value="480">{t("settings_security.timeout_8_hours_default")}</SelectItem>
                  <SelectItem value="1440">{t("settings_security.timeout_24_hours")}</SelectItem>
                  <SelectItem value="10080">{t("settings_security.timeout_7_days")}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">{t("settings_security.password_policy_title")}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{t("settings_security.password_policy_desc")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>{t("settings_security.minimum_length_label")}</Label>
          <Input {...register("min_password_length")} type="number" min={6} max={32} placeholder="8" />
        </div>
      </div>

      <div className="space-y-3">
        {[
          { name: "require_uppercase" as const, label: t("settings_security.require_uppercase_label") },
          { name: "require_number" as const, label: t("settings_security.require_number_label") },
          { name: "require_special" as const, label: t("settings_security.require_special_label") },
        ].map(({ name, label }) => (
          <div key={name} className="flex items-center justify-between">
            <Label className="font-normal cursor-pointer">{label}</Label>
            <Controller
              name={name}
              control={control}
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>
        ))}
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">{t("settings_security.login_security_title")}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{t("settings_security.login_security_desc")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>{t("settings_security.max_login_attempts_label")}</Label>
          <Input {...register("login_attempt_limit")} type="number" min={3} max={10} placeholder="5" />
          <p className="text-xs text-muted-foreground">{t("settings_security.max_login_attempts_helper")}</p>
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings_security.lockout_duration_label")}</Label>
          <Input {...register("lockout_duration")} type="number" min={5} placeholder="30" />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">{t("settings_security.two_factor_title")}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{t("settings_security.two_factor_desc")}</p>
      </div>

      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
        <div>
          <p className="text-sm font-medium">{t("settings_security.enforce_2fa_label")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("settings_security.enforce_2fa_helper")}</p>
        </div>
        <Switch checked={twoFa} onCheckedChange={setTwoFa} />
      </div>

      {twoFa && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800">
            {t("settings_security.two_factor_warning")}
          </p>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button type="submit">
          <Save className="h-4 w-4 mr-2" />
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}

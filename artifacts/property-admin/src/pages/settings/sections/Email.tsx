import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Save, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation, Trans } from "react-i18next";

interface EmailForm {
  provider: string;
  resend_api_key: string;
  from_email: string;
  from_name: string;
  reply_to: string;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_password: string;
  smtp_secure: string;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${ok ? "text-emerald-600" : "text-muted-foreground"}`}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

export function Email() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const resendConfigured = !!import.meta.env.VITE_RESEND_CONFIGURED;

  const { register, handleSubmit, control, watch } = useForm<EmailForm>({
    defaultValues: {
      provider: "resend",
      resend_api_key: "",
      from_email: "noreply@millionstay.com.au",
      from_name: "MillionStay",
      reply_to: "",
      smtp_host: "",
      smtp_port: "587",
      smtp_user: "",
      smtp_password: "",
      smtp_secure: "tls",
    },
  });

  const provider = watch("provider");

  function onSubmit(_data: EmailForm) {
    toast({ title: t("settings_email.toast_saved_title"), description: t("settings_email.toast_saved_desc") });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">{t("settings_email.current_status_title")}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{t("settings_email.current_status_desc")}</p>
      </div>

      <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center gap-6">
        <StatusBadge ok={resendConfigured} label={resendConfigured ? t("settings_email.resend_connected") : t("settings_email.resend_not_configured")} />
        <StatusBadge ok={false} label={t("settings_email.smtp_not_configured")} />
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">{t("settings_email.sending_config_title")}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{t("settings_email.sending_config_desc")}</p>
      </div>

      <div className="space-y-1.5">
        <Label>{t("settings_email.email_provider_label")}</Label>
        <Controller
          name="provider"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="resend">{t("settings_email.provider_resend")}</SelectItem>
                <SelectItem value="smtp">{t("settings_email.provider_smtp")}</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {provider === "resend" ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              {t("settings_email.resend_api_key_label")}
              <Badge variant="outline" className="text-xs">{t("settings_email.set_via_secrets")}</Badge>
            </Label>
            <Input
              {...register("resend_api_key")}
              type="password"
              placeholder="re_••••••••••••••••••••••"
              disabled
            />
            <p className="text-xs text-muted-foreground">
              <Trans i18nKey="settings_email.resend_api_key_helper" components={{ code: <code className="bg-muted px-1 rounded" /> }} />
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>{t("settings_email.smtp_host_label")}</Label>
            <Input {...register("smtp_host")} placeholder="smtp.example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings_email.port_label")}</Label>
            <Input {...register("smtp_port")} placeholder="587" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings_email.security_label")}</Label>
            <Controller
              name="smtp_secure"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tls">{t("settings_email.security_starttls")}</SelectItem>
                    <SelectItem value="ssl">{t("settings_email.security_ssl")}</SelectItem>
                    <SelectItem value="none">{t("settings_email.security_none")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings_email.smtp_username_label")}</Label>
            <Input {...register("smtp_user")} placeholder="user@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings_email.smtp_password_label")}</Label>
            <Input {...register("smtp_password")} type="password" placeholder="••••••••" />
          </div>
        </div>
      )}

      <Separator />

      <div>
        <h3 className="text-base font-semibold">{t("settings_email.sender_details_title")}</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>{t("settings_email.from_name_label")}</Label>
          <Input {...register("from_name")} placeholder="MillionStay" />
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings_email.from_email_label")}</Label>
          <Input {...register("from_email")} type="email" placeholder="noreply@millionstay.com.au" />
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings_email.reply_to_label")}</Label>
          <Input {...register("reply_to")} type="email" placeholder="support@millionstay.com.au" />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit">
          <Save className="h-4 w-4 mr-2" />
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}

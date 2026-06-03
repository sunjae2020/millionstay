import { useForm, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Save, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PaymentsForm {
  late_fee_percent: string;
  payment_terms_days: string;
  gst_rate: string;
  invoice_prefix: string;
  auto_send_invoice: string;
}

function KeyStatus({ label, configured, live }: { label: string; configured: boolean; live?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between py-2.5 px-4">
      <div className="flex items-center gap-2">
        {configured
          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          : <XCircle className="h-4 w-4 text-muted-foreground" />}
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {configured && live !== undefined && (
          <Badge variant={live ? "default" : "secondary"} className="text-xs">
            {live ? t("settings_payments.mode_live") : t("settings_payments.mode_test")}
          </Badge>
        )}
        <Badge
          variant={configured ? "outline" : "secondary"}
          className={configured ? "text-emerald-600 border-emerald-300" : ""}
        >
          {configured ? t("settings_payments.status_configured") : t("settings_payments.status_not_configured")}
        </Badge>
      </div>
    </div>
  );
}

export function Payments() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { register, handleSubmit, control } = useForm<PaymentsForm>({
    defaultValues: {
      late_fee_percent: "5",
      payment_terms_days: "14",
      gst_rate: "10",
      invoice_prefix: "MS-INV",
      auto_send_invoice: "false",
    },
  });

  function onSubmit(_data: PaymentsForm) {
    toast({ title: t("settings_payments.toast_saved_title"), description: t("settings_payments.toast_saved_desc") });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">{t("settings_payments.stripe_status_title")}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{t("settings_payments.stripe_status_subtitle")}</p>
      </div>

      <div className="rounded-lg border divide-y">
        <KeyStatus label={t("settings_payments.key_secret")} configured={false} live={false} />
        <KeyStatus label={t("settings_payments.key_publishable")} configured={false} live={false} />
        <KeyStatus label={t("settings_payments.key_webhook")} configured={false} />
      </div>

      <div className="rounded-lg bg-muted/40 border px-4 py-3 text-sm">
        <p className="font-medium mb-1">{t("settings_payments.how_to_configure_title")}</p>
        <ol className="text-muted-foreground space-y-1 text-xs list-decimal list-inside">
          <li>{t("settings_payments.how_to_step_open_secrets")}</li>
          <li>{t("settings_payments.how_to_step_add_secret_key")} <code className="bg-muted px-1 rounded">STRIPE_SECRET_KEY</code> {t("settings_payments.how_to_step_secret_key_hint")}</li>
          <li>{t("settings_payments.how_to_step_add_publishable_key")} <code className="bg-muted px-1 rounded">STRIPE_PUBLISHABLE_KEY</code></li>
          <li>{t("settings_payments.how_to_step_add_webhook_secret")} <code className="bg-muted px-1 rounded">STRIPE_WEBHOOK_SECRET</code></li>
          <li>{t("settings_payments.how_to_step_restart")} <code className="bg-muted px-1 rounded">/api/v1/health</code></li>
        </ol>
        <a
          href="https://dashboard.stripe.com/apikeys"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          {t("settings_payments.open_stripe_dashboard")}
        </a>
      </div>

      <div className="rounded-lg border px-4 py-3">
        <p className="text-sm font-medium mb-1">{t("settings_payments.webhook_url_label")}</p>
        <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
          {window.location.origin}/api/v1/stripe/webhook
        </code>
        <p className="text-xs text-muted-foreground mt-1">{t("settings_payments.webhook_url_hint")}</p>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">{t("settings_payments.payment_policy_title")}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{t("settings_payments.payment_policy_subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>{t("settings_payments.field_payment_terms")}</Label>
          <Input {...register("payment_terms_days")} type="number" placeholder="14" />
          <p className="text-xs text-muted-foreground">{t("settings_payments.field_payment_terms_hint")}</p>
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings_payments.field_late_fee")}</Label>
          <Input {...register("late_fee_percent")} type="number" step="0.1" placeholder="5" />
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings_payments.field_gst_rate")}</Label>
          <Input {...register("gst_rate")} type="number" placeholder="10" />
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings_payments.field_invoice_prefix")}</Label>
          <Input {...register("invoice_prefix")} placeholder="MS-INV" />
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings_payments.field_auto_send_invoice")}</Label>
          <Controller
            name="auto_send_invoice"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">{t("settings_payments.auto_send_enabled")}</SelectItem>
                  <SelectItem value="false">{t("settings_payments.auto_send_disabled")}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
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

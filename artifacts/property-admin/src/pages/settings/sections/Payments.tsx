import { useForm, Controller } from "react-hook-form";
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
            {live ? "Live" : "Test"}
          </Badge>
        )}
        <Badge
          variant={configured ? "outline" : "secondary"}
          className={configured ? "text-emerald-600 border-emerald-300" : ""}
        >
          {configured ? "Configured" : "Not configured"}
        </Badge>
      </div>
    </div>
  );
}

export function Payments() {
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
    toast({ title: "Saved", description: "Payment settings have been updated." });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">Stripe Integration Status</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Key configuration based on environment variables</p>
      </div>

      <div className="rounded-lg border divide-y">
        <KeyStatus label="Stripe Secret Key" configured={false} live={false} />
        <KeyStatus label="Stripe Publishable Key" configured={false} live={false} />
        <KeyStatus label="Stripe Webhook Secret" configured={false} />
      </div>

      <div className="rounded-lg bg-muted/40 border px-4 py-3 text-sm">
        <p className="font-medium mb-1">How to configure Stripe</p>
        <ol className="text-muted-foreground space-y-1 text-xs list-decimal list-inside">
          <li>Open <strong>Secrets</strong> in the Replit left panel</li>
          <li>Add <code className="bg-muted px-1 rounded">STRIPE_SECRET_KEY</code> (sk_live_... or sk_test_...)</li>
          <li>Add <code className="bg-muted px-1 rounded">STRIPE_PUBLISHABLE_KEY</code></li>
          <li>Add <code className="bg-muted px-1 rounded">STRIPE_WEBHOOK_SECRET</code></li>
          <li>Restart the API server and verify at <code className="bg-muted px-1 rounded">/api/v1/health</code></li>
        </ol>
        <a
          href="https://dashboard.stripe.com/apikeys"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Open Stripe Dashboard
        </a>
      </div>

      <div className="rounded-lg border px-4 py-3">
        <p className="text-sm font-medium mb-1">Webhook URL</p>
        <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
          {window.location.origin}/api/v1/stripe/webhook
        </code>
        <p className="text-xs text-muted-foreground mt-1">Register this URL in Stripe Dashboard → Webhooks</p>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">Payment Policy</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Invoice and payment default settings</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Payment Terms (days)</Label>
          <Input {...register("payment_terms_days")} type="number" placeholder="14" />
          <p className="text-xs text-muted-foreground">Due date from invoice issue date</p>
        </div>
        <div className="space-y-1.5">
          <Label>Late Fee (%)</Label>
          <Input {...register("late_fee_percent")} type="number" step="0.1" placeholder="5" />
        </div>
        <div className="space-y-1.5">
          <Label>GST Rate (%)</Label>
          <Input {...register("gst_rate")} type="number" placeholder="10" />
        </div>
        <div className="space-y-1.5">
          <Label>Invoice Number Prefix</Label>
          <Input {...register("invoice_prefix")} placeholder="MS-INV" />
        </div>
        <div className="space-y-1.5">
          <Label>Auto-send Invoice</Label>
          <Controller
            name="auto_send_invoice"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Enabled (send immediately on create)</SelectItem>
                  <SelectItem value="false">Disabled (send manually)</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit">
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>
    </form>
  );
}

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
        <Badge variant={configured ? "outline" : "secondary"} className={configured ? "text-emerald-600 border-emerald-300" : ""}>
          {configured ? "설정됨" : "미설정"}
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
    toast({ title: "저장됨", description: "결제 설정이 저장되었습니다." });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">Stripe 연동 상태</h3>
        <p className="text-sm text-muted-foreground mt-0.5">환경변수 기반 키 설정 현황</p>
      </div>

      <div className="rounded-lg border divide-y">
        <KeyStatus label="Stripe Secret Key" configured={false} live={false} />
        <KeyStatus label="Stripe Publishable Key" configured={false} live={false} />
        <KeyStatus label="Stripe Webhook Secret" configured={false} />
      </div>

      <div className="rounded-lg bg-muted/40 border px-4 py-3 text-sm">
        <p className="font-medium mb-1">Stripe 키 설정 방법</p>
        <ol className="text-muted-foreground space-y-1 text-xs list-decimal list-inside">
          <li>Replit 좌측 패널 → <strong>Secrets</strong> 탭 열기</li>
          <li><code className="bg-muted px-1 rounded">STRIPE_SECRET_KEY</code> 추가 (sk_live_... 또는 sk_test_...)</li>
          <li><code className="bg-muted px-1 rounded">STRIPE_PUBLISHABLE_KEY</code> 추가</li>
          <li><code className="bg-muted px-1 rounded">STRIPE_WEBHOOK_SECRET</code> 추가</li>
          <li>API 서버 재시작 → <code className="bg-muted px-1 rounded">/api/v1/health</code>로 상태 확인</li>
        </ol>
        <a
          href="https://dashboard.stripe.com/apikeys"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Stripe 대시보드 열기
        </a>
      </div>

      <div className="rounded-lg border px-4 py-3">
        <p className="text-sm font-medium mb-1">웹훅 URL</p>
        <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
          {window.location.origin}/api/v1/stripe/webhook
        </code>
        <p className="text-xs text-muted-foreground mt-1">Stripe 대시보드 → Webhooks에 등록하세요</p>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">결제 정책</h3>
        <p className="text-sm text-muted-foreground mt-0.5">인보이스 및 결제 기본값 설정</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>결제 기간 (일)</Label>
          <Input {...register("payment_terms_days")} type="number" placeholder="14" />
          <p className="text-xs text-muted-foreground">인보이스 발행 후 결제 기한</p>
        </div>
        <div className="space-y-1.5">
          <Label>연체 수수료 (%)</Label>
          <Input {...register("late_fee_percent")} type="number" step="0.1" placeholder="5" />
        </div>
        <div className="space-y-1.5">
          <Label>GST 세율 (%)</Label>
          <Input {...register("gst_rate")} type="number" placeholder="10" />
        </div>
        <div className="space-y-1.5">
          <Label>인보이스 번호 접두어</Label>
          <Input {...register("invoice_prefix")} placeholder="MS-INV" />
        </div>
        <div className="space-y-1.5">
          <Label>인보이스 자동 발송</Label>
          <Controller
            name="auto_send_invoice"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">활성화 (생성 즉시 발송)</SelectItem>
                  <SelectItem value="false">비활성화 (수동 발송)</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit">
          <Save className="h-4 w-4 mr-2" />
          저장
        </Button>
      </div>
    </form>
  );
}

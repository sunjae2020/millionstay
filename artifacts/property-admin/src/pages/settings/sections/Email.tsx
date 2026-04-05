import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Save, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
      {ok
        ? <CheckCircle2 className="h-3.5 w-3.5" />
        : <XCircle className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

export function Email() {
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
    toast({ title: "저장됨", description: "이메일 설정이 저장되었습니다." });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">현재 상태</h3>
        <p className="text-sm text-muted-foreground mt-0.5">환경변수 기반 설정 상태</p>
      </div>

      <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center gap-6">
        <StatusBadge ok={resendConfigured} label={resendConfigured ? "Resend 연결됨" : "Resend 미설정"} />
        <StatusBadge ok={false} label="SMTP 미설정" />
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">발송 설정</h3>
        <p className="text-sm text-muted-foreground mt-0.5">이메일 발송 서비스 및 발신자 정보</p>
      </div>

      <div className="space-y-1.5">
        <Label>이메일 공급자</Label>
        <Controller
          name="provider"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="resend">Resend (권장)</SelectItem>
                <SelectItem value="smtp">SMTP</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {provider === "resend" ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              Resend API Key
              <Badge variant="outline" className="text-xs">Secrets에서 설정</Badge>
            </Label>
            <Input
              {...register("resend_api_key")}
              type="password"
              placeholder="re_••••••••••••••••••••••"
              disabled
            />
            <p className="text-xs text-muted-foreground">
              실제 API 키는 Replit Secrets에서 <code className="bg-muted px-1 rounded">RESEND_API_KEY</code>로 설정하세요.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>SMTP Host</Label>
            <Input {...register("smtp_host")} placeholder="smtp.example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Port</Label>
            <Input {...register("smtp_port")} placeholder="587" />
          </div>
          <div className="space-y-1.5">
            <Label>보안</Label>
            <Controller
              name="smtp_secure"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tls">STARTTLS (587)</SelectItem>
                    <SelectItem value="ssl">SSL/TLS (465)</SelectItem>
                    <SelectItem value="none">없음 (25)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label>SMTP 사용자명</Label>
            <Input {...register("smtp_user")} placeholder="user@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>SMTP 비밀번호</Label>
            <Input {...register("smtp_password")} type="password" placeholder="••••••••" />
          </div>
        </div>
      )}

      <Separator />

      <div>
        <h3 className="text-base font-semibold">발신자 정보</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>발신자 이름</Label>
          <Input {...register("from_name")} placeholder="MillionStay" />
        </div>
        <div className="space-y-1.5">
          <Label>발신 이메일</Label>
          <Input {...register("from_email")} type="email" placeholder="noreply@millionstay.com.au" />
        </div>
        <div className="space-y-1.5">
          <Label>Reply-To (선택)</Label>
          <Input {...register("reply_to")} type="email" placeholder="support@millionstay.com.au" />
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

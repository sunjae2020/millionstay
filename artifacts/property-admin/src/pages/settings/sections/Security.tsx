import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Save, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

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
    toast({ title: "저장됨", description: "보안 설정이 저장되었습니다." });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">세션</h3>
        <p className="text-sm text-muted-foreground mt-0.5">로그인 세션 유지 시간</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>세션 만료 시간</Label>
          <Controller
            name="session_timeout"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">1시간</SelectItem>
                  <SelectItem value="240">4시간</SelectItem>
                  <SelectItem value="480">8시간 (기본)</SelectItem>
                  <SelectItem value="1440">24시간</SelectItem>
                  <SelectItem value="10080">7일</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">비밀번호 정책</h3>
        <p className="text-sm text-muted-foreground mt-0.5">관리자 계정 비밀번호 요구사항</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>최소 길이</Label>
          <Input {...register("min_password_length")} type="number" min={6} max={32} placeholder="8" />
        </div>
      </div>

      <div className="space-y-3">
        {[
          { name: "require_uppercase" as const, label: "대문자 포함 필수 (A-Z)" },
          { name: "require_number" as const, label: "숫자 포함 필수 (0-9)" },
          { name: "require_special" as const, label: "특수문자 포함 필수 (!@#$...)" },
        ].map(({ name, label }) => (
          <div key={name} className="flex items-center justify-between">
            <Label className="font-normal cursor-pointer">{label}</Label>
            <Controller
              name={name}
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
        ))}
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">로그인 보안</h3>
        <p className="text-sm text-muted-foreground mt-0.5">브루트포스 공격 방어 설정</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>로그인 실패 허용 횟수</Label>
          <Input {...register("login_attempt_limit")} type="number" min={3} max={10} placeholder="5" />
          <p className="text-xs text-muted-foreground">초과 시 계정 잠금</p>
        </div>
        <div className="space-y-1.5">
          <Label>잠금 해제 시간 (분)</Label>
          <Input {...register("lockout_duration")} type="number" min={5} placeholder="30" />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">2단계 인증 (2FA)</h3>
        <p className="text-sm text-muted-foreground mt-0.5">관리자 계정 2FA 강제 적용</p>
      </div>

      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
        <div>
          <p className="text-sm font-medium">2FA 강제 적용</p>
          <p className="text-xs text-muted-foreground mt-0.5">모든 관리자 계정에 TOTP 인증 필수</p>
        </div>
        <Switch checked={twoFa} onCheckedChange={setTwoFa} />
      </div>

      {twoFa && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800">
            2FA를 활성화하면 다음 로그인 시 모든 관리자가 인증 앱을 설정해야 합니다.
            Google Authenticator 또는 Authy를 사용하세요.
          </p>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button type="submit">
          <Save className="h-4 w-4 mr-2" />
          저장
        </Button>
      </div>
    </form>
  );
}

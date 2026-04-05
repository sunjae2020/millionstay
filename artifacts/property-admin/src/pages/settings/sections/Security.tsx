import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
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
    toast({ title: "Saved", description: "Security settings have been updated." });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">Session</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Login session duration</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Session Timeout</Label>
          <Controller
            name="session_timeout"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="240">4 hours</SelectItem>
                  <SelectItem value="480">8 hours (default)</SelectItem>
                  <SelectItem value="1440">24 hours</SelectItem>
                  <SelectItem value="10080">7 days</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">Password Policy</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Requirements for admin account passwords</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Minimum Length</Label>
          <Input {...register("min_password_length")} type="number" min={6} max={32} placeholder="8" />
        </div>
      </div>

      <div className="space-y-3">
        {[
          { name: "require_uppercase" as const, label: "Require uppercase letter (A–Z)" },
          { name: "require_number" as const, label: "Require number (0–9)" },
          { name: "require_special" as const, label: "Require special character (!@#$...)" },
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
        <h3 className="text-base font-semibold">Login Security</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Brute-force protection settings</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Max Login Attempts</Label>
          <Input {...register("login_attempt_limit")} type="number" min={3} max={10} placeholder="5" />
          <p className="text-xs text-muted-foreground">Account will be locked after this many failures</p>
        </div>
        <div className="space-y-1.5">
          <Label>Lockout Duration (minutes)</Label>
          <Input {...register("lockout_duration")} type="number" min={5} placeholder="30" />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">Two-Factor Authentication (2FA)</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Enforce 2FA for all admin accounts</p>
      </div>

      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
        <div>
          <p className="text-sm font-medium">Enforce 2FA</p>
          <p className="text-xs text-muted-foreground mt-0.5">Require TOTP authentication for all admin logins</p>
        </div>
        <Switch checked={twoFa} onCheckedChange={setTwoFa} />
      </div>

      {twoFa && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800">
            Enabling 2FA will require all admins to set up an authenticator app on next login.
            Google Authenticator or Authy are recommended.
          </p>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button type="submit">
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>
    </form>
  );
}

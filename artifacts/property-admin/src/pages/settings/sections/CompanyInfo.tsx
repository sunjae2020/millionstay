import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Controller } from "react-hook-form";

interface CompanyForm {
  company_name: string;
  trading_name: string;
  abn: string;
  phone: string;
  email: string;
  website: string;
  address1: string;
  address2: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
  timezone: string;
}

export function CompanyInfo() {
  const { toast } = useToast();
  const { register, handleSubmit, control } = useForm<CompanyForm>({
    defaultValues: {
      company_name: "MillionStay Pty Ltd",
      trading_name: "MillionStay",
      abn: "",
      phone: "",
      email: "",
      website: "",
      address1: "",
      address2: "",
      suburb: "",
      state: "VIC",
      postcode: "",
      country: "AU",
      timezone: "Australia/Melbourne",
    },
  });

  function onSubmit(_data: CompanyForm) {
    toast({ title: "저장됨", description: "회사 정보가 저장되었습니다." });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">기본 정보</h3>
        <p className="text-sm text-muted-foreground mt-0.5">회사 법인명 및 사업자 정보</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>회사명 (법인)</Label>
          <Input {...register("company_name")} placeholder="MillionStay Pty Ltd" />
        </div>
        <div className="space-y-1.5">
          <Label>상호명 (거래용)</Label>
          <Input {...register("trading_name")} placeholder="MillionStay" />
        </div>
        <div className="space-y-1.5">
          <Label>ABN</Label>
          <Input {...register("abn")} placeholder="XX XXX XXX XXX" />
        </div>
        <div className="space-y-1.5">
          <Label>대표 전화</Label>
          <Input {...register("phone")} placeholder="+61 3 XXXX XXXX" />
        </div>
        <div className="space-y-1.5">
          <Label>대표 이메일</Label>
          <Input {...register("email")} type="email" placeholder="admin@millionstay.com.au" />
        </div>
        <div className="space-y-1.5">
          <Label>웹사이트</Label>
          <Input {...register("website")} placeholder="https://millionstay.com.au" />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">주소</h3>
        <p className="text-sm text-muted-foreground mt-0.5">사업장 주소</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label>주소 1</Label>
          <Input {...register("address1")} placeholder="Street address" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>주소 2 (선택)</Label>
          <Input {...register("address2")} placeholder="Suite, level, unit..." />
        </div>
        <div className="space-y-1.5">
          <Label>Suburb</Label>
          <Input {...register("suburb")} placeholder="Melbourne" />
        </div>
        <div className="space-y-1.5">
          <Label>State</Label>
          <Controller
            name="state"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["ACT","NSW","NT","QLD","SA","TAS","VIC","WA"].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Postcode</Label>
          <Input {...register("postcode")} placeholder="3000" />
        </div>
        <div className="space-y-1.5">
          <Label>Country</Label>
          <Controller
            name="country"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AU">Australia</SelectItem>
                  <SelectItem value="NZ">New Zealand</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="GB">United Kingdom</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">지역 설정</h3>
        <p className="text-sm text-muted-foreground mt-0.5">시간대 및 표시 형식</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Timezone</Label>
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
        <Button type="submit">
          <Save className="h-4 w-4 mr-2" />
          저장
        </Button>
      </div>
    </form>
  );
}

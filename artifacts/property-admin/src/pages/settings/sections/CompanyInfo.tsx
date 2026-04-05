import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
    toast({ title: "Saved", description: "Company information has been updated." });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">Basic Information</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Legal entity name and business details</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Company Name (Legal)</Label>
          <Input {...register("company_name")} placeholder="MillionStay Pty Ltd" />
        </div>
        <div className="space-y-1.5">
          <Label>Trading Name</Label>
          <Input {...register("trading_name")} placeholder="MillionStay" />
        </div>
        <div className="space-y-1.5">
          <Label>ABN</Label>
          <Input {...register("abn")} placeholder="XX XXX XXX XXX" />
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input {...register("phone")} placeholder="+61 3 XXXX XXXX" />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input {...register("email")} type="email" placeholder="admin@millionstay.com.au" />
        </div>
        <div className="space-y-1.5">
          <Label>Website</Label>
          <Input {...register("website")} placeholder="https://millionstay.com.au" />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">Address</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Principal place of business</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label>Address Line 1</Label>
          <Input {...register("address1")} placeholder="Street address" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Address Line 2 (optional)</Label>
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
                  {["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"].map((s) => (
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
        <h3 className="text-base font-semibold">Regional Settings</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Timezone and display preferences</p>
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
          Save
        </Button>
      </div>
    </form>
  );
}

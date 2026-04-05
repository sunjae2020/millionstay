import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Save, Upload, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DesignForm {
  brand_name: string;
  primary_color: string;
  date_format: string;
  currency: string;
  currency_position: string;
  sidebar_theme: string;
}

const PRESET_COLORS = [
  { label: "Indigo", value: "#6366f1" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Emerald", value: "#10b981" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Slate", value: "#64748b" },
];

export function Design() {
  const { toast } = useToast();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const { register, handleSubmit, control, watch } = useForm<DesignForm>({
    defaultValues: {
      brand_name: "MillionStay",
      primary_color: "#6366f1",
      date_format: "DD/MM/YYYY",
      currency: "AUD",
      currency_position: "prefix",
      sidebar_theme: "dark",
    },
  });

  const primaryColor = watch("primary_color");

  function onSubmit(_data: DesignForm) {
    toast({ title: "Saved", description: "Design settings have been updated." });
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">Branding</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Logo and brand name configuration</p>
      </div>

      <div className="flex items-start gap-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-20 w-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: primaryColor }}
              >
                <Building2 className="h-6 w-6 text-white" />
              </div>
            )}
          </div>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border rounded-md px-2 py-1">
              <Upload className="h-3 w-3" />
              Upload logo
            </span>
          </label>
          <p className="text-xs text-muted-foreground text-center">PNG or SVG recommended<br />Max 1MB</p>
        </div>

        <div className="flex-1 space-y-4">
          <div className="space-y-1.5">
            <Label>Brand Name</Label>
            <Input {...register("brand_name")} placeholder="MillionStay" />
            <p className="text-xs text-muted-foreground">Displayed in the sidebar and emails</p>
          </div>

          <div className="space-y-1.5">
            <Label>Sidebar Theme</Label>
            <Controller
              name="sidebar_theme"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Dark (default)</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">Accent Color</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Primary UI highlight color</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              className="h-7 w-7 rounded-full border-2 transition-all"
              style={{
                backgroundColor: c.value,
                borderColor: primaryColor === c.value ? c.value : "transparent",
                outline: primaryColor === c.value ? `2px solid ${c.value}` : "none",
                outlineOffset: "2px",
              }}
              onClick={() => {
                const event = { target: { value: c.value } } as React.ChangeEvent<HTMLInputElement>;
                register("primary_color").onChange(event);
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            {...register("primary_color")}
            className="h-8 w-8 rounded cursor-pointer border border-border"
          />
          <Input {...register("primary_color")} className="w-32 font-mono text-sm" placeholder="#6366f1" />
          <div
            className="h-8 px-3 rounded-md flex items-center text-white text-xs font-medium"
            style={{ backgroundColor: primaryColor }}
          >
            Preview
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">Format</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Date and currency display preferences</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Date Format</Label>
          <Controller
            name="date_format"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  <SelectItem value="D MMM YYYY">D MMM YYYY</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Currency</Label>
          <Controller
            name="currency"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUD">AUD (A$)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="NZD">NZD (NZ$)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Currency Position</Label>
          <Controller
            name="currency_position"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prefix">Prefix ($100)</SelectItem>
                  <SelectItem value="suffix">Suffix (100$)</SelectItem>
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

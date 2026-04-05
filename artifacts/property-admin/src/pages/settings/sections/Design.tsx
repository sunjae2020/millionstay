import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { applyPrimaryColor, saveTheme, loadTheme } from "@/lib/theme";
import { useBrand } from "@/contexts/ThemeContext";
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
  const { refresh } = useBrand();

  const saved = loadTheme();

  const [logoPreview, setLogoPreview] = useState<string | null>(saved.logo ?? null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(saved.favicon ?? null);

  const { register, handleSubmit, control, watch } = useForm<DesignForm>({
    defaultValues: {
      brand_name: saved.brand_name ?? "MillionStay",
      primary_color: saved.primary_color ?? "#6366f1",
      date_format: "DD/MM/YYYY",
      currency: "AUD",
      currency_position: "prefix",
      sidebar_theme: saved.sidebar_theme ?? "dark",
    },
  });

  const primaryColor = watch("primary_color");

  useEffect(() => {
    applyPrimaryColor(primaryColor);
  }, [primaryColor]);

  function onSubmit(data: DesignForm) {
    saveTheme({
      primary_color: data.primary_color,
      brand_name: data.brand_name,
      sidebar_theme: data.sidebar_theme,
      logo: logoPreview,
      favicon: faviconPreview,
    });
    refresh();
    toast({ title: "Saved", description: "Design settings have been updated." });
  }

  function makeUploadHandler(
    setter: (v: string | null) => void,
    themeKey: "logo" | "favicon"
  ) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setter(dataUrl);
        // Save immediately so sidebar updates without requiring Save
        saveTheme({ [themeKey]: dataUrl });
        refresh();
      };
      reader.readAsDataURL(file);
    };
  }

  function handleRemoveLogo() {
    setLogoPreview(null);
    saveTheme({ logo: null });
    refresh();
  }

  function handleRemoveFavicon() {
    setFaviconPreview(null);
    saveTheme({ favicon: null });
    refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">Branding</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Logo, favicon, and brand name configuration</p>
      </div>

      {/* Logo + Favicon side by side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Logo */}
        <div className="rounded-lg border bg-muted/20 p-4 flex flex-col items-center gap-3">
          <p className="text-xs font-medium text-muted-foreground self-start uppercase tracking-wide">Logo</p>
          <div className="h-24 w-full max-w-[160px] rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-background overflow-hidden">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="h-full w-full object-contain p-2" />
            ) : (
              <div
                className="h-12 w-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: primaryColor }}
              >
                <Building2 className="h-7 w-7 text-white" />
              </div>
            )}
          </div>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/png,image/svg+xml,image/jpeg,image/webp"
              className="hidden"
              onChange={makeUploadHandler(setLogoPreview, "logo")}
            />
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border rounded-md px-3 py-1.5 bg-background">
              <Upload className="h-3 w-3" />
              Upload Logo
            </span>
          </label>
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            PNG, SVG or WebP<br />Recommended: 200×60px<br />Max 2MB
          </p>
          {logoPreview && (
            <button
              type="button"
              onClick={handleRemoveLogo}
              className="text-xs text-destructive hover:underline"
            >
              Remove
            </button>
          )}
        </div>

        {/* Favicon */}
        <div className="rounded-lg border bg-muted/20 p-4 flex flex-col items-center gap-3">
          <p className="text-xs font-medium text-muted-foreground self-start uppercase tracking-wide">Favicon</p>
          <div className="h-24 w-full max-w-[160px] rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-background overflow-hidden">
            {faviconPreview ? (
              <img src={faviconPreview} alt="Favicon" className="h-10 w-10 object-contain" />
            ) : (
              <div
                className="h-10 w-10 rounded-md flex items-center justify-center"
                style={{ backgroundColor: primaryColor }}
              >
                <span className="text-white font-bold text-lg leading-none">M</span>
              </div>
            )}
          </div>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/png,image/x-icon,image/svg+xml"
              className="hidden"
              onChange={makeUploadHandler(setFaviconPreview, "favicon")}
            />
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border rounded-md px-3 py-1.5 bg-background">
              <Upload className="h-3 w-3" />
              Upload Favicon
            </span>
          </label>
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            PNG, ICO or SVG<br />Recommended: 32×32px<br />Max 256KB
          </p>
          {faviconPreview && (
            <button
              type="button"
              onClick={handleRemoveFavicon}
              className="text-xs text-destructive hover:underline"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Browser tab preview */}
      {faviconPreview && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3">
          <p className="text-xs text-muted-foreground mb-2">Browser tab preview</p>
          <div className="inline-flex items-center gap-2 bg-background border rounded-t-md px-3 py-1.5 text-xs shadow-sm">
            <img src={faviconPreview} alt="tab icon" className="h-3.5 w-3.5 object-contain" />
            <span className="text-foreground font-medium">MillionStay Admin</span>
          </div>
        </div>
      )}

      <div className="space-y-4">
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

      <Separator />

      <div>
        <h3 className="text-base font-semibold">Accent Color</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Primary UI highlight color</p>
      </div>

      <Controller
        name="primary_color"
        control={control}
        render={({ field }) => (
          <div className="space-y-3">
            {/* Preset swatches */}
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  className="h-7 w-7 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c.value,
                    borderColor: field.value === c.value ? c.value : "transparent",
                    outline: field.value === c.value ? `2px solid ${c.value}` : "none",
                    outlineOffset: "2px",
                  }}
                  onClick={() => field.onChange(c.value)}
                />
              ))}
            </div>

            {/* Native color picker + hex text + preview */}
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                className="h-8 w-8 rounded cursor-pointer border border-border"
              />
              <Input
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                className="w-32 font-mono text-sm"
                placeholder="#6366f1"
              />
              <div
                className="h-8 px-3 rounded-md flex items-center text-white text-xs font-medium transition-colors"
                style={{ backgroundColor: field.value }}
              >
                Preview
              </div>
            </div>
          </div>
        )}
      />

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

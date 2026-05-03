import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  applyPrimaryColor,
  applySecondaryColor,
  applyAccentColor,
  applySidebarTheme,
  applyCustomCss,
  applyDarkMode,
  applyFavicon,
  saveTheme,
  loadTheme,
} from "@/lib/theme";
import { useBrand } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Save,
  Upload,
  Building2,
  Palette,
  Sun,
  Moon,
  Code2,
  Image as ImageIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DesignForm {
  brand_name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  date_format: string;
  currency: string;
  currency_position: string;
  sidebar_theme: string;
  custom_css: string;
}

const DEFAULTS = {
  primary_color: "#F5821F",
  secondary_color: "#1C1917",
  accent_color: "#FEF0E3",
};

const PRESET_COLORS = [
  { label: "Orange", value: "#F5821F" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Emerald", value: "#10b981" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Slate", value: "#64748b" },
];

type AssetSlot = "logo" | "favicon" | "logo_dark" | "favicon_dark";

function AssetCard({
  label,
  hint,
  accept,
  preview,
  onUpload,
  onRemove,
  variant,
  dark,
}: {
  label: string;
  hint: string;
  accept: string;
  preview: string | null;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  variant: "logo" | "favicon";
  dark?: boolean;
}) {
  return (
    <div
      className={
        "rounded-lg border p-4 flex flex-col items-center gap-3 " +
        (dark ? "bg-zinc-900/40 border-zinc-700" : "bg-muted/20")
      }
    >
      <p className="text-xs font-medium text-muted-foreground self-start uppercase tracking-wide">
        {label}
      </p>
      <div className="h-24 w-full max-w-[180px] rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-background overflow-hidden">
        {preview ? (
          variant === "logo" ? (
            <img src={preview} alt={label} className="h-full w-full object-contain p-2" />
          ) : (
            <img src={preview} alt={label} className="h-10 w-10 object-contain" />
          )
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <Upload className="h-5 w-5" />
            <span className="text-xs">Click to upload</span>
          </div>
        )}
      </div>
      <label className="cursor-pointer">
        <input type="file" accept={accept} className="hidden" onChange={onUpload} />
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border rounded-md px-3 py-1.5 bg-background">
          <Upload className="h-3 w-3" />
          {preview ? "Replace" : "Upload"}
        </span>
      </label>
      <p className="text-xs text-muted-foreground text-center leading-relaxed">{hint}</p>
      {preview && (
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-destructive hover:underline"
        >
          Remove
        </button>
      )}
    </div>
  );
}

function PreviewPane({
  primary,
  secondary,
  accent,
  dark,
  brandName,
  logo,
}: {
  primary: string;
  secondary: string;
  accent: string;
  dark: boolean;
  brandName: string;
  logo: string | null;
}) {
  const bg = dark ? "#0F0F10" : accent;
  const surface = dark ? "#1C1917" : "#ffffff";
  const text = dark ? "#FAFAFA" : "#0F172A";
  const subtext = dark ? "#A1A1AA" : "#64748B";
  const border = dark ? "#2A2A2D" : "#E5E7EB";

  return (
    <div
      className="rounded-lg p-4 space-y-3"
      style={{ backgroundColor: bg, color: text }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: subtext }}>
        {dark ? "Dark Mode Preview" : "Light Mode Preview"}
      </p>
      <div
        className="rounded-md border overflow-hidden"
        style={{ backgroundColor: surface, borderColor: border }}
      >
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{ borderBottom: `1px solid ${border}` }}
        >
          {logo ? (
            <img src={logo} alt="logo" className="h-5 max-w-[120px] object-contain" />
          ) : (
            <div
              className="px-3 py-1 rounded text-xs font-semibold"
              style={{ backgroundColor: primary, color: "#fff" }}
            >
              {brandName}
            </div>
          )}
          <span className="text-xs" style={{ color: subtext }}>
            Contacts
          </span>
        </div>
        <div className="grid grid-cols-[140px_1fr]">
          <div className="p-2 space-y-1" style={{ borderRight: `1px solid ${border}` }}>
            {["Dashboard", "Contacts", "Contracts", "Settings"].map((item, i) => {
              const active = i === 1;
              return (
                <div
                  key={item}
                  className="text-xs px-2 py-1.5 rounded"
                  style={{
                    backgroundColor: active ? primary + "26" : "transparent",
                    color: active ? primary : text,
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {item}
                </div>
              );
            })}
          </div>
          <div className="p-2 space-y-1.5">
            {["Kim Sunjae", "Park Jiyeon", "Lee Junho"].map((name, i) => (
              <div
                key={name}
                className="flex items-center justify-between text-xs px-2 py-1.5 rounded border"
                style={{ borderColor: border }}
              >
                <span>{name}</span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: i === 0 ? primary : "transparent",
                    color: i === 0 ? "#fff" : subtext,
                    border: i === 0 ? "none" : `1px solid ${border}`,
                  }}
                >
                  {i === 0 ? "Active" : "Inactive"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <span
          className="text-xs px-3 py-1.5 rounded font-medium"
          style={{ backgroundColor: primary, color: "#fff" }}
        >
          Primary Button
        </span>
        <span
          className="text-xs px-3 py-1.5 rounded font-medium border"
          style={{ borderColor: primary, color: primary }}
        >
          Outline Button
        </span>
        <span
          className="text-xs px-3 py-1.5 rounded font-medium"
          style={{ backgroundColor: secondary, color: "#fff" }}
        >
          Secondary
        </span>
      </div>
    </div>
  );
}

export function Design() {
  const { toast } = useToast();
  const { refresh, darkMode, toggleDarkMode } = useBrand();

  const saved = loadTheme();

  const [logoPreview, setLogoPreview] = useState<string | null>(saved.logo ?? null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(saved.favicon ?? null);
  const [logoDarkPreview, setLogoDarkPreview] = useState<string | null>(saved.logo_dark ?? null);
  const [faviconDarkPreview, setFaviconDarkPreview] = useState<string | null>(
    saved.favicon_dark ?? null
  );

  const { register, handleSubmit, control, watch } = useForm<DesignForm>({
    defaultValues: {
      brand_name: saved.brand_name ?? "MillionStay",
      primary_color: saved.primary_color ?? DEFAULTS.primary_color,
      secondary_color: saved.secondary_color ?? DEFAULTS.secondary_color,
      accent_color: saved.accent_color ?? DEFAULTS.accent_color,
      date_format: "DD/MM/YYYY",
      currency: "AUD",
      currency_position: "prefix",
      sidebar_theme: saved.sidebar_theme ?? "dark",
      custom_css: saved.custom_css ?? "",
    },
  });

  const primary = watch("primary_color");
  const secondary = watch("secondary_color");
  const accent = watch("accent_color");
  const sidebarTheme = watch("sidebar_theme");
  const brandName = watch("brand_name");

  // Live preview of theme variables on the running page.
  useEffect(() => {
    applyPrimaryColor(primary);
  }, [primary]);
  useEffect(() => {
    applySecondaryColor(secondary);
  }, [secondary]);
  useEffect(() => {
    applyAccentColor(accent);
  }, [accent]);
  useEffect(() => {
    applySidebarTheme(sidebarTheme);
  }, [sidebarTheme]);

  function onSubmit(data: DesignForm) {
    saveTheme({
      brand_name: data.brand_name,
      primary_color: data.primary_color,
      secondary_color: data.secondary_color,
      accent_color: data.accent_color,
      sidebar_theme: data.sidebar_theme,
      logo: logoPreview,
      favicon: faviconPreview,
      logo_dark: logoDarkPreview,
      favicon_dark: faviconDarkPreview,
      custom_css: data.custom_css || null,
    });
    applyPrimaryColor(data.primary_color);
    applySecondaryColor(data.secondary_color);
    applyAccentColor(data.accent_color);
    applySidebarTheme(data.sidebar_theme);
    applyCustomCss(data.custom_css || null);
    const useDark = darkMode && faviconDarkPreview ? faviconDarkPreview : faviconPreview;
    applyFavicon(useDark);
    refresh();
    toast({ title: "Saved", description: "Branding settings have been updated." });
  }

  function makeUploadHandler(
    setter: (v: string | null) => void,
    themeKey: AssetSlot
  ) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setter(dataUrl);
        saveTheme({ [themeKey]: dataUrl } as Record<string, string>);
        if (themeKey === "favicon" || themeKey === "favicon_dark") {
          applyFavicon(dataUrl);
        }
        refresh();
      };
      reader.readAsDataURL(file);
    };
  }

  function makeRemoveHandler(setter: (v: string | null) => void, themeKey: AssetSlot) {
    return () => {
      setter(null);
      saveTheme({ [themeKey]: null } as Record<string, string | null>);
      refresh();
    };
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header with dark mode toggle */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Branding</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Customise your logo, colours, and visual identity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleDarkMode}
            title="Toggle admin dark mode"
          >
            {darkMode ? (
              <>
                <Sun className="h-4 w-4 mr-2" />
                Light Mode
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 mr-2" />
                Dark Mode
              </>
            )}
          </Button>
          <Button type="submit">
            <Save className="h-4 w-4 mr-2" />
            Save Branding
          </Button>
        </div>
      </div>

      {/* LOGO & FAVICON */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">Logo & Favicon</h3>
        </div>
        <Separator />

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Sun className="h-3.5 w-3.5" />
            Light Mode Assets
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <AssetCard
              label="Logo"
              hint="PNG, JPG, SVG, WEBP — max 2MB"
              accept="image/png,image/svg+xml,image/jpeg,image/webp"
              preview={logoPreview}
              onUpload={makeUploadHandler(setLogoPreview, "logo")}
              onRemove={makeRemoveHandler(setLogoPreview, "logo")}
              variant="logo"
            />
            <AssetCard
              label="Favicon"
              hint="ICO or PNG 32x32px — max 500KB"
              accept="image/png,image/x-icon,image/svg+xml"
              preview={faviconPreview}
              onUpload={makeUploadHandler(setFaviconPreview, "favicon")}
              onRemove={makeRemoveHandler(setFaviconPreview, "favicon")}
              variant="favicon"
            />
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Moon className="h-3.5 w-3.5" />
            Dark Mode Assets — Optional separate branding for dark mode
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <AssetCard
              label="Dark Logo"
              hint="PNG, SVG — max 2MB"
              accept="image/png,image/svg+xml,image/jpeg,image/webp"
              preview={logoDarkPreview}
              onUpload={makeUploadHandler(setLogoDarkPreview, "logo_dark")}
              onRemove={makeRemoveHandler(setLogoDarkPreview, "logo_dark")}
              variant="logo"
              dark
            />
            <AssetCard
              label="Dark Favicon"
              hint="ICO or PNG 32x32 — max 500KB"
              accept="image/png,image/x-icon,image/svg+xml"
              preview={faviconDarkPreview}
              onUpload={makeUploadHandler(setFaviconDarkPreview, "favicon_dark")}
              onRemove={makeRemoveHandler(setFaviconDarkPreview, "favicon_dark")}
              variant="favicon"
              dark
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <Label>Brand Name</Label>
            <Input {...register("brand_name")} placeholder="MillionStay" />
            <p className="text-xs text-muted-foreground">Displayed in the sidebar and emails</p>
          </div>
          <div className="space-y-1.5">
            <Label>Sidebar Theme (Light Mode)</Label>
            <Controller
              name="sidebar_theme"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Dark sidebar (default)</SelectItem>
                    <SelectItem value="light">Light sidebar</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">
              Ignored when full Dark Mode is on
            </p>
          </div>
        </div>
      </Card>

      {/* COLOUR SETTINGS */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">Colour Settings</h3>
        </div>
        <Separator />

        <div className="grid md:grid-cols-3 gap-4">
          <ColorField label="Primary Colour" name="primary_color" control={control} />
          <ColorField label="Secondary Colour" name="secondary_color" control={control} />
          <ColorField label="Accent Colour" name="accent_color" control={control} />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground mr-1">Presets:</span>
          <Controller
            name="primary_color"
            control={control}
            render={({ field }) => (
              <>
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    className="h-6 w-6 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: c.value,
                      borderColor: field.value === c.value ? c.value : "transparent",
                      outline: field.value === c.value ? `2px solid ${c.value}` : "none",
                      outlineOffset: "2px",
                    }}
                    onClick={() => field.onChange(c.value)}
                  />
                ))}
              </>
            )}
          />
        </div>

        <Tabs defaultValue="light" className="pt-2">
          <TabsList>
            <TabsTrigger value="light">
              <Sun className="h-3.5 w-3.5 mr-1.5" />
              Light View
            </TabsTrigger>
            <TabsTrigger value="dark">
              <Moon className="h-3.5 w-3.5 mr-1.5" />
              Dark View
            </TabsTrigger>
          </TabsList>
          <TabsContent value="light" className="mt-3">
            <PreviewPane
              primary={primary}
              secondary={secondary}
              accent={accent}
              dark={false}
              brandName={brandName}
              logo={logoPreview}
            />
          </TabsContent>
          <TabsContent value="dark" className="mt-3">
            <PreviewPane
              primary={primary}
              secondary={secondary}
              accent={accent}
              dark={true}
              brandName={brandName}
              logo={logoDarkPreview ?? logoPreview}
            />
          </TabsContent>
        </Tabs>
      </Card>

      {/* FORMAT */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">Format</h3>
        </div>
        <Separator />
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Date Format</Label>
            <Controller
              name="date_format"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prefix">Prefix ($100)</SelectItem>
                    <SelectItem value="suffix">Suffix (100$)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </Card>

      {/* ADVANCED: CUSTOM CSS */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">
            Advanced: Custom CSS
          </h3>
        </div>
        <Separator />
        <p className="text-xs text-muted-foreground">
          Inject custom CSS rules. Applied globally on every page. Use carefully — invalid CSS
          may break layout.
        </p>
        <Textarea
          {...register("custom_css")}
          placeholder={`/* Example */\n.sidebar { box-shadow: 0 0 24px rgba(0,0,0,0.4); }`}
          rows={8}
          className="font-mono text-xs"
        />
      </Card>

      <div className="flex justify-end pt-2">
        <Button type="submit">
          <Save className="h-4 w-4 mr-2" />
          Save Branding
        </Button>
      </div>
    </form>
  );
}

function ColorField({
  label,
  name,
  control,
}: {
  label: string;
  name: "primary_color" | "secondary_color" | "accent_color";
  control: any;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="uppercase text-[11px] tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              className="h-9 w-9 rounded cursor-pointer border border-border shrink-0"
            />
            <Input
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              className="font-mono text-sm"
              placeholder="#000000"
            />
          </div>
        )}
      />
    </div>
  );
}

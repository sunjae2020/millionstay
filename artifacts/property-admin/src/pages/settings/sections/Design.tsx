import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
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
  saveBrandingToApi,
  uploadBrandingImage,
} from "@/lib/theme";
import { useBrand } from "@/contexts/ThemeContext";
import { APP_NAME } from "@/lib/appName";
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
  Loader2,
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
  primary_color: "#E8621A", // Million Orange
  secondary_color: "#16263F", // Deep Navy
  accent_color: "#FAF5EC", // Warm Cream
};

const PRESET_COLORS = [
  { label: "Orange", value: "#E8621A" },
  { label: "Teal", value: "#2A9D8F" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Emerald", value: "#10b981" },
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
  busy,
}: {
  label: string;
  hint: string;
  accept: string;
  preview: string | null;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  variant: "logo" | "favicon";
  dark?: boolean;
  busy?: boolean;
}) {
  const { t } = useTranslation();
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
        {busy ? (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-xs">{t("settings_design.uploading")}</span>
          </div>
        ) : preview ? (
          variant === "logo" ? (
            <img src={preview} alt={label} className="h-full w-full object-contain p-2" />
          ) : (
            <img src={preview} alt={label} className="h-10 w-10 object-contain" />
          )
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <Upload className="h-5 w-5" />
            <span className="text-xs">{t("settings_design.click_to_upload")}</span>
          </div>
        )}
      </div>
      <label className={busy ? "opacity-50 pointer-events-none" : "cursor-pointer"}>
        <input type="file" accept={accept} className="hidden" onChange={onUpload} disabled={busy} />
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border rounded-md px-3 py-1.5 bg-background">
          <Upload className="h-3 w-3" />
          {preview ? t("settings_design.replace") : t("common.upload")}
        </span>
      </label>
      <p className="text-xs text-muted-foreground text-center leading-relaxed">{hint}</p>
      {preview && (
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-destructive hover:underline"
        >
          {t("settings_design.remove")}
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
  const { t } = useTranslation();
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
        {dark ? t("settings_design.dark_mode_preview") : t("settings_design.light_mode_preview")}
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
            {t("settings_design.preview_nav_contacts")}
          </span>
        </div>
        <div className="grid grid-cols-[140px_1fr]">
          <div className="p-2 space-y-1" style={{ borderRight: `1px solid ${border}` }}>
            {[
              { key: "dashboard", label: t("settings_design.preview_nav_dashboard") },
              { key: "contacts", label: t("settings_design.preview_nav_contacts") },
              { key: "contracts", label: t("settings_design.preview_nav_contracts") },
              { key: "settings", label: t("settings_design.preview_nav_settings") },
            ].map((item, i) => {
              const active = i === 1;
              return (
                <div
                  key={item.key}
                  className="text-xs px-2 py-1.5 rounded"
                  style={{
                    backgroundColor: active ? primary + "26" : "transparent",
                    color: active ? primary : text,
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {item.label}
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
                  {i === 0 ? t("common.active") : t("common.inactive")}
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
          {t("settings_design.primary_button")}
        </span>
        <span
          className="text-xs px-3 py-1.5 rounded font-medium border"
          style={{ borderColor: primary, color: primary }}
        >
          {t("settings_design.outline_button")}
        </span>
        <span
          className="text-xs px-3 py-1.5 rounded font-medium"
          style={{ backgroundColor: secondary, color: "#fff" }}
        >
          {t("settings_design.secondary_button")}
        </span>
      </div>
    </div>
  );
}

export function Design() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { refresh, darkMode, toggleDarkMode } = useBrand();

  const saved = loadTheme();

  const [logoPreview, setLogoPreview] = useState<string | null>(saved.logo ?? null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(saved.favicon ?? null);
  const [logoDarkPreview, setLogoDarkPreview] = useState<string | null>(saved.logo_dark ?? null);
  const [faviconDarkPreview, setFaviconDarkPreview] = useState<string | null>(
    saved.favicon_dark ?? null
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<AssetSlot | null>(null);

  const { register, handleSubmit, control, watch } = useForm<DesignForm>({
    defaultValues: {
      brand_name: saved.brand_name ?? APP_NAME,
      primary_color: saved.primary_color ?? DEFAULTS.primary_color,
      secondary_color: saved.secondary_color ?? DEFAULTS.secondary_color,
      accent_color: saved.accent_color ?? DEFAULTS.accent_color,
      date_format: saved.date_format ?? "DD/MM/YYYY",
      currency: saved.currency ?? "AUD",
      currency_position: saved.currency_position ?? "prefix",
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

  async function onSubmit(data: DesignForm) {
    const settings = {
      brand_name: data.brand_name,
      primary_color: data.primary_color,
      secondary_color: data.secondary_color,
      accent_color: data.accent_color,
      date_format: data.date_format,
      currency: data.currency,
      currency_position: data.currency_position,
      sidebar_theme: data.sidebar_theme,
      logo: logoPreview,
      favicon: faviconPreview,
      logo_dark: logoDarkPreview,
      favicon_dark: faviconDarkPreview,
      custom_css: data.custom_css || null,
    };
    // Apply + cache locally right away for instant feedback.
    saveTheme(settings);
    applyPrimaryColor(data.primary_color);
    applySecondaryColor(data.secondary_color);
    applyAccentColor(data.accent_color);
    applySidebarTheme(data.sidebar_theme);
    applyCustomCss(data.custom_css || null);
    const useDark = darkMode && faviconDarkPreview ? faviconDarkPreview : faviconPreview;
    applyFavicon(useDark);
    refresh();
    // Persist to the server so every admin/device sees it.
    setSaving(true);
    try {
      await saveBrandingToApi(settings);
      toast({
        title: t("settings_design.toast_saved_title"),
        description: t("settings_design.toast_saved_desc"),
      });
    } catch {
      toast({
        variant: "destructive",
        title: t("settings_design.toast_save_failed_title"),
        description: t("settings_design.toast_save_failed_desc"),
      });
    } finally {
      setSaving(false);
    }
  }

  function makeUploadHandler(
    setter: (v: string | null) => void,
    themeKey: AssetSlot
  ) {
    return async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Allow re-selecting the same file later.
      e.target.value = "";
      setUploading(themeKey);
      try {
        const url = await uploadBrandingImage(file);
        setter(url);
        saveTheme({ [themeKey]: url } as Record<string, string>);
        if (themeKey === "favicon" || themeKey === "favicon_dark") {
          applyFavicon(url);
        }
        refresh();
      } catch {
        toast({
          variant: "destructive",
          title: t("settings_design.toast_upload_failed_title"),
          description: t("settings_design.toast_upload_failed_desc"),
        });
      } finally {
        setUploading(null);
      }
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
          <h2 className="text-2xl font-semibold">{t("settings_design.branding_title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("settings_design.branding_subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleDarkMode}
            title={t("settings_design.toggle_dark_mode")}
          >
            {darkMode ? (
              <>
                <Sun className="h-4 w-4 mr-2" />
                {t("settings_design.light_mode")}
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 mr-2" />
                {t("settings_design.dark_mode")}
              </>
            )}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t("settings_design.save_branding")}
          </Button>
        </div>
      </div>

      {/* LOGO & FAVICON */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">{t("settings_design.logo_favicon")}</h3>
        </div>
        <Separator />

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Sun className="h-3.5 w-3.5" />
            {t("settings_design.light_mode_assets")}
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <AssetCard
              label={t("settings_design.logo")}
              hint={t("settings_design.logo_hint")}
              accept="image/png,image/svg+xml,image/jpeg,image/webp"
              preview={logoPreview}
              onUpload={makeUploadHandler(setLogoPreview, "logo")}
              onRemove={makeRemoveHandler(setLogoPreview, "logo")}
              variant="logo"
              busy={uploading === "logo"}
            />
            <AssetCard
              label={t("settings_design.favicon")}
              hint={t("settings_design.favicon_hint")}
              accept="image/png,image/x-icon,image/svg+xml"
              preview={faviconPreview}
              onUpload={makeUploadHandler(setFaviconPreview, "favicon")}
              onRemove={makeRemoveHandler(setFaviconPreview, "favicon")}
              variant="favicon"
              busy={uploading === "favicon"}
            />
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Moon className="h-3.5 w-3.5" />
            {t("settings_design.dark_mode_assets")}
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <AssetCard
              label={t("settings_design.dark_logo")}
              hint={t("settings_design.dark_logo_hint")}
              accept="image/png,image/svg+xml,image/jpeg,image/webp"
              preview={logoDarkPreview}
              onUpload={makeUploadHandler(setLogoDarkPreview, "logo_dark")}
              onRemove={makeRemoveHandler(setLogoDarkPreview, "logo_dark")}
              variant="logo"
              dark
              busy={uploading === "logo_dark"}
            />
            <AssetCard
              label={t("settings_design.dark_favicon")}
              hint={t("settings_design.dark_favicon_hint")}
              accept="image/png,image/x-icon,image/svg+xml"
              preview={faviconDarkPreview}
              onUpload={makeUploadHandler(setFaviconDarkPreview, "favicon_dark")}
              onRemove={makeRemoveHandler(setFaviconDarkPreview, "favicon_dark")}
              variant="favicon"
              dark
              busy={uploading === "favicon_dark"}
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <Label>{t("settings_design.brand_name")}</Label>
            <Input {...register("brand_name")} placeholder={APP_NAME} />
            <p className="text-xs text-muted-foreground">{t("settings_design.brand_name_hint")}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings_design.sidebar_theme")}</Label>
            <Controller
              name="sidebar_theme"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">{t("settings_design.sidebar_dark_default")}</SelectItem>
                    <SelectItem value="light">{t("settings_design.sidebar_light")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">
              {t("settings_design.sidebar_theme_hint")}
            </p>
          </div>
        </div>
      </Card>

      {/* COLOUR SETTINGS */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">{t("settings_design.colour_settings")}</h3>
        </div>
        <Separator />

        <div className="grid md:grid-cols-3 gap-4">
          <ColorField label={t("settings_design.primary_colour")} name="primary_color" control={control} />
          <ColorField label={t("settings_design.secondary_colour")} name="secondary_color" control={control} />
          <ColorField label={t("settings_design.accent_colour")} name="accent_color" control={control} />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground mr-1">{t("settings_design.presets")}</span>
          <Controller
            name="primary_color"
            control={control}
            render={({ field }) => (
              <>
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={t(`settings_design.preset_${c.label.toLowerCase()}`)}
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
              {t("settings_design.light_view")}
            </TabsTrigger>
            <TabsTrigger value="dark">
              <Moon className="h-3.5 w-3.5 mr-1.5" />
              {t("settings_design.dark_view")}
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
          <h3 className="text-sm font-semibold uppercase tracking-wide">{t("settings_design.format")}</h3>
        </div>
        <Separator />
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>{t("settings_design.date_format")}</Label>
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
                    <SelectItem value="YYYY/MM/DD">YYYY/MM/DD</SelectItem>
                    <SelectItem value="D MMM YYYY">D MMM YYYY</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings_design.currency")}</Label>
            <Controller
              name="currency"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KRW">KRW (₩)</SelectItem>
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
            <Label>{t("settings_design.currency_position")}</Label>
            <Controller
              name="currency_position"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prefix">{t("settings_design.currency_prefix")}</SelectItem>
                    <SelectItem value="suffix">{t("settings_design.currency_suffix")}</SelectItem>
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
            {t("settings_design.advanced_custom_css")}
          </h3>
        </div>
        <Separator />
        <p className="text-xs text-muted-foreground">
          {t("settings_design.custom_css_hint")}
        </p>
        <Textarea
          {...register("custom_css")}
          placeholder={`/* Example */\n.sidebar { box-shadow: 0 0 24px rgba(0,0,0,0.4); }`}
          rows={8}
          className="font-mono text-xs"
        />
      </Card>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {t("settings_design.save_branding")}
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

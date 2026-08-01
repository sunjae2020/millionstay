import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Palette, Save, Info, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_TOKENS,
  FONT_PAIRS,
  TOKEN_ROLES,
  resolveTokens,
  tokensToCssVars,
  type DesignTokens,
} from "@workspace/cms-blocks";
import { useCmsSites } from "./useCmsSites";
import { SiteSwitcher } from "./CmsPagesList";

// The design guide. Admins manage tokens per site themselves — there is no
// central approver. Blocks reference these ROLES, never raw colours, so editing
// here restyles every page of that site at once.

const RADIUS_OPTIONS: DesignTokens["radiusScale"][] = ["sharp", "soft", "round"];
const SPACING_OPTIONS: DesignTokens["spacingScale"][] = ["compact", "regular", "airy"];
const HEADING_OPTIONS: DesignTokens["headingScale"][] = ["modest", "regular", "bold"];

export default function CmsDesign() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { sites, siteKey, setSiteKey } = useCmsSites();
  const [tokens, setTokens] = useState<DesignTokens>(DEFAULT_TOKENS);

  const { data, isLoading } = useQuery({
    queryKey: ["cms-site-settings", siteKey],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/cms/site-settings/${siteKey}`);
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
    enabled: Boolean(siteKey),
  });

  useEffect(() => {
    if (data) setTokens(resolveTokens(data.design_tokens));
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/v1/cms/site-settings/${siteKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design_tokens: tokens }),
      });
      if (!res.ok) throw new Error("Failed to save");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cms-site-settings", siteKey] });
      toast({ title: t("cms.saved") });
    },
    onError: (err: Error) => toast({ title: t("cms.save_failed"), description: err.message, variant: "destructive" }),
  });

  const cssVars = tokensToCssVars(tokens) as React.CSSProperties;

  return (
    <Layout>
      <PageHeader
        title={
          <>
            <Palette className="h-5 w-5" />
            {t("cms.design_title")}
          </>
        }
        subtitle={t("cms.design_subtitle")}
        actions={
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {t("common.save")}
          </Button>
        }
      />

      <div className="p-6">
        <SiteSwitcher sites={sites} value={siteKey} onChange={setSiteKey} />

        {/* Two different things are called "design" in this app — say which is which. */}
        <div className="mb-4 flex items-start gap-2 rounded-lg border bg-blue-50/60 px-4 py-3 text-sm text-blue-900">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{t("cms.design_vs_branding_notice")}</span>
        </div>

        {isLoading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("cms.palette")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {TOKEN_ROLES.map((role) => (
                    <div key={role} className="flex items-center gap-3">
                      <div className="w-24 shrink-0">
                        <Label className="text-xs">{t(`cms.role_${role}`, { defaultValue: role })}</Label>
                      </div>
                      <input
                        type="color"
                        className="h-9 w-12 rounded border cursor-pointer"
                        value={tokens.palette[role]}
                        onChange={(e) =>
                          setTokens({ ...tokens, palette: { ...tokens.palette, [role]: e.target.value } })
                        }
                      />
                      <Input
                        className="font-mono text-xs"
                        value={tokens.palette[role]}
                        onChange={(e) =>
                          setTokens({ ...tokens, palette: { ...tokens.palette, [role]: e.target.value } })
                        }
                      />
                      <input
                        type="color"
                        title={t("cms.on_colour")}
                        className="h-9 w-12 rounded border cursor-pointer"
                        value={tokens.onPalette?.[role] ?? "#FFFFFF"}
                        onChange={(e) =>
                          setTokens({ ...tokens, onPalette: { ...tokens.onPalette, [role]: e.target.value } })
                        }
                      />
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">{t("cms.palette_hint")}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("cms.typography_scale")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs">{t("cms.font_pair")}</Label>
                    <Select value={tokens.fontPair} onValueChange={(v) => setTokens({ ...tokens, fontPair: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_PAIRS.map((pair) => (
                          <SelectItem key={pair.value} value={pair.value}>
                            {pair.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <ScaleSelect
                    label={t("cms.radius_scale")}
                    options={RADIUS_OPTIONS}
                    value={tokens.radiusScale}
                    onChange={(v) => setTokens({ ...tokens, radiusScale: v })}
                  />
                  <ScaleSelect
                    label={t("cms.spacing_scale")}
                    options={SPACING_OPTIONS}
                    value={tokens.spacingScale}
                    onChange={(v) => setTokens({ ...tokens, spacingScale: v })}
                  />
                  <ScaleSelect
                    label={t("cms.heading_scale")}
                    options={HEADING_OPTIONS}
                    value={tokens.headingScale}
                    onChange={(v) => setTokens({ ...tokens, headingScale: v })}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Live sample of what blocks will look like with these tokens. */}
            <Card className="lg:sticky lg:top-6 h-fit">
              <CardHeader>
                <CardTitle className="text-base">{t("cms.preview")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={cssVars} className="rounded-lg overflow-hidden border">
                  <div
                    className="px-6 py-10 text-center"
                    style={{ background: "var(--cms-ink)", color: "var(--cms-on-ink)", fontFamily: "var(--cms-font-heading)" }}
                  >
                    <h2 className="text-2xl font-bold">{t("cms.preview_hero_title")}</h2>
                    <p className="mt-2 text-sm opacity-80">{t("cms.preview_hero_sub")}</p>
                    <button
                      className="mt-4 px-4 py-2 text-sm font-medium"
                      style={{
                        background: "var(--cms-primary)",
                        color: "var(--cms-on-primary)",
                        borderRadius: "var(--cms-radius)",
                      }}
                    >
                      {t("cms.preview_button")}
                    </button>
                  </div>
                  <div className="px-6 py-8" style={{ background: "var(--cms-surface)", color: "var(--cms-on-surface)" }}>
                    <h3 className="font-semibold" style={{ fontFamily: "var(--cms-font-heading)" }}>
                      {t("cms.preview_section_title")}
                    </h3>
                    <p className="text-sm mt-2 opacity-80" style={{ fontFamily: "var(--cms-font-body)" }}>
                      {t("cms.preview_section_body")}
                    </p>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {["primary", "accent", "muted"].map((role) => (
                        <div
                          key={role}
                          className="h-14 flex items-center justify-center text-xs"
                          style={{
                            background: `var(--cms-${role})`,
                            color: `var(--cms-on-${role})`,
                            borderRadius: "var(--cms-radius)",
                          }}
                        >
                          {role}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}

function ScaleSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1 mt-1">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors ${
              value === option ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {t(`cms.scale_${option}`, { defaultValue: option })}
          </button>
        ))}
      </div>
    </div>
  );
}

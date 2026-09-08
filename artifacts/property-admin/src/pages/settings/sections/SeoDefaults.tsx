import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gauge, Loader2, Save, Download } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { useCmsSites } from "@/pages/cms/useCmsSites";
import { SiteSwitcher } from "@/pages/cms/CmsPagesList";

// ---------------------------------------------------------------------------
// Settings → SEO 기본값. Edits cms_site_settings.seo_defaults, the four values
// every page on a site inherits. They are worth their own screen because a
// missing one caps the score of every page at once: no Organization schema and
// no llms.txt intro is twelve points off the whole site, not off one page.
//
// The Organization schema is entered as ordinary fields rather than raw JSON-LD.
// Staff should not have to hand-write schema.org, and a typo in a pasted blob
// is invisible until a crawler chokes on it. Keys we do not show are preserved
// on save, so an advanced value added elsewhere is never silently dropped.
// ---------------------------------------------------------------------------

interface SeoDefaults {
  organizationSchema?: Record<string, unknown>;
  robotsExtra?: string;
  llmsTxtIntro?: string;
  defaultCanonicalBase?: string;
  crawlerFilesDisabled?: boolean;
}

interface OrgForm {
  name: string;
  url: string;
  logo: string;
  telephone: string;
  email: string;
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  addressCountry: string;
  sameAs: string;
}

const EMPTY_ORG: OrgForm = {
  name: "",
  url: "",
  logo: "",
  telephone: "",
  email: "",
  streetAddress: "",
  addressLocality: "",
  addressRegion: "",
  postalCode: "",
  addressCountry: "",
  sameAs: "",
};

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function orgToForm(schema: Record<string, unknown> | undefined): OrgForm {
  if (!schema) return { ...EMPTY_ORG };
  const address = (schema["address"] ?? {}) as Record<string, unknown>;
  const sameAs = Array.isArray(schema["sameAs"]) ? (schema["sameAs"] as string[]) : [];
  return {
    name: str(schema["name"]),
    url: str(schema["url"]),
    logo: str(schema["logo"]),
    telephone: str(schema["telephone"]),
    email: str(schema["email"]),
    streetAddress: str(address["streetAddress"]),
    addressLocality: str(address["addressLocality"]),
    addressRegion: str(address["addressRegion"]),
    postalCode: str(address["postalCode"]),
    addressCountry: str(address["addressCountry"]),
    sameAs: sameAs.join("\n"),
  };
}

/** Empty fields are omitted rather than written as "", so the schema stays clean. */
function formToOrg(
  form: OrgForm,
  previous: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const known = [
    "name",
    "url",
    "logo",
    "telephone",
    "email",
    "address",
    "sameAs",
    "@type",
    "@context",
  ];
  // Anything set elsewhere that this form does not show survives the save.
  const rest = Object.fromEntries(
    Object.entries(previous ?? {}).filter(([key]) => !known.includes(key)),
  );

  const out: Record<string, unknown> = { ...rest };
  if (form.name.trim()) out["name"] = form.name.trim();
  if (form.url.trim()) out["url"] = form.url.trim();
  if (form.logo.trim()) out["logo"] = form.logo.trim();
  if (form.telephone.trim()) out["telephone"] = form.telephone.trim();
  if (form.email.trim()) out["email"] = form.email.trim();

  const address: Record<string, string> = {};
  if (form.streetAddress.trim()) address["streetAddress"] = form.streetAddress.trim();
  if (form.addressLocality.trim()) address["addressLocality"] = form.addressLocality.trim();
  if (form.addressRegion.trim()) address["addressRegion"] = form.addressRegion.trim();
  if (form.postalCode.trim()) address["postalCode"] = form.postalCode.trim();
  if (form.addressCountry.trim()) address["addressCountry"] = form.addressCountry.trim();
  if (Object.keys(address).length > 0) out["address"] = { "@type": "PostalAddress", ...address };

  const sameAs = form.sameAs
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (sameAs.length > 0) out["sameAs"] = sameAs;

  return Object.keys(out).length > 0 ? out : undefined;
}

export default function SeoDefaultsSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { sites, siteKey, setSiteKey, activeSite } = useCmsSites();

  const [org, setOrg] = useState<OrgForm>({ ...EMPTY_ORG });
  const [llmsTxtIntro, setLlmsTxtIntro] = useState("");
  const [robotsExtra, setRobotsExtra] = useState("");
  const [canonicalBase, setCanonicalBase] = useState("");

  const { data: settings, isLoading } = useQuery<{ seo_defaults?: SeoDefaults }>({
    queryKey: ["cms-site-settings", siteKey],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/cms/site-settings/${siteKey}`);
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
    enabled: Boolean(siteKey),
  });

  useEffect(() => {
    const defaults = settings?.seo_defaults ?? {};
    setOrg(orgToForm(defaults.organizationSchema));
    setLlmsTxtIntro(defaults.llmsTxtIntro ?? "");
    setRobotsExtra(defaults.robotsExtra ?? "");
    setCanonicalBase(defaults.defaultCanonicalBase ?? "");
  }, [settings, siteKey]);

  const save = useMutation({
    mutationFn: async () => {
      const previous = settings?.seo_defaults ?? {};
      const next: SeoDefaults = {
        ...previous,
        llmsTxtIntro: llmsTxtIntro.trim(),
        robotsExtra: robotsExtra.trim(),
        defaultCanonicalBase: canonicalBase.trim(),
      };
      const schema = formToOrg(org, previous.organizationSchema);
      if (schema) next.organizationSchema = schema;
      else delete next.organizationSchema;

      const res = await apiFetch(`/api/v1/cms/site-settings/${siteKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seo_defaults: next }),
      });
      if (!res.ok) throw new Error(t("seo_defaults.save_failed"));
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cms-site-settings", siteKey] });
      qc.invalidateQueries({ queryKey: ["seo-overview", siteKey] });
      toast({ title: t("seo_defaults.saved") });
    },
    onError: (err: Error) =>
      toast({ title: t("seo_defaults.save_failed"), description: err.message, variant: "destructive" }),
  });

  /** Fill the schema from Settings → Organisation, which is the company SSOT. */
  const prefill = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/v1/company-info");
      if (!res.ok) throw new Error(t("seo_defaults.prefill_failed"));
      return res.json() as Promise<Record<string, unknown>>;
    },
    onSuccess: (info) => {
      setOrg((current) => ({
        ...current,
        name: current.name || str(info["company_name"]) || str(info["trading_name"]),
        url: current.url || str(info["website"]),
        telephone: current.telephone || str(info["phone"]),
        email: current.email || str(info["email"]),
        streetAddress: current.streetAddress || str(info["address1"]),
        addressLocality: current.addressLocality || str(info["city"]),
        addressRegion: current.addressRegion || str(info["state"]),
        postalCode: current.postalCode || str(info["postcode"]),
        addressCountry: current.addressCountry || str(info["country"]),
      }));
      toast({ title: t("seo_defaults.prefilled"), description: t("seo_defaults.prefilled_hint") });
    },
    onError: (err: Error) =>
      toast({ title: t("seo_defaults.prefill_failed"), description: err.message, variant: "destructive" }),
  });

  const field = (key: keyof OrgForm, label: string, placeholder?: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        value={org[key]}
        placeholder={placeholder}
        onChange={(event) => setOrg({ ...org, [key]: event.target.value })}
      />
    </div>
  );

  return (
    <Layout>
      <PageHeader
        title={
          <>
            <Gauge className="h-5 w-5" />
            {t("seo_defaults.title")}
          </>
        }
        subtitle={t("seo_defaults.subtitle")}
        actions={
          <Button onClick={() => save.mutate()} disabled={save.isPending || !siteKey}>
            {save.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t("common.save")}
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        <SiteSwitcher sites={sites} value={siteKey} onChange={setSiteKey} />

        {isLoading ? (
          <div className="flex justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">{t("seo_defaults.org_title")}</CardTitle>
                    <CardDescription>{t("seo_defaults.org_desc")}</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => prefill.mutate()}
                    disabled={prefill.isPending}
                  >
                    {prefill.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {t("seo_defaults.prefill")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {field("name", t("seo_defaults.org_name"))}
                {field("url", t("seo_defaults.org_url"), "https://…")}
                {field("logo", t("seo_defaults.org_logo"), "https://…")}
                {field("telephone", t("seo_defaults.org_phone"))}
                {field("email", t("seo_defaults.org_email"))}
                {field("streetAddress", t("seo_defaults.org_street"))}
                {field("addressLocality", t("seo_defaults.org_city"))}
                {field("addressRegion", t("seo_defaults.org_region"))}
                {field("postalCode", t("seo_defaults.org_postcode"))}
                {field("addressCountry", t("seo_defaults.org_country"), "KR")}
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">{t("seo_defaults.org_same_as")}</Label>
                  <Textarea
                    rows={3}
                    value={org.sameAs}
                    placeholder={"https://www.instagram.com/…\nhttps://blog.naver.com/…"}
                    onChange={(event) => setOrg({ ...org, sameAs: event.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t("seo_defaults.org_same_as_hint")}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("seo_defaults.llms_title")}</CardTitle>
                <CardDescription>{t("seo_defaults.llms_desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  rows={3}
                  value={llmsTxtIntro}
                  placeholder={t("seo_defaults.llms_placeholder")}
                  onChange={(event) => setLlmsTxtIntro(event.target.value)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("seo_defaults.canonical_title")}</CardTitle>
                <CardDescription>{t("seo_defaults.canonical_desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  value={canonicalBase}
                  placeholder={activeSite?.host ?? "https://…"}
                  onChange={(event) => setCanonicalBase(event.target.value)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("seo_defaults.robots_title")}</CardTitle>
                <CardDescription>{t("seo_defaults.robots_desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  rows={3}
                  className="font-mono text-xs"
                  value={robotsExtra}
                  placeholder={"Disallow: /portal\nDisallow: /login"}
                  onChange={(event) => setRobotsExtra(event.target.value)}
                />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}

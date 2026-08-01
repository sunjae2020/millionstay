import { useEffect, useMemo, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Save,
  Globe,
  Languages,
  Loader2,
  Search,
  Sparkles,
  Download,
  ExternalLink,
  Info,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/date";
import { MediaPickerDialog } from "@/components/MediaLibrary";
import { normaliseBody, type Block } from "@workspace/cms-blocks";
import { BlockCanvas } from "./BlockCanvas";

// The page builder — one page, one locale at a time ("You are editing the
// English version"), matching how the reference CMS models multilingual pages.

const LOCALE_LABELS: Record<string, { label: string; flag: string }> = {
  en: { label: "English", flag: "🇦🇺" },
  ko: { label: "한국어", flag: "🇰🇷" },
  ja: { label: "日本語", flag: "🇯🇵" },
  zh: { label: "中文", flag: "🇨🇳" },
  th: { label: "ไทย", flag: "🇹🇭" },
  vi: { label: "Tiếng Việt", flag: "🇻🇳" },
};

interface PageDetail {
  id: number;
  site_key: string;
  slug: string;
  title: string | null;
  render_mode: string;
  status: string;
  is_home: boolean;
  nav_hidden: boolean;
  legacy_page_key: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  seo_image_url: string | null;
  site: { site_key: string; label: string; host: string | null; locales: string[]; default_locale: string } | null;
  locales: { locale: string; status: string; source: string | null; updated_at: string; blocks: number }[];
}

interface TranslationDetail {
  locale: string;
  title: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  body_json: { blocks: Block[] };
  status: string;
  source: string | null;
}

export default function CmsPageBuilder() {
  const params = useParams();
  const pageId = Number(params["id"]);
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const [locale, setLocale] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [meta, setMeta] = useState({ title: "", seo_title: "", seo_description: "", seo_keywords: "" });
  const [pageMeta, setPageMeta] = useState({ slug: "", status: "Draft", is_home: false, nav_hidden: false, seo_image_url: "" });
  const [dirty, setDirty] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);

  const { data: page, isLoading } = useQuery<PageDetail>({
    queryKey: ["cms-page", pageId],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/cms/pages/${pageId}`);
      if (!res.ok) throw new Error("Failed to load page");
      return res.json();
    },
  });

  const siteLocales = useMemo(() => page?.site?.locales ?? ["en"], [page]);
  const baseLocale = page?.site?.default_locale ?? "en";

  useEffect(() => {
    if (!locale && siteLocales.length > 0) setLocale(baseLocale);
  }, [siteLocales, baseLocale, locale]);

  useEffect(() => {
    if (!page) return;
    setPageMeta({
      slug: page.slug,
      status: page.status,
      is_home: page.is_home,
      nav_hidden: page.nav_hidden,
      seo_image_url: page.seo_image_url ?? "",
    });
  }, [page]);

  const { data: translation, isFetching: loadingBody } = useQuery<TranslationDetail>({
    queryKey: ["cms-page-translation", pageId, locale],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/cms/pages/${pageId}/translations/${locale}`);
      if (!res.ok) throw new Error("Failed to load body");
      return res.json();
    },
    enabled: Boolean(locale),
  });

  useEffect(() => {
    if (!translation) return;
    setBlocks(normaliseBody(translation.body_json).blocks);
    setMeta({
      title: translation.title ?? "",
      seo_title: translation.seo_title ?? "",
      seo_description: translation.seo_description ?? "",
      seo_keywords: translation.seo_keywords ?? "",
    });
    setDirty(false);
  }, [translation]);

  const save = useMutation({
    mutationFn: async (status?: string) => {
      const bodyRes = await apiFetch(`/api/v1/cms/pages/${pageId}/translations/${locale}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...meta,
          body_json: { blocks },
          ...(status ? { status } : {}),
          source: "human",
        }),
      });
      if (!bodyRes.ok) throw new Error("Failed to save body");
      const pageRes = await apiFetch(`/api/v1/cms/pages/${pageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_key: page?.site_key, ...pageMeta }),
      });
      if (!pageRes.ok) throw new Error("Failed to save page settings");
    },
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["cms-page", pageId] });
      qc.invalidateQueries({ queryKey: ["cms-page-translation", pageId, locale] });
      toast({ title: t("cms.saved") });
    },
    onError: (err: Error) => toast({ title: t("cms.save_failed"), description: err.message, variant: "destructive" }),
  });

  const translate = useMutation({
    mutationFn: async () => {
      const targets = siteLocales.filter((l) => l !== locale);
      const res = await apiFetch(`/api/v1/cms/pages/${pageId}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: locale, to: targets }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Translation failed");
      return res.json();
    },
    onSuccess: (result: { results: { locale: string; ok: boolean }[] }) => {
      const ok = result.results.filter((r) => r.ok).length;
      qc.invalidateQueries({ queryKey: ["cms-page", pageId] });
      toast({ title: t("cms.translated", { count: ok }), description: t("cms.translated_review_hint") });
    },
    onError: (err: Error) => toast({ title: t("cms.translate_failed"), description: err.message, variant: "destructive" }),
  });

  const importLegacy = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/v1/cms/pages/${pageId}/import-legacy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Import failed");
      return res.json();
    },
    onSuccess: (result: { blocks: number; unmatchedKeys: string[] }) => {
      qc.invalidateQueries({ queryKey: ["cms-page-translation", pageId, locale] });
      toast({
        title: t("cms.imported", { count: result.blocks }),
        description: result.unmatchedKeys.length
          ? t("cms.imported_leftovers", { keys: result.unmatchedKeys.join(", ") })
          : undefined,
      });
    },
    onError: (err: Error) => toast({ title: t("cms.import_failed"), description: err.message, variant: "destructive" }),
  });

  if (isLoading || !page) {
    return (
      <Layout>
        <div className="p-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  const previewUrl = page.site?.host
    ? `${page.site.host.replace(/\/$/, "")}/${page.slug}${locale ? `?lang=${locale}` : ""}`
    : "";

  return (
    <Layout>
      <PageHeader
        title={
          <>
            <Globe className="h-5 w-5" />
            {page.title || page.slug}
          </>
        }
        subtitle={`${page.site?.label ?? page.site_key} · /${page.slug}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/cms/pages")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("common.back")}
            </Button>
            <Button onClick={() => save.mutate(undefined)} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {t("common.save")}
            </Button>
          </div>
        }
      />

      <div className="p-6">
        {/* "You are editing the <locale> version" — mirrors the reference CMS. */}
        <div className="mb-4 flex items-center gap-2 rounded-lg border bg-blue-50/60 px-4 py-3 text-sm text-blue-900">
          <Info className="h-4 w-4 shrink-0" />
          <span>
            {t("cms.editing_locale_banner", {
              locale: LOCALE_LABELS[locale]?.label ?? locale,
            })}
          </span>
          {translation?.source === "machine" && (
            <Badge variant="outline" className="ml-2 border-amber-400 text-amber-700 text-[10px]">
              {t("cms.machine_translated")}
            </Badge>
          )}
          {dirty && <span className="ml-auto text-xs text-amber-700">{t("cms.unsaved_changes")}</span>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* ── Main column ── */}
          <div>
            <Tabs defaultValue="body">
              <TabsList>
                <TabsTrigger value="body">{t("cms.tab_body")}</TabsTrigger>
                <TabsTrigger value="seo">{t("cms.tab_seo")}</TabsTrigger>
                <TabsTrigger value="settings">{t("cms.tab_settings")}</TabsTrigger>
              </TabsList>

              <TabsContent value="body" className="mt-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Label className="text-sm">{t("cms.field_title")}</Label>
                  <Input
                    className="max-w-md"
                    value={meta.title}
                    onChange={(e) => {
                      setMeta({ ...meta, title: e.target.value });
                      setDirty(true);
                    }}
                  />
                  {page.legacy_page_key && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => importLegacy.mutate()}
                      disabled={importLegacy.isPending}
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      {t("cms.import_legacy")}
                    </Button>
                  )}
                </div>

                {loadingBody ? (
                  <div className="p-10 flex justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <BlockCanvas
                    blocks={blocks}
                    siteKey={page.site_key}
                    onChange={(next) => {
                      setBlocks(next);
                      setDirty(true);
                    }}
                  />
                )}
              </TabsContent>

              <TabsContent value="seo" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      {t("cms.tab_seo")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>{t("cms.seo_title")}</Label>
                      <Input
                        value={meta.seo_title}
                        onChange={(e) => {
                          setMeta({ ...meta, seo_title: e.target.value });
                          setDirty(true);
                        }}
                      />
                    </div>
                    <div>
                      <Label>{t("cms.seo_description")}</Label>
                      <Textarea
                        rows={3}
                        value={meta.seo_description}
                        onChange={(e) => {
                          setMeta({ ...meta, seo_description: e.target.value });
                          setDirty(true);
                        }}
                      />
                    </div>
                    <div>
                      <Label>{t("cms.seo_keywords")}</Label>
                      <Input
                        value={meta.seo_keywords}
                        onChange={(e) => {
                          setMeta({ ...meta, seo_keywords: e.target.value });
                          setDirty(true);
                        }}
                      />
                    </div>
                    <div>
                      <Label>{t("cms.seo_image")}</Label>
                      <div className="flex gap-2">
                        <Input
                          value={pageMeta.seo_image_url}
                          onChange={(e) => {
                            setPageMeta({ ...pageMeta, seo_image_url: e.target.value });
                            setDirty(true);
                          }}
                        />
                        <Button variant="outline" onClick={() => setImagePickerOpen(true)}>
                          {t("cms.choose_image")}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{t("cms.seo_image_hint")}</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="mt-4 space-y-4">
                <Card>
                  <CardContent className="space-y-4 pt-6">
                    <div>
                      <Label>{t("cms.field_slug")}</Label>
                      <Input
                        value={pageMeta.slug}
                        onChange={(e) => {
                          setPageMeta({ ...pageMeta, slug: e.target.value });
                          setDirty(true);
                        }}
                      />
                      <p className="text-xs text-muted-foreground mt-1">{t("cms.field_slug_hint")}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>{t("cms.is_home")}</Label>
                        <p className="text-xs text-muted-foreground">{t("cms.is_home_hint")}</p>
                      </div>
                      <Switch
                        checked={pageMeta.is_home}
                        onCheckedChange={(v) => {
                          setPageMeta({ ...pageMeta, is_home: v });
                          setDirty(true);
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>{t("cms.nav_hidden")}</Label>
                        <p className="text-xs text-muted-foreground">{t("cms.nav_hidden_hint")}</p>
                      </div>
                      <Switch
                        checked={pageMeta.nav_hidden}
                        onCheckedChange={(v) => {
                          setPageMeta({ ...pageMeta, nav_hidden: v });
                          setDirty(true);
                        }}
                      />
                    </div>
                    {page.render_mode === "legacy" && (
                      <div className="rounded-md bg-amber-50 text-amber-900 text-xs px-3 py-2">
                        {t("cms.legacy_mode_notice")}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* ── Side column ── */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t("cms.publish")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">{t("common.status")}</Label>
                  <Select
                    value={pageMeta.status}
                    onValueChange={(v) => {
                      setPageMeta({ ...pageMeta, status: v });
                      setDirty(true);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={() => save.mutate("Published")} disabled={save.isPending}>
                  {t("cms.publish_locale", { locale: LOCALE_LABELS[locale]?.label ?? locale })}
                </Button>
                {previewUrl && (
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="w-full">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {t("cms.open_preview")}
                    </Button>
                  </a>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  {t("cms.languages")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {siteLocales.map((code) => {
                  const summary = page.locales.find((l) => l.locale === code);
                  const info = LOCALE_LABELS[code];
                  return (
                    <button
                      key={code}
                      onClick={() => setLocale(code)}
                      className={`w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                        locale === code ? "bg-primary/10 text-primary" : "hover:bg-muted"
                      }`}
                    >
                      <span>{info?.flag ?? "🌐"}</span>
                      <span className="flex-1 text-left">{info?.label ?? code}</span>
                      {summary?.status === "Published" ? (
                        <Badge className="bg-green-100 text-green-700 text-[10px] px-1 py-0">
                          {summary.blocks}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground">
                          {summary ? summary.blocks : "—"}
                        </Badge>
                      )}
                    </button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => translate.mutate()}
                  disabled={translate.isPending}
                >
                  {translate.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                  )}
                  {t("cms.ai_translate_all")}
                </Button>
                <p className="text-[11px] text-muted-foreground pt-1">{t("cms.ai_translate_hint")}</p>
              </CardContent>
            </Card>

            {page.locales.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{t("cms.locale_status")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-xs text-muted-foreground">
                  {page.locales.map((l) => (
                    <div key={l.locale} className="flex justify-between">
                      <span>{LOCALE_LABELS[l.locale]?.label ?? l.locale}</span>
                      <span>{formatDate(l.updated_at)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <MediaPickerDialog
        open={imagePickerOpen}
        onOpenChange={setImagePickerOpen}
        onPick={(url) => {
          setPageMeta({ ...pageMeta, seo_image_url: url });
          setDirty(true);
        }}
      />
    </Layout>
  );
}

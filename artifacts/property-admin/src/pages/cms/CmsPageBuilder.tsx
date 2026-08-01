import { useEffect, useMemo, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Save,
  Languages,
  Loader2,
  Search,
  Sparkles,
  Download,
  ExternalLink,
  Info,
  Lock,
  LayoutTemplate,
  Blocks,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { MediaPickerDialog } from "@/components/MediaLibrary";
import { normaliseBody, type Block } from "@workspace/cms-blocks";
import { BlockCanvas } from "./BlockCanvas";
import { CmsWorkspace } from "./CmsWorkspace";

// The page editor — one screen. Body, SEO, page settings, publish state and the
// language versions all live here rather than behind separate tabs and screens,
// because an editor's question is nearly always "what does this page say and is
// it live", and answering it should not cost three navigations.

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
  internal_note: string | null;
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
  const [pageMeta, setPageMeta] = useState({
    title: "",
    slug: "",
    internal_note: "",
    status: "Draft",
    is_home: false,
    nav_hidden: false,
    seo_image_url: "",
  });
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
      title: page.title ?? "",
      slug: page.slug,
      internal_note: page.internal_note ?? "",
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
        body: JSON.stringify({ ...meta, body_json: { blocks }, ...(status ? { status } : {}), source: "human" }),
      });
      if (!bodyRes.ok) throw new Error("Failed to save the content");
      const pageRes = await apiFetch(`/api/v1/cms/pages/${pageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_key: page?.site_key, ...pageMeta, ...(status ? { status } : {}) }),
      });
      if (!pageRes.ok) throw new Error("Failed to save the page settings");
    },
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["cms-page", pageId] });
      qc.invalidateQueries({ queryKey: ["cms-page-translation", pageId, locale] });
      qc.invalidateQueries({ queryKey: ["cms-pages"] });
      toast({ title: t("cms.saved") });
    },
    onError: (err: Error) => toast({ title: t("cms.save_failed"), description: err.message, variant: "destructive" }),
  });

  /** Switch a page between its built-in rendering and the block tree. */
  const setRenderMode = useMutation({
    mutationFn: async (mode: "legacy" | "blocks") => {
      const res = await apiFetch(`/api/v1/cms/pages/${pageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_key: page?.site_key, render_mode: mode }),
      });
      if (!res.ok) throw new Error("Failed to switch");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cms-page", pageId] }),
  });

  const translate = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/v1/cms/pages/${pageId}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: locale, to: siteLocales.filter((l) => l !== locale) }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Translation failed");
      return res.json();
    },
    onSuccess: (result: { results: { ok: boolean }[] }) => {
      qc.invalidateQueries({ queryKey: ["cms-page", pageId] });
      toast({
        title: t("cms.translated", { count: result.results.filter((r) => r.ok).length }),
        description: t("cms.translated_review_hint"),
      });
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
      <CmsWorkspace>
        <div className="p-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </CmsWorkspace>
    );
  }

  const bareHost = page.site?.host ? page.site.host.replace(/^https?:\/\//, "") : "";
  const previewUrl = bareHost ? `https://${bareHost}/${page.slug}${locale ? `?lang=${locale}` : ""}` : "";
  const isBuiltIn = Boolean(page.legacy_page_key);
  const usesBlocks = page.render_mode === "blocks";

  return (
    <CmsWorkspace>
      <div className="border-b bg-background px-6 py-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate">{pageMeta.title || page.slug || t("cms.untitled")}</h1>
          <p className="text-sm text-muted-foreground truncate">
            {bareHost || page.site?.label}/{page.slug}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/cms/pages")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("common.back")}
          </Button>
          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                {t("cms.open_preview")}
              </Button>
            </a>
          )}
          <Button onClick={() => save.mutate(undefined)} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {t("common.save")}
          </Button>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <div className="flex items-center gap-2 rounded-lg border bg-blue-50/60 px-4 py-3 text-sm text-blue-900">
            <Info className="h-4 w-4 shrink-0" />
            <span>{t("cms.editing_locale_banner", { locale: LOCALE_LABELS[locale]?.label ?? locale })}</span>
            {translation?.source === "machine" && (
              <Badge variant="outline" className="ml-2 border-amber-400 text-amber-700 text-[10px]">
                {t("cms.machine_translated")}
              </Badge>
            )}
            {dirty && <span className="ml-auto text-xs text-amber-700">{t("cms.unsaved_changes")}</span>}
          </div>

          {/* Which rendering this page uses, and how to change it. */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
            <div className="flex items-center gap-3">
              {usesBlocks ? (
                <Blocks className="h-5 w-5 text-primary" />
              ) : (
                <LayoutTemplate className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {usesBlocks ? t("cms.mode_blocks_title") : t("cms.mode_legacy_title")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {usesBlocks ? t("cms.mode_blocks_hint") : t("cms.mode_legacy_hint")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isBuiltIn && (
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
              <Button
                variant={usesBlocks ? "outline" : "default"}
                size="sm"
                onClick={() => setRenderMode.mutate(usesBlocks ? "legacy" : "blocks")}
                disabled={setRenderMode.isPending}
              >
                {usesBlocks ? t("cms.back_to_original") : t("cms.build_from_blocks")}
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("cms.page_settings")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>{t("cms.field_title")}</Label>
                  <Input
                    value={pageMeta.title}
                    onChange={(e) => {
                      setPageMeta({ ...pageMeta, title: e.target.value });
                      setDirty(true);
                    }}
                  />
                </div>
                <div>
                  <Label>{t("cms.field_slug")}</Label>
                  <div className="flex items-center gap-2">
                    {bareHost && <span className="text-xs text-muted-foreground shrink-0">{bareHost}/</span>}
                    <Input
                      value={pageMeta.slug}
                      disabled={isBuiltIn}
                      onChange={(e) => {
                        setPageMeta({ ...pageMeta, slug: e.target.value });
                        setDirty(true);
                      }}
                    />
                  </div>
                  {isBuiltIn && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      {t("cms.builtin_address_locked")}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <Label>{t("cms.internal_note")}</Label>
                <Textarea
                  rows={2}
                  value={pageMeta.internal_note}
                  placeholder={t("cms.internal_note_placeholder")}
                  onChange={(e) => {
                    setPageMeta({ ...pageMeta, internal_note: e.target.value });
                    setDirty(true);
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">{t("cms.internal_note_hint")}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {t("cms.content")}{" "}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  {t("cms.blocks_count", { count: blocks.length })}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" />
                {t("cms.tab_seo")}
                <span className="text-xs font-normal text-muted-foreground">
                  · {LOCALE_LABELS[locale]?.label ?? locale}
                </span>
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
                  rows={2}
                  value={meta.seo_description}
                  onChange={(e) => {
                    setMeta({ ...meta, seo_description: e.target.value });
                    setDirty(true);
                  }}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
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
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right rail — publish state and the language versions */}
        <div className="space-y-4 xl:sticky xl:top-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t("cms.publish")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" onClick={() => save.mutate(undefined)} disabled={save.isPending}>
                {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {t("common.save")}
              </Button>
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
                    <SelectItem value="Draft">{t("cms.status_draft")}</SelectItem>
                    <SelectItem value="Published">{t("cms.status_published")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label className="text-sm">{t("cms.in_menu")}</Label>
                <Switch
                  checked={!pageMeta.nav_hidden}
                  onCheckedChange={(v) => {
                    setPageMeta({ ...pageMeta, nav_hidden: !v });
                    setDirty(true);
                  }}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label className="text-sm">{t("cms.is_home")}</Label>
                <Switch
                  checked={pageMeta.is_home}
                  onCheckedChange={(v) => {
                    setPageMeta({ ...pageMeta, is_home: v });
                    setDirty(true);
                  }}
                />
              </div>
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
                const editing = locale === code;
                return (
                  <button
                    key={code}
                    onClick={() => setLocale(code)}
                    className={`w-full flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors ${
                      editing ? "border-primary bg-primary/5 text-primary" : "border-transparent hover:bg-muted"
                    }`}
                  >
                    <span>{info?.flag ?? "🌐"}</span>
                    <span className="flex-1 text-left">{info?.label ?? code}</span>
                    {editing ? (
                      <Badge className="bg-primary/10 text-primary text-[10px] px-1.5 py-0">{t("cms.editing")}</Badge>
                    ) : summary?.status === "Published" ? (
                      <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0">{summary.blocks}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
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
    </CmsWorkspace>
  );
}

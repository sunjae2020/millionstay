import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Sparkles, Info } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { normaliseBody, type Block } from "@workspace/cms-blocks";
import { BlockCanvas } from "./BlockCanvas";
import { useCmsSites } from "./useCmsSites";

// Block body editor for a blog post — the same canvas the page builder uses, so
// a post is composed section by section instead of as one HTML blob. Bodies are
// stored per locale in cms_post_translations, exactly like pages.

const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  ko: "한국어",
  ja: "日本語",
  zh: "中文",
  th: "ไทย",
  vi: "Tiếng Việt",
};

export function PostBlockEditor({ postId, siteKey }: { postId: string; siteKey: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { sites } = useCmsSites();
  const site = sites.find((s) => s.site_key === siteKey);
  const locales = site?.locales ?? ["en"];
  const baseLocale = site?.default_locale ?? "en";

  const [locale, setLocale] = useState(baseLocale);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => setLocale(baseLocale), [baseLocale]);

  const { data: translation, isFetching } = useQuery({
    queryKey: ["cms-post-translation", postId, locale],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/cms/posts/${postId}/translations/${locale}`);
      if (!res.ok) throw new Error("Failed to load body");
      return res.json();
    },
    enabled: Boolean(postId) && postId !== "new",
  });

  useEffect(() => {
    if (!translation) return;
    setBlocks(normaliseBody(translation.body_json).blocks);
    setDirty(false);
  }, [translation]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/v1/cms/posts/${postId}/translations/${locale}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body_json: { blocks }, status: "Published", source: "human" }),
      });
      if (!res.ok) throw new Error("Save failed");
    },
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["cms-post-translation", postId, locale] });
      toast({ title: t("cms.saved") });
    },
    onError: (err: Error) => toast({ title: t("cms.save_failed"), description: err.message, variant: "destructive" }),
  });

  const translate = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/v1/cms/posts/${postId}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: locale, to: locales.filter((l) => l !== locale) }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Translation failed");
      return res.json();
    },
    onSuccess: (result: { results: { ok: boolean }[] }) => {
      toast({
        title: t("cms.translated", { count: result.results.filter((r) => r.ok).length }),
        description: t("cms.translated_review_hint"),
      });
    },
    onError: (err: Error) => toast({ title: t("cms.translate_failed"), description: err.message, variant: "destructive" }),
  });

  if (postId === "new") {
    return (
      <div className="flex items-start gap-2 rounded-lg border bg-blue-50/60 px-4 py-3 text-sm text-blue-900">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>{t("cms.post_save_first")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border bg-muted/30 p-1">
          {locales.map((code) => (
            <button
              key={code}
              onClick={() => setLocale(code)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                locale === code ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {LOCALE_LABELS[code] ?? code}
            </button>
          ))}
        </div>
        {dirty && <Badge variant="outline" className="text-amber-700 border-amber-400">{t("cms.unsaved_changes")}</Badge>}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => translate.mutate()} disabled={translate.isPending}>
            {translate.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
            {t("cms.ai_translate_all")}
          </Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            {t("cms.save_body")}
          </Button>
        </div>
      </div>

      {isFetching ? (
        <div className="p-10 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <BlockCanvas
          blocks={blocks}
          siteKey={siteKey}
          onChange={(next) => {
            setBlocks(next);
            setDirty(true);
          }}
        />
      )}
    </div>
  );
}

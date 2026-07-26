import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Languages, Save, Sparkles } from "lucide-react";

type Lang = { code: string; english_name?: string; name?: string; enabled?: boolean; is_default?: boolean };
type LoadResp = { fields: string[]; source: Record<string, string>; translations: Record<string, Record<string, string>> };

// Fields that render as multi-line text areas rather than single-line inputs.
const MULTILINE = new Set(["description"]);

async function fetchLanguages(): Promise<Lang[]> {
  const res = await apiFetch("/api/v1/translations/languages");
  if (!res.ok) throw new Error("Failed to load languages");
  return (await res.json()).data ?? [];
}

/**
 * Admin panel to translate a guest-facing record's content (spaces / properties /
 * space-options). The original is authored in the base columns (Korean for the
 * Metheim tenant); here the admin generates AI drafts per language and reviews
 * them before saving. Public reads resolve one language with [lang → ko → en →
 * original] fallback, so untranslated records still show the original.
 */
export function ContentTranslationsPanel({
  entity,
  id,
  sourceLang = "ko",
}: {
  entity: "spaces" | "properties" | "space-options";
  id: number;
  sourceLang?: string;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const langsQ = useQuery({ queryKey: ["tr-languages"], queryFn: fetchLanguages });
  const dataQ = useQuery({
    queryKey: ["content-tr", entity, id],
    queryFn: async (): Promise<LoadResp> => {
      const res = await apiFetch(`/api/v1/content-translations/${entity}/${id}`);
      if (!res.ok) throw new Error("Failed to load translations");
      return (await res.json()).data;
    },
  });

  const fields = dataQ.data?.fields ?? [];
  const source = dataQ.data?.source ?? {};
  const [copies, setCopies] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);

  // Seed local edit state from the loaded row once it arrives.
  useEffect(() => {
    if (dataQ.data) setCopies(dataQ.data.translations ?? {});
  }, [dataQ.data]);

  // Target languages = enabled languages except the source language.
  const targetLangs = useMemo(
    () => (langsQ.data ?? []).filter((l) => l.enabled !== false && l.code.split("-")[0].toLowerCase() !== sourceLang),
    [langsQ.data, sourceLang],
  );

  const langLabel = (l: Lang) => l.english_name || l.name || l.code.toUpperCase();
  const fieldLabel = (f: string) => t(`content_translations.field_${f}`, { defaultValue: f });

  const setField = (lang: string, field: string, val: string) =>
    setCopies((prev) => ({
      ...prev,
      [lang]: { ...(prev[lang] ?? {}), [field]: val, _source: "human" },
    }));

  const handleAiTranslate = async () => {
    setAiRunning(true);
    try {
      const res = await apiFetch(`/api/v1/content-translations/${entity}/${id}/ai-translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceLang, overwrite: false }),
      });
      const json = await res.json();
      if (!res.ok || (json.error && !json.success && !json.data)) {
        const msg = json.error?.message ?? json.error ?? t("content_translations.ai_failed");
        throw new Error(typeof msg === "string" ? msg : t("content_translations.ai_failed"));
      }
      if (json.data?.translations) setCopies(json.data.translations);
      toast({ title: t("content_translations.ai_done") });
      dataQ.refetch();
    } catch (e) {
      toast({ title: t("content_translations.ai_failed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setAiRunning(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/v1/content-translations/${entity}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ translations: copies }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
      toast({ title: t("content_translations.saved") });
      dataQ.refetch();
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (dataQ.isLoading || langsQ.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="rounded-lg bg-muted/40 border p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-muted-foreground" />
            <div>
              <h3 className="font-semibold text-sm">{t("content_translations.title")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{t("content_translations.desc")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleAiTranslate} disabled={aiRunning || saving}>
              <Sparkles className={`h-3.5 w-3.5 ${aiRunning ? "animate-pulse" : ""}`} />
              {aiRunning ? t("content_translations.ai_running") : t("content_translations.ai_button")}
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving || aiRunning}>
              <Save className="h-3.5 w-3.5" />
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </div>
      </div>

      {/* Source (authored original) — read-only reference */}
      <div className="rounded-lg border p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
          {t("content_translations.source_label", { lang: sourceLang.toUpperCase() })}
        </p>
        <div className="space-y-2">
          {fields.map((f) => (
            <div key={f} className="text-sm">
              <span className="text-muted-foreground">{fieldLabel(f)}: </span>
              <span className="whitespace-pre-wrap">{source[f] || <span className="text-muted-foreground/60">—</span>}</span>
            </div>
          ))}
        </div>
      </div>

      {targetLangs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("content_translations.no_targets")}</p>
      ) : (
        <Tabs defaultValue={targetLangs[0].code}>
          <TabsList className="flex flex-wrap gap-1 h-auto mb-4">
            {targetLangs.map((l) => {
              const hasData = fields.some((f) => (copies[l.code]?.[f] ?? "").trim() !== "");
              return (
                <TabsTrigger key={l.code} value={l.code} className="gap-1.5 relative">
                  <span>{langLabel(l)}</span>
                  {hasData && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500" />}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {targetLangs.map((l) => (
            <TabsContent key={l.code} value={l.code}>
              <div className="rounded-lg border p-4 space-y-3">
                {fields.map((f) => (
                  <div key={f} className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{fieldLabel(f)}</Label>
                    {MULTILINE.has(f) ? (
                      <Textarea
                        rows={4}
                        value={copies[l.code]?.[f] ?? ""}
                        placeholder={source[f] || ""}
                        onChange={(e) => setField(l.code, f, e.target.value)}
                      />
                    ) : (
                      <Input
                        value={copies[l.code]?.[f] ?? ""}
                        placeholder={source[f] || ""}
                        onChange={(e) => setField(l.code, f, e.target.value)}
                      />
                    )}
                  </div>
                ))}
                {copies[l.code]?._source === "machine" && (
                  <p className="text-xs text-amber-600">{t("content_translations.machine_hint")}</p>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

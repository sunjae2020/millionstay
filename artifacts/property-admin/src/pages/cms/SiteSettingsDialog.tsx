import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Save } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import type { CmsSite } from "./useCmsSites";

// Site settings — the tenant's own name and public address per site, plus which
// sites this instance actually runs. These are deliberately editable data
// rather than build-time constants: one codebase serves several tenants, so a
// hardcoded brand or domain would be wrong on every instance but one.

const ALL_LOCALES = ["en", "ko", "ja", "zh", "th", "vi"] as const;

export function SiteSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Partial<CmsSite>>>({});

  const { data: sites = [], isLoading } = useQuery<CmsSite[]>({
    queryKey: ["cms-sites", true],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/cms/sites?all=1");
      if (!res.ok) throw new Error("Failed to load sites");
      const rows = await res.json();
      return rows.map((row: CmsSite) => ({
        ...row,
        locales: Array.isArray(row.locales) ? row.locales : ["en"],
      }));
    },
    enabled: open,
  });

  useEffect(() => {
    if (sites.length) setDrafts(Object.fromEntries(sites.map((s) => [s.site_key, { ...s }])));
  }, [sites]);

  const save = useMutation({
    mutationFn: async () => {
      for (const site of sites) {
        const draft = drafts[site.site_key];
        if (!draft) continue;
        const res = await apiFetch(`/api/v1/cms/sites/${site.site_key}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: draft.label,
            host: draft.host || null,
            locales: draft.locales,
            default_locale: draft.default_locale,
            is_active: draft.is_active,
          }),
        });
        if (!res.ok) throw new Error(`${site.site_key}: save failed`);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cms-sites"] });
      toast({ title: t("cms.saved") });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ title: t("cms.save_failed"), description: err.message, variant: "destructive" }),
  });

  function patch(key: string, value: Partial<CmsSite>) {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...value } }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("cms.site_settings")}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">{t("cms.site_settings_hint")}</p>

        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {sites.map((site) => {
              const draft = drafts[site.site_key] ?? site;
              return (
                <div key={site.site_key} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {site.site_key}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">{t("cms.site_active")}</Label>
                      <Switch
                        checked={Boolean(draft.is_active)}
                        onCheckedChange={(v) => patch(site.site_key, { is_active: v })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">{t("cms.site_label")}</Label>
                      <Input
                        value={draft.label ?? ""}
                        placeholder={t("cms.site_label_placeholder")}
                        onChange={(e) => patch(site.site_key, { label: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">{t("cms.site_host")}</Label>
                      <Input
                        value={draft.host ?? ""}
                        placeholder="https://example.com"
                        onChange={(e) => patch(site.site_key, { host: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">{t("cms.site_locales")}</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {ALL_LOCALES.map((code) => {
                        const on = (draft.locales ?? []).includes(code);
                        return (
                          <button
                            key={code}
                            onClick={() =>
                              patch(site.site_key, {
                                locales: on
                                  ? (draft.locales ?? []).filter((l) => l !== code)
                                  : [...(draft.locales ?? []), code],
                              })
                            }
                            className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                              on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {code}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {t("cms.site_default_locale")}: {draft.default_locale}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

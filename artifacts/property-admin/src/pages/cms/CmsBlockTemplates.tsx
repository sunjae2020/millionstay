import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LayoutTemplate, Save, Trash2, Info, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { BLOCK_SPEC_LIST } from "@workspace/cms-blocks";
import { useCmsSites } from "./useCmsSites";
import { SiteSwitcher } from "./CmsPagesList";

// UI Blocks management. The block TYPES themselves are code (they need a
// renderer), but each site can override a block's name, description and seed
// content — that is what this screen edits.

interface BlockTemplate {
  id: number;
  type: string;
  site_key: string | null;
  name: string;
  description: string | null;
  category: string;
  default_props: Record<string, unknown>;
  is_active: boolean;
}

export default function CmsBlockTemplates() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { sites, siteKey, setSiteKey } = useCmsSites();
  const [editing, setEditing] = useState<{ type: string; template: BlockTemplate | null } | null>(null);
  const [draft, setDraft] = useState({ name: "", description: "", defaultProps: "{}" });

  const { data: templates = [], isLoading } = useQuery<BlockTemplate[]>({
    queryKey: ["cms-block-templates"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/cms/block-templates");
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json();
    },
  });

  const overrideFor = useMemo(() => {
    const map = new Map<string, BlockTemplate>();
    for (const template of templates) {
      if (template.site_key === siteKey) map.set(template.type, template);
    }
    return map;
  }, [templates, siteKey]);

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      let parsedProps: Record<string, unknown> = {};
      try {
        parsedProps = JSON.parse(draft.defaultProps || "{}");
      } catch {
        throw new Error(t("cms.invalid_json"));
      }
      const spec = BLOCK_SPEC_LIST.find((s) => s.type === editing.type);
      const payload = {
        type: editing.type,
        site_key: siteKey,
        name: draft.name || spec?.name || editing.type,
        description: draft.description,
        category: spec?.category ?? "Content",
        default_props: parsedProps,
      };
      const res = editing.template
        ? await apiFetch(`/api/v1/cms/block-templates/${editing.template.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await apiFetch("/api/v1/cms/block-templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) throw new Error("Save failed");
    },
    onSuccess: () => {
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["cms-block-templates"] });
      qc.invalidateQueries({ queryKey: ["cms-block-catalog"] });
      toast({ title: t("cms.saved") });
    },
    onError: (err: Error) => toast({ title: t("cms.save_failed"), description: err.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/v1/cms/block-templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cms-block-templates"] });
      qc.invalidateQueries({ queryKey: ["cms-block-catalog"] });
      toast({ title: t("cms.preset_removed") });
    },
  });

  return (
    <Layout>
      <PageHeader
        title={
          <>
            <LayoutTemplate className="h-5 w-5" />
            {t("cms.blocks_title")}
          </>
        }
        subtitle={t("cms.blocks_subtitle")}
      />

      <div className="p-6">
        <SiteSwitcher sites={sites} value={siteKey} onChange={setSiteKey} />

        <div className="mb-4 flex items-start gap-2 rounded-lg border bg-blue-50/60 px-4 py-3 text-sm text-blue-900">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{t("cms.blocks_notice")}</span>
        </div>

        {isLoading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {BLOCK_SPEC_LIST.map((spec) => {
              const override = overrideFor.get(spec.type);
              return (
                <Card key={spec.type} className={override ? "border-primary/40" : ""}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-sm">{override?.name ?? spec.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal">
                        {spec.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {override?.description ?? spec.description}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing({ type: spec.type, template: override ?? null });
                          setDraft({
                            name: override?.name ?? spec.name,
                            description: override?.description ?? spec.description,
                            defaultProps: JSON.stringify(override?.default_props ?? spec.defaultProps, null, 2),
                          });
                        }}
                      >
                        {override ? t("cms.edit_preset") : t("cms.create_preset")}
                      </Button>
                      {override && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => remove.mutate(override.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.type}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("cms.preset_name")}</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <Label>{t("cms.preset_description")}</Label>
              <Textarea
                rows={2}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("cms.preset_default_props")}</Label>
              <Textarea
                rows={10}
                className="font-mono text-xs"
                value={draft.defaultProps}
                onChange={(e) => setDraft({ ...draft, defaultProps: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">{t("cms.preset_props_hint")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

/**
 * 설정 → 점검표 양식 — which rows the 세대점검표 carries at all.
 *
 * Untick a row here and it disappears from every checklist created afterwards,
 * from the tenant's view and from both PDFs (blank and filled). This is the
 * building-wide decision ("our units have no 월패드"); a single unit's exception
 * is toggled on its own checklist instead.
 *
 * Existing checklists are intentionally left alone — one may already be signed,
 * and a signed record must not change under anyone's feet.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ClipboardList, Loader2, RotateCcw, Save } from "lucide-react";
import { apiJson } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";

interface TemplateGroup {
  key: string;
  label: string;
  items: Array<{ code: string; label: string }>;
}

interface Template {
  key: string;
  name: string;
  heading: string;
  itemCount: number;
  groups: TemplateGroup[];
}

export default function InspectionTemplatePage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["inspection-templates"],
    queryFn: async () => (await apiJson<{ data: Template[] }>("/api/v1/inspection-templates")).data,
  });
  const template = templates?.[0];

  const { data: prefs } = useQuery({
    queryKey: ["inspection-template-prefs", template?.key],
    queryFn: async () =>
      (await apiJson<{ data: { hidden: string[] } }>(`/api/v1/inspection-templates/${template!.key}/prefs`)).data,
    enabled: !!template?.key,
  });

  useEffect(() => {
    if (prefs) { setHidden(new Set(prefs.hidden)); setDirty(false); }
  }, [prefs]);

  const save = useMutation({
    mutationFn: async () =>
      apiJson(`/api/v1/inspection-templates/${template!.key}/prefs`, {
        method: "PUT",
        body: JSON.stringify({ hidden: [...hidden] }),
      }),
    onSuccess: () => { setDirty(false); toast({ title: t("inspection_template.saved") }); },
    onError: (e: any) => toast({ title: t("inspection_template.save_failed"), description: e?.message, variant: "destructive" }),
  });

  function toggle(code: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
    setDirty(true);
  }

  function toggleGroup(group: TemplateGroup, on: boolean) {
    setHidden((prev) => {
      const next = new Set(prev);
      for (const item of group.items) {
        if (on) next.delete(item.code); else next.add(item.code);
      }
      return next;
    });
    setDirty(true);
  }

  const activeCount = useMemo(
    () => (template ? template.itemCount - [...hidden].filter((c) => template.groups.some((g) => g.items.some((i) => i.code === c))).length : 0),
    [template, hidden],
  );

  return (
    <Layout>
      <PageHeader
        title={t("inspection_template.title")}
        subtitle={t("inspection_template.description")}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-10 space-y-4">
        {isLoading && (
          <div className="rounded-lg border bg-white py-16 text-center">
            <Loader2 className="w-5 h-5 animate-spin inline text-muted-foreground" />
          </div>
        )}

        {template && (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border bg-white px-4 py-3">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-muted-foreground" />
                  {template.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("inspection_template.active_count", { active: activeCount, total: template.itemCount })}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm" variant="ghost" disabled={!hidden.size}
                  onClick={() => { setHidden(new Set()); setDirty(true); }}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />{t("inspection_template.reset")}
                </Button>
                <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
                  <Save className="w-3.5 h-3.5 mr-1" />{t("common.save")}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">{t("inspection_template.note")}</p>

            {template.groups.map((group) => {
              const on = group.items.filter((i) => !hidden.has(i.code)).length;
              return (
                <div key={group.key} className="rounded-lg border bg-white overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gray-50">
                    <span className="text-sm font-medium">{group.label}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {on}/{group.items.length}
                      <button className="underline hover:text-foreground" onClick={() => toggleGroup(group, on < group.items.length)}>
                        {on < group.items.length ? t("inspection_template.select_all") : t("inspection_template.clear_all")}
                      </button>
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 p-4">
                    {group.items.map((item) => (
                      <label key={item.code} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!hidden.has(item.code)}
                          onChange={() => toggle(item.code)}
                          className="h-4 w-4"
                        />
                        <span className={hidden.has(item.code) ? "text-muted-foreground line-through" : ""}>
                          {item.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </Layout>
  );
}

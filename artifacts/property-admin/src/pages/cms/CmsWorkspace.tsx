import { useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { CmsContentTree } from "./CmsContentTree";
import { useCmsSites } from "./useCmsSites";

// The CMS workspace: the content tree stays put on the left while the pane on
// the right changes with the route. Every CMS screen renders through here, so
// moving between a page, the blog and its categories never loses the tree —
// which is the point of having one.

export function CmsWorkspace({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const { sites } = useCmsSites();

  const [createFor, setCreateFor] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", slug: "" });

  const createPage = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/v1/cms/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_key: createFor,
          title: draft.title,
          slug: draft.slug || draft.title,
          render_mode: "blocks",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create page");
      return res.json();
    },
    onSuccess: (page: { id: number }) => {
      setCreateFor(null);
      setDraft({ title: "", slug: "" });
      qc.invalidateQueries({ queryKey: ["cms-pages"] });
      navigate(`/cms/pages/${page.id}`);
    },
    onError: (err: Error) =>
      toast({ title: t("cms.create_failed"), description: err.message, variant: "destructive" }),
  });

  return (
    <Layout>
      <div className="flex">
        <CmsContentTree onCreatePage={(siteKey) => setCreateFor(siteKey || sites[0]?.site_key || "")} />
        <div className="flex-1 min-w-0">{children}</div>
      </div>

      <Dialog open={createFor !== null} onOpenChange={(open) => !open && setCreateFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("cms.new_page")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("cms.field_site")}</Label>
              <Select value={createFor ?? ""} onValueChange={setCreateFor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.site_key} value={site.site_key}>
                      {site.label || site.site_key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("cms.field_title")}</Label>
              <Input
                autoFocus
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder={t("cms.field_title_placeholder")}
              />
            </div>
            <div>
              <Label>{t("cms.field_slug")}</Label>
              <Input
                value={draft.slug}
                onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                placeholder="about-us"
              />
              <p className="text-xs text-muted-foreground mt-1">{t("cms.field_slug_hint")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFor(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => createPage.mutate()} disabled={!draft.title || createPage.isPending}>
              {t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

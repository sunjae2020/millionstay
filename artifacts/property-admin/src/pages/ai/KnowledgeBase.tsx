import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDateTime } from "@/lib/date";
import { Layout, PageHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { apiJson, apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Plus, Pencil, Trash2, FileText, Upload, Archive, RotateCcw } from "lucide-react";

interface KnowledgeDoc {
  id: string;
  title: string;
  source_type: string;
  language: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

const ACCENT = "hsl(var(--primary))";

export default function KnowledgeBase() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<KnowledgeDoc | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["knowledge"],
    queryFn: () => apiJson<{ success: boolean; data: KnowledgeDoc[] }>("/api/v1/knowledge"),
  });
  const docs = data?.data ?? [];

  const del = useMutation({
    mutationFn: (id: string) => apiJson(`/api/v1/knowledge/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["knowledge"] }); toast({ title: t("ai.kb.deleted_toast") }); },
    onError: (e: any) => toast({ title: t("ai.kb.delete_failed"), description: e?.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: (doc: KnowledgeDoc) =>
      apiJson(`/api/v1/knowledge/${doc.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: doc.status === "active" ? "archived" : "active" }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge"] }),
    onError: (e: any) => toast({ title: t("ai.kb.update_failed"), description: e?.message, variant: "destructive" }),
  });

  return (
    <Layout>
      <PageHeader
        title={t("ai.kb.title")}
        subtitle={t("ai.kb.subtitle")}
        actions={
          <Button onClick={() => setCreating(true)} style={{ backgroundColor: ACCENT }} className="text-white">
            <Plus className="mr-1.5 h-4 w-4" /> {t("ai.kb.add")}
          </Button>
        }
      />

      <div className="p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("ai.kb.loading")}</p>
        ) : docs.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-10 text-center">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("ai.kb.empty")}</p>
            <Button onClick={() => setCreating(true)} style={{ backgroundColor: ACCENT }} className="text-white">
              <Plus className="mr-1.5 h-4 w-4" /> {t("ai.kb.add_first")}
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {docs.map((d) => (
              <Card key={d.id} className="flex items-center gap-4 p-4">
                <div className="rounded-lg p-2" style={{ backgroundColor: `color-mix(in srgb, hsl(var(--primary)) 10%, transparent)` }}>
                  <FileText className="h-5 w-5" style={{ color: ACCENT }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{d.title}</span>
                    <Badge variant="outline" className="text-xs">{d.source_type}</Badge>
                    {d.language && <Badge variant="outline" className="text-xs">{d.language}</Badge>}
                    <Badge variant={d.status === "active" ? "default" : "secondary"} className="text-xs">{d.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("ai.kb.updated", { date: formatDateTime(d.updated_at) })}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => toggleStatus.mutate(d)} title={d.status === "active" ? t("ai.kb.archive") : t("ai.kb.reactivate")}>
                    {d.status === "active" ? <Archive className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(d)} title={t("ai.kb.edit")}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => { if (confirm(t("ai.kb.confirm_delete", { title: d.title }))) del.mutate(d.id); }}
                    title={t("ai.kb.delete")}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {creating && <DocEditor onClose={() => setCreating(false)} />}
      {editing && <DocEditor doc={editing} onClose={() => setEditing(null)} />}
    </Layout>
  );
}

/** Create/edit modal. When `doc` is provided it loads full content for editing. */
function DocEditor({ doc, onClose }: { doc?: KnowledgeDoc; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = Boolean(doc);

  const [title, setTitle] = useState(doc?.title ?? "");
  const [language, setLanguage] = useState(doc?.language ?? "");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loadedContent, setLoadedContent] = useState(!isEdit);

  // Lazy-load the full content for editing.
  useQuery({
    queryKey: ["knowledge", doc?.id, "full"],
    enabled: isEdit && !loadedContent,
    queryFn: async () => {
      const res = await apiJson<{ success: boolean; data: { content_text: string } }>(`/api/v1/knowledge/${doc!.id}`);
      setContent(res.data.content_text ?? "");
      setLoadedContent(true);
      return res;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        return apiJson(`/api/v1/knowledge/${doc!.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title, language: language || null, content_text: content }),
        });
      }
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        if (title) fd.append("title", title);
        if (language) fd.append("language", language);
        if (content) fd.append("content_text", content);
        const res = await apiFetch("/api/v1/knowledge", { method: "POST", body: fd });
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Upload failed");
        return res.json();
      }
      return apiJson("/api/v1/knowledge", {
        method: "POST",
        body: JSON.stringify({ title, language: language || null, content_text: content }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge"] });
      toast({ title: isEdit ? t("ai.kb.updated_toast") : t("ai.kb.added_toast") });
      onClose();
    },
    onError: (e: any) => toast({ title: t("ai.kb.save_failed"), description: e?.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("ai.kb.edit_title") : t("ai.kb.add_title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("ai.kb.field_title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("ai.kb.title_placeholder")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("ai.kb.language")}</Label>
            <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder={t("ai.kb.language_placeholder")} className="max-w-[160px]" />
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Upload className="h-4 w-4" /> {t("ai.kb.upload_label")}</Label>
              <Input type="file" accept=".pdf,.txt,.md,.csv,text/plain,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <p className="text-xs text-muted-foreground">{t("ai.kb.upload_help")}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t("ai.kb.content")} {file ? t("ai.kb.content_file_hint") : ""}</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              placeholder={t("ai.kb.content_placeholder")}
              disabled={isEdit && !loadedContent}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("ai.kb.cancel")}</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || (!title && !file) || (!content && !file)}
            style={{ backgroundColor: ACCENT }}
            className="text-white"
          >
            {save.isPending ? t("ai.kb.saving") : isEdit ? t("ai.kb.save_changes") : t("ai.kb.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

const ACCENT = "#E8621A";

export default function KnowledgeBase() {
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["knowledge"] }); toast({ title: "Document deleted" }); },
    onError: (e: any) => toast({ title: "Delete failed", description: e?.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: (doc: KnowledgeDoc) =>
      apiJson(`/api/v1/knowledge/${doc.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: doc.status === "active" ? "archived" : "active" }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge"] }),
    onError: (e: any) => toast({ title: "Update failed", description: e?.message, variant: "destructive" }),
  });

  return (
    <Layout>
      <PageHeader
        title="AI Knowledge Base"
        subtitle="Documents the AI chat assistant uses to answer visitor questions (FAQ, policies, info)."
        actions={
          <Button onClick={() => setCreating(true)} style={{ backgroundColor: ACCENT }} className="text-white">
            <Plus className="mr-1.5 h-4 w-4" /> Add document
          </Button>
        }
      />

      <div className="p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : docs.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-10 text-center">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No knowledge documents yet. Add FAQ or policy content so the assistant can answer accurately.</p>
            <Button onClick={() => setCreating(true)} style={{ backgroundColor: ACCENT }} className="text-white">
              <Plus className="mr-1.5 h-4 w-4" /> Add your first document
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {docs.map((d) => (
              <Card key={d.id} className="flex items-center gap-4 p-4">
                <div className="rounded-lg p-2" style={{ backgroundColor: `${ACCENT}1a` }}>
                  <FileText className="h-5 w-5" style={{ color: ACCENT }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{d.title}</span>
                    <Badge variant="outline" className="text-xs">{d.source_type}</Badge>
                    {d.language && <Badge variant="outline" className="text-xs">{d.language}</Badge>}
                    <Badge variant={d.status === "active" ? "default" : "secondary"} className="text-xs">{d.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Updated {new Date(d.updated_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => toggleStatus.mutate(d)} title={d.status === "active" ? "Archive" : "Re-activate"}>
                    {d.status === "active" ? <Archive className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(d)} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => { if (confirm(`Delete "${d.title}"?`)) del.mutate(d.id); }}
                    title="Delete"
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
      toast({ title: isEdit ? "Document updated" : "Document added" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Save failed", description: e?.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit document" : "Add knowledge document"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Refund & cancellation policy" />
          </div>
          <div className="space-y-1.5">
            <Label>Language (optional)</Label>
            <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="e.g. en, ko, zh" className="max-w-[160px]" />
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Upload className="h-4 w-4" /> Upload a file (PDF / TXT / MD) — optional</Label>
              <Input type="file" accept=".pdf,.txt,.md,.csv,text/plain,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <p className="text-xs text-muted-foreground">Text is extracted from the file. Or paste content directly below.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Content {file ? "(leave empty to use the file's text)" : ""}</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              placeholder="Paste the FAQ / policy / info text the assistant should use…"
              disabled={isEdit && !loadedContent}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || (!title && !file) || (!content && !file)}
            style={{ backgroundColor: ACCENT }}
            className="text-white"
          >
            {save.isPending ? "Saving…" : isEdit ? "Save changes" : "Add document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

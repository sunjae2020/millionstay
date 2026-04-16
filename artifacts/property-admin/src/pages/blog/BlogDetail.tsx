import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Save, Trash2, Globe, FileText, Search, Image, Eye, EyeOff,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Heading2, Heading3, Link as LinkIcon, Undo, Redo, Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";

const STATUS_OPTIONS = ["Draft", "Published", "Archived"];
const CATEGORY_OPTIONS = ["Tips & Guides", "Student Life", "Melbourne", "Housing", "News", "Lifestyle"];

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, []);

  const exec = (command: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const insertLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) exec("createLink", url);
  };

  const insertImage = () => {
    const url = window.prompt("Enter image URL:");
    if (url) exec("insertImage", url);
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b bg-muted/30">
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("bold")} title="Bold">
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("italic")} title="Italic">
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("underline")} title="Underline">
          <Underline className="h-3.5 w-3.5" />
        </Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("formatBlock", "h2")} title="Heading 2">
          <Heading2 className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("formatBlock", "h3")} title="Heading 3">
          <Heading3 className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("formatBlock", "p")} title="Paragraph">
          <AlignLeft className="h-3.5 w-3.5" />
        </Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("justifyLeft")} title="Align Left">
          <AlignLeft className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("justifyCenter")} title="Align Center">
          <AlignCenter className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("justifyRight")} title="Align Right">
          <AlignRight className="h-3.5 w-3.5" />
        </Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("insertUnorderedList")} title="Bullet List">
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("insertOrderedList")} title="Numbered List">
          <ListOrdered className="h-3.5 w-3.5" />
        </Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={insertLink} title="Insert Link">
          <LinkIcon className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={insertImage} title="Insert Image">
          <Image className="h-3.5 w-3.5" />
        </Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("undo")} title="Undo">
          <Undo className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("redo")} title="Redo">
          <Redo className="h-3.5 w-3.5" />
        </Button>
        <div className="ml-auto">
          <Button type="button" size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => setPreview(!preview)}>
            {preview ? <><EyeOff className="h-3.5 w-3.5" />Edit</> : <><Eye className="h-3.5 w-3.5" />Preview</>}
          </Button>
        </div>
      </div>
      {preview ? (
        <div
          className="min-h-[320px] p-4 prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: value || "<p class='text-muted-foreground italic'>No content yet</p>" }}
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="min-h-[320px] p-4 text-sm focus:outline-none [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-2 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-[#E8621A] [&_a]:underline [&_img]:max-w-full [&_img]:rounded"
          onInput={() => { if (editorRef.current) onChange(editorRef.current.innerHTML); }}
        />
      )}
    </div>
  );
}

function SeoPreview({ title, description, slug }: { title: string; description: string; slug: string }) {
  const url = `millionstay.com.au/blog/${slug}`;
  return (
    <div className="border rounded-lg p-4 bg-white">
      <p className="text-xs text-muted-foreground mb-2">Search Engine Preview</p>
      <div className="text-green-700 text-xs mb-0.5">{url}</div>
      <div className="text-[#1a0dab] text-base hover:underline cursor-pointer line-clamp-1">
        {title || "Page Title"}
      </div>
      <div className="text-sm text-muted-foreground line-clamp-2">
        {description || "Page description will appear here…"}
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  title: "", slug: "", excerpt: "", content: "", cover_image_url: "",
  category: "", author: "", status: "Draft", published_at: "",
  seo_title: "", seo_description: "", seo_keywords: "",
};

export default function BlogDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !params.id || params.id === "new";
  const [isSaving, setIsSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const { data: post, isLoading } = useQuery({
    queryKey: ["blog-post", params.id],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/blog-posts/${params.id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !isNew,
  });

  useEffect(() => {
    if (post) {
      setForm({
        title: post.title ?? "",
        slug: post.slug ?? "",
        excerpt: post.excerpt ?? "",
        content: post.content ?? "",
        cover_image_url: post.cover_image_url ?? "",
        category: post.category ?? "",
        author: post.author ?? "",
        status: post.status ?? "Draft",
        published_at: post.published_at ? new Date(post.published_at).toISOString().slice(0, 16) : "",
        seo_title: post.seo_title ?? "",
        seo_description: post.seo_description ?? "",
        seo_keywords: post.seo_keywords ?? "",
      });
      setSlugManuallyEdited(true);
    }
  }, [post]);

  const set = useCallback((key: string, val: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: val };
      if (key === "title" && !slugManuallyEdited) {
        next.slug = slugify(val);
      }
      return next;
    });
  }, [slugManuallyEdited]);

  const handleSave = async () => {
    if (!form.title.trim() || !form.slug.trim()) {
      toast({ title: "Title and Slug are required", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        ...form,
        published_at: form.published_at || null,
        seo_title: form.seo_title || null,
        seo_description: form.seo_description || null,
        seo_keywords: form.seo_keywords || null,
      };
      const res = await apiFetch(isNew ? "/api/v1/blog-posts" : `/api/v1/blog-posts/${params.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      qc.invalidateQueries({ queryKey: ["blog-posts"] });
      toast({ title: isNew ? "Blog post created" : "Blog post updated" });
      if (isNew) navigate(`/content/blog/${data.id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await apiFetch(`/api/v1/blog-posts/${params.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      qc.invalidateQueries({ queryKey: ["blog-posts"] });
      toast({ title: "Blog post archived" });
      navigate("/content/blog");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setDeleteOpen(false);
  };

  if (!isNew && isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate("/content/blog")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <FileText className="h-5 w-5" />
            {isNew ? "New Blog Post" : form.title || "Edit Post"}
          </div>
        }
        subtitle={!isNew && post ? (
          <div className="flex items-center gap-2">
            <Badge className={`text-[10px] ${post.status === "Published" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
              {form.status}
            </Badge>
            <span className="text-xs text-muted-foreground">/{form.slug}</span>
          </div>
        ) : ""}
        actions={
          <div className="flex items-center gap-2">
            {!isNew && (
              <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5 gap-1.5" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Archive
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1.5">
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        }
      />

      <div className="p-6">
        <Tabs defaultValue="content" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="content" className="gap-1.5"><FileText className="h-3.5 w-3.5" />Content</TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5"><Globe className="h-3.5 w-3.5" />Settings</TabsTrigger>
            <TabsTrigger value="seo" className="gap-1.5"><Search className="h-3.5 w-3.5" />SEO</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div>
                <Label>Title <span className="text-destructive">*</span></Label>
                <Input
                  className="mt-1"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Enter blog post title…"
                />
              </div>
              <div>
                <Label>Slug <span className="text-destructive">*</span></Label>
                <div className="flex items-center mt-1 gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">/blog/</span>
                  <Input
                    value={form.slug}
                    onChange={(e) => { setSlugManuallyEdited(true); set("slug", slugify(e.target.value)); }}
                    placeholder="my-blog-post"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label>Excerpt</Label>
              <Textarea
                className="mt-1 resize-none"
                rows={3}
                value={form.excerpt}
                onChange={(e) => set("excerpt", e.target.value)}
                placeholder="Brief description shown in blog listing…"
              />
            </div>

            <div>
              <Label className="mb-2 block">Cover Image</Label>
              <div className="flex gap-3 items-start">
                <Input
                  value={form.cover_image_url}
                  onChange={(e) => set("cover_image_url", e.target.value)}
                  placeholder="https://… (image URL)"
                  className="flex-1"
                />
                {form.cover_image_url && (
                  <div className="w-24 h-16 rounded-lg overflow-hidden border flex-shrink-0">
                    <img src={form.cover_image_url} alt="Cover" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Paste a Cloudinary or external image URL. Recommended: 1200×630px.</p>
            </div>

            <div>
              <Label className="mb-2 block">Content</Label>
              <RichTextEditor value={form.content} onChange={(html) => setForm((prev) => ({ ...prev, content: html }))} />
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-5 max-w-2xl">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Published Date</Label>
                <Input
                  type="datetime-local"
                  className="mt-1"
                  value={form.published_at}
                  onChange={(e) => set("published_at", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <Label>Category</Label>
                <Select value={form.category || "_none"} onValueChange={(v) => set("category", v === "_none" ? "" : v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select category…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">No category</SelectItem>
                    {CATEGORY_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Or type a custom category below</p>
                <Input
                  className="mt-1"
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  placeholder="Custom category…"
                />
              </div>
              <div>
                <Label>Author</Label>
                <Input
                  className="mt-1"
                  value={form.author}
                  onChange={(e) => set("author", e.target.value)}
                  placeholder="Author name…"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="seo" className="space-y-5 max-w-2xl">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
              <strong>SEO</strong> — These fields control how your post appears in search engine results. Leave blank to use the post title and excerpt.
            </div>

            <SeoPreview
              title={form.seo_title || form.title}
              description={form.seo_description || form.excerpt}
              slug={form.slug}
            />

            <div>
              <Label>SEO Title</Label>
              <Input
                className="mt-1"
                value={form.seo_title}
                onChange={(e) => set("seo_title", e.target.value)}
                placeholder="SEO-optimised title (50–60 characters recommended)"
                maxLength={70}
              />
              <p className="text-xs text-muted-foreground mt-1">{form.seo_title.length}/70 characters</p>
            </div>

            <div>
              <Label>Meta Description</Label>
              <Textarea
                className="mt-1 resize-none"
                rows={3}
                value={form.seo_description}
                onChange={(e) => set("seo_description", e.target.value)}
                placeholder="Brief description for search results (150–160 characters recommended)"
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground mt-1">{form.seo_description.length}/200 characters</p>
            </div>

            <div>
              <Label>Keywords</Label>
              <Input
                className="mt-1"
                value={form.seo_keywords}
                onChange={(e) => set("seo_keywords", e.target.value)}
                placeholder="student accommodation, Melbourne, housing, international students"
              />
              <p className="text-xs text-muted-foreground mt-1">Comma-separated keywords relevant to this post.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive the post and hide it from the public site. You can restore it by changing the status back to Published.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50" onClick={handleDelete}>
              Archive Post
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

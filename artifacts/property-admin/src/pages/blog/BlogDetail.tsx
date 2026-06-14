import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
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
  Languages,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";

const LANGUAGES = [
  { code: "ko", label: "Korean", flag: "🇰🇷" },
  { code: "zh", label: "Chinese", flag: "🇨🇳" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
  { code: "vi", label: "Vietnamese", flag: "🇻🇳" },
];

type LangData = {
  title: string;
  excerpt: string;
  content: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
};

const EMPTY_LANG_DATA: LangData = {
  title: "", excerpt: "", content: "",
  seo_title: "", seo_description: "", seo_keywords: "",
};

const STATUS_OPTIONS = ["Draft", "Published", "Archived"];
const STATUS_LABEL_KEYS: Record<string, string> = {
  Draft: "blog.status_draft",
  Published: "blog.status_published",
  Archived: "blog.status_archived",
};
// "Homestay" posts are surfaced on the homestay site's blog (homestay.millionstay.com/blog)
// and are kept out of the guest (www) blog listing.
const CATEGORY_OPTIONS = ["Tips & Guides", "Student Life", "Melbourne", "Housing", "News", "Lifestyle", "Homestay"];

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const { t } = useTranslation();
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
    const url = window.prompt(t("blog.enter_url"));
    if (url) exec("createLink", url);
  };

  const insertImage = () => {
    const url = window.prompt(t("blog.enter_image_url"));
    if (url) exec("insertImage", url);
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b bg-muted/30">
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("bold")} title={t("blog.editor_bold")}>
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("italic")} title={t("blog.editor_italic")}>
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("underline")} title={t("blog.editor_underline")}>
          <Underline className="h-3.5 w-3.5" />
        </Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("formatBlock", "h2")} title={t("blog.editor_heading2")}>
          <Heading2 className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("formatBlock", "h3")} title={t("blog.editor_heading3")}>
          <Heading3 className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("formatBlock", "p")} title={t("blog.editor_paragraph")}>
          <AlignLeft className="h-3.5 w-3.5" />
        </Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("justifyLeft")} title={t("blog.editor_align_left")}>
          <AlignLeft className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("justifyCenter")} title={t("blog.editor_align_center")}>
          <AlignCenter className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("justifyRight")} title={t("blog.editor_align_right")}>
          <AlignRight className="h-3.5 w-3.5" />
        </Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("insertUnorderedList")} title={t("blog.editor_bullet_list")}>
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("insertOrderedList")} title={t("blog.editor_numbered_list")}>
          <ListOrdered className="h-3.5 w-3.5" />
        </Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={insertLink} title={t("blog.editor_insert_link")}>
          <LinkIcon className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={insertImage} title={t("blog.editor_insert_image")}>
          <Image className="h-3.5 w-3.5" />
        </Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("undo")} title={t("blog.editor_undo")}>
          <Undo className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("redo")} title={t("blog.editor_redo")}>
          <Redo className="h-3.5 w-3.5" />
        </Button>
        <div className="ml-auto">
          <Button type="button" size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => setPreview(!preview)}>
            {preview ? <><EyeOff className="h-3.5 w-3.5" />{t("blog.editor_edit")}</> : <><Eye className="h-3.5 w-3.5" />{t("blog.editor_preview")}</>}
          </Button>
        </div>
      </div>
      {preview ? (
        <div
          className="min-h-[320px] p-4 prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: value || `<p class='text-muted-foreground italic'>${t("blog.no_content_yet")}</p>` }}
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
  const { t } = useTranslation();
  const url = `millionstay.com.au/blog/${slug}`;
  return (
    <div className="border rounded-lg p-4 bg-white">
      <p className="text-xs text-muted-foreground mb-2">{t("blog.search_engine_preview")}</p>
      <div className="text-green-700 text-xs mb-0.5">{url}</div>
      <div className="text-[#1a0dab] text-base hover:underline cursor-pointer line-clamp-1">
        {title || t("blog.page_title")}
      </div>
      <div className="text-sm text-muted-foreground line-clamp-2">
        {description || t("blog.page_description_placeholder")}
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
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !params.id || params.id === "new";
  const [isSaving, setIsSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [translations, setTranslations] = useState<Record<string, LangData>>({});

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
      if (post.translations && typeof post.translations === "object") {
        const parsed: Record<string, LangData> = {};
        for (const [lang, val] of Object.entries(post.translations as any)) {
          if (val && typeof val === "object") {
            const v = val as any;
            parsed[lang] = {
              title: v.title ?? "",
              excerpt: v.excerpt ?? "",
              content: v.content ?? "",
              seo_title: v.seo_title ?? "",
              seo_description: v.seo_description ?? "",
              seo_keywords: v.seo_keywords ?? "",
            };
          }
        }
        setTranslations(parsed);
      }
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
      toast({ title: t("blog.title_slug_required"), variant: "destructive" });
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
        translations: Object.keys(translations).length > 0 ? translations : undefined,
      };
      const res = await apiFetch(isNew ? "/api/v1/blog-posts" : `/api/v1/blog-posts/${params.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      qc.invalidateQueries({ queryKey: ["blog-posts"] });
      toast({ title: isNew ? t("blog.post_created") : t("blog.post_updated") });
      if (isNew) navigate(`/content/blog/${data.id}`);
    } catch (err: any) {
      toast({ title: t("blog.error"), description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await apiFetch(`/api/v1/blog-posts/${params.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      qc.invalidateQueries({ queryKey: ["blog-posts"] });
      toast({ title: t("blog.post_archived") });
      navigate("/content/blog");
    } catch (err: any) {
      toast({ title: t("blog.error"), description: err.message, variant: "destructive" });
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
            {isNew ? t("blog.new_blog_post") : form.title || t("blog.edit_post")}
          </div>
        }
        subtitle={!isNew && post ? (
          <div className="flex items-center gap-2">
            <Badge className={`text-[10px] ${post.status === "Published" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
              {STATUS_LABEL_KEYS[form.status] ? t(STATUS_LABEL_KEYS[form.status]) : form.status}
            </Badge>
            <span className="text-xs text-muted-foreground">/{form.slug}</span>
          </div>
        ) : ""}
        actions={
          <div className="flex items-center gap-2">
            {!isNew && (
              <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5 gap-1.5" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> {t("blog.archive")}
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1.5">
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {isSaving ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        }
      />

      <div className="p-6">
        <Tabs defaultValue="content" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="content" className="gap-1.5"><FileText className="h-3.5 w-3.5" />{t("blog.tab_content")}</TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5"><Globe className="h-3.5 w-3.5" />{t("blog.tab_settings")}</TabsTrigger>
            <TabsTrigger value="seo" className="gap-1.5"><Search className="h-3.5 w-3.5" />{t("blog.tab_seo")}</TabsTrigger>
            <TabsTrigger value="translations" className="gap-1.5"><Languages className="h-3.5 w-3.5" />{t("blog.tab_translations")}</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div>
                <Label>{t("blog.field_title")} <span className="text-destructive">*</span></Label>
                <Input
                  className="mt-1"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder={t("blog.title_placeholder")}
                />
              </div>
              <div>
                <Label>{t("blog.field_slug")} <span className="text-destructive">*</span></Label>
                <div className="flex items-center mt-1 gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">/blog/</span>
                  <Input
                    value={form.slug}
                    onChange={(e) => { setSlugManuallyEdited(true); set("slug", slugify(e.target.value)); }}
                    placeholder={t("blog.slug_placeholder")}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label>{t("blog.field_excerpt")}</Label>
              <Textarea
                className="mt-1 resize-none"
                rows={3}
                value={form.excerpt}
                onChange={(e) => set("excerpt", e.target.value)}
                placeholder={t("blog.excerpt_placeholder")}
              />
            </div>

            <div>
              <Label className="mb-2 block">{t("blog.field_cover_image")}</Label>
              <div className="flex gap-3 items-start">
                <Input
                  value={form.cover_image_url}
                  onChange={(e) => set("cover_image_url", e.target.value)}
                  placeholder={t("blog.cover_image_placeholder")}
                  className="flex-1"
                />
                {form.cover_image_url && (
                  <div className="w-24 h-16 rounded-lg overflow-hidden border flex-shrink-0">
                    <img src={form.cover_image_url} alt={t("blog.cover_alt")} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t("blog.cover_image_hint")}</p>
            </div>

            <div>
              <Label className="mb-2 block">{t("blog.field_content")}</Label>
              <RichTextEditor value={form.content} onChange={(html) => setForm((prev) => ({ ...prev, content: html }))} />
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-5 max-w-2xl">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <Label>{t("common.status")}</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{t(STATUS_LABEL_KEYS[s] ?? s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("blog.field_published_date")}</Label>
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
                <Label>{t("blog.field_category")}</Label>
                <Select value={form.category || "_none"} onValueChange={(v) => set("category", v === "_none" ? "" : v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t("blog.select_category")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t("blog.no_category")}</SelectItem>
                    {CATEGORY_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">{t("blog.custom_category_hint")}</p>
                <Input
                  className="mt-1"
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  placeholder={t("blog.custom_category_placeholder")}
                />
              </div>
              <div>
                <Label>{t("blog.field_author")}</Label>
                <Input
                  className="mt-1"
                  value={form.author}
                  onChange={(e) => set("author", e.target.value)}
                  placeholder={t("blog.author_placeholder")}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="seo" className="space-y-5 max-w-2xl">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
              <strong>{t("blog.tab_seo")}</strong> — {t("blog.seo_info")}
            </div>

            <SeoPreview
              title={form.seo_title || form.title}
              description={form.seo_description || form.excerpt}
              slug={form.slug}
            />

            <div>
              <Label>{t("blog.field_seo_title")}</Label>
              <Input
                className="mt-1"
                value={form.seo_title}
                onChange={(e) => set("seo_title", e.target.value)}
                placeholder={t("blog.seo_title_placeholder")}
                maxLength={70}
              />
              <p className="text-xs text-muted-foreground mt-1">{t("blog.char_count", { count: form.seo_title.length, max: 70 })}</p>
            </div>

            <div>
              <Label>{t("blog.field_meta_description")}</Label>
              <Textarea
                className="mt-1 resize-none"
                rows={3}
                value={form.seo_description}
                onChange={(e) => set("seo_description", e.target.value)}
                placeholder={t("blog.meta_description_placeholder")}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground mt-1">{t("blog.char_count", { count: form.seo_description.length, max: 200 })}</p>
            </div>

            <div>
              <Label>{t("blog.field_keywords")}</Label>
              <Input
                className="mt-1"
                value={form.seo_keywords}
                onChange={(e) => set("seo_keywords", e.target.value)}
                placeholder={t("blog.keywords_placeholder")}
              />
              <p className="text-xs text-muted-foreground mt-1">{t("blog.keywords_hint")}</p>
            </div>
          </TabsContent>

          <TabsContent value="translations">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 mb-4">
              <strong>{t("blog.tab_translations")}</strong> — {t("blog.translations_info")}
            </div>

            <Tabs defaultValue="ko">
              <TabsList className="flex flex-wrap gap-1 h-auto mb-4">
                {LANGUAGES.map((lang) => {
                  const hasData = !!(translations[lang.code]?.title || translations[lang.code]?.content);
                  return (
                    <TabsTrigger key={lang.code} value={lang.code} className="gap-1.5 relative">
                      <span>{lang.flag}</span>
                      <span>{t(`blog.lang_${lang.code}`)}</span>
                      {hasData && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500" />
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {LANGUAGES.map((lang) => {
                const langData: LangData = translations[lang.code] ?? EMPTY_LANG_DATA;
                const langLabel = t(`blog.lang_${lang.code}`);
                const setLang = (field: keyof LangData, val: string) => {
                  setTranslations((prev) => ({
                    ...prev,
                    [lang.code]: { ...(prev[lang.code] ?? EMPTY_LANG_DATA), [field]: val },
                  }));
                };
                return (
                  <TabsContent key={lang.code} value={lang.code} className="space-y-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <span className="text-xl">{lang.flag}</span>
                      {t("blog.lang_fill_in", { lang: langLabel })}
                    </div>

                    <div>
                      <Label>{t("blog.field_title")} ({langLabel})</Label>
                      <Input
                        className="mt-1"
                        value={langData.title}
                        onChange={(e) => setLang("title", e.target.value)}
                        placeholder={t("blog.translated_title_placeholder", { lang: langLabel })}
                      />
                    </div>

                    <div>
                      <Label>{t("blog.field_excerpt")} ({langLabel})</Label>
                      <Textarea
                        className="mt-1 resize-none"
                        rows={2}
                        value={langData.excerpt}
                        onChange={(e) => setLang("excerpt", e.target.value)}
                        placeholder={t("blog.translated_excerpt_placeholder", { lang: langLabel })}
                      />
                    </div>

                    <div>
                      <Label className="mb-2 block">{t("blog.field_content")} ({langLabel})</Label>
                      <RichTextEditor
                        key={`rte-${lang.code}`}
                        value={langData.content}
                        onChange={(html) => setLang("content", html)}
                      />
                    </div>

                    <Separator />
                    <p className="text-sm font-medium text-muted-foreground">{t("blog.tab_seo")} — {langLabel}</p>

                    <SeoPreview
                      title={langData.seo_title || langData.title || form.title}
                      description={langData.seo_description || langData.excerpt || form.excerpt}
                      slug={form.slug}
                    />

                    <div>
                      <Label>{t("blog.field_seo_title")} ({langLabel})</Label>
                      <Input
                        className="mt-1"
                        value={langData.seo_title}
                        onChange={(e) => setLang("seo_title", e.target.value)}
                        placeholder={t("blog.seo_title_short_placeholder")}
                        maxLength={70}
                      />
                    </div>
                    <div>
                      <Label>{t("blog.field_meta_description")} ({langLabel})</Label>
                      <Textarea
                        className="mt-1 resize-none"
                        rows={2}
                        value={langData.seo_description}
                        onChange={(e) => setLang("seo_description", e.target.value)}
                        placeholder={t("blog.meta_description_short_placeholder")}
                        maxLength={200}
                      />
                    </div>
                    <div>
                      <Label>{t("blog.field_keywords")} ({langLabel})</Label>
                      <Input
                        className="mt-1"
                        value={langData.seo_keywords}
                        onChange={(e) => setLang("seo_keywords", e.target.value)}
                        placeholder={t("blog.keywords_short_placeholder")}
                      />
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("blog.archive_this_post")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("blog.archive_confirm_description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50" onClick={handleDelete}>
              {t("blog.archive_post")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

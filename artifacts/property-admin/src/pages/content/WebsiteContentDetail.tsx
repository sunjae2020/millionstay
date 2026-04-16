import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Save, Globe, Search, Eye, EyeOff,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Heading2, Heading3, Link as LinkIcon, Image,
  Undo, Redo, Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { WEBSITE_PAGES, LANGUAGES } from "./WebsiteContentList";

// ─── Page Section Definitions ───────────────────────────────────────────────

type FieldType = "text" | "textarea" | "richtext" | "image";

interface SectionField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  hint?: string;
}

const PAGE_FIELDS: Record<string, SectionField[]> = {
  home: [
    { key: "hero_title", label: "Hero Title", type: "text", placeholder: "Find Your Home Away From Home" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "textarea", placeholder: "Tagline below the hero title" },
    { key: "hero_cta_primary", label: "Primary CTA Button Text", type: "text", placeholder: "Browse Rooms" },
    { key: "hero_cta_secondary", label: "Secondary CTA Button Text", type: "text", placeholder: "Learn More" },
    { key: "why_title", label: '"Why MillionStay" Section Title', type: "text" },
    { key: "why_body", label: '"Why MillionStay" Body', type: "richtext" },
    { key: "feature_1_title", label: "Feature 1 — Title", type: "text" },
    { key: "feature_1_body", label: "Feature 1 — Description", type: "textarea" },
    { key: "feature_2_title", label: "Feature 2 — Title", type: "text" },
    { key: "feature_2_body", label: "Feature 2 — Description", type: "textarea" },
    { key: "feature_3_title", label: "Feature 3 — Title", type: "text" },
    { key: "feature_3_body", label: "Feature 3 — Description", type: "textarea" },
    { key: "stat_rooms", label: "Stat — Rooms", type: "text", placeholder: "500+" },
    { key: "stat_universities", label: "Stat — Universities", type: "text", placeholder: "40+" },
    { key: "stat_support", label: "Stat — Support", type: "text", placeholder: "24/7" },
    { key: "cta_title", label: "CTA Section Title", type: "text" },
    { key: "cta_subtitle", label: "CTA Section Subtitle", type: "textarea" },
    { key: "cta_button", label: "CTA Button Text", type: "text" },
  ],
  "for-student": [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "text" },
    { key: "intro_title", label: "Intro Heading", type: "text" },
    { key: "intro_body", label: "Intro Body Text", type: "richtext" },
    { key: "feature_1_title", label: "Feature 1 — Title", type: "text" },
    { key: "feature_1_body", label: "Feature 1 — Description", type: "textarea" },
    { key: "feature_2_title", label: "Feature 2 — Title", type: "text" },
    { key: "feature_2_body", label: "Feature 2 — Description", type: "textarea" },
    { key: "feature_3_title", label: "Feature 3 — Title", type: "text" },
    { key: "feature_3_body", label: "Feature 3 — Description", type: "textarea" },
    { key: "feature_4_title", label: "Feature 4 — Title", type: "text" },
    { key: "feature_4_body", label: "Feature 4 — Description", type: "textarea" },
    { key: "cta_primary", label: "Primary CTA Text", type: "text" },
    { key: "cta_secondary", label: "Secondary CTA Text", type: "text" },
    { key: "hero_image_url", label: "Hero Image URL", type: "image" },
  ],
  "for-agent": [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "text" },
    { key: "intro_title", label: "Intro Heading", type: "text" },
    { key: "intro_body", label: "Intro Body", type: "richtext" },
    { key: "benefit_1_title", label: "Benefit 1 — Title", type: "text" },
    { key: "benefit_1_body", label: "Benefit 1 — Description", type: "textarea" },
    { key: "benefit_2_title", label: "Benefit 2 — Title", type: "text" },
    { key: "benefit_2_body", label: "Benefit 2 — Description", type: "textarea" },
    { key: "benefit_3_title", label: "Benefit 3 — Title", type: "text" },
    { key: "benefit_3_body", label: "Benefit 3 — Description", type: "textarea" },
    { key: "how_title", label: '"How It Works" Title', type: "text" },
    { key: "how_body", label: '"How It Works" Body', type: "richtext" },
    { key: "cta_title", label: "CTA Title", type: "text" },
    { key: "cta_button", label: "CTA Button Text", type: "text" },
  ],
  about: [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "textarea" },
    { key: "mission_title", label: "Mission Section Title", type: "text" },
    { key: "mission_body", label: "Mission Body", type: "richtext" },
    { key: "values_title", label: "Values Section Title", type: "text" },
    { key: "value_1_title", label: "Value 1 — Title", type: "text" },
    { key: "value_1_body", label: "Value 1 — Description", type: "textarea" },
    { key: "value_2_title", label: "Value 2 — Title", type: "text" },
    { key: "value_2_body", label: "Value 2 — Description", type: "textarea" },
    { key: "value_3_title", label: "Value 3 — Title", type: "text" },
    { key: "value_3_body", label: "Value 3 — Description", type: "textarea" },
    { key: "team_title", label: "Team Section Title", type: "text" },
    { key: "team_body", label: "Team Section Body", type: "richtext" },
  ],
  faq: [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "text" },
    { key: "section_1_title", label: "Category 1 Title", type: "text" },
    { key: "section_1_body", label: "Category 1 — Q&A Content", type: "richtext", hint: "Use H3 for questions, paragraph for answers" },
    { key: "section_2_title", label: "Category 2 Title", type: "text" },
    { key: "section_2_body", label: "Category 2 — Q&A Content", type: "richtext", hint: "Use H3 for questions, paragraph for answers" },
    { key: "section_3_title", label: "Category 3 Title", type: "text" },
    { key: "section_3_body", label: "Category 3 — Q&A Content", type: "richtext", hint: "Use H3 for questions, paragraph for answers" },
    { key: "cta_title", label: "CTA Title", type: "text" },
    { key: "cta_body", label: "CTA Body", type: "textarea" },
    { key: "cta_button", label: "CTA Button Text", type: "text" },
  ],
  contact: [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "textarea" },
    { key: "address_title", label: "Office Address Label", type: "text" },
    { key: "address", label: "Office Address", type: "textarea" },
    { key: "phone_label", label: "Phone Label", type: "text" },
    { key: "phone", label: "Phone Number", type: "text" },
    { key: "email_label", label: "Email Label", type: "text" },
    { key: "email", label: "Email Address", type: "text" },
    { key: "hours_label", label: "Hours Label", type: "text" },
    { key: "hours", label: "Business Hours", type: "textarea" },
    { key: "form_title", label: "Form Section Title", type: "text" },
    { key: "form_subtitle", label: "Form Section Subtitle", type: "textarea" },
  ],
};

// ─── Rich Text Editor ────────────────────────────────────────────────────────

function RichTextEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
    const url = window.prompt("URL 입력 / Enter URL:");
    if (url) exec("createLink", url);
  };

  const insertImg = () => {
    const url = window.prompt("이미지 URL 입력 / Enter Image URL:");
    if (url) exec("insertImage", url);
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b bg-muted/30">
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("bold")} title="Bold"><Bold className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("italic")} title="Italic"><Italic className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("underline")} title="Underline"><Underline className="h-3.5 w-3.5" /></Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("formatBlock", "h2")} title="H2"><Heading2 className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("formatBlock", "h3")} title="H3"><Heading3 className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("formatBlock", "p")} title="Paragraph"><AlignLeft className="h-3.5 w-3.5" /></Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("justifyLeft")} title="Align Left"><AlignLeft className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("justifyCenter")} title="Align Center"><AlignCenter className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("justifyRight")} title="Align Right"><AlignRight className="h-3.5 w-3.5" /></Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("insertUnorderedList")} title="Bullet List"><List className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("insertOrderedList")} title="Numbered List"><ListOrdered className="h-3.5 w-3.5" /></Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={insertLink} title="Link"><LinkIcon className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={insertImg} title="Image"><Image className="h-3.5 w-3.5" /></Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("undo")} title="Undo"><Undo className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("redo")} title="Redo"><Redo className="h-3.5 w-3.5" /></Button>
        <div className="ml-auto">
          <Button type="button" size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => setPreview(!preview)}>
            {preview ? <><EyeOff className="h-3.5 w-3.5" />Edit</> : <><Eye className="h-3.5 w-3.5" />Preview</>}
          </Button>
        </div>
      </div>
      {preview ? (
        <div className="min-h-[200px] p-4 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: value || "<p class='text-muted-foreground italic'>No content yet</p>" }} />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="min-h-[200px] p-4 text-sm focus:outline-none [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-2 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-[#E8621A] [&_a]:underline [&_img]:max-w-full [&_img]:rounded"
          onInput={() => { if (editorRef.current) onChange(editorRef.current.innerHTML); }}
        />
      )}
    </div>
  );
}

// ─── SEO Preview ─────────────────────────────────────────────────────────────

function SeoPreview({ title, description, url }: { title: string; description: string; url: string }) {
  return (
    <div className="border rounded-lg p-4 bg-white">
      <p className="text-xs text-muted-foreground mb-2">Search Engine Preview</p>
      <div className="text-green-700 text-xs mb-0.5">{url}</div>
      <div className="text-[#1a0dab] text-base hover:underline cursor-pointer line-clamp-1">{title || "Page Title"}</div>
      <div className="text-sm text-muted-foreground line-clamp-2">{description || "Page description will appear here…"}</div>
    </div>
  );
}

// ─── Language Content Tab ─────────────────────────────────────────────────────

interface LangContent {
  content: Record<string, string>;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
}

const EMPTY_LANG: LangContent = { content: {}, seo_title: "", seo_description: "", seo_keywords: "" };

function LanguageTab({
  pageKey,
  lang,
  fields,
  initial,
  onSave,
  isSaving,
  pagePublicPath,
}: {
  pageKey: string;
  lang: { code: string; label: string; flag: string };
  fields: SectionField[];
  initial: LangContent;
  onSave: (lang: string, data: LangContent) => void;
  isSaving: boolean;
  pagePublicPath: string;
}) {
  const [form, setForm] = useState<LangContent>(initial);
  const [activeTab, setActiveTab] = useState<"content" | "seo">("content");

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const setField = (key: string, val: string) => {
    setForm((f) => ({ ...f, content: { ...f.content, [key]: val } }));
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="content" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Content
          </TabsTrigger>
          <TabsTrigger value="seo" className="gap-1.5">
            <Search className="h-3.5 w-3.5" />
            SEO
          </TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-5 mt-4">
          {fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-sm font-medium">{field.label}</Label>
              {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
              {field.type === "text" ? (
                <Input
                  value={form.content[field.key] ?? ""}
                  onChange={(e) => setField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                />
              ) : field.type === "textarea" ? (
                <Textarea
                  value={form.content[field.key] ?? ""}
                  onChange={(e) => setField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                />
              ) : field.type === "image" ? (
                <div className="space-y-2">
                  <Input
                    value={form.content[field.key] ?? ""}
                    onChange={(e) => setField(field.key, e.target.value)}
                    placeholder="https://…"
                  />
                  {form.content[field.key] && (
                    <img
                      src={form.content[field.key]}
                      alt={field.label}
                      className="h-32 w-full object-cover rounded-lg border"
                    />
                  )}
                </div>
              ) : (
                <RichTextEditor
                  key={`rte-${lang.code}-${field.key}`}
                  value={form.content[field.key] ?? ""}
                  onChange={(v) => setField(field.key, v)}
                />
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="seo" className="space-y-5 mt-4">
          <div className="space-y-1.5">
            <Label>SEO Title</Label>
            <Input
              value={form.seo_title}
              onChange={(e) => setForm((f) => ({ ...f, seo_title: e.target.value }))}
              placeholder="Page title for search engines (50–60 characters recommended)"
              maxLength={120}
            />
            <p className="text-xs text-muted-foreground">{form.seo_title.length} / 60 characters</p>
          </div>
          <div className="space-y-1.5">
            <Label>SEO Description</Label>
            <Textarea
              value={form.seo_description}
              onChange={(e) => setForm((f) => ({ ...f, seo_description: e.target.value }))}
              placeholder="Meta description for search engines (120–160 characters recommended)"
              rows={3}
              maxLength={320}
            />
            <p className="text-xs text-muted-foreground">{form.seo_description.length} / 160 characters</p>
          </div>
          <div className="space-y-1.5">
            <Label>Keywords</Label>
            <Input
              value={form.seo_keywords}
              onChange={(e) => setForm((f) => ({ ...f, seo_keywords: e.target.value }))}
              placeholder="student accommodation, Melbourne housing, international students, …"
            />
          </div>
          <SeoPreview
            title={form.seo_title}
            description={form.seo_description}
            url={`millionstay.com.au${pagePublicPath}`}
          />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end pt-2">
        <Button
          onClick={() => onSave(lang.code, form)}
          disabled={isSaving}
          className="bg-[#E8621A] hover:bg-[#E8621A]/90 text-white gap-2"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save {lang.label}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WebsiteContentDetail() {
  const params = useParams<{ pageKey: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [savingLang, setSavingLang] = useState<string | null>(null);

  const pageKey = params.pageKey ?? "";
  const pageDef = WEBSITE_PAGES.find((p) => p.key === pageKey);
  const fields = PAGE_FIELDS[pageKey] ?? [];

  const { data: allRows = [], isLoading } = useQuery<any[]>({
    queryKey: ["page-contents", pageKey],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/page-contents/${pageKey}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!pageKey,
  });

  const getLangData = useCallback(
    (code: string): LangContent => {
      const row = allRows.find((r: any) => r.language === code);
      if (!row) return EMPTY_LANG;
      return {
        content: (row.content as Record<string, string>) ?? {},
        seo_title: row.seo_title ?? "",
        seo_description: row.seo_description ?? "",
        seo_keywords: row.seo_keywords ?? "",
      };
    },
    [allRows],
  );

  const handleSave = async (langCode: string, data: LangContent) => {
    setSavingLang(langCode);
    try {
      const res = await apiFetch(`/api/v1/page-contents/${pageKey}/${langCode}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Save failed");
      await qc.invalidateQueries({ queryKey: ["page-contents", pageKey] });
      toast({ title: "Saved", description: `${pageDef?.label ?? pageKey} — ${langCode.toUpperCase()} content saved successfully.` });
    } catch {
      toast({ title: "Error", description: "Failed to save content. Please try again.", variant: "destructive" });
    } finally {
      setSavingLang(null);
    }
  };

  if (!pageDef) {
    return (
      <Layout>
        <div className="p-6">
          <p className="text-muted-foreground">Page not found: <code>{pageKey}</code></p>
          <Button variant="link" onClick={() => navigate("/content/pages")}>Back to Website Pages</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title={pageDef.label}
        description={pageDef.description}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{pageDef.path}</Badge>
            <Button variant="outline" size="sm" asChild>
              <a href={`https://millionstay.com.au${pageDef.path}`} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                Preview
              </a>
            </Button>
          </div>
        }
      />

      <div className="p-6">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/content/pages")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Website Pages
        </Button>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="en">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">Select language to edit:</p>
              <TabsList className="flex flex-wrap gap-1 h-auto">
                {LANGUAGES.map((lang) => {
                  const hasContent = allRows.some((r: any) => r.language === lang.code);
                  return (
                    <TabsTrigger key={lang.code} value={lang.code} className="gap-1.5 relative">
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                      {hasContent && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500" title="Has content" />
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {LANGUAGES.map((lang) => (
              <TabsContent key={lang.code} value={lang.code}>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="text-xl">{lang.flag}</span>
                      {lang.label} Content
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <LanguageTab
                      pageKey={pageKey}
                      lang={lang}
                      fields={fields}
                      initial={getLangData(lang.code)}
                      onSave={handleSave}
                      isSaving={savingLang === lang.code}
                      pagePublicPath={pageDef.path}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </Layout>
  );
}

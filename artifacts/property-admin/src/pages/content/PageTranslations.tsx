import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Languages, Save, Sparkles, Loader2, ExternalLink, CheckCheck } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";

// ─── Page registry ───────────────────────────────────────────────────────────
// Groups the flat i18n `translations` keys into editable "pages" by key prefix.
// Storage + runtime stay the existing translations table + public overlay; this
// view just organises the keys per landing-page so editors can focus and run AI
// translation page-by-page. `path` is the public URL on homestay.millionstay.com.
type PageDef = { prefix: string; label: string; site: string; path?: string };

const PAGES: PageDef[] = [
  { prefix: "homestay.home", label: "Homestay · Home", site: "homestay", path: "/" },
  { prefix: "homestay.about", label: "Homestay · About Us", site: "homestay", path: "/about" },
  { prefix: "homestay.students", label: "Homestay · Students", site: "homestay", path: "/students" },
  { prefix: "homestay.student_apply", label: "Homestay · Student Apply", site: "homestay", path: "/students/apply" },
  { prefix: "homestay.hosts", label: "Homestay · Host Family", site: "homestay", path: "/hosts/become-a-host" },
  { prefix: "homestay.host_apply", label: "Homestay · Host Apply", site: "homestay", path: "/hosts/apply" },
  { prefix: "homestay.partners", label: "Homestay · Partners", site: "homestay", path: "/partners" },
  { prefix: "homestay.contact", label: "Homestay · Contact", site: "homestay", path: "/contact" },
  { prefix: "homestay.privacy", label: "Homestay · Privacy", site: "homestay", path: "/privacy" },
  { prefix: "homestay.terms", label: "Homestay · Terms", site: "homestay", path: "/terms" },
  { prefix: "homestay.coming_soon", label: "Homestay · Coming Soon", site: "homestay" },
  { prefix: "homestay.nav", label: "Homestay · Navigation", site: "homestay" },
  { prefix: "homestay.footer", label: "Homestay · Footer", site: "homestay" },
  { prefix: "homestay.sections", label: "Homestay · Shared Sections", site: "homestay" },
];

type Lang = { code: string; name: string; english_name: string | null; enabled: boolean; is_default: boolean; sort_order: number };
type Row = { key: string; en: string; value: string; id: number | null; source: string | null; reviewed_at: string | null; needs_review: boolean };

const LANG_API = "/api/v1/translations/languages";
const TR_API = "/api/v1/translations";

async function fetchLanguages(): Promise<Lang[]> {
  const res = await apiFetch(LANG_API);
  if (!res.ok) throw new Error("Failed to load languages");
  return (await res.json()).data ?? [];
}

async function fetchRows(lang: string): Promise<Row[]> {
  const res = await apiFetch(`${TR_API}?lang=${encodeURIComponent(lang)}`);
  if (!res.ok) throw new Error("Failed to load translations");
  return (await res.json()).data ?? [];
}

// Longer English strings (legal prose, intros) read better as a textarea.
function isLong(s: string): boolean {
  return (s ?? "").length > 90;
}

export default function PageTranslations() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const langsQ = useQuery({ queryKey: ["pt-languages"], queryFn: fetchLanguages });
  const languages = langsQ.data ?? [];
  const targetLangs = languages.filter((l) => l.enabled && !l.is_default && l.code !== "en");

  const [prefix, setPrefix] = useState(PAGES[0]!.prefix);
  const [lang, setLang] = useState("ko");
  const [edits, setEdits] = useState<Record<string, string>>({});

  const page = PAGES.find((p) => p.prefix === prefix)!;
  const isEn = lang === "en";

  const rowsQ = useQuery({ queryKey: ["page-translations", lang], queryFn: () => fetchRows(lang) });
  const pageRows = useMemo(() => {
    const all = rowsQ.data ?? [];
    return all
      .filter((r) => r.key === prefix || r.key.startsWith(prefix + "."))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [rowsQ.data, prefix]);

  const dirtyCount = Object.keys(edits).length;
  const missingCount = pageRows.filter((r) => !(r.value ?? "").trim()).length;
  const reviewCount = pageRows.filter((r) => r.needs_review).length;

  async function saveAll() {
    const entries = Object.entries(edits);
    if (entries.length === 0) return;
    try {
      for (const [key, value] of entries) {
        const res = await apiFetch(TR_API, { method: "PUT", body: JSON.stringify({ lang, key, value }) });
        if (!res.ok) throw new Error(`Failed on ${key}`);
      }
      setEdits({});
      qc.invalidateQueries({ queryKey: ["page-translations", lang] });
      toast({ title: t("page_translations.toast_saved", { defaultValue: "Saved {{count}} change(s)", count: entries.length }) });
    } catch (e: any) {
      toast({ title: t("page_translations.toast_save_failed", { defaultValue: "Save failed" }), description: String(e?.message ?? e), variant: "destructive" });
    }
  }

  const saveOne = useMutation({
    mutationFn: async (p: { key: string; value: string }) => {
      const res = await apiFetch(TR_API, { method: "PUT", body: JSON.stringify({ lang, key: p.key, value: p.value }) });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: (_d, p) => {
      setEdits((e) => { const n = { ...e }; delete n[p.key]; return n; });
      qc.invalidateQueries({ queryKey: ["page-translations", lang] });
    },
    onError: (e: any) => toast({ title: t("page_translations.toast_save_failed", { defaultValue: "Save failed" }), description: String(e?.message ?? e), variant: "destructive" }),
  });

  // AI-translate every key on this page into all enabled non-English languages.
  // overwrite=false preserves any human-edited values.
  const aiTranslate = useMutation({
    mutationFn: async (opts: { allLangs: boolean }) => {
      const body: any = { keyPrefix: prefix, overwrite: false };
      if (!opts.allLangs) body.targetLangs = [lang];
      const res = await apiFetch(`${TR_API}/ai-translate`, { method: "POST", body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      return json;
    },
    onSuccess: (json: any) => {
      const summary = json?.data?.summary ?? {};
      const total = Object.values(summary).reduce((acc: number, s: any) => acc + (s?.translated ?? 0), 0);
      toast({ title: t("page_translations.toast_ai_done", { defaultValue: "AI translated {{count}} value(s)", count: total }) });
      qc.invalidateQueries({ queryKey: ["page-translations"] });
    },
    onError: (e: any) => toast({ title: t("page_translations.toast_ai_failed", { defaultValue: "AI translation failed" }), description: String(e?.message ?? e), variant: "destructive" }),
  });

  // AI-review every translation on this page against the English source, correct
  // issues + fill empties, and mark them reviewed (clears the unreviewed badge).
  const aiReview = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`${TR_API}/ai-review`, { method: "POST", body: JSON.stringify({ keyPrefix: prefix }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      return json;
    },
    onSuccess: (json: any) => {
      const summary = json?.data?.summary ?? {};
      const reviewed = Object.values(summary).reduce((acc: number, s: any) => acc + (s?.reviewed ?? 0), 0);
      const changed = Object.values(summary).reduce((acc: number, s: any) => acc + (s?.changed ?? 0), 0);
      toast({ title: t("page_translations.toast_review_done", { defaultValue: "Reviewed {{count}} value(s), {{changed}} corrected", count: reviewed, changed }) });
      qc.invalidateQueries({ queryKey: ["page-translations"] });
    },
    onError: (e: any) => toast({ title: t("page_translations.toast_review_failed", { defaultValue: "AI review failed" }), description: String(e?.message ?? e), variant: "destructive" }),
  });

  const aiBusy = aiTranslate.isPending || aiReview.isPending;
  const previewUrl = page.path ? `https://homestay.millionstay.com${page.path}` : null;

  return (
    <Layout>
      <PageHeader
        title={<><Languages className="h-5 w-5" />{t("page_translations.page_title", { defaultValue: "Page Translations" })}</>}
        subtitle={t("page_translations.page_subtitle", { defaultValue: "AI-translate and manually edit landing-page content, organised by page. Saves apply to the live site immediately." })}
      />

      <div className="px-8 py-6">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <Label className="text-xs text-muted-foreground">{t("page_translations.page", { defaultValue: "Page" })}</Label>
            <Select value={prefix} onValueChange={(v) => { setPrefix(v); setEdits({}); }}>
              <SelectTrigger className="w-72 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGES.map((p) => (<SelectItem key={p.prefix} value={p.prefix}>{p.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t("page_translations.language", { defaultValue: "Language" })}</Label>
            <Select value={lang} onValueChange={(v) => { setLang(v); setEdits({}); }}>
              <SelectTrigger className="w-56 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {languages.map((l) => (
                  <SelectItem key={l.code} value={l.code}>{l.name} ({l.code}){!l.enabled ? " — off" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {previewUrl && (
            <Button variant="outline" asChild>
              <a href={previewUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2" />{t("page_translations.preview", { defaultValue: "Preview" })}</a>
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              onClick={() => aiTranslate.mutate({ allLangs: true })}
              disabled={aiBusy}
              title={t("page_translations.ai_all_title", { defaultValue: "Translate this page into every enabled language (skips values that already exist)" })}
            >
              {aiTranslate.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {t("page_translations.ai_all", { defaultValue: "AI translate page (all languages)" })}
            </Button>
            <Button
              variant="outline"
              onClick={() => aiReview.mutate()}
              disabled={aiBusy}
              title={t("page_translations.ai_review_title", { defaultValue: "Review every translation on this page against the English source, correct issues, and mark reviewed" })}
            >
              {aiReview.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCheck className="h-4 w-4 mr-2" />}
              {t("page_translations.ai_review", { defaultValue: "AI review page" })}
            </Button>
            <Button onClick={saveAll} disabled={dirtyCount === 0}>
              <Save className="h-4 w-4 mr-2" />{t("common.save")}{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3 text-xs">
          <Badge variant="outline">{t("page_translations.keys_count", { defaultValue: "{{count}} keys", count: pageRows.length })}</Badge>
          {!isEn && missingCount > 0 && <Badge variant="secondary">{t("page_translations.missing_count", { defaultValue: "{{count}} missing", count: missingCount })}</Badge>}
          {!isEn && reviewCount > 0 && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{t("page_translations.review_count", { defaultValue: "{{count}} AI · unreviewed", count: reviewCount })}</Badge>}
          {!isEn && (
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => aiTranslate.mutate({ allLangs: false })} disabled={aiTranslate.isPending}>
              <Sparkles className="h-3 w-3 mr-1" />{t("page_translations.ai_this", { defaultValue: "AI fill empty ({{lang}})", lang: lang.toUpperCase() })}
            </Button>
          )}
        </div>

        <div className="border rounded-lg bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[24%]">{t("page_translations.col_key", { defaultValue: "Key" })}</TableHead>
                {!isEn && <TableHead className="w-[34%]">{t("page_translations.col_english", { defaultValue: "English (source)" })}</TableHead>}
                <TableHead>{isEn ? t("page_translations.col_english_value", { defaultValue: "English value" }) : t("page_translations.col_translation", { defaultValue: "Translation" })}</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rowsQ.isLoading ? (
                <TableRow><TableCell colSpan={isEn ? 3 : 4} className="text-center py-10 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
              ) : pageRows.length === 0 ? (
                <TableRow><TableCell colSpan={isEn ? 3 : 4} className="text-center py-10 text-muted-foreground">{t("page_translations.no_keys", { defaultValue: "No keys for this page yet. Seed the English source first." })}</TableCell></TableRow>
              ) : pageRows.map((r) => {
                const current = edits[r.key] ?? r.value;
                const dirty = edits[r.key] !== undefined && edits[r.key] !== r.value;
                const long = isLong(r.en);
                const shortKey = r.key.startsWith(prefix + ".") ? r.key.slice(prefix.length + 1) : r.key;
                return (
                  <TableRow key={r.key} className={dirty ? "bg-amber-50/50" : ""}>
                    <TableCell className="font-mono text-xs align-top pt-3.5 break-all">
                      {shortKey}
                      {!isEn && r.needs_review && (
                        <Badge className="ml-1 bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px] px-1 py-0">AI</Badge>
                      )}
                    </TableCell>
                    {!isEn && <TableCell className="text-sm text-muted-foreground align-top pt-3.5 whitespace-pre-wrap">{r.en || <span className="italic opacity-40">—</span>}</TableCell>}
                    <TableCell className="align-top">
                      {long ? (
                        <Textarea value={current} onChange={(e) => setEdits((p) => ({ ...p, [r.key]: e.target.value }))} placeholder={isEn ? "" : r.en} rows={3} />
                      ) : (
                        <Input value={current} onChange={(e) => setEdits((p) => ({ ...p, [r.key]: e.target.value }))} className="h-9" placeholder={isEn ? "" : r.en} />
                      )}
                    </TableCell>
                    <TableCell className="align-top pt-2.5">
                      <Button size="icon" variant="ghost" disabled={!dirty || saveOne.isPending} onClick={() => saveOne.mutate({ key: r.key, value: current })} title={t("common.save")}>
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </Layout>
  );
}

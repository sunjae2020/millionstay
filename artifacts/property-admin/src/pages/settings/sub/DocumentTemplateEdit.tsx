import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Send, CheckCircle2, Eye, Code } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";

const API = "/api/v1/document-templates";
const LOCALES = ["en", "ko", "ja", "zh", "th"];

interface Translation { locale: string; subject?: string | null; body_html?: string | null }
interface TemplateDetail {
  id: number; kind: string; key: string; name: string; description?: string | null;
  status: string; version: number;
  variables_schema: Record<string, { type?: string; required?: boolean }>;
  translations: Translation[];
}

/** {{var}} substitution mirroring the server engine, for the live preview. */
function render(tpl: string, vars: Record<string, string>): string {
  return (tpl || "").replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_m, n) => vars[n] ?? "");
}
function sampleVars(schema: Record<string, { type?: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, def] of Object.entries(schema ?? {})) {
    const ty = def?.type ?? "string";
    out[name] = ty === "url" ? "https://www.millionstay.com" : ty === "date" ? new Date().toISOString().slice(0, 10) : ty === "number" ? "100.00" : `[${name}]`;
  }
  return out;
}

export default function DocumentTemplateEdit() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);

  const { data, isLoading } = useQuery({
    queryKey: ["document-template", id],
    queryFn: async (): Promise<{ data: TemplateDetail }> => {
      const res = await apiFetch(`${API}/${id}`);
      if (!res.ok) throw new Error("Failed to load template");
      return res.json();
    },
    enabled: !!id,
  });
  const tpl = data?.data;
  const isEmail = tpl?.kind === "email";

  const [locale, setLocale] = useState("en");
  const [drafts, setDrafts] = useState<Record<string, { subject: string; body_html: string }>>({});
  const [mode, setMode] = useState<"html" | "preview">("html");

  // Seed editable drafts from the fetched translations.
  useEffect(() => {
    if (!tpl) return;
    const seed: Record<string, { subject: string; body_html: string }> = {};
    for (const tr of tpl.translations) seed[tr.locale] = { subject: tr.subject ?? "", body_html: tr.body_html ?? "" };
    setDrafts(seed);
    if (tpl.translations.length && !tpl.translations.find((x) => x.locale === "en")) setLocale(tpl.translations[0].locale);
  }, [tpl]);

  const cur = drafts[locale] ?? { subject: "", body_html: "" };
  const setCur = (patch: Partial<{ subject: string; body_html: string }>) =>
    setDrafts((d) => ({ ...d, [locale]: { ...cur, ...patch } }));

  const vars = useMemo(() => sampleVars(tpl?.variables_schema ?? {}), [tpl]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`${API}/${id}/translations/${locale}`, {
        method: "PATCH",
        body: JSON.stringify({ subject: isEmail ? cur.subject : null, body_html: cur.body_html }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => { toast({ title: t("documentTemplate.toast_saved") }); qc.invalidateQueries({ queryKey: ["document-template", id] }); },
    onError: (e: any) => toast({ title: t("documentTemplate.error"), description: e.message, variant: "destructive" }),
  });

  const publish = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`${API}/${id}/publish`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => { toast({ title: t("documentTemplate.toast_published") }); qc.invalidateQueries({ queryKey: ["document-template", id] }); qc.invalidateQueries({ queryKey: ["document-templates"] }); },
    onError: (e: any) => toast({ title: t("documentTemplate.error"), description: e.message, variant: "destructive" }),
  });

  const testSend = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`${API}/${id}/test-send`, { method: "POST", body: JSON.stringify({ locale }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Failed to send test");
      return res.json();
    },
    onSuccess: (d: any) => toast({ title: t("documentTemplate.toast_test_sent"), description: d?.data?.sentTo }),
    onError: (e: any) => toast({ title: t("documentTemplate.error"), description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <Layout><p className="p-6 text-sm text-muted-foreground">{t("common.loading")}</p></Layout>;
  if (!tpl) return <Layout><p className="p-6 text-sm text-muted-foreground">{t("documentTemplate.not_found")}</p></Layout>;

  const localeTabs = Array.from(new Set([...tpl.translations.map((x) => x.locale), locale]));

  return (
    <Layout>
      <PageHeader
        title={<span className="flex items-center gap-2">{tpl.name}
          <span className={`text-xs px-2 py-0.5 rounded-full border ${tpl.status === "published" ? "bg-green-100 text-green-700 border-green-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}>{t(`documentTemplate.status_${tpl.status}`)}</span>
        </span>}
        subtitle={`${tpl.kind} · ${tpl.key}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/settings/document-templates"><Button variant="outline" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> {t("common.back")}</Button></Link>
            {isEmail && <Button variant="outline" size="sm" className="gap-1.5" onClick={() => testSend.mutate()} disabled={testSend.isPending}><Send className="h-4 w-4" /> {t("documentTemplate.btn_test")}</Button>}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4" /> {t("documentTemplate.btn_save")}</Button>
            <Button size="sm" className="gap-1.5" onClick={() => publish.mutate()} disabled={publish.isPending}><CheckCircle2 className="h-4 w-4" /> {t("documentTemplate.btn_publish")}</Button>
          </div>
        }
      />
      <div className="p-4 sm:p-6 max-w-5xl">
        {/* Locale tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {localeTabs.map((l) => (
            <button key={l} onClick={() => setLocale(l)} className={`px-3 py-1 rounded-full text-xs font-medium border ${locale === l ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-white text-muted-foreground border-border hover:bg-muted/50"}`}>{l}</button>
          ))}
          <select className="text-xs border rounded-full px-2 py-1 text-muted-foreground" value="" onChange={(e) => { if (e.target.value) setLocale(e.target.value); }}>
            <option value="">+ {t("documentTemplate.add_locale")}</option>
            {LOCALES.filter((l) => !localeTabs.includes(l)).map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr,220px] gap-5">
          <div className="space-y-4">
            {isEmail && (
              <div className="grid gap-1.5">
                <Label>{t("documentTemplate.f_subject")}</Label>
                <Input value={cur.subject} onChange={(e) => setCur({ subject: e.target.value })} placeholder="{{ref}} …" />
              </div>
            )}
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label>{t("documentTemplate.f_body")}</Label>
                <div className="flex gap-1">
                  <button onClick={() => setMode("html")} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${mode === "html" ? "bg-muted" : "bg-white"}`}><Code className="h-3 w-3" /> HTML</button>
                  <button onClick={() => setMode("preview")} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${mode === "preview" ? "bg-muted" : "bg-white"}`}><Eye className="h-3 w-3" /> {t("documentTemplate.preview")}</button>
                </div>
              </div>
              {mode === "html" ? (
                <Textarea value={cur.body_html} onChange={(e) => setCur({ body_html: e.target.value })} rows={18} className="font-mono text-xs" placeholder="<p>Hi {{name}}, …</p>" />
              ) : (
                <div className="border rounded-md p-4 bg-white min-h-[300px]">
                  {isEmail && <div className="text-xs text-muted-foreground mb-2 pb-2 border-b">{t("documentTemplate.f_subject")}: <span className="font-medium text-foreground">{render(cur.subject, vars)}</span></div>}
                  <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: render(cur.body_html, vars) }} />
                </div>
              )}
            </div>
          </div>

          {/* Variable sidebar */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("documentTemplate.variables")}</p>
            <p className="text-[11px] text-muted-foreground mb-2">{t("documentTemplate.variables_hint")}</p>
            <div className="space-y-1">
              {Object.keys(tpl.variables_schema ?? {}).length === 0 ? (
                <p className="text-xs text-muted-foreground/60">—</p>
              ) : Object.entries(tpl.variables_schema).map(([name, def]) => (
                <button key={name} onClick={() => setCur({ body_html: `${cur.body_html}{{${name}}}` })}
                  className="w-full text-left text-xs border rounded px-2 py-1 hover:bg-muted/50 flex items-center justify-between">
                  <span className="font-mono">{`{{${name}}}`}</span>
                  <span className="text-[10px] text-muted-foreground">{def?.type ?? "string"}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

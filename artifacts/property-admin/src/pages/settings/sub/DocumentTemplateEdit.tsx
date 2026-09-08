import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Send, CheckCircle2, Eye, Code, Type, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";
import { DEFAULT_DOC_LANG, DOC_LOCALES, orderLocales } from "@/lib/docLang";
import {
  VariablePickerButton, VariableSuggestions, useVariableAutocomplete, type VariableDef,
} from "@/components/TemplateVariables";

const API = "/api/v1/document-templates";
// Guest-facing documents (invoice/quote/agreements) ship six locales, ordered
// with the tenant's default document language first (Metheim = 한국어).
const LOCALES = DOC_LOCALES;

interface Translation { locale: string; subject?: string | null; body_html?: string | null }
interface TemplateDetail {
  id: number; kind: string; key: string; name: string; description?: string | null;
  status: string; version: number;
  variables_schema: Record<string, { type?: string; required?: boolean }>;
  translations: Translation[];
}

/** 서버가 돌려주는 변수 카탈로그(routes/document-templates.ts). */
interface CatalogVar { name: string; type: string; sample: string; group: string; used_by?: string[]; used_count?: number }
interface VariableCatalog { declared: CatalogVar[]; auto: CatalogVar[]; related: CatalogVar[] }

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
  // 문자 문안은 HTML 이 아니라 평문이고, 길이가 곧 요금이다(90바이트 초과 = LMS,
  // 약 3배). 그래서 서식 편집기·PDF 미리보기 대신 글자수 계산이 필요하다.
  const isSms = tpl?.kind === "sms";

  const [locale, setLocale] = useState<string>(DEFAULT_DOC_LANG);
  const [drafts, setDrafts] = useState<Record<string, { subject: string; body_html: string }>>({});
  const [mode, setMode] = useState<"visual" | "html" | "preview">("visual");
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();

  // Seed editable drafts from the fetched translations.
  useEffect(() => {
    if (!tpl) return;
    const seed: Record<string, { subject: string; body_html: string }> = {};
    for (const tr of tpl.translations) seed[tr.locale] = { subject: tr.subject ?? "", body_html: tr.body_html ?? "" };
    setDrafts(seed);
    if (tpl.translations.length && !tpl.translations.find((x) => x.locale === DEFAULT_DOC_LANG)) setLocale(orderLocales(tpl.translations.map((x) => x.locale))[0]);
  }, [tpl]);

  const cur = drafts[locale] ?? { subject: "", body_html: "" };
  const setCur = (patch: Partial<{ subject: string; body_html: string }>) =>
    setDrafts((d) => ({ ...d, [locale]: { ...cur, ...patch } }));

  const vars = useMemo(() => {
    const v = sampleVars(tpl?.variables_schema ?? {});
    // {{brand}} 는 문안의 변수 정의에 없다 — 발송 시점에 테넌트 상호로 서버가
    // 채운다(lib/sms.ts). 미리보기에서 비워 두면 "[] 입실 안내" 가 되므로
    // 자리를 지키는 표본값을 넣는다.
    if (!v.brand) v.brand = "브랜드";
    return v;
  }, [tpl]);

  /* 삽입 목록. 서버가 세 묶음으로 갈라 준다 —
       declared 이 문안이 받는 값 · auto 서버가 채움 · related 다른 문안이 쓰는 값.
     related 는 넣으면 발송 코드도 고쳐야 하므로(안 그러면 빈칸) 화면이 그렇게 말한다. */
  const catalog = useQuery({
    queryKey: ["document-template-variables", id],
    queryFn: async () => {
      const res = await apiFetch(`${API}/${id}/variable-catalog`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return ((await res.json()) as { data: VariableCatalog }).data;
    },
    enabled: !!id,
    staleTime: 300_000,
  });

  const variableDefs: VariableDef[] = useMemo(() => {
    const c = catalog.data;
    if (!c) {
      // 카탈로그를 못 받아도 편집은 막지 않는다 — 선언된 변수만으로 목록을 만든다.
      return Object.entries(tpl?.variables_schema ?? {})
        .filter(([name]) => name !== "kakao")
        .map(([name, def]) => ({ name, type: def?.type ?? "string", sample: vars[name] }));
    }
    return [
      ...c.declared.map((v) => ({ name: v.name, type: v.type, sample: vars[v.name] ?? v.sample, group: v.group })),
      ...c.auto.map((v) => ({ name: v.name, type: v.type, sample: v.sample, group: v.group, auto: true })),
      ...c.related.map((v) => ({
        name: v.name, type: v.type, sample: v.sample, group: v.group,
        related: true, usedBy: v.used_by, usedCount: v.used_count,
      })),
    ];
  }, [catalog.data, tpl, vars]);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const ac = useVariableAutocomplete(bodyRef, cur.body_html, (next) => setCur({ body_html: next }), variableDefs);

  /* 문자 길이는 **표본을 치환한 뒤** 재야 한다 — {{변수}} 리터럴로 재면 실제
     발송분이 LMS 로 넘어가도 화면에서는 SMS 로 보인다. 시드 검증기와 같은 규칙. */
  const smsSample = render(cur.body_html, vars);
  const smsSize = useMemo(() => {
    let n = 0;
    for (const ch of smsSample) n += /[\x00-\x7F]/.test(ch) ? 1 : 2;
    return n;
  }, [smsSample]);
  const smsKind = smsSize <= 90 ? "SMS" : smsSize <= 2000 ? "LMS" : "OVER";

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

  // Render the current locale's body to a real branded PDF in the shared
  // preview dialog (the inline preview only shows the body HTML; this shows the
  // final document, with print/download). Sample PDFs have no recipient, so no
  // email button — use "Send test" on email templates instead.
  const openSamplePdf = () => openPreview({
    title: `${tpl?.name ?? t("documentTemplate.btn_sample_pdf")} · ${locale.toUpperCase()}`,
    filename: `${tpl?.key ?? "template"}-${locale}-sample.pdf`,
    source: {
      kind: "api",
      path: `${API}/${id}/test-generate`,
      init: { method: "POST", body: JSON.stringify({ locale }) },
    },
  });

  if (isLoading) return <Layout><p className="p-6 text-sm text-muted-foreground">{t("common.loading")}</p></Layout>;
  if (!tpl) return <Layout><p className="p-6 text-sm text-muted-foreground">{t("documentTemplate.not_found")}</p></Layout>;

  const localeTabs = orderLocales(Array.from(new Set([...tpl.translations.map((x) => x.locale), locale])));

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
            {!isEmail && !isSms && <Button variant="outline" size="sm" className="gap-1.5" onClick={openSamplePdf}><FileText className="h-4 w-4" /> {t("documentTemplate.btn_sample_pdf")}</Button>}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4" /> {t("documentTemplate.btn_save")}</Button>
            <Button size="sm" className="gap-1.5" onClick={() => publish.mutate()} disabled={publish.isPending}><CheckCircle2 className="h-4 w-4" /> {t("documentTemplate.btn_publish")}</Button>
          </div>
        }
      />
      <div className="p-4 sm:p-6 max-w-5xl">
        {/* Locale tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {localeTabs.map((l) => (
            <button key={l} onClick={() => setLocale(l)} className={`px-3 py-1 rounded-full text-xs font-medium border ${locale === l ? "bg-primary/15 text-primary border-primary/20" : "bg-white text-muted-foreground border-border hover:bg-muted/50"}`}>{l}</button>
          ))}
          {!isSms && <select className="text-xs border rounded-full px-2 py-1 text-muted-foreground" value="" onChange={(e) => { if (e.target.value) setLocale(e.target.value); }}>
            <option value="">+ {t("documentTemplate.add_locale")}</option>
            {LOCALES.filter((l) => !localeTabs.includes(l)).map((l) => <option key={l} value={l}>{l}</option>)}
          </select>}
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
                <div className="flex items-center gap-2">
                  <Label>{t("documentTemplate.f_body")}</Label>
                  {mode !== "visual" && (
                    <VariablePickerButton variables={variableDefs} onInsert={ac.insertAtCaret} />
                  )}
                </div>
                {isSms ? (
                  <span className={`text-xs font-mono ${smsKind === "OVER" ? "text-destructive" : smsKind === "LMS" ? "text-amber-600" : "text-muted-foreground"}`}>
                    {smsSize} B · {smsKind === "OVER" ? t("documentTemplate.sms_too_long", "too long") : smsKind}
                  </span>
                ) : (
                <div className="flex gap-1">
                  <button onClick={() => setMode("visual")} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${mode === "visual" ? "bg-muted" : "bg-white"}`}><Type className="h-3 w-3" /> {t("documentTemplate.visual")}</button>
                  <button onClick={() => setMode("html")} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${mode === "html" ? "bg-muted" : "bg-white"}`}><Code className="h-3 w-3" /> HTML</button>
                  <button onClick={() => setMode("preview")} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${mode === "preview" ? "bg-muted" : "bg-white"}`}><Eye className="h-3 w-3" /> {t("documentTemplate.preview")}</button>
                </div>
                )}
              </div>
              {isSms ? (
                <>
                  <Textarea
                    ref={bodyRef}
                    value={cur.body_html}
                    onChange={(e) => setCur({ body_html: e.target.value })}
                    rows={6}
                    placeholder="[{{brand}}] …"
                    {...ac.inputProps}
                  />
                  <VariableSuggestions ac={ac} />
                  <p className="text-xs text-muted-foreground">{t("documentTemplate.sms_hint", "Up to 90 bytes goes as SMS (Korean = 2 bytes per character); longer texts go as LMS at about 3× the cost. Emoji and HTML cannot be sent, and the brand name is filled in automatically as {{brand}}.")}</p>
                  <div className="rounded-2xl border bg-muted/40 p-4 max-w-sm mt-1">
                    <p className="text-[11px] text-muted-foreground mb-1.5">{t("documentTemplate.preview")}</p>
                    <div className="rounded-xl bg-background border px-3 py-2 text-sm whitespace-pre-wrap break-words min-h-[3rem]">
                      {smsSample}
                    </div>
                  </div>
                </>
              ) : mode === "visual" ? (
                <RichTextEditor value={cur.body_html} onChange={(html) => setCur({ body_html: html })} placeholder="Hi {{name}}, …" variables={variableDefs} />
              ) : mode === "html" ? (
                <>
                  <Textarea
                    ref={bodyRef}
                    value={cur.body_html}
                    onChange={(e) => setCur({ body_html: e.target.value })}
                    rows={18}
                    className="font-mono text-xs"
                    placeholder="<p>Hi {{name}}, …</p>"
                    {...ac.inputProps}
                  />
                  <VariableSuggestions ac={ac} />
                </>
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
              {variableDefs.length === 0 ? (
                <p className="text-xs text-muted-foreground/60">—</p>
              ) : variableDefs.filter((v) => !v.related).map((v) => (
                // 종전에는 본문 **맨 끝**에 붙어, 문장 중간에 넣으려면 잘라 옮겨야 했다.
                // 이제 커서 자리에 들어간다(서식 편집기에서는 툴바 버튼을 쓴다).
                <button
                  key={v.name}
                  onMouseDown={(e) => { e.preventDefault(); ac.insertAtCaret(v.name); }}
                  disabled={mode === "visual" && !isSms}
                  title={v.sample ? `→ ${v.sample}` : undefined}
                  className="w-full text-left text-xs border rounded px-2 py-1 hover:bg-muted/50 disabled:opacity-50 flex items-center justify-between"
                >
                  <span className="font-mono">{`{{${v.name}}}`}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {v.auto ? t("templateVars.auto", "auto") : (v.type ?? "string")}
                  </span>
                </button>
              ))}
            </div>
            {variableDefs.some((v) => v.related) && (
              // 관련 변수는 여기 늘어놓지 않는다 — 목록이 길어지면 정작 이 문안이
              // 받는 값을 못 찾는다. 분류가 붙은 팝오버로 보낸다.
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                {t("templateVars.sidebar_more", "{{n}} more variables are used by other templates — open Variables to browse them by category.", {
                  n: variableDefs.filter((v) => v.related).length,
                })}
              </p>
            )}
          </div>
        </div>
      </div>

      <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
    </Layout>
  );
}

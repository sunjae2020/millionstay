/**
 * 서류 제출 — 세입자용 업로드 화면 (토큰 링크, 로그인 없음).
 *
 * 담당자가 요청한 서류가 한 줄씩 서 있고, 각 줄의 버튼이 곧 휴대폰 카메라·파일
 * 선택으로 이어진다. 계정을 만들라고 요구하지 않는 이유는 세대점검표와 같다 —
 * 입주 준비 중인 세입자에게 로그인을 요구하면 결국 카톡으로 사진이 오고, 기록은
 * 개인 대화방에 흩어진다.
 */
import { useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2, FileUp, Loader2, Paperclip } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { DevNavbar, DevFooter } from "@/components/development/DevLayout";
import { isDevelopmentSite } from "@/lib/site-mode";
import { Button } from "@/components/ui/button";
import {
  getDocRequest, submitDocuments, uploadDocument, TenantLinkError,
  type DocRequestItem, type DocRequestView,
} from "@/lib/tenant-link-api";

const DEV_SITE = isDevelopmentSite();

export default function DocumentSubmit() {
  const { t } = useTranslation();
  const [, params] = useRoute("/documents/:token");
  const token = params?.token ?? "";

  const [view, setView] = useState<DocRequestView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getDocRequest(token);
      setView(data);
      setDone(data.status === "completed");
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof TenantLinkError ? e.message : t("docSubmit.load_failed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  async function upload(file: File, docKey: string) {
    setUploading(docKey);
    setError(null);
    try {
      await uploadDocument(token, docKey, file);
      await load();
    } catch (e) {
      setError(e instanceof TenantLinkError ? e.message : t("docSubmit.upload_failed"));
    } finally {
      setUploading(null);
    }
  }

  async function finish() {
    setSubmitting(true);
    setError(null);
    try {
      await submitDocuments(token);
      setDone(true);
    } catch (e) {
      setError(e instanceof TenantLinkError ? e.message : t("docSubmit.submit_failed"));
    } finally {
      setSubmitting(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen flex flex-col bg-background">
      {DEV_SITE ? <DevNavbar /> : <Navbar />}
      <main className="flex-1 w-full mx-auto max-w-2xl px-4 sm:px-6 py-8 sm:py-12">{children}</main>
      {DEV_SITE ? <DevFooter /> : <Footer />}
    </div>
  );

  if (loading) {
    return shell(<div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>);
  }

  if (loadError || !view) {
    return shell(
      <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 text-center">
        <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground" />
        <h1 className="mt-4 text-xl font-bold">{t("docSubmit.unavailable")}</h1>
        <p className="mt-2 text-muted-foreground">{loadError}</p>
      </div>,
    );
  }

  if (done) {
    return shell(
      <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="w-9 h-9 text-primary" />
        </div>
        <h1 className="mt-5 text-2xl font-bold">{t("docSubmit.done_title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("docSubmit.done_desc")}</p>
      </div>,
    );
  }

  const missing = view.items.filter((i) => i.required && !i.submitted);

  return shell(
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("docSubmit.title")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {[view.tenant_name, view.contract_ref].filter(Boolean).join(" · ")}
        </p>
      </div>

      <p className="text-sm text-muted-foreground">{t("docSubmit.intro")}</p>
      {view.note && (
        <div className="rounded-xl border bg-muted/40 p-4 text-sm whitespace-pre-line">{view.note}</div>
      )}

      <ul className="space-y-2">
        {view.items.map((item) => (
          <DocRow
            key={item.key}
            item={item}
            busy={uploading === item.key}
            onPick={() => { targetRef.current = item.key; fileInputRef.current?.click(); }}
          />
        ))}
      </ul>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button className="w-full" onClick={finish} disabled={submitting || missing.length > 0}>
        {submitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
        {t("docSubmit.finish")}
      </Button>
      {missing.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {t("docSubmit.still_missing", { items: missing.map((m) => m.label).join(", ") })}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const key = targetRef.current;
          e.target.value = "";
          if (file && key) void upload(file, key);
        }}
      />
    </div>,
  );
}

function DocRow({ item, busy, onPick }: { item: DocRequestItem; busy: boolean; onPick: () => void }) {
  const { t } = useTranslation();
  return (
    <li className="rounded-xl border bg-card p-4 flex items-center gap-3">
      {item.submitted
        ? <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600" />
        : <Paperclip className="w-5 h-5 shrink-0 text-muted-foreground" />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {item.label}
          {!item.required && <span className="ml-1.5 text-xs font-normal text-muted-foreground">({t("docSubmit.optional")})</span>}
        </p>
        {item.files.length > 0 && (
          <p className="truncate text-xs text-muted-foreground">{item.files.map((f) => f.file_name).join(", ")}</p>
        )}
      </div>
      <Button size="sm" variant={item.submitted ? "outline" : "default"} onClick={onPick} disabled={busy}>
        {busy
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <><FileUp className="w-4 h-4 mr-1.5" />{item.submitted ? t("docSubmit.replace") : t("docSubmit.upload")}</>}
      </Button>
    </li>
  );
}

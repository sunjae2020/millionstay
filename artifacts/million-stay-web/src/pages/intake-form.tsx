/**
 * 입주 신청서 — 세입자가 직접 채우는 화면 (토큰 링크, 로그인 없음).
 *
 * 계약서에는 임대 조건이 다 들어 있다. 정작 입주 당일 관리사무소가 묻는 것들 —
 * 비상 시 연락할 사람, 차량 등록, 반려동물, 실제 거주 인원 — 은 계약서에 없고
 * 지금까지 전화·카톡으로 오갔다. 이 화면이 그 자리를 대신한다.
 *
 * 알고 있는 값은 미리 채워 두고 세입자는 "고칠 것만" 고친다. 빈 양식을 처음부터
 * 다 적게 하면 이미 계약서에 있는 정보를 두 번 묻는 꼴이고, 그 순간 사람들은
 * 대충 적는다.
 */
import { useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { useTranslation } from "react-i18next";
import { AlertCircle, Camera, CheckCircle2, Loader2 } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { DevNavbar, DevFooter } from "@/components/development/DevLayout";
import { isDevelopmentSite } from "@/lib/site-mode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getIntake, submitIntake, uploadIntakePhoto, TenantLinkError, type IntakeView,
} from "@/lib/tenant-link-api";

const DEV_SITE = isDevelopmentSite();

/** 화면에 서는 순서. 필수는 이름·연락처·비상연락처 셋뿐이다. */
const SECTIONS: Array<{ key: string; fields: Array<{ name: string; type?: string; required?: boolean }> }> = [
  {
    key: "person",
    fields: [
      { name: "last_name", required: true },
      { name: "first_name" },
      { name: "mobile_number", type: "tel", required: true },
      { name: "email", type: "email" },
      { name: "date_of_birth", type: "date" },
      { name: "nationality" },
    ],
  },
  {
    key: "address",
    fields: [
      { name: "address_line1" },
      { name: "suburb" },
      { name: "state" },
      { name: "postcode" },
      { name: "country" },
    ],
  },
  {
    key: "emergency",
    fields: [
      { name: "emergency_contact_name", required: true },
      { name: "emergency_contact_relation" },
      { name: "emergency_contact_phone", type: "tel", required: true },
    ],
  },
  {
    key: "stay",
    fields: [
      { name: "move_in_date", type: "date" },
      { name: "cohabitants" },
      { name: "vehicle_no" },
      { name: "pet_note" },
    ],
  },
];

export default function IntakeForm() {
  const { t } = useTranslation();
  const [, params] = useRoute("/intake/:token");
  const token = params?.token ?? "";

  const [view, setView] = useState<IntakeView | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getIntake(token);
        if (cancelled) return;
        setView(data);
        setDone(data.status === "completed");
        setValues(Object.fromEntries(
          Object.entries(data.values ?? {}).map(([k, v]) => [k, v == null ? "" : String(v)]),
        ));
        setLoadError(null);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof TenantLinkError ? e.message : t("intake.load_failed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const set = (name: string, value: string) => setValues((v) => ({ ...v, [name]: value }));

  async function pickPhoto(file: File) {
    setPhotoBusy(true);
    setError(null);
    try {
      const { url } = await uploadIntakePhoto(token, file);
      set("profile_photo_url", url);
    } catch (e) {
      setError(e instanceof TenantLinkError ? e.message : t("intake.photo_failed"));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await submitIntake(token, values);
      setDone(true);
    } catch (e) {
      setError(e instanceof TenantLinkError ? e.message : t("intake.submit_failed"));
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
        <h1 className="mt-4 text-xl font-bold">{t("intake.unavailable")}</h1>
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
        <h1 className="mt-5 text-2xl font-bold">{t("intake.done_title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("intake.done_desc")}</p>
      </div>,
    );
  }

  return shell(
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("intake.title")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {[view.tenant_name, view.contract_ref].filter(Boolean).join(" · ")}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">{t("intake.intro")}</p>
      {view.note && <div className="rounded-xl border bg-muted/40 p-4 text-sm whitespace-pre-line">{view.note}</div>}

      {/* 증명사진 */}
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <p className="text-sm font-medium">{t("intake.photo_title")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("intake.photo_hint")}</p>
        <div className="mt-3 flex items-center gap-4">
          {values["profile_photo_url"]
            ? <img src={values["profile_photo_url"]} alt="" className="h-28 w-22 rounded-lg border object-cover" style={{ width: "5.5rem" }} />
            : <div className="flex h-28 w-22 items-center justify-center rounded-lg border border-dashed text-muted-foreground" style={{ width: "5.5rem" }}>
                <Camera className="h-6 w-6" />
              </div>}
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={photoBusy}>
            {photoBusy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Camera className="w-4 h-4 mr-1.5" />}
            {values["profile_photo_url"] ? t("intake.photo_replace") : t("intake.photo_upload")}
          </Button>
        </div>
      </section>

      {SECTIONS.map((section) => (
        <section key={section.key} className="rounded-xl border bg-card p-4 sm:p-5">
          <p className="text-sm font-medium">{t(`intake.section_${section.key}`)}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {section.fields.map((f) => (
              <label key={f.name} className="grid gap-1.5 text-sm">
                <span className="text-muted-foreground">
                  {t(`intake.f_${f.name}`)}
                  {f.required && <span className="ml-0.5 text-red-600">*</span>}
                </span>
                <Input
                  type={f.type ?? "text"}
                  value={values[f.name] ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                  placeholder={t(`intake.ph_${f.name}`, "")}
                />
              </label>
            ))}
          </div>
        </section>
      ))}

      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground">{t("intake.f_note")}</span>
        <Textarea rows={3} value={values["note"] ?? ""} onChange={(e) => set("note", e.target.value)}
          placeholder={t("intake.ph_note")} />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button className="w-full" onClick={submit} disabled={submitting}>
        {submitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
        {t("intake.submit")}
      </Button>
      <p className="text-center text-xs text-muted-foreground">{t("intake.privacy_note")}</p>

      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void pickPhoto(file);
        }} />
    </div>,
  );
}

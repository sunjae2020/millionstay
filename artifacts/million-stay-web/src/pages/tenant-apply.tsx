/**
 * 임차 신청서 — 계약보다 먼저 서는 유일한 화면 (로그인 없음).
 *
 * 나머지 세입자 링크는 모두 계약이 있어야 발급된다. 이 화면에는 계약이 없다 —
 * 아직 심사 전이고, 임차인이 될지도 모르는 사람이다. 여기서 받는 것은 방을
 * 배정할 수 있는지 가르는 값들뿐이고, 나머지는 계약이 정해진 뒤로 미룬다.
 *
 * 두 갈래로 열린다.
 *   /apply/:token  담당자가 문의에 붙여 보낸 링크 — 아는 값이 미리 채워져 있다.
 *   /apply         홈페이지에 상시 열려 있는 폼 — 제출하면 문의가 함께 만들어진다.
 *
 * **신분증과 주민등록번호는 이 화면에서 받지 않는다.** 심사에서 떨어질 사람의
 * 주민등록번호까지 쌓이기 때문이다. 그 둘은 계약이 정해진 뒤 서류 제출 링크로
 * 받는다 — 화면에도 그렇게 적어 둔다. 묻지 않는 이유를 말해 주지 않으면 사람들은
 * 양식이 부실하다고 읽는다.
 */
import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { DevNavbar, DevFooter } from "@/components/development/DevLayout";
import { isDevelopmentSite } from "@/lib/site-mode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getApplication, submitApplication, submitPublicApplication,
  TenantLinkError, type ApplicationView,
} from "@/lib/tenant-link-api";

const DEV_SITE = isDevelopmentSite();

/**
 * 메신저 종류. 값은 연락처(contacts.sns_type)에 그대로 저장되는 식별자라
 * 번역하지 않고 표기만 옮긴다 — 입주 신청서(intake-form.tsx)와 같은 목록이다.
 */
const SNS_TYPES = [
  "KakaoTalk", "LINE", "WhatsApp", "WeChat", "Telegram", "Instagram", "Facebook", "Other",
] as const;

const YES_NO = ["yes", "no"] as const;

interface FieldSpec {
  name: string;
  type?: string;
  required?: boolean;
  options?: readonly string[];
  /** 선택지 라벨의 번역 키 접두어. 없으면 값을 그대로 쓴다. */
  optionPrefix?: string;
}

const SECTIONS: Array<{ key: string; fields: FieldSpec[] }> = [
  {
    key: "person",
    fields: [
      { name: "last_name", required: true },
      { name: "first_name" },
      { name: "mobile_number", type: "tel", required: true },
      { name: "email", type: "email", required: true },
      { name: "sns_type", options: SNS_TYPES, optionPrefix: "sns" },
      { name: "sns_id" },
      { name: "date_of_birth", type: "date" },
      { name: "nationality" },
    ],
  },
  // 재직·재학은 한국 임대차 심사에서 실제로 묻는 값이다. 증명서는 계약 단계에서 받는다.
  { key: "work", fields: [{ name: "company_name" }, { name: "job_title" }] },
  {
    key: "address",
    fields: [
      { name: "address_line1" }, { name: "suburb" }, { name: "state" },
      { name: "postcode" }, { name: "country" },
    ],
  },
  {
    key: "wish",
    fields: [
      { name: "preferred_move_in_date", type: "date" },
      { name: "preferred_duration_months", type: "number" },
      { name: "preferred_space_type" },
      { name: "preferred_budget" },
    ],
  },
  {
    key: "living",
    fields: [
      { name: "household_size", type: "number" },
      { name: "has_vehicle", options: YES_NO, optionPrefix: "yn" },
      { name: "has_pet", options: YES_NO, optionPrefix: "yn" },
    ],
  },
];

export default function TenantApply() {
  const { t, i18n } = useTranslation();
  const [, params] = useRoute("/apply/:token");
  const token = params?.token ?? "";
  const linked = !!token;

  const [view, setView] = useState<ApplicationView | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(linked);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ref: string | null } | null>(null);

  useEffect(() => {
    if (!linked) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getApplication(token);
        if (cancelled) return;
        setView(data);
        if (data.status === "completed") setDone({ ref: data.lead_ref });
        setValues(Object.fromEntries(
          Object.entries(data.values ?? {}).map(([k, v]) => [k, v == null ? "" : String(v)]),
        ));
        setLoadError(null);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof TenantLinkError ? e.message : t("apply.load_failed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, linked]);

  const set = (name: string, value: string) => setValues((v) => ({ ...v, [name]: value }));

  async function submit() {
    if (!consent) { setError(t("apply.error_consent")); return; }
    setSubmitting(true);
    setError(null);
    try {
      if (linked) {
        await submitApplication(token, values);
        setDone({ ref: view?.lead_ref ?? null });
      } else {
        const r = await submitPublicApplication(values, i18n.language);
        setDone({ ref: r.lead_ref });
      }
    } catch (e) {
      setError(e instanceof TenantLinkError ? e.message : t("apply.submit_failed"));
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

  if (loadError) {
    return shell(
      <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 text-center">
        <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground" />
        <h1 className="mt-4 text-xl font-bold">{t("apply.unavailable")}</h1>
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
        <h1 className="mt-5 text-2xl font-bold">{t("apply.done_title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("apply.done_desc")}</p>
        {done.ref && (
          <p className="mt-4 text-sm">
            <span className="text-muted-foreground">{t("apply.done_ref")}</span>{" "}
            <span className="font-semibold tabular-nums">{done.ref}</span>
          </p>
        )}
      </div>,
    );
  }

  return shell(
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("apply.title")}</h1>
        {(view?.tenant_name || view?.lead_ref) && (
          <p className="mt-1.5 text-sm text-muted-foreground">
            {[view?.tenant_name, view?.lead_ref].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{t("apply.intro")}</p>
      {view?.note && <div className="rounded-xl border bg-muted/40 p-4 text-sm whitespace-pre-line">{view.note}</div>}

      {/* 무엇을 묻지 않는지 먼저 말한다 — 신분증을 왜 안 받느냐는 질문이 실제로 온다. */}
      <div className="flex gap-3 rounded-xl border bg-muted/40 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">{t("apply.privacy_scope")}</p>
      </div>

      {SECTIONS.map((section) => (
        <section key={section.key} className="rounded-xl border bg-card p-4 sm:p-5">
          <p className="text-sm font-medium">{t(`apply.section_${section.key}`)}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {section.fields.map((f) => (
              <label key={f.name} className="grid gap-1.5 text-sm">
                <span className="text-muted-foreground">
                  {t(`apply.f_${f.name}`)}
                  {f.required && <span className="ml-0.5 text-red-600">*</span>}
                </span>
                {f.options ? (
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={values[f.name] ?? ""}
                    onChange={(e) => set(f.name, e.target.value)}
                  >
                    <option value="">—</option>
                    {f.options.map((o) => (
                      <option key={o} value={o}>
                        {f.optionPrefix ? t(`apply.${f.optionPrefix}_${o.toLowerCase()}`, o) : o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type={f.type ?? "text"}
                    value={values[f.name] ?? ""}
                    onChange={(e) => set(f.name, e.target.value)}
                    placeholder={t(`apply.ph_${f.name}`, "")}
                  />
                )}
              </label>
            ))}
          </div>
        </section>
      ))}

      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground">{t("apply.f_note")}</span>
        <Textarea rows={3} value={values["note"] ?? ""} onChange={(e) => set("note", e.target.value)}
          placeholder={t("apply.ph_note")} />
      </label>

      <label className="flex items-start gap-2.5 rounded-xl border bg-card p-4 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4" checked={consent}
          onChange={(e) => setConsent(e.target.checked)} />
        <span>
          {t("apply.consent")}
          <span className="ml-0.5 text-red-600">*</span>
        </span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button className="w-full" onClick={submit} disabled={submitting}>
        {submitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
        {t("apply.submit")}
      </Button>
      <p className="text-center text-xs text-muted-foreground">{t("apply.next_step")}</p>
    </div>,
  );
}

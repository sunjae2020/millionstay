import { useState, FormEvent } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { apiPost } from "@/lib/api";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { APP_NAME } from "@/lib/appName";

const BRAND = "#E8621A";

const SERVICE_OPTIONS = ["Cleaning", "Maintenance", "Linen", "Inspection", "Other"];

interface ApplyResponse {
  success: boolean;
  lead_ref: string;
  id?: number;
}

export default function ServiceHostApplicationPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    business_name: "",
    abn: "",
    service_area: "",
    years_experience: "",
    message: "",
  });
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<ApplyResponse | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function toggleService(name: string) {
    setServiceTypes((curr) =>
      curr.includes(name) ? curr.filter((n) => n !== name) : [...curr, name],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (serviceTypes.length === 0) {
      setError(t("apply.service_types_required"));
      return;
    }
    setLoading(true);
    try {
      const data = await apiPost<ApplyResponse>("/v1/public/service-host-applications", {
        ...form,
        service_types: serviceTypes,
        years_experience: form.years_experience ? Number(form.years_experience) : null,
      });
      setSubmitted(data);
    } catch (err: any) {
      setError(err.message ?? t("apply.submit_error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <a className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
              <ArrowLeft className="w-4 h-4" />
              {t("apply.back_to_login")}
            </a>
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="text-center mb-8">
          {import.meta.env.VITE_LOGO_MODE === "text" ? (
            <span className="block font-display font-extrabold tracking-tight text-primary text-xl whitespace-nowrap mx-auto mb-6">{APP_NAME}</span>
          ) : (
            <img
              src={`${import.meta.env.BASE_URL}logo-horizontal.png`}
              alt={APP_NAME}
              className="h-9 w-auto mx-auto mb-6"
            />
          )}
          <h1 className="text-3xl font-bold text-slate-900">{t("apply.title")}</h1>
          <p className="text-slate-500 text-sm mt-2 max-w-xl mx-auto">{t("apply.subtitle")}</p>
        </div>

        {submitted ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-green-50 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">{t("apply.success_title")}</h2>
            <p className="text-slate-600 text-sm mt-2 max-w-md mx-auto">{t("apply.success_message")}</p>
            <p className="text-slate-500 text-xs mt-4">
              {t("apply.reference_label")}{" "}
              <span className="font-mono font-semibold text-slate-800">{submitted.lead_ref}</span>
            </p>
            <Link href="/">
              <a
                className="inline-block mt-6 h-11 px-6 leading-[44px] rounded-lg text-sm font-semibold text-white shadow-md"
                style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #FF8C3A 100%)` }}
              >
                {t("apply.back_to_login")}
              </a>
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("apply.first_name")} required>
                <input required value={form.first_name} onChange={(e) => update("first_name", e.target.value)} className={inputCls} />
              </Field>
              <Field label={t("apply.last_name")} required>
                <input required value={form.last_name} onChange={(e) => update("last_name", e.target.value)} className={inputCls} />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("apply.email")} required>
                <input type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} className={inputCls} />
              </Field>
              <Field label={t("apply.phone")}>
                <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} className={inputCls} placeholder="+61 ..." />
              </Field>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                {t("apply.section_services")}
              </p>

              <Field label={t("apply.service_types")} required>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_OPTIONS.map((opt) => {
                    const active = serviceTypes.includes(opt);
                    return (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => toggleService(opt)}
                        className={`px-3.5 py-2 rounded-lg text-sm border transition-colors ${
                          active
                            ? "border-transparent text-white shadow-sm"
                            : "border-slate-200 text-slate-700 bg-white hover:border-slate-300"
                        }`}
                        style={active ? { background: BRAND } : undefined}
                      >
                        {t(`apply.service_${opt.toLowerCase()}`)}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <Field label={t("apply.business_name")}>
                  <input value={form.business_name} onChange={(e) => update("business_name", e.target.value)} className={inputCls} />
                </Field>
                <Field label={t("apply.abn")}>
                  <input value={form.abn} onChange={(e) => update("abn", e.target.value)} className={inputCls} placeholder={t("apply.abn_placeholder")} />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <Field label={t("apply.service_area")}>
                  <input value={form.service_area} onChange={(e) => update("service_area", e.target.value)} className={inputCls} placeholder="Melbourne CBD" />
                </Field>
                <Field label={t("apply.years_experience")}>
                  <input type="number" min={0} value={form.years_experience} onChange={(e) => update("years_experience", e.target.value)} className={inputCls} />
                </Field>
              </div>
            </div>

            <Field label={t("apply.message")}>
              <textarea
                rows={4}
                value={form.message}
                onChange={(e) => update("message", e.target.value)}
                className={`${inputCls} h-auto py-2 resize-none`}
                placeholder={t("apply.message_placeholder")}
              />
            </Field>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 shadow-md"
              style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #FF8C3A 100%)` }}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> {t("apply.submitting")}</>
              ) : (
                t("apply.submit")
              )}
            </button>

            <p className="text-xs text-slate-400 text-center pt-2">
              {t("apply.privacy_note")}{" "}
              <a
                href="https://www.millionstay.com/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-slate-600"
              >
                {t("apply.privacy_policy_link")}
              </a>
            </p>
          </form>
        )}
      </main>
    </div>
  );
}

const inputCls =
  "w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#E8621A] focus:border-transparent";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { ChevronRight, Send, CalendarRange } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { submitShortTermApplication } from "@/lib/short-term-api";
import { DateInput } from "@/components/ui/date-input";

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-primary">*</span>}
      </span>
      {children}
    </label>
  );
}

export default function ForShortTerm() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [f, setF] = useState({
    first_name: "", last_name: "", email: "", phone: "", nationality: "",
    check_in: "", check_out: "", guests: "", preferred_area: "", property_type: "",
    budget_weekly: "", move_in_flexible: false, notes: "", terms_accepted: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string | boolean) => setF((prev) => ({ ...prev, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!f.first_name || !f.last_name || !f.email) {
      setError(t("short_term.error_required"));
      return;
    }
    if (!f.terms_accepted) {
      setError(t("short_term.error_terms"));
      return;
    }
    setSubmitting(true);
    try {
      const r = await submitShortTermApplication({
        first_name: f.first_name,
        last_name: f.last_name,
        email: f.email,
        phone: f.phone || undefined,
        nationality: f.nationality || undefined,
        check_in: f.check_in || undefined,
        check_out: f.check_out || undefined,
        guests: f.guests ? Number(f.guests) : undefined,
        preferred_area: f.preferred_area || undefined,
        property_type: f.property_type || undefined,
        preferences: {
          budget_weekly: f.budget_weekly || undefined,
          move_in_flexible: f.move_in_flexible,
          notes: f.notes || undefined,
        },
        terms_accepted: f.terms_accepted,
      });
      // Continue to e-signature (applicant signs the application / T&C).
      setLocation(`/sign/${r.signing_token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("short_term.error_submit_failed"));
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* Hero */}
      <div className="relative bg-gradient-to-br from-primary/90 to-primary text-white">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="flex items-center gap-2 mb-3 text-white/80">
            <CalendarRange className="h-5 w-5" />
            <span className="text-sm font-medium uppercase tracking-wide">{t("short_term.eyebrow")}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">{t("short_term.hero_title")}</h1>
          <p className="mt-3 text-white/85 leading-relaxed">{t("short_term.hero_lead")}</p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="max-w-3xl mx-auto w-full px-6 py-3 flex items-center gap-1.5 text-xs text-gray-400">
        <Link href="/" className="hover:text-primary transition-colors">{t("short_term.breadcrumb_home")}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-600 font-medium">{t("short_term.breadcrumb")}</span>
      </div>

      {/* Form */}
      <section className="max-w-3xl mx-auto w-full px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Applicant */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">{t("short_term.section_applicant")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("short_term.label_first_name")} required>
                <input className={inputCls} value={f.first_name} onChange={(e) => set("first_name", e.target.value)} />
              </Field>
              <Field label={t("short_term.label_last_name")} required>
                <input className={inputCls} value={f.last_name} onChange={(e) => set("last_name", e.target.value)} />
              </Field>
              <Field label={t("short_term.label_email")} required>
                <input type="email" className={inputCls} value={f.email} onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field label={t("short_term.label_phone")}>
                <input className={inputCls} value={f.phone} onChange={(e) => set("phone", e.target.value)} />
              </Field>
              <Field label={t("short_term.label_nationality")}>
                <input className={inputCls} value={f.nationality} onChange={(e) => set("nationality", e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Stay details */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">{t("short_term.section_stay")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("short_term.label_check_in")}>
                <DateInput className={inputCls} value={f.check_in} onChange={(v) => set("check_in", v)} />
              </Field>
              <Field label={t("short_term.label_check_out")}>
                <DateInput className={inputCls} value={f.check_out} onChange={(v) => set("check_out", v)} />
              </Field>
              <Field label={t("short_term.label_guests")}>
                <input type="number" min={1} className={inputCls} value={f.guests} onChange={(e) => set("guests", e.target.value)} />
              </Field>
              <Field label={t("short_term.label_preferred_area")}>
                <input className={inputCls} value={f.preferred_area} onChange={(e) => set("preferred_area", e.target.value)} />
              </Field>
              <Field label={t("short_term.label_property_type")}>
                <input className={inputCls} value={f.property_type} onChange={(e) => set("property_type", e.target.value)} />
              </Field>
              <Field label={t("short_term.label_budget_weekly")}>
                <input className={inputCls} value={f.budget_weekly} onChange={(e) => set("budget_weekly", e.target.value)} placeholder={t("short_term.placeholder_budget")} />
              </Field>
            </div>
            <label className="mt-4 flex items-center gap-2.5 text-sm text-gray-700">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
                checked={f.move_in_flexible} onChange={(e) => set("move_in_flexible", e.target.checked)} />
              {t("short_term.label_move_in_flexible")}
            </label>
            <div className="mt-4">
              <Field label={t("short_term.label_notes")}>
                <textarea rows={4} className={inputCls} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder={t("short_term.placeholder_notes")} />
              </Field>
            </div>
          </div>

          {/* Terms */}
          <div>
            <label className="flex items-start gap-2.5 text-sm text-gray-700">
              <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
                checked={f.terms_accepted} onChange={(e) => set("terms_accepted", e.target.checked)} />
              <span>{t("short_term.terms_label")}</span>
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-col items-start gap-2">
            <button type="submit" disabled={submitting}
              className="inline-flex items-center gap-2 bg-primary text-white px-7 py-3 rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
              <Send className="h-4 w-4" />
              {submitting ? t("short_term.submitting") : t("short_term.submit")}
            </button>
            <p className="text-xs text-gray-500">{t("short_term.submit_hint")}</p>
          </div>
        </form>
      </section>

      <Footer />
    </div>
  );
}

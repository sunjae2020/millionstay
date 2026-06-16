import { useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { getApiBase } from "@/lib/api-base";
import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HS, HS_FONT } from "@/lib/homestay-theme";
import { usePageContent, useHomestaySeo } from "@/lib/usePageContent";

// 5. CONTACT US — content from the Million Homestay site-content doc (page 5).
// Reuses the existing public contact endpoint (POST /v1/public/contact-inquiries),
// mapping the "I am a" role to `subject`.
const ROLE_VALUES = ["Host family", "Student", "Agent or institute", "Other"];

export default function HomestayContact() {
  const { t } = useTranslation();
  const pc = usePageContent("homestay-contact");
  useHomestaySeo("homestay-contact", { titleFallback: t("homestay.contact.layout_title") });
  const ROLES = [
    { value: "Host family", label: t("homestay.contact.role_host_family") },
    { value: "Student", label: t("homestay.contact.role_student") },
    { value: "Agent or institute", label: t("homestay.contact.role_agent_or_institute") },
    { value: "Other", label: t("homestay.contact.role_other") },
  ];

  const SHORTCUTS = [
    { label: t("homestay.contact.shortcut_apply_label"), href: "/students/apply", note: t("homestay.contact.shortcut_apply_note") },
    { label: t("homestay.contact.shortcut_host_label"), href: "/for-homestay-host", note: t("homestay.contact.shortcut_host_note") },
    { label: t("homestay.contact.shortcut_partner_label"), href: "/partners", note: t("homestay.contact.shortcut_partner_note") },
  ];

  const [form, setForm] = useState({ first_name: "", email: "", subject: ROLE_VALUES[0], message: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.first_name || !form.email || !form.message) {
      setError(t("homestay.contact.error_missing_fields"));
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${getApiBase()}/api/v1/public/contact-inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: "",
          email: form.email,
          subject: `[Homestay] ${form.subject}`,
          message: form.message,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? t("homestay.contact.error_failed_to_send"));
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("homestay.contact.error_failed_try_again"));
    } finally {
      setSending(false);
    }
  }

  return (
    <HomestayLayout title={t("homestay.contact.layout_title")}>
      <section className="max-w-5xl mx-auto px-5 py-16 md:py-20">
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>{pc("heading", t("homestay.contact.heading"))}</h1>
          <p className="mt-3 text-gray-600">{pc("subheading", t("homestay.contact.subheading"))}</p>
          <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-x-6 gap-y-1 text-sm text-gray-600">
            <span><span className="font-medium">{t("homestay.contact.email_label")}</span>{" "}
              <a href="mailto:millionstay.com@gmail.com" className="hover:underline" style={{ color: HS.brand }}>millionstay.com@gmail.com</a>
            </span>
            <span><span className="font-medium">{t("homestay.contact.location_label")}</span> {pc("location_value", t("homestay.contact.location_value"))}</span>
          </div>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {SHORTCUTS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group rounded-xl p-4 flex items-center justify-between transition-transform hover:-translate-y-0.5 motion-reduce:transform-none"
              style={{ backgroundColor: HS.apricot }}
            >
              <span>
                <span className="block text-xs" style={{ color: HS.inkMuted }}>{s.note}</span>
                <span className="font-semibold group-hover:underline underline-offset-4 decoration-2" style={{ color: HS.navy, textDecorationColor: HS.teal }}>{s.label}</span>
              </span>
              <ArrowRight className="w-4 h-4" style={{ color: HS.orange }} />
            </Link>
          ))}
        </div>

        <div className="mt-12 max-w-xl mx-auto">
          {done ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto" style={{ color: HS.brand }} />
              <h2 className="mt-4 text-xl font-bold" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>{t("homestay.contact.success_heading")}</h2>
              <p className="mt-2 text-gray-600">{t("homestay.contact.success_body")}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("homestay.contact.field_name")}</label>
                <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8621A] focus-visible:ring-2 focus-visible:ring-[#E8621A]/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("homestay.contact.field_email")}</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8621A] focus-visible:ring-2 focus-visible:ring-[#E8621A]/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("homestay.contact.field_i_am_a")}</label>
                <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-[#E8621A] focus-visible:ring-2 focus-visible:ring-[#E8621A]/30">
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("homestay.contact.field_message")}</label>
                <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={5} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#E8621A] focus-visible:ring-2 focus-visible:ring-[#E8621A]/30" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={sending} className="w-full py-3 rounded-full font-semibold text-white inline-flex items-center justify-center gap-2 transition-colors hover:brightness-95 disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#E8621A]" style={{ backgroundColor: HS.brand }}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("homestay.contact.submit")}
              </button>
              <p className="text-xs text-gray-500">
                {t("homestay.contact.privacy_notice")}{" "}
                <Link href="/homestay/privacy" className="underline" style={{ color: HS.brand }}>{t("homestay.contact.privacy_policy_link")}</Link>.
              </p>
            </form>
          )}
        </div>
      </section>
    </HomestayLayout>
  );
}

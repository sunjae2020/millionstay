import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getApiBase } from "@/lib/api-base";
import { useSupportEmail } from "@/lib/guest-api";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Mail, ChevronRight, Facebook, Instagram, Youtube, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import heroBg from "@assets/MS_Homepage_Photo_1920x1080_1775403929888.jpg";

function fade(delay = 0) {
  return { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay } };
}

export default function Contact() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const supportEmail = useSupportEmail();
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);

  const SUBJECTS = [
    { key: "subject_general", value: t("contact_page.subject_general") },
    { key: "subject_booking", value: t("contact_page.subject_booking") },
    { key: "subject_stay", value: t("contact_page.subject_stay") },
    { key: "subject_visa", value: t("contact_page.subject_visa") },
    { key: "subject_agent", value: t("contact_page.subject_agent") },
    { key: "subject_other", value: t("contact_page.subject_other") },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name || !form.email || !form.message) {
      toast({ title: t("contact_page.fill_required"), variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/v1/public/contact-inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to send");
      }
      toast({ title: t("contact_page.send_success_title"), description: t("contact_page.send_success_desc") });
      setForm({ first_name: "", last_name: "", email: "", subject: "", message: "" });
    } catch (err) {
      toast({
        title: t("contact_page.send_failed"),
        description: err instanceof Error ? err.message : t("contact_page.send_failed_desc"),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* Banner */}
      <div className="relative h-52 md:h-64 overflow-hidden">
        <img src={heroBg} alt={t("contact_page.hero_title")} className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/50" />
        <div className="absolute inset-0 flex flex-col items-start justify-end px-8 pb-8 max-w-7xl mx-auto w-full">
          <p className="font-cursive text-white/70 text-sm italic mb-1">{t("contact_page.hero_tagline")}</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white italic">{t("contact_page.hero_title")}</h1>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto w-full px-6 py-3 flex items-center gap-1.5 text-xs text-gray-400">
        <Link href="/" className="hover:text-primary">{t("contact_page.breadcrumb_home")}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-600">{t("contact_page.breadcrumb")}</span>
      </div>

      {/* Content */}
      <section className="max-w-7xl mx-auto w-full px-6 py-12">
        <div className="flex flex-col md:flex-row gap-12">
          {/* Left: Get in touch */}
          <motion.div {...fade()} className="md:w-72 shrink-0">
            <h2 className="text-xl font-bold text-gray-900 mb-6">{t("contact_page.get_in_touch")}</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-8">
              {t("contact_page.intro")}
            </p>

            <div className="space-y-5">
              <div className="flex gap-3 items-start">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Mail className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">{t("contact_page.email")}</p>
                  <a href={`mailto:${supportEmail}`} className="text-sm text-gray-700 hover:text-primary">
                    {supportEmail}
                  </a>
                </div>
              </div>
            </div>

            {(() => {
              const socials = [
                { icon: Facebook, href: "https://www.facebook.com/millionstay", label: "Facebook" },
                { icon: Instagram, href: "https://www.instagram.com/millionstay", label: "Instagram" },
                { icon: Youtube, href: "https://www.youtube.com/@millionstay", label: "YouTube" },
                { icon: Twitter, href: "https://twitter.com/millionstay", label: "Twitter" },
              ].filter((s) => s.href);
              if (socials.length === 0) return null;
              return (
                <div className="mt-10">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t("contact_page.social_heading")}</p>
                  <div className="flex gap-3">
                    {socials.map(({ icon: Icon, href, label }) => (
                      <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                        className="w-9 h-9 rounded-full bg-primary/10 hover:bg-primary flex items-center justify-center group transition-colors">
                        <Icon className="h-4 w-4 text-primary group-hover:text-white transition-colors" />
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}
          </motion.div>

          {/* Right: Form */}
          <motion.div {...fade(0.1)} className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 mb-6">{t("contact_page.send_us_message")}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">{t("contact_page.first_name")} <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                    placeholder={t("contact_page.first_name_placeholder")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">{t("contact_page.last_name")}</label>
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                    placeholder={t("contact_page.last_name_placeholder")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">{t("contact_page.email_label")} <span className="text-red-400">*</span></label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder={t("contact_page.email_placeholder")}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">{t("contact_page.subject_label")}</label>
                <select
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-gray-700"
                >
                  <option value="">{t("contact_page.select_subject")}</option>
                  {SUBJECTS.map((s) => <option key={s.key} value={s.value}>{s.value}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">{t("contact_page.message_label")} <span className="text-red-400">*</span></label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  rows={5}
                  placeholder={t("contact_page.message_placeholder")}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={sending}
                className="bg-primary hover:bg-primary/90 text-white font-semibold px-10 py-2.5 rounded-lg"
              >
                {sending ? t("contact_page.sending") : t("contact_page.submit")}
              </Button>
              <p className="text-xs text-gray-500">
                {t("contact_page.privacy_notice")}{" "}
                <Link href="/privacy-policy" className="text-primary hover:underline">{t("contact_page.privacy_link")}</Link>
              </p>
            </form>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

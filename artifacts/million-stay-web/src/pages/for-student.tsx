import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useListPublicSpaces, getListPublicSpacesQueryKey } from "@/lib/guest-api";
import { SpaceCard } from "@/components/space-card";
import {
  ChevronRight, CheckCircle2, Star, BookOpen, Shield,
  Wifi, MapPin, Clock, Send,
  HeartHandshake,
} from "lucide-react";
import heroBg from "@assets/MS_Homepage_Photo_1920x1080_1775403929888.jpg";

function fade(delay = 0) {
  return { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.48, delay } };
}

const BENEFITS_ICONS = [Shield, HeartHandshake, Clock, MapPin, Wifi, BookOpen];
const BENEFITS_KEYS = ["b1", "b2", "b3", "b4", "b5", "b6"];

const STEPS_KEYS = ["s1", "s2", "s3"];
const STEPS_NUMS = ["01", "02", "03"];

const TESTIMONIALS_DATA = [
  { name: "Ji-woo Kim", flag: "🇰🇷", uni: "Swinburne University", textKey: "t1_text", rating: 5 },
  { name: "Yuki Tanaka", flag: "🇯🇵", uni: "University of Melbourne", textKey: "t2_text", rating: 5 },
  { name: "Mei Lin", flag: "🇨🇳", uni: "RMIT University", textKey: "t3_text", rating: 5 },
];

const FAQS_KEYS = ["f1", "f2", "f3", "f4"];

export default function ForStudent() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", university: "", visa: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: spacesData, isLoading } = useListPublicSpaces({ limit: 6 }, {
    query: { queryKey: getListPublicSpacesQueryKey({ limit: 6 }) },
  });
  const spaces = (spacesData?.data ?? []) as Parameters<typeof SpaceCard>[0]["space"][];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const base = import.meta.env.VITE_API_URL ?? "";
      const res = await fetch(`${base}/api/v1/public/student-inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to send");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const STATS = [
    { num: "500+", labelKey: "stat1_label" },
    { num: "12+", labelKey: "stat2_label" },
    { num: "5", labelKey: "stat3_label" },
    { num: "24/7", labelKey: "stat4_label" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden shrink-0" style={{ height: "260px" }}>
        <img src={heroBg} alt="For Students" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
        <div className="absolute inset-0 flex flex-col items-start justify-end px-8 pb-8 max-w-7xl mx-auto w-full">
          <p className="font-cursive text-white/75 text-lg italic mb-1">{t("student.hero_tagline")}</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white italic">{t("student.hero_title")}</h1>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto w-full px-6 py-3 flex items-center gap-1.5 text-xs text-gray-400">
        <Link href="/" className="hover:text-primary transition-colors">{t("student.breadcrumb_home")}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-600 font-medium">{t("student.breadcrumb")}</span>
      </div>

      {/* ── Introduction ── */}
      <section className="max-w-7xl mx-auto w-full px-6 py-12">
        <div className="flex flex-col md:flex-row gap-12 items-center">
          <motion.div {...fade()} className="flex-1">
            <p className="font-cursive text-primary text-xl italic mb-1">{t("student.welcome_label")}</p>
            <h2 className="text-3xl font-bold text-gray-900 mb-5">{t("student.welcome_title")}</h2>
            <p className="text-gray-600 leading-relaxed mb-4">{t("student.intro_p1")}</p>
            <p className="text-gray-600 leading-relaxed mb-4">{t("student.intro_p2")}</p>
            <p className="text-gray-600 leading-relaxed mb-6">{t("student.intro_p3")}</p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setLocation("/search")}
                className="bg-primary text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors">
                {t("student.browse_rooms")}
              </button>
              <a href="#enquiry"
                className="border-2 border-primary text-primary px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/5 transition-colors">
                {t("student.send_enquiry")}
              </a>
            </div>
          </motion.div>
          <motion.div {...fade(0.12)} className="flex-1 grid grid-cols-2 gap-3 max-w-md w-full">
            <div className="col-span-2 rounded-2xl overflow-hidden h-44 shadow-md">
              <img src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&q=80"
                alt="Students on campus" className="w-full h-full object-cover" />
            </div>
            <div className="rounded-2xl overflow-hidden h-32 shadow-md">
              <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&q=80"
                alt="Students studying" className="w-full h-full object-cover" />
            </div>
            <div className="rounded-2xl overflow-hidden h-32 shadow-md">
              <img src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80"
                alt="Student group" className="w-full h-full object-cover" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <div style={{ background: "linear-gradient(135deg, #c05010 0%, #e07828 60%, #c86820 100%)" }}>
        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {STATS.map((s) => (
            <div key={s.labelKey}>
              <p className="text-3xl font-bold text-white">{s.num}</p>
              <p className="text-white/80 text-sm mt-0.5">{t(`student.${s.labelKey}`)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Benefits ── */}
      <section className="bg-orange-50 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="font-cursive text-primary text-xl italic mb-1">{t("student.benefits_label")}</p>
            <h2 className="text-2xl font-bold text-gray-900">{t("student.benefits_title")}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {BENEFITS_KEYS.map((key, i) => {
              const Icon = BENEFITS_ICONS[i];
              return (
                <motion.div key={key} {...fade(i * 0.07)}
                  className="bg-white rounded-2xl p-6 border border-orange-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">{t(`student.${key}_title`)}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{t(`student.${key}_desc`)}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="font-cursive text-primary text-xl italic mb-1">{t("student.steps_label")}</p>
            <h2 className="text-2xl font-bold text-gray-900">{t("student.steps_title")}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-8 left-1/3 right-1/3 h-0.5 bg-orange-200 z-0" />
            {STEPS_KEYS.map((key, i) => (
              <motion.div key={key} {...fade(i * 0.1)} className="relative z-10 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 text-white font-bold text-lg shadow-md"
                  style={{ background: "linear-gradient(135deg, #c05010, #e07828)" }}>
                  {STEPS_NUMS[i]}
                </div>
                <h3 className="font-semibold text-gray-800 mb-2">{t(`student.${key}_title`)}</h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-xs">{t(`student.${key}_desc`)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="bg-gray-50 py-14 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <p className="font-cursive text-primary text-xl italic">{t("student.reviews_label")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS_DATA.map((testimonial, i) => (
              <motion.div key={testimonial.name} {...fade(i * 0.08)}
                className="bg-white rounded-2xl p-6 border border-orange-100 shadow-sm flex flex-col">
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className={`h-4 w-4 ${j < testimonial.rating ? "fill-primary text-primary" : "text-gray-200"}`} />
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed flex-1 mb-4 italic">"{t(`student.${testimonial.textKey}`)}"</p>
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{testimonial.flag}</span>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{testimonial.name}</p>
                    <p className="text-xs text-gray-400">{testimonial.uni}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Available Rooms ── */}
      <section className="py-14 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <p className="font-cursive text-primary text-xl italic mb-1">{t("student.rooms_label")}</p>
            <h2 className="text-2xl font-bold text-gray-900">{t("student.rooms_title")}</h2>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border bg-white animate-pulse h-72" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {spaces.map((space, i) => <SpaceCard key={(space as Record<string, unknown>).id as number} space={space} index={i} />)}
            </div>
          )}
          <div className="text-center mt-10">
            <button onClick={() => setLocation("/search")}
              className="bg-primary text-white px-10 py-3 rounded-full font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm">
              {t("student.view_all")}
            </button>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-orange-50 py-14 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="font-cursive text-primary text-xl italic mb-1">{t("student.faq_label")}</p>
            <h2 className="text-2xl font-bold text-gray-900">{t("student.faq_title")}</h2>
          </div>
          <div className="space-y-3">
            {FAQS_KEYS.map((key, i) => (
              <div key={key} className="bg-white rounded-2xl border border-orange-100 overflow-hidden shadow-sm">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left">
                  <span className="font-semibold text-gray-800 text-sm">{t(`student.${key}_q`)}</span>
                  <ChevronRight className={`h-4 w-4 text-primary shrink-0 transition-transform ${openFaq === i ? "rotate-90" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4">
                    <p className="text-sm text-gray-500 leading-relaxed">{t(`student.${key}_a`)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── General Enquiry Form ── */}
      <section id="enquiry" className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="font-cursive text-primary text-xl italic mb-1">{t("student.enquiry_label")}</p>
            <h2 className="text-2xl font-bold text-gray-900">{t("student.enquiry_title")}</h2>
            <p className="text-sm text-gray-500 mt-2">{t("student.enquiry_sub")}</p>
          </div>

          {submitted ? (
            <motion.div {...fade()} className="bg-green-50 border border-green-200 rounded-2xl p-10 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">{t("student.success_title")}</h3>
              <p className="text-gray-500 text-sm"
                dangerouslySetInnerHTML={{ __html: t("student.success_text", { name: form.name, email: `<strong>${form.email}</strong>` }) }}
              />
              <button onClick={() => setSubmitted(false)} className="mt-6 text-primary text-sm font-medium hover:underline">
                {t("student.send_another")}
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{t("student.form_name")}</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t("student.name_placeholder")}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{t("student.form_email")}</label>
                  <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder={t("student.email_placeholder")}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{t("student.form_phone")}</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder={t("student.phone_placeholder")}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{t("student.form_university")}</label>
                  <input value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })}
                    placeholder={t("student.university_placeholder")}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{t("student.form_visa")}</label>
                <select value={form.visa} onChange={(e) => setForm({ ...form, visa: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                  <option value="">{t("student.visa_select")}</option>
                  <option value="student">{t("student.visa_student")}</option>
                  <option value="working_holiday">{t("student.visa_holiday")}</option>
                  <option value="other">{t("student.visa_other")}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{t("student.form_message")}</label>
                <textarea required rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder={t("student.message_placeholder")}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
              {error && (
                <p className="text-sm text-red-600 text-center">{error}</p>
              )}
              <button type="submit" disabled={sending}
                className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                <Send className="h-4 w-4" />
                {sending ? t("student.form_sending", "Sending…") : t("student.form_submit")}
              </button>
              <p className="text-xs text-gray-400 text-center">{t("student.form_privacy")}</p>
            </form>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

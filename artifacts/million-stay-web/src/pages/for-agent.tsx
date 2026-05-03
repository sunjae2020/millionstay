import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getApiBase } from "@/lib/api-base";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  ChevronRight, CheckCircle2, Star, Send, Building2,
  Handshake, DollarSign, BarChart3, Award, Globe, Users,
} from "lucide-react";

function fade(delay = 0) {
  return { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.48, delay } };
}

const BENEFITS_ICONS = [DollarSign, Globe, BarChart3, Building2, Users, Award];
const BENEFITS_KEYS = ["b1", "b2", "b3", "b4", "b5", "b6"];

const HOW_KEYS = ["h1", "h2", "h3"];
const HOW_NUMS = ["01", "02", "03"];

const TESTIMONIALS_DATA = [
  { name: "Michael Choi", agency: "ACE Migration & Education", flag: "🇦🇺", textKey: "t1_text", rating: 5 },
  { name: "Priya Sharma", agency: "Global Study Pathways", flag: "🇮🇳", textKey: "t2_text", rating: 5 },
  { name: "Yoko Matsuda", agency: "Japan International Connect", flag: "🇯🇵", textKey: "t3_text", rating: 5 },
];

export default function ForAgent() {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    companyName: "", contactName: "", email: "", phone: "",
    abn: "", licenseNumber: "", clientTypes: "", message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const [enquiry, setEnquiry] = useState({ name: "", email: "", message: "" });
  const [enquirySubmitted, setEnquirySubmitted] = useState(false);

  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [enquiring, setEnquiring] = useState(false);
  const [enquiryError, setEnquiryError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);
    setRegistering(true);
    try {
      const base = getApiBase();
      const nameParts = form.contactName.trim().split(/\s+/);
      const payload = {
        first_name: nameParts[0] ?? "",
        last_name: nameParts.slice(1).join(" ") || "—",
        email: form.email,
        phone: form.phone,
        agency_name: form.companyName,
        license_number: form.licenseNumber,
        coverage_area: form.clientTypes,
        message: form.message,
      };
      const res = await fetch(`${base}/api/v1/public/agent-applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to submit");
      }
      setSubmitted(true);
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : "Failed to submit. Please try again.");
    } finally {
      setRegistering(false);
    }
  };

  const handleEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnquiryError(null);
    setEnquiring(true);
    try {
      const base = getApiBase();
      const nameParts = enquiry.name.trim().split(/\s+/);
      const payload = {
        first_name: nameParts[0] ?? "",
        last_name: nameParts.slice(1).join(" ") || "—",
        email: enquiry.email,
        message: enquiry.message,
      };
      const res = await fetch(`${base}/api/v1/public/agent-applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to send");
      }
      setEnquirySubmitted(true);
    } catch (err) {
      setEnquiryError(err instanceof Error ? err.message : "Failed to send. Please try again.");
    } finally {
      setEnquiring(false);
    }
  };

  const STATS = [
    { num: "30+", labelKey: "stat1_label" },
    { num: "$500K+", labelKey: "stat2_label" },
    { num: "500+", labelKey: "stat3_label" },
    { num: "99%", labelKey: "stat4_label" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden shrink-0" style={{ height: "260px" }}>
        <img
          src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1920&q=80"
          alt="For Agents"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/60" />
        <div className="absolute inset-0 flex flex-col items-start justify-end px-8 pb-8 max-w-7xl mx-auto w-full">
          <p className="font-cursive text-white/75 text-lg italic mb-1">{t("agent.hero_tagline")}</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white italic">{t("agent.hero_title")}</h1>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto w-full px-6 py-3 flex items-center gap-1.5 text-xs text-gray-400">
        <Link href="/" className="hover:text-primary transition-colors">{t("agent.breadcrumb_home")}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-600 font-medium">{t("agent.breadcrumb")}</span>
      </div>

      {/* ── Introduction ── */}
      <section className="max-w-7xl mx-auto w-full px-6 py-12">
        <div className="flex flex-col md:flex-row gap-12 items-center">
          <motion.div {...fade()} className="flex-1">
            <p className="font-cursive text-primary text-xl italic mb-1">{t("agent.intro_label")}</p>
            <h2 className="text-3xl font-bold text-gray-900 mb-5">{t("agent.intro_title")}</h2>
            <p className="text-gray-600 leading-relaxed mb-4">{t("agent.intro_p1")}</p>
            <p className="text-gray-600 leading-relaxed mb-4">{t("agent.intro_p2")}</p>
            <p className="text-gray-600 leading-relaxed mb-6">{t("agent.intro_p3")}</p>
            <div className="flex flex-wrap gap-3">
              <a href="#agent-register"
                className="bg-primary text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors">
                {t("agent.apply_partner")}
              </a>
              <a href="#enquiry"
                className="border-2 border-primary text-primary px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/5 transition-colors">
                {t("agent.contact_us")}
              </a>
            </div>
          </motion.div>
          <motion.div {...fade(0.12)} className="flex-1 grid grid-cols-2 gap-3 max-w-md w-full">
            <div className="col-span-2 rounded-2xl overflow-hidden h-44 shadow-md">
              <img src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&q=80"
                alt="Business partnership" className="w-full h-full object-cover" />
            </div>
            <div className="rounded-2xl overflow-hidden h-32 shadow-md">
              <img src="https://images.unsplash.com/photo-1554774853-aae0a22c8aa4?w=600&q=80"
                alt="Real estate professionals" className="w-full h-full object-cover" />
            </div>
            <div className="rounded-2xl overflow-hidden h-32 shadow-md">
              <img src="https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&q=80"
                alt="Melbourne property" className="w-full h-full object-cover" />
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
              <p className="text-white/80 text-sm mt-0.5">{t(`agent.${s.labelKey}`)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Agent Benefits ── */}
      <section className="bg-orange-50 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="font-cursive text-primary text-xl italic mb-1">{t("agent.benefits_label")}</p>
            <h2 className="text-2xl font-bold text-gray-900">{t("agent.benefits_title")}</h2>
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
                  <h3 className="font-semibold text-gray-800 mb-2">{t(`agent.${key}_title`)}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{t(`agent.${key}_desc`)}</p>
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
            <p className="font-cursive text-primary text-xl italic mb-1">{t("agent.how_label")}</p>
            <h2 className="text-2xl font-bold text-gray-900">{t("agent.how_title")}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {HOW_KEYS.map((key, i) => (
              <motion.div key={key} {...fade(i * 0.1)} className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 text-white font-bold text-lg shadow-md"
                  style={{ background: "linear-gradient(135deg, #c05010, #e07828)" }}>
                  {HOW_NUMS[i]}
                </div>
                <h3 className="font-semibold text-gray-800 mb-2">{t(`agent.${key}_title`)}</h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-xs">{t(`agent.${key}_desc`)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Partner Testimonials ── */}
      <section className="bg-gray-50 py-14 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <p className="font-cursive text-primary text-xl italic">{t("agent.feedback_label")}</p>
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
                <p className="text-gray-600 text-sm leading-relaxed flex-1 mb-4 italic">"{t(`agent.${testimonial.textKey}`)}"</p>
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{testimonial.flag}</span>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{testimonial.name}</p>
                    <p className="text-xs text-gray-400">{testimonial.agency}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Agent Registration Form ── */}
      <section id="agent-register" className="py-16 px-6 bg-orange-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="font-cursive text-primary text-xl italic mb-1">{t("agent.reg_label")}</p>
            <h2 className="text-2xl font-bold text-gray-900">{t("agent.reg_title")}</h2>
            <p className="text-sm text-gray-500 mt-2">{t("agent.reg_sub")}</p>
          </div>

          {submitted ? (
            <motion.div {...fade()} className="bg-green-50 border border-green-200 rounded-2xl p-10 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">{t("agent.reg_success_title")}</h3>
              <p className="text-gray-500 text-sm"
                dangerouslySetInnerHTML={{ __html: t("agent.reg_success_text", {
                  name: `<strong>${form.contactName}</strong>`,
                  company: `<strong>${form.companyName}</strong>`,
                  email: `<strong>${form.email}</strong>`,
                }) }}
              />
              <button onClick={() => setSubmitted(false)} className="mt-6 text-primary text-sm font-medium hover:underline">
                {t("agent.submit_another")}
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleRegister} className="bg-white rounded-2xl border border-orange-100 shadow-sm p-8 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{t("agent.form_company")}</label>
                  <input required value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    placeholder={t("agent.company_placeholder")}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{t("agent.form_contact")}</label>
                  <input required value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    placeholder={t("agent.contact_placeholder")}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{t("agent.form_email")}</label>
                  <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder={t("agent.agency_email_placeholder")}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{t("agent.form_phone")}</label>
                  <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder={t("agent.phone_placeholder")}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{t("agent.form_abn")}</label>
                  <input value={form.abn} onChange={(e) => setForm({ ...form, abn: e.target.value })}
                    placeholder={t("agent.abn_placeholder")}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{t("agent.form_license")}</label>
                  <input value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                    placeholder={t("agent.license_placeholder")}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{t("agent.form_client_types")}</label>
                <select value={form.clientTypes} onChange={(e) => setForm({ ...form, clientTypes: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                  <option value="">{t("agent.select_client")}</option>
                  <option value="international_students">{t("agent.client_students")}</option>
                  <option value="working_holiday">{t("agent.client_holiday")}</option>
                  <option value="skilled_migrants">{t("agent.client_skilled")}</option>
                  <option value="mixed">{t("agent.client_mixed")}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{t("agent.form_message")}</label>
                <textarea required rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder={t("agent.message_placeholder")}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
              {registerError && (
                <p className="text-sm text-red-600 text-center">{registerError}</p>
              )}
              <button type="submit" disabled={registering}
                className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                <Handshake className="h-4 w-4" />
                {registering ? t("agent.reg_submitting", "Submitting…") : t("agent.reg_submit")}
              </button>
              <p className="text-xs text-gray-400 text-center">{t("agent.reg_privacy")}</p>
            </form>
          )}
        </div>
      </section>

      {/* ── General Enquiry Form ── */}
      <section id="enquiry" className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="font-cursive text-primary text-xl italic mb-1">{t("agent.enquiry_label")}</p>
            <h2 className="text-2xl font-bold text-gray-900">{t("agent.enquiry_title")}</h2>
            <p className="text-sm text-gray-500 mt-2">{t("agent.enquiry_sub")}</p>
          </div>

          {enquirySubmitted ? (
            <motion.div {...fade()} className="bg-green-50 border border-green-200 rounded-2xl p-10 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">{t("agent.enquiry_success_title")}</h3>
              <p className="text-gray-500 text-sm"
                dangerouslySetInnerHTML={{ __html: t("agent.enquiry_success_text", { email: `<strong>${enquiry.email}</strong>` }) }}
              />
              <button onClick={() => setEnquirySubmitted(false)} className="mt-6 text-primary text-sm font-medium hover:underline">
                {t("agent.send_another")}
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleEnquiry} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{t("agent.enq_name")}</label>
                  <input required value={enquiry.name} onChange={(e) => setEnquiry({ ...enquiry, name: e.target.value })}
                    placeholder={t("agent.enq_name_placeholder")}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{t("agent.enq_email")}</label>
                  <input required type="email" value={enquiry.email} onChange={(e) => setEnquiry({ ...enquiry, email: e.target.value })}
                    placeholder={t("agent.enq_email_placeholder")}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{t("agent.enq_message")}</label>
                <textarea required rows={4} value={enquiry.message} onChange={(e) => setEnquiry({ ...enquiry, message: e.target.value })}
                  placeholder={t("agent.enq_message_placeholder")}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
              {enquiryError && (
                <p className="text-sm text-red-600 text-center">{enquiryError}</p>
              )}
              <button type="submit" disabled={enquiring}
                className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                <Send className="h-4 w-4" />
                {enquiring ? t("agent.enquiry_sending", "Sending…") : t("agent.enquiry_submit")}
              </button>
            </form>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

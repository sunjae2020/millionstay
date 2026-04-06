import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useListPublicSpaces, getListPublicSpacesQueryKey } from "@/lib/guest-api";
import { SpaceCard } from "@/components/space-card";
import {
  ChevronRight, CheckCircle2, Star, BookOpen, Shield,
  Wifi, MapPin, Clock, Phone, Send, GraduationCap,
  HeartHandshake, Home,
} from "lucide-react";
import heroBg from "@assets/MS_Homepage_Photo_1920x1080_1775403929888.jpg";

function fade(delay = 0) {
  return { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.48, delay } };
}

const BENEFITS = [
  { icon: Shield, title: "Verified & Safe Rooms", desc: "Every room is personally inspected by our team before listing. No scams, no surprises." },
  { icon: HeartHandshake, title: "Multilingual Support", desc: "Our team speaks English, Korean, Chinese, Japanese and Thai. We're here to help in your language." },
  { icon: Clock, title: "Flexible Stay Plans", desc: "Stay from 4 to 24 weeks. No long-term leases, no stress — just flexibility to match your study schedule." },
  { icon: MapPin, title: "University-Close Locations", desc: "Rooms in Melbourne's top student suburbs: Hawthorn, Carlton, South Yarra, St Kilda and more." },
  { icon: Wifi, title: "Bills Included", desc: "High-speed Wi-Fi, electricity, water and gas included in your weekly rate. No surprise utility bills." },
  { icon: BookOpen, title: "Student-Friendly Process", desc: "Simple online application. Upload documents digitally. No local guarantor required." },
];

const STEPS = [
  { num: "01", title: "Browse & Apply", desc: "Search rooms by suburb, price and room type. Submit an enquiry form online — takes less than 5 minutes." },
  { num: "02", title: "We Match You", desc: "Our team reviews your application and matches you with the best available room for your dates and budget." },
  { num: "03", title: "Move In with Ease", desc: "Pay securely online, sign your agreement digitally, and collect your keys. We'll guide you every step." },
];

const TESTIMONIALS = [
  { name: "Ji-woo Kim", flag: "🇰🇷", uni: "Swinburne University", text: "MillionStay was a lifesaver. I found a great room in Hawthorn within 24 hours of enquiring. The team even helped me set up my bank account!", rating: 5 },
  { name: "Yuki Tanaka", flag: "🇯🇵", uni: "University of Melbourne", text: "As an international student I was nervous about housing, but MillionStay made everything so simple. They responded in Japanese and the room was exactly as described.", rating: 5 },
  { name: "Mei Lin", flag: "🇨🇳", uni: "RMIT University", text: "Great value for money. Internet is super fast, the room is clean and the location near the tram line makes getting to campus easy.", rating: 5 },
];

const FAQS = [
  { q: "Do I need a local guarantor?", a: "No. We don't require a local guarantor. A copy of your student visa and passport is sufficient for most rooms." },
  { q: "Can I pay by international bank transfer?", a: "Yes. We accept international bank transfers, credit/debit cards and some digital wallets." },
  { q: "What is included in the weekly price?", a: "Most rooms include Wi-Fi, electricity, water and gas. Please check individual listings for exact inclusions." },
  { q: "Can I extend my stay?", a: "Absolutely. You can extend your booking subject to room availability. Just contact us at least 2 weeks before your checkout." },
];

export default function ForStudent() {
  const [, setLocation] = useLocation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", university: "", visa: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const { data: spacesData, isLoading } = useListPublicSpaces({ limit: 6 }, {
    query: { queryKey: getListPublicSpacesQueryKey({ limit: 6 }) },
  });
  const spaces = (spacesData?.data ?? []) as Parameters<typeof SpaceCard>[0]["space"][];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* ── Hero Banner ── */}
      <div className="relative h-52 md:h-68 overflow-hidden shrink-0" style={{ height: "260px" }}>
        <img src={heroBg} alt="For Students" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
        <div className="absolute inset-0 flex flex-col items-start justify-end px-8 pb-8 max-w-7xl mx-auto w-full">
          <p className="font-cursive text-white/75 text-lg italic mb-1">Overseas Student Program</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white italic">For Students</h1>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto w-full px-6 py-3 flex items-center gap-1.5 text-xs text-gray-400">
        <Link href="/" className="hover:text-primary transition-colors">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-600 font-medium">For Students</span>
      </div>

      {/* ── Introduction ── */}
      <section className="max-w-7xl mx-auto w-full px-6 py-12">
        <div className="flex flex-col md:flex-row gap-12 items-center">
          <motion.div {...fade()} className="flex-1">
            <p className="font-cursive text-primary text-xl italic mb-1">Welcome to Melbourne</p>
            <h2 className="text-3xl font-bold text-gray-900 mb-5">YOUR HOME AWAY FROM HOME</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Arriving in a new country is exciting — but finding a safe, affordable place to live shouldn't be stressful. MillionStay specialises in helping international students find quality accommodation in Melbourne, with a process designed around your needs.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              We work directly with universities, migration agents and student support services across Melbourne to make your transition as smooth as possible. From the moment you enquire to the day you check out, our multilingual team is by your side.
            </p>
            <p className="text-gray-600 leading-relaxed mb-6">
              Our rooms are located near Melbourne's leading universities — University of Melbourne, RMIT, Swinburne, Monash, Deakin and more — in well-connected, safe suburban neighbourhoods.
            </p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setLocation("/search")}
                className="bg-primary text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors">
                Browse Rooms
              </button>
              <a href="#enquiry"
                className="border-2 border-primary text-primary px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/5 transition-colors">
                Send Enquiry
              </a>
            </div>
          </motion.div>
          <motion.div {...fade(0.12)} className="flex-1 grid grid-cols-2 gap-3 max-w-md w-full">
            <div className="col-span-2 rounded-2xl overflow-hidden h-44 shadow-md">
              <img src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80"
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
          {[
            { num: "500+", label: "Students Housed" },
            { num: "12+", label: "Melbourne Suburbs" },
            { num: "5", label: "Languages Spoken" },
            { num: "24/7", label: "Support Available" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-bold text-white">{s.num}</p>
              <p className="text-white/80 text-sm mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Benefits ── */}
      <section className="bg-orange-50 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="font-cursive text-primary text-xl italic mb-1">Why Choose Us</p>
            <h2 className="text-2xl font-bold text-gray-900">EVERYTHING A STUDENT NEEDS</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {BENEFITS.map((b, i) => (
              <motion.div key={b.title} {...fade(i * 0.07)}
                className="bg-white rounded-2xl p-6 border border-orange-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <b.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-gray-800 mb-2">{b.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{b.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="font-cursive text-primary text-xl italic mb-1">Simple Process</p>
            <h2 className="text-2xl font-bold text-gray-900">HOW IT WORKS</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-8 left-1/3 right-1/3 h-0.5 bg-orange-200 z-0" />
            {STEPS.map((step, i) => (
              <motion.div key={step.num} {...fade(i * 0.1)} className="relative z-10 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 text-white font-bold text-lg shadow-md"
                  style={{ background: "linear-gradient(135deg, #c05010, #e07828)" }}>
                  {step.num}
                </div>
                <h3 className="font-semibold text-gray-800 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-xs">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="bg-gray-50 py-14 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <p className="font-cursive text-primary text-xl italic">Student Reviews</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div key={t.name} {...fade(i * 0.08)}
                className="bg-white rounded-2xl p-6 border border-orange-100 shadow-sm flex flex-col">
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className={`h-4 w-4 ${j < t.rating ? "fill-primary text-primary" : "text-gray-200"}`} />
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed flex-1 mb-4 italic">"{t.text}"</p>
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{t.flag}</span>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.uni}</p>
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
            <p className="font-cursive text-primary text-xl italic mb-1">Available Now</p>
            <h2 className="text-2xl font-bold text-gray-900">BROWSE OUR ROOMS</h2>
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
              View All Rooms
            </button>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-orange-50 py-14 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="font-cursive text-primary text-xl italic mb-1">Got Questions?</p>
            <h2 className="text-2xl font-bold text-gray-900">FAQ</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl border border-orange-100 overflow-hidden shadow-sm">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left">
                  <span className="font-semibold text-gray-800 text-sm">{faq.q}</span>
                  <ChevronRight className={`h-4 w-4 text-primary shrink-0 transition-transform ${openFaq === i ? "rotate-90" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4">
                    <p className="text-sm text-gray-500 leading-relaxed">{faq.a}</p>
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
            <p className="font-cursive text-primary text-xl italic mb-1">Get in Touch</p>
            <h2 className="text-2xl font-bold text-gray-900">STUDENT ENQUIRY</h2>
            <p className="text-sm text-gray-500 mt-2">Fill in your details and our student support team will contact you within 24 hours.</p>
          </div>

          {submitted ? (
            <motion.div {...fade()} className="bg-green-50 border border-green-200 rounded-2xl p-10 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Enquiry Sent!</h3>
              <p className="text-gray-500 text-sm">Thank you, {form.name}. Our student support team will contact you at <strong>{form.email}</strong> within 24 hours.</p>
              <button onClick={() => setSubmitted(false)} className="mt-6 text-primary text-sm font-medium hover:underline">
                Send another enquiry
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Full Name *</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Your full name"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Email Address *</label>
                  <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="your@email.com"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Phone Number</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+61 4xx xxx xxx"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">University / College</label>
                  <input value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })}
                    placeholder="e.g. University of Melbourne"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Visa Type</label>
                <select value={form.visa} onChange={(e) => setForm({ ...form, visa: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                  <option value="">Select visa type</option>
                  <option value="student">Student Visa (Subclass 500)</option>
                  <option value="working_holiday">Working Holiday (Subclass 417/462)</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Message / Requirements *</label>
                <textarea required rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Tell us about your move-in date, preferred suburb, budget and any other requirements..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
              <button type="submit"
                className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                <Send className="h-4 w-4" />
                Send Student Enquiry
              </button>
              <p className="text-xs text-gray-400 text-center">We respond within 24 hours · Your information is kept strictly confidential</p>
            </form>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

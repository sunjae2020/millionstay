import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  ChevronRight, CheckCircle2, Star, TrendingUp, Users,
  BadgeCheck, Globe, Send, Building2, Handshake,
  DollarSign, BarChart3, Award, Phone,
} from "lucide-react";

function fade(delay = 0) {
  return { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.48, delay } };
}

const AGENT_BENEFITS = [
  { icon: DollarSign, title: "Competitive Commission", desc: "Earn industry-leading referral commissions for every successful booking. Paid promptly upon guest check-in." },
  { icon: Globe, title: "Multilingual Clients", desc: "Access a wide international student market spanning Korea, China, Japan, Thailand and beyond." },
  { icon: BarChart3, title: "Real-time Dashboard", desc: "Track your referrals, commissions and booking statuses through our dedicated agent portal." },
  { icon: Building2, title: "Quality Inventory", desc: "Our verified properties meet strict quality standards — your clients will be satisfied and trust your recommendations." },
  { icon: Users, title: "Co-Branding Support", desc: "Marketing materials, property brochures and social content created with your agency branding included." },
  { icon: Award, title: "Dedicated Account Manager", desc: "Every partner agency is assigned a personal account manager for priority support and seamless operations." },
];

const HOW_IT_WORKS = [
  { num: "01", title: "Apply to Partner", desc: "Complete our agent registration form. We'll review your application and respond within 2 business days." },
  { num: "02", title: "Get Approved & Onboarded", desc: "Once approved, you'll receive access to our agent portal, property inventory and co-branded materials." },
  { num: "03", title: "Refer & Earn", desc: "Refer clients to MillionStay and track every booking. Commissions are paid promptly upon successful check-in." },
];

const TESTIMONIALS = [
  { name: "Michael Choi", agency: "ACE Migration & Education", flag: "🇦🇺", text: "We've been partnering with MillionStay for 2 years. Our Korean student clients love the service and our commission payments are always on time. A true partnership.", rating: 5 },
  { name: "Priya Sharma", agency: "Global Study Pathways", flag: "🇮🇳", text: "What sets MillionStay apart is their multilingual support. Our Indian students transitioning through Melbourne have found excellent accommodation with zero stress.", rating: 5 },
  { name: "Yoko Matsuda", agency: "Japan International Connect", flag: "🇯🇵", text: "Reliable, professional and genuinely caring about students. The agent dashboard makes tracking referrals so easy. Highly recommended to any migration agent.", rating: 5 },
];

export default function ForAgent() {
  const [form, setForm] = useState({
    companyName: "", contactName: "", email: "", phone: "",
    abn: "", licenseNumber: "", clientTypes: "", message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const [enquiry, setEnquiry] = useState({ name: "", email: "", phone: "", message: "" });
  const [enquirySubmitted, setEnquirySubmitted] = useState(false);

  const handleRegister = (e: React.FormEvent) => { e.preventDefault(); setSubmitted(true); };
  const handleEnquiry = (e: React.FormEvent) => { e.preventDefault(); setEnquirySubmitted(true); };

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
          <p className="font-cursive text-white/75 text-lg italic mb-1">Partner Program</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white italic">For Agent</h1>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto w-full px-6 py-3 flex items-center gap-1.5 text-xs text-gray-400">
        <Link href="/" className="hover:text-primary transition-colors">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-600 font-medium">For Agent</span>
      </div>

      {/* ── Introduction ── */}
      <section className="max-w-7xl mx-auto w-full px-6 py-12">
        <div className="flex flex-col md:flex-row gap-12 items-center">
          <motion.div {...fade()} className="flex-1">
            <p className="font-cursive text-primary text-xl italic mb-1">Grow Together</p>
            <h2 className="text-3xl font-bold text-gray-900 mb-5">PARTNER WITH MILLIONSTAY</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Are you a migration agent, education consultant or student recruitment agency? MillionStay invites you to join our growing partner network and earn commissions by connecting your clients with premium Melbourne accommodation.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              We understand the challenges international students face when relocating to Melbourne. Our verified properties, multilingual team and seamless booking process make us the most trusted referral partner for student housing in the city.
            </p>
            <p className="text-gray-600 leading-relaxed mb-6">
              Whether you work with students from Korea, China, Japan, Thailand, India or beyond — MillionStay has the right accommodation and the right support for every client profile.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#agent-register"
                className="bg-primary text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors">
                Apply to Partner
              </a>
              <a href="#enquiry"
                className="border-2 border-primary text-primary px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/5 transition-colors">
                Contact Us
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
          {[
            { num: "30+", label: "Partner Agencies" },
            { num: "$500K+", label: "Commissions Paid" },
            { num: "500+", label: "Students Placed" },
            { num: "99%", label: "Partner Satisfaction" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-bold text-white">{s.num}</p>
              <p className="text-white/80 text-sm mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Agent Benefits ── */}
      <section className="bg-orange-50 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="font-cursive text-primary text-xl italic mb-1">Why Partner with Us</p>
            <h2 className="text-2xl font-bold text-gray-900">AGENT PARTNER BENEFITS</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {AGENT_BENEFITS.map((b, i) => (
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
            <p className="font-cursive text-primary text-xl italic mb-1">Partnership Process</p>
            <h2 className="text-2xl font-bold text-gray-900">HOW TO JOIN</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div key={step.num} {...fade(i * 0.1)} className="flex flex-col items-center text-center">
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

      {/* ── Partner Testimonials ── */}
      <section className="bg-gray-50 py-14 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <p className="font-cursive text-primary text-xl italic">Partner Feedback</p>
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
                    <p className="text-xs text-gray-400">{t.agency}</p>
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
            <p className="font-cursive text-primary text-xl italic mb-1">Join Our Network</p>
            <h2 className="text-2xl font-bold text-gray-900">AGENT REGISTRATION</h2>
            <p className="text-sm text-gray-500 mt-2">Apply to become a MillionStay referral partner. We'll review your application within 2 business days.</p>
          </div>

          {submitted ? (
            <motion.div {...fade()} className="bg-green-50 border border-green-200 rounded-2xl p-10 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Application Received!</h3>
              <p className="text-gray-500 text-sm">
                Thank you, <strong>{form.contactName}</strong> from <strong>{form.companyName}</strong>.<br />
                Our partnership team will contact you at <strong>{form.email}</strong> within 2 business days.
              </p>
              <button onClick={() => setSubmitted(false)} className="mt-6 text-primary text-sm font-medium hover:underline">
                Submit another application
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleRegister} className="bg-white rounded-2xl border border-orange-100 shadow-sm p-8 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Company / Agency Name *</label>
                  <input required value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    placeholder="Your agency or company name"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Contact Name *</label>
                  <input required value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    placeholder="Your full name"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Email Address *</label>
                  <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="business@agency.com"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Phone Number *</label>
                  <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+61 x xxxx xxxx"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">ABN / Business Number</label>
                  <input value={form.abn} onChange={(e) => setForm({ ...form, abn: e.target.value })}
                    placeholder="XX XXX XXX XXX"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">MARA / License Number</label>
                  <input value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                    placeholder="e.g. MARA number"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Primary Client Types</label>
                <select value={form.clientTypes} onChange={(e) => setForm({ ...form, clientTypes: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                  <option value="">Select client type</option>
                  <option value="international_students">International Students</option>
                  <option value="working_holiday">Working Holiday Makers</option>
                  <option value="skilled_migrants">Skilled Migrants</option>
                  <option value="mixed">Mixed (All of the above)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Tell Us About Your Agency *</label>
                <textarea required rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Briefly describe your agency, the number of clients you place per year, and what markets you serve..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
              <button type="submit"
                className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                <Handshake className="h-4 w-4" />
                Submit Partner Application
              </button>
              <p className="text-xs text-gray-400 text-center">We review every application carefully · Your details are kept confidential</p>
            </form>
          )}
        </div>
      </section>

      {/* ── General Enquiry Form ── */}
      <section id="enquiry" className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="font-cursive text-primary text-xl italic mb-1">Still Have Questions?</p>
            <h2 className="text-2xl font-bold text-gray-900">GENERAL ENQUIRY</h2>
            <p className="text-sm text-gray-500 mt-2">Our partnership team is ready to answer your questions about commissions, inventory or processes.</p>
          </div>

          {enquirySubmitted ? (
            <motion.div {...fade()} className="bg-green-50 border border-green-200 rounded-2xl p-10 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Message Sent!</h3>
              <p className="text-gray-500 text-sm">We'll get back to you at <strong>{enquiry.email}</strong> shortly.</p>
              <button onClick={() => setEnquirySubmitted(false)} className="mt-6 text-primary text-sm font-medium hover:underline">Send another message</button>
            </motion.div>
          ) : (
            <form onSubmit={handleEnquiry} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Name *</label>
                  <input required value={enquiry.name} onChange={(e) => setEnquiry({ ...enquiry, name: e.target.value })}
                    placeholder="Your name"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Email *</label>
                  <input required type="email" value={enquiry.email} onChange={(e) => setEnquiry({ ...enquiry, email: e.target.value })}
                    placeholder="your@email.com"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Message *</label>
                <textarea required rows={4} value={enquiry.message} onChange={(e) => setEnquiry({ ...enquiry, message: e.target.value })}
                  placeholder="Your question or message..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
              <button type="submit"
                className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                <Send className="h-4 w-4" />
                Send Enquiry
              </button>
            </form>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

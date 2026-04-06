import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Mail, ChevronRight, Facebook, Instagram, Youtube, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import heroBg from "@assets/MS_Homepage_Photo_1920x1080_1775403929888.jpg";

const SUBJECTS = [
  "General Enquiry",
  "Booking Question",
  "Stay Plans",
  "Student Visa Support",
  "Agent / Partnership",
  "Other",
];

function fade(delay = 0) {
  return { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay } };
}

export default function Contact() {
  const { toast } = useToast();
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name || !form.email || !form.message) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }
    setSending(true);
    await new Promise((r) => setTimeout(r, 800));
    setSending(false);
    toast({ title: "Message sent!", description: "We'll get back to you within 1 business day." });
    setForm({ first_name: "", last_name: "", email: "", subject: "", message: "" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* Banner */}
      <div className="relative h-52 md:h-64 overflow-hidden">
        <img src={heroBg} alt="Contact Us" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/50" />
        <div className="absolute inset-0 flex flex-col items-start justify-end px-8 pb-8 max-w-7xl mx-auto w-full">
          <p className="font-cursive text-white/70 text-sm italic mb-1">We'd love to hear from you</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white italic">Contact Us</h1>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto w-full px-6 py-3 flex items-center gap-1.5 text-xs text-gray-400">
        <Link href="/" className="hover:text-primary">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-600">Contact Us</span>
      </div>

      {/* Content */}
      <section className="max-w-7xl mx-auto w-full px-6 py-12">
        <div className="flex flex-col md:flex-row gap-12">
          {/* Left: Get in touch */}
          <motion.div {...fade()} className="md:w-72 shrink-0">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Get in touch</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-8">
              Have a question about our rooms, booking process, or stay plans? Our multilingual team is here to help — in English, Korean, Chinese, Japanese or Thai.
            </p>

            <div className="space-y-5">
              <div className="flex gap-3 items-start">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Mail className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Email</p>
                  <a href="mailto:info@millionstay.com" className="text-sm text-gray-700 hover:text-primary">
                    info@millionstay.com
                  </a>
                </div>
              </div>

            </div>

            <div className="mt-10">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Follow our social media</p>
              <div className="flex gap-3">
                {[
                  { icon: Facebook, href: "#" },
                  { icon: Instagram, href: "#" },
                  { icon: Youtube, href: "#" },
                  { icon: Twitter, href: "#" },
                ].map(({ icon: Icon, href }, i) => (
                  <a key={i} href={href}
                    className="w-9 h-9 rounded-full bg-primary/10 hover:bg-primary flex items-center justify-center group transition-colors">
                    <Icon className="h-4 w-4 text-primary group-hover:text-white transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right: Form */}
          <motion.div {...fade(0.1)} className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Send us a message</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">First Name <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                    placeholder="Your first name"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Last Name</label>
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                    placeholder="Your last name"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email <span className="text-red-400">*</span></label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="your@email.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Subject (Optional)</label>
                <select
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-gray-700"
                >
                  <option value="">Select a subject</option>
                  {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Message <span className="text-red-400">*</span></label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  rows={5}
                  placeholder="Write your message here…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={sending}
                className="bg-primary hover:bg-primary/90 text-white font-semibold px-10 py-2.5 rounded-lg"
              >
                {sending ? "Sending…" : "SUBMIT"}
              </Button>
            </form>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

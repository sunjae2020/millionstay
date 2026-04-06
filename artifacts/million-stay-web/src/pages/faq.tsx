import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Plus, Minus } from "lucide-react";
import heroBg from "@assets/MS_Homepage_Photo_1920x1080_1775403929888.jpg";

const CATEGORIES = [
  { label: "FAQ", href: "/faq", active: true },
  { label: "Rules", href: "/house-rules" },
  { label: "Booking", href: "/portal" },
  { label: "Stay Plans", href: "/stay-plan" },
  { label: "For International Students", href: "/for-student" },
  { label: "Contact & Support", href: "/contact" },
];

const FAQ_ITEMS = [
  {
    q: "How do I book a room at MillionStay?",
    a: "You can browse available rooms on our Location page and submit an enquiry or application directly from each listing. Our team will get back to you within 24 hours to confirm availability and guide you through the next steps.",
  },
  {
    q: "What is included in the rent?",
    a: "All our rooms include Wi-Fi, utilities (electricity, water, gas), weekly cleaning of common areas, and access to shared kitchen and laundry facilities. Some properties also include breakfast or additional services — please check individual listings for details.",
  },
  {
    q: "Can I view the room before booking?",
    a: "Yes! We offer both in-person and virtual tours. Contact us to arrange a convenient time. For international students arriving from overseas, we can organise a detailed video walkthrough so you can feel confident before you arrive.",
  },
  {
    q: "What is the minimum stay period?",
    a: "Our minimum stay is typically 4 weeks (1 month). We offer flexible monthly rolling contracts with no long-term lease commitment, which is ideal for students on temporary or student visas.",
  },
  {
    q: "Is there a bond or security deposit?",
    a: "Yes, a bond equivalent to 4 weeks' rent is required upon signing. This is held in accordance with Victorian tenancy law and returned at the end of your stay, provided the room is left in good condition.",
  },
  {
    q: "Do you cater to international students?",
    a: "Absolutely — international students are our core community. We have multilingual staff (Korean, Japanese, Chinese, Thai), and our rooms are designed to make your transition to Melbourne as comfortable as possible.",
  },
  {
    q: "What documents do I need to provide?",
    a: "Typically you will need a copy of your passport, student ID or enrolment letter, and proof of funds or a guarantor letter. Our team will advise you on exactly what's needed during the application process.",
  },
  {
    q: "Are bills included in the weekly price?",
    a: "Yes, electricity, water, gas, and high-speed internet are all included in your weekly rent. There are no hidden costs. The price you see on the listing is what you pay.",
  },
  {
    q: "Can I have guests stay overnight?",
    a: "Overnight guests are allowed with advance notice to management, up to a maximum of 2 consecutive nights. Extended stays must be approved and may incur an additional charge. Please refer to our House Rules for full details.",
  },
  {
    q: "How do I pay my rent?",
    a: "Rent is payable weekly or fortnightly via bank transfer or credit card. You will receive an invoice through your online portal each billing cycle. Automatic payment reminders are sent 3 days before each due date.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* Hero */}
      <section className="relative h-52 sm:h-64 overflow-hidden">
        <img src={heroBg} alt="FAQ" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/30 to-black/55" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          <p className="text-white/80 italic text-sm sm:text-base mb-1">Got questions?</p>
          <h1 className="text-white font-bold italic text-3xl sm:text-4xl drop-shadow-lg">
            Frequently Asked Questions
          </h1>
        </div>
        {/* Breadcrumb */}
        <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm py-2 px-4 sm:px-8">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs text-gray-500">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <span>›</span>
            <span className="text-gray-700 font-medium">FAQ</span>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-3 gap-10">

        {/* Accordion */}
        <div className="lg:col-span-2 space-y-3">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-lg overflow-hidden border border-orange-100"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className={`w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition-colors ${
                    isOpen ? "bg-primary text-white" : "bg-orange-50 text-gray-800 hover:bg-orange-100"
                  }`}
                >
                  <span className="text-sm font-medium leading-snug">{item.q}</span>
                  <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center border transition-colors ${
                    isOpen ? "border-white/50 text-white" : "border-primary text-primary"
                  }`}>
                    {isOpen ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="answer"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 py-4 bg-white text-sm text-gray-600 leading-relaxed border-t border-orange-100">
                        {item.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-4">Categories</h3>
            <ul className="space-y-1">
              {CATEGORIES.map((cat) => (
                <li key={cat.label}>
                  <Link
                    href={cat.href}
                    className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                      cat.active
                        ? "bg-primary text-white font-semibold"
                        : "text-gray-600 hover:bg-orange-50 hover:text-primary"
                    }`}
                  >
                    {cat.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA box */}
          <div className="rounded-xl overflow-hidden">
            <div className="bg-primary px-6 py-5 text-white">
              <h4 className="font-bold text-base mb-1">Still have questions?</h4>
              <p className="text-sm text-white/80 mb-4">
                Our team is here to help. Get in touch and we'll respond within 24 hours.
              </p>
              <Link href="/contact">
                <button className="w-full bg-white text-primary font-bold text-sm py-2.5 rounded-lg hover:bg-orange-50 transition-colors">
                  Contact Us
                </button>
              </Link>
            </div>
          </div>
        </aside>
      </section>

      <Footer />
    </div>
  );
}

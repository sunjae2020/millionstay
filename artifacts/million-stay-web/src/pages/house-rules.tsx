import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { motion } from "framer-motion";
import { Link } from "wouter";
import heroBg from "@assets/MS_Homepage_Photo_1920x1080_1775403929888.jpg";
import roomImg from "@assets/Design-Homepage-06_1775407462672.jpg";

const RULES = [
  {
    number: "01",
    title: "Respect & Quiet Hours",
    body: "All residents are expected to treat each other, staff, and the property with respect. Quiet hours are from 10:00 PM to 8:00 AM on weekdays and 11:00 PM to 9:00 AM on weekends. Loud music, disruptive behaviour, or noise that disturbs other residents is not permitted.",
  },
  {
    number: "02",
    title: "Guests & Visitors",
    body: "Guests are welcome between 9:00 AM and 10:00 PM. Overnight guests are permitted for a maximum of 2 consecutive nights with prior notification to management. Guests are the responsibility of the resident and must follow all house rules at all times.",
  },
  {
    number: "03",
    title: "Cleanliness & Common Areas",
    body: "Residents are responsible for keeping their room clean and tidy. Common areas — including the kitchen, bathrooms, laundry, and lounge — must be cleaned after each use. Dishes should be washed immediately and not left in the sink. Weekly inspections may be conducted by management.",
  },
  {
    number: "04",
    title: "No Smoking & No Illegal Substances",
    body: "MillionStay properties are strictly smoke-free. Smoking is not permitted anywhere inside the building including all rooms, bathrooms, hallways, and stairwells. The use, possession, or distribution of illegal substances on the premises will result in immediate termination of tenancy.",
  },
  {
    number: "05",
    title: "Property Care & Damages",
    body: "Residents must treat all furniture, appliances, and fixtures with care. Any damages must be reported to management immediately. Costs for repairs due to negligence or misuse will be deducted from the security bond. Please do not attach anything to walls without approval.",
  },
  {
    number: "06",
    title: "Keys & Security",
    body: "Each resident will be issued with a room key and building access card. Keys must not be duplicated or shared. If a key is lost, a replacement fee applies. Always ensure doors are locked when leaving and do not allow unknown persons to enter the building.",
  },
  {
    number: "07",
    title: "Rent & Payment",
    body: "Rent is due in advance on the agreed date each week or fortnight. Late payments of more than 7 days may incur a late fee. Persistent late payment may result in a breach notice. Please contact management immediately if you are experiencing financial difficulty.",
  },
];

function fade(delay = 0) {
  return { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay } };
}

export default function HouseRules() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* Hero */}
      <section className="relative h-52 sm:h-64 overflow-hidden">
        <img src={heroBg} alt="House Rules" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/30 to-black/55" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          <p className="text-white/80 italic text-sm sm:text-base mb-1">Living together, harmoniously</p>
          <h1 className="text-white font-bold italic text-3xl sm:text-4xl drop-shadow-lg">House Rules</h1>
        </div>
        {/* Breadcrumb */}
        <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm py-2 px-4 sm:px-8">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs text-gray-500">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <span>›</span>
            <span className="text-gray-700 font-medium">House Rules</span>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">

          {/* Rules list */}
          <div className="lg:col-span-3 space-y-8">
            <motion.p {...fade(0)} className="text-gray-500 text-sm leading-relaxed max-w-lg">
              To ensure a comfortable, safe, and respectful living environment for all residents, please read and follow our house rules carefully. These apply to all guests, residents, and visitors.
            </motion.p>

            {RULES.map((rule, i) => (
              <motion.div key={rule.number} {...fade(0.06 * i)} className="flex gap-5">
                {/* Number + line */}
                <div className="flex flex-col items-center pt-1">
                  <span className="text-primary font-black text-lg leading-none">{rule.number}</span>
                  {i < RULES.length - 1 && (
                    <div className="w-px flex-1 mt-2 bg-orange-100" />
                  )}
                </div>

                {/* Content */}
                <div className="pb-8">
                  <h3 className="text-primary font-bold text-base mb-1.5">Rule {rule.number} — {rule.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{rule.body}</p>
                </div>
              </motion.div>
            ))}

            {/* Agreement note */}
            <motion.div {...fade(0.5)} className="bg-orange-50 border border-orange-100 rounded-xl px-6 py-5">
              <p className="text-sm text-gray-600 leading-relaxed">
                By residing at a MillionStay property you agree to abide by these house rules. Violations may result in a formal warning, bond deduction, or termination of tenancy.
                If you have questions, please contact us at{" "}
                <a href="mailto:info@millionstay.com" className="text-primary hover:underline font-medium">
                  info@millionstay.com
                </a>.
              </p>
            </motion.div>
          </div>

          {/* Sticky image sidebar */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 space-y-5">
              <motion.div {...fade(0.1)} className="rounded-2xl overflow-hidden shadow-lg">
                <img
                  src="https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80"
                  alt="MillionStay room"
                  className="w-full h-64 object-cover"
                />
              </motion.div>
              <motion.div {...fade(0.2)} className="rounded-2xl overflow-hidden shadow-lg">
                <img
                  src="https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800&q=80"
                  alt="MillionStay room interior"
                  className="w-full h-48 object-cover"
                />
              </motion.div>

              {/* Quick links */}
              <motion.div {...fade(0.3)} className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <h4 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-3">Related</h4>
                <ul className="space-y-1.5">
                  {[
                    { label: "Frequently Asked Questions", href: "/faq" },
                    { label: "For Students", href: "/for-student" },
                    { label: "Contact Us", href: "/contact" },
                  ].map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="text-sm text-gray-600 hover:text-primary transition-colors flex items-center gap-1.5">
                        <span className="text-primary">›</span>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { motion } from "framer-motion";
import { Link } from "wouter";
import heroBg from "@assets/MS_Homepage_Photo_1920x1080_1775403929888.jpg";

const SECTIONS = [
  {
    number: "01",
    title: "About This Policy",
    body: `Million Homestay Australia Pty Ltd ("MillionStay", "we", "our", "us") is committed to protecting your privacy in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs). This Privacy Policy explains how we collect, use, hold, and disclose personal information about individuals who interact with our website, services, and accommodation properties. By using our website or services, you consent to the practices described in this policy.`,
  },
  {
    number: "02",
    title: "Information We Collect",
    body: `We collect personal information that is reasonably necessary for our business functions. This includes: identity information (full name, date of birth, nationality, passport or visa details); contact information (email address, phone number, residential address); booking and tenancy information (stay dates, room preferences, payment records, lease documents); financial information (bank account details for bond refunds, payment history); and website usage data (IP address, browser type, pages visited, cookies). We may also collect sensitive information such as your visa status or student enrolment details, where relevant to eligibility for our services.`,
  },
  {
    number: "03",
    title: "How We Collect Information",
    body: `We collect personal information directly from you when you: enquire about or book accommodation through our website or by phone; submit an application, registration, or enquiry form; communicate with us by email, phone, or in person; visit one of our properties; or sign a tenancy agreement. We may also collect information from third parties such as educational institutions (to verify student status), reference providers, or real estate agents, where you have authorised us to do so.`,
  },
  {
    number: "04",
    title: "How We Use Your Information",
    body: `We use your personal information to: process accommodation applications and bookings; manage your tenancy and communicate with you about your stay; verify your identity and eligibility; process payments and manage financial records including bonds; comply with our legal obligations under the Residential Tenancies Act 1997 (Vic) and other applicable laws; respond to your enquiries and provide customer support; improve our website and services; send you relevant updates or promotional materials (where you have consented). We will not use your information for any purpose that is incompatible with the reason it was collected without your consent.`,
  },
  {
    number: "05",
    title: "Disclosure of Your Information",
    body: `We may disclose your personal information to: our staff, contractors, and service providers who assist in delivering our services (including property managers, maintenance contractors, and IT providers); government bodies or regulators where required by law (such as the Residential Tenancies Bond Authority); financial institutions for payment processing; and professional advisers such as lawyers or accountants. We do not sell, rent, or trade your personal information to third parties for marketing purposes. If we are required to disclose information to overseas recipients, we will take reasonable steps to ensure they handle it in accordance with the APPs.`,
  },
  {
    number: "06",
    title: "Cookies & Website Data",
    body: `Our website uses cookies and similar tracking technologies to improve your experience, analyse traffic, and personalise content. Cookies are small data files stored on your device. You may disable cookies through your browser settings; however, some features of our website may not function correctly without them. We use Google Analytics to understand how visitors use our site. Data collected by Google Analytics is anonymised and subject to Google's own privacy policy. We do not use cookies to collect personally identifiable information without your knowledge.`,
  },
  {
    number: "07",
    title: "Storage & Security",
    body: `We store personal information in secure systems, both on-premises and with reputable cloud service providers based in Australia. We take reasonable steps to protect your information from misuse, interference, loss, unauthorised access, modification, or disclosure. These measures include password protection, encryption, restricted staff access, and regular security reviews. While we take data security seriously, no method of transmission over the internet is completely secure, and we cannot guarantee absolute security.`,
  },
  {
    number: "08",
    title: "Retention of Information",
    body: `We retain personal information for as long as it is needed to fulfil the purposes for which it was collected, or as required by law. Tenancy records are generally kept for a minimum of 7 years in accordance with Australian taxation and tenancy laws. After this period, we securely destroy or de-identify the information in accordance with our internal data retention schedule.`,
  },
  {
    number: "09",
    title: "Your Rights & Access",
    body: `Under the Privacy Act 1988 (Cth), you have the right to: access the personal information we hold about you; request correction of information that is inaccurate, out of date, or incomplete; make a complaint about how we have handled your information; and opt out of receiving direct marketing communications at any time. To exercise any of these rights, please contact us using the details below. We will respond to your request within 30 days. In some circumstances we may refuse access, and if so, we will provide written reasons.`,
  },
  {
    number: "10",
    title: "Complaints",
    body: `If you believe we have breached your privacy rights or the Australian Privacy Principles, you may lodge a complaint by contacting us directly at info@millionstay.com. We will acknowledge your complaint within 5 business days and respond with a resolution or outcome within 30 days. If you are not satisfied with our response, you may escalate your complaint to the Office of the Australian Information Commissioner (OAIC) at www.oaic.gov.au or by calling 1300 363 992.`,
  },
  {
    number: "11",
    title: "Changes to This Policy",
    body: `We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. The updated policy will be posted on our website with a revised effective date. We encourage you to review this policy periodically. Continued use of our services after any changes constitutes your acceptance of the updated policy.`,
  },
];

function fade(delay = 0) {
  return { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay } };
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* Hero */}
      <section className="relative h-52 sm:h-64 overflow-hidden">
        <img src={heroBg} alt="Privacy Policy" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/30 to-black/55" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          <p className="text-white/80 italic text-sm sm:text-base mb-1">Your privacy matters to us</p>
          <h1 className="text-white font-bold italic text-3xl sm:text-4xl drop-shadow-lg">Privacy Policy</h1>
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm py-2 px-4 sm:px-8">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs text-gray-500">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <span>›</span>
            <span className="text-gray-700 font-medium">Privacy Policy</span>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">

          {/* Sections list */}
          <div className="lg:col-span-3 space-y-8">
            <motion.div {...fade(0)} className="bg-orange-50 border border-orange-100 rounded-xl px-6 py-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Effective Date</p>
              <p className="text-sm text-gray-700 font-semibold">1 January 2025</p>
              <p className="text-xs text-gray-500 mt-2">This policy applies to Million Homestay Australia Pty Ltd (ACN 000 000 000) and complies with the Privacy Act 1988 (Cth) and the Australian Privacy Principles.</p>
            </motion.div>

            {SECTIONS.map((section, i) => (
              <motion.div key={section.number} {...fade(0.05 * i)} className="flex gap-5">
                <div className="flex flex-col items-center pt-1">
                  <span className="text-primary font-black text-lg leading-none">{section.number}</span>
                  {i < SECTIONS.length - 1 && (
                    <div className="w-px flex-1 mt-2 bg-orange-100" />
                  )}
                </div>
                <div className="pb-8">
                  <h3 className="text-primary font-bold text-base mb-1.5">
                    {section.number}. {section.title}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{section.body}</p>
                </div>
              </motion.div>
            ))}

            {/* Contact note */}
            <motion.div {...fade(0.6)} className="bg-orange-50 border border-orange-100 rounded-xl px-6 py-5">
              <h4 className="text-sm font-bold text-gray-800 mb-2">Contact Our Privacy Officer</h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                For any privacy-related enquiries, access requests, or complaints, please contact us at:
              </p>
              <div className="mt-3 space-y-1 text-sm">
                <p className="text-gray-700"><span className="font-medium">Email:</span>{" "}
                  <a href="mailto:info@millionstay.com" className="text-primary hover:underline">info@millionstay.com</a>
                </p>
                <p className="text-gray-700"><span className="font-medium">Website:</span>{" "}
                  <a href="https://www.millionstay.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.millionstay.com</a>
                </p>
                <p className="text-gray-700"><span className="font-medium">Address:</span> Melbourne, Victoria, Australia</p>
              </div>
            </motion.div>
          </div>

          {/* Sticky sidebar */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 space-y-5">

              {/* Jump to section */}
              <motion.div {...fade(0.1)} className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <h4 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-3">Contents</h4>
                <ul className="space-y-1.5">
                  {SECTIONS.map((s) => (
                    <li key={s.number} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-primary font-bold shrink-0 text-xs mt-0.5">{s.number}</span>
                      <span>{s.title}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>

              {/* Related links */}
              <motion.div {...fade(0.2)} className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <h4 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-3">Related</h4>
                <ul className="space-y-1.5">
                  {[
                    { label: "House Rules", href: "/house-rules" },
                    { label: "FAQ", href: "/faq" },
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

              {/* OAIC reference */}
              <motion.div {...fade(0.3)} className="rounded-xl overflow-hidden border border-orange-100">
                <div className="bg-primary px-5 py-4 text-white">
                  <h4 className="font-bold text-sm mb-1">Australian Privacy Regulator</h4>
                  <p className="text-xs text-white/80 mb-3">
                    For independent advice or to lodge a complaint, contact the Office of the Australian Information Commissioner.
                  </p>
                  <a
                    href="https://www.oaic.gov.au"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-white text-primary text-xs font-bold px-4 py-2 rounded-lg hover:bg-orange-50 transition-colors"
                  >
                    Visit oaic.gov.au →
                  </a>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

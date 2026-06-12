import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { motion } from "framer-motion";
import { Link } from "wouter";
import heroBg from "@assets/MS_Homepage_Photo_1920x1080_1775403929888.jpg";

const SECTIONS = [
  {
    number: "01",
    title: "About This Policy (APP 1)",
    body: `Million Homestay Australia Pty Ltd ("MillionStay", "we", "our", "us") is committed to protecting your privacy in accordance with the Privacy Act 1988 (Cth) and the 13 Australian Privacy Principles (APPs). This Privacy Policy explains the kinds of personal information we collect, how we hold it, the purposes for which we collect, hold, use and disclose it, how you may access or correct it, how to make a complaint, and whether we are likely to disclose information to overseas recipients. This policy is openly available on our website and we encourage you to read it before using our services.`,
  },
  {
    number: "02",
    title: "Anonymity & Pseudonymity (APP 2)",
    body: `Wherever it is lawful and practicable to do so, you may interact with us anonymously or under a pseudonym — for example, when browsing the website, making a general enquiry by email, or asking a property question. However, where we are required by law to identify you (for example, to enter into a tenancy agreement, process a payment, refund a bond, comply with the Residential Tenancies Act 1997 (Vic), or verify visa or student-enrolment eligibility), or where it is impracticable to deal with you anonymously, we will need to collect your real identity.`,
  },
  {
    number: "03",
    title: "Information We Collect (APP 3)",
    body: `We only collect personal information that is reasonably necessary for our business functions. This includes: identity information (full name, date of birth, nationality, passport, visa or government-issued ID details); contact information (email address, phone number, residential address, emergency contact); booking and tenancy information (stay dates, room preferences, payment records, lease documents); financial information (bank account name, BSB and account number for bond refunds, payment history, invoices); education information for student housing eligibility (university, course, student ID, study year); and technical information (IP address, browser type, pages visited, device identifiers, cookies). We may also collect sensitive information such as your visa status or student enrolment details, only with your consent and where it is reasonably necessary for our services.`,
  },
  {
    number: "04",
    title: "How We Collect Information (APP 3 & 5)",
    body: `Wherever practicable, we collect personal information directly from you — when you enquire or book accommodation through our website or by phone, register for a guest account, submit an application or enquiry form, communicate with us by email or in person, visit one of our properties, or sign a tenancy agreement. We may also collect information from third parties such as educational institutions (to verify student status), reference providers, real estate agents, payment processors and identity-verification providers, where you have authorised us or where it is unreasonable or impracticable to collect it directly from you. At or before the time of collection we will take reasonable steps to make you aware of the matters set out in APP 5 (including the purpose, our identity, the consequences of not providing the information, and the existence of this policy).`,
  },
  {
    number: "05",
    title: "Unsolicited Personal Information (APP 4)",
    body: `If we receive personal information about you that we did not solicit, we will determine within a reasonable period whether we could have collected it under APP 3 had we asked for it. If not — and provided it is lawful and reasonable to do so — we will destroy or de-identify the information as soon as practicable.`,
  },
  {
    number: "06",
    title: "How We Use & Disclose Your Information (APP 6)",
    body: `We use your personal information for the primary purpose for which it was collected — to process accommodation applications and bookings; manage your tenancy and communicate with you about your stay; verify your identity and eligibility; process payments and manage financial records including bonds; comply with our legal obligations under the Residential Tenancies Act 1997 (Vic), the Australian Consumer Law, taxation laws and other applicable laws; respond to your enquiries and provide customer support; and improve our website and services. We will not use or disclose your personal information for a secondary purpose unless an exception under APP 6 applies (for example, you have consented, you would reasonably expect it, or it is required or authorised by law).`,
  },
  {
    number: "07",
    title: "Direct Marketing & Spam Act 2003 (APP 7)",
    body: `We send marketing communications (deals, updates, inspiration) only where you have given express consent — for example, by ticking the optional marketing checkbox during registration or booking. We never send marketing emails on the basis of pre-ticked boxes or implied consent. Every marketing email we send identifies us as the sender, includes valid contact details, and contains a working unsubscribe link as required by the Spam Act 2003 (Cth). You may withdraw your consent at any time by clicking "unsubscribe" in any marketing email or by emailing our Privacy Officer (see below). Withdrawal takes effect within 5 business days. Transactional messages relating to your booking, account, or legal obligations are not marketing and may continue to be sent.`,
  },
  {
    number: "08",
    title: "Disclosure to Third Parties (APP 6)",
    body: `We may disclose your personal information to: our staff, contractors and service providers who assist in delivering our services (including property managers, maintenance contractors, IT providers, hosting providers, email-delivery providers, and image/document storage providers); government bodies or regulators where required or authorised by law (such as the Residential Tenancies Bond Authority, the Australian Taxation Office, or law-enforcement agencies pursuant to a lawful request); financial institutions and payment processors for payment, refund and bond processing; professional advisers such as lawyers, accountants and auditors; and authorised business partners (such as referring agents or property owners) who integrate with our systems through our secure, credential-issued and scope-limited partner API, which exposes only the limited booking information necessary for that integration and never passwords, payment-card, passport or contact details. We do not sell, rent or trade your personal information.`,
  },
  {
    number: "09",
    title: "Overseas Disclosure of Information (APP 8)",
    body: `Some of the cloud service providers we rely on store or process personal information outside Australia. The recipients, their location and the data involved are: our database (all structured personal information) is hosted on Supabase in Singapore; our web frontends are hosted on Vercel and our application server on Railway (United States); media files and documents (e.g. ID/visa images, signed contracts, room photos) are stored on Cloudinary (United States and global edge); transactional and marketing email is sent through Resend (United States and Japan); card payments are processed by Stripe (United States and other countries where Stripe operates); DNS, CDN and security filtering are provided by Cloudflare (global edge); and our customer-chat assistant and homestay host-matching feature use Anthropic's Claude API (United States) — see "Automated and AI-assisted processing" below. Before disclosing information to any overseas recipient, we take reasonable steps to ensure that the recipient does not breach the APPs in relation to that information (for example, by relying on a written Data Processing Agreement, the recipient's SOC 2 compliance, and contractual confidentiality and security obligations).`,
  },
  {
    number: "10",
    title: "Government Identifiers (APP 9)",
    body: `We do not adopt a government-issued identifier (such as a Tax File Number, Medicare number, or driver-licence number) as our own identifier for you. Where we collect a government identifier (most commonly a passport or visa number for tenancy or visa-eligibility verification), we use and disclose it only for the purpose for which it was collected or as required or authorised by law.`,
  },
  {
    number: "11",
    title: "Data Quality (APP 10)",
    body: `We take reasonable steps to ensure that the personal information we collect is accurate, up-to-date and complete, and that information we use or disclose is, having regard to the purpose, accurate, up-to-date, complete and relevant. You can help us keep your records accurate by updating your profile in the customer portal, or by emailing our Privacy Officer (see below) if anything changes.`,
  },
  {
    number: "12",
    title: "Cookies & Third-Party Website Content",
    body: `Our website uses only essential, first-party cookies that are necessary to keep you signed in and to operate bookings — we do not use third-party advertising or analytics cookies, and we do not run Google Analytics or similar visitor-tracking pixels. Cookies are small data files stored on your device; you may disable them through your browser settings, though some features (including signing in and bookings) may not work correctly without them. Some pages load resources directly from third-party providers, which necessarily receive your IP address as part of serving that content: web fonts are loaded from Google Fonts (Google, United States), and interactive maps display tiles from OpenStreetMap (OpenStreetMap Foundation). These providers receive only technical request data (such as your IP address and browser type) and not your account information.`,
  },
  {
    number: "13",
    title: "Storage & Security (APP 11)",
    body: `We take reasonable steps to protect personal information from misuse, interference, loss, unauthorised access, modification or disclosure. These measures include: encryption in transit (TLS 1.2+); hashed passwords using industry-standard algorithms; signed-URL access control for media and documents; role-based access control with least-privilege staff permissions; account lockout and rate limiting on login endpoints; audit logging; and regular security reviews. We are progressively rolling out two-factor authentication for administrative accounts. While we take data security seriously, no method of transmission over the internet is completely secure and we cannot guarantee absolute security.`,
  },
  {
    number: "14",
    title: "Retention & Destruction (APP 11.2)",
    body: `We retain personal information for only as long as it is needed for the purposes for which it was collected or as required by law. Indicative retention periods are: tax invoices and receipts — 5 years (Income Tax Assessment Act); tenancy contracts and leases — 7 years (state tenancy laws); identity, passport and visa images — 30 days after the related verification or check-out, whichever is later; general booking metadata — for the duration of the customer relationship plus 2 years; marketing-consent audit records — until 2 years after consent is withdrawn; and server request/security logs — up to 12 months. Once the retention period ends, we securely destroy or de-identify the information.`,
  },
  {
    number: "15",
    title: "Access & Correction — \"My Data\" (APP 12 & 13)",
    body: `You may access the personal information we hold about you and request correction of information that is inaccurate, out-of-date, incomplete, irrelevant or misleading. Registered guest users can view and download a complete export of their personal information at any time from the "My Data" page in their account portal (Account → My Data). You may also request access or correction by emailing our Privacy Officer (see below). We will respond within 30 days. If we refuse access or correction we will give you written reasons and tell you how to complain. There is no fee for making a request, although a reasonable cost-recovery charge may apply for fulfilling unusually large or repeated access requests.`,
  },
  {
    number: "16",
    title: "Notifiable Data Breaches Scheme",
    body: `If we become aware that personal information we hold has been involved in a data breach that is likely to result in serious harm to any affected individual, we will, in accordance with Part IIIC of the Privacy Act 1988 (Cth), assess the breach within 30 days, take reasonable steps to contain and remediate it, and notify both the affected individuals and the Office of the Australian Information Commissioner (OAIC) as soon as practicable. Our internal incident-response procedure is documented in our NDB Incident Response Runbook.`,
  },
  {
    number: "17",
    title: "Complaints (APP 1.4)",
    body: `If you believe we have breached the Australian Privacy Principles or your privacy rights, please contact our Privacy Officer first. We will acknowledge your complaint within 5 business days and provide a substantive response within 30 days. If you are not satisfied with our response, you may escalate your complaint to the Office of the Australian Information Commissioner (OAIC) at www.oaic.gov.au, by phone on 1300 363 992, or by writing to GPO Box 5288, Sydney NSW 2001.`,
  },
  {
    number: "18",
    title: "Automated and AI-assisted Processing",
    body: `We use Anthropic's Claude AI service (United States) in two ways. (1) Our website chat assistant sends the messages you type to Anthropic to generate replies; please do not enter sensitive personal information (such as passwords, payment-card or passport details) into the chat — the assistant is instructed never to request them, and the chat is optional. (2) For homestay applications, we send selected application details — which may include nationality, whether the applicant is a minor, dietary requirements, allergies, smoking status and any cultural or religious preferences relevant to living arrangements — to Claude to help generate a written explanation of why a particular host family may be a suitable match. This assists, but does not solely determine, our matching decisions; a staff member reviews matches. Anthropic processes this data only to return a response, does not use it to train its models, and retains it only transiently for abuse monitoring. Because some of this information is "sensitive information" under the Privacy Act, we collect and use it for matching only with your consent, which you give when you submit a homestay application; you may withdraw consent or request a non-automated process by contacting our Privacy Officer.`,
  },
  {
    number: "19",
    title: "Changes to This Policy",
    body: `We may update this Privacy Policy from time to time to reflect changes in our practices, the services we offer, or legal requirements. The updated policy will be posted on this page with a revised effective date. Where the change is material we will take additional steps to notify you (for example, an in-app notice or email). Continued use of our services after the effective date constitutes your acceptance of the updated policy.`,
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
              <p className="text-sm text-gray-700 font-semibold">19 April 2026</p>
              <p className="text-xs text-gray-500 mt-2">This policy applies to Million Homestay Australia Pty Ltd and complies with the Privacy Act 1988 (Cth), the 13 Australian Privacy Principles, the Notifiable Data Breaches scheme and the Spam Act 2003 (Cth).</p>
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
                <p className="text-gray-700"><span className="font-medium">Privacy Officer:</span>{" "}
                  <a href="mailto:privacy@millionstay.com" className="text-primary hover:underline">privacy@millionstay.com</a>
                </p>
                <p className="text-gray-700"><span className="font-medium">Website:</span>{" "}
                  <a href="https://www.millionstay.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.millionstay.com</a>
                </p>
                <p className="text-gray-700"><span className="font-medium">Address:</span> Melbourne, Victoria, Australia</p>
                <p className="text-gray-700 pt-2"><span className="font-medium">Access your data:</span>{" "}
                  <Link href="/portal/my-data" className="text-primary hover:underline">/portal/my-data</Link>
                </p>
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

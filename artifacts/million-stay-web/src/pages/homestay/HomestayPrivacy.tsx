import { type ReactNode } from "react";
import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero } from "@/components/homestay/sections";
import { HS } from "@/lib/homestay-theme";

// Privacy Policy for homestay.millionstay.com — Australian Privacy Principles
// (APPs) tailored to the review-and-match homestay service (host vetting,
// child safety, student matching). Reviewed alongside the main-site policy;
// have legal counsel confirm before relying on it commercially.
const EFFECTIVE_DATE = "12 June 2026";

type Clause = { n: string; title: string; body: ReactNode };

const CLAUSES: Clause[] = [
  {
    n: "01",
    title: "About this policy (APP 1)",
    body: (
      <>
        Million Homestay Australia Pty Ltd ("Million Homestay", "we", "our", "us") is committed to protecting
        your privacy in accordance with the Privacy Act 1988 (Cth) and the 13 Australian Privacy Principles
        (APPs). This policy explains what personal information we collect, how we hold it, why we collect, use
        and disclose it, how you can access or correct it, how to complain, and when we may disclose information
        overseas. It is openly available on this website.
      </>
    ),
  },
  {
    n: "02",
    title: "Anonymity & pseudonymity (APP 2)",
    body: (
      <>
        Where it is lawful and practicable, you may interact with us anonymously or under a pseudonym — for
        example, when browsing the site or making a general enquiry. Where the law requires us to identify you
        (for example, to assess a host or student application, run a Working with Children Check (WWCC),
        enter a placement agreement, or process a payment), or where dealing with you anonymously is
        impracticable, we will need to collect your real identity.
      </>
    ),
  },
  {
    n: "03",
    title: "Information we collect (APP 3)",
    body: (
      <>
        We collect only personal information reasonably necessary for our functions. This includes:
        identity information (full name, date of birth, nationality, passport, visa or government-issued ID);
        contact information (email, phone, residential address, emergency contact); application and placement
        information (preferences, household and home details, room photos, stay dates, placement agreements);
        financial information (bank account name, BSB and account number for host payments or refunds, payment
        records, invoices); and technical information (IP address, browser type, pages visited, device
        identifiers, cookies). We collect <strong>sensitive information</strong> — including a host's Working
        with Children Check, identity and residence documents, and, for students under 18, guardian details
        and consent — only where it is reasonably necessary for child safety and our services, and with consent
        where required.
      </>
    ),
  },
  {
    n: "04",
    title: "How we collect information (APP 3 & 5)",
    body: (
      <>
        Wherever practicable we collect personal information directly from you — when you submit a host or
        student application, upload documents to the portal, complete a contact form, or communicate with us.
        We may also collect information from third parties such as education agents or institutions (to verify
        a student), guardians (for under-18 students), referees, identity-verification and WWCC-verification
        providers, and payment processors, where you have authorised us or where direct collection is
        impracticable. At or before collection we take reasonable steps to make you aware of the matters in
        APP 5.
      </>
    ),
  },
  {
    n: "05",
    title: "Unsolicited personal information (APP 4)",
    body: (
      <>
        If we receive personal information we did not solicit, we determine within a reasonable period whether
        we could have collected it under APP 3. If not — and where lawful and reasonable — we destroy or
        de-identify it as soon as practicable.
      </>
    ),
  },
  {
    n: "06",
    title: "How we use & disclose your information (APP 6)",
    body: (
      <>
        We use your personal information for the primary purpose for which it was collected — to assess host
        and student applications; review host suitability and child-safety documentation; match students with
        host families by hand; manage placements and communicate with you; verify identity and eligibility;
        process payments and refunds; comply with our legal obligations; respond to enquiries; and improve our
        services. We will not use or disclose your information for a secondary purpose unless an exception
        under APP 6 applies (for example, you consented, you would reasonably expect it, or it is required or
        authorised by law).
      </>
    ),
  },
  {
    n: "07",
    title: "Direct marketing & the Spam Act 2003",
    body: (
      <>
        We send marketing communications only where you have given express consent. We do not rely on
        pre-ticked boxes or implied consent. Every marketing email identifies us, includes valid contact
        details, and contains a working unsubscribe link as required by the Spam Act 2003 (Cth). You may
        withdraw consent at any time via "unsubscribe" or by emailing our Privacy Officer; withdrawal takes
        effect within 5 business days. Transactional messages about your application, placement, account or
        legal obligations are not marketing and may continue.
      </>
    ),
  },
  {
    n: "08",
    title: "Disclosure to third parties (APP 6)",
    body: (
      <>
        We may disclose your personal information to: our staff, contractors and service providers who help
        deliver our services (including IT, hosting, email-delivery and document-storage providers); host
        families and students, or their guardians and agents, strictly as needed to arrange and manage a
        placement; government bodies or regulators where required or authorised by law (for example,
        WWCC-issuing authorities or law enforcement under a lawful request); financial institutions and
        payment processors; and professional advisers such as lawyers and accountants. We do not sell, rent or
        trade your personal information.
      </>
    ),
  },
  {
    n: "09",
    title: "Overseas disclosure (APP 8)",
    body: (
      <>
        Some cloud providers we rely on store or process personal information outside Australia, including in
        the United States — for example our application hosting and database providers, our media/document
        storage provider, and our email-delivery provider. Before disclosing information to an overseas
        recipient, we take reasonable steps to ensure the recipient does not breach the APPs (for example,
        through data-processing agreements and the provider's security certifications and contractual
        obligations).
      </>
    ),
  },
  {
    n: "10",
    title: "Government identifiers (APP 9)",
    body: (
      <>
        We do not adopt a government-issued identifier (such as a Tax File Number, Medicare number or
        driver-licence number) as our own identifier for you. Where we collect a government identifier (most
        commonly a passport or visa number, or a WWCC number), we use and disclose it only for the purpose for
        which it was collected or as required or authorised by law.
      </>
    ),
  },
  {
    n: "11",
    title: "Data quality (APP 10)",
    body: (
      <>
        We take reasonable steps to ensure the personal information we collect, use and disclose is accurate,
        up-to-date, complete and relevant. You can help by keeping your profile current in the portal or by
        emailing our Privacy Officer if anything changes.
      </>
    ),
  },
  {
    n: "12",
    title: "Cookies & analytics",
    body: (
      <>
        Our website uses cookies and similar technologies to keep you signed in, analyse traffic and improve
        your experience. You can disable cookies in your browser, though some features (including sign-in and
        applications) may not function correctly without them. Any analytics data is pseudonymised and subject
        to the relevant provider's privacy policy.
      </>
    ),
  },
  {
    n: "13",
    title: "Storage & security (APP 11)",
    body: (
      <>
        We take reasonable steps to protect personal information from misuse, interference, loss and
        unauthorised access, modification or disclosure. Measures include encryption in transit (TLS 1.2+),
        hashed passwords, signed-URL access control for documents and photos, role-based access with
        least-privilege staff permissions, rate limiting on login endpoints, and audit logging. No method of
        internet transmission is completely secure and we cannot guarantee absolute security.
      </>
    ),
  },
  {
    n: "14",
    title: "Retention & destruction (APP 11.2)",
    body: (
      <>
        We retain personal information only for as long as needed for the purposes it was collected or as
        required by law. Sensitive child-safety documents (such as WWCC, identity and residence documents) and
        room photos are held only as long as necessary for the related check and placement, then securely
        destroyed or de-identified in line with their retention dates. Financial records are retained for the
        periods required by Australian tax law. Once the retention period ends we securely destroy or
        de-identify the information.
      </>
    ),
  },
  {
    n: "15",
    title: "Access & correction (APP 12 & 13)",
    body: (
      <>
        You may access the personal information we hold about you and request correction of anything
        inaccurate, out-of-date, incomplete, irrelevant or misleading. Email our Privacy Officer to make a
        request; we will respond within 30 days. If we refuse access or correction we will give written
        reasons and explain how to complain. There is no fee to make a request, though a reasonable
        cost-recovery charge may apply to unusually large or repeated requests.
      </>
    ),
  },
  {
    n: "16",
    title: "Notifiable Data Breaches scheme",
    body: (
      <>
        If we become aware that personal information we hold has been involved in a data breach likely to
        result in serious harm, we will, in accordance with Part IIIC of the Privacy Act 1988 (Cth), assess
        the breach, take reasonable steps to contain and remediate it, and notify both the affected
        individuals and the Office of the Australian Information Commissioner (OAIC) as soon as practicable.
      </>
    ),
  },
  {
    n: "17",
    title: "Complaints",
    body: (
      <>
        If you believe we have breached the APPs or your privacy rights, please contact our Privacy Officer
        first. We will acknowledge your complaint within 5 business days and provide a substantive response
        within 30 days. If you are not satisfied, you may escalate to the OAIC at www.oaic.gov.au, by phone on
        1300 363 992, or by writing to GPO Box 5288, Sydney NSW 2001.
      </>
    ),
  },
  {
    n: "18",
    title: "Changes to this policy",
    body: (
      <>
        We may update this policy from time to time to reflect changes in our practices or legal requirements.
        The updated policy will be posted on this page with a revised effective date; where a change is
        material we will take additional steps to notify you. Continued use of our services after the
        effective date constitutes acceptance of the updated policy.
      </>
    ),
  },
];

export default function HomestayPrivacy() {
  return (
    <HomestayLayout title="Privacy Policy">
      <HsPageHero
        eyebrow="Legal"
        title="Privacy Policy"
        lead={<p>How Million Homestay collects, uses and protects your personal information under the Australian Privacy Principles.</p>}
      />
      <section>
        <div className="max-w-4xl mx-auto px-5 py-12 md:py-16">
          <div className="rounded-xl px-6 py-4 mb-10" style={{ backgroundColor: "#f6efec" }}>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Effective date</p>
            <p className="mt-1 text-sm font-semibold" style={{ color: HS.darkBrown }}>{EFFECTIVE_DATE}</p>
            <p className="mt-2 text-xs text-gray-500">
              Applies to Million Homestay Australia Pty Ltd and complies with the Privacy Act 1988 (Cth), the
              13 Australian Privacy Principles, the Notifiable Data Breaches scheme and the Spam Act 2003 (Cth).
            </p>
          </div>

          <div className="space-y-8">
            {CLAUSES.map((c) => (
              <div key={c.n} className="flex gap-4">
                <span className="shrink-0 font-black text-base leading-tight" style={{ color: HS.brand }}>{c.n}</span>
                <div>
                  <h2 className="font-bold text-base mb-1.5" style={{ color: HS.darkBrown }}>{c.title}</h2>
                  <p className="text-sm leading-relaxed text-gray-600">{c.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-xl px-6 py-5" style={{ backgroundColor: HS.cream }}>
            <h3 className="text-sm font-bold mb-2" style={{ color: HS.darkBrown }}>Contact our Privacy Officer</h3>
            <p className="text-sm text-gray-600">For privacy enquiries, access requests or complaints:</p>
            <div className="mt-3 space-y-1 text-sm text-gray-700">
              <p><span className="font-medium">Email:</span>{" "}
                <a href="mailto:millionstay.com@gmail.com" className="hover:underline" style={{ color: HS.brand }}>millionstay.com@gmail.com</a>
              </p>
              <p><span className="font-medium">Website:</span> homestay.millionstay.com</p>
              <p><span className="font-medium">Address:</span> Melbourne, Victoria, Australia</p>
            </div>
          </div>
        </div>
      </section>
    </HomestayLayout>
  );
}

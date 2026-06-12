import { type ReactNode } from "react";
import { Link } from "wouter";
import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero } from "@/components/homestay/sections";
import { HS } from "@/lib/homestay-theme";

// Terms of Service for homestay.millionstay.com. A plain-language template for
// the review-and-match homestay service — have legal counsel review before
// relying on it commercially.
const EFFECTIVE_DATE = "12 June 2026";

type Clause = { n: string; title: string; body: ReactNode };

const CLAUSES: Clause[] = [
  {
    n: "01",
    title: "About these terms",
    body: (
      <>
        These Terms of Service ("Terms") govern your use of the Million Homestay website and services operated
        by Million Homestay Australia Pty Ltd ("Million Homestay", "we", "our", "us"). By using the site,
        submitting an application, or otherwise engaging our services, you agree to these Terms. If you do not
        agree, please do not use the service.
      </>
    ),
  },
  {
    n: "02",
    title: "Our service",
    body: (
      <>
        Million Homestay is a <strong>review-and-match service</strong> that connects international students
        with reviewed Australian host families. We assess applications, review host suitability and
        child-safety documentation, and match students with hosts by hand. We are not a landlord, real-estate
        agent, education agent, or migration agent, and we do not provide accommodation, tenancy, or visa
        services ourselves. Each placement is governed by a separate placement agreement between the relevant
        parties.
      </>
    ),
  },
  {
    n: "03",
    title: "Eligibility & under-18 students",
    body: (
      <>
        You must provide accurate, complete information and have the legal capacity to enter these Terms. For
        students under 18, a parent or legal guardian must provide their details, give consent, and e-sign the
        relevant documents. We may decline or discontinue any application or placement where eligibility,
        consent, or safety requirements are not met.
      </>
    ),
  },
  {
    n: "04",
    title: "Applications & matching",
    body: (
      <>
        Applications are reviewed by our operations team. <strong>Matching is performed by people, never by an
        automatic algorithm, and we do not guarantee any specific placement or that a placement will be made.</strong>
        {" "}You may receive a host profile to review and confirm before a placement proceeds. We may request
        further information or documentation at any stage.
      </>
    ),
  },
  {
    n: "05",
    title: "Host family obligations",
    body: (
      <>
        Host families agree to provide accurate information; hold and maintain a valid Working with Children
        Check (WWCC) and any other required checks; upload genuine identity, residence and room documentation;
        provide a safe, suitable home and the agreed room and meals; and treat students with care and respect.
        Hosts are responsible for complying with all laws applicable to hosting in their state, and for the
        tax treatment of any compensation they receive.
      </>
    ),
  },
  {
    n: "06",
    title: "Student obligations",
    body: (
      <>
        Students agree to provide accurate information; respect their host family's home, rules and routines;
        communicate openly about needs and concerns; hold the correct visa and health cover; and comply with
        the placement agreement. Students are responsible for their own visa conditions, health insurance,
        finances and conduct.
      </>
    ),
  },
  {
    n: "07",
    title: "Child safety",
    body: (
      <>
        Child safety is central to our service. We collect and review WWCCs and supporting documentation, and
        we may decline, suspend or end any application or placement where we have child-safety concerns.
        Participants must report any safety concern to us promptly so it can be addressed.
      </>
    ),
  },
  {
    n: "08",
    title: "Fees, payments & refunds",
    body: (
      <>
        Fees (which may include a placement fee, deposit, ongoing stay fees, and optional services such as
        airport pickup or guardian services) are set out at the time of placement and in the placement
        agreement. Payments are processed securely online. Refunds, cancellations and any adjustments are
        governed by the placement agreement. Nothing in these Terms limits any rights you have under the
        Australian Consumer Law that cannot be excluded.
      </>
    ),
  },
  {
    n: "09",
    title: "Cancellations & changes",
    body: (
      <>
        Either party may request to cancel or change a placement in accordance with the placement agreement.
        We may also cancel or vary a placement where required for safety, legal, or eligibility reasons. We
        will use reasonable efforts to support an alternative arrangement but do not guarantee a replacement
        placement.
      </>
    ),
  },
  {
    n: "10",
    title: "Acceptable use",
    body: (
      <>
        You agree not to misuse the service — including by providing false information, impersonating others,
        attempting to gain unauthorised access, disrupting the service, or using it for any unlawful purpose.
        We may suspend or terminate access for any breach of these Terms.
      </>
    ),
  },
  {
    n: "11",
    title: "Intellectual property",
    body: (
      <>
        The website, its content, branding and software are owned by or licensed to Million Homestay and are
        protected by law. You may not copy, reproduce, or create derivative works without our permission,
        except as permitted for your personal use of the service.
      </>
    ),
  },
  {
    n: "12",
    title: "No visa, legal or tax advice",
    body: (
      <>
        Information on this site is general only. Million Homestay does not provide migration, legal,
        financial or tax advice and cannot guarantee any visa or other outcome. You should obtain qualified,
        independent advice for your circumstances.
      </>
    ),
  },
  {
    n: "13",
    title: "Disclaimers & liability",
    body: (
      <>
        The service is provided "as is" to the extent permitted by law. We do not exclude any guarantees,
        rights or remedies under the Australian Consumer Law that cannot lawfully be excluded. Subject to
        those rights, and to the maximum extent permitted by law, our liability for any claim arising from the
        service is limited to re-supplying the service or paying the cost of re-supply, and we are not liable
        for indirect or consequential loss.
      </>
    ),
  },
  {
    n: "14",
    title: "Privacy",
    body: (
      <>
        Our handling of personal information is described in our{" "}
        <Link href="/privacy" className="hover:underline" style={{ color: HS.brand }}>Privacy Policy</Link>, which
        forms part of these Terms.
      </>
    ),
  },
  {
    n: "15",
    title: "Governing law",
    body: (
      <>
        These Terms are governed by the laws of Victoria, Australia, and you submit to the non-exclusive
        jurisdiction of the courts of Victoria.
      </>
    ),
  },
  {
    n: "16",
    title: "Changes & contact",
    body: (
      <>
        We may update these Terms from time to time; the updated version will be posted on this page with a
        revised effective date, and continued use constitutes acceptance. For questions about these Terms,
        contact us at{" "}
        <a href="mailto:millionstay.com@gmail.com" className="hover:underline" style={{ color: HS.brand }}>millionstay.com@gmail.com</a>
        {" "}or via our{" "}
        <Link href="/contact" className="hover:underline" style={{ color: HS.brand }}>Contact page</Link>.
      </>
    ),
  },
];

export default function HomestayTerms() {
  return (
    <HomestayLayout title="Terms of Service">
      <HsPageHero
        eyebrow="Legal"
        title="Terms of Service"
        lead={<p>The terms on which Million Homestay provides its review-and-match homestay service.</p>}
      />
      <section>
        <div className="max-w-4xl mx-auto px-5 py-12 md:py-16">
          <div className="rounded-xl px-6 py-4 mb-10" style={{ backgroundColor: "#f6efec" }}>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Effective date</p>
            <p className="mt-1 text-sm font-semibold" style={{ color: HS.darkBrown }}>{EFFECTIVE_DATE}</p>
            <p className="mt-2 text-xs text-gray-500">
              Operated by Million Homestay Australia Pty Ltd, Melbourne, Victoria, Australia.
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
        </div>
      </section>
    </HomestayLayout>
  );
}

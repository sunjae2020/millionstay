import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero, HsSection, HsNumbered, HsCTA } from "@/components/homestay/sections";
import { HS } from "@/lib/homestay-theme";

// About Us — single-tier page. Absorbs the former How It Works (#how-it-works),
// Mission (#mission) and Vision (#vision) sub-pages as anchored sections.
const STUDENT_STEPS = [
  { title: "Apply online", body: "A guided application where you share your preferences (location, meals, dietary needs, environment). Students under 18 provide guardian details, consent, and e-signature." },
  { title: "Get matched by our team", body: "Our operations team reviews your application and matches you, by hand, with a suitable approved host family, considering region, preferences, meals, and age policy." },
  { title: "Review your match", body: "See your host family's profile and confirm." },
  { title: "Sign and pay securely online", body: "E-sign your placement agreement and complete payment in one place." },
  { title: "Arrive with support", body: "Book airport pickup and settlement support, and arrive to a clear arrival guide." },
];

const HOST_STEPS = [
  { title: "Apply online", body: "A paperless 7-step application." },
  { title: "Get instant portal access", body: "Track status and upload documents the moment you submit." },
  { title: "Transparent review", body: "Submitted → Under Review → Documents Requested → Approved / Not Approved, with an email at each step." },
  { title: "Upload safety documents", body: "WWCC, ID, proof of residence, room photos, stored securely." },
  { title: "Go live and get matched", body: "Control your listing visibility, and receive student matches from our operations team." },
];

export default function AboutUs() {
  return (
    <HomestayLayout title="About Us">
      <HsPageHero
        eyebrow="About us"
        title="Welcome to Million Homestay"
        lead={
          <>
            <p>
              Million Homestay connects international students with carefully reviewed Australian host
              families. Our team understands the journey of studying and living abroad firsthand — the
              excitement, the questions, and how much it matters to feel at home in a new country.
            </p>
            <p>
              Unlike a short-term rental marketplace, Million Homestay is built around <strong>application,
              review, and human matching</strong>. You tell us about yourself, our operations team reviews the
              details and matches you thoughtfully — never by an automatic algorithm — and the entire process,
              including secure payment and arrival support, runs online.
            </p>
          </>
        }
      />
      <HsSection heading="Bridging cultures">
        <p className="text-gray-600">
          We celebrate cultural difference and the connections it creates. For students, a homestay is a
          doorway into everyday Australian life. For host families, it's a chance to share their home and learn
          about another part of the world. We support both sides of that exchange.
        </p>
      </HsSection>
      <HsSection heading="Tailored support" tint>
        <p className="text-gray-600">
          A homestay should be more than a roof over your head. From a guided online application to airport
          pickup, settlement support, and a clear point of contact during the stay, we're a trusted partner
          throughout the journey.
        </p>
        <div className="mt-8">
          <HsCTA buttons={[
            { label: "Apply now", href: "/students/apply" },
            { label: "Become a host", href: "/for-homestay-host", variant: "outline" },
          ]} />
        </div>
      </HsSection>

      {/* How It Works (formerly /how-it-works) */}
      <HsSection id="how-it-works" heading="How it works">
        <p className="text-gray-600">
          Million Homestay is a fully online <strong>review-and-match</strong> service:
          Apply → Review → Match → Confirm → Arrive.
        </p>
        <h3 className="mt-8 mb-4 text-lg font-semibold" style={{ color: HS.darkBrown }}>For students</h3>
        <HsNumbered items={STUDENT_STEPS} />
        <h3 className="mt-10 mb-4 text-lg font-semibold" style={{ color: HS.darkBrown }}>For host families</h3>
        <HsNumbered items={HOST_STEPS} />
        <div className="mt-10 rounded-2xl p-6" style={{ backgroundColor: "#f6efec" }}>
          <h3 className="font-semibold" style={{ color: HS.darkBrown }}>Fees &amp; payment</h3>
          <p className="mt-2 text-gray-600">
            Payment is handled securely online. A typical placement includes an initial payment (placement fee +
            deposit + first period) and an ongoing monthly subscription for the stay.
          </p>
          <p className="mt-3 text-sm text-gray-500 italic">
            The exact amounts — including the weekly fee, placement fee, deposit, and optional services such as
            guardian service and airport pickup — are confirmed in writing before any payment, and set out in
            your placement agreement along with the refund terms.
          </p>
          <p className="mt-4 text-sm font-medium" style={{ color: HS.darkBrown }}>
            Our operations team reviews every application — we don't promise a guaranteed placement, and matching
            is always handled by people.
          </p>
        </div>
      </HsSection>

      {/* Mission (formerly /mission) */}
      <HsSection id="mission" heading="Our mission" tint>
        <p className="text-gray-600">
          To create homestay experiences that bridge cultures, support personal growth, and build lasting
          connections. We provide a safe, nurturing environment for international students, while giving host
          families a meaningful way to share their home, values, and traditions. Through careful, human
          matching, we make cultural exchange genuine and every stay something to remember.
        </p>
      </HsSection>

      {/* Vision (formerly /vision) */}
      <HsSection id="vision" heading="Our vision">
        <p className="text-gray-600">
          To be recognised as a trusted homestay service in Australia — known for careful human matching,
          child safety, and a seamless, fully online experience. We aspire to connect students from around the
          world with warm, reviewed host families, fostering mutual respect, understanding, and connections
          that last well beyond the stay.
        </p>
      </HsSection>
    </HomestayLayout>
  );
}

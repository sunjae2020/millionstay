import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero, HsSection, HsNumbered } from "@/components/homestay/sections";
import { HS } from "@/lib/homestay-theme";

// 1.2 How It Works
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

export default function HowItWorks() {
  return (
    <HomestayLayout title="How It Works">
      <HsPageHero
        eyebrow="How it works"
        title="Apply → Review → Match → Confirm → Arrive"
        lead={<p>Million Homestay is a fully online <strong>review-and-match</strong> service.</p>}
      />
      <HsSection heading="For students">
        <HsNumbered items={STUDENT_STEPS} />
      </HsSection>
      <HsSection heading="For host families" tint>
        <HsNumbered items={HOST_STEPS} />
      </HsSection>
      <HsSection heading="Fees & payment">
        <p className="text-gray-600">
          Payment is handled securely online. A typical placement includes an initial payment (placement fee +
          deposit + first period) and an ongoing monthly subscription for the stay.
        </p>
        <p className="mt-3 text-sm text-gray-500 italic">
          Current amounts: weekly fee [ ], placement fee [ ], deposit [ ], guardian service [ ], airport pickup [ ].
          Refund terms per the placement agreement.
        </p>
        <p className="mt-4 text-sm font-medium" style={{ color: HS.darkBrown }}>
          Our operations team reviews every application — we don't promise a guaranteed placement, and matching
          is always handled by people.
        </p>
      </HsSection>
    </HomestayLayout>
  );
}

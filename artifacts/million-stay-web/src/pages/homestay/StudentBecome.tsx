import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero, HsSection, HsBullets, HsCTA } from "@/components/homestay/sections";

// 2.1 Become a Homestay Student
const APPLYING = [
  { body: "A guided application where you share your preferences — location, meals, dietary needs, environment, and your school location and timetable." },
  { body: "An age-based flow — students under 18 provide guardian details, consent, and e-signature." },
  { body: "Get matched by our operations team — by hand, with a suitable approved host family." },
  { body: "Sign and pay securely online, then add airport pickup and settlement support if you'd like them." },
  { body: "Track everything online, from application to arrival." },
];

export default function StudentBecome() {
  return (
    <HomestayLayout title="Become a Homestay Student">
      <HsPageHero
        eyebrow="Students"
        title="Your home away from home in Australia"
        lead={
          <p>
            Living with a reviewed Australian host family is one of the best ways to settle into life here —
            safe accommodation, everyday English practice, and a genuine welcome into a local home.
          </p>
        }
      />
      <HsSection heading="Applying is fully online">
        <HsBullets items={APPLYING} />
        <div className="mt-8">
          <HsCTA buttons={[{ label: "Apply now", href: "/students/apply" }]} />
        </div>
      </HsSection>
      <HsSection tint>
        <p className="text-gray-600">
          After you apply, our <strong>operations team reviews</strong> your application and matches you, by hand,
          with a suitable approved host family. Matching is never automatic, and we don't guarantee a specific
          placement.
        </p>
      </HsSection>
    </HomestayLayout>
  );
}

import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero, HsSection, HsBullets, HsComingSoon, HsCTA } from "@/components/homestay/sections";

// 2.5 Apply Now — the online student application is a later phase, so this page
// describes what the application covers and invites students to get in touch
// in the meantime.
const COVERS = [
  { body: "Student name" },
  { body: "Age (with guardian details and e-signature if under 18)" },
  { body: "Nationality" },
  { body: "Preferred region / school location & timetable" },
  { body: "Study type (early schooling / short-term / English / adult study)" },
  { body: "Preferences (meals, dietary needs, environment)" },
  { body: "Optional add-ons (guardian service, airport pickup, settlement support)" },
];

export default function StudentApply() {
  return (
    <HomestayLayout title="Apply Now">
      <HsPageHero
        eyebrow="Students"
        title="Start your homestay application"
        lead={
          <p>
            Applying online takes just a few minutes. Share your details, get matched by our team, sign and pay
            securely, and add arrival support.
          </p>
        }
      />
      <HsSection heading="Your application covers">
        <HsBullets items={COVERS} />
        <p className="mt-6 text-sm text-gray-600">
          <strong>Documents to upload:</strong> passport copy, parent/guardian contact details, medical/allergy
          information, student profile, and a photo (used for matching).
        </p>
      </HsSection>
      <HsSection tint>
        <HsComingSoon>
          The online student application is launching soon. In the meantime, contact us to register your interest
          and we'll help you get started.
        </HsComingSoon>
        <div className="mt-6">
          <HsCTA buttons={[{ label: "Contact us", href: "/contact" }]} />
        </div>
      </HsSection>
    </HomestayLayout>
  );
}

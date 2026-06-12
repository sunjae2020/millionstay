import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero, HsSection, HsBullets, HsCTA } from "@/components/homestay/sections";

// 4.2 Study Tour
const INCLUDES = [
  { body: "Educational visits and workshops" },
  { body: "Cultural experiences and excursions" },
  { body: "Reviewed group accommodation" },
  { body: "Airport transfers and local support" },
  { body: "Pre-departure orientation" },
  { body: "A dedicated coordinator throughout" },
];

export default function StudyTour() {
  return (
    <HomestayLayout title="Study Tour">
      <HsPageHero
        eyebrow="Partners"
        title="Group study tours"
        lead={
          <p>
            We coordinate study tours for education partners — combining short courses, cultural experiences, and
            reviewed group accommodation into one program, with logistics handled end to end.
          </p>
        }
      />
      <HsSection heading="What a study tour includes">
        <HsBullets items={INCLUDES} />
      </HsSection>
      <HsSection tint>
        <p className="text-gray-600">
          <strong>How it works:</strong> share your goals and group details, and our team designs the itinerary,
          accommodation, and logistics around them.
        </p>
        <div className="mt-6">
          <HsCTA buttons={[{ label: "Plan a study tour", href: "/contact" }]} />
        </div>
      </HsSection>
    </HomestayLayout>
  );
}

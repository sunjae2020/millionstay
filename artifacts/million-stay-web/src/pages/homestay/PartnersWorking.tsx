import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero, HsSection, HsBullets, HsNumbered, HsCTA } from "@/components/homestay/sections";

// Partners — single-tier page. Absorbs the former Study Tour (#study-tour)
// sub-page as an anchored section.
const STUDY_TOUR_INCLUDES = [
  { body: "Educational visits and workshops" },
  { body: "Cultural experiences and excursions" },
  { body: "Reviewed group accommodation" },
  { body: "Airport transfers and local support" },
  { body: "Pre-departure orientation" },
  { body: "A dedicated coordinator throughout" },
];

const WHY = [
  { title: "A reviewed host network", body: "Hosts are reviewed by our operations team with safety documents (including WWCC) on file." },
  { title: "Human, considered placements", body: "Students are matched thoughtfully, never by automatic algorithm." },
  { title: "Apply & manage on behalf of students", body: "Use the agent portal to submit applications, track status, handle payment, and manage placements." },
  { title: "Commission settlement", body: "Transparent commission tracking and settlement built in." },
  { title: "Transparency", body: "Clear review stages and email updates keep everyone informed." },
  { title: "Ongoing support", body: "A point of contact throughout each student's stay." },
];

const HOW = [
  { title: "Initial consultation", body: "We learn your students' needs and preferences." },
  { title: "Partnership agreement", body: "Clear roles, responsibilities, and expectations." },
  { title: "Submit student profiles", body: "Through your agent portal." },
  { title: "Review & placement", body: "Our operations team reviews hosts and matches by hand." },
  { title: "Confirm, sign & pay", body: "Online, with commission tracked automatically." },
  { title: "Ongoing support & feedback", body: "Regular communication throughout the stay." },
];

export default function PartnersWorking() {
  return (
    <HomestayLayout title="Working With Partners">
      <HsPageHero
        eyebrow="Partners"
        title="For education agents & institutes"
        lead={
          <p>
            Partner with Million Homestay to give your international students safe, reviewed homestay
            accommodation, matched by people who care about the details — and manage it all from one place.
          </p>
        }
      />
      <HsSection heading="Why partners work with us">
        <HsBullets items={WHY} />
      </HsSection>
      <HsSection heading="How partnership works" tint>
        <HsNumbered items={HOW} />
        <div className="mt-8">
          <HsCTA buttons={[
            { label: "Partner with us", href: "/contact" },
            { label: "Open agent portal", href: "#", disabled: true },
          ]} />
        </div>
      </HsSection>

      {/* Study Tour (formerly /partners/study-tour) */}
      <HsSection id="study-tour" heading="Group study tours">
        <p className="text-gray-600">
          We coordinate study tours for education partners — combining short courses, cultural experiences, and
          reviewed group accommodation into one program, with logistics handled end to end.
        </p>
        <h3 className="mt-8 mb-5 text-lg font-semibold">What a study tour includes</h3>
        <HsBullets items={STUDY_TOUR_INCLUDES} />
        <p className="mt-8 text-gray-600">
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

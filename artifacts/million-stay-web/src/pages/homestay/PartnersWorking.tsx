import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero, HsSection, HsBullets, HsNumbered, HsCTA } from "@/components/homestay/sections";

// 4.1 Working With Partners
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
    </HomestayLayout>
  );
}

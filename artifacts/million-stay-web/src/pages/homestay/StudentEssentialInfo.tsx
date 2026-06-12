import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero, HsSection, HsBullets } from "@/components/homestay/sections";

// 2.4 Essential Information
const INFO = [
  { title: "Visa", body: <>Hold the correct visa and understand its conditions, including work and duration limits. <em>Million Homestay does not provide visa advice and cannot guarantee any visa outcome — seek qualified migration advice.</em></> },
  { title: "Health cover", body: "Arrange Overseas Student Health Cover (OSHC) and understand your policy." },
  { title: "Finances & budgeting", body: "Plan for tuition, living, and accommodation costs." },
  { title: "Accommodation", body: "Your homestay is reviewed and arranged through Million Homestay — understand your placement agreement." },
  { title: "Culture", body: "Learn local customs and social norms; be open-minded and respectful." },
  { title: "Education system", body: "Understand course structures, expectations, and on-campus support." },
  { title: "Work rights", body: "Know your visa's work conditions; obtain a Tax File Number (TFN) if relevant." },
  { title: "Health & wellbeing", body: "Register with a local doctor and know emergency services." },
  { title: "Safety & security", body: "Stay aware of your surroundings and keep documents secure." },
  { title: "Support networks", body: "Use international student advisors and peer support at your institution." },
];

export default function StudentEssentialInfo() {
  return (
    <HomestayLayout title="Essential Information">
      <HsPageHero eyebrow="Students" title="What to know before you go — and during your stay" />
      <HsSection>
        <HsBullets items={INFO} />
      </HsSection>
    </HomestayLayout>
  );
}

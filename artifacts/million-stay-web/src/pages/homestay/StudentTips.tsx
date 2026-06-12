import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero, HsSection, HsNumbered } from "@/components/homestay/sections";

// 2.3 10 Useful Tips (for students)
const TIPS = [
  { title: "Be respectful and considerate", body: "of your host family's home, rules, and routines." },
  { title: "Communicate openly", body: "about your needs, concerns, and expectations." },
  { title: "Embrace cultural exchange", body: "ask questions and share your own culture." },
  { title: "Join family activities", body: "to bond and experience local life." },
  { title: "Help with chores", body: "like setting the table or tidying shared spaces." },
  { title: "Share dietary needs", body: "clearly, including allergies and restrictions." },
  { title: "Respect house rules", body: "including curfews and quiet hours." },
  { title: "Stay on top of your studies", body: "and tell your host about your study needs." },
  { title: "Engage with the community", body: "through clubs, events, and activities." },
  { title: "Express gratitude", body: "small gestures of appreciation go a long way." },
];

export default function StudentTips() {
  return (
    <HomestayLayout title="10 Useful Tips for Students">
      <HsPageHero eyebrow="Students" title="10 useful tips for students" />
      <HsSection>
        <HsNumbered items={TIPS} />
      </HsSection>
    </HomestayLayout>
  );
}

import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero, HsSection, HsCards } from "@/components/homestay/sections";

// 2.2 Advantages
const ADVANTAGES = [
  { title: "Cultural immersion", body: "Live Australian daily life, traditions, and language firsthand." },
  { title: "Language development", body: "Everyday conversation with your host family builds confidence and fluency in a supportive setting." },
  { title: "Safety and support", body: "Host families are reviewed by our operations team, with safety documents (including WWCC) on file. You'll have a point of contact during your stay, plus airport pickup and settlement support." },
  { title: "Easy adaptation", body: "Experienced hosts help you find your feet, with local know-how on transport, services, and community life." },
  { title: "Value", body: "Homestay often includes meals and utilities, making it easier to budget and focus on your studies." },
  { title: "A sense of belonging", body: "A caring, family-like environment helps you feel at home in a new country." },
];

export default function StudentAdvantages() {
  return (
    <HomestayLayout title="Advantages">
      <HsPageHero eyebrow="Students" title="Why students choose Million Homestay" />
      <HsSection>
        <HsCards items={ADVANTAGES} />
      </HsSection>
    </HomestayLayout>
  );
}

import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero, HsSection, HsCards, HsBullets } from "@/components/homestay/sections";

// 3.2 Host Family Benefits
const BENEFITS = [
  { title: "Cultural exchange", body: "Share Australian customs and daily life while learning about your student's home country." },
  { title: "Language and connection", body: "Everyday conversation helps your student's English flourish, and many host families form lasting friendships." },
  { title: "Supplementary income", body: <>Hosting can help offset household costs through compensation for accommodation and meals, paid reliably through our online system. <em>Tax treatment varies — please consult a tax professional.</em></> },
  { title: "Personal fulfilment", body: "Supporting a student as they settle into a new country is deeply rewarding." },
];

const COMMITMENT = [
  { title: "Careful review", body: "A thorough process including documentation, and where appropriate interviews and home checks." },
  { title: "Thoughtful matching", body: "Our operations team considers your preferences, household, and lifestyle when matching students." },
  { title: "Reliable payments", body: "Compensation handled through our secure online system." },
  { title: "Ongoing support", body: "A point of contact for questions and concerns throughout the hosting period." },
  { title: "Orientation and guidance", body: "Practical information on expectations, communication, and creating a welcoming environment." },
  { title: "Respect for your home", body: "Clear expectations and house rules so your privacy and boundaries are respected." },
];

export default function HostBenefits() {
  return (
    <HomestayLayout title="Host Family Benefits">
      <HsPageHero eyebrow="Host families" title="Why host with Million Homestay" />
      <HsSection>
        <HsCards items={BENEFITS} />
      </HsSection>
      <HsSection heading="Our commitment to host families" tint>
        <HsBullets items={COMMITMENT} />
      </HsSection>
    </HomestayLayout>
  );
}

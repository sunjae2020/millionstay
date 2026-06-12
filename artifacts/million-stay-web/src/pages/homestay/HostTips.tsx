import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero, HsSection, HsNumbered } from "@/components/homestay/sections";

// 3.3 10 Useful Tips (for host families)
const TIPS = [
  { title: "Communicate openly", body: "invite your student to share needs and expectations from day one." },
  { title: "Set clear house rules", body: "share them early and apply them consistently." },
  { title: "Respect cultural differences", body: "learn customs and dietary preferences, and accommodate where you can." },
  { title: "Provide a comfortable space", body: "a private room with a bed, desk, lamp, and storage." },
  { title: "Offer guidance", body: "help with transport, local services, and life in Australia." },
  { title: "Encourage language practice", body: "create natural opportunities for conversation." },
  { title: "Include them in family life", body: "shared meals, outings, and celebrations build connection." },
  { title: "Provide balanced meals", body: "be mindful of allergies and restrictions while introducing local food." },
  { title: "Respect privacy", body: "give your student space to study, rest, and stay connected to their own culture." },
  { title: "Foster friendship", body: "help them connect with the local community." },
];

export default function HostTips() {
  return (
    <HomestayLayout title="10 Useful Tips for Host Families">
      <HsPageHero eyebrow="Host families" title="10 useful tips for host families" />
      <HsSection>
        <HsNumbered items={TIPS} />
      </HsSection>
    </HomestayLayout>
  );
}

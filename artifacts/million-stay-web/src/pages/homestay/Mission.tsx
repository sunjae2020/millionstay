import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero } from "@/components/homestay/sections";

// 1.3 Mission Statement
export default function Mission() {
  return (
    <HomestayLayout title="Mission Statement">
      <HsPageHero
        eyebrow="Mission"
        title="Our Mission"
        lead={
          <p>
            To create homestay experiences that bridge cultures, support personal growth, and build lasting
            connections. We provide a safe, nurturing environment for international students, while giving host
            families a meaningful way to share their home, values, and traditions. Through careful, human
            matching, we make cultural exchange genuine and every stay something to remember.
          </p>
        }
      />
    </HomestayLayout>
  );
}

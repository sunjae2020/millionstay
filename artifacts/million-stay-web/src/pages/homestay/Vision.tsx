import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero } from "@/components/homestay/sections";

// 1.4 Vision Statement
export default function Vision() {
  return (
    <HomestayLayout title="Vision Statement">
      <HsPageHero
        eyebrow="Vision"
        title="Our Vision"
        lead={
          <p>
            To be recognised as a trusted homestay service in Australia — known for careful human matching,
            child safety, and a seamless, fully online experience. We aspire to connect students from around the
            world with warm, reviewed host families, fostering mutual respect, understanding, and connections
            that last well beyond the stay.
          </p>
        }
      />
    </HomestayLayout>
  );
}

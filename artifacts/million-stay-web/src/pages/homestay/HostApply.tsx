import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero, HsSection, HsNumbered, HsCTA } from "@/components/homestay/sections";

// 3.4 Apply Now — the host application is LIVE; this page funnels to it.
const STEPS = [
  { body: "Host information" },
  { body: "Household members" },
  { body: "Home & room" },
  { body: "Student preferences" },
  { body: "Your introduction" },
  { body: "Emergency contact" },
  { body: "Terms & e-signature" },
];

export default function HostApply() {
  return (
    <HomestayLayout title="Become a Host — Apply Now">
      <HsPageHero
        eyebrow="Host families"
        title="Become a host today"
        lead={
          <p>
            Ready to open your home? The application is online and takes just a few minutes to start. You'll get
            instant access to your host portal to track your progress and upload documents.
          </p>
        }
      />
      <HsSection heading="You'll complete 7 steps">
        <HsNumbered items={STEPS} />
        <p className="mt-6 text-sm text-gray-600">
          <strong>Documents to have ready:</strong> WWCC (Working With Children Check), ID, proof of residence,
          room photos.
        </p>
        <div className="mt-8">
          <HsCTA buttons={[{ label: "Start your host application", href: "/for-homestay-host" }]} />
        </div>
      </HsSection>
    </HomestayLayout>
  );
}

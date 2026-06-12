import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero, HsSection, HsNumbered, HsCTA } from "@/components/homestay/sections";

// 3.1 Become a Host Family
const STEPS = [
  { title: "Apply online", body: "A paperless, 7-step application: your details, household, home & room, student preferences, your introduction, emergency contact, terms & e-signature." },
  { title: "Get instant portal access", body: "Log in straight away to track progress and upload documents." },
  { title: "Transparent review", body: "Follow clear stages (Submitted → Under Review → Documents Requested → Approved / Not Approved) with an email at each step." },
  { title: "Upload safety documents securely", body: "WWCC, ID, proof of residence, room photos." },
  { title: "Go live and get matched", body: "Control your listing visibility, and receive student matches from our operations team." },
];

export default function HostBecome() {
  return (
    <HomestayLayout title="Become a Host Family">
      <HsPageHero
        eyebrow="Host families"
        title="Open your home to an international student"
        lead={
          <p>
            Hosting is a rewarding way to share your culture, support a young person's journey, and welcome a new
            perspective into your home. With Million Homestay, the whole host journey is online.
          </p>
        }
      />
      <HsSection heading="Getting started takes minutes">
        <HsNumbered items={STEPS} />
        <div className="mt-8">
          <HsCTA buttons={[{ label: "Start your host application", href: "/for-homestay-host" }]} />
        </div>
      </HsSection>
    </HomestayLayout>
  );
}

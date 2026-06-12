import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero, HsSection, HsNumbered, HsCards, HsBullets, HsCTA } from "@/components/homestay/sections";

// Host Family — single-tier page. Absorbs the former Host Family Benefits
// (#benefits) and 10 Useful Tips (#tips) sub-pages as anchored sections.
// "Apply Now" stays a separate page (/for-homestay-host), reached via CTA.
const STEPS = [
  { title: "Apply online", body: "A paperless, 7-step application: your details, household, home & room, student preferences, your introduction, emergency contact, terms & e-signature." },
  { title: "Get instant portal access", body: "Log in straight away to track progress and upload documents." },
  { title: "Transparent review", body: "Follow clear stages (Submitted → Under Review → Documents Requested → Approved / Not Approved) with an email at each step." },
  { title: "Upload safety documents securely", body: "WWCC, ID, proof of residence, room photos." },
  { title: "Go live and get matched", body: "Control your listing visibility, and receive student matches from our operations team." },
];

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

      {/* Host Family Benefits (formerly /hosts/benefits) */}
      <HsSection id="benefits" heading="Why host with Million Homestay" tint>
        <HsCards items={BENEFITS} />
        <h3 className="mt-10 mb-5 text-lg font-semibold">Our commitment to host families</h3>
        <HsBullets items={COMMITMENT} />
      </HsSection>

      {/* 10 Useful Tips (formerly /hosts/tips) */}
      <HsSection id="tips" heading="10 useful tips for host families">
        <HsNumbered items={TIPS} />
        <div className="mt-8">
          <HsCTA buttons={[{ label: "Start your host application", href: "/for-homestay-host" }]} />
        </div>
      </HsSection>
    </HomestayLayout>
  );
}

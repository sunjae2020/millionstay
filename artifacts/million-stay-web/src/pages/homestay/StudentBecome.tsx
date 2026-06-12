import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero, HsSection, HsBullets, HsCards, HsNumbered, HsCTA } from "@/components/homestay/sections";

// Student — single-tier page. Absorbs the former Advantages (#advantages),
// 10 Useful Tips (#tips) and Essential Information (#essentials) sub-pages as
// anchored sections. "Apply Now" stays a separate page, reached via CTA.
const APPLYING = [
  { body: "A guided application where you share your preferences — location, meals, dietary needs, environment, and your school location and timetable." },
  { body: "An age-based flow — students under 18 provide guardian details, consent, and e-signature." },
  { body: "Get matched by our operations team — by hand, with a suitable approved host family." },
  { body: "Sign and pay securely online, then add airport pickup and settlement support if you'd like them." },
  { body: "Track everything online, from application to arrival." },
];

const ADVANTAGES = [
  { title: "Cultural immersion", body: "Live Australian daily life, traditions, and language firsthand." },
  { title: "Language development", body: "Everyday conversation with your host family builds confidence and fluency in a supportive setting." },
  { title: "Safety and support", body: "Host families are reviewed by our operations team, with safety documents (including WWCC) on file. You'll have a point of contact during your stay, plus airport pickup and settlement support." },
  { title: "Easy adaptation", body: "Experienced hosts help you find your feet, with local know-how on transport, services, and community life." },
  { title: "Value", body: "Homestay often includes meals and utilities, making it easier to budget and focus on your studies." },
  { title: "A sense of belonging", body: "A caring, family-like environment helps you feel at home in a new country." },
];

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

export default function StudentBecome() {
  return (
    <HomestayLayout title="Become a Homestay Student">
      <HsPageHero
        eyebrow="Students"
        title="Your home away from home in Australia"
        lead={
          <p>
            Living with a reviewed Australian host family is one of the best ways to settle into life here —
            safe accommodation, everyday English practice, and a genuine welcome into a local home.
          </p>
        }
      />
      <HsSection heading="Applying is fully online">
        <HsBullets items={APPLYING} />
        <div className="mt-8">
          <HsCTA buttons={[{ label: "Apply now", href: "/students/apply" }]} />
        </div>
      </HsSection>
      <HsSection tint>
        <p className="text-gray-600">
          After you apply, our <strong>operations team reviews</strong> your application and matches you, by hand,
          with a suitable approved host family. Matching is never automatic, and we don't guarantee a specific
          placement.
        </p>
      </HsSection>

      {/* Advantages (formerly /students/advantages) */}
      <HsSection id="advantages" heading="Why students choose Million Homestay">
        <HsCards items={ADVANTAGES} />
      </HsSection>

      {/* 10 Useful Tips (formerly /students/tips) */}
      <HsSection id="tips" heading="10 useful tips for students" tint>
        <HsNumbered items={TIPS} />
      </HsSection>

      {/* Essential Information (formerly /students/essential-information) */}
      <HsSection id="essentials" heading="Essential information — before you go and during your stay">
        <HsBullets items={INFO} />
        <div className="mt-8">
          <HsCTA buttons={[{ label: "Apply now", href: "/students/apply" }]} />
        </div>
      </HsSection>
    </HomestayLayout>
  );
}

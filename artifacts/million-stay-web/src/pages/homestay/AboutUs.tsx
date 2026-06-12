import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero, HsSection, HsCTA } from "@/components/homestay/sections";

// 1.1 About Us
export default function AboutUs() {
  return (
    <HomestayLayout title="About Us">
      <HsPageHero
        eyebrow="About us"
        title="Welcome to Million Homestay"
        lead={
          <>
            <p>
              Million Homestay connects international students with carefully reviewed Australian host
              families. Our team understands the journey of studying and living abroad firsthand — the
              excitement, the questions, and how much it matters to feel at home in a new country.
            </p>
            <p>
              Unlike a short-term rental marketplace, Million Homestay is built around <strong>application,
              review, and human matching</strong>. You tell us about yourself, our operations team reviews the
              details and matches you thoughtfully — never by an automatic algorithm — and the entire process,
              including secure payment and arrival support, runs online.
            </p>
          </>
        }
      />
      <HsSection heading="Bridging cultures">
        <p className="text-gray-600">
          We celebrate cultural difference and the connections it creates. For students, a homestay is a
          doorway into everyday Australian life. For host families, it's a chance to share their home and learn
          about another part of the world. We support both sides of that exchange.
        </p>
      </HsSection>
      <HsSection heading="Tailored support" tint>
        <p className="text-gray-600">
          A homestay should be more than a roof over your head. From a guided online application to airport
          pickup, settlement support, and a clear point of contact during the stay, we're a trusted partner
          throughout the journey.
        </p>
        <div className="mt-8">
          <HsCTA buttons={[
            { label: "See how it works", href: "/how-it-works" },
            { label: "Apply now", href: "/students/apply", variant: "outline" },
          ]} />
        </div>
      </HsSection>
    </HomestayLayout>
  );
}

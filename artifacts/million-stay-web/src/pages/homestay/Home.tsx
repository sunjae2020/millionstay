import { Link } from "wouter";
import { ArrowRight, Users, Baby, ShieldCheck, Globe2, BadgeCheck } from "lucide-react";
import hero from "@assets/MS_Homepage_Photo_1920x1080_1775403929888.jpg";
import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HS, HS_FONT } from "@/lib/homestay-theme";

// 0. MAIN HOME — content from the Million Homestay site-content doc (page 0).
// CTAs to not-yet-built features (student apply, partners, full process) route
// to their pages, which render the "coming soon" stub until that phase ships.

const WHY = [
  { icon: Users, title: "People match, not algorithms", body: "Every placement is reviewed and matched by our operations team." },
  { icon: Baby, title: "Students of all ages", body: "Adult and younger students alike, with guardian consent and signature built in for anyone under 18." },
  { icon: ShieldCheck, title: "Safety first", body: "Working with Children Check (WWCC) and other safety documents are part of host review." },
  { icon: Globe2, title: "Fully online, end to end", body: "Application, documents, e-signature, and payment, all in one place. No paper forms." },
  { icon: BadgeCheck, title: "Transparent every step", body: "Clear review stages and email updates, so you always know where things stand." },
];

const EXPLORE = [
  { title: "For students", body: "Apply online, get matched by our team, pay securely, and arrive with support.", cta: "Apply now", href: "/students/apply" },
  { title: "For host families", body: "Apply online today, track your progress in your own portal, and control your listing.", cta: "Become a Host", href: "/for-homestay-host" },
  { title: "For partners", body: "Education agents and institutes — apply and manage on behalf of your students.", cta: "Partner with us", href: "/partners" },
];

const STEPS = ["Apply", "Review", "Match", "Confirm", "Arrive"];

export default function HomestayHome() {
  return (
    <HomestayLayout>
      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0">
          <img src={hero} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(63,45,49,0.78) 0%, rgba(63,45,49,0.45) 60%, rgba(63,45,49,0.25) 100%)" }} />
        </div>
        <div className="relative max-w-6xl mx-auto px-5 py-24 md:py-32">
          <div className="max-w-2xl text-white">
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight" style={{ fontFamily: HS_FONT.head }}>
              Find your Australian home — or open your home to a student.
            </h1>
            <p className="mt-5 text-lg text-white/90">
              <strong>Million Homestay</strong> is a review-and-match homestay service in Australia.
              We're not a self-serve booking site — real people on our operations team review every host
              family and match every student by hand, with safety at the centre. From application to
              payment to arrival support, the whole journey is online.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/students/apply" className="px-6 py-3 rounded-lg font-semibold text-white inline-flex items-center gap-2" style={{ backgroundColor: HS.brand }}>
                Find a Homestay <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/for-homestay-host" className="px-6 py-3 rounded-lg font-semibold inline-flex items-center gap-2 bg-white text-gray-900">
                Become a Host
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Why Million Homestay */}
      <section className="max-w-6xl mx-auto px-5 py-16 md:py-20">
        <h2 className="text-3xl font-bold text-center" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>Why Million Homestay</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {WHY.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl p-6" style={{ backgroundColor: HS.cream }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: "white", color: HS.brand }}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="mt-4 font-semibold" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>{title}</h3>
              <p className="mt-2 text-sm text-gray-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Explore */}
      <section style={{ backgroundColor: "#f6efec" }} className="border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-5 py-16 grid gap-6 md:grid-cols-3">
          {EXPLORE.map((c) => (
            <div key={c.title} className="bg-white rounded-2xl border border-gray-100 p-7 flex flex-col">
              <h3 className="text-lg font-bold" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>{c.title}</h3>
              <p className="mt-2 text-sm text-gray-600 flex-1">{c.body}</p>
              <Link href={c.href} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: HS.brand }}>
                {c.cta} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* How it works at a glance */}
      <section className="max-w-6xl mx-auto px-5 py-16 md:py-20 text-center">
        <h2 className="text-3xl font-bold" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>How it works</h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-3">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <span className="px-4 py-2 rounded-full text-sm font-semibold" style={{ backgroundColor: HS.cream, color: HS.darkBrown }}>{s}</span>
              {i < STEPS.length - 1 && <ArrowRight className="w-4 h-4 text-gray-300" />}
            </div>
          ))}
        </div>
        <p className="mt-6 text-gray-600 max-w-2xl mx-auto">
          You apply online, our operations team reviews and matches by hand, you sign and pay securely,
          and we support your arrival — including airport pickup and settlement.
        </p>
        <Link href="/how-it-works" className="mt-7 inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white" style={{ backgroundColor: HS.brand }}>
          See the full process <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </HomestayLayout>
  );
}

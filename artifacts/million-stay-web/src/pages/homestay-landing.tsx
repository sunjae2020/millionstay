import { Link } from "wouter";
import { Home, GraduationCap, ShieldCheck, ArrowRight } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

// Homestay landing — rendered at homestay.millionstay.com (Phase 0 skeleton).
//
// This is the dedicated homestay entry point, separate from the short-term
// rental home. Copy/imagery below are PLACEHOLDERS to be replaced from the
// forthcoming landing-content document; the structure (hero → value props →
// CTAs) is in place so content can drop in without further wiring.
const BRAND = "#E8621A";

// PLACEHOLDER copy — replace from the homestay landing-content doc.
const HERO_TITLE = "Homestay with MillionStay";
const HERO_SUBTITLE =
  "Carefully matched host families for international students — safe, supported, and verified.";

const VALUE_PROPS = [
  { icon: Home, title: "Verified host families", body: "Every host is screened and approved before placement." },
  { icon: GraduationCap, title: "Student-first matching", body: "Matched by our team to your preferences, school, and needs." },
  { icon: ShieldCheck, title: "Supported & secure", body: "Guardianship-aware for minors, with ongoing support." },
];

export default function HomestayLanding() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="max-w-5xl mx-auto px-6 py-20 md:py-28 text-center">
            <span
              className="inline-block text-xs font-semibold tracking-wide uppercase px-3 py-1 rounded-full mb-5"
              style={{ color: BRAND, backgroundColor: `${BRAND}1a` }}
            >
              Homestay
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">{HERO_TITLE}</h1>
            <p className="mt-5 text-lg text-gray-600 max-w-2xl mx-auto">{HERO_SUBTITLE}</p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              {/* Student application is built in a later phase; CTA is a placeholder. */}
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium opacity-60 cursor-not-allowed"
                style={{ backgroundColor: BRAND }}
                title="Coming soon"
              >
                Find a homestay <span className="text-xs font-normal">(coming soon)</span>
              </button>
              <Link
                href="/for-homestay-host"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium border border-gray-300 text-gray-800 hover:border-gray-400"
              >
                Become a host family <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Value props */}
        <section className="bg-gray-50 border-y border-gray-100">
          <div className="max-w-5xl mx-auto px-6 py-16 grid gap-8 md:grid-cols-3">
            {VALUE_PROPS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="text-center md:text-left">
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center mb-4 mx-auto md:mx-0"
                  style={{ backgroundColor: `${BRAND}1a`, color: BRAND }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm text-gray-600">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Host CTA strip */}
        <section className="max-w-5xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Already a host family?</h2>
          <p className="mt-2 text-gray-600">Manage your application, documents, and placements.</p>
          <Link
            href="/host-login"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: BRAND }}
          >
            Host login <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}

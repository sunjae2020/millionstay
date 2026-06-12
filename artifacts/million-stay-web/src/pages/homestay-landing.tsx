import { Link } from "wouter";
import {
  ArrowRight,
  FileText,
  UserCheck,
  Upload,
  Home,
  ShieldCheck,
  Mail,
  ListChecks,
  Users,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

// Homestay landing — rendered at homestay.millionstay.com.
//
// Copy reflects docs/proposals/HOMESTAY_HOMEPAGE_BRIEF.md: the host-family
// application + portal is LIVE and advertised confidently; student
// applications, online payment, and agent placement are "coming soon" only.
// Matching is human/admin-brokered — no automated/instant-matching claims, no
// price/guarantee language.
const BRAND = "#E8621A";

const HOST_STEPS = [
  { icon: FileText, title: "Apply", body: "Complete the paperless 7-step host application online." },
  { icon: UserCheck, title: "Review", body: "Our team reviews your application — you're kept informed by email." },
  { icon: Upload, title: "Documents", body: "Securely upload safety documents (WWCC, ID, proof of residence)." },
  { icon: Home, title: "Approved & listed", body: "Once approved, control when your profile appears publicly." },
];

const HOST_FEATURES = [
  { icon: FileText, title: "Paperless application", body: "A guided 7-step form — no paper, no printing." },
  { icon: ListChecks, title: "Instant portal", body: "Track your application and upload documents from day one — before approval." },
  { icon: Mail, title: "Email at every stage", body: "Submitted, under review, documents requested, approved — you always know where you stand." },
  { icon: ShieldCheck, title: "Safe by design", body: "WWCC and host screening, with documents stored securely." },
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
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
              Find your Australian home, or open your home to a student.
            </h1>
            <p className="mt-5 text-lg text-gray-600 max-w-2xl mx-auto">
              A homestay service matched by people, not algorithms. Verified host families,
              careful screening, and a fully online application.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/for-homestay-host"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium"
                style={{ backgroundColor: BRAND }}
              >
                Become a host <ArrowRight className="w-4 h-4" />
              </Link>
              {/* Student applications are coming soon — CTA is a placeholder. */}
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium border border-gray-300 text-gray-500 opacity-70 cursor-not-allowed"
                title="Coming soon"
              >
                Find a homestay <span className="text-xs font-normal">(coming soon)</span>
              </button>
            </div>
          </div>
        </section>

        {/* How it works (Host) */}
        <section className="bg-gray-50 border-y border-gray-100">
          <div className="max-w-5xl mx-auto px-6 py-16">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-gray-900">Becoming a host family</h2>
              <p className="mt-2 text-gray-600">Apply → review → documents → approved. Fully online.</p>
            </div>
            <ol className="grid gap-6 md:grid-cols-4">
              {HOST_STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="relative bg-white rounded-xl border border-gray-100 p-5">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                    style={{ backgroundColor: `${BRAND}1a`, color: BRAND }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="absolute top-5 right-5 text-sm font-bold text-gray-300">{i + 1}</span>
                  <h3 className="font-semibold text-gray-900">{title}</h3>
                  <p className="mt-1.5 text-sm text-gray-600">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* What hosts get */}
        <section className="max-w-5xl mx-auto px-6 py-16">
          <div className="grid gap-8 md:grid-cols-2">
            {HOST_FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4">
                <div
                  className="shrink-0 w-11 h-11 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${BRAND}1a`, color: BRAND }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{title}</h3>
                  <p className="mt-1 text-sm text-gray-600">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Trust & safety */}
        <section className="bg-gray-900 text-white">
          <div className="max-w-5xl mx-auto px-6 py-14 grid gap-8 md:grid-cols-3 text-center md:text-left">
            <div>
              <Users className="w-6 h-6 mb-3 mx-auto md:mx-0" style={{ color: BRAND }} />
              <h3 className="font-semibold">Matched by people</h3>
              <p className="mt-1.5 text-sm text-gray-300">Our team reviews and matches each placement — there's no automated instant matching.</p>
            </div>
            <div>
              <ShieldCheck className="w-6 h-6 mb-3 mx-auto md:mx-0" style={{ color: BRAND }} />
              <h3 className="font-semibold">Safety first</h3>
              <p className="mt-1.5 text-sm text-gray-300">WWCC (Working With Children Check) and host screening before any placement.</p>
            </div>
            <div>
              <Upload className="w-6 h-6 mb-3 mx-auto md:mx-0" style={{ color: BRAND }} />
              <h3 className="font-semibold">Secure documents</h3>
              <p className="mt-1.5 text-sm text-gray-300">Sensitive documents are stored securely with restricted access.</p>
            </div>
          </div>
        </section>

        {/* For students & agents — coming soon */}
        <section className="max-w-5xl mx-auto px-6 py-16 text-center">
          <span
            className="inline-block text-xs font-semibold tracking-wide uppercase px-3 py-1 rounded-full mb-4"
            style={{ color: BRAND, backgroundColor: `${BRAND}1a` }}
          >
            Coming soon
          </span>
          <h2 className="text-2xl font-bold text-gray-900">For students & agents</h2>
          <p className="mt-2 text-gray-600 max-w-2xl mx-auto">
            Online student applications, secure payment, and agent-assisted placement are on the way.
            Hosts can apply today.
          </p>
        </section>

        {/* Host login */}
        <section className="bg-gray-50 border-t border-gray-100">
          <div className="max-w-5xl mx-auto px-6 py-12 text-center">
            <h2 className="text-xl font-bold text-gray-900">Already a host family?</h2>
            <p className="mt-2 text-gray-600">Manage your application, documents, and listing.</p>
            <Link
              href="/host-login"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold"
              style={{ color: BRAND }}
            >
              Host login <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

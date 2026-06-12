import { Link } from "wouter";
import { HS, HS_FONT } from "@/lib/homestay-theme";

// Million Homestay footer — dedicated shell for homestay.millionstay.com.
// Footer mirrors the single-tier nav: each column heads to a consolidated page,
// with in-page #anchors for the absorbed sub-topics.
const COLUMNS: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: "About Us",
    links: [
      { label: "About Us", href: "/about" },
      { label: "How It Works", href: "/about#how-it-works" },
      { label: "Mission", href: "/about#mission" },
      { label: "Vision", href: "/about#vision" },
    ],
  },
  {
    title: "Student",
    links: [
      { label: "Become a Student", href: "/students" },
      { label: "Advantages", href: "/students#advantages" },
      { label: "Essential Information", href: "/students#essentials" },
      { label: "Apply Now", href: "/students/apply" },
    ],
  },
  {
    title: "Host Family",
    links: [
      { label: "Become a Host Family", href: "/hosts/become-a-host" },
      { label: "Host Family Benefits", href: "/hosts/become-a-host#benefits" },
      { label: "Apply Now", href: "/for-homestay-host" },
      { label: "Host Login", href: "/host-login" },
    ],
  },
  {
    title: "Partners",
    links: [
      { label: "Working With Partners", href: "/partners" },
      { label: "Study Tour", href: "/partners#study-tour" },
      { label: "Contact Us", href: "/contact" },
    ],
  },
];

export function HomestayFooter() {
  return (
    <footer style={{ backgroundColor: HS.darkBrown, fontFamily: HS_FONT.body }} className="text-white/80">
      <div className="max-w-6xl mx-auto px-5 py-14 grid gap-10 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div>
          <p className="text-2xl text-white" style={{ fontFamily: HS_FONT.script }}>Million Homestay</p>
          <p className="mt-3 text-sm text-white/70 max-w-xs">
            A review-and-match homestay service in Australia — real people, real homes, matched with care.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-semibold text-white" style={{ fontFamily: HS_FONT.head }}>{col.title}</h3>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-white/70 hover:text-white transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-5 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/50">
          <span>© {new Date().getFullYear()} Million Homestay — homestay.millionstay.com</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

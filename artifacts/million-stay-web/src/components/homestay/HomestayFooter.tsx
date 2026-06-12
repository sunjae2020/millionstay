import { Link } from "wouter";
import { HS, HS_FONT } from "@/lib/homestay-theme";

// Million Homestay footer — dedicated shell for homestay.millionstay.com.
const COLUMNS: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: "Students",
    links: [
      { label: "Become a student", href: "/students/apply" },
      { label: "Advantages", href: "/students/advantages" },
      { label: "Essential info", href: "/students/essential-information" },
    ],
  },
  {
    title: "Host families",
    links: [
      { label: "Become a host", href: "/for-homestay-host" },
      { label: "Host benefits", href: "/hosts/benefits" },
      { label: "Host login", href: "/host-login" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us", href: "/about" },
      { label: "How it works", href: "/how-it-works" },
      { label: "Partners", href: "/partners" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export function HomestayFooter() {
  return (
    <footer style={{ backgroundColor: HS.darkBrown, fontFamily: HS_FONT.body }} className="text-white/80">
      <div className="max-w-6xl mx-auto px-5 py-14 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
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
        <div className="max-w-6xl mx-auto px-5 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/50">
          <span>© {""}Million Homestay — homestay.millionstay.com</span>
          <span>Matched by people, not algorithms.</span>
        </div>
      </div>
    </footer>
  );
}

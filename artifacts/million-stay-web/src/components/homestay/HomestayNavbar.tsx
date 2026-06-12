import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, ChevronDown } from "lucide-react";
import logo from "@assets/06.OR_NB_horizontal_ver_1775404553891.png";
import { HS, HS_FONT } from "@/lib/homestay-theme";

// Million Homestay top navigation — 5 top menus + Contact, matching the
// site-content doc's sitemap. Desktop: hover dropdowns; mobile: accordion.
type MenuItem = { label: string; href: string };
type Menu = { label: string; href: string; items: MenuItem[] };

const MENUS: Menu[] = [
  {
    label: "About Us",
    href: "/about",
    items: [
      { label: "About Us", href: "/about" },
      { label: "How It Works", href: "/how-it-works" },
      { label: "Mission Statement", href: "/mission" },
      { label: "Vision Statement", href: "/vision" },
    ],
  },
  {
    label: "Student",
    href: "/students",
    items: [
      { label: "Become a Homestay Student", href: "/students" },
      { label: "Advantages", href: "/students/advantages" },
      { label: "10 Useful Tips", href: "/students/tips" },
      { label: "Essential Information", href: "/students/essential-information" },
      { label: "Apply Now", href: "/students/apply" },
    ],
  },
  {
    label: "Host Family",
    href: "/hosts/become-a-host",
    items: [
      { label: "Become a Host Family", href: "/hosts/become-a-host" },
      { label: "Host Family Benefits", href: "/hosts/benefits" },
      { label: "10 Useful Tips", href: "/hosts/tips" },
      { label: "Apply Now", href: "/hosts/apply" },
    ],
  },
  {
    label: "Partners",
    href: "/partners",
    items: [
      { label: "Working With Partners", href: "/partners" },
      { label: "Study Tour", href: "/partners/study-tour" },
    ],
  },
  { label: "Contact Us", href: "/contact", items: [] },
];

export function HomestayNavbar() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100" style={{ fontFamily: HS_FONT.body }}>
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center" aria-label="Million Homestay home">
          <img src={logo} alt="Million Homestay" className="h-7 w-auto" />
        </Link>

        {/* Desktop */}
        <nav className="hidden md:flex items-center gap-1">
          {MENUS.map((m) => (
            <div key={m.label} className="relative group">
              <Link
                href={m.href}
                className="px-3 py-2 text-sm font-medium inline-flex items-center gap-1 transition-colors"
                style={{ color: location === m.href ? HS.brand : HS.darkBrown }}
              >
                {m.label}
                {m.items.length > 0 && <ChevronDown className="w-3.5 h-3.5 opacity-60" />}
              </Link>
              {m.items.length > 0 && (
                <div className="absolute left-0 top-full pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <div className="min-w-[230px] bg-white rounded-xl shadow-lg border border-gray-100 py-2">
                    {m.items.map((it) => (
                      <Link key={it.href} href={it.href} className="block px-4 py-2 text-sm hover:bg-gray-50" style={{ color: location === it.href ? HS.brand : HS.darkBrown }}>
                        {it.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="hidden md:block">
          <Link href="/for-homestay-host" className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: HS.brand }}>
            Become a Host
          </Link>
        </div>

        <button className="md:hidden p-2 -mr-2 text-gray-700" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile */}
      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white max-h-[80vh] overflow-y-auto">
          <nav className="max-w-6xl mx-auto px-5 py-3">
            {MENUS.map((m) => (
              <div key={m.label} className="border-b border-gray-50 last:border-0">
                <div className="flex items-center justify-between">
                  <Link href={m.href} onClick={() => setOpen(false)} className="py-3 text-sm font-semibold" style={{ color: HS.darkBrown }}>
                    {m.label}
                  </Link>
                  {m.items.length > 0 && (
                    <button onClick={() => setExpanded((e) => (e === m.label ? null : m.label))} className="p-2 text-gray-500" aria-label="Expand">
                      <ChevronDown className={`w-4 h-4 transition-transform ${expanded === m.label ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </div>
                {m.items.length > 0 && expanded === m.label && (
                  <div className="pb-2 pl-3">
                    {m.items.map((it) => (
                      <Link key={it.href} href={it.href} onClick={() => setOpen(false)} className="block py-2 text-sm" style={{ color: HS.darkBrown }}>
                        {it.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <Link href="/for-homestay-host" onClick={() => setOpen(false)} className="mt-3 block px-4 py-2.5 rounded-lg text-sm font-semibold text-white text-center" style={{ backgroundColor: HS.brand }}>
              Become a Host
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

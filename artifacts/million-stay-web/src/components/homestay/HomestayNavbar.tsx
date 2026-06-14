import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Menu, X } from "lucide-react";
import logo from "@assets/06.OR_NB_horizontal_ver_1775404553891.png";
import { HS, HS_FONT } from "@/lib/homestay-theme";
import { HomestayLanguageSwitcher } from "./HomestayLanguageSwitcher";

// Million Homestay top navigation — single-tier: 5 top menus, no dropdowns.
// Sub-topics now live as #anchored sections within each consolidated page.
// "Become a Host" stays a separate primary CTA, distinct from the nav.
type NavLink = { labelKey: string; href: string };

const LINKS: NavLink[] = [
  { labelKey: "homestay.nav.about", href: "/about" },
  { labelKey: "homestay.nav.student", href: "/students" },
  { labelKey: "homestay.nav.host", href: "/hosts/become-a-host" },
  { labelKey: "homestay.nav.partners", href: "/partners" },
  { labelKey: "homestay.nav.contact", href: "/contact" },
];

export function HomestayNavbar() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100" style={{ fontFamily: HS_FONT.body }}>
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center" aria-label="Million Homestay home">
          <img src={logo} alt="Million Homestay" className="h-7 w-auto" />
        </Link>

        {/* Desktop */}
        <nav className="hidden md:flex items-center gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-3 py-2 text-sm font-medium transition-colors"
              style={{ color: location === l.href ? HS.brand : HS.darkBrown }}
            >
              {t(l.labelKey)}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <HomestayLanguageSwitcher />
          <Link href="/for-homestay-host" className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: HS.brand }}>
            {t("homestay.nav.become_host")}
          </Link>
        </div>

        <div className="md:hidden flex items-center gap-1">
          <HomestayLanguageSwitcher />
          <button className="p-2 -mr-2 text-gray-700" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile */}
      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white max-h-[80vh] overflow-y-auto">
          <nav className="max-w-6xl mx-auto px-5 py-3">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block py-3 text-sm font-semibold border-b border-gray-50 last:border-0"
                style={{ color: location === l.href ? HS.brand : HS.darkBrown }}
              >
                {t(l.labelKey)}
              </Link>
            ))}
            <Link href="/for-homestay-host" onClick={() => setOpen(false)} className="mt-3 block px-4 py-2.5 rounded-lg text-sm font-semibold text-white text-center" style={{ backgroundColor: HS.brand }}>
              {t("homestay.nav.become_host")}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

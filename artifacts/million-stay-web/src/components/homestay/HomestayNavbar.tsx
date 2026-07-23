import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Menu, X } from "lucide-react";
import { HS, HS_FONT, HS_RADIUS } from "@/lib/homestay-theme";
import { HomestayWordmark } from "./HomestayWordmark";
import { HomestayLanguageSwitcher } from "./HomestayLanguageSwitcher";

// Million Homestay top navigation (Brand Guideline v2.0) — single-tier: 5 top
// menus, no dropdowns. Navy links, orange active underline, orange pill CTA.
// 72px, sticky, white, hairline border that deepens to a soft shadow on scroll.
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
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <header
      className="sticky top-0 z-40 transition-shadow"
      style={{
        fontFamily: HS_FONT.body,
        backgroundColor: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(8px)",
        borderBottom: `1px solid ${HS.line}`,
        boxShadow: scrolled ? "0 6px 20px rgba(22,38,63,0.06)" : "none",
      }}
    >
      <div className="max-w-6xl mx-auto px-5 h-[72px] flex items-center justify-between">
        <Link href="/" aria-label="Million Homestay home" className="flex items-center">
          <HomestayWordmark markSize={30} />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {LINKS.map((l) => {
            const active = location === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className="relative px-3 py-2 text-sm font-medium transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                style={{ color: active ? HS.orange : HS.navy }}
              >
                {t(l.labelKey)}
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-3 right-3 -bottom-[1px] h-0.5 rounded-full"
                    style={{ backgroundColor: HS.orange }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <HomestayLanguageSwitcher />
          <Link
            href="/for-homestay-host"
            className="px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
            style={{ backgroundColor: HS.orange, borderRadius: HS_RADIUS.pill }}
          >
            {t("homestay.nav.become_host")}
          </Link>
        </div>

        <div className="md:hidden flex items-center gap-1">
          <HomestayLanguageSwitcher />
          <button
            className="p-2 -mr-2"
            style={{ color: HS.navy }}
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile full-screen drawer with pinned CTA */}
      {open && (
        <div className="md:hidden fixed inset-x-0 top-[72px] bottom-0 z-40 bg-white flex flex-col">
          <nav className="flex-1 overflow-y-auto px-6 py-4">
            {LINKS.map((l) => {
              const active = location === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className="block py-4 text-lg font-semibold"
                  style={{ color: active ? HS.orange : HS.navy, borderBottom: `1px solid ${HS.line}` }}
                >
                  {t(l.labelKey)}
                </Link>
              );
            })}
          </nav>
          <div className="px-6 py-5" style={{ borderTop: `1px solid ${HS.line}` }}>
            <Link
              href="/for-homestay-host"
              onClick={() => setOpen(false)}
              className="block w-full px-4 py-3.5 text-base font-semibold text-white text-center"
              style={{ backgroundColor: HS.orange, borderRadius: HS_RADIUS.pill }}
            >
              {t("homestay.nav.become_host")}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import logo from "@assets/06.OR_NB_horizontal_ver_1775404553891.png";
import { HS, HS_FONT } from "@/lib/homestay-theme";

// Million Homestay top navigation — dedicated shell for homestay.millionstay.com.
const NAV: Array<{ label: string; href: string }> = [
  { label: "About", href: "/about" },
  { label: "How it works", href: "/how-it-works" },
  { label: "For Students", href: "/students/apply" },
  { label: "For Hosts", href: "/for-homestay-host" },
  { label: "For Partners", href: "/partners" },
  { label: "Contact", href: "/contact" },
];

export function HomestayNavbar() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100" style={{ fontFamily: HS_FONT.body }}>
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center" aria-label="Million Homestay home">
          <img src={logo} alt="Million Homestay" className="h-7 w-auto" />
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {NAV.map((n) => {
            const active = location === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className="text-sm font-medium transition-colors"
                style={{ color: active ? HS.brand : HS.darkBrown }}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/for-homestay-host"
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: HS.brand }}
          >
            Become a Host
          </Link>
        </div>

        <button className="md:hidden p-2 -mr-2 text-gray-700" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <nav className="max-w-6xl mx-auto px-5 py-3 flex flex-col gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="py-2 text-sm font-medium"
                style={{ color: location === n.href ? HS.brand : HS.darkBrown }}
              >
                {n.label}
              </Link>
            ))}
            <Link
              href="/for-homestay-host"
              onClick={() => setOpen(false)}
              className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold text-white text-center"
              style={{ backgroundColor: HS.brand }}
            >
              Become a Host
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

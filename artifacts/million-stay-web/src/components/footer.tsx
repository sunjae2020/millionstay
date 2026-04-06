import { Link } from "wouter";
import { Mail, Facebook, Twitter, Instagram, Youtube, Globe } from "lucide-react";
import logoHorizontal from "@assets/06.OR_NB_horizontal_ver_1775381659303.png";

export function Footer() {
  return (
    <footer className="bg-[#3d3935] text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="mb-4">
              <img src={logoHorizontal} alt="Million Stay" className="h-10 w-auto brightness-0 invert opacity-90" />
            </div>
            <p className="text-sm text-gray-400 leading-relaxed mb-4 max-w-xs">
              Safe, affordable, and fully furnished accommodation for international students and digital nomads in Melbourne.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                <a href="mailto:info@millionstay.com" className="hover:text-primary transition-colors">info@millionstay.com</a>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
                <a href="https://www.millionstay.com" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">www.millionstay.com</a>
              </div>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wide">Navigation</h4>
            <ul className="space-y-2">
              {[
                { label: "Home", href: "/" },
                { label: "Find a Room", href: "/search" },
                { label: "Booking", href: "/portal" },
                { label: "For Students", href: "/search" },
              ].map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-gray-400 hover:text-primary transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wide">Support</h4>
            <ul className="space-y-2 mb-6">
              {[
                { label: "FAQ", href: "/faq" },
                { label: "House Rules", href: "/house-rules" },
                { label: "Privacy Policy", href: "/privacy-policy" },
                { label: "Contact Us", href: "/contact" },
              ].map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-gray-400 hover:text-primary transition-colors cursor-pointer">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            {/* Social */}
            <div className="flex items-center gap-3">
              {[Facebook, Twitter, Instagram, Youtube].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all"
                >
                  <Icon className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-gray-500">© {new Date().getFullYear()} Million Homestay Australia. All Rights Reserved.</p>
          <p className="text-xs text-gray-500">Serving Melbourne's international community since 2015</p>
        </div>
      </div>
    </footer>
  );
}

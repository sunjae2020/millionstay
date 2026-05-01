import { Link } from "wouter";
import { Mail, Facebook, Twitter, Instagram, Youtube, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import logoHorizontal from "@assets/06.OR_NB_horizontal_ver_1775381659303.png";

export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  const navLinks = [
    { label: t("footer.home"), href: "/" },
    { label: t("footer.find_room"), href: "/search" },
    { label: t("footer.booking"), href: "/portal" },
    { label: t("footer.for_students"), href: "/search" },
  ];

  const supportLinks = [
    { label: t("footer.faq"), href: "/faq" },
    { label: t("footer.house_rules"), href: "/house-rules" },
    { label: t("footer.privacy_policy"), href: "/privacy-policy" },
    { label: t("footer.contact"), href: "/contact" },
  ];

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
              {t("footer.desc")}
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

          {/* Navigation Links */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wide">{t("footer.nav_heading")}</h4>
            <ul className="space-y-2">
              {navLinks.map((link) => (
                <li key={link.href + link.label}>
                  <Link href={link.href} className="text-sm text-gray-400 hover:text-primary transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wide">{t("footer.support_heading")}</h4>
            <ul className="space-y-2 mb-6">
              {supportLinks.map((link) => (
                <li key={link.href + link.label}>
                  <a href={link.href} className="text-sm text-gray-400 hover:text-primary transition-colors cursor-pointer">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            {/* Social */}
            <div className="flex items-center gap-3">
              {[
                { Icon: Facebook, label: "Facebook", url: "https://www.facebook.com/millionstay" },
                { Icon: Twitter, label: "Twitter", url: "https://twitter.com/millionstay" },
                { Icon: Instagram, label: "Instagram", url: "https://www.instagram.com/millionstay" },
                { Icon: Youtube, label: "YouTube", url: "https://www.youtube.com/@millionstay" },
              ].map(({ Icon, label, url }) =>
                url ? (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all"
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </a>
                ) : null
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-gray-500">{t("footer.copyright", { year })}</p>
          <p className="text-xs text-gray-500">{t("footer.serving")}</p>
        </div>
      </div>
    </footer>
  );
}

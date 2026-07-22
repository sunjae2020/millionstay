import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { HS, HS_FONT } from "@/lib/homestay-theme";
import { HomestayWordmark } from "./HomestayWordmark";

// Million Homestay footer — dedicated shell for homestay.millionstay.com.
// Footer mirrors the single-tier nav: each column heads to a consolidated page,
// with in-page #anchors for the absorbed sub-topics.
const COLUMNS: Array<{ titleKey: string; links: Array<{ labelKey: string; href: string }> }> = [
  {
    titleKey: "homestay.footer.col_about",
    links: [
      { labelKey: "homestay.footer.about_about", href: "/about" },
      { labelKey: "homestay.footer.about_how", href: "/about#how-it-works" },
      { labelKey: "homestay.footer.about_mission", href: "/about#mission" },
      { labelKey: "homestay.footer.about_vision", href: "/about#vision" },
    ],
  },
  {
    titleKey: "homestay.footer.col_student",
    links: [
      { labelKey: "homestay.footer.student_become", href: "/students" },
      { labelKey: "homestay.footer.student_advantages", href: "/students#advantages" },
      { labelKey: "homestay.footer.student_essentials", href: "/students#essentials" },
      { labelKey: "homestay.footer.apply_now", href: "/students/apply" },
    ],
  },
  {
    titleKey: "homestay.footer.col_host",
    links: [
      { labelKey: "homestay.footer.host_become", href: "/hosts/become-a-host" },
      { labelKey: "homestay.footer.host_benefits", href: "/hosts/become-a-host#benefits" },
      { labelKey: "homestay.footer.apply_now", href: "/for-homestay-host" },
      { labelKey: "homestay.footer.host_login", href: "/host-login" },
    ],
  },
  {
    titleKey: "homestay.footer.col_partners",
    links: [
      { labelKey: "homestay.footer.partners_working", href: "/partners" },
      { labelKey: "homestay.footer.partners_study_tour", href: "/partners#study-tour" },
      { labelKey: "homestay.footer.contact", href: "/contact" },
    ],
  },
];

export function HomestayFooter() {
  const { t } = useTranslation();
  return (
    <footer
      style={{ backgroundColor: HS.navy, fontFamily: HS_FONT.body, borderTop: `1px solid ${HS.teal}` }}
      className="text-white/80"
    >
      <div className="max-w-6xl mx-auto px-5 py-14 grid gap-10 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div>
          <HomestayWordmark knockout markSize={28} />
          <p className="mt-4 text-sm text-white/70 max-w-xs leading-relaxed">
            {t("homestay.footer.tagline")}
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.titleKey}>
            <h3 className="text-sm font-semibold text-white" style={{ fontFamily: HS_FONT.display }}>{t(col.titleKey)}</h3>
            <ul className="mt-3 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-white/70 hover:text-primary transition-colors">{t(l.labelKey)}</Link>
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
            <Link href="/privacy" className="hover:text-primary transition-colors">{t("homestay.footer.privacy")}</Link>
            <Link href="/terms" className="hover:text-primary transition-colors">{t("homestay.footer.terms")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

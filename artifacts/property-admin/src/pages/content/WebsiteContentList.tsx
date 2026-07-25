import { useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Home, GraduationCap, Handshake, Info, HelpCircle, Phone, Users,
  ChevronRight, Globe, Building2, KeyRound, LineChart, MapPin,
  ShieldCheck, FileText, Landmark,
} from "lucide-react";

// Each website page is content-managed per language via the page_contents table
// (page_key + language). The public sites overlay this CMS copy on top of their
// i18n defaults. Page keys are namespaced per site: the guest site (www) uses
// bare keys ("home", "about", …) for backwards compatibility, while the homestay
// site uses a "homestay-" prefix so the two sites stay cleanly separated in one
// shared table.

export interface WebsitePageDef {
  key: string;
  label: string;
  description: string;
  icon: typeof Home;
  path: string;
  site: string;
  previewBase: string;
}

export interface LanguageDef {
  code: string;
  label: string;
  flag: string;
}

const LANG: Record<string, LanguageDef> = {
  en: { code: "en", label: "English", flag: "🇦🇺" },
  ko: { code: "ko", label: "Korean", flag: "🇰🇷" },
  zh: { code: "zh", label: "Chinese (Simplified)", flag: "🇨🇳" },
  ja: { code: "ja", label: "Japanese", flag: "🇯🇵" },
  vi: { code: "vi", label: "Vietnamese", flag: "🇻🇳" },
  th: { code: "th", label: "Thai", flag: "🇹🇭" },
};

export interface WebsiteSiteDef {
  id: string;
  label: string;
  host: string;
  previewBase: string;
  languages: LanguageDef[];
  pages: WebsitePageDef[];
}

// Guest site — www.millionstay.com. Bare page keys (unchanged historical data).
const WWW_PREVIEW = "https://millionstay.com.au";
const WWW_LANGS = [LANG.en, LANG.ko, LANG.zh, LANG.ja, LANG.vi];
const WWW_PAGES: Omit<WebsitePageDef, "site" | "previewBase">[] = [
  { key: "home", label: "Home", description: "Main landing page — hero, features, stats and CTA sections", icon: Home, path: "/" },
  { key: "for-student", label: "For Students", description: "Student program page — welcome intro, features and benefits", icon: GraduationCap, path: "/for-student" },
  { key: "for-agent", label: "For Agent", description: "Agent partner page — programme benefits and how it works", icon: Handshake, path: "/for-agent" },
  { key: "about", label: "About Us", description: "Company story, mission, team and values", icon: Info, path: "/about" },
  { key: "faq", label: "FAQ", description: "Frequently asked questions and answers", icon: HelpCircle, path: "/faq" },
  { key: "contact", label: "Contact", description: "Contact details, address and enquiry form text", icon: Phone, path: "/contact" },
];

// Homestay site — homestay.millionstay.com. "homestay-" prefixed page keys.
const HS_PREVIEW = "https://homestay.millionstay.com";
const HS_LANGS = [LANG.en, LANG.ja, LANG.ko, LANG.th, LANG.zh];
const HS_PAGES: Omit<WebsitePageDef, "site" | "previewBase">[] = [
  { key: "homestay-home", label: "Home", description: "Homestay landing — hero, why-us and how-it-works headings", icon: Home, path: "/" },
  { key: "homestay-about", label: "About Us", description: "Hero, bridging, mission and vision sections", icon: Info, path: "/about" },
  { key: "homestay-students", label: "For Students", description: "Student page hero intro", icon: GraduationCap, path: "/students" },
  { key: "homestay-hosts", label: "Host Family", description: "Host family page hero intro", icon: Users, path: "/hosts/become-a-host" },
  { key: "homestay-partners", label: "Partners", description: "Partners page hero intro", icon: Handshake, path: "/partners" },
  { key: "homestay-contact", label: "Contact", description: "Contact heading, subheading and location", icon: Phone, path: "/contact" },
];

// Development site — single-building white-label instances (VITE_SITE_MODE=
// development, e.g. MetHeim Yeosu). "dev-" prefixed page keys. Six locales.
const DEV_PREVIEW = "https://metheim.com";
const DEV_LANGS = [LANG.ko, LANG.en, LANG.ja, LANG.zh, LANG.vi, LANG.th];
const DEV_PAGES: Omit<WebsitePageDef, "site" | "previewBase">[] = [
  { key: "dev-home", label: "Home", description: "Building identity — hero/vision, three pillars, why-us and CTA", icon: Home, path: "/" },
  { key: "dev-about", label: "About MetHeim", description: "Brand story, vision and values", icon: Info, path: "/about" },
  { key: "dev-buy", label: "Buy / Sales", description: "Pricing intro, floor plans, remaining units and sales inquiry", icon: Building2, path: "/buy" },
  { key: "dev-rent", label: "Rent / Stay", description: "Short-term booking intro and long-term lease consultation", icon: KeyRound, path: "/rent" },
  { key: "dev-manage", label: "Management", description: "Entrusted-management benefits, yield simulator and application", icon: LineChart, path: "/management" },
  { key: "dev-directions", label: "Directions", description: "Address, map, transit/parking and contact details", icon: MapPin, path: "/directions" },
  { key: "dev-footer", label: "Footer & Company", description: "Business/operator info shown in the footer and legal pages", icon: Landmark, path: "/" },
  { key: "dev-privacy", label: "Privacy Policy", description: "개인정보처리방침 — title, effective date and sections", icon: ShieldCheck, path: "/privacy-policy" },
  { key: "dev-terms", label: "Terms of Use", description: "이용약관 — title, effective date and sections", icon: FileText, path: "/terms" },
];

export const SITES: WebsiteSiteDef[] = [
  {
    id: "www",
    label: "Guest Site",
    host: "www.millionstay.com",
    previewBase: WWW_PREVIEW,
    languages: WWW_LANGS,
    pages: WWW_PAGES.map((p) => ({ ...p, site: "www", previewBase: WWW_PREVIEW })),
  },
  {
    id: "homestay",
    label: "Homestay",
    host: "homestay.millionstay.com",
    previewBase: HS_PREVIEW,
    languages: HS_LANGS,
    pages: HS_PAGES.map((p) => ({ ...p, site: "homestay", previewBase: HS_PREVIEW })),
  },
  {
    id: "development",
    label: "Building Site",
    host: "metheim.com",
    previewBase: DEV_PREVIEW,
    languages: DEV_LANGS,
    pages: DEV_PAGES.map((p) => ({ ...p, site: "development", previewBase: DEV_PREVIEW })),
  },
];

// Flattened list of every page across sites — used by the detail page to resolve
// a page key. Kept exported under the historical name for compatibility.
export const WEBSITE_PAGES: WebsitePageDef[] = SITES.flatMap((s) => s.pages);

export function getSiteForPage(pageKey: string): WebsiteSiteDef | undefined {
  return SITES.find((s) => s.pages.some((p) => p.key === pageKey));
}

// Backwards-compatible default language list (guest site set).
export const LANGUAGES: LanguageDef[] = WWW_LANGS;

export default function WebsiteContentList() {
  const { t } = useTranslation();
  const [activeSite, setActiveSite] = useState(SITES[0].id);
  const site = SITES.find((s) => s.id === activeSite) ?? SITES[0];

  return (
    <Layout>
      <PageHeader
        title={t("website_content.page_title")}
        subtitle={t("website_content.page_description")}
        actions={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="h-4 w-4" />
            {t("website_content.languages_supported", { count: site.languages.length })}
          </div>
        }
      />

      <div className="p-6">
        {/* Site switcher — the guest site and the homestay site are managed
            separately even though they share one content table. */}
        <div className="mb-6 inline-flex rounded-lg border bg-muted/30 p-1">
          {SITES.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSite(s.id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeSite === s.id ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>{t(`website_content.site_${s.id}`, { defaultValue: s.label })}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">{s.host}</Badge>
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {site.pages.map((page) => {
            const Icon = page.icon;
            const labelKey = page.key.replace(/-/g, "_");
            return (
              <Link key={page.key} href={`/content/pages/${page.key}`}>
                <Card className="p-5 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group">
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-primary/10 p-2.5 shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm">{t(`website_content.page_label_${labelKey}`, { defaultValue: page.label })}</h3>
                        <Badge variant="outline" className="text-xs px-1.5 py-0 font-normal">
                          {page.path}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{t(`website_content.page_desc_${labelKey}`, { defaultValue: page.description })}</p>
                      <div className="flex items-center gap-1 mt-3">
                        {site.languages.map((l) => (
                          <span key={l.code} className="text-sm" title={t(`website_content.lang_${l.code}`, { defaultValue: l.label })}>{l.flag}</span>
                        ))}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0 mt-1 transition-colors" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}

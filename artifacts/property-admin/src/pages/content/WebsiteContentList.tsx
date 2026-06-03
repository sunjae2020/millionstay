import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Home, GraduationCap, Handshake, Info, HelpCircle, Phone,
  ChevronRight, Globe,
} from "lucide-react";

export const WEBSITE_PAGES = [
  {
    key: "home",
    label: "Home",
    description: "Main landing page — hero, features, stats and CTA sections",
    icon: Home,
    path: "/",
  },
  {
    key: "for-student",
    label: "For Students",
    description: "Student program page — welcome intro, features and benefits",
    icon: GraduationCap,
    path: "/for-student",
  },
  {
    key: "for-agent",
    label: "For Agent",
    description: "Agent partner page — programme benefits and how it works",
    icon: Handshake,
    path: "/for-agent",
  },
  {
    key: "about",
    label: "About Us",
    description: "Company story, mission, team and values",
    icon: Info,
    path: "/about",
  },
  {
    key: "faq",
    label: "FAQ",
    description: "Frequently asked questions and answers",
    icon: HelpCircle,
    path: "/faq",
  },
  {
    key: "contact",
    label: "Contact",
    description: "Contact details, address and enquiry form text",
    icon: Phone,
    path: "/contact",
  },
];

export const LANGUAGES = [
  { code: "en", label: "English", flag: "🇦🇺" },
  { code: "ko", label: "Korean", flag: "🇰🇷" },
  { code: "zh", label: "Chinese (Simplified)", flag: "🇨🇳" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
  { code: "vi", label: "Vietnamese", flag: "🇻🇳" },
];

export default function WebsiteContentList() {
  const { t } = useTranslation();
  return (
    <Layout>
      <PageHeader
        title={t("website_content.page_title")}
        description={t("website_content.page_description")}
        actions={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="h-4 w-4" />
            {t("website_content.languages_supported", { count: LANGUAGES.length })}
          </div>
        }
      />

      <div className="p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {WEBSITE_PAGES.map((page) => {
            const Icon = page.icon;
            return (
              <Link key={page.key} href={`/content/pages/${page.key}`}>
                <Card className="p-5 hover:border-[#E8621A]/40 hover:shadow-md transition-all cursor-pointer group">
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-[#E8621A]/10 p-2.5 shrink-0 group-hover:bg-[#E8621A]/20 transition-colors">
                      <Icon className="h-5 w-5 text-[#E8621A]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm">{t(`website_content.page_label_${page.key.replace(/-/g, "_")}`)}</h3>
                        <Badge variant="outline" className="text-xs px-1.5 py-0 font-normal">
                          {page.path}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{t(`website_content.page_desc_${page.key.replace(/-/g, "_")}`)}</p>
                      <div className="flex items-center gap-1 mt-3">
                        {LANGUAGES.map((l) => (
                          <span key={l.code} className="text-sm" title={t(`website_content.lang_${l.code}`)}>{l.flag}</span>
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

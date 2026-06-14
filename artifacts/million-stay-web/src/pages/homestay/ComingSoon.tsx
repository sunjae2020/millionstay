import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { ArrowRight, Clock } from "lucide-react";
import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HS, HS_FONT } from "@/lib/homestay-theme";

// Branded placeholder for Million Homestay pages whose feature ships in a later
// phase (student application, payment, agent portal, etc.). Keeps nav links from
// 404-ing; each route passes its own title. Replaced with the real page when the
// corresponding phase lands.
export default function HomestayComingSoon({ title }: { title?: string }) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t("homestay.coming_soon.default_title");
  return (
    <HomestayLayout title={resolvedTitle}>
      <section className="max-w-3xl mx-auto px-5 py-24 md:py-32 text-center">
        <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center" style={{ backgroundColor: HS.cream, color: HS.brand }}>
          <Clock className="w-6 h-6" />
        </div>
        <span className="mt-6 inline-block text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full" style={{ color: HS.brand, backgroundColor: "rgba(237,107,27,0.10)" }}>
          {t("homestay.coming_soon.badge")}
        </span>
        <h1 className="mt-4 text-3xl md:text-4xl font-bold" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>{resolvedTitle}</h1>
        <p className="mt-3 text-gray-600">
          {t("homestay.coming_soon.body")}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/for-homestay-host" className="px-6 py-3 rounded-lg font-semibold text-white inline-flex items-center gap-2" style={{ backgroundColor: HS.brand }}>
            {t("homestay.coming_soon.become_host")} <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/contact" className="px-6 py-3 rounded-lg font-semibold border border-gray-300 text-gray-800">
            {t("homestay.coming_soon.contact_us")}
          </Link>
        </div>
      </section>
    </HomestayLayout>
  );
}

import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useSupportEmail } from "@/lib/guest-api";
import heroBg from "@assets/MS_Homepage_Photo_1920x1080_1775403929888.jpg";
import { APP_NAME } from "../lib/appName";

function fade(delay = 0) {
  return { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay } };
}

export default function HouseRules() {
  const { t } = useTranslation();
  const supportEmail = useSupportEmail();

  const rules = [
    { number: "01", title: t("house_rules.r1_title"), body: t("house_rules.r1_body") },
    { number: "02", title: t("house_rules.r2_title"), body: t("house_rules.r2_body") },
    { number: "03", title: t("house_rules.r3_title"), body: t("house_rules.r3_body") },
    { number: "04", title: t("house_rules.r4_title"), body: t("house_rules.r4_body") },
    { number: "05", title: t("house_rules.r5_title"), body: t("house_rules.r5_body") },
    { number: "06", title: t("house_rules.r6_title"), body: t("house_rules.r6_body") },
    { number: "07", title: t("house_rules.r7_title"), body: t("house_rules.r7_body") },
  ];

  const relatedLinks = [
    { labelKey: "house_rules.link_faq", href: "/faq" },
    { labelKey: "house_rules.link_student", href: "/for-student" },
    { labelKey: "house_rules.link_contact", href: "/contact" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* Hero */}
      <section className="relative h-52 sm:h-64 overflow-hidden">
        <img src={heroBg} alt={t("house_rules.hero_title")} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/30 to-black/55" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          <p className="text-white/80 italic text-sm sm:text-base mb-1">{t("house_rules.hero_tagline")}</p>
          <h1 className="text-white font-bold italic text-3xl sm:text-4xl drop-shadow-lg">{t("house_rules.hero_title")}</h1>
        </div>
        {/* Breadcrumb */}
        <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm py-2 px-4 sm:px-8">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs text-gray-500">
            <Link href="/" className="hover:text-primary transition-colors">{t("house_rules.breadcrumb_home")}</Link>
            <span>›</span>
            <span className="text-gray-700 font-medium">{t("house_rules.breadcrumb")}</span>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">

          {/* Rules list */}
          <div className="lg:col-span-3 space-y-8">
            <motion.p {...fade(0)} className="text-gray-500 text-sm leading-relaxed max-w-lg">
              {t("house_rules.intro")}
            </motion.p>

            {rules.map((rule, i) => (
              <motion.div key={rule.number} {...fade(0.06 * i)} className="flex gap-5">
                {/* Number + line */}
                <div className="flex flex-col items-center pt-1">
                  <span className="text-primary font-black text-lg leading-none">{rule.number}</span>
                  {i < rules.length - 1 && (
                    <div className="w-px flex-1 mt-2 bg-primary/10" />
                  )}
                </div>

                {/* Content */}
                <div className="pb-8">
                  <h3 className="text-primary font-bold text-base mb-1.5">
                    {t("house_rules.rule_label")} {rule.number} — {rule.title}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{rule.body}</p>
                </div>
              </motion.div>
            ))}

            {/* Agreement note */}
            <motion.div {...fade(0.5)} className="bg-primary/5 border border-primary/20 rounded-xl px-6 py-5">
              <p className="text-sm text-gray-600 leading-relaxed">
                {t("house_rules.agreement")}{" "}
                <a href={`mailto:${supportEmail}`} className="text-primary hover:underline font-medium">
                  {supportEmail}
                </a>.
              </p>
            </motion.div>
          </div>

          {/* Sticky image sidebar */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 space-y-5">
              <motion.div {...fade(0.1)} className="rounded-2xl overflow-hidden shadow-lg">
                <img
                  src="https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80"
                  alt={`${APP_NAME} room`}
                  className="w-full h-64 object-cover"
                />
              </motion.div>
              <motion.div {...fade(0.2)} className="rounded-2xl overflow-hidden shadow-lg">
                <img
                  src="https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800&q=80"
                  alt={`${APP_NAME} room interior`}
                  className="w-full h-48 object-cover"
                />
              </motion.div>

              {/* Quick links */}
              <motion.div {...fade(0.3)} className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <h4 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-3">{t("house_rules.related_title")}</h4>
                <ul className="space-y-1.5">
                  {relatedLinks.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-sm text-gray-600 hover:text-primary transition-colors flex items-center gap-1.5">
                        <span className="text-primary">›</span>
                        {t(link.labelKey)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Star, ChevronRight } from "lucide-react";
import heroBg from "@assets/MS_Homepage_Photo_1920x1080_1775403929888.jpg";

const TEAM_DATA = [
  { name: "Sarah Johnson", key: "team_ceo", initials: "SJ" },
  { name: "David Kim", key: "team_ops", initials: "DK" },
  { name: "Mia Chen", key: "team_relations", initials: "MC" },
];

const TESTIMONIALS_DATA = [
  { name: "Hyunjin Park", flag: "🇰🇷", textKey: "t1_text", rating: 5 },
  { name: "Yuki Tanaka", flag: "🇯🇵", textKey: "t2_text", rating: 5 },
  { name: "Arisa Sombat", flag: "🇹🇭", textKey: "t3_text", rating: 4 },
];

const BLOGS_DATA = [
  {
    tagKey: "b1_tag", titleKey: "b1_title", excerptKey: "b1_excerpt", dateKey: "b1_date",
    imgUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80",
  },
  {
    tagKey: "b2_tag", titleKey: "b2_title", excerptKey: "b2_excerpt", dateKey: "b2_date",
    imgUrl: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&q=80",
  },
  {
    tagKey: "b3_tag", titleKey: "b3_title", excerptKey: "b3_excerpt", dateKey: "b3_date",
    imgUrl: "https://images.unsplash.com/photo-1514395462151-6b5e5abad7bc?w=600&q=80",
  },
];

function fade(delay = 0) {
  return { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay } };
}

export default function About() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* Banner */}
      <div className="relative h-52 md:h-64 overflow-hidden">
        <img src={heroBg} alt="About Us" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/50" />
        <div className="absolute inset-0 flex flex-col items-start justify-end px-8 pb-8 max-w-7xl mx-auto w-full">
          <p className="font-cursive text-white/70 text-sm italic mb-1">{t("about.hero_tagline")}</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white italic">{t("about.hero_title")}</h1>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto w-full px-6 py-3 flex items-center gap-1.5 text-xs text-gray-400">
        <Link href="/" className="hover:text-primary">{t("about.breadcrumb_home")}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-600">{t("about.breadcrumb")}</span>
      </div>

      {/* Introduction */}
      <section className="max-w-7xl mx-auto w-full px-6 py-12">
        <div className="flex flex-col md:flex-row gap-10 items-center">
          <motion.div {...fade()} className="flex-1">
            <p className="font-cursive text-primary text-lg italic mb-1">{t("about.intro_label")}</p>
            <h2 className="text-3xl font-bold text-gray-900 mb-5">{t("about.intro_title")}</h2>
            <p className="text-gray-600 leading-relaxed mb-4">{t("about.intro_p1")}</p>
            <p className="text-gray-600 leading-relaxed mb-4">{t("about.intro_p2")}</p>
            <p className="text-gray-600 leading-relaxed">{t("about.intro_p3")}</p>
          </motion.div>
          <motion.div {...fade(0.1)} className="flex-1 flex justify-center">
            <div className="rounded-2xl overflow-hidden shadow-lg w-full max-w-md aspect-[4/3]">
              <img
                src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80"
                alt="Our team"
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Our Team */}
      <section className="bg-orange-50 py-14 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <p className="font-cursive text-primary text-xl italic mb-1">{t("about.team_label")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {TEAM_DATA.map((member, i) => (
              <motion.div key={member.name} {...fade(i * 0.08)}
                className="bg-white rounded-2xl p-6 flex flex-col items-center text-center shadow-sm border">
                <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center mb-4 border-4 border-orange-100">
                  <span className="text-2xl font-bold text-gray-500">{member.initials}</span>
                </div>
                <p className="font-semibold text-gray-800">{member.name}</p>
                <p className="text-sm text-primary mt-0.5">{t(`about.${member.key}`)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-14 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <p className="font-cursive text-primary text-xl italic">{t("about.testimonials_label")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS_DATA.map((testimonial, i) => (
              <motion.div key={testimonial.name} {...fade(i * 0.08)}
                className="bg-orange-50 rounded-2xl p-6 border border-orange-100 flex flex-col">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className={`h-4 w-4 ${j < testimonial.rating ? "fill-primary text-primary" : "text-gray-300"}`} />
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed flex-1 mb-5 italic">"{t(`about.${testimonial.textKey}`)}"</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{testimonial.flag}</span>
                  <p className="font-semibold text-gray-800 text-sm">{testimonial.name}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="flex justify-center mt-8">
            <Link href="/search">
              <button className="bg-primary text-white px-8 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors">
                {t("about.view_more")}
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Our Blog */}
      <section className="bg-gray-50 py-14 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-3">
            <p className="font-cursive text-primary text-xl italic">{t("about.blog_label")}</p>
          </div>
          <p className="text-center text-gray-500 text-sm mb-10 max-w-xl mx-auto">
            {t("about.blog_sub")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {BLOGS_DATA.map((post, i) => (
              <motion.div key={post.titleKey} {...fade(i * 0.08)}
                className="bg-white rounded-2xl overflow-hidden border shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <div className="relative h-44 overflow-hidden">
                  <img src={post.imgUrl} alt={t(`about.${post.titleKey}`)} className="w-full h-full object-cover" />
                  <span className="absolute top-3 left-3 bg-primary text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                    {t(`about.${post.tagKey}`)}
                  </span>
                </div>
                <div className="p-5">
                  <p className="text-xs text-gray-400 mb-2">{t(`about.${post.dateKey}`)}</p>
                  <h3 className="font-semibold text-gray-800 text-sm mb-2 leading-snug">{t(`about.${post.titleKey}`)}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{t(`about.${post.excerptKey}`)}</p>
                  <button className="mt-4 text-primary text-xs font-semibold hover:underline">{t("about.read_more")}</button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

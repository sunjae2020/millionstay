import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Star, ChevronRight, BookOpen, Calendar, Tag } from "lucide-react";
import heroBg from "@assets/MS_Homepage_Photo_1920x1080_1775403929888.jpg";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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

const FALLBACK_BLOGS = [
  {
    slug: null, category: "Tips & Guides", title: "5 Tips for Finding the Perfect Student Accommodation",
    excerpt: "Navigate the Melbourne rental market with confidence — from inspection checklists to understanding lease terms.",
    cover_image_url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80",
    published_at: null,
  },
  {
    slug: null, category: "Student Life", title: "How to Make the Most of Your First Month in Melbourne",
    excerpt: "From setting up a bank account to finding the best local cafes — your essential first-month guide.",
    cover_image_url: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&q=80",
    published_at: null,
  },
  {
    slug: null, category: "Housing", title: "Understanding Utilities & Bills in Shared Accommodation",
    excerpt: "A simple guide to electricity, gas, internet and water billing for international students in Australia.",
    cover_image_url: "https://images.unsplash.com/photo-1514395462151-6b5e5abad7bc?w=600&q=80",
    published_at: null,
  },
];

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function fade(delay = 0) {
  return { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay } };
}

function BlogCard({ post }: { post: any }) {
  return (
    <>
      <div className="relative h-44 overflow-hidden">
        {post.cover_image_url ? (
          <img src={post.cover_image_url} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#E8621A]/10 to-orange-50 flex items-center justify-center">
            <BookOpen className="h-10 w-10 text-[#E8621A]/30" />
          </div>
        )}
        {post.category && (
          <span className="absolute top-3 left-3 bg-primary text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
            <Tag className="h-3 w-3" />{post.category}
          </span>
        )}
      </div>
      <div className="p-5">
        {post.published_at && (
          <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
            <Calendar className="h-3 w-3" />{formatDate(post.published_at)}
          </p>
        )}
        <h3 className="font-semibold text-gray-800 text-sm mb-2 leading-snug line-clamp-2 group-hover:text-primary transition-colors">{post.title}</h3>
        {post.excerpt && <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{post.excerpt}</p>}
        <span className="mt-4 block text-primary text-xs font-semibold hover:underline flex items-center gap-1">
          Read more <ChevronRight className="h-3 w-3" />
        </span>
      </div>
    </>
  );
}

export default function About() {
  const { t } = useTranslation();

  const { data: apiBlogPosts = [] } = useQuery({
    queryKey: ["about-blog-posts"],
    queryFn: async () => {
      try {
        const res = await fetch(`${BASE}/api/v1/public/blog?limit=3`);
        if (!res.ok) return [];
        const json = await res.json();
        return json.data ?? [];
      } catch {
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const blogPosts = apiBlogPosts.length > 0 ? apiBlogPosts : FALLBACK_BLOGS;

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
            {blogPosts.slice(0, 3).map((post: any, i: number) => (
              <motion.div key={post.slug ?? post.title} {...fade(i * 0.08)}
                className="bg-white rounded-2xl overflow-hidden border shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                {post.slug ? (
                  <Link href={`/blog/${post.slug}`} className="block">
                    <BlogCard post={post} />
                  </Link>
                ) : (
                  <BlogCard post={post} />
                )}
              </motion.div>
            ))}
          </div>
          <div className="flex justify-center mt-10">
            <Link href="/blog">
              <button className="bg-primary text-white px-8 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors">
                {t("about.read_more") || "View All Posts"}
              </button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

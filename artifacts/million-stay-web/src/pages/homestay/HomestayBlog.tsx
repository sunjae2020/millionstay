import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Calendar, User, ArrowRight, BookOpen } from "lucide-react";
import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HS, HS_FONT } from "@/lib/homestay-theme";
import { getApiBase } from "@/lib/api-base";
import { formatDate } from "@/lib/dateFormat";

const BASE = getApiBase();

// Million Homestay blog. Posts are scoped by `site_key=homestay` (each site runs
// its own blog); the old "Homestay category" split was migrated into it. The page
// exists at /blog but is intentionally kept out of the main nav (HomestayNavbar)
// — it's reached via direct link / footer / SEO for now.
export const HOMESTAY_BLOG_CATEGORY = "Homestay";


async function fetchHomestayPosts() {
  const qs = new URLSearchParams({ site: "homestay" });
  const res = await fetch(`${BASE}/api/v1/public/blog?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch posts");
  const json = await res.json();
  return json.data ?? [];
}

export default function HomestayBlog() {
  const { t } = useTranslation();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["homestay-blog"],
    queryFn: fetchHomestayPosts,
  });

  return (
    <HomestayLayout title={t("homestay.blog.title")}>
      <section className="py-16 md:py-20" style={{ backgroundColor: HS.cream }}>
        <div className="max-w-6xl mx-auto px-5">
          <div className="max-w-2xl">
            <span className="inline-block text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: HS.brand }}>
              {t("homestay.blog.eyebrow")}
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>
              {t("homestay.blog.title")}
            </h1>
            <p className="mt-4 text-lg text-gray-600">{t("homestay.blog.lead")}</p>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 py-12 md:py-16">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
                <div className="h-52 bg-gray-100" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-gray-100 rounded w-4/5" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-center">
            <BookOpen className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">{t("homestay.blog.empty_title")}</h3>
            <p className="text-gray-500 text-sm">{t("homestay.blog.empty_body")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post: any) => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <article className="group rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full flex flex-col bg-white">
                  {post.cover_image_url ? (
                    <div className="h-52 overflow-hidden">
                      <img src={post.cover_image_url} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                  ) : (
                    <div className="h-52 flex items-center justify-center" style={{ backgroundColor: "#f6efec" }}>
                      <BookOpen className="h-10 w-10" style={{ color: `${HS.brand}55` }} />
                    </div>
                  )}
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-lg font-bold mb-2 group-hover:opacity-80 transition-colors line-clamp-2 leading-snug" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>
                      {post.title}
                    </h3>
                    {post.excerpt && <p className="text-gray-500 text-sm line-clamp-2 mb-3">{post.excerpt}</p>}
                    <div className="mt-auto flex flex-wrap items-center gap-3 text-xs text-gray-400">
                      {post.author && <span className="flex items-center gap-1"><User className="h-3 w-3" />{post.author}</span>}
                      {post.published_at && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(post.published_at, "")}</span>}
                    </div>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: HS.brand }}>
                      {t("homestay.blog.read")} <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>
    </HomestayLayout>
  );
}

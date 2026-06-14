import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Calendar, User, ArrowLeft, Share2, BookOpen } from "lucide-react";
import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HS, HS_FONT } from "@/lib/homestay-theme";
import { getApiBase } from "@/lib/api-base";

const BASE = getApiBase();

const LOCALE_MAP: Record<string, string> = {
  en: "en-AU", ko: "ko-KR", ja: "ja-JP", zh: "zh-CN", th: "th-TH",
};

function formatDate(dateStr: string | null, lang: string) {
  if (!dateStr) return "";
  const locale = LOCALE_MAP[lang] ?? "en-AU";
  return new Date(dateStr).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

async function fetchPost(slug: string) {
  const res = await fetch(`${BASE}/api/v1/public/blog/${slug}`);
  if (!res.ok) throw new Error("Post not found");
  return res.json();
}

export default function HomestayBlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "en").split("-")[0];

  const { data: post, isLoading, isError } = useQuery({
    queryKey: ["homestay-blog-post", slug],
    queryFn: () => fetchPost(slug),
    enabled: !!slug,
  });

  const handleShare = async () => {
    try {
      await navigator.share({ title: post?.title, url: window.location.href });
    } catch {
      await navigator.clipboard.writeText(window.location.href);
    }
  };

  if (isLoading) {
    return (
      <HomestayLayout>
        <main className="max-w-3xl mx-auto px-5 py-16 w-full">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-gray-100 rounded w-4/5" />
            <div className="h-4 bg-gray-100 rounded w-1/3" />
            <div className="h-72 bg-gray-100 rounded-2xl" />
            {[...Array(8)].map((_, i) => <div key={i} className="h-4 bg-gray-100 rounded w-full" />)}
          </div>
        </main>
      </HomestayLayout>
    );
  }

  if (isError || !post) {
    return (
      <HomestayLayout title={t("blog_post.not_found_title")}>
        <main className="flex flex-col items-center justify-center text-center px-5 py-20">
          <BookOpen className="h-16 w-16 text-gray-200 mb-6" />
          <h1 className="text-2xl font-bold text-gray-800 mb-3">{t("blog_post.not_found_title")}</h1>
          <p className="text-gray-500 mb-8 max-w-sm">{t("blog_post.not_found_text")}</p>
          <Link href="/blog">
            <span className="inline-flex items-center gap-2 font-semibold hover:gap-3 transition-all" style={{ color: HS.brand }}>
              <ArrowLeft className="h-4 w-4" /> {t("blog_post.back")}
            </span>
          </Link>
        </main>
      </HomestayLayout>
    );
  }

  return (
    <HomestayLayout title={post.title}>
      <article className="max-w-3xl mx-auto px-5 py-12">
        <Link href="/blog">
          <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:opacity-80 transition-colors mb-8 group cursor-pointer">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            {t("blog_post.back")}
          </span>
        </Link>

        <h1 className="text-3xl md:text-4xl font-extrabold leading-tight mb-6" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>
          {post.title}
        </h1>

        <div className="flex flex-wrap items-center gap-5 text-sm text-gray-500 mb-8 pb-8 border-b border-gray-100">
          {post.author && (
            <span className="flex items-center gap-1.5">
              <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: "#f6efec" }}>
                <User className="h-3.5 w-3.5" style={{ color: HS.brand }} />
              </span>
              <span className="font-medium text-gray-700">{post.author}</span>
            </span>
          )}
          {post.published_at && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" /> {formatDate(post.published_at, lang)}
            </span>
          )}
          <button onClick={handleShare} className="ml-auto flex items-center gap-1.5 text-gray-400 hover:opacity-80 transition-colors" title={t("blog_post.share_title")}>
            <Share2 className="h-4 w-4" /> {t("blog_post.share")}
          </button>
        </div>

        {post.excerpt && <p className="text-xl text-gray-600 leading-relaxed mb-8 font-medium">{post.excerpt}</p>}

        {post.cover_image_url && (
          <div className="rounded-2xl overflow-hidden mb-10 shadow-sm">
            <img src={post.cover_image_url} alt={post.title} className="w-full max-h-[480px] object-cover" />
          </div>
        )}

        {post.content ? (
          <div
            className="prose prose-lg max-w-none text-gray-700 prose-headings:font-bold prose-h2:text-2xl prose-h3:text-xl prose-img:rounded-xl prose-strong:text-gray-900 prose-ul:list-disc prose-ol:list-decimal"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        ) : (
          <p className="text-gray-400 italic">{t("blog_post.no_content")}</p>
        )}

        <div className="mt-12 pt-8 border-t border-gray-100">
          <Link href="/blog">
            <span className="inline-flex items-center gap-2 font-semibold hover:gap-3 transition-all cursor-pointer" style={{ color: HS.brand }}>
              <ArrowLeft className="h-4 w-4" /> {t("blog_post.more_articles")}
            </span>
          </Link>
        </div>
      </article>
    </HomestayLayout>
  );
}

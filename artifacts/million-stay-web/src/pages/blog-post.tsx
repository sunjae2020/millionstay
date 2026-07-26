import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Calendar, User, Tag, ArrowLeft, Share2, BookOpen } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { getApiBase } from "@/lib/api-base";
import { formatDate } from "@/lib/dateFormat";

const BASE = getApiBase();


async function fetchPost(slug: string) {
  const res = await fetch(`${BASE}/api/v1/public/blog/${slug}`);
  if (!res.ok) throw new Error("Post not found");
  return res.json();
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();

  const { data: post, isLoading, isError } = useQuery({
    queryKey: ["public-blog-post", slug],
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
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-3xl mx-auto px-6 py-16 w-full">
          <div className="animate-pulse space-y-6">
            <div className="h-3 bg-gray-100 rounded w-1/4" />
            <div className="h-10 bg-gray-100 rounded w-4/5" />
            <div className="h-4 bg-gray-100 rounded w-1/3" />
            <div className="h-72 bg-gray-100 rounded-2xl" />
            {[...Array(8)].map((_, i) => <div key={i} className="h-4 bg-gray-100 rounded w-full" />)}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
          <BookOpen className="h-16 w-16 text-gray-200 mb-6" />
          <h1 className="text-2xl font-bold text-gray-800 mb-3">{t("blog_post.not_found_title")}</h1>
          <p className="text-gray-500 mb-8 max-w-sm">
            {t("blog_post.not_found_text")}
          </p>
          <Link href="/blog">
            <span className="inline-flex items-center gap-2 text-primary font-semibold hover:gap-3 transition-all">
              <ArrowLeft className="h-4 w-4" /> {t("blog_post.back")}
            </span>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <Link href="/blog">
            <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors mb-8 group cursor-pointer">
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
              {t("blog_post.back")}
            </span>
          </Link>

          <article>
            {post.category && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-widest mb-4">
                <Tag className="h-3 w-3" />{post.category}
              </span>
            )}

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-6">
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center gap-5 text-sm text-gray-500 mb-8 pb-8 border-b border-gray-100">
              {post.author && (
                <span className="flex items-center gap-1.5">
                  <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <span className="font-medium text-gray-700">{post.author}</span>
                </span>
              )}
              {post.published_at && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {formatDate(post.published_at, "")}
                </span>
              )}
              <button
                onClick={handleShare}
                className="ml-auto flex items-center gap-1.5 text-gray-400 hover:text-primary transition-colors"
                title={t("blog_post.share_title")}
              >
                <Share2 className="h-4 w-4" /> {t("blog_post.share")}
              </button>
            </div>

            {post.excerpt && (
              <p className="text-xl text-gray-600 leading-relaxed mb-8 font-medium">
                {post.excerpt}
              </p>
            )}

            {post.cover_image_url && (
              <div className="rounded-2xl overflow-hidden mb-10 shadow-sm">
                <img
                  src={post.cover_image_url}
                  alt={post.title}
                  className="w-full max-h-[480px] object-cover"
                />
              </div>
            )}

            {post.content ? (
              <div
                className="prose prose-lg max-w-none text-gray-700 prose-headings:text-gray-900 prose-headings:font-bold prose-h2:text-2xl prose-h3:text-xl prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl prose-img:shadow-sm prose-strong:text-gray-900 prose-ul:list-disc prose-ol:list-decimal"
                dangerouslySetInnerHTML={{ __html: post.content }}
              />
            ) : (
              <p className="text-gray-400 italic">{t("blog_post.no_content")}</p>
            )}

            <div className="mt-12 pt-8 border-t border-gray-100">
              <Link href="/blog">
                <span className="inline-flex items-center gap-2 text-primary font-semibold hover:gap-3 transition-all cursor-pointer">
                  <ArrowLeft className="h-4 w-4" /> {t("blog_post.more_articles")}
                </span>
              </Link>
            </div>
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Calendar, User, Tag, ChevronRight, BookOpen } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { getApiBase } from "@/lib/api-base";
import { APP_NAME } from "../lib/appName";
import { formatDate } from "@/lib/dateFormat";

const BASE = getApiBase();

// Fallback list used only if the admin-managed category endpoint can't be reached.
const DEFAULT_CATEGORIES = ["All", "Tips & Guides", "Student Life", "Melbourne", "Housing", "News", "Lifestyle"];
// "Homestay" posts live on the homestay site's blog, not the guest blog.
const GUEST_HIDDEN_CATEGORY = "Homestay";

async function fetchCategories(): Promise<string[]> {
  try {
    const res = await fetch(`${BASE}/api/v1/public/blog-categories`);
    if (!res.ok) return DEFAULT_CATEGORIES;
    const json = await res.json();
    const names = (json.data ?? [])
      .map((c: any) => c.name)
      .filter((n: string) => n !== GUEST_HIDDEN_CATEGORY);
    return ["All", ...names];
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

async function fetchBlogPosts(category?: string) {
  const qs = new URLSearchParams();
  if (category && category !== "All") qs.set("category", category);
  // Homestay-tagged posts are surfaced on the homestay site only — keep them out
  // of the guest blog's "All" listing.
  else qs.set("exclude_category", "Homestay");
  const res = await fetch(`${BASE}/api/v1/public/blog?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch posts");
  const json = await res.json();
  return json.data ?? [];
}

export default function Blog() {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState("All");

  const { data: CATEGORIES = DEFAULT_CATEGORIES } = useQuery({
    queryKey: ["public-blog-categories"],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000,
  });

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["public-blog", activeCategory],
    queryFn: () => fetchBlogPosts(activeCategory),
  });

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-white py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="max-w-2xl">
              <span className="inline-block text-primary text-sm font-semibold uppercase tracking-widest mb-3">{APP_NAME} Blog</span>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
                Tips, guides &amp; insights for international students
              </h1>
              <p className="text-lg text-gray-600">
                Everything you need to know about living in Melbourne — from finding accommodation to settling in.
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-wrap gap-2 mb-10">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                  activeCategory === cat
                    ? "bg-primary text-white border-primary"
                    : "border-gray-200 text-gray-600 hover:border-primary hover:text-primary"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
                  <div className="h-52 bg-gray-100" />
                  <div className="p-5 space-y-3">
                    <div className="h-3 bg-gray-100 rounded w-1/3" />
                    <div className="h-5 bg-gray-100 rounded w-4/5" />
                    <div className="h-4 bg-gray-100 rounded w-full" />
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="py-20 flex flex-col items-center text-center">
              <BookOpen className="h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">{t("blog_post.empty")}</h3>
              <p className="text-gray-500 text-sm">{t("blog_post.empty_hint")}</p>
            </div>
          ) : (
            <>
              {posts.length > 0 && (
                <Link href={`/blog/${posts[0].slug}`}>
                  <div className="mb-12 rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                    <div className="flex flex-col md:flex-row">
                      {posts[0].cover_image_url ? (
                        <div className="md:w-1/2 h-64 md:h-auto overflow-hidden">
                          <img
                            src={posts[0].cover_image_url}
                            alt={posts[0].title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      ) : (
                        <div className="md:w-1/2 h-64 md:h-auto bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                          <BookOpen className="h-16 w-16 text-primary/40" />
                        </div>
                      )}
                      <div className="md:w-1/2 p-8 flex flex-col justify-center">
                        {posts[0].category && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary uppercase tracking-widest mb-3">
                            <Tag className="h-3 w-3" />{posts[0].category}
                          </span>
                        )}
                        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 group-hover:text-primary transition-colors leading-tight">
                          {posts[0].title}
                        </h2>
                        {posts[0].excerpt && (
                          <p className="text-gray-600 mb-4 line-clamp-3">{posts[0].excerpt}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                          {posts[0].author && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{posts[0].author}</span>}
                          {posts[0].published_at && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(posts[0].published_at, "")}</span>}
                        </div>
                        <div className="mt-5">
                          <span className="inline-flex items-center gap-1 text-primary font-semibold text-sm group-hover:gap-2 transition-all">
                            Read article <ChevronRight className="h-4 w-4" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              )}

              {posts.length > 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {posts.slice(1).map((post: any) => (
                    <Link key={post.id} href={`/blog/${post.slug}`}>
                      <article className="group rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full flex flex-col">
                        {post.cover_image_url ? (
                          <div className="h-52 overflow-hidden">
                            <img
                              src={post.cover_image_url}
                              alt={post.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          </div>
                        ) : (
                          <div className="h-52 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                            <BookOpen className="h-10 w-10 text-primary/30" />
                          </div>
                        )}
                        <div className="p-5 flex flex-col flex-1">
                          {post.category && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary uppercase tracking-widest mb-2">
                              <Tag className="h-3 w-3" />{post.category}
                            </span>
                          )}
                          <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                            {post.title}
                          </h3>
                          {post.excerpt && (
                            <p className="text-gray-500 text-sm line-clamp-2 mb-3">{post.excerpt}</p>
                          )}
                          <div className="mt-auto flex flex-wrap items-center gap-3 text-xs text-gray-400">
                            {post.author && <span className="flex items-center gap-1"><User className="h-3 w-3" />{post.author}</span>}
                            {post.published_at && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(post.published_at, "")}</span>}
                          </div>
                        </div>
                      </article>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

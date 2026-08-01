import { useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { CmsWorkspace } from "./CmsWorkspace";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BlogList from "@/pages/blog/BlogList";
import BlogCategories from "@/pages/blog/BlogCategories";

// The blog sits in the content tree beside the pages of the site it belongs to,
// so which tab is open is a route (not local state) — clicking "Blog" or "Blog
// Categories" in the tree lands on the right one, and the address is shareable.
// `?site=` carries the site the tree entry was under.
function CmsBlogScreen({ tab }: { tab: "posts" | "categories" }) {
  const { t } = useTranslation();
  const [location, navigate] = useLocation();

  // Selecting a site's blog in the tree also moves the CMS site selection, so
  // the list, the "new post" button and the category list all agree.
  useEffect(() => {
    const site = new URLSearchParams(window.location.search).get("site");
    if (site) localStorage.setItem("cms.site", site);
  }, [location]);

  const siteParam = typeof window !== "undefined" ? window.location.search : "";

  return (
    <CmsWorkspace>
      <Tabs
        value={tab}
        onValueChange={(v) => navigate(v === "posts" ? `/cms/blog${siteParam}` : `/cms/blog-categories${siteParam}`)}
      >
        <div className="border-b bg-background px-6 pt-4">
          <TabsList>
            <TabsTrigger value="posts">{t("cms.blog_tab_posts")}</TabsTrigger>
            <TabsTrigger value="categories">{t("cms.blog_tab_categories")}</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="posts" className="mt-0">
          <BlogList embedded />
        </TabsContent>
        <TabsContent value="categories" className="mt-0">
          <BlogCategories embedded />
        </TabsContent>
      </Tabs>
    </CmsWorkspace>
  );
}

export default function CmsBlog() {
  return <CmsBlogScreen tab="posts" />;
}

export function CmsBlogCategories() {
  return <CmsBlogScreen tab="categories" />;
}

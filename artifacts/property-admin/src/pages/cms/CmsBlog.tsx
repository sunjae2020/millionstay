import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BlogList from "@/pages/blog/BlogList";
import BlogCategories from "@/pages/blog/BlogCategories";

// The blog is one CMS screen with two tabs (posts / categories) instead of the
// two separate sidebar entries it used to have.
export default function CmsBlog() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(() => localStorage.getItem("cms.blogTab") ?? "posts");

  return (
    <div className="cms-blog">
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v);
          localStorage.setItem("cms.blogTab", v);
        }}
      >
        {/* The tab strip floats above the embedded page's own header. */}
        <div className="border-b bg-white px-6 pt-4">
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
    </div>
  );
}

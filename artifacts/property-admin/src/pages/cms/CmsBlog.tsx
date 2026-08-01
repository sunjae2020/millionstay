import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BlogList from "@/pages/blog/BlogList";
import BlogCategories from "@/pages/blog/BlogCategories";

// The blog is one CMS screen with two tabs (posts / categories) instead of the
// two separate sidebar entries it used to have. The embedded children skip
// their own <Layout>, so this screen supplies the sidebar chrome once.
export default function CmsBlog() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(() => localStorage.getItem("cms.blogTab") ?? "posts");

  return (
    <Layout>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v);
          localStorage.setItem("cms.blogTab", v);
        }}
      >
        {/* The tab strip sits above the embedded page's own header. */}
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
    </Layout>
  );
}

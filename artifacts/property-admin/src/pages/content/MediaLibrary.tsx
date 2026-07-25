import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { MediaGrid } from "@/components/MediaLibrary";

// Unified media library — browse, upload, copy-URL and delete every marketing /
// CMS image in one place. Sensitive folders (private docs, condition reports, CS
// attachments) are intentionally excluded server-side.
export default function MediaLibraryPage() {
  const { t } = useTranslation();
  return (
    <Layout>
      <PageHeader title={t("media.page_title")} subtitle={t("media.page_subtitle")} />
      <div className="p-4 sm:p-6">
        <MediaGrid mode="manage" />
      </div>
    </Layout>
  );
}

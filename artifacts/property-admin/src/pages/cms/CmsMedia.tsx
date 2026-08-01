import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Images, Folder } from "lucide-react";
import { MediaGrid, MEDIA_FOLDERS, type MediaFolder } from "@/components/MediaLibrary";

// Media centre — browse, upload, copy-URL and delete every marketing / CMS
// image in one place, with the folder list surfaced as a sidebar instead of a
// dropdown. Sensitive folders (private docs, condition reports, CS attachments,
// ID photos) are excluded server-side and never appear here.

const FOLDER_LABEL_KEYS: Record<string, string> = {
  content: "cms.folder_content",
  spaces: "cms.folder_spaces",
  listings: "cms.folder_listings",
  branding: "cms.folder_branding",
};

export default function CmsMedia() {
  const { t } = useTranslation();
  const [folder, setFolder] = useState<MediaFolder>("content");

  return (
    <Layout>
      <PageHeader
        title={
          <>
            <Images className="h-5 w-5" />
            {t("cms.media_title")}
          </>
        }
        subtitle={t("cms.media_subtitle")}
      />
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
          <nav className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground px-2 pb-1">{t("cms.folders")}</p>
            {MEDIA_FOLDERS.map((name) => (
              <button
                key={name}
                onClick={() => setFolder(name)}
                className={`w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                  folder === name ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"
                }`}
              >
                <Folder className="h-4 w-4" />
                <span className="flex-1 text-left">
                  {t(FOLDER_LABEL_KEYS[name] ?? "", { defaultValue: name })}
                </span>
              </button>
            ))}
            <div className="pt-3 px-2">
              <Badge variant="outline" className="text-[10px] font-normal">
                {t("cms.media_privacy_note")}
              </Badge>
            </div>
          </nav>

          <div>
            {/* key forces a fresh grid when the folder changes so paging resets. */}
            <MediaGrid key={folder} mode="manage" initialFolder={folder} />
          </div>
        </div>
      </div>
    </Layout>
  );
}

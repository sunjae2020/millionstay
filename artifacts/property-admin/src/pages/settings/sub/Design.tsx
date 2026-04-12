import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Palette } from "lucide-react";
import { Design } from "@/pages/settings/sections/Design";

export default function DesignPage() {
  const { t } = useTranslation();
  return (
    <Layout>
      <PageHeader
        title={
          <>
            <Palette className="h-5 w-5" />
            {t("nav.design")}
          </>
        }
        subtitle="Logo, favicon, colours and display preferences"
      />
      <div className="max-w-2xl px-8 py-6">
        <Design />
      </div>
    </Layout>
  );
}

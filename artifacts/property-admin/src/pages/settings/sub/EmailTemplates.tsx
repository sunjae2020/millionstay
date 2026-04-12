import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Mail } from "lucide-react";
import { Email } from "@/pages/settings/sections/Email";

export default function EmailTemplatesPage() {
  const { t } = useTranslation();
  return (
    <Layout>
      <PageHeader
        title={
          <>
            <Mail className="h-5 w-5" />
            {t("nav.email_templates")}
          </>
        }
        subtitle="Customise automated email notifications"
      />
      <div className="max-w-2xl px-8 py-6">
        <Email />
      </div>
    </Layout>
  );
}

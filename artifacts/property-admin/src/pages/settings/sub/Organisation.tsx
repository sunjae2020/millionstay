import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Building } from "lucide-react";
import { CompanyInfo } from "@/pages/settings/sections/CompanyInfo";

export default function OrganisationPage() {
  const { t } = useTranslation();
  return (
    <Layout>
      <PageHeader
        title={
          <>
            <Building className="h-5 w-5" />
            {t("nav.organisation")}
          </>
        }
        subtitle="Company profile and contact details"
      />
      <div className="max-w-2xl px-8 py-6">
        <CompanyInfo />
      </div>
    </Layout>
  );
}

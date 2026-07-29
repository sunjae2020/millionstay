import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Building } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyInfo } from "@/pages/settings/sections/CompanyInfo";
import { OrgDocuments } from "@/pages/settings/sections/OrgDocuments";
import { useAuth } from "@/contexts/AuthContext";

// Company paperwork holds bank and registration details, so the tab is only
// offered to write-capable admin roles. Hiding it is presentation only — the
// API applies the same allowlist to every request.
const DOC_ROLES = ["SuperAdmin", "Super Admin", "superadmin", "super_admin", "Admin"];

export default function OrganisationPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canSeeDocuments = !!user && DOC_ROLES.includes(user.role);

  return (
    <Layout>
      <PageHeader
        title={
          <>
            <Building className="h-5 w-5" />
            {t("nav.organisation")}
          </>
        }
        subtitle={t("settings_org.page_subtitle")}
      />
      <div className="px-8 py-6">
        <Tabs defaultValue="info">
          <TabsList>
            <TabsTrigger value="info">{t("settings_org.tab_info")}</TabsTrigger>
            {canSeeDocuments && (
              <TabsTrigger value="documents">{t("settings_org.tab_documents")}</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="info" className="mt-4">
            <div className="max-w-2xl">
              <CompanyInfo />
            </div>
          </TabsContent>
          {canSeeDocuments && (
            <TabsContent value="documents" className="mt-4">
              <div className="max-w-4xl">
                <OrgDocuments />
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}

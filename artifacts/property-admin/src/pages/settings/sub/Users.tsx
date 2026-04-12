import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { UserCog } from "lucide-react";
import { UserManagement } from "@/pages/settings/sections/UserManagement";

export default function UsersPage() {
  const { t } = useTranslation();
  return (
    <Layout>
      <PageHeader
        title={
          <>
            <UserCog className="h-5 w-5" />
            {t("nav.users")}
          </>
        }
        subtitle="Manage admin users and access permissions"
      />
      <div className="max-w-2xl px-8 py-6">
        <UserManagement />
      </div>
    </Layout>
  );
}

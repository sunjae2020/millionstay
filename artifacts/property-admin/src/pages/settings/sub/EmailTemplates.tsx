import { Layout, PageHeader } from "@/components/Layout";
import { Mail } from "lucide-react";
import { Email } from "@/pages/settings/sections/Email";

export default function EmailTemplatesPage() {
  return (
    <Layout>
      <PageHeader
        title={
          <>
            <Mail className="h-5 w-5" />
            Email Templates
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

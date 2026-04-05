import { Layout, PageHeader } from "@/components/Layout";
import { Settings2, Bell, Shield, CreditCard, Mail, Globe, Users, Building2 } from "lucide-react";

const plannedSections = [
  {
    icon: Building2,
    title: "General",
    description: "Company name, logo, timezone, and locale settings",
  },
  {
    icon: Users,
    title: "User Management",
    description: "Admin accounts, roles, and permission levels",
  },
  {
    icon: Bell,
    title: "Notifications",
    description: "Email and in-app notification preferences",
  },
  {
    icon: Mail,
    title: "Email",
    description: "SMTP configuration, email templates, and sender details",
  },
  {
    icon: CreditCard,
    title: "Payments",
    description: "Stripe integration, payment methods, and billing settings",
  },
  {
    icon: Shield,
    title: "Security",
    description: "Password policy, session timeout, and 2FA settings",
  },
  {
    icon: Globe,
    title: "Integrations",
    description: "Third-party service connections and API keys",
  },
];

export default function Settings() {
  return (
    <Layout>
      <PageHeader
        title={
          <>
            <Settings2 className="h-5 w-5" />
            Settings
          </>
        }
        subtitle="System configuration and preferences"
      />

      <div className="p-6 max-w-3xl">
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center mb-8">
          <Settings2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Coming Soon</p>
          <p className="text-sm text-muted-foreground mt-1">
            Settings will be configured here in a future update.
          </p>
        </div>

        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Planned Sections
        </h2>
        <div className="grid gap-3">
          {plannedSections.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex items-start gap-4 rounded-lg border bg-card px-4 py-3 opacity-60"
            >
              <div className="mt-0.5 h-8 w-8 flex-shrink-0 rounded-md bg-muted flex items-center justify-center">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}

import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import {
  Building,
  UserCog,
  FileText,
  CreditCard,
  Layers,
  Tag,
  Landmark,
  Wallet,
  MapPin,
  Mail,
  ScrollText,
  BarChart3,
  CalendarDays,
  TrendingUp,
  Settings2,
  Palette,
  Plug,
  KeyRound,
  Database,
  Package,
  MailCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type CardDef = {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
};

const ADMIN_CARDS: CardDef[] = [
  {
    title: "Organisation",
    description: "Company profile and contact details",
    icon: Building,
    href: "/settings/organisation",
  },
  {
    title: "Users",
    description: "Manage admin users and roles",
    icon: UserCog,
    href: "/settings/users",
  },
  {
    title: "Design & Branding",
    description: "Logo, favicon, colours and fonts",
    icon: Palette,
    href: "/settings/design",
  },
  {
    title: "Document Templates",
    description: "Editable email + contract + PDF templates",
    icon: FileText,
    href: "/settings/document-templates",
  },
  {
    title: "Homestay Billing",
    description: "Rent cycle, payment method, card fee, lead days",
    icon: CreditCard,
    href: "/settings/homestay-billing",
  },
  {
    title: "Application Emails",
    description: "Acknowledgment email & PDF attachment per application type",
    icon: MailCheck,
    href: "/settings/application-emails",
  },
  {
    title: "Integrations",
    description: "Stripe, Cloudinary, Resend and more",
    icon: Plug,
    href: "/settings/integrations",
  },
  {
    title: "API Keys",
    description: "Issue API keys for external app integration",
    icon: KeyRound,
    href: "/settings/api-keys",
  },
  {
    title: "System Log",
    description: "Audit trail of system activity",
    icon: ScrollText,
    href: "/settings/system-log",
  },
];

const SUPER_ADMIN_CARDS: CardDef[] = [
  {
    title: "DB Sync",
    description: "Snapshot dev DB and apply to production",
    icon: Database,
    href: "/settings/db-sync",
  },
];

const REF_CARDS: CardDef[] = [
  {
    title: "Contract Types",
    description: "Define contract type categories",
    icon: FileText,
    href: "/settings/contract-types",
  },
  {
    title: "Product Groups",
    description: "Organise products into groups",
    icon: Layers,
    href: "/settings/product-groups",
  },
  {
    title: "Product Types",
    description: "Manage product type definitions",
    icon: Tag,
    href: "/settings/product-types",
  },
  {
    title: "Add-on Services",
    description: "Airport pickup, SIM, settlement and more",
    icon: Package,
    href: "/settings/addon-services",
  },
  {
    title: "Payment Info",
    description: "Payment account reference data",
    icon: Landmark,
    href: "/settings/payment-info",
  },
  {
    title: "Cost Center",
    description: "Cost centre configuration",
    icon: Wallet,
    href: "/settings/cost-center",
  },
  {
    title: "Suburb",
    description: "Suburb and location data",
    icon: MapPin,
    href: "/settings/suburbs",
  },
];

const REPORT_CARDS: CardDef[] = [
  {
    title: "Booking Report",
    description: "Occupancy and booking analytics",
    icon: CalendarDays,
    href: "/settings/reports/bookings",
  },
  {
    title: "Revenue Report",
    description: "Revenue breakdown and trends",
    icon: TrendingUp,
    href: "/settings/reports/revenue",
  },
  {
    title: "Occupancy Report",
    description: "Space occupancy over time",
    icon: BarChart3,
    href: "/settings/reports/occupancy",
  },
];

function HubCard({ card }: { card: CardDef }) {
  const [, navigate] = useLocation();
  return (
    <button
      onClick={() => navigate(card.href)}
      className="group flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/40 hover:border-primary/40 transition-all text-left"
    >
      <div className="mt-0.5 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
        <card.icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{card.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{card.description}</p>
      </div>
    </button>
  );
}

export default function Settings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isSuperAdmin =
    !!user && ["Super Admin", "SuperAdmin", "superadmin", "super_admin"].includes(user.role);
  return (
    <Layout>
      <PageHeader
        title={
          <>
            <Settings2 className="h-5 w-5" />
            {t("nav.settings")}
          </>
        }
        subtitle="Administration, reference data and reports"
      />

      <div className="p-6 max-w-5xl space-y-8">
        {/* Section A — Administration */}
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold text-foreground">Administration</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage users, templates and system activity
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ADMIN_CARDS.map((c) => (
              <HubCard key={c.href} card={c} />
            ))}
            {isSuperAdmin &&
              SUPER_ADMIN_CARDS.map((c) => <HubCard key={c.href} card={c} />)}
          </div>
        </section>

        <div className="h-px bg-border" />

        {/* Section B — Reference Data */}
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold text-foreground">Reference Data</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configure lookup tables and reference lists
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {REF_CARDS.map((c) => (
              <HubCard key={c.href} card={c} />
            ))}
          </div>
        </section>

        <div className="h-px bg-border" />

        {/* Section C — Reports */}
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold text-foreground">Reports</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Analytics and operational reports
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {REPORT_CARDS.map((c) => (
              <button
                key={c.href}
                className="group flex flex-col items-center gap-3 p-6 rounded-lg border bg-card hover:bg-accent/40 hover:border-primary/40 transition-all text-center"
                onClick={() => navigate(c.href)}
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{c.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                </div>
                <span className="text-xs font-medium text-primary">View Report →</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}

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
  ShieldCheck,
  Percent,
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
  ClipboardList,
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
    title: "settings_hub.organisation_title",
    description: "settings_hub.organisation_desc",
    icon: Building,
    href: "/settings/organisation",
  },
  {
    title: "settings_hub.users_title",
    description: "settings_hub.users_desc",
    icon: UserCog,
    href: "/settings/users",
  },
  {
    title: "settings_hub.roles_title",
    description: "settings_hub.roles_desc",
    icon: ShieldCheck,
    href: "/settings/roles",
  },
  {
    title: "settings_hub.design_title",
    description: "settings_hub.design_desc",
    icon: Palette,
    href: "/settings/design",
  },
  {
    title: "settings_hub.doc_templates_title",
    description: "settings_hub.doc_templates_desc",
    icon: FileText,
    href: "/settings/document-templates",
  },
  {
    title: "settings_hub.homestay_billing_title",
    description: "settings_hub.homestay_billing_desc",
    icon: CreditCard,
    href: "/settings/homestay-billing",
  },
  {
    title: "settings_hub.commission_plans_title",
    description: "settings_hub.commission_plans_desc",
    icon: Percent,
    href: "/settings/commission-plans",
  },
  {
    title: "settings_hub.application_emails_title",
    description: "settings_hub.application_emails_desc",
    icon: MailCheck,
    href: "/settings/application-emails",
  },
  {
    title: "settings_hub.integrations_title",
    description: "settings_hub.integrations_desc",
    icon: Plug,
    href: "/settings/integrations",
  },
  {
    title: "settings_hub.api_keys_title",
    description: "settings_hub.api_keys_desc",
    icon: KeyRound,
    href: "/settings/api-keys",
  },
  {
    title: "settings_hub.system_log_title",
    description: "settings_hub.system_log_desc",
    icon: ScrollText,
    href: "/settings/system-log",
  },
];

const SUPER_ADMIN_CARDS: CardDef[] = [
  {
    title: "settings_hub.db_sync_title",
    description: "settings_hub.db_sync_desc",
    icon: Database,
    href: "/settings/db-sync",
  },
];

const REF_CARDS: CardDef[] = [
  {
    title: "settings_hub.contract_types_title",
    description: "settings_hub.contract_types_desc",
    icon: FileText,
    href: "/settings/contract-types",
  },
  {
    title: "settings_hub.product_groups_title",
    description: "settings_hub.product_groups_desc",
    icon: Layers,
    href: "/settings/product-groups",
  },
  {
    title: "settings_hub.product_types_title",
    description: "settings_hub.product_types_desc",
    icon: Tag,
    href: "/settings/product-types",
  },
  {
    title: "settings_hub.addon_services_title",
    description: "settings_hub.addon_services_desc",
    icon: Package,
    href: "/settings/addon-services",
  },
  {
    title: "settings_hub.payment_info_title",
    description: "settings_hub.payment_info_desc",
    icon: Landmark,
    href: "/settings/payment-info",
  },
  {
    title: "settings_hub.cost_center_title",
    description: "settings_hub.cost_center_desc",
    icon: Wallet,
    href: "/settings/cost-center",
  },
  {
    title: "settings_hub.rental_fees_title",
    description: "settings_hub.rental_fees_desc",
    icon: Percent,
    href: "/settings/rental-fee-schedules",
  },
  {
    title: "settings_hub.inspection_template_title",
    description: "settings_hub.inspection_template_desc",
    icon: ClipboardList,
    href: "/settings/inspection-template",
  },
  {
    title: "settings_hub.suburb_title",
    description: "settings_hub.suburb_desc",
    icon: MapPin,
    href: "/settings/suburbs",
  },
];

const REPORT_CARDS: CardDef[] = [
  {
    title: "settings_hub.booking_report_title",
    description: "settings_hub.booking_report_desc",
    icon: CalendarDays,
    href: "/settings/reports/bookings",
  },
  {
    title: "settings_hub.revenue_report_title",
    description: "settings_hub.revenue_report_desc",
    icon: TrendingUp,
    href: "/settings/reports/revenue",
  },
  {
    title: "settings_hub.occupancy_report_title",
    description: "settings_hub.occupancy_report_desc",
    icon: BarChart3,
    href: "/settings/reports/occupancy",
  },
];

function HubCard({ card }: { card: CardDef }) {
  const { t } = useTranslation();
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
        <p className="text-sm font-medium text-foreground">{t(card.title)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{t(card.description)}</p>
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
        subtitle={t("settings_hub.page_subtitle")}
      />

      <div className="p-6 max-w-5xl space-y-8">
        {/* Section A — Administration */}
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold text-foreground">{t("settings_hub.section_admin_title")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("settings_hub.section_admin_desc")}
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
            <h2 className="text-base font-semibold text-foreground">{t("settings_hub.section_ref_title")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("settings_hub.section_ref_desc")}
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
            <h2 className="text-base font-semibold text-foreground">{t("settings_hub.section_reports_title")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("settings_hub.section_reports_desc")}
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
                  <p className="text-sm font-medium text-foreground">{t(c.title)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t(c.description)}</p>
                </div>
                <span className="text-xs font-medium text-primary">{t("settings_hub.view_report")}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}

import { useSearch, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { LayoutDashboard, CalendarDays, DollarSign, Wrench, Users, Radio, Handshake, Building2 } from "lucide-react";
import { DashTabs, type TabDef } from "@/components/dashboard/DashboardKit";
import OverviewTab from "@/pages/dashboard/OverviewTab";
import ReservationsTab from "@/pages/dashboard/ReservationsTab";
import FinanceTab from "@/pages/dashboard/FinanceTab";
import OperationsTab from "@/pages/dashboard/OperationsTab";
import CrmTab from "@/pages/dashboard/CrmTab";
import ChannelsTab from "@/pages/dashboard/ChannelsTab";
import HomestayOpsTab from "@/pages/dashboard/HomestayOpsTab";
import FloorBoardTab from "@/pages/dashboard/FloorBoardTab";

const TAB_IDS = ["overview", "reservations", "channels", "crm", "finance", "operations", "homestay_ops", "floor_board"] as const;

const VALID = new Set<string>(TAB_IDS);

export default function Dashboard() {
  const { t } = useTranslation();
  const search = useSearch();
  const [, navigate] = useLocation();

  const TABS: TabDef[] = [
    { id: "overview",     label: t("dashboard.tabs.overview", "Overview"),     icon: LayoutDashboard },
    { id: "reservations", label: t("dashboard.tabs.reservations", "Reservations"), icon: CalendarDays },
    { id: "channels",     label: t("dashboard.tabs.channels", "Channels"),     icon: Radio },
    { id: "crm",          label: t("dashboard.tabs.crm", "CRM"),          icon: Users },
    { id: "finance",      label: t("dashboard.tabs.finance", "Finance"),      icon: DollarSign },
    { id: "operations",   label: t("dashboard.tabs.operations", "Operations"),   icon: Wrench },
    { id: "homestay_ops", label: t("dashboard.tabs.homestay_ops", "Homestay Ops"), icon: Handshake },
    { id: "floor_board",  label: t("dashboard.tabs.floor_board", "Floor Board"), icon: Building2 },
  ];

  const requested = new URLSearchParams(search).get("tab") ?? "overview";
  const active = VALID.has(requested) ? requested : "overview";

  const setTab = (id: string) => {
    navigate(id === "overview" ? "/dashboard" : `/dashboard?tab=${id}`);
  };

  return (
    <Layout>
      {/* Header */}
      <div className="sticky top-0 z-20 border-b bg-card px-4 sm:px-6 pt-3 sm:pt-4 pb-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              {t("dashboard.title", "Dashboard")}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {t("dashboard.subtitle", "Real-time operational overview")}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-green-600 bg-green-50 dark:bg-green-500/10 px-2.5 py-1 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            {t("dashboard.live_data")}
          </span>
        </div>
        <div className="mt-3 pb-3">
          <DashTabs tabs={TABS} active={active} onChange={setTab} />
        </div>
      </div>

      {/* Tab content */}
      <div className="p-4 sm:p-6">
        {active === "overview" && <OverviewTab />}
        {active === "reservations" && <ReservationsTab />}
        {active === "channels" && <ChannelsTab />}
        {active === "crm" && <CrmTab />}
        {active === "finance" && <FinanceTab />}
        {active === "operations" && <OperationsTab />}
        {active === "homestay_ops" && <HomestayOpsTab />}
        {active === "floor_board" && <FloorBoardTab />}
      </div>
    </Layout>
  );
}

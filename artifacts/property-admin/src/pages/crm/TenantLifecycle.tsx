import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { useListBookings, useListContacts } from "@workspace/api-client-react";
import {
  UserCheck, Home, LogIn, Clock, LogOut, AlertTriangle, Search, Filter, ChevronRight,
  CalendarDays, Building2, DollarSign, FileText,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";

type LifecycleStage = "MovingIn" | "Residing" | "MovingOut" | "Completed" | "All";

interface TenantRecord {
  bookingId: number;
  bookingRef: string;
  bookingStatus: string;
  contactId: number | null;
  contactName: string;
  spaceName: string | null;
  propertyAddress: string | null;
  checkIn: string | null;
  checkOut: string | null;
  stayNights: number | null;
  totalRent: string | null;
  currency: string | null;
  stage: LifecycleStage;
  daysUntilCheckout: number | null;
  daysOverdue: number | null;
}

const STAGE_CONFIG: Record<LifecycleStage, {
  labelKey: string; icon: React.ComponentType<{ className?: string }>;
  bg: string; border: string; text: string; dot: string; header: string;
}> = {
  MovingIn: {
    labelKey: "tenant_lifecycle.stage_moving_in",
    icon: LogIn,
    bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700",
    dot: "bg-blue-500", header: "bg-blue-100",
  },
  Residing: {
    labelKey: "tenant_lifecycle.stage_residing",
    icon: Home,
    bg: "bg-green-50", border: "border-green-200", text: "text-green-700",
    dot: "bg-green-500", header: "bg-green-100",
  },
  MovingOut: {
    labelKey: "tenant_lifecycle.stage_moving_out",
    icon: LogOut,
    bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700",
    dot: "bg-amber-500", header: "bg-amber-100",
  },
  Completed: {
    labelKey: "tenant_lifecycle.stage_completed",
    icon: UserCheck,
    bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-600",
    dot: "bg-slate-400", header: "bg-slate-100",
  },
  All: { labelKey: "common.all", icon: Filter, bg: "bg-white", border: "border-gray-200", text: "text-gray-700", dot: "bg-gray-400", header: "bg-gray-100" },
};

function getStage(booking: any, today: string): LifecycleStage {
  const status = booking.booking_status;
  if (status === "CheckedOut" || status === "Cancelled") return "Completed";

  const checkIn = booking.check_in_date;
  const checkOut = booking.check_out_date;

  if (!checkIn) return "Completed";

  if (checkIn > today && (status === "Confirmed" || status === "PendingApproval" || status === "PendingPayment")) {
    return "MovingIn";
  }

  if (status === "Active") {
    if (checkOut) {
      const daysLeft = Math.round((new Date(checkOut).getTime() - new Date(today).getTime()) / 86400000);
      if (daysLeft <= 14) return "MovingOut";
    }
    return "Residing";
  }

  if (status === "Confirmed" && checkIn <= today) return "Residing";

  return "MovingIn";
}

function getDaysUntilCheckout(checkOut: string | null, today: string): number | null {
  if (!checkOut) return null;
  return Math.round((new Date(checkOut).getTime() - new Date(today).getTime()) / 86400000);
}

function TenantCard({ tenant, compact }: { tenant: TenantRecord; compact?: boolean }) {
  const { t } = useTranslation();
  const cfg = STAGE_CONFIG[tenant.stage];
  const Icon = cfg.icon;

  return (
    <div className={`bg-white rounded-lg border ${cfg.border} shadow-sm hover:shadow-md transition-shadow`}>
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg ${cfg.header}`}>
        <Icon className={`h-3.5 w-3.5 ${cfg.text}`} />
        <span className={`text-[11px] font-semibold ${cfg.text}`}>{t(cfg.labelKey)}</span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{tenant.bookingRef}</span>
      </div>

      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <Link href={`/booking/bookings/${tenant.bookingId}`}>
              <p className="font-semibold text-sm hover:text-primary">{tenant.contactName}</p>
            </Link>
            {tenant.spaceName && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Building2 className="h-3 w-3" />{tenant.spaceName}
              </p>
            )}
          </div>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
            {tenant.bookingStatus}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <div className="flex items-center gap-1 text-muted-foreground">
            <LogIn className="h-3 w-3 shrink-0" />
            <span>{tenant.checkIn ?? "—"}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <LogOut className="h-3 w-3 shrink-0" />
            <span>{tenant.checkOut ?? "—"}</span>
          </div>
          {tenant.stayNights && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <CalendarDays className="h-3 w-3 shrink-0" />
              <span>{t("tenant_lifecycle.nights_count", { count: tenant.stayNights })}</span>
            </div>
          )}
          {tenant.totalRent && (
            <div className="flex items-center gap-1 text-muted-foreground font-medium">
              <DollarSign className="h-3 w-3 shrink-0" />
              <span>{tenant.currency ?? "AUD"} {parseFloat(tenant.totalRent).toLocaleString()}</span>
            </div>
          )}
        </div>

        {tenant.stage === "MovingIn" && tenant.daysUntilCheckout !== null && (
          <div className="mt-2 text-[11px] text-blue-600 font-medium">
            {t("tenant_lifecycle.checkin_in_days", { count: Math.round((new Date(tenant.checkIn!).getTime() - new Date().getTime()) / 86400000) })}
          </div>
        )}

        {tenant.stage === "MovingOut" && tenant.daysUntilCheckout !== null && (
          <div className={`mt-2 text-[11px] font-medium flex items-center gap-1 ${tenant.daysUntilCheckout <= 7 ? "text-red-600" : "text-amber-600"}`}>
            <AlertTriangle className="h-3 w-3" />
            {tenant.daysUntilCheckout <= 0 ? t("tenant_lifecycle.checkout_overdue") : t("tenant_lifecycle.checkout_in_days", { count: tenant.daysUntilCheckout })}
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <Link href={`/booking/bookings/${tenant.bookingId}`}>
            <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 gap-1">
              <FileText className="h-3 w-3" /> {t("tenant_lifecycle.booking")}
            </Button>
          </Link>
          {tenant.contactId && (
            <Link href={`/account/contacts/${tenant.contactId}`}>
              <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 gap-1">
                <UserCheck className="h-3 w-3" /> {t("tenant_lifecycle.contact")}
            </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function StageSummaryCard({ stage, count, active }: { stage: LifecycleStage; count: number; active: boolean }) {
  const { t } = useTranslation();
  const cfg = STAGE_CONFIG[stage];
  const Icon = cfg.icon;
  return (
    <div className={`rounded-lg border p-4 cursor-pointer transition-all ${active ? `${cfg.bg} ${cfg.border} shadow-md` : "bg-card border-border hover:bg-muted/30"}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${active ? cfg.text : "text-muted-foreground"}`} />
        <span className={`text-xs font-semibold ${active ? cfg.text : "text-muted-foreground"}`}>{t(cfg.labelKey)}</span>
      </div>
      <p className={`text-2xl font-bold mt-2 ${active ? cfg.text : "text-foreground"}`}>{count}</p>
    </div>
  );
}

export default function TenantLifecycle() {
  const { t } = useTranslation();
  const [stageFilter, setStageFilter] = useState<LifecycleStage>("All");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const today = new Date().toISOString().slice(0, 10);

  const { data: bookings, isLoading } = useListBookings({});

  const tenants: TenantRecord[] = (bookings ?? [])
    .filter(b => !["Draft", "Cancelled"].includes(b.booking_status))
    .map(b => {
      const stage = getStage(b, today);
      const daysUntilCheckout = getDaysUntilCheckout(b.check_out_date ?? null, today);
      return {
        bookingId: b.id,
        bookingRef: b.booking_ref ?? "",
        bookingStatus: b.booking_status,
        contactId: b.contact_id ?? null,
        contactName: (b as any).contact_name ?? "Unknown Guest",
        spaceName: (b as any).space_name ?? null,
        propertyAddress: (b as any).property_address ?? null,
        checkIn: b.check_in_date ?? null,
        checkOut: b.check_out_date ?? null,
        stayNights: b.stay_nights ?? null,
        totalRent: b.total_rent ?? null,
        currency: b.currency ?? "AUD",
        stage,
        daysUntilCheckout,
        daysOverdue: daysUntilCheckout !== null && daysUntilCheckout < 0 ? -daysUntilCheckout : null,
      };
    });

  const stageCounts: Record<LifecycleStage, number> = {
    All: tenants.length,
    MovingIn: tenants.filter(t => t.stage === "MovingIn").length,
    Residing: tenants.filter(t => t.stage === "Residing").length,
    MovingOut: tenants.filter(t => t.stage === "MovingOut").length,
    Completed: tenants.filter(t => t.stage === "Completed").length,
  };

  const filtered = tenants.filter(t => {
    const matchStage = stageFilter === "All" || t.stage === stageFilter;
    const matchSearch = !search || t.contactName.toLowerCase().includes(search.toLowerCase()) || t.bookingRef.toLowerCase().includes(search.toLowerCase()) || (t.spaceName?.toLowerCase().includes(search.toLowerCase()) ?? false);
    return matchStage && matchSearch;
  });

  const sortedFiltered = [...filtered].sort((a, b) => {
    const order: Record<LifecycleStage, number> = { MovingIn: 0, Residing: 1, MovingOut: 2, Completed: 3, All: 4 };
    return (order[a.stage] ?? 4) - (order[b.stage] ?? 4);
  });

  const urgentCount = tenants.filter(t => t.stage === "MovingOut" && (t.daysUntilCheckout ?? 99) <= 7).length;

  const columns: ColumnDef<TenantRecord>[] = useMemo(
    () => [
      {
        key: "stage",
        header: "tenant_lifecycle.col_stage",
        cell: (tenant) => {
          const cfg = STAGE_CONFIG[tenant.stage];
          const Icon = cfg.icon;
          return (
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
              <Icon className="h-3 w-3" /> {t(cfg.labelKey)}
            </span>
          );
        },
      },
      {
        key: "contactName",
        header: "tenant_lifecycle.col_tenant",
        hideable: false,
        defaultWidth: 200,
        cell: (tenant) => (
          <>
            <Link href={`/booking/bookings/${tenant.bookingId}`} className="font-medium hover:underline">{tenant.contactName}</Link>
            <p className="text-[10px] font-mono text-muted-foreground">{tenant.bookingRef}</p>
          </>
        ),
      },
      {
        key: "spaceName",
        header: "tenant_lifecycle.col_space",
        cell: (tenant) => <span className="text-muted-foreground">{tenant.spaceName ?? "—"}</span>,
      },
      {
        key: "checkIn",
        header: "tenant_lifecycle.col_check_in",
        cell: (tenant) => <span className="text-muted-foreground">{tenant.checkIn ?? "—"}</span>,
      },
      {
        key: "checkOut",
        header: "tenant_lifecycle.col_check_out",
        cell: (tenant) => <span className="text-muted-foreground">{tenant.checkOut ?? "—"}</span>,
      },
      {
        key: "stayNights",
        header: "tenant_lifecycle.col_nights",
        cell: (tenant) => <span className="text-muted-foreground">{tenant.stayNights ?? "—"}</span>,
      },
      {
        key: "totalRent",
        header: "tenant_lifecycle.col_rent",
        cell: (tenant) => (
          <span className="text-muted-foreground">
            {tenant.totalRent ? `${tenant.currency} ${parseFloat(tenant.totalRent).toLocaleString()}` : "—"}
          </span>
        ),
      },
      {
        key: "bookingStatus",
        header: "common.status",
        cell: (tenant) => {
          const cfg = STAGE_CONFIG[tenant.stage];
          return (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
              {tenant.bookingStatus}
            </span>
          );
        },
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        defaultWidth: 90,
        cell: (tenant) => (
          <Link href={`/booking/bookings/${tenant.bookingId}`}>
            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1">
              {t("common.view")} <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        ),
      },
    ],
    [t],
  );

  return (
    <Layout>
      <PageHeader
        title={t("tenant_lifecycle.title")}
        subtitle={t("tenant_lifecycle.subtitle_track")}
        actions={
          <div className="flex rounded-md border overflow-hidden">
            <button
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "cards" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
              onClick={() => setViewMode("cards")}
            >{t("tenant_lifecycle.view_cards")}</button>
            <button
              className={`px-3 py-1.5 text-xs font-medium border-l transition-colors ${viewMode === "table" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
              onClick={() => setViewMode("table")}
            >{t("tenant_lifecycle.view_table")}</button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {urgentCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 font-medium">
              {t("tenant_lifecycle.urgent_checkout_alert", { count: urgentCount })}
            </p>
          </div>
        )}

        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          onClick={() => {}}
        >
          {(["MovingIn", "Residing", "MovingOut", "Completed"] as LifecycleStage[]).map(stage => (
            <div key={stage} onClick={() => setStageFilter(stageFilter === stage ? "All" : stage)}>
              <StageSummaryCard stage={stage} count={stageCounts[stage]} active={stageFilter === stage} />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder={t("tenant_lifecycle.search_placeholder")} className="pl-8 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["All", "MovingIn", "Residing", "MovingOut", "Completed"] as LifecycleStage[]).map(stage => {
              const cfg = STAGE_CONFIG[stage];
              return (
                <button
                  key={stage}
                  onClick={() => setStageFilter(stage)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${stageFilter === stage ? `${cfg.bg} ${cfg.text} ${cfg.border} shadow-sm` : "bg-white border-gray-200 text-muted-foreground hover:bg-muted/30"}`}
                >
                  {t(cfg.labelKey)} <span className="ml-1 font-bold">{stageCounts[stage]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {viewMode === "cards" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedFiltered.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">{t("tenant_lifecycle.no_tenants_found")}</div>
            ) : sortedFiltered.map(tenant => (
              <TenantCard key={tenant.bookingId} tenant={tenant} />
            ))}
          </div>
        ) : (
          <DataTable
            tableKey="tenant-lifecycle"
            columns={columns}
            data={sortedFiltered}
            isLoading={isLoading}
            rowKey={(tenant) => tenant.bookingId}
            emptyText={t("tenant_lifecycle.no_tenants_found")}
          />
        )}
      </div>
    </Layout>
  );
}

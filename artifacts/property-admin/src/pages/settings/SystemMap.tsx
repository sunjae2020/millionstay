import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Redirect } from "wouter";
import { useQuery, useQueryClient, useIsFetching } from "@tanstack/react-query";
import { apiJson } from "@/lib/apiFetch";
import { Layout, PageHeader } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import {
  Network, Database, Server, Monitor, Cloud, GitBranch, Layers, Boxes, Cable,
  Cpu, LayoutGrid, Plug, Clock, Route, Table2, RefreshCw, ChevronDown, ChevronRight,
} from "lucide-react";
import { Card, SectionTitle } from "./system/ui";
import SystemIntegrations from "./system/SystemIntegrations";
import SystemJobs from "./system/SystemJobs";
import SystemApi from "./system/SystemApi";
import SystemSchema from "./system/SystemSchema";

/* ────────────────────────────────────────────────────────────────────────────
 * Curated reference content — "what is MillionStay made of".
 * Live/queryable facts (table counts, migrations, integration presence) come
 * from /api/v1/admin/system-map/*; the descriptive maps below are maintained
 * here as the single place that answers the architecture questions.
 * ──────────────────────────────────────────────────────────────────────────── */

type StackLayer = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  items: { name: string; note: string }[];
};

const TECH_STACK: StackLayer[] = [
  {
    icon: Monitor, title: "Frontend",
    items: [
      { name: "React 18 + TypeScript", note: "6 apps: guest web · admin · agent · owner · service-host · sandbox" },
      { name: "Vite + esbuild", note: "per-app build; Vercel deploy for web + admin" },
      { name: "Tailwind + shadcn/ui", note: "@workspace/design-tokens brand.css palette" },
      { name: "wouter + TanStack Query", note: "routing + server-state caching" },
      { name: "react-i18next", note: "en · ja · ko · th · vi · zh (partner portals no vi)" },
    ],
  },
  {
    icon: Server, title: "Backend",
    items: [
      { name: "Node 24 + Express 5", note: "single API server, routes under /api/v1/" },
      { name: "Drizzle ORM", note: "typed schema in lib/db (@workspace/db)" },
      { name: "Zod validation", note: "shared schemas in @workspace/api-zod" },
      { name: "node-cron jobs", note: "FX · billing · retention · SLA watchdog" },
      { name: "AI task registry", note: "lib/ai — metered gateway (Anthropic / Kimi / Gemini)" },
    ],
  },
  {
    icon: Database, title: "Database",
    items: [
      { name: "PostgreSQL (Supabase)", note: "Supavisor session pooler" },
      { name: "Single schema", note: "public — no schema-per-tenant" },
      { name: "Drizzle migrations", note: "additive-only, 0001+ numbering" },
      { name: "numeric = string", note: "money columns wrap with Number()" },
      { name: "code SSOT", note: "lib/db/src/schema/*.ts is source of truth" },
    ],
  },
  {
    icon: Cloud, title: "Hosting & Edge",
    items: [
      { name: "Railway", note: "api-server (Node pinned; auto-deploy on main)" },
      { name: "Vercel", note: "guest web + property-admin (CI-gated deploy)" },
      { name: "Cloudinary", note: "documents & images; signed URLs + retention" },
      { name: "Resend", note: "transactional + marketing email" },
      { name: "SOLAPI", note: "SMS/알림톡 (per-instance keys)" },
    ],
  },
];

type EngineCard = { name: string; tag: string; desc: string };

const ENGINES: EngineCard[] = [
  { name: "Contract Issue Engine", tag: "Core", desc: "4-step wizard + mandatory form selection; online e-sign for ≤31-day terms; contract_related_costs fan-out." },
  { name: "Invoice / Billing", tag: "Core", desc: "insertInvoiceWithRef ref allocation, line editor + per-diem, VAT (공급가액/tax_amount), consolidated (단체) billing." },
  { name: "Accounting / GL", tag: "Core", desc: "Chart of Accounts, journal entries, payout legs (owner/partner/agent split), GL backfill." },
  { name: "Document Issuing", tag: "Core", desc: "Named by <고객ID>-<대상>-<서류종류>-<YYYYMMDD>; DOC_CODES + party_codes; preview modal, never bare download." },
  { name: "Lease Mode Switch", tag: "Core", desc: "lease_mode unifies long-term & short-term payment terms; booking → contract succession." },
  { name: "Work Orders / Dispatch", tag: "Module", desc: "Category taxonomy, partner auto-dispatch (category→specialty), SLA watchdog, photo evidence + billing." },
  { name: "Homestay Module", tag: "Module", desc: "Student ↔ host matching, e-sign intake, monthly rent billing; HOMESTAY_MODULE_ENABLED toggle." },
  { name: "Website CMS", tag: "Module", desc: "Native block builder on one site_key engine; multi-site pages, owner landing sites." },
  { name: "Marketing / Campaigns", tag: "Module", desc: "Resend send pipeline with suppression + consent gating; RESEND key DB-injected." },
  { name: "AI Gateway", tag: "Module", desc: "Every AI call routed through lib/ai task registry → metered into ai_usage_events; 3 vendors, runtime engine registration." },
  { name: "Partner Portals", tag: "Module", desc: "Agent / owner / service-host — unified /portal-login, cross-domain SSO handoff, per-role dashboards." },
  { name: "Privacy (APPs)", tag: "Core", desc: "Australian Privacy Principles — signed URLs, retention purge, DSAR deletion, NDB runbook; CI-enforced." },
];

const TAG_COLOR: Record<string, string> = {
  Core: "hsl(var(--primary))",
  Module: "#0369A1",
  New: "#059669",
};

/* ── Curated schema-linkage diagram (self-contained, theme-aware SVG) ───────── */
type DNode = { id: string; x: number; y: number; w: number; h: number; label: string; sub?: string };
type DEdge = { from: string; to: string; label?: string; dashed?: boolean };

const NODES: DNode[] = [
  { id: "account", x: 20, y: 34, w: 150, h: 52, label: "Account / Contact", sub: "Client · Owner · Agent" },
  { id: "property", x: 20, y: 150, w: 150, h: 52, label: "Property / Space", sub: "inventory · units" },
  { id: "booking", x: 250, y: 92, w: 140, h: 52, label: "Booking", sub: "short · long · homestay" },
  { id: "contract", x: 460, y: 92, w: 150, h: 52, label: "Contract", sub: "related_costs" },
  { id: "invoice", x: 690, y: 34, w: 170, h: 52, label: "Invoices", sub: "insertInvoiceWithRef" },
  { id: "gl", x: 690, y: 150, w: 170, h: 52, label: "GL / Journal", sub: "chart_of_accounts" },
  { id: "workorder", x: 460, y: 210, w: 150, h: 52, label: "Work Orders", sub: "dispatch · SLA" },
  { id: "commission", x: 690, y: 250, w: 170, h: 46, label: "Agent Commission", sub: "commission_ledger" },
];

const EDGES: DEdge[] = [
  { from: "account", to: "booking" },
  { from: "property", to: "booking", label: "space" },
  { from: "booking", to: "contract", label: "convert" },
  { from: "contract", to: "invoice" },
  { from: "invoice", to: "gl", label: "post" },
  { from: "contract", to: "workorder", dashed: true },
  { from: "contract", to: "commission" },
];

const nodeById = (id: string) => NODES.find((n) => n.id === id)!;
function edgePath(e: DEdge) {
  const a = nodeById(e.from), b = nodeById(e.to);
  const x1 = a.x + a.w, y1 = a.y + a.h / 2;
  const x2 = b.x, y2 = b.y + b.h / 2;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

function SchemaDiagram() {
  return (
    <div className="overflow-x-auto">
      <svg viewBox="0 0 880 310" className="w-full min-w-[720px]" style={{ height: "auto" }}>
        <defs>
          <marker id="sm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--muted-foreground))" />
          </marker>
        </defs>
        {EDGES.map((e, i) => {
          const a = nodeById(e.from), b = nodeById(e.to);
          const mx = (a.x + a.w + b.x) / 2;
          const my = (a.y + a.h / 2 + b.y + b.h / 2) / 2;
          return (
            <g key={i}>
              <path d={edgePath(e)} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5}
                    strokeDasharray={e.dashed ? "4 4" : undefined} markerEnd="url(#sm-arrow)" opacity={0.7} />
              {e.label && (
                <text x={mx} y={my - 4} textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))" style={{ fontStyle: "italic" }}>
                  {e.label}
                </text>
              )}
            </g>
          );
        })}
        {NODES.map((n) => (
          <g key={n.id}>
            <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={8}
                  fill="hsl(var(--primary) / 0.07)" stroke="hsl(var(--primary) / 0.45)" strokeWidth={1.5} />
            <text x={n.x + n.w / 2} y={n.y + (n.sub ? 21 : n.h / 2 + 4)} textAnchor="middle"
                  fontSize="12.5" fontWeight={700} fill="hsl(var(--foreground))">{n.label}</text>
            {n.sub && (
              <text x={n.x + n.w / 2} y={n.y + 37} textAnchor="middle" fontSize="9.5" fill="hsl(var(--muted-foreground))">{n.sub}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ── Overview tab ───────────────────────────────────────────────────────────── */

type OverviewData = {
  database: {
    engine: string; host: string; orm: string;
    totalTables: number; publicTables: number;
    appSchemas: { name: string; tableCount: number }[];
    migrationCount: number; latestMigrationAt: string | null;
    entityCounts: Record<string, number | null>;
  };
  generatedAt: string;
};

function MetricTile({ icon: Icon, label, value, sub }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; sub?: string;
}) {
  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </Card>
  );
}

const ENTITY_LABELS: Record<string, string> = {
  properties: "Properties", spaces: "Spaces", accounts: "Accounts", contacts: "Contacts",
  contracts: "Contracts", bookings: "Bookings", invoices: "Invoices", work_orders: "Work Orders",
};

function OverviewTab() {
  const [showDiagram, setShowDiagram] = useState(false);
  const { data, isLoading } = useQuery<OverviewData>({
    queryKey: ["system-map-overview"],
    queryFn: () => apiJson<OverviewData>("/api/v1/admin/system-map/overview"),
  });
  const db = data?.database;

  return (
    <div className="space-y-8">
      {/* Live metric strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricTile icon={Database} label="Total Tables"
          value={isLoading ? "…" : db?.totalTables ?? "—"}
          sub={db ? `${db.publicTables} in public` : ""} />
        <MetricTile icon={GitBranch} label="Migrations"
          value={isLoading ? "…" : db?.migrationCount || "—"}
          sub={db?.latestMigrationAt ? `latest ${new Date(db.latestMigrationAt).toLocaleDateString()}` : "drizzle ledger"} />
        <MetricTile icon={Boxes} label="Engines & Modules" value={ENGINES.length} sub="in-house" />
        <MetricTile icon={Cable} label="Scheduled Jobs" value={8} sub="node-cron" />
      </div>

      {/* Technology stack */}
      <div>
        <SectionTitle icon={Layers}>Technology Stack</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {TECH_STACK.map((layer) => (
            <Card key={layer.title} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <layer.icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-bold text-foreground">{layer.title}</p>
              </div>
              <ul className="space-y-2">
                {layer.items.map((it) => (
                  <li key={it.name}>
                    <p className="text-[13px] font-medium text-foreground leading-tight">{it.name}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">{it.note}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </div>

      {/* Database */}
      <div>
        <SectionTitle icon={Database}>Database</SectionTitle>
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mb-4">
            <Fact label="Engine" value={db?.engine ?? "PostgreSQL"} />
            <Fact label="Host" value={db?.host ?? "Supabase"} />
            <Fact label="ORM" value={db?.orm ?? "Drizzle"} />
            <Fact label="Tables" value={isLoading ? "…" : String(db?.totalTables ?? "—")} />
            <Fact label="Migrations" value={isLoading ? "…" : String(db?.migrationCount ?? "—")} />
          </div>

          {/* Live entity counts */}
          {db?.entityCounts && (
            <div className="mb-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Core entities (live row counts)</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(db.entityCounts).map(([k, v]) => (
                  <span key={k} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border bg-muted/40">
                    <span className="font-semibold text-foreground">{ENTITY_LABELS[k] ?? k}</span>
                    <span className="text-muted-foreground">{v == null ? "—" : v.toLocaleString()}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => setShowDiagram((v) => !v)}
            className="flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline">
            {showDiagram ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Network className="h-3.5 w-3.5" /> Domain flow diagram
          </button>
          {showDiagram && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-[11px] text-muted-foreground mb-3">
                Core domain flow — how the main entities connect across the booking → contract → invoice → GL pipeline.
              </p>
              <SchemaDiagram />
            </div>
          )}
        </Card>
      </div>

      {/* Engines & modules */}
      <div>
        <SectionTitle icon={Boxes}>In-house Engines & Modules</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ENGINES.map((e) => (
            <Card key={e.name} className="p-4">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-[13px] font-bold text-foreground leading-tight">{e.name}</p>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 text-white"
                      style={{ background: TAG_COLOR[e.tag] ?? "hsl(var(--muted-foreground))" }}>{e.tag}</span>
              </div>
              <p className="text-[11.5px] text-muted-foreground leading-snug">{e.desc}</p>
            </Card>
          ))}
        </div>
      </div>

      {data?.generatedAt && (
        <p className="text-[11px] text-muted-foreground text-center">
          Live data generated {new Date(data.generatedAt).toLocaleString()} · curated maps maintained in SystemMap.tsx
        </p>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-0.5">{value}</p>
    </div>
  );
}

/* ── Shell — tab bar over the System Map sub-views ──────────────────────────── */

const SYSTEM_QUERY_PREFIXES = ["system-map"];

export default function SystemMap() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tab, setTab] = useState<"overview" | "integrations" | "jobs" | "api" | "schema">("overview");
  const qc = useQueryClient();

  const isSuperAdmin =
    !!user && ["Super Admin", "SuperAdmin", "superadmin", "super_admin"].includes(user.role);

  const isSystemQuery = (key: unknown) =>
    typeof key === "string" && SYSTEM_QUERY_PREFIXES.some((p) => key.startsWith(p));
  const fetching = useIsFetching({ predicate: (q) => isSystemQuery(q.queryKey[0]) });
  const refreshAll = () => qc.invalidateQueries({ predicate: (q) => isSystemQuery(q.queryKey[0]) });

  // Feed the Schema browser the list of real schemas from the overview payload.
  const { data: overview } = useQuery<OverviewData>({
    queryKey: ["system-map-overview"],
    queryFn: () => apiJson<OverviewData>("/api/v1/admin/system-map/overview"),
    enabled: isSuperAdmin,
  });
  const schemas = Array.from(new Set<string>(["public", ...((overview?.database.appSchemas ?? []).map((s) => s.name))]));

  const TABS = [
    { key: "overview", label: t("system_map.tab_overview"), icon: LayoutGrid },
    { key: "integrations", label: t("system_map.tab_integrations"), icon: Plug },
    { key: "jobs", label: t("system_map.tab_jobs"), icon: Clock },
    { key: "api", label: t("system_map.tab_api"), icon: Route },
    { key: "schema", label: t("system_map.tab_schema"), icon: Table2 },
  ] as const;

  if (user && !isSuperAdmin) return <Redirect to="/settings" />;

  return (
    <Layout>
      <PageHeader
        title={
          <>
            <Cpu className="h-5 w-5" />
            {t("system_map.title")}
          </>
        }
        subtitle={t("system_map.subtitle")}
        actions={
          <button
            onClick={refreshAll}
            disabled={fetching > 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border bg-card text-[13px] font-medium text-muted-foreground hover:border-primary/40 transition-colors shrink-0 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${fetching > 0 ? "animate-spin text-primary" : ""}`} />
            {fetching > 0 ? t("system_map.refreshing") : t("system_map.refresh")}
          </button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            );
          })}
        </div>

        {tab === "overview" && <OverviewTab />}
        {tab === "integrations" && <SystemIntegrations />}
        {tab === "jobs" && <SystemJobs />}
        {tab === "api" && <SystemApi />}
        {tab === "schema" && <SystemSchema schemas={schemas} />}
      </div>
    </Layout>
  );
}

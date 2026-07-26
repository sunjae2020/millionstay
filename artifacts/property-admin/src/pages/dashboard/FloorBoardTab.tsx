import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { apiFetch } from "@/lib/apiFetch";
import { Building2, LayoutGrid, Users, DoorOpen, Home, Tag } from "lucide-react";
import { KpiCard, DashCard } from "@/components/dashboard/DashboardKit";

interface Unit {
  id: number;
  name: string;
  unit_label: string;
  floor: number;
  type: string;
  status: string;
  owner: string | null;
  owner_id: number | null;
}
interface KeyCount { key: string; count: number; id?: number | null }
interface PropOption { id: number; name: string; unit_count: number }
interface FloorBoard {
  property_id: number | null;
  property_name: string | null;
  available_properties: PropOption[];
  floors: number[];
  types: string[];
  units: Unit[];
  summary: { total: number; by_status: KeyCount[]; by_owner: KeyCount[]; by_type: KeyCount[] };
}

type Dimension = "status" | "owner";

/** Known status → stable palette colour (data values are Korean in Metheim). */
const STATUS_COLORS: Record<string, string> = {
  공실: "#94a3b8",
  임대: "#16a34a",
  임대중: "#16a34a",
  분양: "#2563eb",
  대여: "#d97706",
  임대불가: "#dc2626",
  Active: "#16a34a",
  Inactive: "#cbd5e1",
};

/** Slug for i18n of known statuses; unknown values render verbatim. */
const STATUS_SLUG: Record<string, string> = {
  공실: "vacant",
  임대: "leased",
  임대중: "leased",
  분양: "sold",
  대여: "rented_out",
  임대불가: "unavailable",
  Active: "active",
  Inactive: "inactive",
};

const PALETTE = [
  "#E8621A", "#2563eb", "#16a34a", "#7c3aed", "#d97706", "#dc2626",
  "#14b8a6", "#ec4899", "#4f46e5", "#0891b2", "#65a30d", "#9333ea",
  "#e11d48", "#0d9488", "#ca8a04", "#64748b",
];

export default function FloorBoardTab() {
  const { t } = useTranslation();
  const [board, setBoard] = useState<FloorBoard | null>(null);
  const [pid, setPid] = useState<number | null>(null);
  const [dim, setDim] = useState<Dimension>("status");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = pid != null ? `?property_id=${pid}` : "";
    apiFetch(`/api/v1/dashboard/floor-board${qs}`)
      .then((r) => r.json())
      .then((b: FloorBoard) => {
        setBoard(b);
        if (pid == null && b.property_id != null) setPid(b.property_id);
      })
      .catch(() => setBoard(null))
      .finally(() => setLoading(false));
  }, [pid]);

  const statusLabel = (raw: string) => {
    const slug = STATUS_SLUG[raw];
    return slug ? t(`dash_floorboard.status_${slug}`, raw) : raw;
  };

  // Colour map for the active dimension.
  const legend = dim === "status" ? board?.summary.by_status ?? [] : board?.summary.by_owner ?? [];
  const colorByKey = useMemo(() => {
    const map = new Map<string, string>();
    legend.forEach((row, i) => {
      const c = dim === "status" ? STATUS_COLORS[row.key] ?? PALETTE[i % PALETTE.length] : PALETTE[i % PALETTE.length];
      map.set(row.key, c);
    });
    return map;
  }, [legend, dim]);

  const keyOf = (u: Unit) => (dim === "status" ? u.status : u.owner ?? "—");
  const labelOfKey = (k: string) => (dim === "status" ? statusLabel(k) : k);

  // floor → type → units, for O(1) cell lookup.
  const cellIndex = useMemo(() => {
    const m = new Map<string, Unit[]>();
    for (const u of board?.units ?? []) {
      const k = `${u.floor}|${u.type}`;
      const arr = m.get(k);
      if (arr) arr.push(u);
      else m.set(k, [u]);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        const na = Number(a.unit_label), nb = Number(b.unit_label);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        return a.unit_label.localeCompare(b.unit_label);
      });
    }
    return m;
  }, [board]);

  const floorTotals = useMemo(() => {
    const m = new Map<number, number>();
    for (const u of board?.units ?? []) m.set(u.floor, (m.get(u.floor) ?? 0) + 1);
    return m;
  }, [board]);

  const props = board?.available_properties ?? [];
  const floors = board?.floors ?? [];
  const types = board?.types ?? [];
  const total = board?.summary.total ?? 0;

  const statusCount = (raw: string) => board?.summary.by_status.find((s) => s.key === raw)?.count ?? 0;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">{t("dash_floorboard.title", "Floor board")}</h2>
            <p className="text-xs text-muted-foreground">{t("dash_floorboard.subtitle", "Every unit by floor and type")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {props.length > 1 && (
            <select
              value={pid ?? ""}
              onChange={(e) => { setPid(Number(e.target.value)); setHighlight(null); }}
              className="h-8 rounded-lg border bg-card px-2 text-xs font-medium"
            >
              {props.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.unit_count})</option>
              ))}
            </select>
          )}
          {/* Colour-by toggle */}
          <div className="inline-flex rounded-lg border bg-muted p-0.5 text-xs font-medium">
            {(["status", "owner"] as Dimension[]).map((d) => (
              <button
                key={d}
                onClick={() => { setDim(d); setHighlight(null); }}
                className={`px-3 py-1.5 rounded-md transition-all ${dim === d ? "bg-card shadow-sm text-primary font-semibold" : "text-muted-foreground hover:text-foreground"}`}
              >
                {d === "status" ? t("dash_floorboard.by_status", "By status") : t("dash_floorboard.by_owner", "By owner")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label={t("dash_floorboard.kpi_total", "Total units")} value={total || "—"} icon={LayoutGrid} accent="brand" sublabel={board?.property_name ?? undefined} />
        <KpiCard label={statusLabel("공실")} value={statusCount("공실") || 0} icon={DoorOpen} accent="slate" />
        <KpiCard label={statusLabel("임대")} value={statusCount("임대") || 0} icon={Home} accent="green" />
        <KpiCard label={statusLabel("분양")} value={statusCount("분양") || 0} icon={Tag} accent="blue" />
      </div>

      {/* Legend */}
      {legend.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">
            {dim === "status" ? <Tag className="inline h-3.5 w-3.5" /> : <Users className="inline h-3.5 w-3.5" />}
          </span>
          {legend.map((row) => {
            const on = highlight === row.key;
            const dimmed = highlight != null && !on;
            return (
              <button
                key={row.key}
                onClick={() => setHighlight(on ? null : row.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium transition-all ${on ? "ring-2 ring-primary/40" : ""} ${dimmed ? "opacity-40" : ""}`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorByKey.get(row.key) }} />
                <span className="max-w-[160px] truncate">{labelOfKey(row.key)}</span>
                <span className="text-muted-foreground">{row.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Matrix */}
      <DashCard bodyClass="p-0">
        {loading ? (
          <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">{t("dash_floorboard.loading", "Loading…")}</div>
        ) : total === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-center px-6">
            <Building2 className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t("dash_floorboard.empty", "No floor-numbered units for this property.")}</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[70vh]">
            <table className="border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-30 bg-card border-b border-r px-3 py-2 text-left font-semibold min-w-[52px]">
                    {t("dash_floorboard.floor", "Floor")}
                  </th>
                  {types.map((ty) => (
                    <th key={ty} className="sticky top-0 z-20 bg-card border-b border-r px-3 py-2 text-center font-semibold whitespace-nowrap min-w-[120px]">
                      {ty}
                    </th>
                  ))}
                  <th className="sticky right-0 top-0 z-30 bg-card border-b px-3 py-2 text-center font-semibold min-w-[52px]">
                    {t("dash_floorboard.sum", "Sum")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {floors.map((fl) => (
                  <tr key={fl} className="group">
                    <th className="sticky left-0 z-10 bg-card group-hover:bg-muted/40 border-b border-r px-3 py-2 text-left font-semibold whitespace-nowrap">
                      {fl}F
                    </th>
                    {types.map((ty) => {
                      const cells = cellIndex.get(`${fl}|${ty}`) ?? [];
                      return (
                        <td key={ty} className="align-top border-b border-r px-2 py-2">
                          <div className="flex flex-wrap gap-1">
                            {cells.map((u) => {
                              const k = keyOf(u);
                              const color = colorByKey.get(k) ?? "#94a3b8";
                              const dimmed = highlight != null && highlight !== k;
                              return (
                                <Link
                                  key={u.id}
                                  href={`/property/spaces/${u.id}`}
                                  title={`${u.name} · ${u.type} · ${statusLabel(u.status)}${u.owner ? ` · ${u.owner}` : ""}`}
                                  className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold text-white leading-none transition-all hover:scale-110 hover:ring-2 hover:ring-primary/40 ${dimmed ? "opacity-25" : ""}`}
                                  style={{ background: color }}
                                >
                                  {u.unit_label}
                                </Link>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                    <td className="sticky right-0 z-10 bg-card group-hover:bg-muted/40 border-b px-3 py-2 text-center font-semibold text-muted-foreground">
                      {floorTotals.get(fl) ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th className="sticky left-0 bottom-0 z-30 bg-muted border-t border-r px-3 py-2 text-left font-bold">
                    {t("dash_floorboard.sum", "Sum")}
                  </th>
                  {types.map((ty) => {
                    const n = board?.summary.by_type.find((x) => x.key === ty)?.count ?? 0;
                    return (
                      <th key={ty} className="sticky bottom-0 z-20 bg-muted border-t border-r px-3 py-2 text-center font-bold">
                        {n}
                      </th>
                    );
                  })}
                  <th className="sticky right-0 bottom-0 z-30 bg-muted border-t px-3 py-2 text-center font-bold text-primary">
                    {total}
                  </th>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </DashCard>

      <p className="text-[11px] text-muted-foreground">
        {t("dash_floorboard.hint", "Click a unit to open its detail. Click a legend chip to highlight.")}
      </p>
    </div>
  );
}

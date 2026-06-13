import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiGet, apiPost, apiDelete, ApiError } from "@/lib/api";
import { ChevronLeft, ChevronRight, Ban, Sun, RotateCcw, CalendarOff } from "lucide-react";

/* ── types ── */
interface SpaceLite { id: number; name: string; space_type: string | null; status: string }
interface PropertyWithSpaces { id: number; name: string; spaces: SpaceLite[] }

type DayStatus = "available" | "booked" | "blocked" | "short_term";
interface CalDay {
  date: string;
  status: DayStatus;
  booking_ref: string | null;
  tenant: string | null;
  block_reason: string | null;
  daily_rate: string | null;
  currency: string | null;
}
interface SpaceCalendar { space_id: number; space_name: string; days: CalDay[] }

/* ── local date helpers (avoid UTC drift) ── */
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function buildGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay()); // back up to Sunday
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

const STATUS_CELL: Record<DayStatus, string> = {
  available: "bg-card hover:bg-muted/60 text-foreground border-border",
  booked: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
  blocked: "bg-slate-200 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
  short_term: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300",
};

export function OccupancyCalendar() {
  const { t } = useTranslation();
  const [properties, setProperties] = useState<PropertyWithSpaces[]>([]);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [spaceId, setSpaceId] = useState<number | null>(null);

  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const [days, setDays] = useState<Map<string, CalDay>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dailyRate, setDailyRate] = useState("");
  const [busy, setBusy] = useState(false);

  const grid = useMemo(() => buildGrid(cursor.year, cursor.month), [cursor]);

  // Load owner's properties + spaces for the pickers.
  useEffect(() => {
    apiGet<{ success: boolean; data: PropertyWithSpaces[] }>("/v1/owner/properties")
      .then((d) => {
        setProperties(d.data);
        const firstProp = d.data.find((p) => p.spaces.length > 0) ?? d.data[0];
        if (firstProp) {
          setPropertyId(firstProp.id);
          setSpaceId(firstProp.spaces[0]?.id ?? null);
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  const spacesForProperty = useMemo(
    () => properties.find((p) => p.id === propertyId)?.spaces ?? [],
    [properties, propertyId],
  );

  // Fetch calendar for the visible grid range whenever the space or month changes.
  function reload() {
    if (!spaceId) { setDays(new Map()); return; }
    const from = toISO(grid[0]);
    const to = toISO(grid[grid.length - 1]);
    setLoading(true);
    apiGet<{ success: boolean; data: { spaces: SpaceCalendar[] } }>(
      `/v1/owner/calendar?from=${from}&to=${to}&space_id=${spaceId}`,
    )
      .then((d) => {
        const sc = d.data.spaces[0];
        setDays(new Map((sc?.days ?? []).map((x) => [x.date, x])));
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { reload(); setSelected(new Set()); /* eslint-disable-next-line */ }, [spaceId, cursor]);

  function toggleDay(iso: string) {
    const day = days.get(iso);
    if (day?.status === "booked") return; // can't act on an occupied date
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(iso) ? next.delete(iso) : next.add(iso);
      return next;
    });
  }

  async function runAction(fn: () => Promise<unknown>) {
    if (!spaceId || selected.size === 0) return;
    setBusy(true);
    try {
      await fn();
      setSelected(new Set());
      setDailyRate("");
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const dates = () => [...selected].sort();
  const doBlock = () => runAction(() => apiPost(`/v1/owner/spaces/${spaceId}/block`, { dates: dates(), reason: "Owner block" }));
  const doUnblock = () => runAction(() => apiPost(`/v1/owner/spaces/${spaceId}/unblock`, { dates: dates() }));
  const doConvert = () => runAction(() => apiPost(`/v1/owner/spaces/${spaceId}/term`, { dates: dates(), daily_rate: dailyRate || undefined }));
  const doClearTerm = () => runAction(() => apiDelete(`/v1/owner/spaces/${spaceId}/term`, { dates: dates() }));

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const weekdays = useMemo(() => {
    const base = new Date(2024, 0, 7); // a Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d.toLocaleDateString(undefined, { weekday: "short" });
    });
  }, []);

  return (
    <div className="space-y-4">
      {/* Pickers + month nav */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={propertyId ?? ""}
          onChange={(e) => {
            const pid = Number(e.target.value);
            setPropertyId(pid);
            const sp = properties.find((p) => p.id === pid)?.spaces ?? [];
            setSpaceId(sp[0]?.id ?? null);
          }}
          className="px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select
          value={spaceId ?? ""}
          onChange={(e) => setSpaceId(Number(e.target.value))}
          className="px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {spacesForProperty.length === 0 && <option value="">{t("calendar.no_spaces")}</option>}
          {spacesForProperty.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => setCursor((c) => { const m = c.month - 1; return m < 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: m }; })}
            className="p-2 rounded-lg border border-input hover:bg-muted/60" aria-label="prev">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-sm font-medium text-foreground w-36 text-center">{monthLabel}</div>
          <button onClick={() => setCursor((c) => { const m = c.month + 1; return m > 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: m }; })}
            className="p-2 rounded-lg border border-input hover:bg-muted/60" aria-label="next">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg border border-destructive/20">{error}</div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {(["available", "booked", "blocked", "short_term"] as DayStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={`inline-block w-3 h-3 rounded-sm border ${STATUS_CELL[s]}`} />
            {t(`calendar.legend.${s}`)}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="bg-card border border-card-border rounded-xl p-3 relative">
        {loading && (
          <div className="absolute inset-0 bg-card/60 flex items-center justify-center text-sm text-muted-foreground rounded-xl z-10">
            {t("common.loading")}
          </div>
        )}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekdays.map((w, i) => (
            <div key={i} className="text-center text-xs font-medium text-muted-foreground py-1">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((d) => {
            const iso = toISO(d);
            const inMonth = d.getMonth() === cursor.month;
            const day = days.get(iso);
            const status: DayStatus = day?.status ?? "available";
            const isSel = selected.has(iso);
            const clickable = status !== "booked";
            return (
              <button
                key={iso}
                onClick={() => clickable && toggleDay(iso)}
                disabled={!clickable}
                title={
                  status === "booked" ? `${day?.tenant ?? ""} ${day?.booking_ref ?? ""}`.trim()
                  : status === "short_term" ? `${t("calendar.legend.short_term")}${day?.daily_rate ? ` · ${day.currency ?? ""} ${day.daily_rate}` : ""}`
                  : status === "blocked" ? day?.block_reason ?? t("calendar.legend.blocked")
                  : ""
                }
                className={`min-h-[60px] rounded-lg border text-left p-1.5 transition-colors ${STATUS_CELL[status]} ${!inMonth ? "opacity-40" : ""} ${isSel ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""} ${clickable ? "cursor-pointer" : "cursor-not-allowed"}`}
              >
                <div className="text-xs font-medium">{d.getDate()}</div>
                {status === "booked" && (
                  <div className="text-[10px] mt-0.5 truncate">{day?.tenant ?? t("calendar.legend.booked")}</div>
                )}
                {status === "short_term" && day?.daily_rate && (
                  <div className="text-[10px] mt-0.5 truncate">{day.currency ?? "$"} {day.daily_rate}</div>
                )}
                {status === "blocked" && (
                  <div className="text-[10px] mt-0.5 truncate">{t("calendar.legend.blocked")}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action bar */}
      <div className="bg-card border border-card-border rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {selected.size > 0 ? t("calendar.selected_count", { count: selected.size }) : t("calendar.select_hint")}
          </span>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <button onClick={doBlock} disabled={busy || selected.size === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-slate-700">
              <Ban className="w-4 h-4" /> {t("calendar.action.block")}
            </button>
            <button onClick={doUnblock} disabled={busy || selected.size === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-input text-foreground text-sm font-medium disabled:opacity-40 hover:bg-muted/60">
              <RotateCcw className="w-4 h-4" /> {t("calendar.action.unblock")}
            </button>
            <div className="flex items-center gap-1.5">
              <input
                type="number" min="0" step="1" inputMode="decimal"
                value={dailyRate}
                onChange={(e) => setDailyRate(e.target.value)}
                placeholder={t("calendar.daily_rate")}
                className="w-28 px-2.5 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button onClick={doConvert} disabled={busy || selected.size === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium disabled:opacity-40 hover:bg-orange-600">
                <Sun className="w-4 h-4" /> {t("calendar.action.convert")}
              </button>
            </div>
            <button onClick={doClearTerm} disabled={busy || selected.size === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-input text-foreground text-sm font-medium disabled:opacity-40 hover:bg-muted/60">
              <CalendarOff className="w-4 h-4" /> {t("calendar.action.clear_term")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

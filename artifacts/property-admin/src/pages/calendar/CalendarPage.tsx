import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/apiFetch";
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from "lucide-react";

/** Mirrors the api-server CalendarEvent projection. */
interface CalendarEvent {
  id: string;
  source: "work_orders" | "tasks" | "contracts" | "bookings" | "invoices";
  kind: string;
  title: string;
  start: string;
  end?: string | null;
  all_day: boolean;
  status?: string | null;
  url: string;
  ref?: string | null;
  space_name?: string | null;
  assignee?: string | null;
  amount?: number | null;
  currency?: string | null;
}

type Source = CalendarEvent["source"];

/**
 * 청구·수납은 건수가 많아 기본 숨김 — 나머지는 켠 상태로 시작한다.
 * (선택 상태는 localStorage 에 남아 다음 방문에도 유지된다.)
 */
const SOURCE_DEFAULTS: Record<Source, boolean> = {
  work_orders: true,
  tasks: true,
  contracts: true,
  bookings: true,
  invoices: false,
};

const SOURCE_COLORS: Record<Source, { dot: string; chip: string }> = {
  work_orders: { dot: "bg-orange-500", chip: "bg-orange-50 text-orange-800 border-orange-200" },
  tasks: { dot: "bg-slate-500", chip: "bg-slate-50 text-slate-700 border-slate-200" },
  contracts: { dot: "bg-emerald-600", chip: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  bookings: { dot: "bg-blue-600", chip: "bg-blue-50 text-blue-800 border-blue-200" },
  invoices: { dot: "bg-purple-600", chip: "bg-purple-50 text-purple-800 border-purple-200" },
};

/**
 * 계약금·중도금·잔금 입금 예정일은 계약/예약과 같은 소스로 오지만 성격이 달라
 * (돈이 오가는 날) 한눈에 갈라 보이도록 별도 색을 쓴다. 계약일은 소스 색 유지.
 */
const MONEY_KINDS = new Set(["down_payment", "interim_payment", "balance"]);
const MONEY_CHIP = "bg-amber-50 text-amber-900 border-amber-200";
const chipClass = (ev: CalendarEvent) =>
  MONEY_KINDS.has(ev.kind) ? MONEY_CHIP : SOURCE_COLORS[ev.source].chip;

const STORAGE_KEY = "admin.calendar.sources";

function loadSources(): Record<Source, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...SOURCE_DEFAULTS, ...JSON.parse(raw) };
  } catch { /* corrupt value → fall back to defaults */ }
  return { ...SOURCE_DEFAULTS };
}

/** "YYYY-MM-DD" in local time (never via toISOString, which shifts to UTC). */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The 6-week grid (Mon-first) covering the given month. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export default function CalendarPage() {
  const { t, i18n } = useTranslation();
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [sources, setSources] = useState<Record<Source, boolean>>(loadSources);
  const [selectedDay, setSelectedDay] = useState<string | null>(ymd(today));

  const days = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const from = ymd(days[0]!);
  const to = ymd(days[days.length - 1]!);
  const active = (Object.keys(sources) as Source[]).filter((s) => sources[s]);

  const { data, isLoading } = useQuery({
    queryKey: ["calendar-events", from, to, active.join(",")],
    queryFn: () => apiJson<{ data: CalendarEvent[] }>(
      `/api/v1/calendar/events?from=${from}&to=${to}&sources=${active.join(",")}`,
    ).then((r) => r.data ?? []),
    enabled: active.length > 0,
  });

  const byDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of data ?? []) {
      // Timed events carry an instant; all-day ones already a date string.
      const key = ev.all_day ? ev.start.slice(0, 10) : ymd(new Date(ev.start));
      (map[key] ??= []).push(ev);
    }
    return map;
  }, [data]);

  const toggle = (s: Source) => {
    const next = { ...sources, [s]: !sources[s] };
    setSources(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  };

  const monthLabel = new Intl.DateTimeFormat(i18n.language, { year: "numeric", month: "long" }).format(cursor);
  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(i18n.language, { weekday: "short" });
    // 2024-01-01 was a Monday.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
  }, [i18n.language]);

  const timeLabel = (ev: CalendarEvent) =>
    ev.all_day ? null : new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit" }).format(new Date(ev.start));

  const selectedEvents = selectedDay ? (byDay[selectedDay] ?? []) : [];

  return (
    <Layout>
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" /> {t("calendar.title", "업무 캘린더")}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-32 text-center text-sm font-semibold">{monthLabel}</span>
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(ymd(today)); }}>
              {t("calendar.today", "오늘")}
            </Button>
            <Link href="/maintenance/work-orders/new">
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />{t("calendar.new_visit", "방문 잡기")}</Button>
            </Link>
          </div>
        </div>

        {/* 표시 항목 — 업무별 체크박스 */}
        <div className="flex flex-wrap items-center gap-4 border rounded-lg bg-white px-4 py-3 mb-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("calendar.show", "표시 항목")}
          </span>
          {(Object.keys(SOURCE_DEFAULTS) as Source[]).map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={sources[s]} onChange={() => toggle(s)} className="h-4 w-4 rounded border-gray-300" />
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${SOURCE_COLORS[s].dot}`} />
              {t(`calendar.source_${s}`, s)}
            </label>
          ))}
          {isLoading && <span className="text-xs text-muted-foreground ml-auto">{t("common.loading", "불러오는 중…")}</span>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* 월 그리드 */}
          <div className="border rounded-lg bg-white overflow-hidden">
            <div className="grid grid-cols-7 border-b bg-gray-50">
              {weekdays.map((w, i) => (
                <div key={w} className={`px-2 py-2 text-xs font-semibold text-center ${i === 6 ? "text-red-600" : i === 5 ? "text-blue-600" : "text-muted-foreground"}`}>{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const key = ymd(d);
                const inMonth = d.getMonth() === cursor.getMonth();
                const isToday = key === ymd(today);
                const dayEvents = byDay[key] ?? [];
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setSelectedDay(key)}
                    className={`min-h-24 border-b border-r p-1.5 text-left align-top transition-colors
                      ${inMonth ? "bg-white" : "bg-gray-50/60"}
                      ${selectedDay === key ? "ring-2 ring-inset ring-primary" : "hover:bg-gray-50"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${isToday ? "bg-primary text-white rounded-full px-1.5 py-0.5" : inMonth ? "" : "text-muted-foreground"}`}>
                        {d.getDate()}
                      </span>
                      {dayEvents.length > 3 && <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 3}</span>}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <div key={ev.id} className={`truncate rounded border px-1 py-0.5 text-[11px] leading-tight ${chipClass(ev)}`}>
                          {timeLabel(ev) ? `${timeLabel(ev)} ` : ""}{ev.title}
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 선택한 날짜의 일정 */}
          <div className="border rounded-lg bg-white p-4 h-fit">
            <h2 className="text-sm font-semibold uppercase text-primary tracking-wide mb-3">
              {selectedDay
                ? new Intl.DateTimeFormat(i18n.language, { dateStyle: "full" }).format(new Date(`${selectedDay}T00:00:00`))
                : t("calendar.pick_day", "날짜를 선택하세요")}
            </h2>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("calendar.no_events", "이 날짜에는 일정이 없습니다.")}</p>
            ) : (
              <ul className="space-y-2">
                {selectedEvents.map((ev) => (
                  <li key={ev.id}>
                    <Link href={ev.url}>
                      <div className={`rounded border px-3 py-2 hover:opacity-80 ${chipClass(ev)}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{ev.title}</span>
                          {timeLabel(ev) && <span className="text-xs whitespace-nowrap">{timeLabel(ev)}</span>}
                        </div>
                        <div className="text-xs opacity-80 mt-0.5 space-x-2">
                          {ev.space_name && <span>{ev.space_name}</span>}
                          {ev.assignee && <span>· {ev.assignee}</span>}
                          {ev.ref && <span className="font-mono">· {ev.ref}</span>}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

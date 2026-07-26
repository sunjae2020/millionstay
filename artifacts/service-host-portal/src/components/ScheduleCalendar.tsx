import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/lib/dateFormat";
import { ChevronLeft, ChevronRight, MapPin, Clock } from "lucide-react";

export interface CalendarItem {
  id: number;
  service_name: string;
  billing_trigger: string;
  total_price: string;
  currency: string;
  booking_ref: string | null;
  booking_status: string | null;
  property_name: string | null;
  space_name: string | null;
  scheduled_date: string | null;
}

interface Props {
  items: CalendarItem[];
  compact?: boolean;
  onItemClick?: (item: CalendarItem) => void;
}

const TRIGGER_DOT: Record<string, string> = {
  at_checkin: "bg-green-500",
  at_checkout: "bg-orange-500",
  at_booking: "bg-blue-500",
};

const TRIGGER_BG: Record<string, string> = {
  at_checkin: "bg-green-100 text-green-800 border-green-300",
  at_checkout: "bg-orange-100 text-orange-800 border-orange-300",
  at_booking: "bg-blue-100 text-blue-800 border-blue-300",
};

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildMonthGrid(viewDate: Date) {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const startDow = first.getDay();
  const start = new Date(first);
  start.setDate(first.getDate() - startDow);

  const days: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push({ date: d, inMonth: d.getMonth() === viewDate.getMonth() });
  }
  return days;
}

export function ScheduleCalendar({ items, compact = false, onItemClick }: Props) {
  const { t, i18n } = useTranslation();
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selected, setSelected] = useState<string | null>(() => ymd(new Date()));

  const itemsByDay = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};
    for (const it of items) {
      if (!it.scheduled_date) continue;
      const key = ymd(new Date(it.scheduled_date));
      if (!map[key]) map[key] = [];
      map[key].push(it);
    }
    return map;
  }, [items]);

  const grid = useMemo(() => buildMonthGrid(viewDate), [viewDate]);
  const todayKey = ymd(new Date());
  const locale = i18n.language || "en";
  const monthLabel = viewDate.toLocaleDateString(locale, { month: "long", year: "numeric" });

  const dayHeaders = useMemo(() => {
    const result: string[] = [];
    const ref = new Date(2024, 0, 7); // Sunday
    for (let i = 0; i < 7; i++) {
      const d = new Date(ref);
      d.setDate(ref.getDate() + i);
      result.push(d.toLocaleDateString(locale, { weekday: "short" }));
    }
    return result;
  }, [locale]);

  const selectedItems = selected ? itemsByDay[selected] ?? [] : [];

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
        <button
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
          aria-label={t("schedule.prev_month")}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-foreground">{monthLabel}</h3>
          <button
            onClick={() => { const td = new Date(); setViewDate(new Date(td.getFullYear(), td.getMonth(), 1)); setSelected(ymd(td)); }}
            className="text-xs text-primary hover:underline"
          >
            {t("schedule.today")}
          </button>
        </div>
        <button
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
          aria-label={t("schedule.next_month")}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/10 border-b border-border">
        {dayHeaders.map((d, i) => (
          <div key={i} className="py-2">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 border-b border-border">
        {grid.map((cell, i) => {
          const key = ymd(cell.date);
          const dayItems = itemsByDay[key] ?? [];
          const isToday = key === todayKey;
          const isSelected = key === selected;
          const cellH = compact ? "min-h-[58px]" : "min-h-[88px]";
          return (
            <button
              key={i}
              onClick={() => setSelected(key)}
              className={`${cellH} text-left p-1.5 border-r border-b border-border last:border-r-0 transition-colors ${
                cell.inMonth ? "bg-card hover:bg-muted/40" : "bg-muted/20 text-muted-foreground/60"
              } ${isSelected ? "ring-2 ring-primary ring-inset" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-semibold inline-flex items-center justify-center w-5 h-5 rounded-full ${
                    isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                  }`}
                >
                  {cell.date.getDate()}
                </span>
                {dayItems.length > 0 && (
                  <span className="text-[9px] font-bold text-muted-foreground">
                    {dayItems.length}
                  </span>
                )}
              </div>
              <div className="mt-1 space-y-0.5">
                {compact ? (
                  <div className="flex flex-wrap gap-0.5">
                    {dayItems.slice(0, 4).map((it) => (
                      <span key={it.id} className={`w-1.5 h-1.5 rounded-full ${TRIGGER_DOT[it.billing_trigger] ?? "bg-gray-400"}`} />
                    ))}
                  </div>
                ) : (
                  <>
                    {dayItems.slice(0, 2).map((it) => (
                      <div
                        key={it.id}
                        className={`text-[10px] truncate px-1 py-0.5 rounded border ${TRIGGER_BG[it.billing_trigger] ?? "bg-gray-100 text-gray-700 border-gray-300"}`}
                      >
                        {it.service_name}
                      </div>
                    ))}
                    {dayItems.length > 2 && (
                      <div className="text-[10px] text-muted-foreground px-1">{t("earnings.more_count", { count: dayItems.length - 2 })}</div>
                    )}
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-foreground">
            {selected
              ? formatDate(selected)
              : t("schedule.select_date")}
          </p>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />{t("trigger.checkin")}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />{t("trigger.checkout")}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />{t("trigger.booking")}</span>
          </div>
        </div>
        {selectedItems.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center bg-muted/30 rounded-lg">
            {t("schedule.no_jobs_day")}
          </div>
        ) : (
          <div className="space-y-2">
            {selectedItems.map((it) => (
              <div
                key={it.id}
                onClick={() => onItemClick?.(it)}
                className={`px-3 py-2 rounded-lg border bg-card hover:bg-muted/40 transition-colors ${onItemClick ? "cursor-pointer" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${TRIGGER_BG[it.billing_trigger] ?? "bg-gray-100 text-gray-700 border-gray-300"}`}>
                        {t(`trigger.${it.billing_trigger.replace("at_", "")}`, it.billing_trigger)}
                      </span>
                      <span className="text-sm font-semibold text-foreground truncate">{it.service_name}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      {it.property_name && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {it.property_name}{it.space_name ? ` · ${it.space_name}` : ""}
                        </span>
                      )}
                      {it.booking_ref && <span className="font-mono text-primary">{it.booking_ref}</span>}
                      {it.booking_status && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />{t(`status.${it.booking_status}`, it.booking_status)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-foreground">${parseFloat(it.total_price).toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">{it.currency}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

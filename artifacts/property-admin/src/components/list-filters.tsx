/**
 * 리스트 화면 공통 검색 부품.
 *
 * 44개 목록이 저마다 툴바를 만들다 보니 검색 축이 화면마다 달랐다.
 * 키워드 입력·기간·선택지(연도/구분) 를 여기 모아 두고 각 목록은 필요한 축만 꽂는다.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { apiJson } from "@/lib/apiFetch";

/** 선택 안 함을 뜻하는 Select 값. Radix Select 는 빈 문자열을 값으로 못 쓴다. */
export const ALL = "_all";

/** 기간 프리셋을 고르지 않은 상태(직접 지정). */
export const CUSTOM_PERIOD = "_custom";

export function SearchBox({
  value, onChange, placeholder, className = "w-64",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input className="pl-9" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

/**
 * 기간 프리셋 — 툴바에서 한 번에 고르는 흔한 구간.
 *
 * 값은 그 자리에서 계산해 from/to 에 넣는다. 선택 상태를 따로 들고 있지 않고
 * 현재 from/to 가 어떤 프리셋의 범위와 일치하는지로 되짚기 때문에, 날짜를 직접
 * 고치거나 필터를 초기화해도 셀렉트가 저절로 "직접 지정"으로 돌아간다.
 * 주는 월요일 시작(ISO), 분기는 1·4·7·10월 시작.
 */
export type DatePreset = {
  key: string;
  labelKey: string;
  from: string;
  to: string;
};

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function datePresets(today = new Date()): DatePreset[] {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // 월요일 시작 주.
  const weekStart = addDays(t, -((t.getDay() + 6) % 7));
  const monthStart = new Date(t.getFullYear(), t.getMonth(), 1);
  const qMonth = Math.floor(t.getMonth() / 3) * 3;
  const quarterStart = new Date(t.getFullYear(), qMonth, 1);
  const yearStart = new Date(t.getFullYear(), 0, 1);

  const range = (from: Date, to: Date) => ({ from: iso(from), to: iso(to) });

  return [
    { key: "today", labelKey: "common.period_today", ...range(t, t) },
    { key: "this_week", labelKey: "common.period_this_week", ...range(weekStart, addDays(weekStart, 6)) },
    { key: "last_week", labelKey: "common.period_last_week", ...range(addDays(weekStart, -7), addDays(weekStart, -1)) },
    { key: "this_month", labelKey: "common.period_this_month", ...range(monthStart, new Date(t.getFullYear(), t.getMonth() + 1, 0)) },
    { key: "last_month", labelKey: "common.period_last_month", ...range(new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)) },
    { key: "this_quarter", labelKey: "common.period_this_quarter", ...range(quarterStart, new Date(t.getFullYear(), qMonth + 3, 0)) },
    { key: "last_quarter", labelKey: "common.period_last_quarter", ...range(new Date(t.getFullYear(), qMonth - 3, 1), new Date(t.getFullYear(), qMonth, 0)) },
    { key: "last_7", labelKey: "common.period_last_7", ...range(addDays(t, -6), t) },
    { key: "last_30", labelKey: "common.period_last_30", ...range(addDays(t, -29), t) },
    { key: "last_90", labelKey: "common.period_last_90", ...range(addDays(t, -89), t) },
    { key: "this_year", labelKey: "common.period_this_year", ...range(yearStart, new Date(t.getFullYear(), 11, 31)) },
    { key: "last_year", labelKey: "common.period_last_year", ...range(new Date(t.getFullYear() - 1, 0, 1), new Date(t.getFullYear() - 1, 11, 31)) },
  ];
}

/**
 * 기간 프리셋 + 시작~종료 날짜 한 쌍.
 *
 * 날짜 칸은 브라우저 기본 date 입력이 아니라 공용 DateInput 이다 — 기본 입력은
 * 표시 형식이 브라우저 로케일을 따라가 미국 머신에서 08/01/2026 처럼 보이는데,
 * 앱 전체 날짜 표기(Settings → Organisation)는 한 가지여야 한다.
 * 라벨은 title/aria 로만 붙여 툴바 높이를 유지한다.
 */
export function DateRangeFilter({
  from, to, onFrom, onTo, fromLabel, toLabel, presets = true,
}: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  fromLabel?: string;
  toLabel?: string;
  presets?: boolean;
}) {
  const { t } = useTranslation();
  const f = fromLabel ?? t("common.filter_date_from");
  const s = toLabel ?? t("common.filter_date_to");
  const options = useMemo(() => datePresets(), []);
  const selected = options.find(p => p.from === from && p.to === to)?.key ?? CUSTOM_PERIOD;

  const applyPreset = (key: string) => {
    if (key === CUSTOM_PERIOD) {
      onFrom("");
      onTo("");
      return;
    }
    const p = options.find(o => o.key === key);
    if (!p) return;
    onFrom(p.from);
    onTo(p.to);
  };

  return (
    <div className="flex items-center gap-1">
      {presets && (
        <Select value={selected} onValueChange={applyPreset}>
          <SelectTrigger className="w-32" aria-label={t("common.filter_period")}>
            <SelectValue placeholder={t("common.period_custom")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CUSTOM_PERIOD}>{t("common.period_custom")}</SelectItem>
            {options.map(p => (
              <SelectItem key={p.key} value={p.key}>{t(p.labelKey as any)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <DateInput value={from} onChange={onFrom} className="w-36" placeholder={f} clearable />
      <span className="text-muted-foreground text-sm">~</span>
      <DateInput value={to} onChange={onTo} className="w-36" placeholder={s} clearable />
    </div>
  );
}

/**
 * 선택지 셀렉트. 옵션이 하나도 없으면 렌더링하지 않는다
 * (아직 데이터가 없는 테넌트에서 빈 셀렉트가 툴바를 채우지 않도록).
 */
export function FacetSelect({
  value, onChange, options, allLabel, labelOf, className = "w-40",
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  allLabel: string;
  labelOf?: (v: string) => string;
  className?: string;
}) {
  if (options.length === 0) return null;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}><SelectValue placeholder={allLabel} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map(o => <SelectItem key={o} value={o}>{labelOf ? labelOf(o) : o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function ResetFiltersButton({ show, onClick }: { show: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  if (!show) return null;
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      <X className="h-4 w-4 mr-1" />{t("common.filter_reset")}
    </Button>
  );
}

export type ListFacets = { years?: string[]; categories?: string[]; lease_forms?: string[] };

/**
 * 목록의 선택지(연도·구분)를 서버에서 가져온다. 목록 자체가 필터로 좁혀져도
 * 선택지는 전체 기준이라 한 번 고른 값이 사라지지 않는다.
 */
export function useListFacets(resource: string, showDeleted = false) {
  return useQuery<ListFacets>({
    queryKey: ["list-facets", resource, showDeleted],
    queryFn: () => apiJson<ListFacets>(`/api/v1/${resource}/facets${showDeleted ? "?deleted=only" : ""}`),
  });
}

/** 연도 선택지의 표시 문자열(ko: 2026년). */
export function useYearLabel() {
  const { t } = useTranslation();
  return (y: string) => t("common.year_value", { year: y });
}

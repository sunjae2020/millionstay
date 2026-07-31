/**
 * 리스트 화면 공통 검색 부품.
 *
 * 44개 목록이 저마다 툴바를 만들다 보니 검색 축이 화면마다 달랐다.
 * 키워드 입력·기간·선택지(연도/구분) 를 여기 모아 두고 각 목록은 필요한 축만 꽂는다.
 */
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiJson } from "@/lib/apiFetch";

/** 선택 안 함을 뜻하는 Select 값. Radix Select 는 빈 문자열을 값으로 못 쓴다. */
export const ALL = "_all";

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

/** 시작~종료 날짜 한 쌍. 라벨은 title/aria 로만 붙여 툴바 높이를 유지한다. */
export function DateRangeFilter({
  from, to, onFrom, onTo, fromLabel, toLabel,
}: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  fromLabel?: string;
  toLabel?: string;
}) {
  const { t } = useTranslation();
  const f = fromLabel ?? t("common.filter_date_from");
  const s = toLabel ?? t("common.filter_date_to");
  return (
    <div className="flex items-center gap-1">
      <Input type="date" className="w-36" aria-label={f} title={f} value={from} onChange={e => onFrom(e.target.value)} />
      <span className="text-muted-foreground text-sm">~</span>
      <Input type="date" className="w-36" aria-label={s} title={s} value={to} onChange={e => onTo(e.target.value)} />
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

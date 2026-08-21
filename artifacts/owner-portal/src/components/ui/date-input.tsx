/**
 * 날짜 입력칸.
 *
 * 브라우저 기본 `<input type="date">` 는 표시 형식이 사용자 로케일을 따라가
 * 같은 값이 머신마다 다르게 보인다. 앱 전체 날짜 표기(VITE_DATE_FORMAT,
 * 기본 YYYY/MM/DD)를 지키려고 표시는 직접 그리고 값은 달력으로 고른다.
 * 어드민(property-admin)·게스트 웹의 같은 이름 컴포넌트와 같은 계약이다.
 */
import { useEffect, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatDate, getDatePlaceholder } from "@/lib/dateFormat";

interface DateInputProps {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** 값이 있을 때 지우기(X) 버튼을 띄운다 — 비울 수 있어야 하는 필터용. */
  clearable?: boolean;
  title?: string;
  "aria-label"?: string;
}

function isoToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? undefined : d;
}

function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function DateInput({
  value,
  onChange,
  min,
  max,
  placeholder = getDatePlaceholder(),
  className,
  disabled,
  clearable,
  title,
  "aria-label": ariaLabel,
}: DateInputProps) {
  const [display, setDisplay] = useState(() => (value ? formatDate(value, "") : ""));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setDisplay(value ? formatDate(value, "") : "");
  }, [value]);

  const minDate = isoToDate(min ?? "");
  const maxDate = isoToDate(max ?? "");
  const selectedDate = isoToDate(value);

  // react-day-picker v9 는 startMonth/endMonth 가 없으면 연도 드롭다운을 올해로만 좁힌다.
  const anchor = selectedDate ?? new Date();
  const navStart = minDate ?? new Date(anchor.getFullYear() - 100, 0, 1);
  const navEnd = maxDate ?? new Date(anchor.getFullYear() + 10, 11, 31);

  const isDisabledDay = (date: Date) => {
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    if (minDate) { const mn = new Date(minDate); mn.setHours(0, 0, 0, 0); if (d < mn) return true; }
    if (maxDate) { const mx = new Date(maxDate); mx.setHours(0, 0, 0, 0); if (d > mx) return true; }
    return false;
  };

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    onChange(dateToIso(date));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <input
            type="text"
            value={display}
            placeholder={placeholder}
            disabled={disabled}
            readOnly
            title={title ?? placeholder}
            aria-label={ariaLabel ?? placeholder}
            onClick={() => !disabled && setOpen(true)}
            className={cn(
              "w-full px-3 py-2 pr-9 rounded-lg border border-input bg-background text-foreground text-sm",
              "focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              !disabled && "cursor-pointer",
              className,
            )}
          />
          {!disabled && clearable && value ? (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
              aria-label="Clear date"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
            >
              <X className="h-4 w-4" />
            </button>
          ) : !disabled ? (
            <PopoverTrigger asChild>
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                aria-label="Open calendar"
              >
                <CalendarDays className="h-4 w-4" />
              </button>
            </PopoverTrigger>
          ) : (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              <CalendarDays className="h-4 w-4" />
            </span>
          )}
        </div>
      </PopoverAnchor>

      <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          disabled={isDisabledDay}
          defaultMonth={selectedDate ?? minDate}
          startMonth={navStart}
          endMonth={navEnd}
          captionLayout="dropdown"
        />
      </PopoverContent>
    </Popover>
  );
}

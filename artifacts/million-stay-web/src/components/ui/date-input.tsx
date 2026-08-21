import { useState, useEffect } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from "@/components/ui/popover";
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
  noIcon?: boolean;
  "data-testid"?: string;
}

/**
 * 입력칸에 보여줄 문자열. 표기는 테넌트 설정(VITE_DATE_FORMAT, 기본 YYYY/MM/DD)을
 * 따른다 — 예전엔 DD/MM/YYYY 로 못 박혀 있어 어드민·문서와 다르게 보였다.
 */
function isoToDisplay(iso: string): string {
  return iso ? formatDate(iso, iso) : "";
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
  noIcon = false,
  "data-testid": testId,
}: DateInputProps) {
  const [display, setDisplay] = useState(isoToDisplay(value));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setDisplay(isoToDisplay(value));
  }, [value]);

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    const iso = dateToIso(date);
    onChange(iso);
    setDisplay(isoToDisplay(iso));
    setOpen(false);
  };

  const minDate = isoToDate(min ?? "");
  const maxDate = isoToDate(max ?? "");
  const selectedDate = isoToDate(value);

  // react-day-picker v9 는 startMonth/endMonth 가 없으면 연도 드롭다운을 올해로만
  // 좁힌다. 생년월일처럼 과거로 한참 가야 하는 칸이 막히지 않도록 min/max 에서
  // 범위를 잡고, 없으면 넉넉한 창을 준다.
  const anchor = selectedDate ?? new Date();
  const navStart = minDate ?? new Date(anchor.getFullYear() - 100, 0, 1);
  const navEnd = maxDate ?? new Date(anchor.getFullYear() + 10, 11, 31);

  const isDisabledDay = (date: Date) => {
    if (minDate) {
      const d = new Date(date); d.setHours(0, 0, 0, 0);
      const mn = new Date(minDate); mn.setHours(0, 0, 0, 0);
      if (d < mn) return true;
    }
    if (maxDate) {
      const d = new Date(date); d.setHours(0, 0, 0, 0);
      const mx = new Date(maxDate); mx.setHours(0, 0, 0, 0);
      if (d > mx) return true;
    }
    return false;
  };

  const inputEl = (
    <input
      type="text"
      value={display}
      onClick={() => !disabled && setOpen(true)}
      placeholder={placeholder}
      disabled={disabled}
      data-testid={testId}
      className={cn(
        "w-full focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer",
        !noIcon && "pr-9",
        className,
      )}
      autoComplete="off"
      readOnly
    />
  );

  const calendarContent = (
    <PopoverContent
      className="w-auto p-0"
      align="start"
      onOpenAutoFocus={(e) => e.preventDefault()}
    >
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={handleCalendarSelect}
        disabled={isDisabledDay}
        defaultMonth={selectedDate ?? minDate}
        startMonth={navStart}
        endMonth={navEnd}
        captionLayout="dropdown"
      />
    </PopoverContent>
  );

  /* noIcon variant: anchor on input, no icon button */
  if (noIcon) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          {inputEl}
        </PopoverAnchor>
        {calendarContent}
      </Popover>
    );
  }

  /* Default variant: icon button as PopoverTrigger + input opens on click */
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        {inputEl}
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors focus:outline-none"
            aria-label="Open calendar"
          >
            <CalendarDays className="h-4 w-4" />
          </button>
        </PopoverTrigger>
      </div>
      {calendarContent}
    </Popover>
  );
}

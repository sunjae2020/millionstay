import { useState, useEffect } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatDate, getDatePlaceholder } from "@/lib/date";

interface DateInputProps {
  value: string;
  onChange?: (iso: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
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
  readOnly,
}: DateInputProps) {
  const [display, setDisplay] = useState(() => formatDate(value, ""));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setDisplay(formatDate(value, ""));
  }, [value]);

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    const iso = dateToIso(date);
    onChange?.(iso);
    setDisplay(formatDate(iso, ""));
    setOpen(false);
  };

  const minDate = isoToDate(min ?? "");
  const maxDate = isoToDate(max ?? "");
  const selectedDate = isoToDate(value);

  // react-day-picker v9 limits the caption dropdowns to the current year unless
  // startMonth/endMonth are given. Derive them from min/max, falling back to a
  // wide window so date-of-birth style fields stay reachable too.
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

  const isInteractive = !disabled && !readOnly;

  return (
    <Popover open={open} onOpenChange={isInteractive ? setOpen : undefined}>
      <div className="relative">
        <input
          type="text"
          value={display}
          placeholder={placeholder}
          disabled={disabled}
          readOnly
          onClick={() => isInteractive && setOpen(true)}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background pr-9",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            isInteractive && "cursor-pointer",
            className,
          )}
        />
        {isInteractive ? (
          <PopoverTrigger asChild>
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
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
    </Popover>
  );
}

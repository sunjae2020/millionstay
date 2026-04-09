import { useState, useEffect } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

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

function isoToDmy(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function dmyToIso(dmy: string): string {
  const clean = dmy.replace(/\D/g, "");
  if (clean.length < 8) return "";
  const d = clean.slice(0, 2);
  const m = clean.slice(2, 4);
  const y = clean.slice(4, 8);
  const date = new Date(`${y}-${m}-${d}`);
  if (isNaN(date.getTime())) return "";
  return `${y}-${m}-${d}`;
}

function autoSlash(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
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
  placeholder = "DD/MM/YYYY",
  className,
  disabled,
  noIcon = false,
  "data-testid": testId,
}: DateInputProps) {
  const [display, setDisplay] = useState(isoToDmy(value));
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setDisplay(isoToDmy(value));
  }, [value]);

  const handleTextChange = (raw: string) => {
    const formatted = autoSlash(raw);
    setDisplay(formatted);
    if (formatted.length === 10) {
      const iso = dmyToIso(formatted);
      if (iso) {
        setError(false);
        onChange(iso);
      } else {
        setError(true);
      }
    } else {
      setError(false);
      if (formatted.length === 0) onChange("");
    }
  };

  const handleBlur = () => {
    if (display.length > 0 && display.length < 10) setError(true);
    if (display.length === 0) setError(false);
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    const iso = dateToIso(date);
    onChange(iso);
    setDisplay(isoToDmy(iso));
    setError(false);
    setOpen(false);
  };

  const minDate = isoToDate(min ?? "");
  const maxDate = isoToDate(max ?? "");
  const selectedDate = isoToDate(value);

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
      onChange={(e) => handleTextChange(e.target.value)}
      onBlur={handleBlur}
      onClick={() => !disabled && setOpen(true)}
      placeholder={placeholder}
      disabled={disabled}
      data-testid={testId}
      className={cn(
        "w-full focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer",
        !noIcon && "pr-9",
        error && "ring-2 ring-red-400",
        className,
      )}
      maxLength={10}
      inputMode="numeric"
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

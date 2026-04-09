import { useState, useEffect } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

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

  return (
    <div className="relative">
      <input
        type="text"
        value={display}
        onChange={(e) => handleTextChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        data-testid={testId}
        className={cn(
          "w-full focus:outline-none focus:ring-2 focus:ring-primary",
          !noIcon && "pr-9",
          error && "ring-2 ring-red-400",
          className,
        )}
        maxLength={10}
        inputMode="numeric"
      />

      {/* Calendar icon — decorative only, no native picker */}
      {!noIcon && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <CalendarDays className="h-4 w-4" />
        </span>
      )}
    </div>
  );
}

import { useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface LookupOption {
  id: number;
  label: string;
  sublabel?: string;
}

interface LookupFieldProps {
  label: string;
  value: number | null | undefined;
  displayText: string | null | undefined;
  onSelect: (id: number, label: string) => void;
  onClear: () => void;
  required?: boolean;
  error?: boolean;
  options: LookupOption[];
  onSearch: (query: string) => void;
  searchPlaceholder?: string;
  disabled?: boolean;
}

export function LookupField({
  label,
  value,
  displayText,
  onSelect,
  onClear,
  required,
  error,
  options,
  onSearch,
  searchPlaceholder = "Search...",
  disabled,
}: LookupFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  function handleSearch(q: string) {
    setQuery(q);
    onSearch(q);
  }

  function handleSelect(opt: LookupOption) {
    onSelect(opt.id, opt.label);
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
        <div
          className={cn(
            "flex items-center min-h-9 rounded-md border bg-background px-3 py-1.5 text-sm transition-colors",
            error ? "border-destructive" : "border-input",
            disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-primary/50"
          )}
          onClick={() => !disabled && setOpen(true)}
        >
          {value ? (
            <span className="flex-1 text-orange-600 font-medium truncate">{displayText}</span>
          ) : (
            <span className="flex-1 text-muted-foreground">Select {label}...</span>
          )}
          <div className="flex items-center gap-1 ml-2">
            {value && !disabled && (
              <button
                type="button"
                className="p-0.5 rounded hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select {label}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
            />
            <ScrollArea className="h-64">
              <div className="flex flex-col gap-1">
                {options.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No results found</p>
                ) : (
                  options.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className="flex flex-col items-start px-3 py-2 rounded-md hover:bg-muted text-left transition-colors"
                      onClick={() => handleSelect(opt)}
                    >
                      <span className="text-sm font-medium">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="text-xs text-muted-foreground">{opt.sublabel}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface MultiLookupFieldProps {
  label: string;
  values: number[];
  displayTexts: string[];
  onSelect: (id: number, label: string) => void;
  onRemove: (id: number) => void;
  required?: boolean;
  error?: boolean;
  options: LookupOption[];
  onSearch: (query: string) => void;
  searchPlaceholder?: string;
}

export function MultiLookupField({
  label,
  values,
  displayTexts,
  onSelect,
  onRemove,
  required,
  error,
  options,
  onSearch,
  searchPlaceholder = "Search...",
}: MultiLookupFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  function handleSearch(q: string) {
    setQuery(q);
    onSearch(q);
  }

  function handleSelect(opt: LookupOption) {
    if (!values.includes(opt.id)) {
      onSelect(opt.id, opt.label);
    }
    setQuery("");
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
        <div
          className={cn(
            "flex flex-wrap items-center gap-1 min-h-9 rounded-md border bg-background px-3 py-1.5 text-sm transition-colors cursor-pointer hover:border-primary/50",
            error ? "border-destructive" : "border-input"
          )}
          onClick={() => setOpen(true)}
        >
          {values.length === 0 ? (
            <span className="text-muted-foreground flex-1">Select {label}...</span>
          ) : (
            displayTexts.map((text, i) => (
              <span
                key={values[i]}
                className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 border border-orange-200 rounded px-1.5 py-0.5 text-xs font-medium"
              >
                {text}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(values[i]);
                  }}
                  className="hover:text-orange-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          )}
          <Search className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select {label}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
            />
            <ScrollArea className="h-64">
              <div className="flex flex-col gap-1">
                {options.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No results found</p>
                ) : (
                  options.map((opt) => {
                    const selected = values.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={cn(
                          "flex flex-col items-start px-3 py-2 rounded-md text-left transition-colors",
                          selected ? "bg-orange-50 text-orange-700" : "hover:bg-muted"
                        )}
                        onClick={() => handleSelect(opt)}
                      >
                        <span className="text-sm font-medium">{opt.label}</span>
                        {opt.sublabel && (
                          <span className="text-xs text-muted-foreground">{opt.sublabel}</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
            <Button variant="outline" onClick={() => setOpen(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

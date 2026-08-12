import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiJson } from "@/lib/apiFetch";

export interface LookupSelectProps {
  value: number | null | undefined;
  onChange: (id: number | null) => void;
  lookupUrl: string;
  placeholder?: string;
  displayValue?: string | null;
  /** Ids to hide from the result list (e.g. the record itself, to block self-linking). */
  excludeIds?: number[];
  /**
   * Builds the row label from the raw item instead of using `display`.
   *
   * Lookup endpoints are shared with non-admin consumers and the API has no
   * admin i18n, so `display` is always English. Endpoints that also return
   * their parts (e.g. accounts return `name` + `account_type`) can be
   * relabelled here — see AccountLookupSelect.
   */
  formatLabel?: (item: LookupItem) => string;
  /**
   * Renders the whole result row instead of a single line of text. Use when the
   * label alone can't tell two records apart (e.g. rate-card products that share
   * a name and only differ by unit/rent/deposit) — see ProductLookupSelect.
   * `formatLabel` still supplies the collapsed label shown in the closed field.
   */
  renderItem?: (item: LookupItem) => React.ReactNode;
  /** Widen the dialog when rows carry more than one line. */
  dialogClassName?: string;
}

/** Every lookup returns id + display; endpoints may add their own fields. */
export interface LookupItem {
  id: number;
  display: string;
  [key: string]: unknown;
}

export function LookupSelect({ value, onChange, lookupUrl, placeholder = "Search…", displayValue, excludeIds, formatLabel, renderItem, dialogClassName }: LookupSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LookupItem[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(displayValue ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleSearch(q: string) {
    setQuery(q);
    setLoading(true);
    setError(false);
    try {
      const sep = lookupUrl.includes("?") ? "&" : "?";
      const url = `${lookupUrl}${sep}q=${encodeURIComponent(q)}`;
      // Lookup endpoints sit behind requireAuth — must go through apiJson so the
      // Bearer token is attached (a bare fetch() silently 401s → empty list).
      const data = await apiJson<LookupItem[]>(url);
      const list = Array.isArray(data) ? data : [];
      setResults(excludeIds?.length ? list.filter((i) => !excludeIds.includes(i.id)) : list);
    } catch {
      setResults([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setOpen(true);
    handleSearch("");
  }

  const labelOf = (item: LookupItem) => formatLabel?.(item) ?? item.display;

  function handleSelect(item: LookupItem) {
    onChange(item.id);
    setSelectedLabel(labelOf(item));
    setOpen(false);
    setQuery("");
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
    setSelectedLabel(null);
  }

  const display = value ? (selectedLabel ?? displayValue ?? `#${value}`) : null;

  return (
    <>
      <div
        className="flex items-center h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm cursor-pointer hover:border-ring transition-colors"
        onClick={handleOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleOpen()}
      >
        {display ? (
          <span className="flex-1 truncate">{display}</span>
        ) : (
          <span className="flex-1 text-muted-foreground">{placeholder}</span>
        )}
        <div className="flex items-center gap-1 ml-2">
          {display && (
            <button type="button" onClick={handleClear} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={dialogClassName ?? "max-w-md"}>
          <DialogHeader>
            <DialogTitle>{t('common.select')}</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-8"
              placeholder={placeholder}
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <ScrollArea className="max-h-64">
            {loading && <p className="px-3 py-2 text-sm text-muted-foreground">{t('common.loading')}</p>}
            {!loading && error && (
              <p className="px-3 py-2 text-sm text-destructive">{t('common.error')}</p>
            )}
            {!loading && !error && results.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">{t('common.no_results')}</p>
            )}
            {results.map((item) => (
              <button
                key={item.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
                onClick={() => handleSelect(item)}
              >
                {renderItem ? renderItem(item) : labelOf(item)}
              </button>
            ))}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

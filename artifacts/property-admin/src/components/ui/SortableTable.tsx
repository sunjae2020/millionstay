import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

/** How to pull the comparable value for a given sort key out of a row. */
export type SortAccessor<T> = (row: T) => unknown;

interface UseSortableDataOptions<T> {
  defaultKey?: string | null;
  defaultDir?: SortDir;
  /** Optional per-key accessors for computed/nested columns. Keys without an
   *  accessor fall back to `row[key]`. */
  accessors?: Record<string, SortAccessor<T>>;
}

function compareValues(a: unknown, b: unknown): number {
  // Nulls / undefined / empty always sort last, regardless of direction flip.
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return a === b ? 0 : a ? 1 : -1;

  // Numeric-aware string compare handles numeric strings, dates (ISO), and text.
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * Client-side sorting for list pages. Sorts the full in-memory array (the
 * complete filter result) BEFORE pagination slices it, so paging through a
 * sorted list stays consistent.
 *
 * Usage:
 *   const { sorted, sortKey, sortDir, toggleSort } = useSortableData(rows ?? []);
 *   const pagination = usePagination(sorted);
 *   ...
 *   <SortableTh sortKey="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort}>Name</SortableTh>
 */
export function useSortableData<T>(
  items: T[] | undefined | null,
  options: UseSortableDataOptions<T> = {},
) {
  const [sortKey, setSortKey] = useState<string | null>(options.defaultKey ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(options.defaultDir ?? "asc");

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    if (!items) return [] as T[];
    if (!sortKey) return items;
    const accessor = options.accessors?.[sortKey];
    const getVal = (row: T): unknown =>
      accessor ? accessor(row) : (row as Record<string, unknown>)[sortKey];
    const arr = [...items];
    arr.sort((a, b) => {
      const cmp = compareValues(getVal(a), getVal(b));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
    // options.accessors is expected to be stable (defined inline is fine for
    // small maps); intentionally not in deps to avoid resort churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, toggleSort };
}

interface SortableThProps {
  /** Field key this header sorts by. */
  sortKey: string;
  /** Currently active sort key from the hook. */
  activeKey: string | null;
  /** Current sort direction from the hook. */
  sortDir: SortDir;
  /** Toggle callback from the hook. */
  onSort: (key: string) => void;
  children: ReactNode;
  className?: string;
  /** Horizontal alignment of the header content. Default "left". */
  align?: "left" | "right" | "center";
}

/**
 * Clickable table header cell for raw `<table>` list pages. Reproduces the
 * common admin header styling (uppercase, muted, xs) with a sort affordance.
 */
export function SortableTh({
  sortKey,
  activeKey,
  sortDir,
  onSort,
  children,
  className,
  align = "left",
}: SortableThProps) {
  const active = activeKey === sortKey;
  return (
    <th
      className={cn(
        "px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide select-none",
        align === "left" && "text-left",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors group",
          align === "right" && "flex-row-reverse",
          active && "text-foreground",
        )}
      >
        <span>{children}</span>
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
        )}
      </button>
    </th>
  );
}

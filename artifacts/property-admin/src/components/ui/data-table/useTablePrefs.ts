import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import { ACTIONS_KEY, type ColumnDef, type TablePrefs, EMPTY_PREFS } from "./types";

const DEBOUNCE_MS = 600;

function isEmptyPrefs(p: TablePrefs): boolean {
  return (
    (!p.order || p.order.length === 0) &&
    (!p.hidden || p.hidden.length === 0) &&
    (!p.widths || Object.keys(p.widths).length === 0)
  );
}

/**
 * Loads/merges/persists a user's column preferences for one list table.
 *
 * - Loads `GET /api/v1/table-prefs/:tableKey` once on mount; stays on defaults
 *   silently on 401/empty/error.
 * - Merges the saved (sparse) prefs over the page's ColumnDef defaults into an
 *   effective ordered + visible column list — robust to columns added/removed
 *   across releases.
 * - Setters update local state immediately and persist via a debounced PUT
 *   (essential for resize, which fires on every mousemove). Persistence is
 *   gated until the initial GET resolves, so defaults never clobber saved prefs.
 */
export function useTablePrefs<T>(tableKey: string, columns: ColumnDef<T>[]) {
  const [order, setOrderState] = useState<string[]>([]);
  const [hidden, setHiddenState] = useState<string[]>([]);
  const [widths, setWidthsState] = useState<Record<string, number>>({});
  const readyRef = useRef(false); // initial GET resolved?
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<TablePrefs>(EMPTY_PREFS);

  // Keep a live snapshot for debounce flush on unmount.
  latestRef.current = { order, hidden, widths };

  // Load once per tableKey.
  useEffect(() => {
    let cancelled = false;
    readyRef.current = false;
    (async () => {
      let loaded: TablePrefs = EMPTY_PREFS;
      try {
        const res = await apiFetch(`/api/v1/table-prefs/${encodeURIComponent(tableKey)}`);
        if (res.ok) {
          const body = await res.json();
          const p = (body?.data ?? {}) as Partial<TablePrefs>;
          loaded = {
            order: Array.isArray(p.order) ? p.order : [],
            hidden: Array.isArray(p.hidden) ? p.hidden : [],
            widths: p.widths && typeof p.widths === "object" ? p.widths : {},
          };
        }
      } catch {
        // stay on defaults
      }
      if (cancelled) return;
      // Seed defaultHidden only when the user has never saved anything.
      if (isEmptyPrefs(loaded)) {
        loaded = { ...loaded, hidden: columns.filter((c) => c.defaultHidden).map((c) => c.key) };
      }
      setOrderState(loaded.order);
      setHiddenState(loaded.hidden);
      setWidthsState(loaded.widths);
      readyRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // Re-run only when the table changes; columns identity is not a load trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey]);

  const flush = useCallback(() => {
    if (!readyRef.current) return;
    void apiFetch(`/api/v1/table-prefs/${encodeURIComponent(tableKey)}`, {
      method: "PUT",
      body: JSON.stringify(latestRef.current),
    }).catch(() => {});
  }, [tableKey]);

  const schedulePersist = useCallback(() => {
    if (!readyRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, DEBOUNCE_MS);
  }, [flush]);

  // Flush any pending write on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        flush();
      }
    };
  }, [flush]);

  const setOrder = useCallback((keys: string[]) => {
    setOrderState(keys);
    schedulePersist();
  }, [schedulePersist]);

  const setHidden = useCallback((key: string, hide: boolean) => {
    setHiddenState((prev) => {
      const set = new Set(prev);
      if (hide) set.add(key);
      else set.delete(key);
      return [...set];
    });
    schedulePersist();
  }, [schedulePersist]);

  const setWidth = useCallback((key: string, px: number) => {
    setWidthsState((prev) => ({ ...prev, [key]: px }));
    schedulePersist();
  }, [schedulePersist]);

  const resetWidths = useCallback(() => {
    setWidthsState({});
    schedulePersist();
  }, [schedulePersist]);

  const reset = useCallback(() => {
    setOrderState([]);
    setHiddenState(columns.filter((c) => c.defaultHidden).map((c) => c.key));
    setWidthsState({});
    schedulePersist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedulePersist]);

  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);

  // Effective ordered column list (incl. hidden), __actions forced last.
  const allColumnsInOrder = useMemo(() => {
    const byKey = new Map(columns.map((c) => [c.key, c]));
    const seen = new Set<string>();
    const out: ColumnDef<T>[] = [];
    for (const key of order) {
      const col = byKey.get(key);
      if (col && !seen.has(key)) {
        out.push(col);
        seen.add(key);
      }
    }
    for (const col of columns) {
      if (!seen.has(col.key)) {
        out.push(col);
        seen.add(col.key);
      }
    }
    // Force the actions column to the very end regardless of saved order.
    out.sort((a, b) => Number(a.key === ACTIONS_KEY) - Number(b.key === ACTIONS_KEY));
    return out;
  }, [columns, order]);

  const isHidden = useCallback(
    (col: ColumnDef<T>) => col.hideable !== false && hiddenSet.has(col.key),
    [hiddenSet],
  );

  const orderedVisibleColumns = useMemo(
    () => allColumnsInOrder.filter((c) => !isHidden(c)),
    [allColumnsInOrder, isHidden],
  );

  return {
    orderedVisibleColumns,
    allColumnsInOrder,
    isHidden,
    widths,
    setOrder,
    setHidden,
    setWidth,
    resetWidths,
    reset,
  };
}

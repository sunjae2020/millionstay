import type { ReactNode } from "react";

export type Align = "left" | "right" | "center";

/** Reserved column key for the per-row action buttons column. Always pinned
 *  last, never hideable, never sortable, excluded from the Columns menu. */
export const ACTIONS_KEY = "__actions";

/**
 * Declarative column model shared by every admin list page. Drives the header,
 * the body cell, sorting, resize/reorder/visibility, and DB-persisted prefs —
 * so all list tables behave identically.
 */
export interface ColumnDef<T> {
  /** Stable id; also the default sort key and the prefs id. */
  key: string;
  /** A string is treated as an i18n key (passed through `t()`); a node renders as-is. */
  header: ReactNode | string;
  /** Body cell renderer. */
  cell: (row: T) => ReactNode;
  /** Pull the comparable value for sorting; defaults to `row[key]`. */
  sortAccessor?: (row: T) => unknown;
  /** Default true. */
  sortable?: boolean;
  /** Default "left". */
  align?: Align;
  /** Seed `<col>` width (px) when the user has no persisted width. */
  defaultWidth?: number;
  /** Minimum width (px) during resize. Default 60. */
  minWidth?: number;
  /** Default true. `false` = always visible, excluded from the Columns menu. */
  hideable?: boolean;
  /** Hidden until the user enables it (only applies when no prefs are saved yet). */
  defaultHidden?: boolean;
  headerClassName?: string;
  cellClassName?: string;
}

/** Persisted per-user prefs blob for one table. */
export interface TablePrefs {
  order: string[];
  hidden: string[];
  widths: Record<string, number>;
}

export const EMPTY_PREFS: TablePrefs = { order: [], hidden: [], widths: {} };

import type { ReactNode } from "react";

export type Align = "left" | "right" | "center";

/** Value produced by an inline editor and sent in the PATCH/PUT body. */
export type EditValue = string | number | boolean | null;

/** Inline-edit descriptor for a single column (safe-bucket lists only). */
export interface EditableConfig<T> {
  /** Editor widget. `boolean` toggles-and-saves on click; the rest are click-to-edit. */
  type: "text" | "number" | "select" | "boolean" | "date";
  /** Body field name; defaults to the column `key`. */
  field?: string;
  /** Current value fed to the editor. */
  getValue: (row: T) => EditValue | undefined;
  /** Options for `select`. Labels are pre-resolved (already `t()`-ed by the page). */
  options?: Array<{ value: string; label: string }>;
  /** Return false to keep a specific row read-only. */
  canEdit?: (row: T) => boolean;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

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
  /** Makes the cell inline-editable when the table is given an `editing` prop. */
  editable?: EditableConfig<T>;
  /**
   * Plain value for CSV export. Defaults to the rendered `cell` flattened to
   * text — supply this when the cell is a badge/icon/link whose text differs
   * from the underlying value (e.g. a raw date or a numeric amount).
   */
  csv?: (row: T) => unknown;
  /** Default true. `false` excludes the column from CSV export. */
  exportable?: boolean;
  headerClassName?: string;
  cellClassName?: string;
}

/**
 * Inline-editing wiring for a table. Either point at a REST `resource`
 * (PUT/PATCH `/api/v1/<resource>/<id>` with `{ [field]: value }`) or supply a
 * custom `save` for non-standard endpoints (e.g. upsert-by-key). `onEdited`
 * runs after a successful save so the page can invalidate its query.
 */
export interface DataTableEditing<T> {
  resource?: string;
  method?: "PUT" | "PATCH";
  save?: (row: T, field: string, value: EditValue) => Promise<void>;
  onEdited?: () => void;
}

/** Persisted per-user prefs blob for one table. */
export interface TablePrefs {
  order: string[];
  hidden: string[];
  widths: Record<string, number>;
}

export const EMPTY_PREFS: TablePrefs = { order: [], hidden: [], widths: {} };

/**
 * 서버 정렬 + 서버 페이징 모드 서술자(`useServerList` 가 만들어 준다).
 *
 * 이 prop 이 있으면 DataTable 은 **받은 행이 곧 현재 페이지**라고 보고 클라이언트
 * 정렬·페이지 자르기를 하지 않는다. 정렬 가능 헤더는 `sortableKeys` 로 제한된다 —
 * 서버가 정렬하지 못하는 파생 컬럼을 현재 페이지 안에서만 정렬하면 전체 기준으로는
 * 틀린 결과가 되기 때문이다.
 */
export interface DataTableServer<T> {
  /** 필터 적용 후 전체 건수(X-Total-Count). */
  total: number;
  page: number;
  pageSize: number;
  sortKey: string | null;
  sortDir: "asc" | "desc";
  sortableKeys: string[];
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  onSort: (key: string) => void;
  /** CSV 내보내기용 전량 조회. 없으면 현재 페이지만 내보낸다. */
  fetchAll?: () => Promise<T[]>;
}

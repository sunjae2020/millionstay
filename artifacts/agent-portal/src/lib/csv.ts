import { isValidElement, type ReactNode } from "react";

/**
 * CSV export helpers shared by every admin table.
 *
 * Two entry points:
 *  - `rowsToCsv()` for declarative tables (`DataTable` / `ColumnDef`), which
 *    export the full filtered+sorted result set, not just the visible page.
 *  - `tableElementToCsv()` for the remaining hand-rolled `<table>`s (detail-page
 *    sub-tables, dashboard tabs), which export exactly what is rendered.
 *
 * Files are written with a UTF-8 BOM so Excel on Windows/Korean locales opens
 * them without mojibake.
 */

/** Flatten a rendered cell (badge, link, icon + label, …) down to plain text. */
export function nodeToText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join(" ");
  if (isValidElement(node)) {
    const props = node.props as Record<string, unknown>;
    const text = nodeToText(props.children as ReactNode).trim();
    if (text) return text;
    // Icon-only cells: fall back to whatever accessible label they carry.
    for (const attr of ["title", "aria-label", "alt"]) {
      const v = props[attr];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  }
  return "";
}

/** Quote a single CSV field per RFC 4180. */
function escapeField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value).replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  return /[",;\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsvString(rows: unknown[][]): string {
  return rows.map((r) => r.map(escapeField).join(",")).join("\r\n");
}

/** Trigger a browser download for `csv` (adds the UTF-8 BOM Excel needs). */
export function downloadCsv(csv: string, fileName: string) {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** `<base>_YYYYMMDD.csv` — mirrors the issued-document naming style. */
export function csvFileName(base: string): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${base || "export"}_${stamp}.csv`;
}

export interface CsvColumn<T> {
  header: string;
  /** Plain value; when omitted the rendered cell is flattened to text. */
  value: (row: T) => unknown;
}

export function rowsToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  return toCsvString([
    columns.map((c) => c.header),
    ...rows.map((row) => columns.map((c) => c.value(row))),
  ]);
}

export function exportRowsToCsv<T>(rows: T[], columns: CsvColumn<T>[], fileName: string) {
  downloadCsv(rowsToCsv(rows, columns), csvFileName(fileName));
}

/**
 * Scrape a rendered `<table>` into CSV. Header text comes from `thead th`; each
 * `tbody tr` becomes a row. Cells marked `data-csv-skip` (action buttons,
 * checkboxes) are dropped, and `data-csv="…"` overrides a cell's text.
 */
export function tableElementToCsv(table: HTMLTableElement): string {
  const skip = (cell: HTMLTableCellElement) =>
    cell.hasAttribute("data-csv-skip") ||
    !!cell.querySelector("input[type=checkbox],button,a[download]");

  const cellText = (cell: HTMLTableCellElement) => {
    const override = cell.getAttribute("data-csv");
    if (override !== null) return override;
    const input = cell.querySelector("input,select,textarea") as
      | HTMLInputElement
      | HTMLSelectElement
      | null;
    if (input) return input.value ?? "";
    return (cell.textContent ?? "").replace(/\s+/g, " ").trim();
  };

  const headCells = Array.from(
    table.tHead?.rows[table.tHead.rows.length - 1]?.cells ?? [],
  ) as HTMLTableCellElement[];
  // Column indexes we keep — decided from the header row so body rows stay aligned.
  const keep = headCells.map((c, i) => (skip(c) ? -1 : i)).filter((i) => i >= 0);
  const header = keep.map((i) => cellText(headCells[i]));

  const body: unknown[][] = [];
  for (const tbody of Array.from(table.tBodies)) {
    for (const tr of Array.from(tbody.rows)) {
      const cells = Array.from(tr.cells) as HTMLTableCellElement[];
      // Skip filler rows ("no results", loading, spanning summaries).
      if (cells.length === 1 && headCells.length > 1) continue;
      const picked = keep.length
        ? keep.map((i) => (cells[i] ? cellText(cells[i]) : ""))
        : cells.filter((c) => !skip(c)).map(cellText);
      if (picked.some((v) => v !== "")) body.push(picked);
    }
  }

  // Drop noise columns: unlabelled and empty in every row (checkbox / action
  // button columns whose header cell carries no text).
  const width = Math.max(header.length, ...body.map((r) => r.length), 0);
  const keepCol = Array.from({ length: width }, (_, i) =>
    (header[i] ?? "") !== "" || body.some((r) => (r[i] ?? "") !== ""),
  );
  const trim = <R,>(row: R[]) => row.filter((_, i) => keepCol[i]);

  const rows = header.length ? [trim(header), ...body.map(trim)] : body.map(trim);
  return toCsvString(rows);
}

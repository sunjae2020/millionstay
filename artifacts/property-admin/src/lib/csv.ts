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

/**
 * 리포트 파일명 — `리포트-<발행사>-<리포트종류>-<기준일>_v1.csv`.
 *
 * 화면에서 내려받는 표 역시 고객에게 발행하는 문서가 아닌 **운영 리포트**라서
 * 서버의 `buildReportFileName()`과 같은 규칙을 쓴다(docs/DOCUMENT_NAMING_RULE.md).
 * 필드 간은 `-`, 필드 내부는 `_`, 공백은 없다. 서류 이름은 한글이 정본이다 —
 * 폴더에서 파일을 훑는 사람이 읽는 값이라 코드보다 이름이 낫다.
 *
 * 발행사 표기는 인스턴스마다 다르다 — `VITE_DOC_ISSUER_LABEL`(없으면
 * `VITE_APP_NAME`, 그것도 없으면 `MillionStay`). Metheim은 한글 상호를 넣어
 * 내려받은 파일만 봐도 어느 회사가 뽑은 자료인지 남게 한다.
 */
export function issuerLabel(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return namePart(env.VITE_DOC_ISSUER_LABEL || env.VITE_APP_NAME || "MillionStay") || "MillionStay";
}

/** 이름 한 조각을 파일명 규격으로 — 금지문자 제거, 공백은 `_`로. */
function namePart(raw: string): string {
  return String(raw ?? "")
    .replace(/[\\/:*?"<>|#%.\- -]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ /g, "_")
    .slice(0, 40);
}

/**
 * 리포트 종류 통제 어휘 — 서버 `REPORT_TYPES`의 프론트 사본. 호출부가 넘긴
 * 영문 키(`monthly_settlement`, `bookings`…)를 한글 이름으로 바꾼다. 목록
 * 화면의 표는 대개 그 화면 이름이 곧 리포트 이름이라, 등록되지 않은 값은
 * 그대로 정리해서 쓴다.
 */
const REPORT_TYPES_KO: Record<string, string> = {
  monthly_settlement: "월별정산",
  deposit_settlement: "보증금정산",
  commission_statement: "커미션명세",
  occupancy: "공실현황",
  revenue: "매출현황",
  arrears: "미납현황",
  maintenance: "유지보수현황",
  partner_payout: "파트너정산",
  campaign_performance: "캠페인성과",
  document_checklist: "서류점검표",
  booking: "예약현황",
  bookings: "예약현황",
  accounts: "계정목록",
  contacts: "연락처목록",
  contracts: "계약목록",
  invoices: "청구목록",
  spaces: "세대목록",
  properties: "건물목록",
  work_orders: "작업지시목록",
  quotes: "견적목록",
};

/** `monthly_settlement` → `월별정산`. 미등록 키는 정리만 해서 그대로 쓴다. */
function reportType(base: string): string {
  const key = String(base || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const known = REPORT_TYPES_KO[key];
  if (known) return known;
  const words = String(base || "리포트")
    .replace(/[_\-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (/^[a-z]/.test(w) ? w[0].toUpperCase() + w.slice(1) : w));
  return namePart(words.join(" ")) || "리포트";
}

export function csvFileName(base: string, opts: { asOf?: Date; version?: number } = {}): string {
  const d = opts.asOf ?? new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `리포트-${issuerLabel()}-${reportType(base)}-${stamp}_v${Math.max(1, opts.version ?? 1)}.csv`;
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

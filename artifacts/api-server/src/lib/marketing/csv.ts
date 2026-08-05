/**
 * Minimal RFC 4180 CSV reader for prospect imports.
 *
 * Hand-rolled rather than pulled in as a dependency: the input is one small
 * admin-uploaded file, and the only behaviours that matter here are quoted
 * fields containing commas/newlines and doubled quotes — which is the whole of
 * RFC 4180. A BOM is stripped because Excel writes one on UTF-8 export, and CRLF
 * is normalised for the same reason.
 */

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsv(input: string): ParsedCsv {
  const text = input.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }   // escaped quote
        else inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ",") { record.push(field); field = ""; continue; }
    if (ch === "\n") { record.push(field); records.push(record); record = []; field = ""; continue; }
    field += ch;
  }
  // Trailing field/record (file not ending in a newline).
  if (field.length > 0 || record.length > 0) { record.push(field); records.push(record); }

  const nonEmpty = records.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = nonEmpty[0]!.map((h) => h.trim());
  const rows = nonEmpty.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (cells[idx] ?? "").trim(); });
    return row;
  });

  return { headers, rows };
}

/**
 * Header aliases so an admin can upload the spreadsheet they already have.
 * Matching is case-insensitive and ignores spaces/underscores, and Korean column
 * names are recognised because that is what the Metheim-side lists look like.
 */
const HEADER_ALIASES: Record<string, string[]> = {
  company_name: ["company", "companyname", "회사명", "업체명", "상호", "기관명", "회사"],
  email: ["email", "emailaddress", "mail", "이메일", "메일", "이메일주소"],
  contact_name: ["name", "contact", "contactname", "담당자", "담당자명", "이름", "성명"],
  contact_title: ["title", "jobtitle", "position", "직함", "직위", "직책"],
  phone: ["phone", "tel", "mobile", "phonenumber", "연락처", "전화", "전화번호", "휴대폰"],
  website: ["website", "url", "homepage", "web", "웹사이트", "홈페이지"],
  segment: ["segment", "category", "type", "구분", "세그먼트", "분류"],
  country: ["country", "국가"],
  city: ["city", "지역", "도시"],
  notes: ["notes", "note", "memo", "remark", "비고", "메모"],
};

const norm = (s: string) => s.toLowerCase().replace(/[\s_\-.]/g, "");

/** Best-effort map of CSV headers → prospect fields. The admin can override it. */
export function suggestColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const h = norm(header);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (mapping[header]) break;
      if (h === norm(field) || aliases.some((a) => norm(a) === h)) mapping[header] = field;
    }
  }
  return mapping;
}

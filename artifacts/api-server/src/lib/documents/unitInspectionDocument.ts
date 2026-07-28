/**
 * Document Hub — 세대점검표 (unit inspection checklist) document builder.
 *
 * Reproduces the Metheim 여수 임대세대 점검표 paper layout: a header block
 * (타입 / 호수 / 임차인명 / 연락처 / 입주일 / 퇴거일), the 검침 내역 grid
 * (전입·전출 × 전기·수도·가스), the two-column 하자 내용 checklist grouped by area
 * with 입주하자 and 퇴거하자 side by side, a 비고 box and the 특약 사항 clauses.
 *
 * Two modes off the same builder:
 *  - filled  — a saved report, with statuses, notes, photo counts and the drawn
 *              signatures rendered in the 점검자/임차인 cells.
 *  - blank   — `data: null`, printing an empty form to fill in by hand. The two
 *              must never diverge, which is why they share one renderer.
 */
import { renderDocumentShell, escapeHtml, getCompanyInfo, type CompanyInfo } from "./theme";
import {
  chrome,
  getInspectionTemplate,
  localize,
  type InspectionTemplate,
} from "../inspections/metheimUnitTemplate";

export type InspectionPhase = "move_in" | "move_out";

export interface InspectionDocItem {
  item_code: string | null;
  group_key: string | null;
  label: string;
  move_in_status: string | null;
  move_in_note: string | null;
  move_out_status: string | null;
  move_out_note: string | null;
  photoCounts?: { move_in: number; move_out: number };
}

export interface InspectionDocSignature {
  phase: string;
  role: string; // inspector | tenant
  signer_name: string | null;
  signature_image: string;
  signed_at: string | Date | null;
}

export interface InspectionDocMeta {
  unit_type?: string | null;
  unit_no?: string | null;
  tenant_name?: string | null;
  tenant_phone?: string | null;
  move_in_date?: string | null;
  move_out_date?: string | null;
  meters?: {
    in?: { electric?: string | null; water?: string | null; gas?: string | null };
    out?: { electric?: string | null; water?: string | null; gas?: string | null };
  };
  inspector_in?: string | null;
  inspector_out?: string | null;
  confirmed_in?: string | null;  // 확인일 (입주)
  confirmed_out?: string | null; // 확인일 (퇴거)
  remarks?: string | null;       // 비고
}

export interface InspectionDocInput {
  report_ref: string;
  meta: InspectionDocMeta;
  items: InspectionDocItem[];
  signatures: InspectionDocSignature[];
}

const STATUS_CHROME: Record<string, string> = {
  ok: "statusOk",
  defect: "statusDefect",
  na: "statusNa",
};

const DASH = "";

function fillLine(value: string | null | undefined, fallback = DASH): string {
  const v = (value ?? "").toString().trim();
  return v ? escapeHtml(v) : fallback;
}

/** 타입 A B C D E — the selected one is boxed, as it is circled on paper. */
function renderUnitTypes(template: InspectionTemplate, selected?: string | null): string {
  return template.unitTypes
    .map((t) => {
      const on = (selected ?? "").trim().toUpperCase() === t;
      return `<span class="ui-type${on ? " ui-type-on" : ""}">${t}</span>`;
    })
    .join("");
}

/** A drawn signature (or an empty ruled space when unsigned / blank form). */
function renderSignature(
  sigs: InspectionDocSignature[],
  phase: InspectionPhase,
  role: "inspector" | "tenant",
  t: (key: string) => string,
): string {
  const sig = sigs.find((s) => s.phase === phase && s.role === role);
  if (!sig) return `<span class="ui-sigblank">${escapeHtml(t("signature"))}</span>`;
  const name = sig.signer_name ? `<span class="ui-signame">${escapeHtml(sig.signer_name)}</span>` : "";
  return `<span class="ui-sig"><img src="${escapeHtml(sig.signature_image)}" alt="" />${name}</span>`;
}

/** Header block: 타입 / 호수 / 임차인명 / 연락처 / 입주일 / 퇴거일. */
function renderHeader(d: InspectionDocInput | null, template: InspectionTemplate, t: (key: string) => string): string {
  const m = d?.meta ?? {};
  return `<table class="ui-head">
      <tr>
        <th class="ui-hk">${escapeHtml(t("unitType"))}</th>
        <td class="ui-types">${renderUnitTypes(template, m.unit_type)}</td>
        <th class="ui-hk">${escapeHtml(t("tenantName"))}</th>
        <td>${fillLine(m.tenant_name)}</td>
        <th class="ui-hk">${escapeHtml(t("tenantPhone"))}</th>
        <td>${fillLine(m.tenant_phone, "010-")}</td>
      </tr>
      <tr>
        <th class="ui-hk">${escapeHtml(t("unitNo"))}</th>
        <td>${m.unit_no ? `${escapeHtml(m.unit_no)}` : ""} ${escapeHtml(t("unitSuffix"))}</td>
        <th class="ui-hk">${escapeHtml(t("moveInDate"))}</th>
        <td>${fillLine(m.move_in_date, t("yearPlaceholder"))}</td>
        <th class="ui-hk">${escapeHtml(t("moveOutDate"))}</th>
        <td>${fillLine(m.move_out_date, t("yearPlaceholder"))}</td>
      </tr>
    </table>`;
}

/** 검침 내역: 전입 / 전출 × 전기 · 수도 · 가스. */
function renderMeters(d: InspectionDocInput | null, t: (key: string) => string): string {
  const meters = d?.meta?.meters ?? {};
  const row = (label: string, side: { electric?: string | null; water?: string | null; gas?: string | null } = {}) =>
    `<tr>
      <th class="ui-hk">${escapeHtml(label)}</th>
      <th class="ui-mk">${escapeHtml(t("electric"))}</th><td class="ui-mv">${fillLine(side.electric)} kwh</td>
      <th class="ui-mk">${escapeHtml(t("water"))}</th><td class="ui-mv">${fillLine(side.water)} kwh</td>
      <th class="ui-mk">${escapeHtml(t("gas"))}</th><td class="ui-mv">${fillLine(side.gas)} kwh</td>
    </tr>`;
  return `<table class="ui-meters">
      ${row(t("metersIn"), meters.in)}
      ${row(t("metersOut"), meters.out)}
    </table>`;
}

/** One checklist cell: status chip + defect note + photo count. */
function renderCell(status: string | null, note: string | null, photos: number, t: (key: string) => string): string {
  if (!status && !note && !photos) return "";
  const chip = status
    ? `<span class="ui-chip ui-chip-${escapeHtml(status)}">${escapeHtml(t(STATUS_CHROME[status] ?? "") || status)}</span>`
    : "";
  const text = note ? `<span class="ui-note">${escapeHtml(note)}</span>` : "";
  const pics = photos ? `<span class="ui-pics">${escapeHtml(t("photoCount"))} ${photos}</span>` : "";
  return `${chip}${text}${pics}`;
}

/**
 * The 하자 내용 table. Groups come from the template so a blank form prints every
 * row in order; a filled form maps the saved items onto the same skeleton and
 * appends any custom rows added on site.
 */
function renderChecklist(
  d: InspectionDocInput | null,
  template: InspectionTemplate,
  hiddenCodes: Set<string>,
  lang: string,
  t: (key: string) => string,
): string {
  const byCode = new Map((d?.items ?? []).filter((i) => i.item_code).map((i) => [i.item_code as string, i]));
  const templateCodes = new Set(template.groups.flatMap((gr) => gr.items.map((i) => i.code)));
  const custom = (d?.items ?? []).filter((i) => !i.item_code || !templateCodes.has(i.item_code));

  const sigs = d?.signatures ?? [];
  const m = d?.meta ?? {};

  const visible = (code: string) => (d ? byCode.has(code) : !hiddenCodes.has(code));

  const groupRows = template.groups
    .map((group) => {
      const groupItems = group.items.filter((i) => visible(i.code));
      if (!groupItems.length) return "";
      const rows = groupItems.map((tItem, idx) => {
        const it = byCode.get(tItem.code);
        const inCell = renderCell(it?.move_in_status ?? null, it?.move_in_note ?? null, it?.photoCounts?.move_in ?? 0, t);
        const outCell = renderCell(it?.move_out_status ?? null, it?.move_out_note ?? null, it?.photoCounts?.move_out ?? 0, t);
        const groupCell =
          idx === 0
            ? `<th class="ui-group" rowspan="${groupItems.length}"><span>${escapeHtml(localize(group.label, lang))}</span></th>`
            : "";
        return `<tr>${groupCell}<td class="ui-item">${escapeHtml(localize(tItem.label, lang))}</td><td class="ui-fill">${inCell}</td><td class="ui-fill">${outCell}</td></tr>`;
      });
      return rows.join("");
    })
    .join("");

  const customRows = custom.length
    ? custom
        .map((it, idx) => {
          const groupCell =
            idx === 0
              ? `<th class="ui-group" rowspan="${custom.length}"><span>${escapeHtml(t("extraItems"))}</span></th>`
              : "";
          return `<tr>${groupCell}<td class="ui-item">${escapeHtml(it.label)}</td>
            <td class="ui-fill">${renderCell(it.move_in_status, it.move_in_note, it.photoCounts?.move_in ?? 0, t)}</td>
            <td class="ui-fill">${renderCell(it.move_out_status, it.move_out_note, it.photoCounts?.move_out ?? 0, t)}</td></tr>`;
        })
        .join("")
    : "";

  return `<table class="ui-list">
      <thead>
        <tr>
          <th class="ui-hk" style="width:9%;" rowspan="2">${escapeHtml(t("groupCol"))}</th>
          <th class="ui-hk" style="width:21%;" rowspan="2">${escapeHtml(t("itemCol"))}</th>
          <th style="width:35%;">${escapeHtml(t("inspectorIn"))}: ${renderSignature(sigs, "move_in", "inspector", t)} ${fillLine(m.inspector_in)}</th>
          <th style="width:35%;">${escapeHtml(t("inspectorOut"))}: ${renderSignature(sigs, "move_out", "inspector", t)} ${fillLine(m.inspector_out)}</th>
        </tr>
        <tr>
          <th class="ui-sub">${escapeHtml(t("confirmedOn"))} : ${fillLine(m.confirmed_in, t("datePlaceholder"))}</th>
          <th class="ui-sub">${escapeHtml(t("confirmedOn"))} : ${fillLine(m.confirmed_out, t("datePlaceholder"))}</th>
        </tr>
        <tr>
          <th class="ui-hk" colspan="2">${escapeHtml(t("tenantConfirm"))}</th>
          <th class="ui-sub">${renderSignature(sigs, "move_in", "tenant", t)}</th>
          <th class="ui-sub">${renderSignature(sigs, "move_out", "tenant", t)}</th>
        </tr>
      </thead>
      <tbody>${groupRows}${customRows}</tbody>
    </table>`;
}

/** 비고 free-text box. */
function renderRemarks(d: InspectionDocInput | null, t: (key: string) => string): string {
  return `<table class="ui-remarks">
      <tr><th class="ui-hk">${escapeHtml(t("remarks"))}</th><td>${fillLine(d?.meta?.remarks)}</td></tr>
    </table>`;
}

/** [특약 사항] numbered clauses. */
function renderSpecialTerms(template: InspectionTemplate, lang: string, t: (key: string) => string): string {
  const items = template.specialTerms
    .map((term, i) => `<li><span class="ui-num">${["①", "②", "③", "④", "⑤"][i] ?? `${i + 1}.`}</span>${escapeHtml(localize(term, lang))}</li>`)
    .join("");
  return `<div class="ui-terms">
      <h3>${escapeHtml(t("specialTerms"))}</h3>
      <ol>${items}</ol>
    </div>`;
}

const INSPECTION_STYLE = `<style>
  .ui-title { text-align:center; margin:0 0 16px; }
  .ui-title h1 { font-size:21px; font-weight:800; letter-spacing:0.04em; margin:0; }
  .ui-title .ui-ref { font-size:12px; color:#666; margin-top:4px; }
  .ui-sec { font-size:12.5px; font-weight:700; margin:14px 0 5px; }
  table.ui-head, table.ui-meters, table.ui-list, table.ui-remarks {
    width:100%; border-collapse:collapse; font-size:11px; margin:0 0 10px;
  }
  table.ui-head th, table.ui-head td,
  table.ui-meters th, table.ui-meters td,
  table.ui-list th, table.ui-list td,
  table.ui-remarks th, table.ui-remarks td { border:1px solid #b9c0cc; padding:4px 6px; }
  .ui-hk { background:#dce6f2; font-weight:700; text-align:center; white-space:nowrap; }
  .ui-mk { background:#eef3fa; font-weight:600; text-align:center; white-space:nowrap; width:7%; }
  .ui-mv { width:12%; text-align:right; }
  .ui-types { letter-spacing:0.35em; font-weight:700; }
  .ui-type { display:inline-block; padding:0 3px; }
  .ui-type-on { background:#1f3c88; color:#fff; border-radius:3px; letter-spacing:0; padding:0 6px; }
  table.ui-list th { background:#eef3fa; text-align:left; font-weight:700; }
  table.ui-list th.ui-sub { font-weight:600; background:#f7f9fc; }
  .ui-group { background:#eef3fa; text-align:center; font-weight:700; }
  .ui-group span { writing-mode:horizontal-tb; }
  .ui-item { text-align:center; }
  .ui-fill { height:17px; }
  .ui-chip { display:inline-block; font-size:9.5px; font-weight:700; padding:0 4px; border-radius:3px; margin-right:4px; }
  .ui-chip-ok { background:#e8f5ec; color:#1e7a43; }
  .ui-chip-defect { background:#fdeaea; color:#c0392b; }
  .ui-chip-na { background:#eee; color:#666; }
  .ui-note { font-size:10.5px; }
  .ui-pics { font-size:9.5px; color:#1f3c88; margin-left:5px; }
  .ui-sig img { height:26px; vertical-align:middle; }
  .ui-signame { font-size:10px; margin-left:4px; }
  .ui-sigblank { font-size:10px; color:#888; }
  table.ui-remarks td { height:52px; vertical-align:top; }
  .ui-terms { border:1px solid #b9c0cc; padding:8px 10px; margin-top:8px; }
  .ui-terms h3 { font-size:11.5px; margin:0 0 5px; }
  .ui-terms ol { list-style:none; margin:0; padding:0; }
  .ui-terms li { font-size:10.5px; line-height:1.55; margin-bottom:4px; }
  .ui-num { font-weight:700; margin-right:3px; }
  @media print { table.ui-list tr { page-break-inside:avoid; } }
</style>`;

/** Build the inner body HTML (no shell). `d = null` prints a blank form. */
export function buildUnitInspectionBody(
  d: InspectionDocInput | null,
  template: InspectionTemplate,
  companyName: string,
  hiddenCodes: Set<string> = new Set(),
  lang = "ko",
): string {
  const t = (key: string) => chrome(template, key, lang);
  const ref = d?.report_ref ? `<div class="ui-ref">${escapeHtml(d.report_ref)}</div>` : "";
  return `${INSPECTION_STYLE}
    <div class="ui-title">
      <h1>${escapeHtml(companyName)} ${escapeHtml(localize(template.heading, lang))}</h1>
      ${ref}
    </div>
    ${renderHeader(d, template, t)}
    <div class="ui-sec">${escapeHtml(t("inspectionSection"))}</div>
    ${renderMeters(d, t)}
    <div class="ui-sec">${escapeHtml(t("defectsSection"))}</div>
    ${renderChecklist(d, template, hiddenCodes, lang, t)}
    ${renderRemarks(d, t)}
    ${renderSpecialTerms(template, lang, t)}
  `;
}

/** Build the full standalone HTML document. Pass `data: null` for a blank form. */
export function buildUnitInspectionHtml(opts: {
  data: InspectionDocInput | null;
  templateKey?: string | null;
  company?: CompanyInfo;
  forPrint?: boolean;
  /** Overrides the heading prefix; defaults to the company's trading name. */
  headingPrefix?: string | null;
  /** Template rows switched off in 설정 — dropped from the blank form. */
  hiddenCodes?: Set<string>;
  /** Document language (ko default — the form is a Korean lease document). */
  lang?: string;
}): string {
  const co = opts.company ?? getCompanyInfo();
  const template = getInspectionTemplate(opts.templateKey);
  const lang = opts.lang ?? "ko";
  const prefix = (opts.headingPrefix ?? co.tradingName ?? co.legalName ?? "").trim();
  return renderDocumentShell({
    docType: localize(template.heading, lang),
    bodyHtml: buildUnitInspectionBody(opts.data, template, prefix, opts.hiddenCodes ?? new Set(), lang),
    company: co,
    forPrint: opts.forPrint ?? true,
  });
}

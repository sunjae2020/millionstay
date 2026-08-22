/**
 * Document Hub — 작업지시서 / 하자·청소 청구 명세서 builders.
 *
 * Two documents off one module because they read the same ledger:
 *
 *  - **작업지시서 (A)** — one work order as a paper job sheet: 대상 세대, 작업
 *    분류, 일정, 담당, 작업내용, 비용(작업비용 · 원천징수 · 실지급액), 그리고
 *    요청(before)/완료(after) 사진. 파트너에게 보내는 지시서이자 완료 보고서다.
 *
 *  - **하자·청소 청구 명세서 (B)** — 기간 안의 작업지시를 한 장에 묶은 청구
 *    명세서. Metheim 여수가 손으로 쓰던 "임대청소 & 하자 청구서" 시트를 그대로
 *    옮긴 것이라 컬럼 순서(순번 · 작업일자 · 호수 · 타입 · 작업분류 · 작업비용 ·
 *    청구비용 · 작업내용)를 바꾸지 않는다. 회사에 청구할 때 **각 호수의 사진**이
 *    같은 PDF 뒤에 증빙으로 붙는다.
 *
 * 청구비용은 작업비용에서 원천징수를 뺀 값이다 (₩100,000 → ₩96,700 = 3.3%).
 * 작업지시의 실지급액(net_cost)·원천징수액이 채워져 있으면 그 값이 먼저고,
 * 비어 있는 건에만 호출자가 준 원천징수율로 계산한다 — `billedAmountOf()`의 순서.
 */
import { renderDocumentShell, escapeHtml, formatDocMoney, getCompanyInfo, type CompanyInfo } from "./theme";
import { formatDocDate, t, statusLabel, type DocLang } from "./i18n";

// ── 공통 ────────────────────────────────────────────────────────────────────

const DASH = "—";

function line(value: string | null | undefined): string {
  const v = (value ?? "").toString().trim();
  return v ? escapeHtml(v) : DASH;
}

/** 여러 줄 텍스트를 표 칸 안에서 줄바꿈까지 살려 찍는다. */
function multiline(value: string | null | undefined): string {
  const v = (value ?? "").toString().trim();
  if (!v) return DASH;
  return escapeHtml(v).replace(/\r?\n/g, "<br/>");
}

/**
 * 작업분류 — DB에는 canonical 값(`repair` · `move_out_cleaning` …)이 들어 있다.
 * 정본 분류표는 `@workspace/api-zod`의 `WORK_ORDER_CATEGORIES`이고, 여기서는
 * 그 값을 문서 언어로 옮긴다. 분류표에 없는 옛 표기는 원문 그대로 찍는다.
 */
function categoryLabel(lang: DocLang, value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return DASH;
  const key = `wo.cat.${raw}`;
  const label = t(lang, key);
  return label === key ? escapeHtml(raw) : escapeHtml(label);
}

/** 출입 방법 (vacant_key | tenant_present | lockbox | agent | other). */
function accessLabel(lang: DocLang, value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return DASH;
  const key = `wo.access.${raw}`;
  const label = t(lang, key);
  return label === key ? escapeHtml(raw) : escapeHtml(label);
}

/**
 * 청구비용 — 원장에 적힌 값이 먼저다.
 *   net_cost → cost - withholding_amount + vat_amount → cost × (1 - 원천징수율)
 */
export function billedAmountOf(
  row: {
    cost?: number | null;
    net_cost?: number | null;
    withholding_amount?: number | null;
    vat_amount?: number | null;
  },
  withholdingPct = 0,
): number {
  const cost = Number(row.cost ?? 0);
  if (row.net_cost != null) return Number(row.net_cost);
  if (row.withholding_amount != null || row.vat_amount != null) {
    return cost - Number(row.withholding_amount ?? 0) + Number(row.vat_amount ?? 0);
  }
  if (withholdingPct > 0) return Math.round(cost * (1 - withholdingPct / 100));
  return cost;
}

const SHARED_STYLE = `
  .wo-title { text-align:center; margin:0 0 14px; }
  .wo-title h1 { font-size:20px; font-weight:800; letter-spacing:0.03em; margin:0; }
  .wo-title .wo-sub { font-size:12px; color:#666; margin-top:4px; }
  table.wo-grid { width:100%; border-collapse:collapse; font-size:11.5px; margin:0 0 10px; }
  table.wo-grid th, table.wo-grid td { border:1px solid #b9c0cc; padding:5px 7px; vertical-align:top; }
  table.wo-grid th { background:#dce6f2; font-weight:700; text-align:center; white-space:nowrap; width:13%; }
  .wo-sec { font-size:12.5px; font-weight:700; margin:14px 0 5px; }
  .wo-money { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .wo-photos { display:flex; flex-wrap:wrap; gap:6px; margin:0 0 10px;
    --wo-photo-w:31.5%; --wo-photo-h:132px; }
  .wo-photo { width:var(--wo-photo-w); border:1px solid #b9c0cc; padding:3px; }
  /* 사진은 원본 비율 그대로(contain) — 타일 크기만 photo_size로 조절한다. */
  .wo-photo img { width:100%; height:var(--wo-photo-h); object-fit:contain;
    background:#f7f8fa; display:block; }
  .wo-photo .wo-cap { font-size:9.5px; color:#555; margin-top:2px; text-align:center;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .wo-empty { font-size:11px; color:#888; padding:6px 0; }
  @media print { .wo-photo, table.wo-grid tr { page-break-inside:avoid; } }
`;

/**
 * 사진 타일 크기. 원본 비율은 언제나 유지하고(잘라내지 않는다) 타일 한 칸의
 * 폭·높이만 바꾼다 — s는 한 줄 4장, m은 3장, l은 2장.
 */
export type DocPhotoSize = "s" | "m" | "l";

const PHOTO_SIZES: Record<DocPhotoSize, { w: string; h: string }> = {
  s: { w: "23.2%", h: "92px" },
  m: { w: "31.5%", h: "132px" },
  l: { w: "48.5%", h: "210px" },
};

export function normalizeDocPhotoSize(v: unknown): DocPhotoSize {
  const k = String(v ?? "").trim().toLowerCase();
  if (k === "s" || k === "small") return "s";
  if (k === "l" || k === "large") return "l";
  return "m";
}

/** photo_size를 CSS 변수로 덮어쓰는 스타일 조각. */
function photoSizeStyle(size: DocPhotoSize | undefined): string {
  if (!size) return "";
  const { w, h } = PHOTO_SIZES[size];
  return `<style>.wo-photos { --wo-photo-w:${w}; --wo-photo-h:${h}; }</style>`;
}

/** 사진 묶음 하나 (요청/완료, 또는 호수별 증빙). */
function renderPhotoGrid(photos: Array<{ url: string; caption?: string | null }>, emptyText: string): string {
  if (!photos.length) return `<div class="wo-empty">${escapeHtml(emptyText)}</div>`;
  const cells = photos
    .map(
      (p) => `<div class="wo-photo"><img src="${escapeHtml(p.url)}" alt="" />${
        p.caption ? `<div class="wo-cap">${escapeHtml(p.caption)}</div>` : ""
      }</div>`,
    )
    .join("");
  return `<div class="wo-photos">${cells}</div>`;
}

/**
 * 회차(세션)별로 나눠 그린다. 재방문 작업이면 `1차 / 2차`가 각자의 소제목을
 * 달고 떨어져 나오므로, 종이에서도 언제 찍은 사진인지 헷갈리지 않는다.
 * 회차가 하나뿐이면 소제목 없이 그냥 한 판으로 둔다.
 */
function renderPhotoSessions(photos: WorkOrderDocPhoto[], lang: DocLang, emptyText: string): string {
  if (!photos.length) return `<div class="wo-empty">${escapeHtml(emptyText)}</div>`;
  const groups = new Map<number, WorkOrderDocPhoto[]>();
  for (const p of photos) {
    const no = p.session_no && p.session_no > 0 ? p.session_no : 1;
    groups.set(no, [...(groups.get(no) ?? []), p]);
  }
  const ordered = [...groups.entries()].sort((a, b) => a[0] - b[0]);
  if (ordered.length === 1) return renderPhotoGrid(ordered[0]![1], emptyText);
  return ordered
    .map(([no, group]) =>
      `<div class="wo-session">${escapeHtml(t(lang, "wo.photoSession", { n: String(no) }))}</div>${renderPhotoGrid(group, emptyText)}`,
    )
    .join("");
}

/** 서명란 — 미서명이면 빈 칸, 서명 완료면 서명 이미지 + 인증 정보. */
function renderSignatureBlock(d: WorkOrderDocInput, lang: DocLang): string {
  const sig = d.signature;
  const confirmed = sig?.signature_image
    ? `<img class="wo-sig-img" src="${escapeHtml(sig.signature_image)}" alt="" />` +
      (sig.signer_name ? `<div class="wo-sig-name">${escapeHtml(sig.signer_name)}</div>` : "")
    : "";

  const table = `<table class="wo-sign">
      <tr>
        <th>${escapeHtml(t(lang, "wo.requestedBy"))}</th><td></td>
        <th>${escapeHtml(t(lang, "wo.performedBy"))}</th><td></td>
        <th>${escapeHtml(t(lang, "wo.confirmedBy"))}</th><td>${confirmed}</td>
      </tr>
    </table>`;

  if (!sig?.signature_image) return table;

  const rows: Array<[string, string]> = [
    [t(lang, "wo.signerName"), sig.signer_name ?? DASH],
    [t(lang, "wo.signedAt"), formatDocDate(sig.signed_at, lang, DASH)],
    [t(lang, "wo.signIp"), sig.ip || DASH],
    [t(lang, "wo.signDevice"), sig.user_agent || DASH],
    [t(lang, "wo.signConsent"), sig.consent_text || t(lang, "wo.signConsentText")],
  ];
  if (sig.content_hash) rows.push([t(lang, "wo.signHash"), sig.content_hash]);

  return `${table}
    <div class="wo-sec">${escapeHtml(t(lang, "wo.signAudit"))}</div>
    <table class="wo-grid wo-audit">
      ${rows.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td colspan="5">${escapeHtml(v)}</td></tr>`).join("")}
    </table>`;
}

// ── A. 작업지시서 ────────────────────────────────────────────────────────────

export interface WorkOrderDocPhoto {
  url: string;
  kind: string; // before | after
  /** 회차 — 한 번의 업로드가 한 세션이다. 없으면 1차로 본다. */
  session_no?: number | null;
  caption?: string | null;
}

/**
 * 무로그인 링크로 받은 시설 담당자의 확인 서명. 서명 이미지와 함께 **어떤 기기·
 * 어느 IP에서 언제 서명했는지**를 문서에 같이 박아 두는 것이 요점 — 전자서명의
 * 효력은 그 기록에서 나온다.
 */
export interface WorkOrderDocSignature {
  signer_name?: string | null;
  signature_image?: string | null; // data URL
  signed_at?: string | Date | null;
  ip?: string | null;
  user_agent?: string | null;
  consent_text?: string | null;
  content_hash?: string | null;
}

export interface WorkOrderDocInput {
  order_ref: string;
  title: string;
  description?: string | null;
  notes?: string | null;
  status: string;
  priority?: string | null;
  category?: string | null;
  property_name?: string | null;
  unit_no?: string | null;
  unit_type?: string | null;
  floor?: number | null;
  reported_at?: string | null;
  scheduled_at?: string | Date | null;
  completed_at?: string | Date | null;
  assignee_name?: string | null;
  partner_name?: string | null;
  attendee_name?: string | null;
  location_note?: string | null;
  access_method?: string | null;
  currency: string;
  cost?: number | null;
  /** 작업비용에서 뺀 원천징수액. 원장 컬럼이 붙기 전에는 비율로 계산한 값이다. */
  withholding_amount?: number | null;
  /** 작업비용에 얹은 부가세 10% (일반과세자 거래에서만 채워진다). */
  vat_amount?: number | null;
  billed_amount: number;
  photos: WorkOrderDocPhoto[];
  /** 확인 서명이 끝났으면 서명란이 실제 서명 + 인증 정보로 채워진다. */
  signature?: WorkOrderDocSignature | null;
  /** 사진 타일 크기 (기본 m). 비율은 유지되고 크기만 바뀐다. */
  photo_size?: DocPhotoSize;
}

const WORK_ORDER_STYLE = `<style>
  ${SHARED_STYLE}
  table.wo-sign { width:100%; border-collapse:collapse; font-size:11.5px; margin-top:14px; }
  table.wo-sign th, table.wo-sign td { border:1px solid #b9c0cc; padding:5px 7px; }
  table.wo-sign th { background:#eef3fa; font-weight:700; text-align:center; white-space:nowrap; width:16%; }
  table.wo-sign td { height:44px; }
  .wo-session { font-size:11px; font-weight:700; color:#41506a; margin:10px 0 4px; }
  .wo-sig-img { max-height:38px; max-width:100%; display:block; margin:0 auto; }
  .wo-sig-name { text-align:center; font-size:10.5px; color:#41506a; margin-top:2px; }
  table.wo-audit td { word-break:break-all; font-size:10.5px; }
</style>`;

export function buildWorkOrderBody(
  d: WorkOrderDocInput,
  lang: DocLang,
  opts: { confirmation?: boolean } = {},
): string {
  // 서명 링크로 나가는 문서는 "작업 확인서" 로 제목이 바뀐다 — 받는 사람이
  // 지시서가 아니라 확인을 요청받는 쪽이기 때문이다.
  const heading = t(lang, opts.confirmation ? "wo.confirmHeading" : "wo.heading");
  const before = d.photos.filter((p) => p.kind === "before");
  const after = d.photos.filter((p) => p.kind !== "before");
  const money = (v: number | null | undefined) => (v == null ? DASH : formatDocMoney(v, d.currency));

  return `${WORK_ORDER_STYLE}${photoSizeStyle(d.photo_size)}
    <div class="wo-title">
      <h1>${escapeHtml(heading)}</h1>
      <div class="wo-sub">${escapeHtml(d.order_ref)}</div>
    </div>

    <table class="wo-grid">
      <tr>
        <th>${escapeHtml(t(lang, "building"))}</th><td>${line(d.property_name)}</td>
        <th>${escapeHtml(t(lang, "unitNo"))}</th><td>${line(d.unit_no)}</td>
        <th>${escapeHtml(t(lang, "unitType"))}</th><td>${line(d.unit_type)}</td>
      </tr>
      <tr>
        <th>${escapeHtml(t(lang, "floor"))}</th><td>${line(d.floor == null ? null : String(d.floor))}</td>
        <th>${escapeHtml(t(lang, "wo.category"))}</th><td>${categoryLabel(lang, d.category)}</td>
        <th>${escapeHtml(t(lang, "wo.status"))}</th><td>${escapeHtml(statusLabel(lang, d.status))}</td>
      </tr>
      <tr>
        <th>${escapeHtml(t(lang, "wo.reportedAt"))}</th><td>${escapeHtml(formatDocDate(d.reported_at, lang, DASH))}</td>
        <th>${escapeHtml(t(lang, "wo.scheduledAt"))}</th><td>${escapeHtml(formatDocDate(d.scheduled_at, lang, DASH))}</td>
        <th>${escapeHtml(t(lang, "wo.completedAt"))}</th><td>${escapeHtml(formatDocDate(d.completed_at, lang, DASH))}</td>
      </tr>
      <tr>
        <th>${escapeHtml(t(lang, "wo.partner"))}</th><td>${line(d.partner_name)}</td>
        <th>${escapeHtml(t(lang, "wo.assignee"))}</th><td>${line(d.assignee_name)}</td>
        <th>${escapeHtml(t(lang, "wo.attendee"))}</th><td>${line(d.attendee_name)}</td>
      </tr>
      <tr>
        <th>${escapeHtml(t(lang, "wo.accessMethod"))}</th><td>${accessLabel(lang, d.access_method)}</td>
        <th>${escapeHtml(t(lang, "wo.locationNote"))}</th><td colspan="3">${line(d.location_note)}</td>
      </tr>
    </table>

    <div class="wo-sec">${escapeHtml(t(lang, "wo.workDetail"))}</div>
    <table class="wo-grid">
      <tr><th>${escapeHtml(t(lang, "wo.subject"))}</th><td colspan="5">${line(d.title)}</td></tr>
      <tr><th>${escapeHtml(t(lang, "description"))}</th><td colspan="5">${multiline(d.description)}</td></tr>
      <tr><th>${escapeHtml(t(lang, "notes"))}</th><td colspan="5">${multiline(d.notes)}</td></tr>
    </table>

    <div class="wo-sec">${escapeHtml(t(lang, "wo.costs"))}</div>
    <table class="wo-grid">
      <tr>
        <th>${escapeHtml(t(lang, "wo.workCost"))}</th><td class="wo-money">${money(d.cost)}</td>
        <th>${escapeHtml(t(lang, "wo.withholding"))}</th><td class="wo-money">${money(d.withholding_amount)}</td>
        <th>${escapeHtml(t(lang, "wo.vat"))}</th><td class="wo-money">${money(d.vat_amount)}</td>
      </tr>
      <tr>
        <th>${escapeHtml(t(lang, "wo.billedCost"))}</th>
        <td class="wo-money" colspan="5"><strong>${money(d.billed_amount)}</strong></td>
      </tr>
    </table>

    <div class="wo-sec">${escapeHtml(t(lang, "wo.photosBefore"))}</div>
    ${renderPhotoSessions(before, lang, t(lang, "wo.noPhotos"))}
    <div class="wo-sec">${escapeHtml(t(lang, "wo.photosAfter"))}</div>
    ${renderPhotoSessions(after, lang, t(lang, "wo.noPhotos"))}

    ${renderSignatureBlock(d, lang)}
  `;
}

export function buildWorkOrderHtml(opts: {
  data: WorkOrderDocInput;
  company?: CompanyInfo;
  lang?: DocLang;
  forPrint?: boolean;
  /** 확인 서명용 문서(작업 확인서)로 낼 때. */
  confirmation?: boolean;
}): string {
  const co = opts.company ?? getCompanyInfo();
  const lang = opts.lang ?? "ko";
  return renderDocumentShell({
    docType: t(lang, opts.confirmation ? "wo.confirmHeading" : "wo.heading"),
    bodyHtml: buildWorkOrderBody(opts.data, lang, { confirmation: opts.confirmation }),
    company: co,
    forPrint: opts.forPrint ?? true,
  });
}

// ── B. 하자·청소 청구 명세서 ─────────────────────────────────────────────────

export interface RepairBillingRow {
  seq: number;
  /** 이 줄을 만든 작업지시(work_orders.id) — 청구서 줄이 되짚는 대상. */
  work_order_id: number;
  order_ref: string;
  work_date?: string | Date | null;
  unit_no?: string | null;
  unit_type?: string | null;
  category?: string | null;
  detail?: string | null;
  cost: number;
  billed: number;
  photos: Array<{ url: string; caption?: string | null }>;
}

export interface RepairBillingInput {
  property_name?: string | null;
  /** 청구 대상 (회사/계정명). */
  bill_to?: string | null;
  period_from?: string | null;
  period_to?: string | null;
  currency: string;
  rows: RepairBillingRow[];
  /** 각 호수 사진을 명세서 뒤에 증빙으로 붙일지. */
  includePhotos: boolean;
  /** net_cost도 withholding도 없는 행에 적용한 원천징수율 (표기용). */
  withholdingPct?: number;
  /** 증빙 사진 타일 크기 (기본 m). */
  photo_size?: DocPhotoSize;
}

const BILLING_STYLE = `<style>
  ${SHARED_STYLE}
  table.wo-lines { width:100%; border-collapse:collapse; font-size:10.5px; margin:0 0 12px; }
  table.wo-lines th, table.wo-lines td { border:1px solid #b9c0cc; padding:4px 6px; vertical-align:top; }
  table.wo-lines thead th { background:#dce6f2; font-weight:700; text-align:center; white-space:nowrap; }
  table.wo-lines td.wo-c { text-align:center; white-space:nowrap; }
  table.wo-lines tfoot th, table.wo-lines tfoot td { background:#eef3fa; font-weight:700; }
  .wo-summary { display:flex; gap:8px; margin:0 0 12px; }
  .wo-card { flex:1; border:1px solid #b9c0cc; padding:8px 10px; }
  .wo-card .wo-k { font-size:10px; color:#555; }
  .wo-card .wo-v { font-size:15px; font-weight:800; margin-top:2px; }
  .wo-unit { font-size:11.5px; font-weight:700; margin:10px 0 4px; padding-bottom:3px; border-bottom:1px solid #b9c0cc; }
  .wo-note { font-size:10px; color:#666; margin-top:8px; }
</style>`;

export function buildRepairBillingBody(d: RepairBillingInput, lang: DocLang, headingPrefix: string): string {
  const money = (v: number) => formatDocMoney(v, d.currency);
  const totalCost = d.rows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const totalBilled = d.rows.reduce((s, r) => s + Number(r.billed ?? 0), 0);
  const period = [d.period_from, d.period_to]
    .map((v) => formatDocDate(v, lang, ""))
    .filter(Boolean)
    .join(" ~ ");

  const lines = d.rows.length
    ? d.rows
        .map(
          (r) => `<tr>
            <td class="wo-c">${r.seq}</td>
            <td class="wo-c">${escapeHtml(formatDocDate(r.work_date, lang, DASH))}</td>
            <td class="wo-c">${line(r.unit_no)}</td>
            <td class="wo-c">${line(r.unit_type)}</td>
            <td class="wo-c">${categoryLabel(lang, r.category)}</td>
            <td class="wo-money">${money(Number(r.cost ?? 0))}</td>
            <td class="wo-money">${money(Number(r.billed ?? 0))}</td>
            <td>${multiline(r.detail)}</td>
          </tr>`,
        )
        .join("")
    : `<tr><td class="wo-c" colspan="8">${escapeHtml(t(lang, "wo.noRows"))}</td></tr>`;

  const photoPages = d.includePhotos
    ? d.rows
        .filter((r) => r.photos.length)
        .map(
          (r) => `<div class="wo-unit">${r.seq}. ${line(r.unit_no)} · ${categoryLabel(lang, r.category)} <span style="font-weight:400;color:#666;">${escapeHtml(r.order_ref)}</span></div>
            ${renderPhotoGrid(r.photos, t(lang, "wo.noPhotos"))}`,
        )
        .join("")
    : "";

  const photoSection = d.includePhotos
    ? `<div class="wo-sec">${escapeHtml(t(lang, "wo.evidence"))}</div>
       ${photoPages || `<div class="wo-empty">${escapeHtml(t(lang, "wo.noPhotos"))}</div>`}`
    : "";

  const withholdingNote = d.withholdingPct
    ? `<div class="wo-note">${escapeHtml(t(lang, "wo.withholdingNote", { pct: String(d.withholdingPct) }))}</div>`
    : "";

  return `${BILLING_STYLE}${photoSizeStyle(d.photo_size)}
    <div class="wo-title">
      <h1>${escapeHtml([headingPrefix, d.property_name].filter(Boolean).join(" "))} ${escapeHtml(t(lang, "wo.billing.heading"))}</h1>
      <div class="wo-sub">${escapeHtml(period || DASH)}</div>
    </div>

    <table class="wo-grid">
      <tr>
        <th>${escapeHtml(t(lang, "billTo"))}</th><td>${line(d.bill_to)}</td>
        <th>${escapeHtml(t(lang, "building"))}</th><td>${line(d.property_name)}</td>
        <th>${escapeHtml(t(lang, "billingPeriod"))}</th><td>${escapeHtml(period || DASH)}</td>
      </tr>
    </table>

    <div class="wo-summary">
      <div class="wo-card"><div class="wo-k">${escapeHtml(t(lang, "wo.itemCount"))}</div><div class="wo-v">${d.rows.length}</div></div>
      <div class="wo-card"><div class="wo-k">${escapeHtml(t(lang, "wo.workCostTotal"))}</div><div class="wo-v">${money(totalCost)}</div></div>
      <div class="wo-card"><div class="wo-k">${escapeHtml(t(lang, "wo.billedTotal"))}</div><div class="wo-v">${money(totalBilled)}</div></div>
    </div>

    <table class="wo-lines">
      <thead>
        <tr>
          <th style="width:5%;">${escapeHtml(t(lang, "wo.no"))}</th>
          <th style="width:11%;">${escapeHtml(t(lang, "wo.workDate"))}</th>
          <th style="width:8%;">${escapeHtml(t(lang, "unitNo"))}</th>
          <th style="width:7%;">${escapeHtml(t(lang, "unitType"))}</th>
          <th style="width:11%;">${escapeHtml(t(lang, "wo.category"))}</th>
          <th style="width:12%;">${escapeHtml(t(lang, "wo.workCost"))}</th>
          <th style="width:12%;">${escapeHtml(t(lang, "wo.billedCost"))}</th>
          <th>${escapeHtml(t(lang, "wo.workDetail"))}</th>
        </tr>
      </thead>
      <tbody>${lines}</tbody>
      <tfoot>
        <tr>
          <th colspan="5">${escapeHtml(t(lang, "total"))}</th>
          <td class="wo-money">${money(totalCost)}</td>
          <td class="wo-money">${money(totalBilled)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
    ${withholdingNote}
    ${photoSection}
  `;
}

export function buildRepairBillingHtml(opts: {
  data: RepairBillingInput;
  company?: CompanyInfo;
  lang?: DocLang;
  forPrint?: boolean;
  /** 제목 앞에 붙는 상호. 기본은 회사 상호 (예: "메트하임 여수 … 청구 명세서"). */
  headingPrefix?: string | null;
}): string {
  const co = opts.company ?? getCompanyInfo();
  const lang = opts.lang ?? "ko";
  const prefix = (opts.headingPrefix ?? co.tradingName ?? co.legalName ?? "").trim();
  return renderDocumentShell({
    docType: t(lang, "wo.billing.heading"),
    bodyHtml: buildRepairBillingBody(opts.data, lang, prefix),
    company: co,
    forPrint: opts.forPrint ?? true,
  });
}

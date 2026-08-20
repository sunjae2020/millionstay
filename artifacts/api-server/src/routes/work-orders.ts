import { Router } from "express";
import { DEFAULT_CURRENCY } from "../lib/currency";
import multer from "multer";
import { db, workOrdersTable, workOrderPhotosTable, propertiesTable, spacesTable, contactsTable, serviceHostsTable, invoicesTable, invoiceLineItemsTable, accountsTable, usersTable } from "@workspace/db";
import { formatPersonName } from "../lib/nameFormat";
import { sendAppointmentConfirmationEmail } from "../lib/email";
import { eq, ilike, and, isNull, inArray, desc, sql } from "drizzle-orm";
import { dispatchWorkOrder } from "../lib/dispatch/workOrderDispatch";
import { logAction } from "../utils/auditLog";
import { keywordCondition, spaceIdsByName, propertyIdsByName, dateRangeConditions, yearConditions, distinctYears, distinctValues } from "../lib/listSearch";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import { uploadToCloudinary, isCloudinaryConfigured, cldFolder } from "../utils/cloudinary";
import { getRateToAud } from "../lib/rateSnapshot";
import {
  canonicalWorkOrderCategory,
  workOrderCategoryAliases,
  sortWorkOrderCategories,
  CreateWorkOrderBody,
  UpdateWorkOrderBody,
  CompleteWorkOrderBody,
  CancelWorkOrderBody,
} from "@workspace/api-zod";
import { computeTax } from "./invoices";
import { htmlToPdf, PdfUnavailableError } from "../lib/documents/pdf";
import { resolveCompanyInfo } from "../lib/documents/companyInfo";
import { normalizeLang } from "../lib/documents/i18n";
import { buildReportFileName, resolveDocFileName, setDocFileName } from "../lib/documents/docFileName";
import {
  billedAmountOf,
  buildRepairBillingHtml,
  buildWorkOrderHtml,
  type RepairBillingRow,
  type WorkOrderDocInput,
} from "../lib/documents/workOrderDocument";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function nextInvoiceRef(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db.select({ id: invoicesTable.id }).from(invoicesTable)
    .where(ilike(invoicesTable.invoice_ref, `MS-INV-${year}-%`));
  return `MS-INV-${year}-${String(rows.length + 1).padStart(5, "0")}`;
}

async function nextOrderRef(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db.select({ id: workOrdersTable.id }).from(workOrdersTable)
    .where(ilike(workOrdersTable.order_ref, `MS-WO-${year}-%`));
  const count = rows.length + 1;
  return `MS-WO-${year}-${String(count).padStart(5, "0")}`;
}

async function enrichWorkOrders(rows: (typeof workOrdersTable.$inferSelect)[]) {
  if (rows.length === 0) return [];
  const propertyIds = [...new Set(rows.map(r => r.property_id).filter(Boolean))] as number[];
  const spaceIds = [...new Set(rows.map(r => r.space_id).filter(Boolean))] as number[];
  const contactIds = [...new Set(rows.flatMap(r => [r.assigned_contact_id, r.attendee_contact_id]).filter(Boolean))] as number[];
  const userIds = [...new Set(rows.map(r => r.assigned_user_id).filter(Boolean))] as number[];
  const hostIds = [...new Set(rows.map(r => r.service_host_id).filter(Boolean))] as number[];

  const propertyMap: Record<number, string> = {};
  const spaceMap: Record<number, string> = {};
  const contactMap: Record<number, string> = {};
  const hostMap: Record<number, string> = {};
  const userMap: Record<number, string> = {};

  // Batched lookups — see enrichContracts in contracts.ts.
  const [propertyRows, spaceRows, contactRows, hostRows, userRows] = await Promise.all([
    propertyIds.length
      ? db.select({ id: propertiesTable.id, name: propertiesTable.name }).from(propertiesTable).where(inArray(propertiesTable.id, propertyIds))
      : Promise.resolve([]),
    spaceIds.length
      ? db.select({ id: spacesTable.id, name: spacesTable.name }).from(spacesTable).where(inArray(spacesTable.id, spaceIds))
      : Promise.resolve([]),
    contactIds.length
      ? db.select({ id: contactsTable.id, first_name: contactsTable.first_name, last_name: contactsTable.last_name }).from(contactsTable).where(inArray(contactsTable.id, contactIds))
      : Promise.resolve([]),
    hostIds.length
      ? db.select({ id: serviceHostsTable.id, name: serviceHostsTable.name }).from(serviceHostsTable).where(inArray(serviceHostsTable.id, hostIds))
      : Promise.resolve([]),
    userIds.length
      ? db.select({ id: usersTable.id, first_name: usersTable.first_name, last_name: usersTable.last_name, email: usersTable.email }).from(usersTable).where(inArray(usersTable.id, userIds))
      : Promise.resolve([]),
  ]);
  for (const p of propertyRows) propertyMap[p.id] = p.name;
  for (const s of spaceRows) spaceMap[s.id] = s.name;
  for (const c of contactRows) contactMap[c.id] = formatPersonName(c.first_name, c.last_name);
  for (const h of hostRows) hostMap[h.id] = h.name;
  for (const u of userRows) userMap[u.id] = formatPersonName(u.first_name, u.last_name) || u.email;

  return rows.map(r => ({
    ...r,
    // 백필 전 옛 표기(`Cleaning`/`청소`)가 남아 있어도 화면은 표준값 하나로 본다.
    category: canonicalWorkOrderCategory(r.category),
    property_name: r.property_id ? (propertyMap[r.property_id] ?? null) : null,
    space_name: r.space_id ? (spaceMap[r.space_id] ?? null) : null,
    assigned_contact_name: r.assigned_contact_id ? (contactMap[r.assigned_contact_id] ?? null) : null,
    service_host_name: r.service_host_id ? (hostMap[r.service_host_id] ?? null) : null,
    attendee_contact_name: r.attendee_contact_id ? (contactMap[r.attendee_contact_id] ?? null) : null,
    assigned_user_name: r.assigned_user_id ? (userMap[r.assigned_user_id] ?? null) : null,
  }));
}

// 방문 약속 fields — the generated zod bodies strip unknown keys, so these ride
// straight off req.body (same pattern as the Korean payment fields on contracts).
type AppointmentFields = Partial<Pick<typeof workOrdersTable.$inferInsert,
  "scheduled_start_at" | "scheduled_end_at" | "assigned_user_id" | "attendee_contact_id"
  | "location_note" | "access_method" | "inspection_type" | "condition_report_id">>;

function appointmentFieldsFrom(body: any, { partial }: { partial: boolean }): AppointmentFields {
  const num = (v: any) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const str = (v: any) => (v === null || v === undefined || v === "" ? null : String(v));
  const when = (v: any) => {
    if (v === null || v === undefined || v === "") return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const out: AppointmentFields = {};
  const take = (key: keyof AppointmentFields, value: any) => {
    if (partial && body?.[key] === undefined) return;
    (out as any)[key] = value;
  };
  take("scheduled_start_at", when(body?.scheduled_start_at));
  take("scheduled_end_at", when(body?.scheduled_end_at));
  take("assigned_user_id", num(body?.assigned_user_id));
  take("attendee_contact_id", num(body?.attendee_contact_id));
  take("location_note", str(body?.location_note));
  take("access_method", str(body?.access_method));
  take("inspection_type", str(body?.inspection_type));
  take("condition_report_id", num(body?.condition_report_id));
  return out;
}

router.get("/v1/work-orders", async (req, res): Promise<void> => {
  const {
    q, status, priority, property_id, space_id, category,
    date_from, date_to, year,
  } = req.query as Record<string, string>;
  const conditions: any[] = [deletedFilter(workOrdersTable.deleted_at, req)];
  // 제목만 훑던 검색을 작업번호·내용과 대상 공간/매물 이름까지 넓힌다.
  if (q) {
    const [spaceIds, propertyIds] = await Promise.all([spaceIdsByName(q), propertyIdsByName(q)]);
    conditions.push(keywordCondition(
      q,
      [workOrdersTable.order_ref, workOrdersTable.title, workOrdersTable.description],
      [
        { column: workOrdersTable.space_id, ids: spaceIds },
        { column: workOrdersTable.property_id, ids: propertyIds },
      ],
    ));
  }
  if (status) conditions.push(eq(workOrdersTable.status, status));
  if (priority) conditions.push(eq(workOrdersTable.priority, priority));
  // 카테고리는 과거 자유 입력이라 같은 뜻이 여러 표기로 남아 있다
  // (`Cleaning`/`cleaning`/`청소`). 표준값 하나로 고르면 그 표기 전부를 잡는다.
  if (category) {
    const aliases = workOrderCategoryAliases(category);
    conditions.push(sql`lower(trim(${workOrdersTable.category})) in (${sql.join(aliases.map(a => sql`${a}`), sql`, `)})`);
  }
  if (space_id) conditions.push(eq(workOrdersTable.space_id, Number(space_id)));
  if (property_id) conditions.push(eq(workOrdersTable.property_id, Number(property_id)));
  // 기간은 예정일 기준(미정 건은 접수일로 대체하지 않는다 — 일정 조회가 목적).
  conditions.push(...dateRangeConditions(workOrdersTable.scheduled_at, date_from, date_to));
  conditions.push(...yearConditions(workOrdersTable.scheduled_at, year));
  const rows = await db.select().from(workOrdersTable)
    .where(and(...conditions))
    .orderBy(workOrdersTable.id);
  const result = await enrichWorkOrders(rows);
  res.json(result);
});

/** 연도·작업 종류 선택지. "/:id" 보다 먼저 선언해야 한다. */
router.get("/v1/work-orders/facets", async (req, res): Promise<void> => {
  const base = deletedFilter(workOrdersTable.deleted_at, req);
  const [years, categories] = await Promise.all([
    distinctYears(workOrdersTable, workOrdersTable.scheduled_at, base),
    distinctValues(workOrdersTable, workOrdersTable.category, base),
  ]);
  // 표기가 흩어진 값들을 표준값으로 접어 중복을 없애고, 사용 빈도 순서대로 준다.
  const canonical = [...new Set(categories.map(c => canonicalWorkOrderCategory(c)).filter(Boolean) as string[])];
  res.json({ years, categories: sortWorkOrderCategories(canonical) });
});

router.post("/v1/work-orders", async (req, res): Promise<void> => {
  const parsed = CreateWorkOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const order_ref = await nextOrderRef();
  const [row] = await db.insert(workOrdersTable).values({
    order_ref,
    property_id: parsed.data.property_id ?? null,
    space_id: parsed.data.space_id ?? null,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    priority: parsed.data.priority ?? "Normal",
    category: canonicalWorkOrderCategory(parsed.data.category),
    assigned_contact_id: parsed.data.assigned_contact_id ?? null,
    reported_at: parsed.data.reported_at ?? null,
    scheduled_at: parsed.data.scheduled_at ?? null,
    cost: parsed.data.cost ?? null,
    notes: parsed.data.notes ?? null,
    ...appointmentFieldsFrom(req.body, { partial: false }),
  }).returning();

  // Auto-dispatch to a matching partner when a category is set (unless the caller
  // opted out with auto_dispatch:false). Best-effort — a no-match leaves it
  // unassigned for manual handling.
  if (row.category && req.body?.auto_dispatch !== false) {
    try { await dispatchWorkOrder(row.id); } catch (e) { console.error("[work-orders] auto-dispatch failed:", e); }
  }

  const fresh = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, row.id)).then((r) => r[0]);
  const [result] = await enrichWorkOrders([fresh ?? row]);
  res.status(201).json(result);
});

// Manually (re)dispatch a work order to a matching partner.
router.post("/v1/work-orders/:id/dispatch", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const result = await dispatchWorkOrder(id, { force: req.body?.force === true });
  if (!result.ok) {
    const code = result.reason === "not_found" ? 404 : 409;
    res.status(code).json({ success: false, error: { code: result.reason.toUpperCase(), message: `Dispatch failed: ${result.reason}` } });
    return;
  }
  void logAction({ entityType: "work_order", entityId: id, action: "UPDATE", actorId: (req as any).user?.id ?? null, newValue: { dispatched_to: result.service_host_id, sla_ack_due_at: result.sla_ack_due_at } });
  const fresh = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, id)).then((r) => r[0]);
  const [enriched] = await enrichWorkOrders(fresh ? [fresh] : []);
  res.json({ success: true, data: enriched, dispatch: result });
});

// ── 문서 발행 — 작업지시서(A) · 하자·청소 청구 명세서(B) ─────────────────────
//
// 두 문서는 같은 원장을 읽는다. A는 작업지시 한 건을 종이 지시서/완료 보고서로
// 뽑고, B는 기간 안의 작업지시를 한 장으로 묶어 회사에 청구한다 — 손으로 쓰던
// "임대청소 & 하자 청구서" 시트가 원본이라 컬럼 순서를 그대로 지킨다.

type WorkOrderRow = typeof workOrdersTable.$inferSelect;

/** 작업일자 — 완료일 → 예정일 → 접수일 → 등록일 순으로 하나를 고른다. */
function workDateOf(w: WorkOrderRow): Date | null {
  const candidates: Array<string | Date | null> = [
    w.completed_at, w.scheduled_start_at, w.scheduled_at, w.reported_at, w.created_at,
  ];
  for (const c of candidates) {
    if (!c) continue;
    const d = c instanceof Date ? c : new Date(c);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/** Date → "YYYY-MM-DD" (테넌트 타임존이 아니라 로컬 — 날짜 비교용). */
function ymd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface UnitInfo { unit_no: string | null; unit_type: string | null; floor: number | null }

/**
 * 세대 정보 — 호수는 공간명, **타입은 상위 공간명**이다. Metheim 여수는 타입을
 * 상위 공간(A~E타입) 8행으로 두고 실제 세대가 `parent_space_id`로 매달려 있어,
 * 타입을 세대 행에서 직접 읽으면 항상 비어 있다.
 */
async function loadUnitInfo(spaceIds: number[]): Promise<Map<number, UnitInfo>> {
  const out = new Map<number, UnitInfo>();
  if (!spaceIds.length) return out;
  const rows = await db.select({
    id: spacesTable.id,
    name: spacesTable.name,
    floor_number: spacesTable.floor_number,
    parent_space_id: spacesTable.parent_space_id,
    custom_type_name: spacesTable.custom_type_name,
    space_type: spacesTable.space_type,
  }).from(spacesTable).where(inArray(spacesTable.id, spaceIds));

  const parentIds = [...new Set(rows.map(r => r.parent_space_id).filter(Boolean))] as number[];
  const parentNames = new Map<number, string>();
  if (parentIds.length) {
    const parents = await db.select({ id: spacesTable.id, name: spacesTable.name })
      .from(spacesTable).where(inArray(spacesTable.id, parentIds));
    for (const p of parents) parentNames.set(p.id, p.name);
  }
  for (const r of rows) {
    out.set(r.id, {
      unit_no: r.name,
      unit_type: (r.parent_space_id ? parentNames.get(r.parent_space_id) : null)
        ?? r.custom_type_name ?? r.space_type ?? null,
      floor: r.floor_number ?? null,
    });
  }
  return out;
}

/** 작업지시별 사진. `kind`(before/after) 순서를 유지한 채 건별로 묶는다. */
async function loadPhotos(workOrderIds: number[]): Promise<Map<number, Array<{ url: string; kind: string; caption: string | null }>>> {
  const out = new Map<number, Array<{ url: string; kind: string; caption: string | null }>>();
  if (!workOrderIds.length) return out;
  const rows = await db.select().from(workOrderPhotosTable)
    .where(inArray(workOrderPhotosTable.work_order_id, workOrderIds))
    .orderBy(workOrderPhotosTable.id);
  for (const r of rows) {
    const list = out.get(r.work_order_id) ?? [];
    list.push({ url: r.url, kind: r.kind, caption: r.caption ?? null });
    out.set(r.work_order_id, list);
  }
  return out;
}

/** PDF(또는 `?format=html` 미리보기)로 내보낸다. Chromium이 없으면 HTML로 폴백. */
async function sendDocument(res: any, html: string, filename: string, format: string): Promise<void> {
  if (format === "html") { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html); return; }
  try {
    const pdf = await htmlToPdf(html);
    res.setHeader("Content-Type", "application/pdf");
    setDocFileName(res, filename);
    res.setHeader("Content-Length", String(pdf.length));
    res.send(pdf);
  } catch (err) {
    if (err instanceof PdfUnavailableError) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
      return;
    }
    throw err;
  }
}

interface BillingFilters {
  from: string | null;
  to: string | null;
  propertyId: number | null;
  categories: string[];
  statuses: string[];
  withholdingPct: number;
  photosPerUnit: number;
}

function billingFiltersFrom(query: Record<string, any>): BillingFilters {
  const list = (v: any) => String(v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const cats = list(query.category).map((c) => canonicalWorkOrderCategory(c)).filter(Boolean) as string[];
  const pct = Number(query.withholding_pct);
  const per = Number(query.photos_per_unit);
  return {
    from: query.from ? String(query.from).slice(0, 10) : null,
    to: query.to ? String(query.to).slice(0, 10) : null,
    propertyId: query.property_id ? Number(query.property_id) : null,
    categories: cats,
    statuses: list(query.status),
    withholdingPct: Number.isFinite(pct) && pct > 0 ? pct : 0,
    photosPerUnit: Number.isFinite(per) && per >= 0 ? Math.min(per, 12) : 6,
  };
}

/**
 * 명세서 행을 모은다. 기간은 작업일자(완료일 우선) 기준이라 SQL로 밀어넣지 않고
 * 조회 후 걸러낸다 — 완료일은 timestamptz, 접수일·예정일은 날짜 텍스트라 한
 * 조건으로 묶이지 않는다.
 */
async function loadBillingRows(f: BillingFilters): Promise<{ rows: RepairBillingRow[]; orders: WorkOrderRow[] }> {
  const conditions: any[] = [isNull(workOrdersTable.deleted_at)];
  if (f.propertyId) conditions.push(eq(workOrdersTable.property_id, f.propertyId));
  if (f.categories.length) {
    // 카테고리는 canonical 값이지만 DB에는 옛 표기(`하자보수`)가 남아 있다 —
    // 목록 조회와 같은 별칭 매칭을 써야 이관 전 데이터가 빠지지 않는다.
    const aliases = [...new Set(f.categories.flatMap((c) => workOrderCategoryAliases(c)))];
    conditions.push(sql`lower(trim(${workOrdersTable.category})) in (${sql.join(aliases.map((a) => sql`${a}`), sql`, `)})`);
  }
  if (f.statuses.length) conditions.push(inArray(workOrdersTable.status, f.statuses));

  const all = await db.select().from(workOrdersTable).where(and(...conditions));
  const inRange = all.filter((w) => {
    const d = workDateOf(w);
    if (!d) return !f.from && !f.to;
    const key = ymd(d);
    if (f.from && key < f.from) return false;
    if (f.to && key > f.to) return false;
    return true;
  });
  inRange.sort((a, b) => {
    const da = workDateOf(a)?.getTime() ?? 0;
    const db_ = workDateOf(b)?.getTime() ?? 0;
    return da - db_ || a.id - b.id;
  });

  const units = await loadUnitInfo([...new Set(inRange.map((w) => w.space_id).filter(Boolean))] as number[]);
  const photos = await loadPhotos(inRange.map((w) => w.id));

  const rows: RepairBillingRow[] = inRange.map((w, i) => {
    const unit = w.space_id ? units.get(w.space_id) : undefined;
    const detail = [w.title, w.description].filter((v) => v && String(v).trim()).join("\n");
    const pics = (photos.get(w.id) ?? []).map((p) => ({ url: p.url, caption: p.caption }));
    return {
      seq: i + 1,
      work_order_id: w.id,
      order_ref: w.order_ref,
      work_date: workDateOf(w),
      unit_no: unit?.unit_no ?? null,
      unit_type: unit?.unit_type ?? null,
      category: canonicalWorkOrderCategory(w.category),
      detail,
      cost: Number(w.cost ?? 0),
      billed: billedAmountOf({ cost: Number(w.cost ?? 0) }, f.withholdingPct),
      photos: f.photosPerUnit > 0 ? pics.slice(0, f.photosPerUnit) : [],
    };
  });
  return { rows, orders: inRange };
}

/** 청구 대상 이름 — 계정 id가 오면 계정명, 아니면 넘어온 문자열. */
async function resolveBillTo(query: Record<string, any>): Promise<string | null> {
  if (query.account_id) {
    const [acc] = await db.select({ name: accountsTable.name }).from(accountsTable)
      .where(eq(accountsTable.id, Number(query.account_id))).limit(1);
    if (acc?.name) return acc.name;
  }
  const raw = String(query.bill_to ?? "").trim();
  return raw || null;
}

// B — 명세서 미리보기용 JSON (합계·건수를 PDF를 굽기 전에 화면에서 확인한다).
router.get("/v1/work-orders/billing-statement", async (req, res): Promise<void> => {
  const f = billingFiltersFrom(req.query as Record<string, any>);
  const { rows } = await loadBillingRows(f);
  // 이미 청구된 건은 화면에서 미리 보여 준다 — 발행 버튼을 누르고 나서야
  // "3건은 이미 청구됨"을 알게 되면 늦다.
  const invoiced = await loadInvoicedWorkOrders(rows.map((r) => r.work_order_id));
  const billable = rows.filter((r) => !invoiced.has(r.work_order_id));
  res.json({
    success: true,
    data: {
      rows: rows.map(({ photos, ...r }) => ({
        ...r,
        photo_count: photos.length,
        invoiced_invoice_id: invoiced.get(r.work_order_id) ?? null,
      })),
      totals: {
        count: rows.length,
        cost: rows.reduce((s, r) => s + r.cost, 0),
        billed: rows.reduce((s, r) => s + r.billed, 0),
        /** 아직 청구서에 실리지 않은 건수·금액 — 청구서 발행이 만들 금액이다. */
        billable_count: billable.length,
        billable_amount: billable.reduce((s, r) => s + r.billed, 0),
      },
    },
  });
});

// B — 하자·청소 청구 명세서 PDF. 각 호수 사진이 뒤에 증빙으로 붙는다.
router.get("/v1/work-orders/billing-statement.pdf", async (req, res): Promise<void> => {
  const query = req.query as Record<string, any>;
  const f = billingFiltersFrom(query);
  if (String(query.photos ?? "1") === "0") f.photosPerUnit = 0;
  const { rows } = await loadBillingRows(f);

  let propertyName: string | null = null;
  if (f.propertyId) {
    const [p] = await db.select({ name: propertiesTable.name }).from(propertiesTable)
      .where(eq(propertiesTable.id, f.propertyId)).limit(1);
    propertyName = p?.name ?? null;
  }

  const company = await resolveCompanyInfo();
  const lang = normalizeLang(typeof query.lang === "string" ? query.lang : undefined);
  const html = buildRepairBillingHtml({
    data: {
      property_name: propertyName,
      bill_to: await resolveBillTo(query),
      period_from: f.from,
      period_to: f.to,
      currency: String(query.currency ?? DEFAULT_CURRENCY),
      rows,
      includePhotos: f.photosPerUnit > 0,
      withholdingPct: f.withholdingPct,
    },
    company,
    lang,
  });
  const filename = await buildReportFileName({
    reportType: "repair_billing",
    target: propertyName ?? undefined,
    asOf: f.to ?? undefined,
    version: Number(query.version ?? 1),
  });
  await sendDocument(res, html, filename, String(query.format ?? ""));
});

/**
 * 이미 청구서에 실린 작업지시. 줄 단위 역참조(`invoice_line_items.work_order_id`)를
 * 보고, 무효(Void)·삭제된 청구서는 세지 않는다 — 취소한 청구서 때문에 다시
 * 청구하지 못하면 안 된다.
 */
async function loadInvoicedWorkOrders(workOrderIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (!workOrderIds.length) return out;
  const rows = await db
    .select({ work_order_id: invoiceLineItemsTable.work_order_id, invoice_id: invoicesTable.id })
    .from(invoiceLineItemsTable)
    .innerJoin(invoicesTable, eq(invoiceLineItemsTable.invoice_id, invoicesTable.id))
    .where(and(
      inArray(invoiceLineItemsTable.work_order_id, workOrderIds),
      isNull(invoicesTable.deleted_at),
      sql`${invoicesTable.status} <> 'Void'`,
    ));
  for (const r of rows) if (r.work_order_id) out.set(r.work_order_id, r.invoice_id);
  return out;
}

/**
 * 청구 대상 계정. 명시적으로 받은 계정이 우선이고, 없으면 대상 세대의 집주인
 * (`spaces.landlord_account_id`)에서 찾는다. 집주인이 여러 명이면 한 장으로
 * 묶을 수 없으므로 고르게 한다 — 조용히 아무나 고르면 엉뚱한 곳에 청구된다.
 */
async function resolveBillingAccount(
  explicitId: number | null,
  spaceIds: number[],
): Promise<{ accountId: number } | { error: string; candidates: number[] }> {
  if (explicitId) return { accountId: explicitId };
  if (!spaceIds.length) return { error: "NO_ACCOUNT", candidates: [] };
  const rows = await db.select({ landlord: spacesTable.landlord_account_id })
    .from(spacesTable).where(inArray(spacesTable.id, spaceIds));
  const owners = [...new Set(rows.map(r => r.landlord).filter(Boolean))] as number[];
  if (owners.length === 1) return { accountId: owners[0]! };
  return { error: owners.length ? "MULTIPLE_OWNERS" : "NO_ACCOUNT", candidates: owners };
}

// C — 명세서를 청구서로 발행. 명세서 한 줄 = 청구서 한 줄이라 종이와 회계가
// 줄 단위로 맞는다. 이미 청구된 작업지시는 건너뛰고 그 사실을 함께 돌려준다.
router.post("/v1/work-orders/billing-statement/invoice", async (req, res): Promise<void> => {
  const body = { ...(req.query as Record<string, any>), ...(req.body ?? {}) };
  const f = billingFiltersFrom(body);
  const { rows, orders } = await loadBillingRows(f);
  if (!rows.length) {
    res.status(400).json({ success: false, error: { code: "NO_ROWS", message: "No work orders match these filters." } });
    return;
  }

  const invoiced = await loadInvoicedWorkOrders(orders.map(o => o.id));
  const billable = rows.filter(r => !invoiced.has(r.work_order_id));
  const skipped = rows.length - billable.length;
  if (!billable.length) {
    res.status(409).json({
      success: false,
      error: { code: "ALREADY_INVOICED", message: "Every work order in this period is already on an invoice." },
      data: { skipped },
    });
    return;
  }

  const orderById = new Map(orders.map(o => [o.id, o]));
  const spaceIds = [...new Set(billable.map(r => orderById.get(r.work_order_id)?.space_id).filter(Boolean))] as number[];
  const resolved = await resolveBillingAccount(body.account_id ? Number(body.account_id) : null, spaceIds);
  if ("error" in resolved) {
    res.status(400).json({
      success: false,
      error: {
        code: resolved.error,
        message: resolved.error === "MULTIPLE_OWNERS"
          ? "These work orders belong to more than one owner — pass account_id to choose who is billed."
          : "Could not resolve who to bill; pass account_id.",
      },
      data: { candidates: resolved.candidates },
    });
    return;
  }

  const ccy = String(body.currency ?? DEFAULT_CURRENCY);
  const supply = billable.reduce((sum, r) => sum + Number(r.billed ?? 0), 0);
  const taxMode = body.tax_mode === "exclusive" ? "exclusive" : "none";
  const taxRate = Number(body.tax_rate ?? (taxMode === "exclusive" ? 10 : 0));
  const period = f.to ? f.to.slice(0, 7) : f.from ? f.from.slice(0, 7) : null;

  const [invoice] = await db.insert(invoicesTable).values({
    invoice_ref: await nextInvoiceRef(),
    account_id: resolved.accountId,
    amount: String(supply),
    currency: ccy,
    exchange_rate_to_aud: await getRateToAud(ccy),
    tax_mode: taxMode,
    tax_rate: String(taxRate),
    tax_amount: String(computeTax(supply, taxMode, taxRate, ccy)),
    status: "Draft",
    billing_period: period,
    due_date: body.due_date ?? null,
    description: `${period ?? ""} 하자·청소 청구 (${billable.length}건)`.trim(),
    notes: body.notes ?? null,
  }).returning();

  await db.insert(invoiceLineItemsTable).values(billable.map((r, i) => {
    const wo = orderById.get(r.work_order_id);
    return {
      invoice_id: invoice.id,
      // 명세서 줄과 같은 순서·같은 표기 — 종이와 청구서를 나란히 놓고 대조한다.
      label: [r.unit_no ? `${r.unit_no}호` : null, r.category, wo?.title].filter(Boolean).join(" · "),
      description: r.detail || null,
      charge_kind: "other" as const,
      space_id: wo?.space_id ?? null,
      work_order_id: r.work_order_id,
      quantity: "1",
      unit_amount: String(r.billed),
      total_amount: String(r.billed),
      sort_order: i,
    };
  }));

  void logAction({
    entityType: "work_order", entityId: billable[0]!.work_order_id, action: "UPDATE",
    actorId: (req as any).user?.id ?? null,
    newValue: { billing_statement_invoice_id: invoice.id, lines: billable.length, skipped },
  });
  res.status(201).json({ success: true, data: invoice, lines: billable.length, skipped });
});

// A — 작업지시서 PDF (요청·완료 사진 포함).
router.get("/v1/work-orders/:id/document.pdf", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [wo] = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, id));
  if (!wo) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Work order not found" } }); return; }

  const [enriched] = await enrichWorkOrders([wo]);
  const units = await loadUnitInfo(wo.space_id ? [wo.space_id] : []);
  const unit = wo.space_id ? units.get(wo.space_id) : undefined;
  const photos = (await loadPhotos([id])).get(id) ?? [];
  const query = req.query as Record<string, any>;
  const rawPct = Number(query.withholding_pct);
  const pct = Number.isFinite(rawPct) && rawPct > 0 ? rawPct : 0;
  const cost = Number(wo.cost ?? 0);
  const billed = billedAmountOf({ cost }, pct);

  const data: WorkOrderDocInput = {
    order_ref: wo.order_ref,
    title: wo.title,
    description: wo.description,
    notes: wo.notes,
    status: wo.status,
    priority: wo.priority,
    category: canonicalWorkOrderCategory(wo.category),
    property_name: enriched?.property_name ?? null,
    unit_no: unit?.unit_no ?? enriched?.space_name ?? null,
    unit_type: unit?.unit_type ?? null,
    floor: unit?.floor ?? null,
    reported_at: wo.reported_at,
    scheduled_at: wo.scheduled_start_at ?? wo.scheduled_at,
    completed_at: wo.completed_at,
    assignee_name: enriched?.assigned_user_name ?? enriched?.assigned_contact_name ?? null,
    partner_name: enriched?.service_host_name ?? null,
    attendee_name: enriched?.attendee_contact_name ?? null,
    location_note: wo.location_note,
    access_method: wo.access_method,
    currency: wo.currency ?? DEFAULT_CURRENCY,
    cost: wo.cost,
    withholding_amount: cost - billed || null,
    billed_amount: billed,
    photos,
  };

  const company = await resolveCompanyInfo();
  const lang = normalizeLang(typeof query.lang === "string" ? query.lang : undefined);
  const html = buildWorkOrderHtml({ data, company, lang });
  const filename = await resolveDocFileName({
    kind: "work_order",
    entityType: "work_order",
    entityId: id,
    party: [data.unit_no, data.property_name, wo.order_ref],
    org: [data.property_name],
    issueDate: workDateOf(wo),
  });
  await sendDocument(res, html, filename, String(query.format ?? ""));
});

router.get("/v1/work-orders/:id", async (req, res): Promise<void> => {
  const row = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, Number(req.params.id))).then(r => r[0]);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [result] = await enrichWorkOrders([row]);
  res.json(result);
});

router.put("/v1/work-orders/:id", async (req, res): Promise<void> => {
  const parsed = UpdateWorkOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updates: Partial<typeof workOrdersTable.$inferInsert> = { updated_at: new Date() };
  if (parsed.data.property_id !== undefined) updates.property_id = parsed.data.property_id;
  if (parsed.data.space_id !== undefined) updates.space_id = parsed.data.space_id;
  if (parsed.data.title != null) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.priority != null) updates.priority = parsed.data.priority;
  if (parsed.data.category !== undefined) updates.category = canonicalWorkOrderCategory(parsed.data.category);
  if (parsed.data.assigned_contact_id !== undefined) updates.assigned_contact_id = parsed.data.assigned_contact_id;
  if (parsed.data.reported_at !== undefined) updates.reported_at = parsed.data.reported_at;
  if (parsed.data.scheduled_at !== undefined) updates.scheduled_at = parsed.data.scheduled_at;
  if (parsed.data.cost !== undefined) updates.cost = parsed.data.cost;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
  Object.assign(updates, appointmentFieldsFrom(req.body, { partial: true }));
  const [row] = await db.update(workOrdersTable).set(updates).where(eq(workOrdersTable.id, Number(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [result] = await enrichWorkOrders([row]);
  res.json(result);
});

const workOrdersSoftDelete = {
  table: workOrdersTable,
  idColumn: workOrdersTable.id,
  statusKey: "status",
  archivedStatus: "Archived",
  restoredStatus: "Active",
};

router.post("/v1/work-orders/bulk-delete", makeBulkDelete(workOrdersSoftDelete));
router.post("/v1/work-orders/bulk-restore", makeBulkRestore(workOrdersSoftDelete));

router.delete("/v1/work-orders/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";
  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
    }
    await db.delete(workOrdersTable).where(eq(workOrdersTable.id, id));
  } else {
    await db.update(workOrdersTable).set({ deleted_at: new Date(), status: "Archived" }).where(eq(workOrdersTable.id, id));
  }
  res.status(204).send();
});

router.post("/v1/work-orders/:id/start", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [cur] = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, id));
  if (!cur) { res.status(404).json({ error: "Not found" }); return; }
  if (cur.status !== "Open") { res.status(400).json({ error: "Work order not in Open status" }); return; }
  const now = new Date();
  // Starting work implies the dispatched partner acknowledged the job. Resolve the
  // ack-SLA: a missed deadline stays 'breached' for the audit trail; otherwise it
  // moves to 'acknowledged'. Un-dispatched orders keep their (null) sla_status.
  const sla_status = cur.sla_status === "breached"
    ? "breached"
    : cur.sla_status === "pending_ack" ? "acknowledged" : cur.sla_status;
  const [row] = await db.update(workOrdersTable)
    .set({ status: "InProgress", acknowledged_at: cur.acknowledged_at ?? (cur.service_host_id ? now : null), sla_status, updated_at: now })
    .where(and(eq(workOrdersTable.id, id), eq(workOrdersTable.status, "Open")))
    .returning();
  if (!row) { res.status(400).json({ error: "Work order not in Open status" }); return; }
  const [result] = await enrichWorkOrders([row]);
  res.json(result);
});

router.post("/v1/work-orders/:id/review", async (req, res): Promise<void> => {
  const [row] = await db.update(workOrdersTable)
    .set({ status: "PendingReview", updated_at: new Date() })
    .where(and(eq(workOrdersTable.id, Number(req.params.id)), eq(workOrdersTable.status, "InProgress")))
    .returning();
  if (!row) { res.status(400).json({ error: "Work order not in InProgress status" }); return; }
  const [result] = await enrichWorkOrders([row]);
  res.json(result);
});

router.post("/v1/work-orders/:id/complete", async (req, res): Promise<void> => {
  const parsed = CompleteWorkOrderBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const id = Number(req.params.id);
  const [cur] = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, id));
  if (!cur) { res.status(404).json({ error: "Not found" }); return; }
  const now = new Date();
  const updates: Partial<typeof workOrdersTable.$inferInsert> = {
    status: "Completed",
    completed_at: now,
    updated_at: now,
  };
  // A completed job was necessarily acknowledged. Finalise the ack-SLA: keep a
  // recorded 'breached' for the audit trail, otherwise mark it 'met'. Backfill
  // acknowledged_at for dispatched orders that were completed without an explicit
  // start/acknowledge step.
  if (cur.service_host_id) {
    updates.sla_status = cur.sla_status === "breached" ? "breached" : "met";
    if (!cur.acknowledged_at) updates.acknowledged_at = now;
  }
  if (parsed.data.cost != null) updates.cost = parsed.data.cost;
  if (parsed.data.notes != null) updates.notes = parsed.data.notes;
  const [row] = await db.update(workOrdersTable).set(updates)
    .where(eq(workOrdersTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [result] = await enrichWorkOrders([row]);
  res.json(result);
});

// ── Owner charge-back (#5) ───────────────────────────────────────────────────
// Recover a completed repair's cost from the property owner by raising a Draft
// invoice to them, linked back to the work order. Idempotent per work order.
// Body: { amount?, markup_pct?, account_id?, currency?, due_date? }. Defaults to
// the work order's own cost, and the space's landlord (spaces.landlord_account_id).
router.post("/v1/work-orders/:id/charge-owner", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [wo] = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, id));
  if (!wo) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Work order not found" } }); return; }

  // Idempotent: one charge-back invoice per work order.
  const [already] = await db.select().from(invoicesTable).where(eq(invoicesTable.work_order_id, id)).limit(1);
  if (already) { res.json({ success: true, data: already, alreadyCharged: true }); return; }

  if (wo.status !== "Completed") {
    res.status(409).json({ success: false, error: { code: "NOT_COMPLETED", message: "Only a completed work order can be charged to the owner." } }); return;
  }

  const base = req.body?.amount != null ? Number(req.body.amount) : Number(wo.cost ?? 0);
  if (!(base > 0)) {
    res.status(400).json({ success: false, error: { code: "NO_COST", message: "No cost to charge — set the work order cost or pass an amount." } }); return;
  }
  const markupPct = Number(req.body?.markup_pct ?? 0);
  const amount = Math.round(base * (1 + markupPct / 100) * 100) / 100;

  // Resolve the owner: explicit override, else the space's landlord.
  let ownerAccountId: number | null = req.body?.account_id != null ? Number(req.body.account_id) : null;
  if (!ownerAccountId && wo.space_id) {
    const [sp] = await db.select({ landlord: spacesTable.landlord_account_id }).from(spacesTable).where(eq(spacesTable.id, wo.space_id));
    ownerAccountId = sp?.landlord ?? null;
  }
  if (!ownerAccountId) {
    res.status(400).json({ success: false, error: { code: "NO_OWNER", message: "Could not resolve the property owner; pass account_id." } }); return;
  }

  const ccy = req.body?.currency ?? wo.currency ?? DEFAULT_CURRENCY;
  const [inv] = await db.insert(invoicesTable).values({
    invoice_ref: await nextInvoiceRef(),
    account_id: ownerAccountId,
    work_order_id: id,
    amount: String(amount),
    currency: ccy,
    exchange_rate_to_aud: await getRateToAud(ccy),
    status: "Draft",
    due_date: req.body?.due_date ?? null,
    description: `Repair charge — ${wo.order_ref}${wo.title ? `: ${wo.title}` : ""}${markupPct ? ` (+${markupPct}% admin)` : ""}`,
  }).returning();
  void logAction({ entityType: "work_order", entityId: id, action: "UPDATE", actorId: (req as any).user?.id ?? null, newValue: { charged_owner_invoice_id: inv.id, account_id: ownerAccountId, amount } });
  res.status(201).json({ success: true, data: inv });
});

// ── 방문 확정 메일 (+ invite.ics) ─────────────────────────────────────────────
// Sends the confirmed inspection slot to the person who meets us on site
// (attendee_contact_id by default) with a calendar invite attached. Re-sending
// bumps the .ics SEQUENCE so clients update the existing entry instead of
// duplicating it.
// Body (all optional): { to, contact_id, lang }
router.post("/v1/work-orders/:id/send-confirmation", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [wo] = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, id));
  if (!wo) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Work order not found" } }); return; }
  if (!wo.scheduled_start_at) {
    res.status(400).json({ success: false, error: { code: "NOT_SCHEDULED", message: "Set the appointment start time before sending a confirmation." } });
    return;
  }

  // Recipient: explicit address > explicit contact > the visit's attendee.
  let to: string | null = typeof req.body?.to === "string" && req.body.to.trim() ? req.body.to.trim() : null;
  let toName: string | null = null;
  const contactId = req.body?.contact_id != null ? Number(req.body.contact_id) : wo.attendee_contact_id;
  if (contactId) {
    const [c] = await db.select({
      email: contactsTable.email, first_name: contactsTable.first_name, last_name: contactsTable.last_name,
    }).from(contactsTable).where(eq(contactsTable.id, contactId));
    if (c) {
      toName = formatPersonName(c.first_name, c.last_name);
      if (!to) to = c.email ?? null;
    }
  }
  if (!to) {
    res.status(400).json({ success: false, error: { code: "NO_RECIPIENT", message: "No email address — set an attendee with an email, or pass `to`." } });
    return;
  }

  const [enrichedWo] = await enrichWorkOrders([wo]);
  const start = wo.scheduled_start_at;
  // Default to a one-hour visit when no end was set.
  const end = wo.scheduled_end_at ?? new Date(start.getTime() + 60 * 60 * 1000);
  const unit = [enrichedWo?.property_name, enrichedWo?.space_name].filter(Boolean).join(" · ") || null;
  // Re-sends must bump SEQUENCE — count the previous sends as the sequence base.
  const sequence = wo.confirmation_sent_at ? 1 : 0;

  const result = await sendAppointmentConfirmationEmail({
    to, toName,
    orderRef: wo.order_ref,
    title: wo.title,
    start, end,
    unit,
    locationNote: wo.location_note,
    visitorName: enrichedWo?.assigned_user_name ?? enrichedWo?.service_host_name ?? enrichedWo?.assigned_contact_name ?? null,
    sequence,
    lang: typeof req.body?.lang === "string" ? req.body.lang : undefined,
  });

  if (!result.ok) {
    res.status(result.skipped ? 503 : 502).json({ success: false, error: { code: "SEND_FAILED", message: result.error ?? "Send failed" } });
    return;
  }
  const now = new Date();
  await db.update(workOrdersTable).set({ confirmation_sent_at: now, updated_at: now }).where(eq(workOrdersTable.id, id));
  void logAction({ entityType: "work_order", entityId: id, action: "UPDATE", actorId: (req as any).user?.id ?? null, newValue: { confirmation_sent_to: to } });
  res.json({ success: true, data: { to, sent_at: now.toISOString() } });
});

// ── Work-order photos (#7) — before/after (request/confirmation) evidence ─────
router.get("/v1/work-orders/:id/photos", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const rows = await db.select().from(workOrderPhotosTable)
    .where(eq(workOrderPhotosTable.work_order_id, id)).orderBy(desc(workOrderPhotosTable.id));
  res.json({ success: true, data: rows });
});

// Accepts multipart files (field `image` or `images`, several at a time) uploaded
// to Cloudinary, or a JSON body with an existing `url`.
// Fields: kind (before|after), caption, uploaded_by_type.
router.post("/v1/work-orders/:id/photos", upload.any(), async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [wo] = await db.select({ id: workOrdersTable.id }).from(workOrdersTable).where(eq(workOrdersTable.id, id));
    if (!wo) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Work order not found" } }); return; }

    const kind = req.body?.kind === "before" ? "before" : "after";
    const uploaded_by_type = req.body?.uploaded_by_type === "partner" ? "partner" : "admin";
    const caption = req.body?.caption || null;

    const files = ((req.files as Express.Multer.File[] | undefined) ?? [])
      .filter((f) => f.fieldname === "image" || f.fieldname === "images");
    const urls: string[] = [];

    if (files.length > 0) {
      if (!isCloudinaryConfigured()) { res.status(503).json({ success: false, error: { code: "NOT_CONFIGURED", message: "Image upload not configured" } }); return; }
      for (const file of files) {
        const result = await uploadToCloudinary(file.buffer, { folder: cldFolder("work-orders") });
        urls.push(result.secure_url);
      }
    } else if (typeof req.body?.url === "string" && req.body.url) {
      urls.push(req.body.url);
    }
    if (urls.length === 0) { res.status(400).json({ success: false, error: { code: "NO_IMAGE", message: "Provide an image file or a url." } }); return; }

    const rows = await db.insert(workOrderPhotosTable).values(
      urls.map((url) => ({ work_order_id: id, url, kind, uploaded_by_type, caption })),
    ).returning();
    void logAction({ entityType: "work_order", entityId: id, action: "UPDATE", actorId: (req as any).user?.id ?? null, newValue: { photos_added: rows.length, kind } });
    // `data` stays a single row for existing single-file callers; `items` carries them all.
    res.status(201).json({ success: true, data: rows[0], items: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "UPLOAD_FAILED", message: err.message } });
  }
});

router.delete("/v1/work-orders/:id/photos/:photoId", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const photoId = Number(req.params.photoId);
  const [row] = await db.delete(workOrderPhotosTable)
    .where(and(eq(workOrderPhotosTable.id, photoId), eq(workOrderPhotosTable.work_order_id, id)))
    .returning();
  if (!row) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Photo not found" } }); return; }
  void logAction({ entityType: "work_order", entityId: id, action: "UPDATE", actorId: (req as any).user?.id ?? null, oldValue: { photo_removed: row.url } });
  res.json({ success: true, data: { id: photoId } });
});

router.post("/v1/work-orders/:id/cancel", async (req, res): Promise<void> => {
  const parsed = CancelWorkOrderBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updates: Partial<typeof workOrdersTable.$inferInsert> = {
    status: "Cancelled",
    updated_at: new Date(),
  };
  if (parsed.data.notes != null) updates.notes = parsed.data.notes;
  const [row] = await db.update(workOrdersTable).set(updates)
    .where(eq(workOrdersTable.id, Number(req.params.id)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [result] = await enrichWorkOrders([row]);
  res.json(result);
});

export default router;

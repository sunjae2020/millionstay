import { Router, type IRouter } from "express";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  db, integrationSettings, rentalBusinessUnitsTable, spacesTable, propertiesTable,
} from "@workspace/db";
import { keywordCondition } from "../lib/listSearch";
import { deletedFilter } from "../lib/softDelete";
import { logAction } from "../utils/auditLog";

/**
 * 임대사업자 등록증 — Settings → Organisation 의 한 탭.
 *
 * 등록증은 두 부분이다: 회사당 한 벌인 머릿말(등록번호·최초등록일·임대사업자명·
 * 법인등록번호·주소·전화)과, 여러 줄인 "민간임대주택의 소재지" 표. 앞은 회사 정보와
 * 같은 integration_settings KV 블롭에, 뒤는 rental_business_units 테이블에 담고,
 * 각 줄은 space_id 로 우리 spaces 원장의 실제 세대와 이어 붙인다.
 */
const router: IRouter = Router();

export const RENTAL_BUSINESS_KEY = "rental_business_registration";

const RegistrationBody = z.object({
  /** 등록번호 — 2026-여수시-임대사업자-11 */
  registration_no: z.string().optional(),
  /** 최초등록일 YYYY-MM-DD */
  first_registered_on: z.string().optional(),
  /** 임대사업자 성명(법인명) — 회사 정보의 법인명과 다를 수 있어 따로 둔다. */
  operator_name: z.string().optional(),
  /** 주민등록번호(법인등록번호) */
  operator_reg_no: z.string().optional(),
  /** 외국인등록번호 / 국적 / 체류자격 / 체류기간 — 개인·외국인 임대사업자용 칸 */
  foreigner_reg_no: z.string().optional(),
  nationality: z.string().optional(),
  visa_status: z.string().optional(),
  visa_period: z.string().optional(),
  /** 주소(법인의 경우 대표 사무소 소재지) */
  address: z.string().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  /** 등록증 발급 관청 (예: 여수시장) */
  issuing_authority: z.string().optional(),
  note: z.string().optional(),
}).strip();

type Registration = z.infer<typeof RegistrationBody>;

async function readRegistration(): Promise<Registration> {
  const [row] = await db.select().from(integrationSettings)
    .where(eq(integrationSettings.key, RENTAL_BUSINESS_KEY));
  if (!row?.value) return {};
  try {
    const parsed = RegistrationBody.safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

router.get("/v1/rental-business", async (_req, res): Promise<void> => {
  res.json({ success: true, data: await readRegistration() });
});

router.put("/v1/rental-business", async (req, res): Promise<void> => {
  const parsed = RegistrationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const value = JSON.stringify(parsed.data);
  try {
    await db.insert(integrationSettings)
      .values({ key: RENTAL_BUSINESS_KEY, value, updated_at: new Date() })
      .onConflictDoUpdate({ target: integrationSettings.key, set: { value, updated_at: new Date() } });
  } catch (e: any) {
    res.status(500).json({ error: `Save failed: ${e?.message}` }); return;
  }
  await logAction({
    entityType: "rental_business_registration", entityId: 1, action: "UPDATE", newValue: parsed.data,
  }).catch(() => {});
  res.json({ success: true, data: parsed.data });
});

// ── 등록 세대 목록 ────────────────────────────────────────────────────────────

const UnitBody = z.object({
  unit_no: z.string().min(1),
  building_address: z.string().optional(),
  acquisition_type: z.string().nullish(),
  housing_kind: z.string().nullish(),
  housing_type: z.string().nullish(),
  exclusive_area_label: z.string().nullish(),
  registered_on: z.string().nullish(),
  lease_started_on: z.string().nullish(),
  registration_history: z.string().nullish(),
  space_id: z.coerce.number().int().positive().nullish(),
  note: z.string().optional(),
  sort_order: z.coerce.number().int().nullish(),
}).strip();

/**
 * 등록증의 호수 표기를 spaces.name 과 맞추기 위한 정규화. 등록증은 "1001호",
 * 우리 원장은 "1001호"가 기본이지만 공백·"호" 누락·전각 숫자가 섞여 들어와도
 * 같은 세대로 보이게 숫자/영문만 남긴다.
 */
function unitKey(raw: string | null | undefined): string {
  return String(raw ?? "")
    .replace(/[\s·]/g, "")
    .replace(/호$/, "")
    .toUpperCase();
}

/** 미연결 세대를 spaces.name 과 대조해 붙인다. 같은 키가 둘 이상이면 건너뛴다. */
async function linkUnits(rows: Array<{ id: number; unit_no: string; space_id: number | null }>): Promise<number> {
  const targets = rows.filter((r) => !r.space_id);
  if (!targets.length) return 0;

  const spaces = await db.select({ id: spacesTable.id, name: spacesTable.name })
    .from(spacesTable).where(isNull(spacesTable.deleted_at));

  const byKey = new Map<string, number[]>();
  for (const s of spaces) {
    const key = unitKey(s.name);
    if (!key) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), s.id]);
  }

  let linked = 0;
  for (const row of targets) {
    const matches = byKey.get(unitKey(row.unit_no));
    // 동명이실(같은 호수가 여러 동에 있는 경우)은 사람이 골라야 하므로 자동 연결하지 않는다.
    if (!matches || matches.length !== 1) continue;
    await db.update(rentalBusinessUnitsTable)
      .set({ space_id: matches[0]! })
      .where(eq(rentalBusinessUnitsTable.id, row.id));
    linked += 1;
  }
  return linked;
}

router.get("/v1/rental-business/units", async (req, res): Promise<void> => {
  try {
    const { q, linked } = req.query as Record<string, string>;
    const rows = await db.select({
      id: rentalBusinessUnitsTable.id,
      unit_no: rentalBusinessUnitsTable.unit_no,
      building_address: rentalBusinessUnitsTable.building_address,
      acquisition_type: rentalBusinessUnitsTable.acquisition_type,
      housing_kind: rentalBusinessUnitsTable.housing_kind,
      housing_type: rentalBusinessUnitsTable.housing_type,
      exclusive_area_label: rentalBusinessUnitsTable.exclusive_area_label,
      registered_on: rentalBusinessUnitsTable.registered_on,
      lease_started_on: rentalBusinessUnitsTable.lease_started_on,
      registration_history: rentalBusinessUnitsTable.registration_history,
      note: rentalBusinessUnitsTable.note,
      sort_order: rentalBusinessUnitsTable.sort_order,
      space_id: rentalBusinessUnitsTable.space_id,
      space_name: spacesTable.name,
      space_type: spacesTable.custom_type_name,
      space_status: spacesTable.status,
      property_name: propertiesTable.name,
      created_at: rentalBusinessUnitsTable.created_at,
    })
      .from(rentalBusinessUnitsTable)
      .leftJoin(spacesTable, eq(spacesTable.id, rentalBusinessUnitsTable.space_id))
      .leftJoin(propertiesTable, eq(propertiesTable.id, spacesTable.property_id))
      .where(and(
        deletedFilter(rentalBusinessUnitsTable.deleted_at, req),
        q ? keywordCondition(q, [
          rentalBusinessUnitsTable.unit_no,
          rentalBusinessUnitsTable.building_address,
          rentalBusinessUnitsTable.housing_type,
        ]) : undefined,
        linked === "0" ? isNull(rentalBusinessUnitsTable.space_id) : undefined,
      ))
      .orderBy(asc(rentalBusinessUnitsTable.sort_order), asc(rentalBusinessUnitsTable.id));

    const unlinked = rows.filter((r) => !r.space_id).length;
    res.json({ success: true, data: rows, meta: { total: rows.length, unlinked } });
  } catch {
    res.status(500).json({ error: "Failed to list rental business units" });
  }
});

router.post("/v1/rental-business/units", async (req, res): Promise<void> => {
  const parsed = UnitBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(rentalBusinessUnitsTable)
    .values(parsed.data as never).returning();
  await logAction({
    entityType: "rental_business_unit", entityId: row!.id, action: "CREATE", newValue: parsed.data,
  }).catch(() => {});
  res.status(201).json({ success: true, data: row });
});

router.put("/v1/rental-business/units/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UnitBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(rentalBusinessUnitsTable)
    .set(parsed.data as never)
    .where(eq(rentalBusinessUnitsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await logAction({
    entityType: "rental_business_unit", entityId: id, action: "UPDATE", newValue: parsed.data,
  }).catch(() => {});
  res.json({ success: true, data: row });
});

router.delete("/v1/rental-business/units/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.update(rentalBusinessUnitsTable)
    .set({ deleted_at: new Date() })
    .where(eq(rentalBusinessUnitsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await logAction({
    entityType: "rental_business_unit", entityId: id, action: "DELETE", oldValue: { unit_no: row.unit_no },
  }).catch(() => {});
  res.status(204).end();
});

/**
 * POST /v1/rental-business/units/import — 등록증 표를 통째로 붙여넣어 등재한다.
 *
 * 등록증은 37쪽에 걸쳐 수백 세대가 적혀 있어 한 줄씩 입력받는 건 현실적이지 않다.
 * 행 배열을 받아 한 번에 넣고, 곧바로 호수 ↔ spaces.name 자동 연결까지 돌린다.
 * `replace`가 참이면 기존 목록을 소프트 삭제하고 새로 등재한다(등록증 재발급 대응).
 */
router.post("/v1/rental-business/units/import", async (req, res): Promise<void> => {
  const Body = z.object({
    rows: z.array(UnitBody).min(1),
    replace: z.boolean().optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    if (parsed.data.replace) {
      await db.update(rentalBusinessUnitsTable)
        .set({ deleted_at: new Date() })
        .where(isNull(rentalBusinessUnitsTable.deleted_at));
    }
    const values = parsed.data.rows.map((r, i) => ({ ...r, sort_order: r.sort_order ?? i }));
    const inserted = await db.insert(rentalBusinessUnitsTable).values(values as never).returning({
      id: rentalBusinessUnitsTable.id,
      unit_no: rentalBusinessUnitsTable.unit_no,
      space_id: rentalBusinessUnitsTable.space_id,
    });
    const linked = await linkUnits(inserted);
    await logAction({
      entityType: "rental_business_unit", entityId: 0, action: "CREATE",
      newValue: { imported: inserted.length, linked, replace: !!parsed.data.replace },
    }).catch(() => {});
    res.status(201).json({ success: true, data: { imported: inserted.length, linked } });
  } catch (e: any) {
    res.status(500).json({ error: `Import failed: ${e?.message}` });
  }
});

/** POST /v1/rental-business/units/auto-link — 미연결 세대를 호수로 일괄 연결. */
router.post("/v1/rental-business/units/auto-link", async (_req, res): Promise<void> => {
  const rows = await db.select({
    id: rentalBusinessUnitsTable.id,
    unit_no: rentalBusinessUnitsTable.unit_no,
    space_id: rentalBusinessUnitsTable.space_id,
  })
    .from(rentalBusinessUnitsTable)
    .where(and(isNull(rentalBusinessUnitsTable.deleted_at), isNull(rentalBusinessUnitsTable.space_id)));
  const linked = await linkUnits(rows);
  res.json({ success: true, data: { linked, remaining: rows.length - linked } });
});

/**
 * GET /v1/rental-business/by-space?space_ids=1,2,3 — 세대 화면에서 "이 호실이
 * 임대사업자 등록된 민간임대주택인가"를 묻는 역방향 조회. 공간 상세가 등록증
 * 전체를 받아 걸러 쓰지 않도록 필요한 행만 돌려준다.
 */
router.get("/v1/rental-business/by-space", async (req, res): Promise<void> => {
  const ids = String((req.query as Record<string, unknown>)["space_ids"] ?? "")
    .split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) { res.json({ success: true, data: [] }); return; }
  const rows = await db.select().from(rentalBusinessUnitsTable)
    .where(and(
      isNull(rentalBusinessUnitsTable.deleted_at),
      inArray(rentalBusinessUnitsTable.space_id, ids),
    ));
  const registration = await readRegistration();
  res.json({ success: true, data: rows, meta: { registration } });
});

export default router;

import { Router, type IRouter } from "express";
import { eq, ilike, and, or, isNull, inArray, SQL } from "drizzle-orm";
import { db, leadsTable, suburbsTable, bookingsTable, contractsTable } from "@workspace/db";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import {
  ListLeadsQueryParams,
  CreateLeadBody,
  GetLeadParams,
  UpdateLeadParams,
  UpdateLeadBody,
  DeleteLeadParams,
  ConvertLeadBody,
} from "@workspace/api-zod";
import { insertLeadWithGeneratedRef } from "../lib/leadRef.js";
import { formatFirstName, formatLastName } from "../lib/nameFormat.js";

import { keywordCondition } from "../lib/listSearch";
import { ensureLeadParty } from "../services/leadConversion.js";
import { generateBookingRef } from "./bookings.js";
import { nextContractRef } from "./contracts.js";
import { sendLeadNotificationEmail } from "../lib/email";
import { logAction } from "../utils/auditLog";
import { formatPersonName } from "../lib/nameFormat.js";
const router: IRouter = Router();

/** Canonical person-name casing on write — see lib/nameFormat.ts. */
function normalizeNames<T extends { first_name?: string | null; last_name?: string | null }>(data: T): T {
  const out = { ...data };
  if (typeof out.first_name === "string") out.first_name = formatFirstName(out.first_name);
  if (typeof out.last_name === "string") out.last_name = formatLastName(out.last_name);
  return out;
}

router.get("/v1/leads", async (req, res): Promise<void> => {
  const parsed = ListLeadsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { search, lead_status, lead_source, nationality, preferred_space_type, status } = parsed.data;
  const conditions: SQL[] = [deletedFilter(leadsTable.deleted_at, req)];
  if (lead_status) conditions.push(eq(leadsTable.lead_status, lead_status));
  if (lead_source) conditions.push(eq(leadsTable.lead_source, lead_source));
  if (nationality) conditions.push(eq(leadsTable.nationality, nationality));
  if (preferred_space_type) conditions.push(eq(leadsTable.preferred_space_type, preferred_space_type));
  if (status) conditions.push(eq(leadsTable.status, status));
  // 이름·연락처에 더해 문의번호와 문의 내용으로도 찾는다.
  if (search) {
    conditions.push(keywordCondition(
      search,
      [
        leadsTable.email, leadsTable.phone, leadsTable.lead_ref,
        leadsTable.nationality, leadsTable.lead_source, leadsTable.message,
      ],
      [],
      [{ first: leadsTable.first_name, last: leadsTable.last_name }],
    ));
  }

  const rows = await db
    .select({
      id: leadsTable.id,
      lead_ref: leadsTable.lead_ref,
      first_name: leadsTable.first_name,
      last_name: leadsTable.last_name,
      email: leadsTable.email,
      phone: leadsTable.phone,
      nationality: leadsTable.nationality,
      lead_source: leadsTable.lead_source,
      lead_status: leadsTable.lead_status,
      inquiry_type: leadsTable.inquiry_type,
      message: leadsTable.message,
      preferred_space_type: leadsTable.preferred_space_type,
      preferred_check_in_date: leadsTable.preferred_check_in_date,
      preferred_duration_weeks: leadsTable.preferred_duration_weeks,
      preferred_suburb_id: leadsTable.preferred_suburb_id,
      budget_min: leadsTable.budget_min,
      budget_max: leadsTable.budget_max,
      budget_currency: leadsTable.budget_currency,
      converted_booking_id: leadsTable.converted_booking_id,
      converted_at: leadsTable.converted_at,
      assigned_to: leadsTable.assigned_to,
      description: leadsTable.description,
      manual_input: leadsTable.manual_input,
      status: leadsTable.status,
      created_at: leadsTable.created_at,
      updated_at: leadsTable.updated_at,
      preferred_suburb_name: suburbsTable.name,
    })
    .from(leadsTable)
    .leftJoin(suburbsTable, eq(leadsTable.preferred_suburb_id, suburbsTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(leadsTable.created_at);

  res.json(rows);
});

router.post("/v1/leads", async (req, res): Promise<void> => {
  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const inserted = await insertLeadWithGeneratedRef(normalizeNames(parsed.data));
  const [row] = await db
    .select()
    .from(leadsTable)
    .where(eq(leadsTable.id, inserted.id))
    .limit(1);
  res.status(201).json(row);
});

router.get("/v1/leads/:id", async (req, res): Promise<void> => {
  const parsed = GetLeadParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const rows = await db
    .select({
      id: leadsTable.id,
      lead_ref: leadsTable.lead_ref,
      first_name: leadsTable.first_name,
      last_name: leadsTable.last_name,
      email: leadsTable.email,
      phone: leadsTable.phone,
      nationality: leadsTable.nationality,
      lead_source: leadsTable.lead_source,
      lead_status: leadsTable.lead_status,
      inquiry_type: leadsTable.inquiry_type,
      message: leadsTable.message,
      preferred_space_type: leadsTable.preferred_space_type,
      preferred_check_in_date: leadsTable.preferred_check_in_date,
      preferred_duration_weeks: leadsTable.preferred_duration_weeks,
      preferred_suburb_id: leadsTable.preferred_suburb_id,
      budget_min: leadsTable.budget_min,
      budget_max: leadsTable.budget_max,
      budget_currency: leadsTable.budget_currency,
      converted_booking_id: leadsTable.converted_booking_id,
      converted_at: leadsTable.converted_at,
      assigned_to: leadsTable.assigned_to,
      description: leadsTable.description,
      manual_input: leadsTable.manual_input,
      status: leadsTable.status,
      created_at: leadsTable.created_at,
      updated_at: leadsTable.updated_at,
      preferred_suburb_name: suburbsTable.name,
    })
    .from(leadsTable)
    .leftJoin(suburbsTable, eq(leadsTable.preferred_suburb_id, suburbsTable.id))
    .where(eq(leadsTable.id, parsed.data.id));
  if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
  res.json(rows[0]);
});

router.put("/v1/leads/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdateLeadParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = UpdateLeadBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [row] = await db.update(leadsTable)
    .set({ ...normalizeNames(bodyParsed.data), updated_at: new Date() })
    .where(eq(leadsTable.id, paramsParsed.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

const leadsSoftDelete = {
  table: leadsTable,
  idColumn: leadsTable.id,
  statusKey: "status",
  archivedStatus: "Archived",
  restoredStatus: "Active",
};

router.post("/v1/leads/bulk-delete", makeBulkDelete(leadsSoftDelete));
router.post("/v1/leads/bulk-restore", makeBulkRestore(leadsSoftDelete));

router.delete("/v1/leads/:id", async (req, res): Promise<void> => {
  const parsed = DeleteLeadParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";
  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
    }
    await db.delete(leadsTable).where(eq(leadsTable.id, parsed.data.id));
  } else {
    await db.update(leadsTable)
      .set({ deleted_at: new Date(), status: "Archived", updated_at: new Date() })
      .where(eq(leadsTable.id, parsed.data.id));
  }
  res.status(204).end();
});

/* ═══════════════════════════════════════════════════════════════════════════
   전환 — 문의를 예약이나 계약으로 넘긴다
   ═══════════════════════════════════════════════════════════════════════════
   두 전환 모두 `ensureLeadParty()` 로 시작한다. 연락처와 계정을 먼저 확보하고
   그 위에 예약이든 계약이든 얹는 구조라, 한 문의를 예약으로 한 번 계약으로 한 번
   전환해도 같은 사람·같은 계정에 걸린다.

   전환 결과는 문의에 되돌려 적는다(`converted_*_id`). "이 계약이 어느 문의에서
   왔나"를 되짚을 수 있어야 하고, 두 번째 전환이 레코드를 또 만들지 않으려면
   가리킬 곳이 필요하다. */

/** 전환 결과를 담당자에게 알린다. 실패해도 전환 자체를 막지 않는다. */
function notifyConversion(opts: {
  kind: "예약 전환" | "계약 전환";
  lead: typeof leadsTable.$inferSelect;
  ref: string;
  detail: string[];
}): void {
  void sendLeadNotificationEmail({
    leadRef: opts.lead.lead_ref,
    inquiryType: opts.kind,
    firstName: opts.lead.first_name ?? "",
    lastName: opts.lead.last_name ?? "",
    email: opts.lead.email ?? "",
    phone: opts.lead.phone ?? null,
    message: `${opts.lead.lead_ref} → ${opts.ref}`,
    description: opts.detail.filter(Boolean).join("\n") || null,
  }).catch((e) => console.error("[leads] conversion notify failed:", e));
}

/**
 * 예약으로 전환.
 *
 * 예전에는 `lead_status` 만 바꾸고 `BK-####` 를 난수로 지어 응답에 실었다. 그
 * 번호로 저장되는 예약은 없었으므로 화면에는 "전환됨"이라고 뜨는데 뒤에 아무
 * 레코드가 없었다. 이제 실제 예약을 만들고 문의에 그 id 를 적는다.
 */
router.patch("/v1/leads/:id/convert", async (req, res): Promise<void> => {
  const paramsParsed = GetLeadParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = ConvertLeadBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, paramsParsed.data.id));
  if (!lead) { res.status(404).json({ error: "Not found" }); return; }
  if (lead.converted_booking_id) {
    res.status(409).json({ error: "Lead already converted", booking_id: lead.converted_booking_id });
    return;
  }

  const actorId = (req as any).user?.id ?? null;
  const party = await ensureLeadParty(lead.id, actorId);
  const b = bodyParsed.data;

  const booking_ref = await generateBookingRef();
  const [booking] = await db.insert(bookingsTable).values({
    booking_ref,
    name: formatPersonName(lead.first_name, lead.last_name) || lead.lead_ref,
    account_id: party.accountId,
    contact_id: party.contactId,
    booking_status: "Draft",
    booking_source: "Lead",
    space_id: b.space_id,
    check_in_date: b.check_in_date,
    check_out_date: b.check_out_date,
    agreed_weekly_rate: b.agreed_weekly_rate ?? null,
    customer_notes: lead.message ?? null,
    status: "Active",
  } as never).returning({ id: bookingsTable.id, booking_ref: bookingsTable.booking_ref });

  await db.update(leadsTable).set({
    lead_status: "ConvertedToBooking",
    converted_booking_id: booking!.id,
    converted_at: new Date(),
    updated_at: new Date(),
  }).where(eq(leadsTable.id, lead.id));

  void logAction({
    entityType: "lead", entityId: lead.id, action: "UPDATE", actorId,
    newValue: { converted_booking_id: booking!.id, contact_id: party.contactId, account_id: party.accountId },
  });
  notifyConversion({
    kind: "예약 전환", lead, ref: booking!.booking_ref,
    detail: [
      `예약번호: ${booking!.booking_ref}`,
      `입주: ${b.check_in_date} ~ ${b.check_out_date}`,
      party.createdContact ? "연락처 신규 생성" : "기존 연락처 연결",
      party.createdAccount ? "계정 신규 생성" : "기존 계정 연결",
    ],
  });

  res.json({
    booking_id: booking!.id,
    booking_ref: booking!.booking_ref,
    lead_ref: lead.lead_ref,
    contact_id: party.contactId,
    account_id: party.accountId,
    created_contact: party.createdContact,
    created_account: party.createdAccount,
  });
});

/**
 * 계약으로 전환. 연락처 · 계정 · 계약을 한 번에 만든다.
 *
 * 계약서의 임차인 칸은 계정을 가리키므로(`tenant_account_id`), 계정 없이는 계약을
 * 세울 수 없다. 그래서 세 개가 한 동작으로 묶인다 — 담당자가 계정관리를 들렀다
 * 오는 사이에 무엇을 만들었는지 잊는 일이 실제로 있었다.
 *
 * 만드는 것은 **초안**이다. 서식·결제조건·특약은 계약 상세에서 정한다. 여기서
 * 채우는 것은 신청서에 이미 적혀 있어 두 번 물을 이유가 없는 값뿐이다.
 */
router.post("/v1/leads/:id/convert-to-contract", async (req, res): Promise<void> => {
  const parsed = GetLeadParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, parsed.data.id));
  if (!lead) { res.status(404).json({ error: "Not found" }); return; }
  if (lead.converted_contract_id) {
    res.status(409).json({ error: "Lead already converted to a contract", contract_id: lead.converted_contract_id });
    return;
  }

  const actorId = (req as any).user?.id ?? null;
  const party = await ensureLeadParty(lead.id, actorId);
  const body = (req.body ?? {}) as Record<string, unknown>;

  const asDate = (v: unknown): string | null =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  const spaceId = Number.isFinite(Number(body["space_id"])) ? Number(body["space_id"]) : null;
  // 시작일은 요청 → 신청서 희망 입주일 → 문의 희망 입주일 순서.
  const startDate = asDate(body["start_date"])
    ?? asDate(party.answers["preferred_move_in_date"])
    ?? asDate(lead.preferred_check_in_date);
  const endDate = asDate(body["end_date"]);

  const contract_ref = await nextContractRef();
  const [contract] = await db.insert(contractsTable).values({
    contract_ref,
    tenant_account_id: party.accountId,
    space_id: spaceId,
    start_date: startDate,
    end_date: endDate,
    // 서식 기본값은 자사 일반 임대차계약서 — POST /v1/contracts 와 같은 규칙이다.
    lease_form: "general",
    status: "Draft",
  } as never).returning({ id: contractsTable.id, contract_ref: contractsTable.contract_ref });

  await db.update(leadsTable).set({
    lead_status: "ConvertedToContract",
    converted_contract_id: contract!.id,
    converted_at: new Date(),
    updated_at: new Date(),
  }).where(eq(leadsTable.id, lead.id));

  void logAction({
    entityType: "lead", entityId: lead.id, action: "UPDATE", actorId,
    newValue: { converted_contract_id: contract!.id, contact_id: party.contactId, account_id: party.accountId },
  });
  notifyConversion({
    kind: "계약 전환", lead, ref: contract!.contract_ref,
    detail: [
      `계약번호: ${contract!.contract_ref}`,
      startDate ? `입주 예정일: ${startDate}` : "",
      party.createdContact ? "연락처 신규 생성" : "기존 연락처 연결",
      party.createdAccount ? "계정 신규 생성" : "기존 계정 연결",
    ],
  });

  res.status(201).json({
    contract_id: contract!.id,
    contract_ref: contract!.contract_ref,
    lead_ref: lead.lead_ref,
    contact_id: party.contactId,
    account_id: party.accountId,
    created_contact: party.createdContact,
    created_account: party.createdAccount,
  });
});

router.patch("/v1/leads/:id/mark-lost", async (req, res): Promise<void> => {
  const parsed = GetLeadParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(leadsTable)
    .set({ lead_status: "Lost", updated_at: new Date() })
    .where(eq(leadsTable.id, parsed.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

export default router;

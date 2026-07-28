/**
 * 세대점검표 (unit inspection checklist) — HTTP routes.
 *
 * A lease attachment: one report per contract carrying BOTH the 입주 and 퇴거
 * columns of the paper form (the tenant signs each phase separately). It reuses
 * the condition_reports family rather than forking new tables, so booking-phase
 * evidence and lease inspections share photos, tamper-evidence and the tenant
 * agree/dispute flow.
 *
 * Three surfaces:
 *  - admin  (requireAuth)  — seed from template, fill on site, upload photos,
 *                            countersign, issue a signing link, print the PDF.
 *  - public (token only)   — the tenant opens the link on their phone, reviews
 *                            each item, agrees/disputes, adds photos and signs.
 *                            No account needed, which is the norm for KR leases.
 *  - blank PDF             — the same form with no data, for paper use.
 */
import crypto from "crypto";
import { Router, type IRouter } from "express";
import multer from "multer";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  accountsTable,
  conditionReportsTable,
  conditionReportItemsTable,
  conditionReportPhotosTable,
  conditionReportResponsesTable,
  conditionReportSignaturesTable,
  contractsTable,
  spacesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { isCloudinaryConfigured, uploadToCloudinary, cldFolder } from "../utils/cloudinary";
import { logAction } from "../utils/auditLog";
import { htmlToPdf, PdfUnavailableError } from "../lib/documents/pdf";
import { resolveCompanyInfo } from "../lib/documents/companyInfo";
import {
  buildUnitInspectionHtml,
  type InspectionDocInput,
  type InspectionDocItem,
} from "../lib/documents/unitInspectionDocument";
import {
  DEFAULT_INSPECTION_TEMPLATE_KEY,
  INSPECTION_TEMPLATES,
  getInspectionTemplate,
  labelIndex,
  localize,
  templateItemRows,
  type InspectionTemplate,
} from "../lib/inspections/metheimUnitTemplate";
import { hiddenCodesFor, readTemplatePrefs, writeTemplatePrefs } from "../lib/inspections/templatePrefs";
import { clientIp, signingBaseUrl } from "../services/contractSigning";
import { sendInspectionSignLinkEmail } from "../lib/email";

const ENTITY = "unit_inspection";
const PHASES = ["move_in", "move_out"] as const;
type Phase = (typeof PHASES)[number];
const ITEM_STATUSES = ["ok", "defect", "na"];

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function sha256(buf: Buffer | string): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function asPhase(value: unknown, fallback: Phase = "move_in"): Phase {
  return PHASES.includes(value as Phase) ? (value as Phase) : fallback;
}

/**
 * Display language for labels. Callers pass ?lang= (the admin sends its i18n
 * language, the tenant page its own); Korean is the fallback because the form
 * itself is a Korean lease document.
 */
function reqLang(req: any): string {
  const q = req.query?.lang ?? req.body?.lang;
  return typeof q === "string" && q ? q : (process.env.DEFAULT_DOC_LANG ?? "ko");
}

/**
 * Swap stored Korean row labels for the requested language.
 *
 * Rows are stored with their Korean label (the paper form's wording) and matched
 * back to the template by `item_code`. Rows added on site have no code, so they
 * keep whatever the inspector typed — translating free text would be a guess.
 */
function localizeItems<T extends { item_code: string | null; label: string }>(
  items: T[],
  template: InspectionTemplate,
  lang: string,
): T[] {
  const labels = labelIndex(template);
  return items.map((it) => {
    const localized = it.item_code ? labels.get(it.item_code) : null;
    return localized ? { ...it, label: localize(localized, lang) } : it;
  });
}

function fail(res: any, code: number, errCode: string, message: string): void {
  res.status(code).json({ success: false, error: { code: errCode, message } });
}

async function generateReportRef(): Promise<string> {
  const year = new Date().getFullYear();
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(conditionReportsTable)
    .where(sql`EXTRACT(YEAR FROM ${conditionReportsTable.created_at}) = ${year}`);
  const seq = ((row?.count ?? 0) + 1).toString().padStart(4, "0");
  return `UI-${year}-${seq}`;
}

/** Load a report with items (+ their photos/responses) and signatures. */
async function loadInspection(id: number, lang = "ko") {
  const [report] = await db.select().from(conditionReportsTable).where(eq(conditionReportsTable.id, id)).limit(1);
  if (!report) return null;
  const items = await db
    .select()
    .from(conditionReportItemsTable)
    .where(eq(conditionReportItemsTable.condition_report_id, id))
    .orderBy(conditionReportItemsTable.sort_order, conditionReportItemsTable.id);
  const photos = await db
    .select()
    .from(conditionReportPhotosTable)
    .where(eq(conditionReportPhotosTable.condition_report_id, id));
  const signatures = await db
    .select()
    .from(conditionReportSignaturesTable)
    .where(eq(conditionReportSignaturesTable.condition_report_id, id))
    .orderBy(conditionReportSignaturesTable.id);
  const itemIds = items.map((i) => i.id);
  const responses = itemIds.length
    ? await db.select().from(conditionReportResponsesTable).where(inArray(conditionReportResponsesTable.item_id, itemIds))
    : [];
  const template = getInspectionTemplate(report.template_key);
  // The stored title is the template's Korean name unless someone renamed it, so
  // an untouched title follows the reader's language instead of pinning Korean.
  const title_display =
    report.title && report.title !== template.name.ko ? report.title : localize(template.name, lang);
  return {
    ...report,
    title_display,
    template,
    templateView: {
      key: template.key,
      name: localize(template.name, lang),
      heading: localize(template.heading, lang),
      unitTypes: template.unitTypes,
      groups: template.groups.map((gr) => ({ key: gr.key, label: localize(gr.label, lang) })),
      specialTerms: template.specialTerms.map((term) => localize(term, lang)),
    },
    items: localizeItems(items, template, lang).map((it) => ({
      ...it,
      photos: photos.filter((p) => p.item_id === it.id),
      responses: responses.filter((r) => r.item_id === it.id),
    })),
    photos: photos.filter((p) => p.item_id == null),
    signatures,
  };
}

type Inspection = NonNullable<Awaited<ReturnType<typeof loadInspection>>>;

/** Shape a loaded report for the PDF builder. */
function toDocInput(report: Inspection): InspectionDocInput {
  // Hidden rows leave the printed record entirely — a row a unit does not have
  // must not sit there inviting a signature.
  const items: InspectionDocItem[] = report.items.filter((it) => !it.hidden).map((it) => ({
    item_code: it.item_code,
    group_key: it.group_key,
    label: it.label,
    move_in_status: it.move_in_status,
    move_in_note: it.move_in_note,
    move_out_status: it.move_out_status,
    move_out_note: it.move_out_note,
    photoCounts: {
      move_in: it.photos.filter((p) => p.phase === "move_in").length,
      move_out: it.photos.filter((p) => p.phase === "move_out").length,
    },
  }));
  return {
    report_ref: report.report_ref,
    meta: (report.meta ?? {}) as InspectionDocInput["meta"],
    items,
    signatures: report.signatures.map((s) => ({
      phase: s.phase,
      role: s.role,
      signer_name: s.signer_name,
      signature_image: s.signature_image,
      signed_at: s.signed_at,
    })),
  };
}

/** Freeze the state a signature approves, so it can never be silently re-rendered. */
function phaseSnapshot(report: Inspection, phase: Phase) {
  return {
    phase,
    capturedAt: new Date().toISOString(),
    meta: report.meta ?? {},
    items: report.items.filter((it) => !it.hidden).map((it) => ({
      id: it.id,
      item_code: it.item_code,
      label: it.label,
      status: phase === "move_in" ? it.move_in_status : it.move_out_status,
      note: phase === "move_in" ? it.move_in_note : it.move_out_note,
      photos: it.photos
        .filter((p) => p.phase === phase)
        .map((p) => ({ id: p.id, file_url: p.file_url, content_hash: p.content_hash })),
    })),
  };
}

function appendAudit(report: { audit_trail: unknown }, event: Record<string, unknown>) {
  const trail = Array.isArray(report.audit_trail) ? report.audit_trail : [];
  return [...trail, { at: new Date().toISOString(), ...event }];
}

/** Header defaults pulled off the contract (unit, tenant, dates) so on-site staff type less. */
async function prefillMetaFromContract(contractId: number): Promise<Record<string, unknown>> {
  const [row] = await db
    .select({
      start_date: contractsTable.start_date,
      end_date: contractsTable.end_date,
      space_name: spacesTable.name,
      space_type: spacesTable.custom_type_name,
      tenant_name: accountsTable.name,
      tenant_phone: accountsTable.phone1,
      tenant_email: accountsTable.account_email,
    })
    .from(contractsTable)
    .leftJoin(spacesTable, eq(contractsTable.space_id, spacesTable.id))
    .leftJoin(accountsTable, eq(contractsTable.tenant_account_id, accountsTable.id))
    .where(eq(contractsTable.id, contractId))
    .limit(1);
  if (!row) return {};
  // The 8 Metheim unit types are named "A타입" … "E-1타입"; the form's 타입 cell
  // wants just the letter group, so take the leading letter when it matches.
  const typeLetter = (row.space_type ?? "").trim().match(/^([A-E])/)?.[1] ?? "";
  return {
    unit_no: row.space_name ?? "",
    unit_type: typeLetter,
    tenant_name: row.tenant_name ?? "",
    tenant_phone: row.tenant_phone ?? "",
    tenant_email: row.tenant_email ?? "",
    move_in_date: row.start_date ?? "",
    move_out_date: row.end_date ?? "",
    meters: { in: {}, out: {} },
  };
}

/* ═══════════════════════════════════════════════════════════
   ADMIN  (/api/v1/…, requireAuth)
═══════════════════════════════════════════════════════════ */
const adminRouter: IRouter = Router();
adminRouter.use("/v1", requireAuth);

// Available templates (for the "새 점검표" picker).
adminRouter.get("/v1/inspection-templates", async (req, res): Promise<void> => {
  const lang = reqLang(req);
  res.json({
    success: true,
    data: Object.values(INSPECTION_TEMPLATES).map((t) => ({
      key: t.key,
      name: localize(t.name, lang),
      heading: localize(t.heading, lang),
      unitTypes: t.unitTypes,
      itemCount: t.groups.reduce((n, g) => n + g.items.length, 0),
      groups: t.groups.map((gr) => ({
        key: gr.key,
        label: localize(gr.label, lang),
        items: gr.items.map((i) => ({ code: i.code, label: localize(i.label, lang) })),
      })),
      specialTerms: t.specialTerms.map((term) => localize(term, lang)),
    })),
  });
});


// Which template rows this tenant wants on the form at all (설정 → 점검표 양식).
adminRouter.get("/v1/inspection-templates/:key/prefs", async (req, res): Promise<void> => {
  try {
    const prefs = await readTemplatePrefs();
    const key = String(req.params.key);
    res.json({ success: true, data: { key, hidden: prefs[key]?.hidden ?? [] } });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

adminRouter.put("/v1/inspection-templates/:key/prefs", async (req, res): Promise<void> => {
  try {
    const key = String(req.params.key);
    const hidden = Array.isArray(req.body?.hidden) ? req.body.hidden : [];
    const prefs = await writeTemplatePrefs(key, hidden);
    void logAction({
      entityType: ENTITY, entityId: 0, action: "UPDATE",
      actorId: (req as any).user?.id ?? null,
      newValue: { template: key, hidden: hidden.length },
    });
    res.json({ success: true, data: { key, hidden: prefs[key]?.hidden ?? [] } });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

/**
 * Create the checklist for a contract, seeded from a template.
 *
 * Rows switched off in 설정 are still created, marked `hidden` — so a per-contract
 * decision can bring one back without re-seeding, and the template stays a
 * comparable skeleton across units.
 */
async function createInspectionForContract(
  contractId: number,
  opts: { templateKey?: string; title?: string; meta?: Record<string, unknown>; actorId?: number | null } = {},
) {
  const template = getInspectionTemplate(opts.templateKey ?? DEFAULT_INSPECTION_TEMPLATE_KEY);
  const meta = { ...(await prefillMetaFromContract(contractId)), ...(opts.meta ?? {}) };
  const hidden = await hiddenCodesFor(template.key);
  const report_ref = await generateReportRef();

  const [report] = await db
    .insert(conditionReportsTable)
    .values({
      report_ref,
      contract_id: contractId,
      template_key: template.key,
      phase: "full",
      status: "draft",
      title: opts.title?.trim() || template.name.ko,
      meta,
      created_by: opts.actorId ?? null,
      audit_trail: [{ event: "created", at: new Date().toISOString(), actor: opts.actorId ?? null }],
    })
    .returning();

  const rows = templateItemRows(template);
  if (rows.length) {
    await db.insert(conditionReportItemsTable).values(
      rows.map((r) => ({
        condition_report_id: report!.id,
        group_key: r.group_key,
        item_code: r.item_code,
        label: r.label,
        sort_order: r.sort_order,
        hidden: hidden.has(r.item_code),
      })),
    );
  }
  void logAction({
    entityType: ENTITY, entityId: report!.id, action: "CREATE", actorId: opts.actorId ?? null,
    newValue: { report_ref, contract_id: contractId, template: template.key, items: rows.length, hidden: hidden.size },
  });
  return report!.id;
}

/**
 * The contract's checklist — created on first access.
 *
 * Every lease carries exactly one 세대점검표 (DB-enforced by a partial unique
 * index), so this is a get-or-create rather than a list: no admin has to
 * remember to add one, and existing contracts pick theirs up on first open.
 */
adminRouter.get("/v1/contracts/:contractId/inspection", async (req, res): Promise<void> => {
  try {
    const contractId = Number(req.params.contractId);
    const [contract] = await db
      .select({ id: contractsTable.id })
      .from(contractsTable)
      .where(eq(contractsTable.id, contractId))
      .limit(1);
    if (!contract) { fail(res, 404, "NOT_FOUND", "Contract not found"); return; }

    const [existing] = await db
      .select({ id: conditionReportsTable.id })
      .from(conditionReportsTable)
      .where(and(eq(conditionReportsTable.contract_id, contractId), isNull(conditionReportsTable.deleted_at)))
      .limit(1);

    let id = existing?.id;
    if (!id) {
      try {
        id = await createInspectionForContract(contractId, { actorId: (req as any).user?.id ?? null });
      } catch (err: any) {
        // Lost a race against a concurrent first open — the unique index did its
        // job; just read back whichever row won.
        const [row] = await db
          .select({ id: conditionReportsTable.id })
          .from(conditionReportsTable)
          .where(and(eq(conditionReportsTable.contract_id, contractId), isNull(conditionReportsTable.deleted_at)))
          .limit(1);
        if (!row) throw err;
        id = row.id;
      }
    }
    res.json({ success: true, data: await loadInspection(id, reqLang(req)) });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

adminRouter.get("/v1/inspections/:id", async (req, res): Promise<void> => {
  try {
    const detail = await loadInspection(Number(req.params.id), reqLang(req));
    if (!detail) { fail(res, 404, "NOT_FOUND", "Inspection not found"); return; }
    res.json({ success: true, data: detail });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

// Header / meter / 비고 edits. A phase already signed is locked.
adminRouter.patch("/v1/inspections/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [report] = await db.select().from(conditionReportsTable).where(eq(conditionReportsTable.id, id)).limit(1);
    if (!report) { fail(res, 404, "NOT_FOUND", "Inspection not found"); return; }

    const patch: Record<string, unknown> = {};
    if (typeof req.body?.title === "string") patch.title = req.body.title;
    if (typeof req.body?.summary === "string") patch.summary = req.body.summary;
    if (req.body?.meta && typeof req.body.meta === "object") {
      patch.meta = { ...((report.meta as Record<string, unknown>) ?? {}), ...req.body.meta };
    }
    if (Object.keys(patch).length) {
      await db.update(conditionReportsTable).set(patch).where(eq(conditionReportsTable.id, id));
    }
    res.json({ success: true, data: await loadInspection(id, reqLang(req)) });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

/** Reject edits to a phase the tenant has already signed. */
async function phaseIsSigned(reportId: number, phase: Phase): Promise<boolean> {
  const [row] = await db
    .select({ id: conditionReportSignaturesTable.id })
    .from(conditionReportSignaturesTable)
    .where(and(
      eq(conditionReportSignaturesTable.condition_report_id, reportId),
      eq(conditionReportSignaturesTable.phase, phase),
      eq(conditionReportSignaturesTable.role, "tenant"),
    ))
    .limit(1);
  return !!row;
}

// Fill in one checklist row for one phase.
adminRouter.patch("/v1/inspections/:id/items/:itemId", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const itemId = Number(req.params.itemId);
    const [item] = await db.select().from(conditionReportItemsTable).where(eq(conditionReportItemsTable.id, itemId)).limit(1);
    if (!item || item.condition_report_id !== id) { fail(res, 404, "NOT_FOUND", "Item not found"); return; }

    const patch: Record<string, unknown> = {};
    const touchesMoveIn = "move_in_status" in (req.body ?? {}) || "move_in_note" in (req.body ?? {});
    const touchesMoveOut = "move_out_status" in (req.body ?? {}) || "move_out_note" in (req.body ?? {});
    if (touchesMoveIn && (await phaseIsSigned(id, "move_in"))) {
      fail(res, 409, "PHASE_SIGNED", "입주 점검은 임차인 서명 후 수정할 수 없습니다.");
      return;
    }
    if (touchesMoveOut && (await phaseIsSigned(id, "move_out"))) {
      fail(res, 409, "PHASE_SIGNED", "퇴거 점검은 임차인 서명 후 수정할 수 없습니다.");
      return;
    }
    for (const phase of PHASES) {
      const sKey = `${phase}_status` as const;
      const nKey = `${phase}_note` as const;
      if (sKey in (req.body ?? {})) {
        const v = req.body[sKey];
        patch[sKey] = v === null || v === "" ? null : ITEM_STATUSES.includes(v) ? v : null;
      }
      if (nKey in (req.body ?? {})) patch[nKey] = typeof req.body[nKey] === "string" ? req.body[nKey] : null;
    }
    if (typeof req.body?.label === "string" && req.body.label.trim()) patch.label = req.body.label.trim();
    if (typeof req.body?.hidden === "boolean") patch.hidden = req.body.hidden;
    if (Object.keys(patch).length) {
      await db.update(conditionReportItemsTable).set(patch).where(eq(conditionReportItemsTable.id, itemId));
    }
    const [updated] = await db.select().from(conditionReportItemsTable).where(eq(conditionReportItemsTable.id, itemId)).limit(1);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

// Add an on-site extra row (항목 추가).
adminRouter.post("/v1/inspections/:id/items", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const label = typeof req.body?.label === "string" ? req.body.label.trim() : "";
    if (!label) { fail(res, 400, "BAD_LABEL", "label is required"); return; }
    const [maxRow] = await db
      .select({ max: sql<number>`COALESCE(MAX(${conditionReportItemsTable.sort_order}), 0)::int` })
      .from(conditionReportItemsTable)
      .where(eq(conditionReportItemsTable.condition_report_id, id));
    const [item] = await db
      .insert(conditionReportItemsTable)
      .values({
        condition_report_id: id,
        group_key: typeof req.body?.group_key === "string" ? req.body.group_key : "other",
        label,
        sort_order: (maxRow?.max ?? 0) + 1,
      })
      .returning();
    res.status(201).json({ success: true, data: item });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

// Remove a row (custom rows only — template rows stay so the form matches the paper one).
adminRouter.delete("/v1/inspections/:id/items/:itemId", async (req, res): Promise<void> => {
  try {
    const itemId = Number(req.params.itemId);
    const [item] = await db.select().from(conditionReportItemsTable).where(eq(conditionReportItemsTable.id, itemId)).limit(1);
    if (!item || item.condition_report_id !== Number(req.params.id)) { fail(res, 404, "NOT_FOUND", "Item not found"); return; }
    if (item.item_code) { fail(res, 409, "TEMPLATE_ITEM", "양식 기본 항목은 삭제할 수 없습니다."); return; }
    await db.delete(conditionReportItemsTable).where(eq(conditionReportItemsTable.id, itemId));
    res.json({ success: true });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

// Evidence photo (admin). content_hash = sha256 of the bytes.
adminRouter.post("/v1/inspections/:id/photos", upload.single("image"), async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [report] = await db.select().from(conditionReportsTable).where(eq(conditionReportsTable.id, id)).limit(1);
    if (!report) { fail(res, 404, "NOT_FOUND", "Inspection not found"); return; }
    if (!req.file) { fail(res, 400, "NO_FILE", "No file provided"); return; }
    if (!isCloudinaryConfigured()) { fail(res, 503, "NOT_CONFIGURED", "Image upload not configured"); return; }
    const phase = asPhase(req.body?.phase);
    if (await phaseIsSigned(id, phase)) { fail(res, 409, "PHASE_SIGNED", "서명 완료된 점검에는 사진을 추가할 수 없습니다."); return; }

    const hash = sha256(req.file.buffer);
    const result = await uploadToCloudinary(req.file.buffer, { folder: cldFolder("condition") });
    const itemId = Number(req.body?.item_id);
    const [photo] = await db
      .insert(conditionReportPhotosTable)
      .values({
        condition_report_id: id,
        item_id: Number.isFinite(itemId) && itemId > 0 ? itemId : null,
        file_url: result.secure_url,
        thumbnail_url: result.thumbnail_url ?? null,
        cloudinary_id: result.public_id ?? null,
        caption: typeof req.body?.caption === "string" ? req.body.caption : null,
        content_hash: hash,
        phase,
        taken_at: new Date(),
        uploaded_by_type: "admin",
        uploaded_by_id: (req as any).user?.id ?? null,
      })
      .returning();
    res.status(201).json({ success: true, data: photo });
  } catch (err: any) {
    fail(res, 500, "UPLOAD_FAILED", err.message);
  }
});

adminRouter.delete("/v1/inspections/:id/photos/:photoId", async (req, res): Promise<void> => {
  try {
    const photoId = Number(req.params.photoId);
    const [photo] = await db.select().from(conditionReportPhotosTable).where(eq(conditionReportPhotosTable.id, photoId)).limit(1);
    if (!photo || photo.condition_report_id !== Number(req.params.id)) { fail(res, 404, "NOT_FOUND", "Photo not found"); return; }
    if (await phaseIsSigned(photo.condition_report_id, asPhase(photo.phase))) {
      fail(res, 409, "PHASE_SIGNED", "서명 완료된 점검의 사진은 삭제할 수 없습니다."); return;
    }
    await db.delete(conditionReportPhotosTable).where(eq(conditionReportPhotosTable.id, photoId));
    res.json({ success: true });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

// The inspector (staff) countersigns a phase.
adminRouter.post("/v1/inspections/:id/signatures", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const report = await loadInspection(id);
    if (!report) { fail(res, 404, "NOT_FOUND", "Inspection not found"); return; }
    const phase = asPhase(req.body?.phase);
    const image = typeof req.body?.signature_image === "string" ? req.body.signature_image : "";
    if (!image.startsWith("data:image/")) { fail(res, 400, "BAD_SIGNATURE", "signature_image must be a data URL"); return; }

    const snapshot = phaseSnapshot(report, phase);
    await db
      .delete(conditionReportSignaturesTable)
      .where(and(
        eq(conditionReportSignaturesTable.condition_report_id, id),
        eq(conditionReportSignaturesTable.phase, phase),
        eq(conditionReportSignaturesTable.role, "inspector"),
      ));
    const [sig] = await db
      .insert(conditionReportSignaturesTable)
      .values({
        condition_report_id: id,
        phase,
        role: "inspector",
        signer_name: typeof req.body?.signer_name === "string" ? req.body.signer_name : null,
        signature_image: image,
        content_hash: sha256(JSON.stringify(snapshot)),
        ip: clientIp(req),
        user_agent: String(req.headers["user-agent"] ?? "").slice(0, 500),
      })
      .returning();
    await db
      .update(conditionReportsTable)
      .set({ audit_trail: appendAudit(report, { event: "inspector_signed", phase, actor: (req as any).user?.id ?? null }) })
      .where(eq(conditionReportsTable.id, id));
    res.status(201).json({ success: true, data: sig });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

// Issue (or re-issue) the tenant's signing link for a phase.
adminRouter.post("/v1/inspections/:id/sign-link", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const report = await loadInspection(id);
    if (!report) { fail(res, 404, "NOT_FOUND", "Inspection not found"); return; }
    const phase = asPhase(req.body?.phase);
    if (await phaseIsSigned(id, phase)) { fail(res, 409, "ALREADY_SIGNED", "이미 임차인 서명이 완료된 점검입니다."); return; }

    const days = Number.isFinite(Number(req.body?.expires_in_days)) ? Number(req.body.expires_in_days) : 14;
    const token = crypto.randomBytes(24).toString("hex");
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    // Publishing alongside the link freezes what the tenant is asked to approve.
    const snapshot = phaseSnapshot(report, phase);
    const issuedTrail = appendAudit(report, { event: "sign_link_issued", phase, actor: (req as any).user?.id ?? null });
    await db
      .update(conditionReportsTable)
      .set({
        sign_token: token,
        sign_token_phase: phase,
        sign_token_expires_at: expires,
        status: report.status === "draft" ? "published" : report.status,
        published_at: report.published_at ?? new Date(),
        published_snapshot: snapshot,
        content_hash: sha256(JSON.stringify(snapshot)),
        audit_trail: issuedTrail,
      })
      .where(eq(conditionReportsTable.id, id));

    void logAction({ entityType: ENTITY, entityId: id, action: "STATUS_CHANGE", actorId: (req as any).user?.id ?? null, newValue: { sign_link: phase } });

    const url = `${signingBaseUrl()}/inspection/${token}`;

    // Optional delivery. Never blocks link issuance — if mail is misconfigured
    // the admin still gets the URL back and can send it by hand.
    const meta = (report.meta ?? {}) as Record<string, any>;
    const to = typeof req.body?.email === "string" && req.body.email.trim()
      ? req.body.email.trim()
      : (meta.tenant_email ?? "");
    let email: { ok: boolean; skipped?: boolean; error?: string } | null = null;
    if (req.body?.send_email && to) {
      email = await sendInspectionSignLinkEmail({
        to,
        toName: meta.tenant_name ?? null,
        url,
        phase,
        unit: [meta.unit_no, meta.unit_type].filter(Boolean).join(" · ") || null,
        reportRef: report.report_ref,
        expiresAt: expires,
        lang: typeof req.body?.lang === "string" ? req.body.lang : undefined,
      });
      if (email.ok) {
        await db
          .update(conditionReportsTable)
          .set({ audit_trail: appendAudit({ audit_trail: issuedTrail }, { event: "sign_link_emailed", phase, to }) })
          .where(eq(conditionReportsTable.id, id));
      }
    } else if (req.body?.send_email && !to) {
      email = { ok: false, error: "NO_RECIPIENT" };
    }

    res.json({ success: true, data: { token, phase, expires_at: expires, url, email } });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

adminRouter.delete("/v1/inspections/:id/sign-link", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    await db
      .update(conditionReportsTable)
      .set({ sign_token: null, sign_token_phase: null, sign_token_expires_at: null })
      .where(eq(conditionReportsTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

// Close the checklist once both sides are done.
adminRouter.post("/v1/inspections/:id/finalize", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const report = await loadInspection(id);
    if (!report) { fail(res, 404, "NOT_FOUND", "Inspection not found"); return; }
    await db
      .update(conditionReportsTable)
      .set({
        status: "finalized",
        finalized_at: new Date(),
        sign_token: null,
        sign_token_phase: null,
        sign_token_expires_at: null,
        audit_trail: appendAudit(report, { event: "finalized", actor: (req as any).user?.id ?? null }),
      })
      .where(eq(conditionReportsTable.id, id));
    void logAction({ entityType: ENTITY, entityId: id, action: "STATUS_CHANGE", actorId: (req as any).user?.id ?? null, newValue: { status: "finalized" } });
    res.json({ success: true, data: await loadInspection(id, reqLang(req)) });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

adminRouter.delete("/v1/inspections/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    await db.update(conditionReportsTable).set({ deleted_at: new Date() }).where(eq(conditionReportsTable.id, id));
    void logAction({ entityType: ENTITY, entityId: id, action: "DELETE", actorId: (req as any).user?.id ?? null });
    res.json({ success: true });
  } catch (err: any) {
    fail(res, 500, "SERVER_ERROR", err.message);
  }
});

/** Render a report (or a blank form) as PDF / HTML preview. */
async function renderInspectionPdf(
  res: any,
  data: InspectionDocInput | null,
  templateKey: string | null,
  filename: string,
  format: string,
  hiddenCodes?: Set<string>,
  lang = "ko",
): Promise<void> {
  const company = await resolveCompanyInfo();
  const html = buildUnitInspectionHtml({ data, templateKey, company, forPrint: true, hiddenCodes, lang });
  if (format === "html") { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html); return; }
  try {
    const pdf = await htmlToPdf(html);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}.pdf"`);
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

// Blank form for paper use.
adminRouter.get("/v1/inspection-form/blank.pdf", async (req, res): Promise<void> => {
  try {
    const templateKey = typeof req.query.template === "string" ? req.query.template : DEFAULT_INSPECTION_TEMPLATE_KEY;
    const hidden = await hiddenCodesFor(getInspectionTemplate(templateKey).key);
    await renderInspectionPdf(res, null, templateKey, "unit-inspection-blank", String(req.query.format ?? ""), hidden, reqLang(req));
  } catch (err: any) {
    fail(res, 500, "PDF_FAILED", err.message);
  }
});

// Filled form.
adminRouter.get("/v1/inspections/:id/document.pdf", async (req, res): Promise<void> => {
  try {
    const report = await loadInspection(Number(req.params.id));
    if (!report) { fail(res, 404, "NOT_FOUND", "Inspection not found"); return; }
    await renderInspectionPdf(res, toDocInput(report), report.template_key, report.report_ref, String(req.query.format ?? ""), undefined, reqLang(req));
  } catch (err: any) {
    fail(res, 500, "PDF_FAILED", err.message);
  }
});

/* ═══════════════════════════════════════════════════════════
   PUBLIC  (token-addressed, no auth)
═══════════════════════════════════════════════════════════ */
const publicRouter: IRouter = Router();

/** Resolve a live token → { report, phase }, or null when unusable. */
async function resolveToken(token: string, lang = "ko"): Promise<{ report: Inspection; phase: Phase } | null> {
  if (!token) return null;
  const [row] = await db.select().from(conditionReportsTable).where(eq(conditionReportsTable.sign_token, token)).limit(1);
  if (!row || row.deleted_at) return null;
  if (row.sign_token_expires_at && new Date(row.sign_token_expires_at) < new Date()) return null;
  const report = await loadInspection(row.id, lang);
  if (!report) return null;
  return { report, phase: asPhase(row.sign_token_phase) };
}

/** Tenant-facing view: checklist rows for the active phase + their own responses. */
function publicView(report: Inspection, phase: Phase) {
  return {
    report_ref: report.report_ref,
    phase,
    title: report.title,
    status: report.status,
    template: {
      key: report.templateView.key,
      heading: report.templateView.heading,
      specialTerms: report.templateView.specialTerms,
    },
    meta: report.meta,
    groups: report.templateView.groups,
    signed: report.signatures.some((s) => s.phase === phase && s.role === "tenant"),
    items: report.items.filter((it) => !it.hidden).map((it) => ({
      id: it.id,
      group_key: it.group_key,
      label: it.label,
      status: phase === "move_in" ? it.move_in_status : it.move_out_status,
      note: phase === "move_in" ? it.move_in_note : it.move_out_note,
      photos: it.photos.filter((p) => p.phase === phase).map((p) => ({ id: p.id, url: p.thumbnail_url || p.file_url, full: p.file_url })),
      response: it.responses[0] ? { decision: it.responses[0].decision, comment: it.responses[0].comment } : null,
    })),
  };
}

publicRouter.get("/v1/public/unit-inspections/:token", async (req, res): Promise<void> => {
  try {
    const found = await resolveToken(String(req.params.token), reqLang(req));
    if (!found) { res.status(404).json({ error: "not_found", message: "유효하지 않거나 만료된 링크입니다." }); return; }
    await db
      .update(conditionReportsTable)
      .set({ audit_trail: appendAudit(found.report, { event: "tenant_viewed", ip: clientIp(req) }) })
      .where(eq(conditionReportsTable.id, found.report.id));
    res.json({ success: true, data: publicView(found.report, found.phase) });
  } catch (err: any) {
    res.status(500).json({ error: "server_error", message: err.message });
  }
});

// Per-item 동의 / 이의제기.
publicRouter.post("/v1/public/unit-inspections/:token/respond", async (req, res): Promise<void> => {
  try {
    const found = await resolveToken(String(req.params.token), reqLang(req));
    if (!found) { res.status(404).json({ error: "not_found", message: "유효하지 않거나 만료된 링크입니다." }); return; }
    if (found.report.signatures.some((s) => s.phase === found.phase && s.role === "tenant")) {
      res.status(409).json({ error: "already_signed", message: "이미 서명이 완료되었습니다." }); return;
    }
    const decision = req.body?.decision === "disputed" ? "disputed" : req.body?.decision === "agreed" ? "agreed" : null;
    const itemId = Number(req.body?.item_id);
    const item = found.report.items.find((i) => i.id === itemId);
    if (!decision || !item) { res.status(400).json({ error: "bad_request", message: "item_id and decision are required." }); return; }

    await db.delete(conditionReportResponsesTable).where(eq(conditionReportResponsesTable.item_id, itemId));
    await db.insert(conditionReportResponsesTable).values({
      item_id: itemId,
      decision,
      comment: typeof req.body?.comment === "string" ? req.body.comment : null,
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "server_error", message: err.message });
  }
});

// Tenant evidence photo.
publicRouter.post("/v1/public/unit-inspections/:token/photos", upload.single("image"), async (req, res): Promise<void> => {
  try {
    const found = await resolveToken(String(req.params.token), reqLang(req));
    if (!found) { res.status(404).json({ error: "not_found", message: "유효하지 않거나 만료된 링크입니다." }); return; }
    if (!req.file) { res.status(400).json({ error: "no_file", message: "사진이 없습니다." }); return; }
    if (!isCloudinaryConfigured()) { res.status(503).json({ error: "not_configured", message: "이미지 업로드가 설정되지 않았습니다." }); return; }
    const hash = sha256(req.file.buffer);
    const result = await uploadToCloudinary(req.file.buffer, { folder: cldFolder("condition") });
    const itemId = Number(req.body?.item_id);
    const [photo] = await db
      .insert(conditionReportPhotosTable)
      .values({
        condition_report_id: found.report.id,
        item_id: Number.isFinite(itemId) && itemId > 0 ? itemId : null,
        file_url: result.secure_url,
        thumbnail_url: result.thumbnail_url ?? null,
        cloudinary_id: result.public_id ?? null,
        caption: typeof req.body?.caption === "string" ? req.body.caption : null,
        content_hash: hash,
        phase: found.phase,
        taken_at: new Date(),
        uploaded_by_type: "tenant",
      })
      .returning();
    res.status(201).json({ success: true, data: { id: photo!.id, url: photo!.thumbnail_url || photo!.file_url, full: photo!.file_url } });
  } catch (err: any) {
    res.status(500).json({ error: "upload_failed", message: err.message });
  }
});

// Tenant signs the phase. The signature is bound to a hash of what was shown.
publicRouter.post("/v1/public/unit-inspections/:token/sign", async (req, res): Promise<void> => {
  try {
    const found = await resolveToken(String(req.params.token), reqLang(req));
    if (!found) { res.status(404).json({ error: "not_found", message: "유효하지 않거나 만료된 링크입니다." }); return; }
    const { report, phase } = found;
    if (report.signatures.some((s) => s.phase === phase && s.role === "tenant")) {
      res.status(409).json({ error: "already_signed", message: "이미 서명이 완료되었습니다." }); return;
    }
    const image = typeof req.body?.signature_image === "string" ? req.body.signature_image : "";
    if (!image.startsWith("data:image/")) { res.status(400).json({ error: "bad_signature", message: "서명을 입력해 주세요." }); return; }
    if (req.body?.consent === false) { res.status(400).json({ error: "consent_required", message: "동의가 필요합니다." }); return; }

    const snapshot = phaseSnapshot(report, phase);
    const contentHash = sha256(JSON.stringify(snapshot));
    const ip = clientIp(req);
    const ua = String(req.headers["user-agent"] ?? "").slice(0, 500);

    await db.insert(conditionReportSignaturesTable).values({
      condition_report_id: report.id,
      phase,
      role: "tenant",
      signer_name: typeof req.body?.signer_name === "string" ? req.body.signer_name : null,
      signature_image: image,
      content_hash: contentHash,
      ip,
      user_agent: ua,
    });

    // Status mirrors the tenant's verdict on the phase they just signed.
    const responses = report.items.flatMap((i) => i.responses);
    const anyDisputed = responses.some((r) => r.decision === "disputed");
    await db
      .update(conditionReportsTable)
      .set({
        status: anyDisputed ? "disputed" : "tenant_agreed",
        tenant_responded_at: new Date(),
        // The token stays live (but write-locked) so the tenant can reopen the
        // link and see / download what they signed. Finalize clears it.
        published_snapshot: snapshot,
        content_hash: contentHash,
        audit_trail: appendAudit(report, { event: "tenant_signed", phase, ip, userAgent: ua, content_hash: contentHash }),
      })
      .where(eq(conditionReportsTable.id, report.id));

    void logAction({
      entityType: ENTITY, entityId: report.id, action: "STATUS_CHANGE",
      ipAddress: ip, newValue: { tenant_signed: phase, content_hash: contentHash },
    });
    res.json({ success: true, message: "서명이 완료되었습니다." });
  } catch (err: any) {
    res.status(500).json({ error: "server_error", message: err.message });
  }
});

// Token-gated PDF of what the tenant signed / is being asked to sign.
publicRouter.get("/v1/public/unit-inspections/:token/document.pdf", async (req, res): Promise<void> => {
  try {
    const found = await resolveToken(String(req.params.token), reqLang(req));
    if (!found) { res.status(404).send("Not found"); return; }
    await renderInspectionPdf(res, toDocInput(found.report), found.report.template_key, found.report.report_ref, String(req.query.format ?? ""), undefined, reqLang(req));
  } catch (err: any) {
    res.status(500).send("Failed to render document");
  }
});

export { adminRouter as unitInspectionsAdminRouter, publicRouter as unitInspectionsPublicRouter };

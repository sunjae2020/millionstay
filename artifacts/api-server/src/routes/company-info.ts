import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, integrationSettings, documentsTable } from "@workspace/db";
import { z } from "zod";
import { logAction } from "../utils/auditLog";
import { COMPANY_INFO_KEY, readStoredCompanyInfo } from "../lib/documents/companyInfo";
import { permanentRetentionDate } from "../lib/retention";
import {
  uploadPrivateToCloudinary, deleteFromCloudinary,
  cldFolder, isCloudinaryConfigured, generateSignedUrl,
} from "../utils/cloudinary";

/**
 * Company / organisation info — used as the issuer block on all documents.
 * Stored as a JSON blob in the integration_settings KV (key `company_info`).
 */
const router = Router();

const CompanyInfoBody = z.object({
  company_name: z.string().optional(),
  trading_name: z.string().optional(),
  abn: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  suburb: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
  logo_url: z.string().optional(),
  stamp_url: z.string().optional(),
  brand_color: z.string().optional(),
  ceo: z.string().optional(),
  biz_no: z.string().optional(),
  // 법인등록번호 — landlord block of a Korean lease agreement.
  corp_no: z.string().optional(),
  privacy_officer: z.string().optional(),
}).strip();

router.get("/v1/company-info", async (_req, res): Promise<void> => {
  res.json(await readStoredCompanyInfo());
});

router.put("/v1/company-info", async (req, res): Promise<void> => {
  const parsed = CompanyInfoBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const value = JSON.stringify(parsed.data);
  try {
    await db.insert(integrationSettings)
      .values({ key: COMPANY_INFO_KEY, value, updated_at: new Date() })
      .onConflictDoUpdate({ target: integrationSettings.key, set: { value, updated_at: new Date() } });
  } catch (e: any) {
    res.status(500).json({ error: `Save failed: ${e?.message}` }); return;
  }
  await logAction({ entityType: "company_info", entityId: 1, action: "UPDATE", newValue: parsed.data }).catch(() => {});
  res.json({ ok: true, ...parsed.data });
});

// ── Company documents (사업자등록증 / 통장사본 / 인감증명서 …) ──────────────
//
// The company's own paperwork, filed against the organisation rather than any
// account or contact. Reuses the unified `documents` table with
// entity_type='organisation' (entity_id 1 — one organisation per instance), so
// storage, signed-URL serving and soft-delete behave exactly like account files.
//
// SECURITY: these are the instance's most sensitive commercial records (bank
// account details, registration certificates). Unlike the rest of the settings
// area they are NOT visible to every admin login — only SuperAdmin/Admin, and
// the same allowlist gates read as well as write. The admin UI hides the tab,
// but that is presentation; this check is the control.
const ORG_ENTITY_TYPE = "organisation";
const ORG_ENTITY_ID = 1;
const ORG_DOC_ROLES = new Set(["SuperAdmin", "Super Admin", "superadmin", "super_admin", "Admin"]);

const orgDocUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

function requireOrgDocRole(req: Request, res: Response, next: NextFunction): void {
  const role = (req as any).user?.role ?? "";
  if (!ORG_DOC_ROLES.has(role)) {
    res.status(403).json({
      success: false,
      error: { code: "FORBIDDEN", message: "Company documents are restricted to Admin roles." },
    });
    return;
  }
  next();
}

router.get("/v1/company-info/documents", requireOrgDocRole, async (_req, res): Promise<void> => {
  const rows = await db.select().from(documentsTable)
    .where(and(
      eq(documentsTable.entity_type, ORG_ENTITY_TYPE),
      eq(documentsTable.entity_id, ORG_ENTITY_ID),
      isNull(documentsTable.deleted_at),
    ))
    .orderBy(desc(documentsTable.created_at));
  res.json(rows.map((d) => ({
    id: d.id,
    doc_type: d.doc_type,
    file_name: d.file_name,
    file_size: d.file_size,
    mime_type: d.mime_type,
    created_at: d.created_at,
    // 15-minute signed URL — the asset itself is private on Cloudinary.
    signed_url: generateSignedUrl(d.cloudinary_public_id, 900),
  })));
});

router.post(
  "/v1/company-info/documents",
  requireOrgDocRole,
  orgDocUpload.single("file"),
  async (req, res): Promise<void> => {
    if (!req.file) { res.status(400).json({ error: "A file is required" }); return; }
    if (!isCloudinaryConfigured()) { res.status(503).json({ error: "File storage is not configured" }); return; }

    const docType = (typeof req.body?.doc_type === "string" && req.body.doc_type.trim() ? req.body.doc_type : "other")
      .slice(0, 32);
    try {
      const up = await uploadPrivateToCloudinary(req.file.buffer, { folder: cldFolder("private/organisation") });
      const [row] = await db.insert(documentsTable).values({
        entity_type: ORG_ENTITY_TYPE,
        entity_id: ORG_ENTITY_ID,
        doc_type: docType,
        file_name: req.file.originalname.slice(0, 255),
        file_size: req.file.size,
        mime_type: req.file.mimetype.slice(0, 100),
        cloudinary_public_id: up.public_id,
        uploaded_by: (req as any).user?.id ?? null,
        uploaded_by_type: "User",
        // Company records are kept for the life of the entity, not purged.
        retention_until: permanentRetentionDate(),
      } as never).returning();
      await logAction({
        entityType: "company_document", entityId: ORG_ENTITY_ID, action: "CREATE",
        newValue: { doc_type: docType, file_name: req.file.originalname },
      }).catch(() => {});
      res.status(201).json({ success: true, document: row });
    } catch (err) {
      console.error("[company-info] document upload failed:", err instanceof Error ? err.message : err);
      res.status(500).json({ error: "File upload failed" });
    }
  },
);

router.delete("/v1/company-info/documents/:docId", requireOrgDocRole, async (req, res): Promise<void> => {
  const docId = String(req.params["docId"] ?? "");
  if (!docId) { res.status(400).json({ error: "Invalid request" }); return; }
  const [doc] = await db.select().from(documentsTable).where(and(
    eq(documentsTable.id, docId),
    eq(documentsTable.entity_type, ORG_ENTITY_TYPE),
    eq(documentsTable.entity_id, ORG_ENTITY_ID),
    isNull(documentsTable.deleted_at),
  ));
  if (!doc) { res.status(404).json({ error: "Not found" }); return; }
  await db.update(documentsTable).set({ deleted_at: new Date() }).where(eq(documentsTable.id, doc.id));
  await deleteFromCloudinary(doc.cloudinary_public_id);
  await logAction({
    entityType: "company_document", entityId: ORG_ENTITY_ID, action: "DELETE",
    oldValue: { doc_type: doc.doc_type, file_name: doc.file_name },
  }).catch(() => {});
  res.status(204).end();
});

export default router;

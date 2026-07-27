import { Router } from "express";
import { db, integrationSettings } from "@workspace/db";
import { z } from "zod";
import { logAction } from "../utils/auditLog";
import { COMPANY_INFO_KEY, readStoredCompanyInfo } from "../lib/documents/companyInfo";

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

export default router;

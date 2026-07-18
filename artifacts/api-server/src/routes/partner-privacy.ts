/**
 * Partner DSAR routes — Australian Privacy Principles APP 12 (access) & APP 13
 * (correction/deletion) for partner users (agents, owners, service hosts and
 * homestay hosts). These individuals hold personal information (name, email,
 * phone, avatar) in `partner_users` but previously had no access or deletion
 * path — the APPs apply to all individuals, not only guests.
 *
 * Auth: any authenticated partner (`requirePartnerAuth`) may act on their OWN
 * record only — the acting partner id comes from the verified JWT, never the
 * request body.
 */
import { Router, type IRouter } from "express";
import { db, partnerUsersTable, accountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requirePartnerAuth, type PartnerAuthPayload, invalidatePartnerCache } from "../middlewares/requirePartnerAuth";
import { logAction } from "../utils/auditLog";
import { getPrivacyContactEmail } from "../lib/companyContact";

const router: IRouter = Router();

/* ───────────────────────────────────────────────────────
   GET /api/v1/partner/me/export  (APP 12 — Right of access)
   JSON dump of the authenticated partner's own personal data.
──────────────────────────────────────────────────────── */
router.get("/v1/partner/me/export", requirePartnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  try {
    const [profile] = await db
      .select({
        id: partnerUsersTable.id,
        account_id: partnerUsersTable.account_id,
        portal_type: partnerUsersTable.portal_type,
        email: partnerUsersTable.email,
        first_name: partnerUsersTable.first_name,
        last_name: partnerUsersTable.last_name,
        phone: partnerUsersTable.phone,
        avatar_url: partnerUsersTable.avatar_url,
        is_active: partnerUsersTable.is_active,
        last_login_at: partnerUsersTable.last_login_at,
        created_at: partnerUsersTable.created_at,
        updated_at: partnerUsersTable.updated_at,
      })
      .from(partnerUsersTable)
      .where(eq(partnerUsersTable.id, partner.id))
      .limit(1);

    if (!profile) { res.status(404).json({ success: false, error: "Profile not found" }); return; }

    const [account] = profile.account_id
      ? await db.select({ id: accountsTable.id, name: accountsTable.name })
          .from(accountsTable).where(eq(accountsTable.id, profile.account_id)).limit(1)
      : [];

    await logAction({
      entityType: "partner_users",
      entityId: partner.id,
      action: "VERIFY",
      actorId: partner.id,
      actorEmail: profile.email,
      newValue: { event: "DSAR_EXPORT", portal_type: profile.portal_type },
      ipAddress: req.ip ?? null,
    });

    const dump = {
      generated_at: new Date().toISOString(),
      legal_basis:
        "Australian Privacy Principle 12 (Right of access). Contains the personal information Million Stay holds about you as a partner user.",
      data: { profile, account: account ?? null },
    };

    if ((req.query["format"] as string) === "download") {
      const safeEmail = profile.email.replace(/[^a-zA-Z0-9._-]/g, "_");
      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="millionstay-partner-${safeEmail}-${stamp}.json"`);
      res.send(JSON.stringify(dump, null, 2));
      return;
    }
    res.json({ success: true, ...dump });
  } catch (err) {
    console.error("[partner DSAR export]", err);
    res.status(500).json({ success: false, error: `Export failed. Contact ${getPrivacyContactEmail()}.` });
  }
});

/* ───────────────────────────────────────────────────────
   POST /api/v1/partner/me/deletion-request  (APP 13 — Deletion)
   Pseudonymises the partner's own identifying PII and disables the account.
   Business records (commissions, bookings, contracts) are retained under
   statutory/contractual obligations.
──────────────────────────────────────────────────────── */
router.post("/v1/partner/me/deletion-request", requirePartnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.slice(0, 500) : null;
  try {
    const [profile] = await db.select().from(partnerUsersTable).where(eq(partnerUsersTable.id, partner.id)).limit(1);
    if (!profile) { res.status(404).json({ success: false, error: "Account not found" }); return; }

    await db.update(partnerUsersTable)
      .set({
        is_active: false,
        deleted_at: new Date(),
        first_name: "Deleted",
        last_name: "User",
        email: `deleted+partner-${partner.id}@deleted.millionstay.invalid`,
        phone: null,
        avatar_url: null,
        // Invalidate all outstanding sessions / reset tokens.
        tokens_invalid_after: new Date(),
        reset_token_hash: null,
        reset_token_expires_at: null,
      })
      .where(eq(partnerUsersTable.id, partner.id));

    invalidatePartnerCache(partner.id);

    await logAction({
      entityType: "partner_users",
      entityId: partner.id,
      action: "DELETE",
      actorId: partner.id,
      actorEmail: profile.email,
      newValue: { event: "DSAR_DELETION", portal_type: profile.portal_type, reason },
      ipAddress: req.ip ?? null,
    });

    res.json({
      success: true,
      message:
        "Deletion request received. Your account is now pseudonymised and disabled. Business records subject to legal retention (commissions, contracts, tax records) are kept until the retention period expires.",
      privacy_contact: getPrivacyContactEmail(),
    });
  } catch (err) {
    console.error("[partner DSAR deletion]", err);
    res.status(500).json({ success: false, error: `Deletion request failed. Contact ${getPrivacyContactEmail()}.` });
  }
});

export default router;

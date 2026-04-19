import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, partnerUsersTable, accountsTable } from "@workspace/db";
import { signPartnerJWT, requirePartnerAuth, type PartnerAuthPayload } from "../middlewares/requirePartnerAuth";
import { validatePassword } from "../utils/passwordPolicy";

const router: IRouter = Router();

/* POST /api/v1/auth/partner/login */
router.post("/v1/auth/partner/login", async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      res.status(400).json({ success: false, error: "Email and password are required" });
      return;
    }
    const [user] = await db
      .select()
      .from(partnerUsersTable)
      .where(eq(partnerUsersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user || !user.is_active) {
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    await db
      .update(partnerUsersTable)
      .set({ last_login_at: new Date() })
      .where(eq(partnerUsersTable.id, user.id));

    const token = signPartnerJWT({
      id: user.id,
      email: user.email,
      account_id: user.account_id,
      portal_type: user.portal_type as "agent" | "owner",
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        portal_type: user.portal_type,
        account_id: user.account_id,
        avatar_url: user.avatar_url,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Login failed" });
  }
});

/* GET /api/v1/auth/partner/me */
router.get("/v1/auth/partner/me", requirePartnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const [user] = await db
    .select({
      id: partnerUsersTable.id,
      email: partnerUsersTable.email,
      first_name: partnerUsersTable.first_name,
      last_name: partnerUsersTable.last_name,
      phone: partnerUsersTable.phone,
      portal_type: partnerUsersTable.portal_type,
      account_id: partnerUsersTable.account_id,
      avatar_url: partnerUsersTable.avatar_url,
      is_active: partnerUsersTable.is_active,
      last_login_at: partnerUsersTable.last_login_at,
    })
    .from(partnerUsersTable)
    .where(eq(partnerUsersTable.id, partner.id))
    .limit(1);

  if (!user) {
    res.status(404).json({ success: false, error: "User not found" });
    return;
  }

  const [account] = await db
    .select({ id: accountsTable.id, name: accountsTable.name, account_type: accountsTable.account_type })
    .from(accountsTable)
    .where(eq(accountsTable.id, user.account_id))
    .limit(1);

  res.json({ success: true, user: { ...user, account } });
});

/* POST /api/v1/auth/partner/change-password */
router.post("/v1/auth/partner/change-password", requirePartnerAuth, async (req, res): Promise<void> => {
  const partner = (req as any).partner as PartnerAuthPayload;
  const { current_password, new_password } = req.body as { current_password: string; new_password: string };
  if (!current_password || !new_password) {
    res.status(400).json({ success: false, error: "Both current and new password required" });
    return;
  }
  const policy = validatePassword(new_password);
  if (!policy.ok) {
    res.status(400).json({ success: false, error: policy.error });
    return;
  }
  const [user] = await db.select().from(partnerUsersTable).where(eq(partnerUsersTable.id, partner.id)).limit(1);
  if (!user) { res.status(404).json({ success: false, error: "User not found" }); return; }
  const valid = await bcrypt.compare(current_password, user.password_hash);
  if (!valid) { res.status(400).json({ success: false, error: "Current password is incorrect" }); return; }
  const password_hash = await bcrypt.hash(new_password, 10);
  await db.update(partnerUsersTable).set({ password_hash }).where(eq(partnerUsersTable.id, partner.id));
  res.json({ success: true, message: "Password changed successfully" });
});

export default router;

import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signJWT, requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.post("/v1/auth/login", async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      res.status(400).json({ success: false, error: "Email and password are required" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
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
      .update(usersTable)
      .set({ last_login_at: new Date() })
      .where(eq(usersTable.id, user.id));

    const payload = { id: user.id, email: user.email, role: user.role };
    const token = signJWT(payload);

    if ((req as any).session) {
      (req as any).session.token = token;
    }

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        force_password_change: user.force_password_change,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Login failed" });
  }
});

router.post("/v1/auth/logout", (req, res): void => {
  if ((req as any).session) {
    (req as any).session.destroy(() => {});
  }
  res.json({ success: true });
});

router.get("/v1/auth/me", requireAuth, (req, res): void => {
  res.json({ success: true, user: (req as any).user });
});

export default router;

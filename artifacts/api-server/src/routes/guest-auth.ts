import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, guestUsersTable, accountsTable } from "@workspace/db";
import { signGuestJWT, requireGuestAuth } from "../middlewares/requireGuestAuth";

const router: IRouter = Router();

/* ───────────────────────────────────────────────────────
   POST /api/v1/auth/guest/register
──────────────────────────────────────────────────────── */
router.post("/v1/auth/guest/register", async (req, res): Promise<void> => {
  try {
    const { email, password, first_name, last_name, phone } = req.body as {
      email: string;
      password: string;
      first_name?: string;
      last_name?: string;
      phone?: string;
    };

    if (!email || !password) {
      res.status(400).json({ success: false, error: "Email and password are required" });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ success: false, error: "Password must be at least 8 characters" });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if already registered
    const [existing] = await db
      .select({ id: guestUsersTable.id })
      .from(guestUsersTable)
      .where(eq(guestUsersTable.email, normalizedEmail))
      .limit(1);

    if (existing) {
      res.status(409).json({ success: false, error: "Email already registered" });
      return;
    }

    const password_hash = await bcrypt.hash(password, 10);

    // Create Guest account in accounts table
    const fullName = [first_name, last_name].filter(Boolean).join(" ") || normalizedEmail.split("@")[0];
    const [newAccount] = await db
      .insert(accountsTable)
      .values({
        name: fullName,
        account_type: "Guest",
        account_email: normalizedEmail,
        phone1: phone ?? null,
        status: "Active",
      })
      .returning({ id: accountsTable.id });

    // Create guest user
    const [newGuest] = await db
      .insert(guestUsersTable)
      .values({
        email: normalizedEmail,
        password_hash,
        first_name: first_name ?? null,
        last_name: last_name ?? null,
        phone: phone ?? null,
        account_id: newAccount.id,
        is_active: true,
      })
      .returning({
        id: guestUsersTable.id,
        email: guestUsersTable.email,
        first_name: guestUsersTable.first_name,
        last_name: guestUsersTable.last_name,
        account_id: guestUsersTable.account_id,
      });

    const token = signGuestJWT({
      id: newGuest.id,
      email: newGuest.email,
      account_id: newGuest.account_id,
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: newGuest.id,
        email: newGuest.email,
        first_name: newGuest.first_name,
        last_name: newGuest.last_name,
        account_id: newGuest.account_id,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Registration failed" });
  }
});

/* ───────────────────────────────────────────────────────
   POST /api/v1/auth/guest/login
──────────────────────────────────────────────────────── */
router.post("/v1/auth/guest/login", async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      res.status(400).json({ success: false, error: "Email and password are required" });
      return;
    }

    const [guest] = await db
      .select()
      .from(guestUsersTable)
      .where(eq(guestUsersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (!guest || !guest.is_active) {
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, guest.password_hash);
    if (!valid) {
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    const token = signGuestJWT({
      id: guest.id,
      email: guest.email,
      account_id: guest.account_id,
    });

    res.json({
      success: true,
      token,
      user: {
        id: guest.id,
        email: guest.email,
        first_name: guest.first_name,
        last_name: guest.last_name,
        account_id: guest.account_id,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Login failed" });
  }
});

/* ───────────────────────────────────────────────────────
   GET /api/v1/auth/guest/me
──────────────────────────────────────────────────────── */
router.get("/v1/auth/guest/me", requireGuestAuth, async (req, res): Promise<void> => {
  const guestPayload = (req as any).guest;

  const [guest] = await db
    .select({
      id: guestUsersTable.id,
      email: guestUsersTable.email,
      first_name: guestUsersTable.first_name,
      last_name: guestUsersTable.last_name,
      phone: guestUsersTable.phone,
      account_id: guestUsersTable.account_id,
      is_active: guestUsersTable.is_active,
      created_at: guestUsersTable.created_at,
    })
    .from(guestUsersTable)
    .where(eq(guestUsersTable.id, guestPayload.id))
    .limit(1);

  if (!guest) {
    res.status(404).json({ success: false, error: "Guest not found" });
    return;
  }

  res.json({ success: true, user: guest });
});

export default router;

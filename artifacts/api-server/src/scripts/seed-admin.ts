// privacy-skip: one-time admin bootstrap. Uses SEED_ADMIN_PASSWORD when set,
// otherwise generates a strong random password (printed once below). The account
// is created with force_password_change so it must be rotated on first login.
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function seedAdmin() {
  // Per-instance bootstrap (white-label, spec §2.6). No predictable built-in
  // password (H-902) — generate one when the env var is absent.
  const email = process.env["SEED_ADMIN_EMAIL"] ?? "admin@millionstay.com";
  const password = process.env["SEED_ADMIN_PASSWORD"] ?? crypto.randomBytes(18).toString("base64url");

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) {
    console.log(`Admin user already exists: ${email}`);
    process.exit(0);
  }

  const password_hash = await bcrypt.hash(password, 12);
  await db.insert(usersTable).values({
    email,
    password_hash,
    // Canonical name — must match a row in `roles`. "Super Admin" (with a
    // space) is a different string and silently fails every SuperAdmin gate.
    role: "SuperAdmin",
    first_name: "Million",
    last_name: "Stay",
    is_active: true,
    force_password_change: true,
  });

  console.log("╔══════════════════════════════════════════╗");
  console.log("║      Admin user created successfully      ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log(`║  Email:    ${email}   ║`);
  console.log(`║  Password: ${password}          ║`);
  console.log("╚══════════════════════════════════════════╝");
  process.exit(0);
}

seedAdmin().catch(err => { console.error(err); process.exit(1); });

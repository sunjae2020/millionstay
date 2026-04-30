// privacy-skip: one-time local admin bootstrap. The hardcoded credential
// below is the initial seed only; it MUST be rotated immediately after
// first login. Do not run this in production.
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function seedAdmin() {
  const email = "admin@millionstay.com";
  const password = "MillionStay@2026!";

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) {
    console.log(`Admin user already exists: ${email}`);
    process.exit(0);
  }

  const password_hash = await bcrypt.hash(password, 12);
  await db.insert(usersTable).values({
    email,
    password_hash,
    role: "Super Admin",
    first_name: "Million",
    last_name: "Stay",
    is_active: true,
    force_password_change: false,
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

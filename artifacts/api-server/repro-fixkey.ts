import { db, integrationSettings } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  const valid = process.env.RESEND_API_KEY;
  if (!valid) { console.log("No local RESEND_API_KEY in env"); return; }
  // Verify it's actually valid before persisting.
  const check = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${valid}` } });
  if (check.status !== 200) { console.log("Local key is NOT valid (HTTP " + check.status + ") — aborting."); return; }

  const [before] = await db.select().from(integrationSettings).where(eq(integrationSettings.key, "RESEND_API_KEY"));
  console.log("before:", before ? `${before.value.slice(0,6)}...${before.value.slice(-4)}` : "(none)");

  await db.insert(integrationSettings)
    .values({ key: "RESEND_API_KEY", value: valid, updated_at: new Date() })
    .onConflictDoUpdate({ target: integrationSettings.key, set: { value: valid, updated_at: new Date() } });

  const [after] = await db.select().from(integrationSettings).where(eq(integrationSettings.key, "RESEND_API_KEY"));
  console.log("after :", `${after.value.slice(0,6)}...${after.value.slice(-4)}`);
  console.log("updated to VALID key:", after.value === valid);
}
main().then(() => process.exit(0)).catch((e) => { console.error("THREW:", e); process.exit(1); });

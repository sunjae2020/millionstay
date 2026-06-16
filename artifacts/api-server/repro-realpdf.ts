import { db, integrationSettings, contractSigningRequestsTable } from "@workspace/db";
import { inArray, eq } from "drizzle-orm";
import { Resend } from "resend";
import { generateAndStoreSignedPdf } from "./src/services/applicationDocs.js";

async function main() {
  let key = process.env.RESEND_API_KEY;
  let from = process.env.EMAIL_FROM;
  if (!key || !from) {
    const s = await db.select().from(integrationSettings).where(inArray(integrationSettings.key, ["RESEND_API_KEY", "EMAIL_FROM"]));
    const m = new Map(s.map((r) => [r.key, r.value]));
    key = key || m.get("RESEND_API_KEY");
    from = from || m.get("EMAIL_FROM");
  }
  const FROM = from || "MillionStay <noreply@contact.millionstay.com>";

  const TOKEN = "cab4452a1150960e4eb21b7655a1987a62888944668b7c4be2a00ae4d3b958eb";
  const [row] = await db.select().from(contractSigningRequestsTable).where(eq(contractSigningRequestsTable.token, TOKEN)).limit(1);
  const { pdf } = await generateAndStoreSignedPdf(row as any);
  console.log("PDF bytes:", pdf?.length, "| base64 KB:", pdf ? Math.round(pdf.toString("base64").length / 1024) : 0);
  if (!pdf) { console.log("no pdf"); return; }

  const resend = new Resend(key!);
  const result = await resend.emails.send({
    from: FROM,
    to: ["millionstay.com@gmail.com"],
    subject: "MillionStay — real-PDF delivery diagnostic",
    html: "<p>Real signed PDF attachment diagnostic.</p>",
    attachments: [{ filename: "HHA-2026-00005.pdf", content: pdf.toString("base64") }],
  });
  console.log("=== Resend result (real PDF) ===");
  console.log("data:", JSON.stringify(result.data));
  console.log("error:", JSON.stringify(result.error));
}
main().then(() => process.exit(0)).catch((e) => { console.error("THREW:", e); process.exit(1); });

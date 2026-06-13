/**
 * seed-document-templates.mjs
 *
 * Idempotently upserts the homestay email + contract templates into
 * document_templates / document_template_translations (status=published, en).
 * Copy mirrors the current hardcoded behaviour, so publishing changes nothing
 * until ops edit a template in the Studio. Re-running replaces the en copy.
 *
 * Usage:  DATABASE_URL=... node scripts/seed-document-templates.mjs
 */
import pg from "pg";
const { Pool } = pg;

const EMAIL_VARS = { ref: { type: "string" }, name: { type: "string" }, portal_url: { type: "url" }, note: { type: "string" } };

const p = (heading, body) =>
  `<h1 style="font-size:20px;margin:0 0 12px;color:#1f2937;">${heading}</h1>` +
  `<p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0;">Hi {{name}},</p>` +
  `<p style="font-size:14px;color:#4b5563;line-height:1.6;margin:12px 0 0;">${body}</p>`;

const PORTAL = `<a href="{{portal_url}}">{{portal_url}}</a>`;

const TEMPLATES = [
  { kind: "email", key: "homestay.host_received", name: "Homestay host — application received", category: "Homestay", vars: EMAIL_VARS,
    subject: "We received your Homestay Host application ({{ref}})",
    body: p("Application received", `Thank you for applying to become a MillionStay homestay host. Your application is now with our team for review. You can log in to your host portal at any time to track your status and complete any outstanding steps: ${PORTAL}.`) },
  { kind: "email", key: "homestay.docs_requested", name: "Homestay host — documents requested", category: "Homestay", vars: EMAIL_VARS,
    subject: "Action needed: documents for your Homestay Host application ({{ref}})",
    body: p("Additional documents requested", `To continue reviewing your homestay host application, we need a few more documents. Please log in to your host portal to upload them: ${PORTAL}.`) },
  { kind: "email", key: "homestay.approved", name: "Homestay host — approved", category: "Homestay", vars: EMAIL_VARS,
    subject: "You're approved as a MillionStay Homestay Host ({{ref}})",
    body: p("Welcome — you're approved!", `Congratulations! Your homestay host application has been approved. You can now activate your listing and start hosting. Log in to your host portal to get started: ${PORTAL}.`) },
  { kind: "email", key: "homestay.rejected", name: "Homestay host — not approved", category: "Homestay", vars: EMAIL_VARS,
    subject: "Update on your Homestay Host application ({{ref}})",
    body: p("Application update", `Thank you for your interest in hosting with MillionStay. After review, we're unable to approve your application at this time. If you believe this was in error or your circumstances change, please reply to this email.`) },
  { kind: "email", key: "homestay.placement_proposed", name: "Homestay host — new student match", category: "Homestay", vars: EMAIL_VARS,
    subject: "New student match for your homestay ({{ref}})",
    body: p("You have a new student match", `Great news — our team has matched a student with your homestay. Please log in to your host portal to review the placement details and accept the match: ${PORTAL}.`) },
  { kind: "email", key: "homestay.placement_signed", name: "Homestay — placement agreement signed", category: "Homestay", vars: EMAIL_VARS,
    subject: "Your homestay placement agreement is signed ({{ref}})",
    body: p("Placement agreement signed", `The homestay placement agreement has been signed by all parties. A signed copy is emailed separately. You can view the placement in your host portal: ${PORTAL}.`) },
  { kind: "email", key: "homestay.payment_due", name: "Homestay — monthly fee due", category: "Homestay",
    vars: { ref: { type: "string" }, name: { type: "string" }, amount: { type: "string" }, period: { type: "date" }, pay_url: { type: "url" } },
    subject: "Homestay monthly fee due ({{ref}})",
    body: `<h1 style="font-size:20px;margin:0 0 12px;color:#1f2937;">Monthly homestay fee</h1>` +
      `<p style="font-size:14px;color:#4b5563;line-height:1.6;">Hi {{name}}, your homestay monthly fee of <strong>{{amount}}</strong> for the period starting {{period}} is due. Please pay securely here:</p>` +
      `<p style="margin:18px 0;"><a href="{{pay_url}}" style="background:#E8621A;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Pay now</a></p>` +
      `<p style="font-size:12px;color:#9ca3af;">A 2% card processing fee is included. Reference: {{ref}}.</p>` },
  // ── Regular short/long-term operations (bookings · contracts · invoices) ──
  // Email templates here supply the cover-email NOTE sentence (+ optional
  // subject). The body is plain text injected into the fixed branded shell, so
  // it mirrors the current hardcoded note — publishing changes nothing until
  // ops edit it. Subject is omitted (null) so the default subject is kept.
  { kind: "email", key: "email.contract", name: "Contract — cover email", category: "Documents",
    vars: { ref: { type: "string" }, name: { type: "string" }, amount: { type: "string" } },
    subject: null,
    body: "Please review the attached agreement. If everything looks correct, sign and return it at your earliest convenience." },
  { kind: "email", key: "email.invoice", name: "Invoice — cover email", category: "Documents",
    vars: { ref: { type: "string" }, name: { type: "string" }, amount: { type: "string" }, due_date: { type: "date" } },
    subject: null,
    body: "Please find your invoice attached. Payment is due by {{due_date}}." },
  { kind: "email", key: "email.receipt", name: "Receipt — cover email", category: "Documents",
    vars: { ref: { type: "string" }, name: { type: "string" }, amount: { type: "string" } },
    subject: null,
    body: "Thank you for your payment. A receipt is attached for your records." },
  { kind: "contract", key: "contract.terms", name: "Tenancy/Accommodation Agreement — default terms", category: "Documents", vars: {},
    subject: null,
    body: [
      "This Accommodation Agreement is made between MillionStay (or the landlord named above) and the tenant named above.",
      "",
      "1. Premises & term. The landlord agrees to let the premises shown above to the tenant for the term shown above. The tenant agrees to keep the premises in good condition and to comply with the house rules.",
      "",
      "2. Rent & charges. Rent is payable in advance at the rate shown above, as invoiced. Any bond and advance amounts shown above are payable before the start of the term.",
      "",
      "3. Bond. The bond is held as security against damage and unpaid amounts and is refundable at the end of the term subject to no outstanding amounts or damage beyond fair wear and tear.",
      "",
      "4. Use & conduct. The tenant will use the premises only for residential purposes, will not cause nuisance, and will allow reasonable access for inspection and repairs with notice.",
      "",
      "5. Termination. Either party may end this agreement in line with the notice requirements of the applicable residential tenancy laws. Rent is payable up to the move-out date.",
      "",
      "6. Privacy. Personal information is handled in line with MillionStay's Privacy Policy and the Australian Privacy Principles.",
      "",
      "By signing below, each party confirms they have read, understood and agree to these terms.",
    ].join("\n") },
  { kind: "contract", key: "homestay_placement_terms", name: "Homestay Placement Agreement — terms", category: "Homestay", vars: {},
    subject: null,
    body: [
      "This Homestay Placement Agreement is made between MillionStay, the host family, and the student (and their guardian, where the student is under 18).",
      "",
      "1. Placement. The host family agrees to provide accommodation and the agreed meal plan to the student for the term shown above. The student agrees to respect the host family's home and house rules.",
      "",
      "2. Fees. The placement fee, deposit and ongoing accommodation fee shown above are payable in advance as invoiced. The deposit is refundable at the end of the placement subject to no outstanding amounts or damage.",
      "",
      "3. Meals & facilities. Meals are provided per the selected package. The student has use of the agreed room and shared facilities.",
      "",
      "4. Conduct & safety. The student will follow reasonable house rules. Where the student is a minor, the host family confirms all adult household members hold a valid Working with Children Check.",
      "",
      "5. Changes & cancellation. Either party may request changes through MillionStay. Cancellation before move-in: the placement fee is non-refundable; the deposit is refunded. After move-in, at least two (2) weeks' written notice is required; fees are pro-rated to the move-out date.",
      "",
      "6. Privacy. Personal information is handled in line with MillionStay's Privacy Policy and the Australian Privacy Principles.",
      "",
      "By signing below, each party confirms they have read, understood and agree to these terms.",
    ].join("\n") },
];

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const c = await pool.connect();
try {
  for (const t of TEMPLATES) {
    const up = await c.query(
      `INSERT INTO document_templates (kind, key, name, category, variables_schema, status, version)
       VALUES ($1,$2,$3,$4,$5::jsonb,'published',1)
       ON CONFLICT (kind, key) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category,
         variables_schema=EXCLUDED.variables_schema, status='published', updated_at=now()
       RETURNING id`,
      [t.kind, t.key, t.name, t.category, JSON.stringify(t.vars)],
    );
    const id = up.rows[0].id;
    await c.query(
      `INSERT INTO document_template_translations (template_id, locale, subject, body_html)
       VALUES ($1,'en',$2,$3)
       ON CONFLICT (template_id, locale) DO UPDATE SET subject=EXCLUDED.subject, body_html=EXCLUDED.body_html, updated_at=now()`,
      [id, t.subject, t.body],
    );
    console.log(`✓ ${t.kind}/${t.key} (#${id})`);
  }
  console.log(`Seeded ${TEMPLATES.length} templates.`);
} finally {
  c.release();
  await pool.end();
}

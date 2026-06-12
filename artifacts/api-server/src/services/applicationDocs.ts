// Homestay application documents — generate the signed PDF, store it privately,
// and email it to the applicant / linked agent / ops.
//
// All functions are BEST-EFFORT: they never throw to the caller (the signing
// response must not be blocked or failed by PDF/email problems). Mirrors the
// best-effort email pattern already used across the homestay routes.
import { eq } from "drizzle-orm";
import {
  db,
  contractSigningRequestsTable,
  homestayStudentRequestsTable,
  homestayHostApplicationsTable,
  homestayPlacementsTable,
  accountsTable,
} from "@workspace/db";
import { htmlToPdf, PdfUnavailableError } from "../lib/documents/pdf.js";
import {
  buildApplicationHtml,
  studentApplicationToDoc,
  hostApplicationToDoc,
  placementToDoc,
  type ApplicationDocInput,
} from "../lib/documents/applicationPdf.js";
import { isCloudinaryConfigured, uploadPrivateToCloudinary } from "../utils/cloudinary.js";
import { sendDocumentEmail } from "../lib/email.js";

type SigningRow = typeof contractSigningRequestsTable.$inferSelect;

export interface RecipientSelection {
  applicant?: boolean;
  agent?: boolean;
  ops?: boolean;
  /** Host family — only meaningful for placement_contract documents. */
  host?: boolean;
}

export interface ResolvedRecipients {
  applicant?: { email: string; name?: string };
  agent?: { email: string; name?: string };
  ops?: { email: string };
  host?: { email: string; name?: string };
}

/** Build the ApplicationDocInput for a signing request's underlying record. */
export async function buildDocForSigning(
  signing: Pick<SigningRow, "context_type" | "context_id" | "status" | "signers" | "signatures" | "signed_at">,
  opts: { signed?: boolean } = {},
): Promise<ApplicationDocInput | null> {
  const view = {
    status: signing.status,
    signers: signing.signers,
    signatures: signing.signatures,
    signed_at: signing.signed_at,
  };
  if (signing.context_type === "student_app") {
    const [row] = await db.select().from(homestayStudentRequestsTable)
      .where(eq(homestayStudentRequestsTable.id, signing.context_id)).limit(1);
    return row ? studentApplicationToDoc(row, view, opts) : null;
  }
  if (signing.context_type === "host_app") {
    const [row] = await db.select().from(homestayHostApplicationsTable)
      .where(eq(homestayHostApplicationsTable.id, signing.context_id)).limit(1);
    return row ? hostApplicationToDoc(row, view, opts) : null;
  }
  if (signing.context_type === "placement_contract") {
    const [placement] = await db.select().from(homestayPlacementsTable)
      .where(eq(homestayPlacementsTable.id, signing.context_id)).limit(1);
    if (!placement) return null;
    const [host] = await db.select().from(homestayHostApplicationsTable)
      .where(eq(homestayHostApplicationsTable.id, placement.host_application_id)).limit(1);
    const [student] = await db.select().from(homestayStudentRequestsTable)
      .where(eq(homestayStudentRequestsTable.id, placement.student_request_id)).limit(1);
    return placementToDoc(placement, host ?? null, student ?? null, view, opts);
  }
  return null;
}

/**
 * Render the signed application to PDF and store it privately (Cloudinary
 * authenticated). Sets pdf_url (= Cloudinary public_id) + pdf_generated_at on the
 * signing row. Returns the rendered bytes (for immediate emailing) and the stored
 * public_id. Never throws — on any failure logs and returns nulls.
 */
export async function generateAndStoreSignedPdf(
  signing: SigningRow,
): Promise<{ pdf: Buffer | null; pdfUrl: string | null }> {
  try {
    const doc = await buildDocForSigning(signing, { signed: true });
    if (!doc) return { pdf: null, pdfUrl: null };

    const pdf = await htmlToPdf(buildApplicationHtml(doc));

    let pdfUrl: string | null = signing.pdf_url ?? null;
    if (isCloudinaryConfigured()) {
      try {
        const up = await uploadPrivateToCloudinary(pdf, {
          format: "pdf",
          folder: "millionstay/private/applications",
        });
        pdfUrl = up.public_id;
        await db.update(contractSigningRequestsTable)
          .set({ pdf_url: pdfUrl, pdf_generated_at: new Date() })
          .where(eq(contractSigningRequestsTable.id, signing.id));
      } catch (e) {
        console.error("[applicationDocs] Cloudinary upload failed:", e);
      }
    }
    return { pdf, pdfUrl };
  } catch (err) {
    if (err instanceof PdfUnavailableError) {
      console.warn("[applicationDocs] PDF rendering unavailable — skipping:", err.message);
    } else {
      console.error("[applicationDocs] generateAndStoreSignedPdf failed:", err);
    }
    return { pdf: null, pdfUrl: null };
  }
}

/** Resolve applicant / agent / ops email addresses for a signing request. */
export async function resolveRecipients(signing: SigningRow): Promise<ResolvedRecipients> {
  const out: ResolvedRecipients = {};
  const ops = process.env.LEAD_NOTIFICATION_EMAIL || process.env.LEADS_NOTIFY_EMAIL || process.env.SUPPORT_EMAIL;
  if (ops) out.ops = { email: ops };

  try {
    if (signing.context_type === "student_app") {
      const [row] = await db.select().from(homestayStudentRequestsTable)
        .where(eq(homestayStudentRequestsTable.id, signing.context_id)).limit(1);
      if (row) {
        const email = row.student_email || row.guardian_email;
        if (email) out.applicant = { email, name: `${row.student_first_name} ${row.student_last_name}`.trim() };
        if (row.agent_account_id) {
          const [agent] = await db.select().from(accountsTable)
            .where(eq(accountsTable.id, row.agent_account_id)).limit(1);
          if (agent?.account_email) out.agent = { email: agent.account_email, name: agent.name };
        }
      }
    } else if (signing.context_type === "host_app") {
      const [row] = await db.select().from(homestayHostApplicationsTable)
        .where(eq(homestayHostApplicationsTable.id, signing.context_id)).limit(1);
      if (row?.email) out.applicant = { email: row.email, name: `${row.first_name} ${row.last_name}`.trim() };
    } else if (signing.context_type === "placement_contract") {
      const [placement] = await db.select().from(homestayPlacementsTable)
        .where(eq(homestayPlacementsTable.id, signing.context_id)).limit(1);
      if (placement) {
        const [student] = await db.select().from(homestayStudentRequestsTable)
          .where(eq(homestayStudentRequestsTable.id, placement.student_request_id)).limit(1);
        const [host] = await db.select().from(homestayHostApplicationsTable)
          .where(eq(homestayHostApplicationsTable.id, placement.host_application_id)).limit(1);
        const studentEmail = student?.student_email || student?.guardian_email;
        if (studentEmail) out.applicant = { email: studentEmail, name: `${student!.student_first_name} ${student!.student_last_name}`.trim() };
        if (host?.email) out.host = { email: host.email, name: `${host.first_name} ${host.last_name}`.trim() };
        if (placement.agent_account_id) {
          const [agent] = await db.select().from(accountsTable)
            .where(eq(accountsTable.id, placement.agent_account_id)).limit(1);
          if (agent?.account_email) out.agent = { email: agent.account_email, name: agent.name };
        }
      }
    }
  } catch (err) {
    console.error("[applicationDocs] resolveRecipients failed:", err);
  }
  return out;
}

/**
 * Email the application PDF to the selected recipients. Best-effort — collects
 * results, never throws. Returns the list of addresses successfully sent to.
 */
export async function emailApplicationPdf(
  signing: Pick<SigningRow, "context_type">,
  pdf: Buffer,
  recipients: ResolvedRecipients,
  select: RecipientSelection,
  ref: string,
): Promise<string[]> {
  const docTypeLabel =
    signing.context_type === "host_app" ? "Host Family Application"
    : signing.context_type === "placement_contract" ? "Homestay Placement Agreement"
    : "Student Application";
  const filename = `${ref}.pdf`;
  const targets: Array<{ email: string; name?: string }> = [];
  if (select.applicant && recipients.applicant) targets.push(recipients.applicant);
  if (select.host && recipients.host) targets.push(recipients.host);
  if (select.agent && recipients.agent) targets.push(recipients.agent);
  if (select.ops && recipients.ops) targets.push({ email: recipients.ops.email });

  // De-duplicate addresses (applicant may equal ops in samples).
  const seen = new Set<string>();
  const sent: string[] = [];
  for (const t of targets) {
    const key = t.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const result = await sendDocumentEmail({
        to: t.email,
        toName: t.name ?? null,
        docTypeLabel,
        ref,
        pdf,
        filename,
        lang: "en",
        note: "A signed copy of your homestay application is attached as a PDF.",
      });
      if (result.ok) sent.push(t.email);
    } catch (err) {
      console.error(`[applicationDocs] email to ${t.email} failed:`, err);
    }
  }
  return sent;
}

/**
 * Full post-sign pipeline: render+store the signed PDF, resolve recipients, and
 * email it. Default selection: applicant + agent (if linked) + ops. Best-effort.
 */
export async function processSignedApplication(
  signing: SigningRow,
  select: RecipientSelection = { applicant: true, agent: true, ops: true, host: true },
): Promise<void> {
  const ref = await refForSigning(signing);
  const { pdf } = await generateAndStoreSignedPdf(signing);
  if (!pdf) return;
  const recipients = await resolveRecipients(signing);
  await emailApplicationPdf(signing, pdf, recipients, select, ref);
}

/** Look up the human-facing reference (HSR-.../HHA-...) for a signing request. */
export async function refForSigning(signing: Pick<SigningRow, "context_type" | "context_id">): Promise<string> {
  try {
    if (signing.context_type === "student_app") {
      const [row] = await db.select({ ref: homestayStudentRequestsTable.request_ref })
        .from(homestayStudentRequestsTable)
        .where(eq(homestayStudentRequestsTable.id, signing.context_id)).limit(1);
      if (row?.ref) return row.ref;
    } else if (signing.context_type === "host_app") {
      const [row] = await db.select({ ref: homestayHostApplicationsTable.application_ref })
        .from(homestayHostApplicationsTable)
        .where(eq(homestayHostApplicationsTable.id, signing.context_id)).limit(1);
      if (row?.ref) return row.ref;
    } else if (signing.context_type === "placement_contract") {
      const [row] = await db.select({ ref: homestayPlacementsTable.placement_ref })
        .from(homestayPlacementsTable)
        .where(eq(homestayPlacementsTable.id, signing.context_id)).limit(1);
      if (row?.ref) return row.ref;
    }
  } catch { /* fall through */ }
  return `${signing.context_type}-${signing.context_id}`;
}

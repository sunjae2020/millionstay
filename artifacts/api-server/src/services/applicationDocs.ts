// Homestay application documents — generate the signed PDF, store it privately,
// and email it to the applicant / linked agent / ops.
//
// All functions are BEST-EFFORT: they never throw to the caller (the signing
// response must not be blocked or failed by PDF/email problems). Mirrors the
// best-effort email pattern already used across the homestay routes.
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  contractSigningRequestsTable,
  homestayStudentRequestsTable,
  homestayHostApplicationsTable,
  shortTermApplicationsTable,
  homestayPlacementsTable,
  homestayPlacementServicesTable,
  serviceHostsTable,
  partnerUsersTable,
  contractsTable,
  accountsTable,
  emailLogsTable,
  integrationSettings,
} from "@workspace/db";
import { buildServiceBriefHtml } from "../lib/documents/serviceBrief.js";
import { htmlToPdf, PdfUnavailableError } from "../lib/documents/pdf.js";
import {
  buildApplicationHtml,
  studentApplicationToDoc,
  hostApplicationToDoc,
  shortTermApplicationToDoc,
  placementToDoc,
  type ApplicationDocInput,
} from "../lib/documents/applicationPdf.js";
import { buildContractHtml, type ContractSignature } from "../lib/documents/contractDocument.js";
import { resolveCompanyInfo } from "../lib/documents/companyInfo.js";
import { buildContractDocInput } from "../routes/contracts.js";
import { isCloudinaryConfigured, uploadPrivateToCloudinary } from "../utils/cloudinary.js";
import { sendDocumentEmail, sendApplicationAckEmail } from "../lib/email.js";
import { resolveTemplate } from "../lib/documents/templateEngine.js";
import { getHomestayBillingSettings } from "../lib/homestay/billingSettings.js";
import { getAckRule, type ApplicationType } from "../lib/applicationEmails.js";

type SigningRow = typeof contractSigningRequestsTable.$inferSelect;

export interface RecipientSelection {
  applicant?: boolean;
  agent?: boolean;
  ops?: boolean;
  /** Host family — only meaningful for placement_contract documents. */
  host?: boolean;
  /**
   * Assigned service host(s) — only for placement_contract. Receives a MASKED
   * service brief (service + own fee only), NOT the full signed agreement.
   */
  serviceHost?: boolean;
}

export interface ResolvedRecipients {
  applicant?: { email: string; name?: string };
  agent?: { email: string; name?: string };
  ops?: { email: string };
  host?: { email: string; name?: string };
}

/**
 * Render an ApplicationDocInput to a PDF buffer (best-effort, unsigned preview).
 * Used for the acknowledgment-email attachment. Returns null when PDF rendering
 * is unavailable (no Chromium) so the email can still be sent without it.
 */
export async function renderApplicationPdf(doc: ApplicationDocInput): Promise<Buffer | null> {
  try {
    const html = buildApplicationHtml(doc, true, await resolveCompanyInfo());
    return await htmlToPdf(html);
  } catch (err) {
    if (err instanceof PdfUnavailableError) {
      console.warn("[applicationDocs] ack PDF unavailable — sending email without attachment:", err.message);
    } else {
      console.error("[applicationDocs] renderApplicationPdf failed:", err);
    }
    return null;
  }
}

/**
 * Send the applicant-facing acknowledgment email for a Student / Landlord /
 * Short-term application, gated by the per-type application_emails settings.
 *
 *   - Returns false (and skips) when send_ack_email is OFF for the type.
 *   - When attach_pdf is ON, lazily builds + renders the application PDF (best
 *     effort — the email is still sent without it if rendering is unavailable).
 *
 * The Homestay host intake keeps its own richer, template-backed email
 * (sendHomestayHostEmail kind="received") and gates inline at its call site.
 * Best-effort: never throws.
 */
export async function sendApplicationAck(params: {
  type: Exclude<ApplicationType, "homestay_host">;
  to: string;
  toName?: string | null;
  appTypeLabel: string;
  ref: string;
  intro?: string | null;
  /** Builds the ApplicationDocInput on demand (only called when attach_pdf is ON). */
  buildDoc?: () => ApplicationDocInput | null;
}): Promise<boolean> {
  try {
    const rule = await getAckRule(params.type);
    if (!rule.send_ack_email) return false;
    let pdf: Buffer | null = null;
    if (rule.attach_pdf && params.buildDoc) {
      const doc = params.buildDoc();
      if (doc) pdf = await renderApplicationPdf(doc);
    }
    return await sendApplicationAckEmail({
      to: params.to,
      toName: params.toName ?? null,
      appTypeLabel: params.appTypeLabel,
      ref: params.ref,
      intro: params.intro ?? null,
      pdf,
    });
  } catch (err) {
    console.error("[applicationDocs] sendApplicationAck failed:", err);
    return false;
  }
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
  if (signing.context_type === "short_term_app") {
    const [row] = await db.select().from(shortTermApplicationsTable)
      .where(eq(shortTermApplicationsTable.id, signing.context_id)).limit(1);
    return row ? shortTermApplicationToDoc(row, view, opts) : null;
  }
  if (signing.context_type === "placement_contract") {
    const [placement] = await db.select().from(homestayPlacementsTable)
      .where(eq(homestayPlacementsTable.id, signing.context_id)).limit(1);
    if (!placement) return null;
    const [host] = await db.select().from(homestayHostApplicationsTable)
      .where(eq(homestayHostApplicationsTable.id, placement.host_application_id)).limit(1);
    const [student] = await db.select().from(homestayStudentRequestsTable)
      .where(eq(homestayStudentRequestsTable.id, placement.student_request_id)).limit(1);
    // Editable terms: prefer the PDF template (Templates Studio → PDF tab:
    // `pdf.homestay_placement_agreement`), fall back to the legacy contract-kind
    // template, then to STANDARD_PLACEMENT_TERMS inside placementToDoc.
    const pdfTpl = await resolveTemplate({ kind: "pdf", key: "pdf.homestay_placement_agreement", locale: "en" });
    const termsTpl = pdfTpl?.bodyHtml?.trim() ? pdfTpl : await resolveTemplate({ kind: "contract", key: "homestay_placement_terms", locale: "en" });
    // Card surcharge % + default method come from the live homestay billing
    // settings, so the agreement's fee figures match what's actually charged.
    const billing = await getHomestayBillingSettings();
    // Priced add-on services billed to the customer (airport pickup, initial
    // settlement, prepaid phone, …) — mirrors createPlacementInvoice. Only the
    // service type + price are passed; the assigned host is never surfaced.
    const placementServices = await db.select({
      service_type: homestayPlacementServicesTable.service_type,
      price: homestayPlacementServicesTable.price,
    })
      .from(homestayPlacementServicesTable)
      .where(eq(homestayPlacementServicesTable.placement_id, placement.id))
      .orderBy(homestayPlacementServicesTable.id);
    return placementToDoc(placement, host ?? null, student ?? null, view, {
      ...opts,
      termsText: termsTpl?.bodyHtml || undefined,
      cardSurchargePct: billing.surcharge_pct,
      defaultMethod: billing.default_method,
      services: placementServices,
    });
  }
  // "contract" (regular tenancy/accommodation agreement) is rendered through its
  // own builder (buildContractHtml), not the ApplicationDocInput shell — see
  // buildSignedDocumentHtml. buildDocForSigning is only used by the application
  // shell paths, so it returns null here.
  return null;
}

/** Map contract_signing_requests.signatures JSONB → ContractSignature[]. */
function toContractSignatures(raw: unknown): ContractSignature[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s: any) => ({
    role: String(s?.role ?? ""),
    name: String(s?.name ?? ""),
    email: s?.email ?? null,
    signatureImage: s?.signatureImage ?? null,
    serverSignedAt: s?.serverSignedAt ?? s?.signedAt ?? null,
    ip: s?.ip ?? null,
    consentText: s?.consent?.text ?? null,
  }));
}

/**
 * Render the document for a signing request to HTML. Homestay applications use
 * the ApplicationDocInput shell; a regular "contract" uses buildContractHtml
 * (reusing the same renderer as /v1/contracts/:id/pdf, with drawn signatures
 * embedded once signed). Returns null when the underlying record is gone.
 */
export async function buildSignedDocumentHtml(
  signing: Pick<SigningRow, "context_type" | "context_id" | "status" | "signers" | "signatures" | "signed_at">,
  opts: { signed?: boolean; forPrint?: boolean } = {},
): Promise<string | null> {
  if (signing.context_type === "contract") {
    const built = await buildContractDocInput(signing.context_id);
    if (!built) return null;
    const signed = opts.signed ?? signing.status === "signed";
    const sigs = toContractSignatures(signing.signatures);
    const doc = { ...built.doc, signed, signatures: sigs.length ? sigs : null };
    return buildContractHtml(doc, await resolveCompanyInfo(), opts.forPrint ?? true);
  }
  const doc = await buildDocForSigning(signing, { signed: opts.signed });
  return doc ? buildApplicationHtml(doc, opts.forPrint ?? true) : null;
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
    // Prefer the frozen snapshot captured at sign time (H-201) so the stored PDF
    // is byte-for-byte the signed document; only re-render if no snapshot exists.
    const snapshotHtml = (signing.signed_snapshot as { html?: string } | null)?.html;
    const html = snapshotHtml ?? (await buildSignedDocumentHtml(signing, { signed: true, forPrint: true }));
    if (!html) return { pdf: null, pdfUrl: null };

    const pdf = await htmlToPdf(html);

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
/**
 * Operations / notification recipient. Prefer process.env (env vars + values
 * loaded at startup or set live via the integrations UI), then fall back to the
 * integration_settings KV directly — so a value set in the DB takes effect
 * without waiting for a server restart.
 */
async function resolveOpsEmail(): Promise<string | undefined> {
  const KEYS = ["LEAD_NOTIFICATION_EMAIL", "LEADS_NOTIFY_EMAIL", "SUPPORT_EMAIL"] as const;
  const fromEnv = process.env[KEYS[0]] || process.env[KEYS[1]] || process.env[KEYS[2]];
  if (fromEnv) return fromEnv;
  try {
    const rows = await db.select().from(integrationSettings).where(inArray(integrationSettings.key, [...KEYS]));
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return map.get(KEYS[0]) || map.get(KEYS[1]) || map.get(KEYS[2]) || undefined;
  } catch {
    return undefined;
  }
}

export async function resolveRecipients(signing: SigningRow): Promise<ResolvedRecipients> {
  const out: ResolvedRecipients = {};
  const ops = await resolveOpsEmail();
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
    } else if (signing.context_type === "short_term_app") {
      const [row] = await db.select().from(shortTermApplicationsTable)
        .where(eq(shortTermApplicationsTable.id, signing.context_id)).limit(1);
      if (row?.email) out.applicant = { email: row.email, name: `${row.first_name} ${row.last_name}`.trim() };
    } else if (signing.context_type === "contract") {
      const [row] = await db.select().from(contractsTable)
        .where(eq(contractsTable.id, signing.context_id)).limit(1);
      if (row?.tenant_account_id) {
        const [tenant] = await db.select().from(accountsTable)
          .where(eq(accountsTable.id, row.tenant_account_id)).limit(1);
        if (tenant?.account_email) out.applicant = { email: tenant.account_email, name: tenant.name };
      }
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
/** Map a signing context to the (entity_type, template_code) used in email_log. */
function logMeta(contextType: string): { entityType: string; templateCode: string } {
  if (contextType === "host_app") return { entityType: "homestay_host_application", templateCode: "document.homestay_host_application" };
  if (contextType === "short_term_app") return { entityType: "short_term_application", templateCode: "document.short_term_application" };
  if (contextType === "placement_contract") return { entityType: "homestay_placement", templateCode: "document.homestay_placement_contract" };
  if (contextType === "contract") return { entityType: "contract", templateCode: "document.contract" };
  return { entityType: "homestay_student_request", templateCode: "document.homestay_student_application" };
}

export async function emailApplicationPdf(
  signing: Pick<SigningRow, "context_type" | "context_id">,
  pdf: Buffer,
  recipients: ResolvedRecipients,
  select: RecipientSelection,
  ref: string,
): Promise<string[]> {
  const docTypeLabel =
    signing.context_type === "host_app" ? "Host Family Application"
    : signing.context_type === "short_term_app" ? "Short-term Accommodation Application"
    : signing.context_type === "placement_contract" ? "Homestay Placement Agreement"
    : signing.context_type === "contract" ? "Accommodation Agreement"
    : "Student Application";
  const { entityType, templateCode } = logMeta(signing.context_type);
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
        note: signing.context_type === "contract"
          ? "A signed copy of your agreement is attached as a PDF."
          : "A signed copy of your homestay application is attached as a PDF.",
      });
      if (result.ok) sent.push(t.email);
      // Record the send in the per-record email history (best-effort).
      await db.insert(emailLogsTable).values({
        template_code: templateCode,
        to_email: t.email,
        to_name: t.name ?? null,
        subject: result.subject,
        resend_message_id: result.id ?? null,
        status: result.ok ? "Sent" : "Failed",
        entity_type: entityType,
        entity_id: signing.context_id,
        error_message: result.error ?? null,
      }).catch(() => {});
    } catch (err) {
      console.error(`[applicationDocs] email to ${t.email} failed:`, err);
    }
  }
  return sent;
}

/** Mask a person to given name + last initial, e.g. "Minjae K." */
function maskName(first?: string | null, last?: string | null): string {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  if (!f && !l) return "Student";
  const initial = l ? ` ${l.charAt(0).toUpperCase()}.` : "";
  return `${f}${initial}`.trim() || "Student";
}

/**
 * Build + email a MASKED service brief to each assigned service host for a
 * placement. Each host receives only the information required to perform and
 * bill THEIR service (service type, schedule, their own fee, ops instructions)
 * — never the full agreement, the guardian, or unrelated financials. The
 * student is shown by given name + last initial only. Best-effort: never throws.
 * Returns the list of addresses successfully emailed.
 */
export async function sendServiceBriefs(placementId: number, ref: string): Promise<string[]> {
  const sent: string[] = [];
  try {
    const services = await db.select().from(homestayPlacementServicesTable)
      .where(eq(homestayPlacementServicesTable.placement_id, placementId));
    if (!services.length) return sent;

    // Masked student / host labels (resolved once).
    const [placement] = await db.select().from(homestayPlacementsTable)
      .where(eq(homestayPlacementsTable.id, placementId)).limit(1);
    let studentLabel = "Student";
    let hostLabel: string | null = null;
    if (placement) {
      const [student] = await db.select().from(homestayStudentRequestsTable)
        .where(eq(homestayStudentRequestsTable.id, placement.student_request_id)).limit(1);
      if (student) studentLabel = maskName(student.student_first_name, student.student_last_name);
      const [host] = await db.select().from(homestayHostApplicationsTable)
        .where(eq(homestayHostApplicationsTable.id, placement.host_application_id)).limit(1);
      if (host) hostLabel = host.last_name ? `${host.last_name} family` : (host.first_name ?? null);
    }

    const company = await resolveCompanyInfo();
    const seen = new Set<string>();
    for (const svc of services) {
      if (svc.status === "Cancelled" || !svc.service_id) continue;
      const dedupe = `${svc.service_id}__${svc.id}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);

      // Resolve the assigned service host's email (partner login → account email).
      const [sh] = await db.select().from(serviceHostsTable).where(eq(serviceHostsTable.id, svc.service_id)).limit(1);
      if (!sh?.account_id) continue;
      const [pu] = await db.select().from(partnerUsersTable).where(and(
        eq(partnerUsersTable.account_id, sh.account_id),
        eq(partnerUsersTable.portal_type, "service_host"),
        eq(partnerUsersTable.is_active, true),
      )).limit(1);
      let email: string | null = pu?.email ?? null;
      const name = (pu ? `${pu.first_name ?? ""} ${pu.last_name ?? ""}`.trim() : "") || sh.name;
      if (!email) {
        const [acc] = await db.select().from(accountsTable).where(eq(accountsTable.id, sh.account_id)).limit(1);
        email = acc?.account_email ?? null;
      }
      if (!email) continue;

      const html = buildServiceBriefHtml({
        placement_ref: ref,
        service_type: svc.service_type,
        scheduled_at: svc.scheduled_at,
        amount: svc.price != null ? Number(svc.price) : null,
        currency: svc.currency,
        student_label: studentLabel,
        host_label: hostLabel,
        notes: svc.notes,
      }, company);
      let pdf: Buffer;
      try { pdf = await htmlToPdf(html); } catch { continue; }

      const result = await sendDocumentEmail({
        to: email, toName: name, lang: "en",
        docTypeLabel: "Service Assignment", ref: `${ref}-SVC-${svc.id}`,
        pdf, filename: `${ref}-service-${svc.id}.pdf`,
        note: "You've been assigned a service for this placement. The brief is attached. It contains only the information required to perform and bill your service — please keep the student's details confidential.",
      });
      if (result.ok) sent.push(email);
      await db.insert(emailLogsTable).values({
        template_code: "document.homestay_service_brief", to_email: email, to_name: name ?? null,
        subject: result.subject, resend_message_id: result.id ?? null, status: result.ok ? "Sent" : "Failed",
        entity_type: "homestay_placement", entity_id: placementId, error_message: result.error ?? null,
      }).catch(() => {});
    }
  } catch (err) {
    console.error("[applicationDocs] sendServiceBriefs failed:", err);
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
    } else if (signing.context_type === "short_term_app") {
      const [row] = await db.select({ ref: shortTermApplicationsTable.request_ref })
        .from(shortTermApplicationsTable)
        .where(eq(shortTermApplicationsTable.id, signing.context_id)).limit(1);
      if (row?.ref) return row.ref;
    } else if (signing.context_type === "placement_contract") {
      const [row] = await db.select({ ref: homestayPlacementsTable.placement_ref })
        .from(homestayPlacementsTable)
        .where(eq(homestayPlacementsTable.id, signing.context_id)).limit(1);
      if (row?.ref) return row.ref;
    } else if (signing.context_type === "contract") {
      const [row] = await db.select({ ref: contractsTable.contract_ref })
        .from(contractsTable)
        .where(eq(contractsTable.id, signing.context_id)).limit(1);
      if (row?.ref) return row.ref;
    }
  } catch { /* fall through */ }
  return `${signing.context_type}-${signing.context_id}`;
}

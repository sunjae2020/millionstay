// E-signature shared module — service layer.
//
// Ported from Edubee CRM's contract-signing implementation, adapted to
// MillionStay (single shared DB, the contract_signing_requests table, Cloudinary
// for any later PDF storage). Document-agnostic: a signing request points at any
// record via (context_type, context_id), so the same flow signs host
// applications, student applications, and placement contracts.
//
// See docs/proposals/HOMESTAY_WORKFLOW.md §7.
import { randomBytes } from "crypto";
import { sql } from "drizzle-orm";
import { db, contractSigningRequestsTable } from "@workspace/db";

export type SigningContextType = "host_app" | "student_app" | "placement_contract" | "contract";

export interface SignerSpec {
  role: string;
  name: string;
  email: string;
  required: boolean;
}

// Terms-and-conditions consent statement recorded with each signature. Explicit
// consent is what makes an electronic signature valid.
export const DEFAULT_CONSENT_TEXT =
  "I confirm that I have read and understood the terms and conditions of this " +
  "agreement, that I am the person named as the signer, and I consent to signing " +
  "this document electronically.";

// Base URL of the web app that hosts the public signing page (/sign/:token).
export function signingBaseUrl(): string {
  return (process.env.SIGNING_BASE_URL || process.env.WEB_BASE_URL || "https://millionstay.com").replace(/\/+$/, "");
}

// Resolve the signer's client IP. `trust proxy` is 1 in app.ts so req.ip already
// reflects the real client; X-Forwarded-For is a defensive fallback.
export function clientIp(req: any): string {
  const xff = (req.headers?.["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  return String(req.ip || xff || req.socket?.remoteAddress || "").replace(/^::ffff:/, "");
}

// Append an event to a request's append-only audit_trail (atomic jsonb concat,
// so concurrent viewers don't clobber each other). Never throws — the signing
// flow must not break on an audit write.
export async function appendAuditEvent(id: number, event: Record<string, unknown>): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE contract_signing_requests
      SET audit_trail = COALESCE(audit_trail, '[]'::jsonb) || ${JSON.stringify([event])}::jsonb
      WHERE id = ${id}
    `);
  } catch (err) {
    console.warn("[ContractSign] audit_trail append skipped:", (err as Error)?.message);
  }
}

export interface CreateSigningRequestInput {
  contextType: SigningContextType;
  contextId: number;
  signers: SignerSpec[];
  expiryDays?: number;
}

// Create a signing request and return its token + public signing URL. Called by
// the flows that need a signature (host application, student application,
// placement contract).
export async function createSigningRequest(
  input: CreateSigningRequestInput,
): Promise<{ id: number; token: string; signingUrl: string; expiresAt: Date }> {
  const { contextType, contextId, signers, expiryDays = 14 } = input;
  if (!signers || signers.length === 0) throw new Error("At least one signer is required");

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  const [row] = await db
    .insert(contractSigningRequestsTable)
    .values({
      token,
      context_type: contextType,
      context_id: contextId,
      status: "pending",
      expires_at: expiresAt,
      signers,
      signatures: [],
    })
    .returning();

  return { id: row.id, token, signingUrl: `${signingBaseUrl()}/sign/${token}`, expiresAt };
}

import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// CONTRACT SIGNING REQUESTS — online e-signature, ported from Edubee CRM's
// proven model (see HOMESTAY_WORKFLOW.md §7). A token-addressed public signing
// link lets signers (student/guardian/host) draw a signature; server-side
// legal metadata (serverSignedAt, ip, userAgent, consent) is authoritative.
//
// Generic via (context_type, context_id) so the same flow signs host
// applications, student applications, and placement contracts. Signed PDFs are
// stored on Cloudinary (Edubee used local disk).
export const contractSigningRequestsTable = pgTable("contract_signing_requests", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),          // public signing-link token
  context_type: text("context_type").notNull(),     // host_app | student_app | placement_contract
  context_id: integer("context_id").notNull(),      // id of the related record
  status: text("status").notNull().default("pending"), // pending | signed | expired | cancelled
  expires_at: timestamp("expires_at", { withTimezone: true }),

  // signers: [{ role, name, email, required }]
  signers: jsonb("signers").notNull().default([]),
  // signatures: [{ role, name, email, signatureImage, signedAt, serverSignedAt,
  //   ip, userAgent, consent: { accepted, text, acceptedAt } }]
  signatures: jsonb("signatures").notNull().default([]),

  pdf_url: text("pdf_url"),                          // Cloudinary URL of signed PDF
  pdf_generated_at: timestamp("pdf_generated_at", { withTimezone: true }),
  // Tamper-evidence (H-201): the exact document rendered at sign time is frozen
  // here so /preview and /pdf serve the signed content verbatim instead of
  // re-rendering live (which would silently reflect later edits). content_hash is
  // the sha256 of signed_snapshot.html.
  content_hash: text("content_hash"),
  signed_snapshot: jsonb("signed_snapshot"),         // { html, capturedAt }
  // audit_trail: append-only [{ event, at, ip, userAgent, ... }]
  audit_trail: jsonb("audit_trail").notNull().default([]),
  signed_at: timestamp("signed_at", { withTimezone: true }),

  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertContractSigningRequestSchema = createInsertSchema(contractSigningRequestsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertContractSigningRequest = z.infer<typeof insertContractSigningRequestSchema>;
export type ContractSigningRequest = typeof contractSigningRequestsTable.$inferSelect;

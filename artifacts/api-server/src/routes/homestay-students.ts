// Homestay STUDENT application — public intake (Phase 3).
//
// A student (or guardian, for under-18s) submits an application. We create a
// homestay_student_requests row, then a signing request (Phase 2 e-signature)
// for the student (+ guardian if minor) to e-sign the application / T&C. The
// applicant is redirected to /sign/:token to complete the signature. Matching
// is admin-brokered (Phase 5), so no portal login is created here.
import { Router, type IRouter } from "express";
import { db, homestayStudentRequestsTable } from "@workspace/db";
import { generateStudentRef } from "../lib/homestayRef.js";
import { createSigningRequest, type SignerSpec } from "../services/contractSigning.js";
import { sendLeadNotificationEmail } from "../lib/email.js";

export const homestayStudentPublicRouter: IRouter = Router();

// Whole years between a YYYY-MM-DD date of birth and today. Returns null if the
// date is unparseable.
function ageFromDob(dob: string): number | null {
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

homestayStudentPublicRouter.post("/v1/public/homestay-student-requests", async (req, res): Promise<void> => {
  try {
    const body = req.body as Record<string, any>;
    const student_first_name = String(body.student_first_name ?? "").trim();
    const student_last_name = String(body.student_last_name ?? "").trim();
    const date_of_birth = String(body.date_of_birth ?? "").trim();

    if (!student_first_name || !student_last_name || !date_of_birth) {
      res.status(400).json({ success: false, error: "student_first_name, student_last_name and date_of_birth are required" });
      return;
    }

    // Age is computed server-side (authoritative) — never trust the client flag.
    const age = ageFromDob(date_of_birth);
    if (age == null || age < 0 || age > 120) {
      res.status(400).json({ success: false, error: "A valid date of birth is required" });
      return;
    }
    const is_minor = age < 18;

    const guardian_name = String(body.guardian_name ?? "").trim();
    const guardian_email = String(body.guardian_email ?? "").trim().toLowerCase();
    if (is_minor && (!guardian_name || !guardian_email)) {
      res.status(400).json({ success: false, error: "Students under 18 must provide a guardian name and email" });
      return;
    }

    if (!body.terms_accepted) {
      res.status(400).json({ success: false, error: "You must accept the Terms & Conditions" });
      return;
    }

    const student_email = String(body.student_email ?? "").trim().toLowerCase() || null;
    const now = new Date();

    const request_ref = await generateStudentRef();
    const [row] = await db.insert(homestayStudentRequestsTable).values({
      request_ref,
      status: "Submitted",
      submitted_by: "student",
      student_first_name,
      student_last_name,
      student_email,
      student_phone: body.student_phone ?? null,
      date_of_birth,
      is_minor,
      gender: body.gender ?? null,
      nationality: body.nationality ?? null,
      guardian_name: is_minor ? guardian_name : (guardian_name || null),
      guardian_email: is_minor ? guardian_email : (guardian_email || null),
      guardian_phone: body.guardian_phone ?? null,
      guardian_relationship: body.guardian_relationship ?? null,
      guardian_consent_at: is_minor ? now : null,
      preferences: body.preferences && typeof body.preferences === "object" ? body.preferences : {},
      terms_accepted: true,
      terms_accepted_at: now,
    }).returning();

    // Signers: the student, plus the guardian for under-18s. The signer email
    // falls back to the guardian's when the student has none.
    const studentName = `${student_first_name} ${student_last_name}`.trim();
    const signers: SignerSpec[] = [
      { role: "student", name: studentName, email: student_email ?? guardian_email ?? "", required: true },
    ];
    if (is_minor) {
      signers.push({ role: "guardian", name: guardian_name, email: guardian_email, required: true });
    }
    const signing = await createSigningRequest({ contextType: "student_app", contextId: row!.id, signers });

    // Ops notification — best-effort, never blocks the response.
    const adminTo = process.env.LEAD_NOTIFICATION_EMAIL;
    if (adminTo) {
      void sendLeadNotificationEmail({
        leadRef: request_ref,
        inquiryType: "Homestay Student Application",
        firstName: student_first_name,
        lastName: student_last_name,
        email: student_email ?? guardian_email ?? "",
        phone: body.student_phone ?? null,
        message: `New homestay student application (${request_ref})${is_minor ? " — minor, guardian signature required" : ""}`,
        description: null,
      }).catch((e) => console.error("[homestay-student] admin notify failed:", e));
    }

    res.status(201).json({
      success: true,
      request_ref,
      is_minor,
      signing_token: signing.token,
    });
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ success: false, error: "Duplicate entry" }); return; }
    console.error("[homestay-student] submit failed:", err);
    res.status(500).json({ success: false, error: "Failed to submit application" });
  }
});

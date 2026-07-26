/**
 * Document Hub — Homestay application document builder.
 *
 * Renders a Student Application or a Host Family Application as a branded PDF/HTML
 * using the shared document shell (theme.ts), so colour/typography stay consistent
 * with invoices/receipts/contracts. The same builder produces:
 *   - the submit-time PREVIEW (signed:false → "Pending signature"), and
 *   - the signed PDF (signed:true → embedded signature images + audit metadata).
 *
 * One body builder + two thin mappers keep the field→row mapping in a single place.
 */
import { renderDocumentShell, escapeHtml, getCompanyInfo, formatDocMoney, type CompanyInfo } from "./theme";
import { serviceLabel } from "./i18n";
import type { HomestayStudentRequest, HomestayHostApplication, HomestayPlacement, ShortTermApplication } from "@workspace/db";

/* ─────────────────────────────────────────────────────────────────────────────
   Input shapes
   ───────────────────────────────────────────────────────────────────────────── */

export interface SignatureMeta {
  role: string;
  name: string;
  email?: string;
  /** PNG data URL captured by SignaturePad. Present only once signed. */
  signatureImage?: string;
  /** Authoritative server-side signing time. */
  serverSignedAt?: string | Date | null;
  ip?: string;
  consentText?: string;
  required?: boolean;
}

export interface ApplicationDocRow {
  label: string;
  value: string;
}

export interface ApplicationDocSection {
  heading: string;
  rows: ApplicationDocRow[];
}

export interface ApplicationDocInput {
  /** Document type label, e.g. "Student Application". */
  docType: string;
  /** Reference, e.g. "HSR-2026-00001". */
  ref: string;
  status: string;
  submittedAt?: string | Date | null;
  sections: ApplicationDocSection[];
  /** Long-form blocks (intro, dietary notes, etc.) rendered with preserved breaks. */
  freeText?: Array<{ heading: string; body: string }>;
  /** Signers — drawn signatures when signed, pending placeholders otherwise. */
  signatures: SignatureMeta[];
  signed: boolean;
}

/** Minimal view of a contract_signing_requests row this builder consumes. */
export interface SigningView {
  status?: string | null;
  signers?: unknown;
  signatures?: unknown;
  signed_at?: string | Date | null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Formatting helpers
   ───────────────────────────────────────────────────────────────────────────── */

function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return escapeHtml(String(value));
  return d.toLocaleDateString("en-AU", { year: "numeric", month: "short", day: "numeric" });
}

function fmtDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return escapeHtml(String(value));
  return d.toLocaleString("en-AU", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function yesNo(v: unknown): string {
  if (v === true || v === "yes" || v === "Yes") return "Yes";
  if (v === false || v === "no" || v === "No") return "No";
  return val(v);
}

/** Coerce any scalar to a display string, falling back to an em-dash. */
function val(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") return v.trim() ? v.trim() : "—";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.length ? v.map((x) => val(x)).join(", ") : "—";
  return "—";
}

/** Build a section only from rows that have a meaningful value (drops em-dashes). */
function section(heading: string, rows: Array<[string, unknown] | null>): ApplicationDocSection | null {
  const kept: ApplicationDocRow[] = [];
  for (const r of rows) {
    if (!r) continue;
    const [label, raw] = r;
    const display = typeof raw === "string" ? raw : val(raw);
    if (display && display !== "—") kept.push({ label, value: display });
  }
  return kept.length ? { heading, rows: kept } : null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Body / HTML
   ───────────────────────────────────────────────────────────────────────────── */

function renderSignatureBlock(input: ApplicationDocInput): string {
  if (!input.signatures.length) return "";
  const cards = input.signatures.map((s) => {
    const roleLabel = escapeHtml(s.role.charAt(0).toUpperCase() + s.role.slice(1));
    const sigArea = input.signed && s.signatureImage
      ? `<img src="${s.signatureImage}" alt="Signature of ${escapeHtml(s.name)}" style="max-height:64px;max-width:100%;display:block;" />`
      : `<div style="border-bottom:1px solid #999;height:48px;"></div>
         <div style="font-size:11px;color:#bbb;margin-top:4px;">Pending signature</div>`;
    const meta = input.signed && s.signatureImage
      ? `<div style="font-size:11px;color:#777;margin-top:8px;line-height:1.6;">
           <strong style="color:#555;">${escapeHtml(s.name)}</strong> · ${roleLabel}<br/>
           ${s.email ? `${escapeHtml(s.email)}<br/>` : ""}
           Signed ${fmtDateTime(s.serverSignedAt)}${s.ip ? ` · IP ${escapeHtml(s.ip)}` : ""}<br/>
           <span style="color:#999;">${escapeHtml(s.consentText ?? "Consent recorded electronically.")}</span>
         </div>`
      : `<div style="font-size:11px;color:#777;margin-top:8px;">
           <strong style="color:#555;">${escapeHtml(s.name)}</strong> · ${roleLabel}
         </div>`;
    return `<div style="flex:1 1 240px;min-width:220px;padding:14px;border:1px solid #f0f0f0;border-radius:10px;">
      ${sigArea}${meta}
    </div>`;
  });
  return `<div class="section" style="margin-top:32px;">
    <h3>Signatures</h3>
    <div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:12px;">${cards.join("")}</div>
  </div>`;
}

export function buildApplicationBody(input: ApplicationDocInput): string {
  const sectionsHtml = input.sections.map((sec) => {
    const rows = sec.rows.map((r) =>
      `<div class="row"><span class="label">${escapeHtml(r.label)}</span><span class="value">${escapeHtml(r.value)}</span></div>`,
    ).join("");
    return `<div class="section"><h3>${escapeHtml(sec.heading)}</h3>${rows}</div>`;
  }).join("");

  const freeTextHtml = (input.freeText ?? [])
    .filter((b) => b.body && b.body.trim())
    .map((b) =>
      `<div class="section"><h3>${escapeHtml(b.heading)}</h3>
        <p style="margin:0;font-size:13px;color:#333;white-space:pre-wrap;">${escapeHtml(b.body.trim())}</p>
      </div>`,
    ).join("");

  const statusBadge = input.signed ? "Signed" : (input.status || "Submitted");
  const badgeColor = input.signed ? "#0a7d57" : "#E8621A";

  return `
    <div class="section" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
      <div>
        <h3>${escapeHtml(input.docType)}</h3>
        <div class="ref-chip" style="font-size:20px;">${escapeHtml(input.ref)}</div>
        <div style="font-size:13px;color:#777;margin-top:4px;">Submitted ${fmtDate(input.submittedAt)}</div>
      </div>
      <span class="badge" style="background:#FFF7F0;color:${badgeColor};">${escapeHtml(statusBadge)}</span>
    </div>
    ${sectionsHtml}
    ${freeTextHtml}
    ${renderSignatureBlock(input)}
  `;
}

export function buildApplicationHtml(input: ApplicationDocInput, forPrint = true, company?: CompanyInfo): string {
  return renderDocumentShell({
    docType: input.docType,
    bodyHtml: buildApplicationBody(input),
    company: company ?? getCompanyInfo(),
    forPrint,
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   Signature resolution (shared by both mappers)
   ───────────────────────────────────────────────────────────────────────────── */

function resolveSignatures(signing: SigningView | undefined, signed: boolean): SignatureMeta[] {
  if (signed && signing && Array.isArray(signing.signatures) && signing.signatures.length) {
    return (signing.signatures as any[]).map((s) => ({
      role: String(s.role ?? "signer"),
      name: String(s.name ?? ""),
      email: s.email ? String(s.email) : undefined,
      signatureImage: s.signatureImage ? String(s.signatureImage) : undefined,
      serverSignedAt: s.serverSignedAt ?? s.signedAt ?? null,
      ip: s.ip ? String(s.ip) : undefined,
      consentText: s.consent?.text ? String(s.consent.text) : undefined,
    }));
  }
  // Pending — synthesise placeholders from the request's signers.
  if (signing && Array.isArray(signing.signers)) {
    return (signing.signers as any[]).map((s) => ({
      role: String(s.role ?? "signer"),
      name: String(s.name ?? ""),
      email: s.email ? String(s.email) : undefined,
      required: !!s.required,
    }));
  }
  return [];
}

/* ─────────────────────────────────────────────────────────────────────────────
   Mappers
   ───────────────────────────────────────────────────────────────────────────── */

export function studentApplicationToDoc(
  row: HomestayStudentRequest,
  signing?: SigningView,
  opts: { signed?: boolean } = {},
): ApplicationDocInput {
  const signed = opts.signed ?? (signing?.status === "signed");
  const p = (row.preferences ?? {}) as Record<string, any>;
  const ec = (p.emergency_contact ?? {}) as Record<string, any>;
  const addons = (p.addons ?? {}) as Record<string, any>;

  const sections: ApplicationDocSection[] = [];
  const push = (s: ApplicationDocSection | null) => { if (s) sections.push(s); };

  push(section("Student", [
    ["Name", `${row.student_first_name} ${row.student_last_name}`.trim()],
    ["Date of birth", fmtDate(row.date_of_birth)],
    ["Minor (under 18)", row.is_minor ? "Yes" : "No"],
    ["Gender", val(row.gender)],
    ["Nationality", val(row.nationality)],
    ["Email", val(row.student_email)],
    ["Phone", val(row.student_phone)],
    ["Native language", val(p.native_language)],
    ["English level", val(p.english_level)],
    ["Relationship with host", val(p.relationship_with_host)],
  ]));

  if (row.is_minor || row.guardian_name) {
    push(section("Guardian", [
      ["Name", val(row.guardian_name)],
      ["Email", val(row.guardian_email)],
      ["Phone", val(row.guardian_phone)],
      ["Relationship", val(row.guardian_relationship)],
    ]));
  }

  push(section("School", [
    ["School", val(p.school)],
    ["Course", val(p.course_name)],
    ["Course start date", val(p.course_start_date)],
    ["Campus location", val(p.campus_location)],
  ]));

  push(section("Homestay preferences", [
    ["Start date", val(p.homestay_start_date)],
    ["Duration (weeks)", val(p.duration_weeks)],
    ["Room type", val(p.room_type)],
    ["Meals", val(p.meals)],
    ["Allergic to pets", yesNo(p.allergic_to_pets)],
    ["Can live with pets", yesNo(p.can_live_with_pets)],
    ["Smoker", yesNo(p.smoker)],
    ["Can live with smokers", yesNo(p.can_live_with_smokers)],
    ["Can live with other students", yesNo(p.can_live_with_students)],
    ["Can live with children", yesNo(p.can_live_with_children)],
  ]));

  push(section("Airport pickup", [
    ["Option", val(p.airport_pickup_option)],
    ["Arrival date", val(p.arrival_date)],
    ["Arrival time", val(p.arrival_time)],
    ["Flight no.", val(p.flight_no)],
  ]));

  push(section("Emergency contact", [
    ["Name", val(ec.name)],
    ["Relationship", val(ec.relationship)],
    ["Contact no.", val(ec.contact_no)],
    ["Email", val(ec.email)],
  ]));

  const addonList = [
    addons.guardian_service ? "Guardian service" : null,
    addons.settlement_support ? "Settlement support" : null,
    addons.airport_pickup ? "Airport pickup" : null,
  ].filter(Boolean);
  push(section("Arrival support add-ons", [
    ["Selected", addonList.length ? addonList.join(", ") : "—"],
  ]));

  const freeText = [
    { heading: "Self introduction", body: String(p.self_introduction ?? "") },
    { heading: "Beliefs", body: String(p.beliefs ?? "") },
    { heading: "Dietary", body: String(p.dietary ?? "") },
    { heading: "Food avoided", body: String(p.food_avoided ?? "") },
    { heading: "Hobbies", body: String(p.hobbies ?? "") },
    { heading: "Other requirements", body: String(p.other_requirements ?? "") },
    { heading: "Additional comment", body: String(p.additional_comment ?? "") },
  ];

  return {
    docType: "Student Application",
    ref: row.request_ref,
    status: row.status,
    submittedAt: row.created_at,
    sections,
    freeText,
    signatures: resolveSignatures(signing, signed),
    signed,
  };
}

export function hostApplicationToDoc(
  row: HomestayHostApplication,
  signing?: SigningView,
  opts: { signed?: boolean } = {},
): ApplicationDocInput {
  const signed = opts.signed ?? (signing?.status === "signed");
  const ec = (row.emergency_contact ?? {}) as Record<string, any>;
  const extra = (row.extra_contact ?? {}) as Record<string, any>;
  const ref = (row.host_referral ?? {}) as Record<string, any>;
  const residents = Array.isArray(row.residents) ? (row.residents as any[]) : [];
  const rooms = Array.isArray(row.rooms) ? (row.rooms as any[]) : [];

  const sections: ApplicationDocSection[] = [];
  const push = (s: ApplicationDocSection | null) => { if (s) sections.push(s); };

  push(section("Host family", [
    ["Name", `${row.first_name} ${row.last_name}`.trim()],
    ["Email", val(row.email)],
    ["Phone", val(row.phone)],
    ["Date of birth", fmtDate(row.date_of_birth)],
    ["Gender", val(row.gender)],
    ["Nationality", val(row.nationality)],
    ["Cultural background", val(row.cultural_background)],
    ["Address", val(row.address)],
    ["Suburb", val(row.suburb)],
    ["Heard about us", val(row.heard_about)],
  ]));

  push(section("Household", [
    ["Smoking in home", yesNo(row.smoking_in_home)],
    ["Smoking outside allowed", yesNo(row.smoke_outside_allowed)],
    ["Drinking in home", yesNo(row.drink_in_home)],
    ["Guest drinking allowed", yesNo(row.guest_drink_allowed)],
    ["Has pets", yesNo(row.has_pets)],
    ["Pet types", val(row.pet_types)],
    ["Pet notes", val(row.pet_notes)],
    ...residents.map((r, i) => [
      `Resident ${i + 1}`,
      `${val(r.name)} · age ${val(r.age)} · ${val(r.gender)} · ${val(r.relationship)}`,
    ] as [string, string]),
  ]));

  push(section("Home & rooms", [
    ["Building type", val(row.building_type)],
    ["Home features", val(row.home_features)],
    ...rooms.map((r, i) => [
      `Room ${i + 1}${r.name ? ` (${val(r.name)})` : ""}`,
      `${val(r.bed_type)} bed · ${val(r.bath_type)} bath · lock: ${yesNo(r.has_lock)}${r.comments ? ` · ${val(r.comments)}` : ""}`,
    ] as [string, string]),
  ]));

  push(section("Student preferences & packages", [
    ["Preferred student gender", val(row.pref_student_gender)],
    ["Preferred student age", val(row.pref_student_age)],
    ["Resident under 18 in home", yesNo(row.host_under_18)],
    ["Packages offered", val(row.packages_offered)],
    ["Dietary accommodations", val(row.dietary)],
    ["Dietary notes", val(row.dietary_notes)],
  ]));

  push(section("Emergency contact", [
    ["Name", val(ec.name)],
    ["Relationship", val(ec.relationship)],
    ["Phone", val(ec.phone)],
    ["Email", val(ec.email)],
  ]));

  push(section("Additional contact & referral", [
    ["Extra contact email", val(extra.email)],
    ["Extra contact phone", val(extra.phone)],
    ["Extra contact relationship", val(extra.relationship)],
    ["Referral — heard about", val(ref.heard_about)],
    ["Referred by host", yesNo(ref.referred_by_host)],
    ["Referrer name", val(ref.referrer_name)],
  ]));

  const freeText = [
    { heading: "Welcome message", body: String(row.welcome_message ?? "") },
    { heading: "Profile description", body: String(row.profile_description ?? "") },
  ];

  return {
    docType: "Host Family Application",
    ref: row.application_ref,
    status: row.status,
    submittedAt: row.created_at,
    sections,
    freeText,
    signatures: resolveSignatures(signing, signed),
    signed,
  };
}

export function shortTermApplicationToDoc(
  row: ShortTermApplication,
  signing?: SigningView,
  opts: { signed?: boolean } = {},
): ApplicationDocInput {
  const signed = opts.signed ?? (signing?.status === "signed");
  const p = (row.preferences ?? {}) as Record<string, any>;

  const sections: ApplicationDocSection[] = [];
  const push = (s: ApplicationDocSection | null) => { if (s) sections.push(s); };

  push(section("Applicant", [
    ["Name", `${row.first_name} ${row.last_name}`.trim()],
    ["Email", val(row.email)],
    ["Phone", val(row.phone)],
    ["Nationality", val(row.nationality)],
  ]));

  push(section("Stay details", [
    ["Check-in", fmtDate(row.check_in)],
    ["Check-out", fmtDate(row.check_out)],
    ["Guests", val(row.guests)],
    ["Preferred area", val(row.preferred_area)],
    ["Property type", val(row.property_type)],
    ["Weekly budget", val(p.budget_weekly)],
    ["Move-in flexible", yesNo(p.move_in_flexible)],
  ]));

  const freeText = [
    { heading: "Notes", body: String(p.notes ?? "") },
  ];

  return {
    docType: "Short-term Accommodation Application",
    ref: row.request_ref,
    status: row.status,
    submittedAt: row.created_at,
    sections,
    freeText,
    signatures: resolveSignatures(signing, signed),
    signed,
  };
}

/** Standard Homestay Placement Agreement terms (English). Edit in one place. */
export const STANDARD_PLACEMENT_TERMS =
  "This Homestay Placement Agreement is made between MillionStay, the host family, and the " +
  "student (and their guardian, where the student is under 18).\n\n" +
  "1. Placement. The host family agrees to provide accommodation and the agreed meal plan to the " +
  "student for the term shown above. The student agrees to respect the host family's home and house rules.\n\n" +
  "2. Fees. The placement fee, deposit and ongoing accommodation fee shown above are payable in advance " +
  "as invoiced. The deposit is refundable at the end of the placement subject to no outstanding amounts or damage.\n\n" +
  "3. Meals & facilities. Meals are provided per the selected package. The student has use of the agreed " +
  "room and shared facilities.\n\n" +
  "4. Conduct & safety. The student will follow reasonable house rules. Where the student is a minor, the " +
  "host family confirms all adult household members hold a valid Working with Children Check.\n\n" +
  "5. Changes & cancellation. Either party may request changes through MillionStay. Cancellation before " +
  "move-in: the placement fee is non-refundable; the deposit is refunded. After move-in, at least two (2) " +
  "weeks' written notice is required; fees are pro-rated to the move-out date.\n\n" +
  "6. Privacy. Personal information is handled in line with MillionStay's Privacy Policy and the Australian " +
  "Privacy Principles.\n\n" +
  "By signing below, each party confirms they have read, understood and agree to these terms.";

export function placementToDoc(
  placement: HomestayPlacement,
  host: HomestayHostApplication | null,
  student: HomestayStudentRequest | null,
  signing?: SigningView,
  opts: {
    signed?: boolean;
    termsText?: string;
    /** Card processing surcharge % (homestay billing settings; default 2). */
    cardSurchargePct?: number;
    /** Default payment method when the placement has none set (default card). */
    defaultMethod?: "card" | "bank_transfer";
    /** Priced add-on services billed to the customer (airport pickup,
     *  initial settlement, prepaid phone, …). Host assignment is NOT included. */
    services?: Array<{ service_type: string; price: string | number | null }>;
  } = {},
): ApplicationDocInput {
  const signed = opts.signed ?? (signing?.status === "signed");
  const money = (n: unknown) => formatDocMoney(n as number, placement.currency);
  const studentName = student ? `${student.student_first_name} ${student.student_last_name}`.trim() : "—";
  const hostName = host ? `${host.first_name} ${host.last_name}`.trim() : "—";

  // Summarise a jsonb list (array of strings or {name|label|type} objects).
  const listSummary = (v: unknown): string =>
    Array.isArray(v)
      ? v.map((x) => (typeof x === "string" ? x : (x?.name ?? x?.label ?? x?.type ?? ""))).filter(Boolean).join(", ")
      : "";
  const residentCount = Array.isArray(host?.residents) ? (host!.residents as unknown[]).length : 0;
  const petSummary = host?.has_pets ? `Yes${host?.pet_types ? ` — ${host.pet_types}` : ""}` : (host ? "No" : "—");
  const dietarySummary = [listSummary(host?.dietary), host?.dietary_notes].filter(Boolean).join(" · ");

  const sections: ApplicationDocSection[] = [];
  const push = (s: ApplicationDocSection | null) => { if (s) sections.push(s); };

  // ── 1) Student (customer) ──────────────────────────────────────────────────
  push(section("Student (Customer)", [
    ["Name", studentName],
    ["Email", val(student?.student_email)],
    ["Phone", val(student?.student_phone)],
    ["Date of birth", val(student?.date_of_birth)],
    ["Gender", val(student?.gender)],
    ["Nationality", val(student?.nationality)],
    ["Minor", student ? yesNo(student.is_minor) : "—"],
    student?.is_minor ? ["Guardian", val(student?.guardian_name)] : null,
    student?.is_minor ? ["Guardian relationship", val(student?.guardian_relationship)] : null,
    student?.is_minor ? ["Guardian email", val(student?.guardian_email)] : null,
    student?.is_minor ? ["Guardian phone", val(student?.guardian_phone)] : null,
  ]));

  // ── 2) Host family ───────────────────────────────────────────────────────
  push(section("Host Family", [
    ["Host", hostName],
    ["Email", val(host?.email)],
    ["Phone", val(host?.phone)],
    ["Address", val(host?.address)],
    ["Suburb", val(host?.suburb)],
    ["Home type", val(host?.building_type)],
    ["Cultural background", val(host?.cultural_background)],
    residentCount ? ["Household", `${residentCount} resident${residentCount > 1 ? "s" : ""}`] : null,
    ["Pets", petSummary],
    host ? ["Smoking in home", yesNo(host.smoking_in_home)] : null,
    host ? ["Alcohol in home", yesNo(host.drink_in_home)] : null,
  ]));

  // ── 3) Homestay (placement arrangement) ─────────────────────────────────────
  push(section("Homestay", [
    ["Provider", "MillionStay Pty Ltd"],
    ["Move-in date", val(placement.move_in_date)],
    ["Move-out date", val(placement.move_out_date)],
    placement.billing_cycle_weeks ? ["Billing cycle", `${placement.billing_cycle_weeks} week${placement.billing_cycle_weeks > 1 ? "s" : ""}`] : null,
    ["Meal packages", listSummary(host?.packages_offered)],
    ["Dietary catered", dietarySummary],
    ["Room features", listSummary(host?.home_features)],
  ]));

  // ── 4) Fees — split into the initial (pay-now) amount and the ongoing
  //    monthly amount/date. Mirrors the billing model: the initial invoice bills
  //    placement fee + deposit + first month; monthly_fee then recurs per cycle.
  const placementFee = Number(placement.placement_fee ?? 0);
  const depositAmt = Number(placement.deposit ?? 0);
  const monthlyAmt = Number(placement.monthly_fee ?? 0);
  const recurs = monthlyAmt > 0;
  const monthlyDate = placement.next_billing_date || placement.move_in_date;
  const cycleLabel = placement.billing_cycle_weeks
    ? `Every ${placement.billing_cycle_weeks} week${placement.billing_cycle_weeks > 1 ? "s" : ""}`
    : "Monthly";

  // Card payments incur a processing surcharge (homestay billing settings,
  // default 2%); bank transfer does not. Mirrors POST /homestay-placements/:id/charge.
  const surchargePct = opts.cardSurchargePct ?? 2;
  const method = placement.billing_method || opts.defaultMethod || "card";
  const isCard = method === "card";
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // Priced add-on services (airport pickup, initial settlement, prepaid phone…)
  // are billed up-front alongside the placement fee — mirrors createPlacementInvoice,
  // which adds them as invoice line items. Only the service + price is shown;
  // the assigned service host is intentionally never surfaced here.
  const servicesList = (opts.services ?? [])
    .map((s) => ({ label: serviceLabel("en", s.service_type), amount: Number(s.price ?? 0) }))
    .filter((s) => s.amount > 0);
  const servicesTotal = round2(servicesList.reduce((sum, s) => sum + s.amount, 0));

  const initialBase = round2(placementFee + depositAmt + monthlyAmt + servicesTotal);
  const initialSurcharge = isCard ? round2(initialBase * surchargePct / 100) : 0;
  const initialTotal = round2(initialBase + initialSurcharge);
  const monthlySurcharge = isCard ? round2(monthlyAmt * surchargePct / 100) : 0;
  const monthlyTotal = round2(monthlyAmt + monthlySurcharge);
  const showSubtotal = isCard && initialSurcharge > 0;

  push(section("Fees — initial payment (due now)", [
    placementFee > 0 ? ["· Placement fee", money(placementFee)] : null,
    depositAmt > 0 ? ["· Security deposit", money(depositAmt)] : null,
    monthlyAmt > 0 ? ["· First month accommodation", money(monthlyAmt)] : null,
    ...servicesList.map((s) => [`· ${s.label}`, money(s.amount)] as [string, string]),
    showSubtotal ? ["Subtotal", money(initialBase)] : null,
    showSubtotal ? [`Card surcharge (${surchargePct}%)`, money(initialSurcharge)] : null,
    initialTotal > 0 ? ["Total due now", money(initialTotal)] : null,
    ["Currency", val(placement.currency)],
    ["Payment method", isCard ? `Card (${surchargePct}% surcharge)` : "Bank transfer"],
  ]));

  // Only shown when there is a recurring monthly fee.
  if (recurs) {
    push(section("Fees — ongoing (monthly)", [
      ["Monthly accommodation fee", money(monthlyAmt)],
      (isCard && monthlySurcharge > 0) ? [`Card surcharge (${surchargePct}%)`, money(monthlySurcharge)] : null,
      (isCard && monthlySurcharge > 0) ? ["Monthly total", money(monthlyTotal)] : null,
      ["Billing cycle", cycleLabel],
      monthlyDate ? ["Next payment date", fmtDate(monthlyDate)] : null,
    ]));
  }

  return {
    docType: "Homestay Placement Agreement",
    ref: placement.placement_ref,
    status: placement.status,
    submittedAt: placement.created_at,
    sections,
    freeText: [{ heading: "Agreement terms", body: opts.termsText ?? STANDARD_PLACEMENT_TERMS }],
    signatures: resolveSignatures(signing, signed),
    signed,
  };
}

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
import { serviceLabel, statusLabel, formatDocDate, formatDocDateTime, normalizeLang, type DocLang } from "./i18n";
import { al, roleLabel, yesNoLabel } from "./applicationLabels";
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
  /** Language the labels were rendered in; defaults to the tenant default. */
  lang?: DocLang;
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

function fmtDate(value: string | Date | null | undefined, lang: DocLang = "en"): string {
  return formatDocDate(value, lang);
}

function fmtDateTime(value: string | Date | null | undefined, lang: DocLang = "en"): string {
  return formatDocDateTime(value, lang);
}

function yesNo(v: unknown, lang: DocLang = "en"): string {
  return yesNoLabel(lang, v, val(v));
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
  const lang = input.lang ?? "en";
  const cards = input.signatures.map((s) => {
    const role = escapeHtml(roleLabel(lang, s.role));
    const sigArea = input.signed && s.signatureImage
      ? `<img src="${s.signatureImage}" alt="Signature of ${escapeHtml(s.name)}" style="max-height:64px;max-width:100%;display:block;" />`
      : `<div style="border-bottom:1px solid #999;height:48px;"></div>
         <div style="font-size:11px;color:#bbb;margin-top:4px;">${escapeHtml(al(lang, "Pending signature"))}</div>`;
    const meta = input.signed && s.signatureImage
      ? `<div style="font-size:11px;color:#777;margin-top:8px;line-height:1.6;">
           <strong style="color:#555;">${escapeHtml(s.name)}</strong> · ${role}<br/>
           ${s.email ? `${escapeHtml(s.email)}<br/>` : ""}
           ${escapeHtml(al(lang, "Signed on"))} ${fmtDateTime(s.serverSignedAt, lang)}${s.ip ? ` · IP ${escapeHtml(s.ip)}` : ""}<br/>
           <span style="color:#999;">${escapeHtml(s.consentText ?? al(lang, "Consent recorded electronically."))}</span>
         </div>`
      : `<div style="font-size:11px;color:#777;margin-top:8px;">
           <strong style="color:#555;">${escapeHtml(s.name)}</strong> · ${role}
         </div>`;
    return `<div style="flex:1 1 240px;min-width:220px;padding:14px;border:1px solid #f0f0f0;border-radius:10px;">
      ${sigArea}${meta}
    </div>`;
  });
  return `<div class="section" style="margin-top:32px;">
    <h3>${escapeHtml(al(lang, "Signatures"))}</h3>
    <div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:12px;">${cards.join("")}</div>
  </div>`;
}

export function buildApplicationBody(input: ApplicationDocInput): string {
  const lang = input.lang ?? "en";
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

  const statusBadge = input.signed
    ? al(lang, "Signed")
    : (input.status ? statusLabel(lang, input.status) : al(lang, "Submitted"));
  const badgeColor = input.signed ? "#0a7d57" : "#E8621A";

  return `
    <div class="section" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
      <div>
        <h3>${escapeHtml(input.docType)}</h3>
        <div class="ref-chip" style="font-size:20px;">${escapeHtml(input.ref)}</div>
        <div style="font-size:13px;color:#777;margin-top:4px;">${escapeHtml(al(lang, "Submitted on"))} ${fmtDate(input.submittedAt, lang)}</div>
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
  opts: { signed?: boolean; lang?: DocLang } = {},
): ApplicationDocInput {
  const lang = opts.lang ?? normalizeLang(undefined);
  const L = (s: string) => al(lang, s);
  const signed = opts.signed ?? (signing?.status === "signed");
  const p = (row.preferences ?? {}) as Record<string, any>;
  const ec = (p.emergency_contact ?? {}) as Record<string, any>;
  const addons = (p.addons ?? {}) as Record<string, any>;

  const sections: ApplicationDocSection[] = [];
  const push = (s: ApplicationDocSection | null) => { if (s) sections.push(s); };

  push(section(L("Student"), [
    [L("Name"), `${row.student_first_name} ${row.student_last_name}`.trim()],
    [L("Date of birth"), fmtDate(row.date_of_birth, lang)],
    [L("Minor (under 18)"), row.is_minor ? L("Yes") : L("No")],
    [L("Gender"), val(row.gender)],
    [L("Nationality"), val(row.nationality)],
    [L("Email"), val(row.student_email)],
    [L("Phone"), val(row.student_phone)],
    [L("Native language"), val(p.native_language)],
    [L("English level"), val(p.english_level)],
    [L("Relationship with host"), val(p.relationship_with_host)],
  ]));

  if (row.is_minor || row.guardian_name) {
    push(section(L("Guardian"), [
      [L("Name"), val(row.guardian_name)],
      [L("Email"), val(row.guardian_email)],
      [L("Phone"), val(row.guardian_phone)],
      [L("Relationship"), val(row.guardian_relationship)],
    ]));
  }

  push(section(L("School"), [
    [L("School"), val(p.school)],
    [L("Course"), val(p.course_name)],
    [L("Course start date"), val(p.course_start_date)],
    [L("Campus location"), val(p.campus_location)],
  ]));

  push(section(L("Homestay preferences"), [
    [L("Start date"), val(p.homestay_start_date)],
    [L("Duration (weeks)"), val(p.duration_weeks)],
    [L("Room type"), val(p.room_type)],
    [L("Meals"), val(p.meals)],
    [L("Allergic to pets"), yesNo(p.allergic_to_pets, lang)],
    [L("Can live with pets"), yesNo(p.can_live_with_pets, lang)],
    [L("Smoker"), yesNo(p.smoker, lang)],
    [L("Can live with smokers"), yesNo(p.can_live_with_smokers, lang)],
    [L("Can live with other students"), yesNo(p.can_live_with_students, lang)],
    [L("Can live with children"), yesNo(p.can_live_with_children, lang)],
  ]));

  push(section(L("Airport pickup"), [
    [L("Option"), val(p.airport_pickup_option)],
    [L("Arrival date"), val(p.arrival_date)],
    [L("Arrival time"), val(p.arrival_time)],
    [L("Flight no."), val(p.flight_no)],
  ]));

  push(section(L("Emergency contact"), [
    [L("Name"), val(ec.name)],
    [L("Relationship"), val(ec.relationship)],
    [L("Contact no."), val(ec.contact_no)],
    [L("Email"), val(ec.email)],
  ]));

  // Add-on names come from the shared service catalogue so they match the
  // invoice line items in the same language.
  const addonList = [
    addons.guardian_service ? serviceLabel(lang, "guardian_service") : null,
    addons.settlement_support ? serviceLabel(lang, "settlement_support") : null,
    addons.airport_pickup ? serviceLabel(lang, "airport_pickup") : null,
  ].filter(Boolean);
  push(section(L("Arrival support add-ons"), [
    [L("Selected"), addonList.length ? addonList.join(", ") : "—"],
  ]));

  const freeText = [
    { heading: L("Self introduction"), body: String(p.self_introduction ?? "") },
    { heading: L("Beliefs"), body: String(p.beliefs ?? "") },
    { heading: L("Dietary"), body: String(p.dietary ?? "") },
    { heading: L("Food avoided"), body: String(p.food_avoided ?? "") },
    { heading: L("Hobbies"), body: String(p.hobbies ?? "") },
    { heading: L("Other requirements"), body: String(p.other_requirements ?? "") },
    { heading: L("Additional comment"), body: String(p.additional_comment ?? "") },
  ];

  return {
    docType: L("Student Application"),
    ref: row.request_ref,
    status: row.status,
    submittedAt: row.created_at,
    sections,
    freeText,
    signatures: resolveSignatures(signing, signed),
    signed,
    lang,
  };
}

export function hostApplicationToDoc(
  row: HomestayHostApplication,
  signing?: SigningView,
  opts: { signed?: boolean; lang?: DocLang } = {},
): ApplicationDocInput {
  const lang = opts.lang ?? normalizeLang(undefined);
  const L = (s: string) => al(lang, s);
  const signed = opts.signed ?? (signing?.status === "signed");
  const ec = (row.emergency_contact ?? {}) as Record<string, any>;
  const extra = (row.extra_contact ?? {}) as Record<string, any>;
  const ref = (row.host_referral ?? {}) as Record<string, any>;
  const residents = Array.isArray(row.residents) ? (row.residents as any[]) : [];
  const rooms = Array.isArray(row.rooms) ? (row.rooms as any[]) : [];

  const sections: ApplicationDocSection[] = [];
  const push = (s: ApplicationDocSection | null) => { if (s) sections.push(s); };

  push(section(L("Host family"), [
    [L("Name"), `${row.first_name} ${row.last_name}`.trim()],
    [L("Email"), val(row.email)],
    [L("Phone"), val(row.phone)],
    [L("Date of birth"), fmtDate(row.date_of_birth, lang)],
    [L("Gender"), val(row.gender)],
    [L("Nationality"), val(row.nationality)],
    [L("Cultural background"), val(row.cultural_background)],
    [L("Address"), val(row.address)],
    [L("Suburb"), val(row.suburb)],
    [L("Heard about us"), val(row.heard_about)],
  ]));

  push(section(L("Household"), [
    [L("Smoking in home"), yesNo(row.smoking_in_home, lang)],
    [L("Smoking outside allowed"), yesNo(row.smoke_outside_allowed, lang)],
    [L("Drinking in home"), yesNo(row.drink_in_home, lang)],
    [L("Guest drinking allowed"), yesNo(row.guest_drink_allowed, lang)],
    [L("Has pets"), yesNo(row.has_pets, lang)],
    [L("Pet types"), val(row.pet_types)],
    [L("Pet notes"), val(row.pet_notes)],
    ...residents.map((r, i) => [
      `Resident ${i + 1}`,
      `${val(r.name)} · age ${val(r.age)} · ${val(r.gender)} · ${val(r.relationship)}`,
    ] as [string, string]),
  ]));

  push(section(L("Home & rooms"), [
    [L("Building type"), val(row.building_type)],
    [L("Home features"), val(row.home_features)],
    ...rooms.map((r, i) => [
      `Room ${i + 1}${r.name ? ` (${val(r.name)})` : ""}`,
      `${val(r.bed_type)} bed · ${val(r.bath_type)} bath · lock: ${yesNo(r.has_lock, lang)}${r.comments ? ` · ${val(r.comments)}` : ""}`,
    ] as [string, string]),
  ]));

  push(section(L("Student preferences & packages"), [
    [L("Preferred student gender"), val(row.pref_student_gender)],
    [L("Preferred student age"), val(row.pref_student_age)],
    [L("Resident under 18 in home"), yesNo(row.host_under_18, lang)],
    [L("Packages offered"), val(row.packages_offered)],
    [L("Dietary accommodations"), val(row.dietary)],
    [L("Dietary notes"), val(row.dietary_notes)],
  ]));

  push(section(L("Emergency contact"), [
    [L("Name"), val(ec.name)],
    [L("Relationship"), val(ec.relationship)],
    [L("Phone"), val(ec.phone)],
    [L("Email"), val(ec.email)],
  ]));

  push(section(L("Additional contact & referral"), [
    [L("Extra contact email"), val(extra.email)],
    [L("Extra contact phone"), val(extra.phone)],
    [L("Extra contact relationship"), val(extra.relationship)],
    [L("Referral — heard about"), val(ref.heard_about)],
    [L("Referred by host"), yesNo(ref.referred_by_host, lang)],
    [L("Referrer name"), val(ref.referrer_name)],
  ]));

  const freeText = [
    { heading: L("Welcome message"), body: String(row.welcome_message ?? "") },
    { heading: L("Profile description"), body: String(row.profile_description ?? "") },
  ];

  return {
    docType: L("Host Family Application"),
    ref: row.application_ref,
    status: row.status,
    submittedAt: row.created_at,
    sections,
    freeText,
    signatures: resolveSignatures(signing, signed),
    signed,
    lang,
  };
}

export function shortTermApplicationToDoc(
  row: ShortTermApplication,
  signing?: SigningView,
  opts: { signed?: boolean; lang?: DocLang } = {},
): ApplicationDocInput {
  const lang = opts.lang ?? normalizeLang(undefined);
  const L = (s: string) => al(lang, s);
  const signed = opts.signed ?? (signing?.status === "signed");
  const p = (row.preferences ?? {}) as Record<string, any>;

  const sections: ApplicationDocSection[] = [];
  const push = (s: ApplicationDocSection | null) => { if (s) sections.push(s); };

  push(section(L("Applicant"), [
    [L("Name"), `${row.first_name} ${row.last_name}`.trim()],
    [L("Email"), val(row.email)],
    [L("Phone"), val(row.phone)],
    [L("Nationality"), val(row.nationality)],
  ]));

  push(section(L("Stay details"), [
    [L("Check-in"), fmtDate(row.check_in, lang)],
    [L("Check-out"), fmtDate(row.check_out, lang)],
    [L("Guests"), val(row.guests)],
    [L("Preferred area"), val(row.preferred_area)],
    [L("Property type"), val(row.property_type)],
    [L("Weekly budget"), val(p.budget_weekly)],
    [L("Move-in flexible"), yesNo(p.move_in_flexible, lang)],
  ]));

  const freeText = [
    { heading: L("Notes"), body: String(p.notes ?? "") },
  ];

  return {
    docType: L("Short-term Accommodation Application"),
    ref: row.request_ref,
    status: row.status,
    submittedAt: row.created_at,
    sections,
    freeText,
    signatures: resolveSignatures(signing, signed),
    signed,
    lang,
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
    lang?: DocLang;
  } = {},
): ApplicationDocInput {
  const lang = opts.lang ?? normalizeLang(undefined);
  const L = (s: string) => al(lang, s);
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
  push(section(L("Student (Customer)"), [
    [L("Name"), studentName],
    [L("Email"), val(student?.student_email)],
    [L("Phone"), val(student?.student_phone)],
    [L("Date of birth"), val(student?.date_of_birth)],
    [L("Gender"), val(student?.gender)],
    [L("Nationality"), val(student?.nationality)],
    [L("Minor"), student ? yesNo(student.is_minor, lang) : "—"],
    student?.is_minor ? [L("Guardian"), val(student?.guardian_name)] : null,
    student?.is_minor ? [L("Guardian relationship"), val(student?.guardian_relationship)] : null,
    student?.is_minor ? [L("Guardian email"), val(student?.guardian_email)] : null,
    student?.is_minor ? [L("Guardian phone"), val(student?.guardian_phone)] : null,
  ]));

  // ── 2) Host family ───────────────────────────────────────────────────────
  push(section(L("Host Family"), [
    [L("Host"), hostName],
    [L("Email"), val(host?.email)],
    [L("Phone"), val(host?.phone)],
    [L("Address"), val(host?.address)],
    [L("Suburb"), val(host?.suburb)],
    [L("Home type"), val(host?.building_type)],
    [L("Cultural background"), val(host?.cultural_background)],
    residentCount ? [L("Household"), `${residentCount} resident${residentCount > 1 ? "s" : ""}`] : null,
    [L("Pets"), petSummary],
    host ? [L("Smoking in home"), yesNo(host.smoking_in_home, lang)] : null,
    host ? [L("Alcohol in home"), yesNo(host.drink_in_home, lang)] : null,
  ]));

  // ── 3) Homestay (placement arrangement) ─────────────────────────────────────
  push(section(L("Homestay"), [
    [L("Provider"), "MillionStay Pty Ltd"],
    [L("Move-in date"), val(placement.move_in_date)],
    [L("Move-out date"), val(placement.move_out_date)],
    placement.billing_cycle_weeks ? [L("Billing cycle"), `${placement.billing_cycle_weeks} week${placement.billing_cycle_weeks > 1 ? "s" : ""}`] : null,
    [L("Meal packages"), listSummary(host?.packages_offered)],
    [L("Dietary catered"), dietarySummary],
    [L("Room features"), listSummary(host?.home_features)],
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
    .map((s) => ({ label: serviceLabel(lang, s.service_type), amount: Number(s.price ?? 0) }))
    .filter((s) => s.amount > 0);
  const servicesTotal = round2(servicesList.reduce((sum, s) => sum + s.amount, 0));

  const initialBase = round2(placementFee + depositAmt + monthlyAmt + servicesTotal);
  const initialSurcharge = isCard ? round2(initialBase * surchargePct / 100) : 0;
  const initialTotal = round2(initialBase + initialSurcharge);
  const monthlySurcharge = isCard ? round2(monthlyAmt * surchargePct / 100) : 0;
  const monthlyTotal = round2(monthlyAmt + monthlySurcharge);
  const showSubtotal = isCard && initialSurcharge > 0;

  push(section(L("Fees — initial payment (due now)"), [
    placementFee > 0 ? [L("· Placement fee"), money(placementFee)] : null,
    depositAmt > 0 ? [L("· Security deposit"), money(depositAmt)] : null,
    monthlyAmt > 0 ? [L("· First month accommodation"), money(monthlyAmt)] : null,
    ...servicesList.map((s) => [`· ${s.label}`, money(s.amount)] as [string, string]),
    showSubtotal ? [L("Subtotal"), money(initialBase)] : null,
    showSubtotal ? [`Card surcharge (${surchargePct}%)`, money(initialSurcharge)] : null,
    initialTotal > 0 ? [L("Total due now"), money(initialTotal)] : null,
    [L("Currency"), val(placement.currency)],
    [L("Payment method"), isCard ? `Card (${surchargePct}% surcharge)` : "Bank transfer"],
  ]));

  // Only shown when there is a recurring monthly fee.
  if (recurs) {
    push(section(L("Fees — ongoing (monthly)"), [
      [L("Monthly accommodation fee"), money(monthlyAmt)],
      (isCard && monthlySurcharge > 0) ? [`Card surcharge (${surchargePct}%)`, money(monthlySurcharge)] : null,
      (isCard && monthlySurcharge > 0) ? [L("Monthly total"), money(monthlyTotal)] : null,
      [L("Billing cycle"), cycleLabel],
      monthlyDate ? [L("Next payment date"), fmtDate(monthlyDate, lang)] : null,
    ]));
  }

  return {
    docType: L("Homestay Placement Agreement"),
    ref: placement.placement_ref,
    status: placement.status,
    submittedAt: placement.created_at,
    sections,
    freeText: [{ heading: L("Agreement terms"), body: opts.termsText ?? STANDARD_PLACEMENT_TERMS }],
    signatures: resolveSignatures(signing, signed),
    signed,
    lang,
  };
}

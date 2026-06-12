/**
 * seed-homestay-samples.mjs
 *
 * Submits 5 Student Applications + 5 Host Family Applications END-TO-END through
 * the REAL public endpoints (intake → e-signature), so the whole signed-PDF +
 * email pipeline is exercised. Every applicant/guardian/emergency email is
 * plus-addressed to a single safe test inbox, and every name is prefixed
 * "SAMPLE" so the rows are trivially identifiable and removable.
 *
 * ⚠️  Local/dev runs against the REAL production Supabase DB. This script is
 *     therefore double-gated: it refuses to run without BOTH
 *       ALLOW_SAMPLE_SEED=1   (env)   and   --confirm   (arg).
 *
 * Usage:
 *   ALLOW_SAMPLE_SEED=1 API_BASE=http://localhost:8080 \
 *     node scripts/seed-homestay-samples.mjs --confirm
 *
 * Cleanup afterwards:  node scripts/cleanup-homestay-samples.mjs --confirm
 */

const API_BASE = (process.env.API_BASE || "http://localhost:8080").replace(/\/+$/, "");
const TEST_INBOX = process.env.SAMPLE_INBOX || "sunjae@timest.com.au";
const [inbname, indomain] = TEST_INBOX.split("@");
const RUN = Date.now().toString(36); // unique tag so re-runs don't collide on email

// A tiny but valid 1×1 PNG — stands in for a drawn signature to drive the flow.
const SIG_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

/** Build a plus-addressed test email: sunjae+sample-<tag>@timest.com.au */
const mail = (tag) => `${inbname}+sample-${RUN}-${tag}@${indomain}`;

// ── Gates ────────────────────────────────────────────────────────────────────
if (process.env.ALLOW_SAMPLE_SEED !== "1" || !process.argv.includes("--confirm")) {
  console.error(
    "Refusing to run. This submits real applications + emails against the live DB.\n" +
    "Re-run with:  ALLOW_SAMPLE_SEED=1 node scripts/seed-homestay-samples.mjs --confirm",
  );
  process.exit(1);
}

// ── Sample data ──────────────────────────────────────────────────────────────
// Mix of adults and minors (minors require a guardian + a guardian signer).
const STUDENTS = [
  {
    tag: "stu1", student_first_name: "SAMPLE Aiko", student_last_name: "Tanaka",
    date_of_birth: "2002-04-12", gender: "Female", nationality: "Japan",
    preferences: {
      native_language: "Japanese", english_level: "Intermediate",
      school: "ELC English College", course_name: "General English", course_start_date: "2026-08-01",
      campus_location: "Sydney CBD", homestay_start_date: "2026-07-28", duration_weeks: "12",
      room_type: "Single", meals: "Full board", allergic_to_pets: "no", can_live_with_pets: "yes",
      smoker: "no", can_live_with_smokers: "no", can_live_with_students: "yes", can_live_with_children: "yes",
      airport_pickup_option: "Return", arrival_date: "2026-07-28", arrival_time: "14:30", flight_no: "JL51",
      hobbies: "Photography, hiking", self_introduction: "Friendly and tidy student who loves cooking.",
      emergency_contact: { name: "SAMPLE Haruko Tanaka", relationship: "Mother", contact_no: "+81 90 1234 5678", email: mail("stu1-ec") },
    },
  },
  {
    tag: "stu2", student_first_name: "SAMPLE Min-jun", student_last_name: "Kim",
    date_of_birth: "2010-09-03", gender: "Male", nationality: "South Korea",
    guardian_name: "SAMPLE Seo-yeon Kim", guardian_email: null, guardian_phone: "+82 10 9876 5432", guardian_relationship: "Mother",
    preferences: {
      native_language: "Korean", english_level: "Beginner",
      school: "Junior High Pathway", course_name: "High School Prep", course_start_date: "2026-09-01",
      campus_location: "Melbourne", homestay_start_date: "2026-08-25", duration_weeks: "24",
      room_type: "Single", meals: "Full board", allergic_to_pets: "yes", can_live_with_pets: "no",
      smoker: "no", can_live_with_smokers: "no", can_live_with_students: "yes", can_live_with_children: "yes",
      airport_pickup_option: "One way", arrival_date: "2026-08-25", arrival_time: "09:10", flight_no: "OZ601",
      dietary: "No seafood", self_introduction: "Quiet, studious, enjoys soccer.",
      emergency_contact: { name: "SAMPLE Seo-yeon Kim", relationship: "Mother", contact_no: "+82 10 9876 5432", email: mail("stu2-ec") },
      addons: { guardian_service: true, settlement_support: true },
    },
  },
  {
    tag: "stu3", student_first_name: "SAMPLE Lucas", student_last_name: "Müller",
    date_of_birth: "2001-01-22", gender: "Male", nationality: "Germany",
    preferences: {
      native_language: "German", english_level: "Advanced",
      school: "University of Sydney — Pathway", course_name: "Academic English", course_start_date: "2026-10-05",
      campus_location: "Sydney", homestay_start_date: "2026-10-01", duration_weeks: "16",
      room_type: "Single", meals: "Half board", allergic_to_pets: "no", can_live_with_pets: "yes",
      smoker: "no", can_live_with_smokers: "yes", can_live_with_students: "yes", can_live_with_children: "no",
      airport_pickup_option: "Not required",
      hobbies: "Cycling, chess", self_introduction: "Independent traveller, very organised.",
      emergency_contact: { name: "SAMPLE Anna Müller", relationship: "Sister", contact_no: "+49 151 2345678", email: mail("stu3-ec") },
    },
  },
  {
    tag: "stu4", student_first_name: "SAMPLE Sofia", student_last_name: "Rossi",
    date_of_birth: "2003-06-30", gender: "Female", nationality: "Italy",
    preferences: {
      native_language: "Italian", english_level: "Intermediate",
      school: "Navitas English", course_name: "IELTS Preparation", course_start_date: "2026-07-15",
      campus_location: "Brisbane", homestay_start_date: "2026-07-10", duration_weeks: "8",
      room_type: "Twin", meals: "Full board", allergic_to_pets: "no", can_live_with_pets: "yes",
      smoker: "no", can_live_with_smokers: "no", can_live_with_students: "yes", can_live_with_children: "yes",
      airport_pickup_option: "Return", arrival_date: "2026-07-10", arrival_time: "18:45", flight_no: "EK434",
      dietary: "Vegetarian", hobbies: "Painting, yoga", self_introduction: "Warm and sociable, loves art.",
      emergency_contact: { name: "SAMPLE Marco Rossi", relationship: "Father", contact_no: "+39 333 1112222", email: mail("stu4-ec") },
    },
  },
  {
    tag: "stu5", student_first_name: "SAMPLE Wei", student_last_name: "Chen",
    date_of_birth: "2009-11-18", gender: "Male", nationality: "China",
    guardian_name: "SAMPLE Li Chen", guardian_email: null, guardian_phone: "+86 138 0000 1111", guardian_relationship: "Father",
    preferences: {
      native_language: "Mandarin", english_level: "Beginner",
      school: "High School Pathway", course_name: "Year 10 Prep", course_start_date: "2026-08-10",
      campus_location: "Perth", homestay_start_date: "2026-08-05", duration_weeks: "40",
      room_type: "Single", meals: "Full board", allergic_to_pets: "no", can_live_with_pets: "yes",
      smoker: "no", can_live_with_smokers: "no", can_live_with_students: "yes", can_live_with_children: "yes",
      airport_pickup_option: "One way", arrival_date: "2026-08-05", arrival_time: "11:25", flight_no: "CZ319",
      food_avoided: "Pork", self_introduction: "Polite and curious, enjoys basketball.",
      emergency_contact: { name: "SAMPLE Li Chen", relationship: "Father", contact_no: "+86 138 0000 1111", email: mail("stu5-ec") },
      addons: { guardian_service: true },
    },
  },
];

const HOST_PASSWORD = "SampleHost!2026xyz"; // 12+ chars, mixed case + digit + special

const HOSTS = [
  {
    tag: "host1", first_name: "SAMPLE Olivia", last_name: "Brown", phone: "+61 400 111 222",
    date_of_birth: "1980-03-15", gender: "Female", nationality: "Australia", cultural_background: "Australian",
    address: "12 Rose St", suburb: "Chatswood", heard_about: "Google",
    residents: [{ name: "SAMPLE Olivia Brown", age: 45, gender: "Female", relationship: "Self" }, { name: "SAMPLE Tom Brown", age: 47, gender: "Male", relationship: "Spouse" }],
    smoking_in_home: false, smoke_outside_allowed: true, drink_in_home: false, guest_drink_allowed: false,
    has_pets: true, pet_types: "Dog", pet_notes: "Small, friendly poodle",
    building_type: "House", home_features: ["Pool", "Carpet"],
    rooms: [{ name: "Garden Room", bed_type: "Single", bath_type: "Shared", has_lock: true, comments: "Quiet, faces the garden" }],
    pref_student_gender: "Either", pref_student_age: "either", host_under_18: false,
    packages_offered: ["full_board"], dietary: ["Vegetarian"], dietary_notes: "Happy to cook vegetarian",
    welcome_message: "Welcome to our home! We love hosting international students.",
    profile_description: "A warm family home close to transport and schools.",
    emergency_contact: { name: "SAMPLE Tom Brown", relationship: "Spouse", phone: "+61 400 111 333", email: mail("host1-ec") },
  },
  {
    tag: "host2", first_name: "SAMPLE James", last_name: "Wilson", phone: "+61 400 222 333",
    date_of_birth: "1975-07-09", gender: "Male", nationality: "Australia", cultural_background: "British-Australian",
    address: "5 Park Ave", suburb: "Carlton", heard_about: "Friend",
    residents: [{ name: "SAMPLE James Wilson", age: 50, gender: "Male", relationship: "Self" }],
    smoking_in_home: false, smoke_outside_allowed: false, drink_in_home: true, guest_drink_allowed: false,
    has_pets: false,
    building_type: "Apartment", home_features: ["Gym"],
    rooms: [{ name: "City View Room", bed_type: "Double", bath_type: "Ensuite", has_lock: true, comments: "Great light" }],
    pref_student_gender: "Male", pref_student_age: "adult", host_under_18: false,
    packages_offered: ["partial_board", "dinner_only"], dietary: [], dietary_notes: "",
    welcome_message: "Modern apartment in the heart of Melbourne.",
    profile_description: "Single professional host, walking distance to universities.",
    emergency_contact: { name: "SAMPLE Karen Wilson", relationship: "Sister", phone: "+61 400 222 444", email: mail("host2-ec") },
  },
  {
    tag: "host3", first_name: "SAMPLE Mary", last_name: "Nguyen", phone: "+61 400 333 444",
    date_of_birth: "1983-12-01", gender: "Female", nationality: "Australia", cultural_background: "Vietnamese-Australian",
    address: "88 River Rd", suburb: "South Brisbane", heard_about: "Social media",
    residents: [{ name: "SAMPLE Mary Nguyen", age: 42, gender: "Female", relationship: "Self" }, { name: "SAMPLE Lily Nguyen", age: 12, gender: "Female", relationship: "Daughter" }],
    smoking_in_home: false, smoke_outside_allowed: false, drink_in_home: false, guest_drink_allowed: false,
    has_pets: true, pet_types: "Cat", pet_notes: "Indoor cat",
    building_type: "Townhouse", home_features: ["No Carpet"],
    rooms: [{ name: "Upstairs Room", bed_type: "Queen", bath_type: "Own", has_lock: true, comments: "Spacious with a desk" }],
    pref_student_gender: "Female", pref_student_age: "either", host_under_18: true,
    packages_offered: ["full_board"], dietary: ["Halal", "Vegetarian"], dietary_notes: "Experienced with Halal meals",
    welcome_message: "Family home with a child — great for younger students.",
    profile_description: "Caring host family near the river and city.",
    emergency_contact: { name: "SAMPLE Peter Nguyen", relationship: "Brother", phone: "+61 400 333 555", email: mail("host3-ec") },
  },
  {
    tag: "host4", first_name: "SAMPLE David", last_name: "Smith", phone: "+61 400 444 555",
    date_of_birth: "1968-05-20", gender: "Male", nationality: "Australia", cultural_background: "Australian",
    address: "23 Beach Blvd", suburb: "Scarborough", heard_about: "Agency",
    residents: [{ name: "SAMPLE David Smith", age: 57, gender: "Male", relationship: "Self" }, { name: "SAMPLE Susan Smith", age: 55, gender: "Female", relationship: "Spouse" }],
    smoking_in_home: false, smoke_outside_allowed: true, drink_in_home: true, guest_drink_allowed: true,
    has_pets: false,
    building_type: "House", home_features: ["Pool", "Carpet"],
    rooms: [
      { name: "Ocean Room", bed_type: "King Single", bath_type: "Shared", has_lock: true, comments: "Sea breeze" },
      { name: "Study Room", bed_type: "Single", bath_type: "Shared", has_lock: false, comments: "Good for a second student" },
    ],
    pref_student_gender: "Either", pref_student_age: "adult", host_under_18: false,
    packages_offered: ["full_board", "partial_board"], dietary: [], dietary_notes: "",
    welcome_message: "Beachside living with plenty of space.",
    profile_description: "Retired couple who enjoy hosting and showing students around Perth.",
    emergency_contact: { name: "SAMPLE Susan Smith", relationship: "Spouse", phone: "+61 400 444 666", email: mail("host4-ec") },
  },
  {
    tag: "host5", first_name: "SAMPLE Emma", last_name: "Taylor", phone: "+61 400 555 666",
    date_of_birth: "1990-02-14", gender: "Female", nationality: "Australia", cultural_background: "Australian",
    address: "7 Hill Cres", suburb: "Norwood", heard_about: "Google",
    residents: [{ name: "SAMPLE Emma Taylor", age: 35, gender: "Female", relationship: "Self" }],
    smoking_in_home: false, smoke_outside_allowed: false, drink_in_home: false, guest_drink_allowed: false,
    has_pets: true, pet_types: "Dog", pet_notes: "Golden retriever, very gentle",
    building_type: "House", home_features: ["Carpet"],
    rooms: [{ name: "Front Room", bed_type: "Double", bath_type: "Own", has_lock: true, comments: "Newly renovated" }],
    pref_student_gender: "Female", pref_student_age: "either", host_under_18: false,
    packages_offered: ["dinner_only"], dietary: ["Vegan"], dietary_notes: "Vegan household",
    welcome_message: "Cosy home with a friendly dog in leafy Norwood.",
    profile_description: "Young professional host who loves cooking and travel.",
    emergency_contact: { name: "SAMPLE Grace Taylor", relationship: "Mother", phone: "+61 400 555 777", email: mail("host5-ec") },
  },
];

// ── HTTP helpers ─────────────────────────────────────────────────────────────
async function postJson(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { _raw: text }; }
  return { ok: res.ok, status: res.status, json };
}

async function getJson(path) {
  const res = await fetch(`${API_BASE}${path}`);
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { _raw: text }; }
  return { ok: res.ok, status: res.status, json };
}

/** Drive the e-signature step: fetch signers, then sign for each required role. */
async function signRequest(token, label) {
  const get = await getJson(`/api/v1/public/contract-signing/${token}`);
  if (!get.ok) { console.warn(`  ⚠️  ${label}: could not load signing request (${get.status})`); return false; }
  const signers = get.json.signers ?? [];
  const signatures = signers.map((s) => ({ role: s.role, name: s.name, signatureImage: SIG_PNG }));
  const sign = await postJson(`/api/v1/public/contract-signing/${token}/sign`, { signatures, consent: true });
  if (!sign.ok) { console.warn(`  ⚠️  ${label}: sign failed (${sign.status})`, sign.json); return false; }
  return true;
}

// ── Run ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Seeding homestay samples → ${API_BASE}`);
  console.log(`Test inbox: ${TEST_INBOX} (plus-addressed, tag run=${RUN})\n`);

  console.log("STUDENT APPLICATIONS");
  for (const s of STUDENTS) {
    const payload = {
      student_first_name: s.student_first_name,
      student_last_name: s.student_last_name,
      student_email: mail(`${s.tag}-student`),
      student_phone: "+61 400 000 000",
      date_of_birth: s.date_of_birth,
      gender: s.gender,
      nationality: s.nationality,
      guardian_name: s.guardian_name,
      guardian_email: s.guardian_name ? mail(`${s.tag}-guardian`) : undefined,
      guardian_phone: s.guardian_phone,
      guardian_relationship: s.guardian_relationship,
      preferences: s.preferences,
      terms_accepted: true,
    };
    const r = await postJson("/api/v1/public/homestay-student-requests", payload);
    if (!r.ok) { console.warn(`  ✗ ${s.student_first_name} ${s.student_last_name}: submit failed (${r.status})`, r.json); continue; }
    const { request_ref, signing_token, is_minor } = r.json;
    const signed = await signRequest(signing_token, request_ref);
    console.log(`  ✓ ${request_ref} — ${s.student_first_name} ${s.student_last_name}${is_minor ? " (minor)" : ""} ${signed ? "· signed" : "· NOT signed"}`);
  }

  console.log("\nHOST FAMILY APPLICATIONS");
  for (const h of HOSTS) {
    const payload = {
      ...h,
      email: mail(`${h.tag}-host`),
      password: HOST_PASSWORD,
      agreement_accepted: true,
      signature_name: `${h.first_name} ${h.last_name}`,
    };
    delete payload.tag;
    const r = await postJson("/api/v1/public/homestay-host-applications", payload);
    if (!r.ok) { console.warn(`  ✗ ${h.first_name} ${h.last_name}: submit failed (${r.status})`, r.json); continue; }
    const { application_ref, signing_token } = r.json;
    const signed = signing_token ? await signRequest(signing_token, application_ref) : false;
    console.log(`  ✓ ${application_ref} — ${h.first_name} ${h.last_name} ${signed ? "· signed" : "· NOT signed"}`);
  }

  console.log("\nDone. Check the test inbox for signed-PDF emails.");
  console.log("Clean up with:  node scripts/cleanup-homestay-samples.mjs --confirm");
}

main().catch((e) => { console.error(e); process.exit(1); });

import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, ShieldCheck } from "lucide-react";
import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero } from "@/components/homestay/sections";
import { HS, HS_FONT } from "@/lib/homestay-theme";
import { submitStudentApplication, type StudentApplicationInput } from "@/lib/students-api";

// 2.5 Apply Now — the online student application (Phase 3). Mirrors the official
// "Homestay Application and Agreement" document so the intake captures the same
// detail the paper form does. On submit we create the request + a signing
// request, then send the applicant to /sign/:token to e-sign (the guardian
// co-signs for under-18s).
const ENGLISH_LEVELS = ["Beginner", "Elementary", "Intermediate", "Upper-intermediate", "Advanced", "Native"];
const ROOM_TYPES = ["Single room", "Twin room"];
const MEAL_OPTIONS = ["Full board (all meals)", "Half board (breakfast & dinner)", "Dinner only", "No meals"];
const AIRPORT_OPTIONS = ["Not required", "One way", "Return"];
const YES_NO = ["Yes", "No"];

const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2";
const textareaCls = inputCls + " min-h-[88px] resize-y";

function Field({ label, children, required, hint }: { label: string; children: React.ReactNode; required?: boolean; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span style={{ color: HS.brand }}> *</span>}
        {hint && <span className="text-gray-400 font-normal"> · {hint}</span>}
      </span>
      {children}
    </label>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl font-bold mb-4" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>
      {children}
    </h2>
  );
}

function ageFromDob(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export default function StudentApply() {
  const [, setLocation] = useLocation();
  const [f, setF] = useState({
    // Personal
    student_first_name: "", student_last_name: "", student_email: "", student_phone: "",
    date_of_birth: "", gender: "", nationality: "",
    native_language: "", english_level: "", relationship_with_host: "", additional_comment: "",
    // Guardian (under 18)
    guardian_name: "", guardian_email: "", guardian_phone: "", guardian_relationship: "",
    // School
    school: "", course_name: "", course_start_date: "", campus_location: "",
    // Homestay
    homestay_start_date: "", duration_weeks: "", room_type: ROOM_TYPES[0], meals: MEAL_OPTIONS[0],
    allergic_to_pets: "", can_live_with_pets: "", smoker: "", can_live_with_smokers: "",
    beliefs: "", dietary: "", food_avoided: "", hobbies: "",
    can_live_with_students: "", can_live_with_children: "", other_requirements: "", self_introduction: "",
    // Airport pickup
    airport_pickup_option: AIRPORT_OPTIONS[0], arrival_date: "", arrival_time: "", flight_no: "",
    // Emergency contact
    ec_name: "", ec_relationship: "", ec_contact_no: "", ec_email: "",
    // Optional arrival support
    guardian_service: false, settlement_support: false,
    // Terms
    terms_accepted: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const age = useMemo(() => ageFromDob(f.date_of_birth), [f.date_of_birth]);
  const isMinor = age != null && age < 18;
  const airportRequired = f.airport_pickup_option !== AIRPORT_OPTIONS[0];

  const ring = { ["--tw-ring-color" as any]: HS.brand };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!f.student_first_name || !f.student_last_name || !f.date_of_birth) {
      setError("Please provide the student's name and date of birth."); return;
    }
    if (age == null) { setError("Please enter a valid date of birth."); return; }
    if (isMinor && (!f.guardian_name || !f.guardian_email)) {
      setError("Students under 18 must provide a guardian name and email."); return;
    }
    if (!f.terms_accepted) { setError("Please accept the Terms & Conditions to continue."); return; }

    const payload: StudentApplicationInput = {
      student_first_name: f.student_first_name,
      student_last_name: f.student_last_name,
      student_email: f.student_email || undefined,
      student_phone: f.student_phone || undefined,
      date_of_birth: f.date_of_birth,
      gender: f.gender || undefined,
      nationality: f.nationality || undefined,
      guardian_name: f.guardian_name || undefined,
      guardian_email: f.guardian_email || undefined,
      guardian_phone: f.guardian_phone || undefined,
      guardian_relationship: f.guardian_relationship || undefined,
      preferences: {
        native_language: f.native_language,
        english_level: f.english_level,
        relationship_with_host: f.relationship_with_host,
        additional_comment: f.additional_comment,
        school: f.school,
        course_name: f.course_name,
        course_start_date: f.course_start_date,
        campus_location: f.campus_location,
        homestay_start_date: f.homestay_start_date,
        duration_weeks: f.duration_weeks,
        room_type: f.room_type,
        meals: f.meals,
        allergic_to_pets: f.allergic_to_pets,
        can_live_with_pets: f.can_live_with_pets,
        smoker: f.smoker,
        can_live_with_smokers: f.can_live_with_smokers,
        beliefs: f.beliefs,
        dietary: f.dietary,
        food_avoided: f.food_avoided,
        hobbies: f.hobbies,
        can_live_with_students: f.can_live_with_students,
        can_live_with_children: f.can_live_with_children,
        other_requirements: f.other_requirements,
        self_introduction: f.self_introduction,
        airport_pickup_option: f.airport_pickup_option,
        arrival_date: airportRequired ? f.arrival_date : "",
        arrival_time: airportRequired ? f.arrival_time : "",
        flight_no: airportRequired ? f.flight_no : "",
        emergency_contact: {
          name: f.ec_name, relationship: f.ec_relationship, contact_no: f.ec_contact_no, email: f.ec_email,
        },
        addons: {
          guardian_service: f.guardian_service,
          airport_pickup: airportRequired,
          settlement_support: f.settlement_support,
        },
      },
      terms_accepted: f.terms_accepted,
    };

    setSubmitting(true);
    try {
      const r = await submitStudentApplication(payload);
      // Continue to e-signature (student + guardian co-sign for under-18s).
      setLocation(`/sign/${r.signing_token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit. Please try again.");
      setSubmitting(false);
    }
  }

  const sel = (k: string, value: string) => (
    <select className={inputCls + " bg-white"} style={ring} value={value} onChange={(e) => set(k, e.target.value)}>
      <option value="">Please select</option>
      {YES_NO.map((o) => <option key={o}>{o}</option>)}
    </select>
  );

  return (
    <HomestayLayout title="Apply Now">
      <HsPageHero
        eyebrow="Students"
        title="Homestay application"
        lead={<p>Tell us about yourself and what you’re looking for in a host family. Accept the Terms &amp; Conditions, then e-sign. Our operations team reviews every application and matches by hand — never automatically.</p>}
      />
      <section className="max-w-3xl mx-auto px-5 py-12">
        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Student's personal information */}
          <div>
            <SectionTitle>Student’s personal information</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Family name (surname)" required><input className={inputCls} style={ring} value={f.student_last_name} onChange={(e) => set("student_last_name", e.target.value)} /></Field>
              <Field label="Given name" required><input className={inputCls} style={ring} value={f.student_first_name} onChange={(e) => set("student_first_name", e.target.value)} /></Field>
              <Field label="Date of birth" required><input type="date" className={inputCls} style={ring} value={f.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} /></Field>
              <Field label="Gender">
                <select className={inputCls + " bg-white"} style={ring} value={f.gender} onChange={(e) => set("gender", e.target.value)}>
                  <option value="">Prefer not to say</option><option>Female</option><option>Male</option><option>Other</option>
                </select>
              </Field>
              <Field label="Nationality"><input className={inputCls} style={ring} value={f.nationality} onChange={(e) => set("nationality", e.target.value)} /></Field>
              <Field label="Email"><input type="email" className={inputCls} style={ring} value={f.student_email} onChange={(e) => set("student_email", e.target.value)} /></Field>
              <Field label="Phone"><input className={inputCls} style={ring} value={f.student_phone} onChange={(e) => set("student_phone", e.target.value)} /></Field>
              <Field label="Native language"><input className={inputCls} style={ring} value={f.native_language} onChange={(e) => set("native_language", e.target.value)} /></Field>
              <Field label="English level">
                <select className={inputCls + " bg-white"} style={ring} value={f.english_level} onChange={(e) => set("english_level", e.target.value)}>
                  <option value="">Please select</option>
                  {ENGLISH_LEVELS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <div className="mt-4 space-y-4">
              <Field label="Type of relationship you hope to have with your host">
                <input className={inputCls} style={ring} value={f.relationship_with_host} onChange={(e) => set("relationship_with_host", e.target.value)} placeholder="e.g. friendly and supportive, lots of conversation, independent…" />
              </Field>
              <Field label="Additional comment">
                <textarea className={textareaCls} style={ring} value={f.additional_comment} onChange={(e) => set("additional_comment", e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Guardian (under 18) */}
          {isMinor && (
            <div className="rounded-2xl p-6" style={{ backgroundColor: HS.cream }}>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-5 h-5" style={{ color: HS.brand }} />
                <h2 className="text-lg font-bold" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>Guardian (required, under 18)</h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">The student is under 18, so a parent or legal guardian must provide consent and co-sign the application.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Guardian name" required><input className={inputCls} style={ring} value={f.guardian_name} onChange={(e) => set("guardian_name", e.target.value)} /></Field>
                <Field label="Guardian email" required><input type="email" className={inputCls} style={ring} value={f.guardian_email} onChange={(e) => set("guardian_email", e.target.value)} /></Field>
                <Field label="Guardian phone"><input className={inputCls} style={ring} value={f.guardian_phone} onChange={(e) => set("guardian_phone", e.target.value)} /></Field>
                <Field label="Relationship"><input className={inputCls} style={ring} value={f.guardian_relationship} onChange={(e) => set("guardian_relationship", e.target.value)} placeholder="Parent, legal guardian…" /></Field>
              </div>
            </div>
          )}

          {/* School information */}
          <div>
            <SectionTitle>School information (in Australia)</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="School name"><input className={inputCls} style={ring} value={f.school} onChange={(e) => set("school", e.target.value)} /></Field>
              <Field label="Course name"><input className={inputCls} style={ring} value={f.course_name} onChange={(e) => set("course_name", e.target.value)} /></Field>
              <Field label="Course start date"><input type="date" className={inputCls} style={ring} value={f.course_start_date} onChange={(e) => set("course_start_date", e.target.value)} /></Field>
              <Field label="Campus location"><input className={inputCls} style={ring} value={f.campus_location} onChange={(e) => set("campus_location", e.target.value)} /></Field>
            </div>
          </div>

          {/* Homestay information */}
          <div>
            <SectionTitle>Homestay information</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Homestay start date"><input type="date" className={inputCls} style={ring} value={f.homestay_start_date} onChange={(e) => set("homestay_start_date", e.target.value)} /></Field>
              <Field label="Duration" hint="minimum 4 weeks"><input type="number" min={4} className={inputCls} style={ring} value={f.duration_weeks} onChange={(e) => set("duration_weeks", e.target.value)} placeholder="Number of weeks" /></Field>
              <Field label="Room preference">
                <select className={inputCls + " bg-white"} style={ring} value={f.room_type} onChange={(e) => set("room_type", e.target.value)}>
                  {ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Meals">
                <select className={inputCls + " bg-white"} style={ring} value={f.meals} onChange={(e) => set("meals", e.target.value)}>
                  {MEAL_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Are you allergic to dogs / cats?">{sel("allergic_to_pets", f.allergic_to_pets)}</Field>
              <Field label="Can you live with pets?">{sel("can_live_with_pets", f.can_live_with_pets)}</Field>
              <Field label="Do you smoke?">{sel("smoker", f.smoker)}</Field>
              <Field label="Can you live with people who smoke?">{sel("can_live_with_smokers", f.can_live_with_smokers)}</Field>
              <Field label="Can you live with other students?">{sel("can_live_with_students", f.can_live_with_students)}</Field>
              <Field label="Can you live with children in your homestay?">{sel("can_live_with_children", f.can_live_with_children)}</Field>
            </div>
            <div className="mt-4 space-y-4">
              <Field label="Do you have religious / cultural / personal beliefs your homestay should know about?">
                <textarea className={textareaCls} style={ring} value={f.beliefs} onChange={(e) => set("beliefs", e.target.value)} />
              </Field>
              <Field label="Any known allergies or special diet requirements">
                <textarea className={textareaCls} style={ring} value={f.dietary} onChange={(e) => set("dietary", e.target.value)} placeholder="Halal, vegetarian, nut allergy…" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Any food that you do not eat"><input className={inputCls} style={ring} value={f.food_avoided} onChange={(e) => set("food_avoided", e.target.value)} /></Field>
                <Field label="What are your hobbies?"><input className={inputCls} style={ring} value={f.hobbies} onChange={(e) => set("hobbies", e.target.value)} /></Field>
              </div>
              <Field label="Other requirements">
                <textarea className={textareaCls} style={ring} value={f.other_requirements} onChange={(e) => set("other_requirements", e.target.value)} />
              </Field>
              <Field label="Briefly introduce yourself to your host family">
                <textarea className={textareaCls} style={ring} value={f.self_introduction} onChange={(e) => set("self_introduction", e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Airport pickup */}
          <div>
            <SectionTitle>Airport pickup</SectionTitle>
            <p className="text-sm text-gray-500 mb-4">Melbourne Tullamarine Airport only.</p>
            <Field label="Airport pickup required?">
              <select className={inputCls + " bg-white"} style={ring} value={f.airport_pickup_option} onChange={(e) => set("airport_pickup_option", e.target.value)}>
                {AIRPORT_OPTIONS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            {airportRequired && (
              <div className="grid gap-4 sm:grid-cols-3 mt-4">
                <Field label="Arrival date"><input type="date" className={inputCls} style={ring} value={f.arrival_date} onChange={(e) => set("arrival_date", e.target.value)} /></Field>
                <Field label="Arrival time"><input type="time" className={inputCls} style={ring} value={f.arrival_time} onChange={(e) => set("arrival_time", e.target.value)} /></Field>
                <Field label="Flight no."><input className={inputCls} style={ring} value={f.flight_no} onChange={(e) => set("flight_no", e.target.value)} /></Field>
              </div>
            )}
          </div>

          {/* Emergency contact */}
          <div>
            <SectionTitle>Emergency contact</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name"><input className={inputCls} style={ring} value={f.ec_name} onChange={(e) => set("ec_name", e.target.value)} /></Field>
              <Field label="Relationship"><input className={inputCls} style={ring} value={f.ec_relationship} onChange={(e) => set("ec_relationship", e.target.value)} /></Field>
              <Field label="Contact number"><input className={inputCls} style={ring} value={f.ec_contact_no} onChange={(e) => set("ec_contact_no", e.target.value)} /></Field>
              <Field label="Email address"><input type="email" className={inputCls} style={ring} value={f.ec_email} onChange={(e) => set("ec_email", e.target.value)} /></Field>
            </div>
          </div>

          {/* Optional arrival support */}
          <div>
            <SectionTitle>Optional arrival support</SectionTitle>
            <div className="space-y-2">
              {[
                ["guardian_service", "Guardian service"],
                ["settlement_support", "Settlement support"],
              ].map(([k, label]) => (
                <label key={k} className="flex items-center gap-3 text-sm text-gray-700">
                  <input type="checkbox" checked={(f as any)[k]} onChange={(e) => set(k, e.target.checked)} className="h-4 w-4" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* T&C */}
          <div className="rounded-2xl border border-gray-100 p-6">
            <label className="flex items-start gap-3 text-sm text-gray-700">
              <input type="checkbox" checked={f.terms_accepted} onChange={(e) => set("terms_accepted", e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
              <span>I have read and agree to the <strong>Terms &amp; Conditions</strong>. I understand the next step is to e-sign this application{isMinor ? ", and that a guardian must co-sign" : ""}.</span>
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={submitting} className="w-full py-3 rounded-lg font-semibold text-white inline-flex items-center justify-center gap-2" style={{ backgroundColor: HS.brand }}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue to e-signature"}
          </button>
        </form>
      </section>
    </HomestayLayout>
  );
}

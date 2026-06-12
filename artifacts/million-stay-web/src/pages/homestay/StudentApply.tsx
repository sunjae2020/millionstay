import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, ShieldCheck } from "lucide-react";
import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero } from "@/components/homestay/sections";
import { HS, HS_FONT } from "@/lib/homestay-theme";
import { submitStudentApplication, type StudentApplicationInput } from "@/lib/students-api";

// 2.5 Apply Now — the online student application (Phase 3). On submit we create
// the request + a signing request, then send the applicant to /sign/:token to
// e-sign (the guardian co-signs for under-18s).
const STUDY_TYPES = ["Early schooling", "Short-term", "English", "Adult study"];
const MEAL_OPTIONS = ["Full board (all meals)", "Half board (breakfast & dinner)", "Dinner only", "No meals"];

const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2";
function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}{required && <span style={{ color: HS.brand }}> *</span>}</span>
      {children}
    </label>
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
    student_first_name: "", student_last_name: "", student_email: "", student_phone: "",
    date_of_birth: "", gender: "", nationality: "",
    guardian_name: "", guardian_email: "", guardian_phone: "", guardian_relationship: "",
    suburb: "", school: "", timetable: "", study_type: STUDY_TYPES[0], meals: MEAL_OPTIONS[0], dietary: "", environment: "",
    guardian_service: false, airport_pickup: false, settlement_support: false,
    terms_accepted: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const age = useMemo(() => ageFromDob(f.date_of_birth), [f.date_of_birth]);
  const isMinor = age != null && age < 18;

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
        suburb: f.suburb, school: f.school, timetable: f.timetable, study_type: f.study_type,
        meals: f.meals, dietary: f.dietary, environment: f.environment,
        addons: { guardian_service: f.guardian_service, airport_pickup: f.airport_pickup, settlement_support: f.settlement_support },
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

  const ring = { ["--tw-ring-color" as any]: HS.brand };

  return (
    <HomestayLayout title="Apply Now">
      <HsPageHero
        eyebrow="Students"
        title="Start your homestay application"
        lead={<p>Share your details, accept the Terms & Conditions, then e-sign. Our operations team reviews every application and matches by hand — never automatically.</p>}
      />
      <section className="max-w-3xl mx-auto px-5 py-12">
        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Student */}
          <div>
            <h2 className="text-xl font-bold mb-4" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>Student details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" required><input className={inputCls} style={ring} value={f.student_first_name} onChange={(e) => set("student_first_name", e.target.value)} /></Field>
              <Field label="Last name" required><input className={inputCls} style={ring} value={f.student_last_name} onChange={(e) => set("student_last_name", e.target.value)} /></Field>
              <Field label="Date of birth" required><input type="date" className={inputCls} style={ring} value={f.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} /></Field>
              <Field label="Nationality"><input className={inputCls} style={ring} value={f.nationality} onChange={(e) => set("nationality", e.target.value)} /></Field>
              <Field label="Email"><input type="email" className={inputCls} style={ring} value={f.student_email} onChange={(e) => set("student_email", e.target.value)} /></Field>
              <Field label="Phone"><input className={inputCls} style={ring} value={f.student_phone} onChange={(e) => set("student_phone", e.target.value)} /></Field>
              <Field label="Gender">
                <select className={inputCls + " bg-white"} style={ring} value={f.gender} onChange={(e) => set("gender", e.target.value)}>
                  <option value="">Prefer not to say</option><option>Female</option><option>Male</option><option>Other</option>
                </select>
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
              <p className="text-sm text-gray-600 mb-4">The student is under 18, so a parent or guardian must provide consent and co-sign the application.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Guardian name" required><input className={inputCls} style={ring} value={f.guardian_name} onChange={(e) => set("guardian_name", e.target.value)} /></Field>
                <Field label="Guardian email" required><input type="email" className={inputCls} style={ring} value={f.guardian_email} onChange={(e) => set("guardian_email", e.target.value)} /></Field>
                <Field label="Guardian phone"><input className={inputCls} style={ring} value={f.guardian_phone} onChange={(e) => set("guardian_phone", e.target.value)} /></Field>
                <Field label="Relationship"><input className={inputCls} style={ring} value={f.guardian_relationship} onChange={(e) => set("guardian_relationship", e.target.value)} placeholder="Parent, legal guardian…" /></Field>
              </div>
            </div>
          )}

          {/* Preferences */}
          <div>
            <h2 className="text-xl font-bold mb-4" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>Preferences</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Preferred region / suburb"><input className={inputCls} style={ring} value={f.suburb} onChange={(e) => set("suburb", e.target.value)} /></Field>
              <Field label="School / campus location"><input className={inputCls} style={ring} value={f.school} onChange={(e) => set("school", e.target.value)} /></Field>
              <Field label="Study type">
                <select className={inputCls + " bg-white"} style={ring} value={f.study_type} onChange={(e) => set("study_type", e.target.value)}>
                  {STUDY_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Meals">
                <select className={inputCls + " bg-white"} style={ring} value={f.meals} onChange={(e) => set("meals", e.target.value)}>
                  {MEAL_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Dietary needs / allergies"><input className={inputCls} style={ring} value={f.dietary} onChange={(e) => set("dietary", e.target.value)} placeholder="Halal, vegetarian, nut allergy…" /></Field>
              <Field label="Environment preferences"><input className={inputCls} style={ring} value={f.environment} onChange={(e) => set("environment", e.target.value)} placeholder="Non-smoking, pet-free…" /></Field>
            </div>
            <Field label="Timetable / start details">
              <input className={inputCls + " mt-1"} style={ring} value={f.timetable} onChange={(e) => set("timetable", e.target.value)} placeholder="Approx. start date, term, study hours" />
            </Field>
          </div>

          {/* Add-ons */}
          <div>
            <h2 className="text-xl font-bold mb-4" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>Optional arrival support</h2>
            <div className="space-y-2">
              {[
                ["guardian_service", "Guardian service"],
                ["airport_pickup", "Airport pickup"],
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

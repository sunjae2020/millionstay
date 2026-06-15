import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Loader2, ShieldCheck } from "lucide-react";
import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero } from "@/components/homestay/sections";
import { HS, HS_FONT } from "@/lib/homestay-theme";
import { HomestayTermsBody } from "@/lib/homestay-terms-content";
import { ScrollToAgree } from "@/components/ScrollToAgree";
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

// Display-label translation keys for the option VALUES above (values stay in
// English for the API; only the shown text is localised).
const ENGLISH_LEVEL_LABELS: Record<string, string> = {
  "Beginner": "english_level_beginner",
  "Elementary": "english_level_elementary",
  "Intermediate": "english_level_intermediate",
  "Upper-intermediate": "english_level_upper_intermediate",
  "Advanced": "english_level_advanced",
  "Native": "english_level_native",
};
const ROOM_TYPE_LABELS: Record<string, string> = {
  "Single room": "room_type_single",
  "Twin room": "room_type_twin",
};
// Unified product classification (values map directly to the DB enums in
// accommodation_options.ts so a booking can be created from the request as-is).
const STAY_TYPES = ["homestay", "homestay_self_board", "share"];
const STAY_TYPE_LABELS: Record<string, string> = {
  "homestay": "stay_type_homestay",            // 호스트 가정 + 식사
  "homestay_self_board": "stay_type_self_board", // 호스트 가정, 식사 미포함
  "share": "stay_type_share",                  // 호스트 없음, 숙소만
};
const SPACE_SHARINGS = ["entire_place", "house_share", "room_share"];
const SPACE_SHARING_LABELS: Record<string, string> = {
  "entire_place": "space_entire",   // 독채
  "house_share": "space_own_room",  // 독방 (공용공간 공유)
  "room_share": "space_room_share", // 룸 쉐어
};
const CONTRACT_TERM_OPTS = ["short_term", "mid_term", "long_term"];
const CONTRACT_TERM_LABELS: Record<string, string> = {
  "short_term": "term_short", // 단기
  "mid_term": "term_mid",     // 중기
  "long_term": "term_long",   // 장기
};
const MEAL_LABELS: Record<string, string> = {
  "Full board (all meals)": "meals_full_board",
  "Half board (breakfast & dinner)": "meals_half_board",
  "Dinner only": "meals_dinner_only",
  "No meals": "meals_none",
};
const AIRPORT_LABELS: Record<string, string> = {
  "Not required": "airport_not_required",
  "One way": "airport_one_way",
  "Return": "airport_return",
};
const YES_NO_LABELS: Record<string, string> = {
  "Yes": "yes_no_yes",
  "No": "yes_no_no",
};
const VISA_TYPES = ["Student Visa", "Working Holiday Visa", "Tourist Visa (ETA)", "Other"];
const SNS_TYPES = ["KakaoTalk", "LINE", "WeChat", "WhatsApp", "Instagram", "Facebook", "Other"];
const REFERRAL_SOURCES = ["Friend (Referral)", "Website", "Blog", "Instagram", "Kakao/Line Group", "Other"];
const VISA_LABELS: Record<string, string> = {
  "Student Visa": "visa_student",
  "Working Holiday Visa": "visa_working_holiday",
  "Tourist Visa (ETA)": "visa_tourist",
  "Other": "visa_other",
};
const SNS_LABELS: Record<string, string> = {
  "KakaoTalk": "sns_kakaotalk", "LINE": "sns_line", "WeChat": "sns_wechat",
  "WhatsApp": "sns_whatsapp", "Instagram": "sns_instagram", "Facebook": "sns_facebook", "Other": "sns_other",
};
const REFERRAL_LABELS: Record<string, string> = {
  "Friend (Referral)": "referral_friend", "Website": "referral_website", "Blog": "referral_blog",
  "Instagram": "referral_instagram", "Kakao/Line Group": "referral_kakao_line", "Other": "referral_other",
};

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
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [f, setF] = useState({
    // Personal
    student_first_name: "", student_last_name: "", student_email: "", student_phone: "",
    date_of_birth: "", gender: "", nationality: "", other_name: "",
    native_language: "", english_level: "", relationship_with_host: "", additional_comment: "",
    sns_type: "", sns_id: "", visa_type: "", referral_source: "",
    // Home country address
    addr_street: "", addr_street2: "", addr_city: "", addr_state: "", addr_postcode: "", addr_country: "",
    // Agent / staff
    uses_agent: "", agent_name: "", staff_name: "", staff_email: "", staff_contact: "",
    // Guardian (under 18)
    guardian_name: "", guardian_email: "", guardian_phone: "", guardian_relationship: "",
    // School
    school: "", course_name: "", course_start_date: "", campus_location: "",
    // Homestay
    stay_type: STAY_TYPES[0], space_sharing: "", contract_term: "",
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
      setError(t("homestay.student_apply.error_name_dob")); return;
    }
    if (age == null) { setError(t("homestay.student_apply.error_invalid_dob")); return; }
    if (isMinor && (!f.guardian_name || !f.guardian_email)) {
      setError(t("homestay.student_apply.error_guardian_required")); return;
    }
    if (!f.terms_accepted) { setError(t("homestay.student_apply.error_terms_required")); return; }

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
        stay_type: f.stay_type,
        space_sharing: f.space_sharing,
        contract_term: f.contract_term,
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
        other_name: f.other_name,
        referral_source: f.referral_source,
        visa_type: f.visa_type,
        sns: { type: f.sns_type, id: f.sns_id },
        home_address: {
          street: f.addr_street, street2: f.addr_street2, city: f.addr_city,
          state: f.addr_state, postcode: f.addr_postcode, country: f.addr_country,
        },
        agent: {
          uses_agent: f.uses_agent, agent_name: f.agent_name,
          staff_name: f.staff_name, staff_email: f.staff_email, staff_contact: f.staff_contact,
        },
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
      setError(err instanceof Error ? err.message : t("homestay.student_apply.error_submit_failed"));
      setSubmitting(false);
    }
  }

  const sel = (k: string, value: string) => (
    <select className={inputCls + " bg-white"} style={ring} value={value} onChange={(e) => set(k, e.target.value)}>
      <option value="">{t("homestay.student_apply.please_select")}</option>
      {YES_NO.map((o) => <option key={o} value={o}>{t(`homestay.student_apply.${YES_NO_LABELS[o]}`)}</option>)}
    </select>
  );

  const selectFrom = (k: string, value: string, values: string[], labels: Record<string, string>) => (
    <select className={inputCls + " bg-white"} style={ring} value={value} onChange={(e) => set(k, e.target.value)}>
      <option value="">{t("homestay.student_apply.please_select")}</option>
      {values.map((o) => <option key={o} value={o}>{t(`homestay.student_apply.${labels[o]}`)}</option>)}
    </select>
  );

  return (
    <HomestayLayout title={t("homestay.student_apply.page_title")}>
      <HsPageHero
        eyebrow={t("homestay.student_apply.eyebrow")}
        title={t("homestay.student_apply.hero_title")}
        lead={<p>{t("homestay.student_apply.hero_lead")}</p>}
      />
      <section className="max-w-3xl mx-auto px-5 py-12">
        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Student's personal information */}
          <div>
            <SectionTitle>{t("homestay.student_apply.section_personal")}</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("homestay.student_apply.label_family_name")} required><input className={inputCls} style={ring} value={f.student_last_name} onChange={(e) => set("student_last_name", e.target.value)} /></Field>
              <Field label={t("homestay.student_apply.label_given_name")} required><input className={inputCls} style={ring} value={f.student_first_name} onChange={(e) => set("student_first_name", e.target.value)} /></Field>
              <Field label={t("homestay.student_apply.label_other_name")}><input className={inputCls} style={ring} value={f.other_name} onChange={(e) => set("other_name", e.target.value)} /></Field>
              <Field label={t("homestay.student_apply.label_date_of_birth")} required><input type="date" className={inputCls} style={ring} value={f.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} /></Field>
              <Field label={t("homestay.student_apply.label_gender")}>
                <select className={inputCls + " bg-white"} style={ring} value={f.gender} onChange={(e) => set("gender", e.target.value)}>
                  <option value="">{t("homestay.student_apply.gender_prefer_not")}</option><option value="Female">{t("homestay.student_apply.gender_female")}</option><option value="Male">{t("homestay.student_apply.gender_male")}</option><option value="Other">{t("homestay.student_apply.gender_other")}</option>
                </select>
              </Field>
              <Field label={t("homestay.student_apply.label_nationality")}><input className={inputCls} style={ring} value={f.nationality} onChange={(e) => set("nationality", e.target.value)} /></Field>
              <Field label={t("homestay.student_apply.label_email")}><input type="email" className={inputCls} style={ring} value={f.student_email} onChange={(e) => set("student_email", e.target.value)} /></Field>
              <Field label={t("homestay.student_apply.label_phone")}><input className={inputCls} style={ring} value={f.student_phone} onChange={(e) => set("student_phone", e.target.value)} /></Field>
              <Field label={t("homestay.student_apply.label_native_language")}><input className={inputCls} style={ring} value={f.native_language} onChange={(e) => set("native_language", e.target.value)} /></Field>
              <Field label={t("homestay.student_apply.label_english_level")}>
                <select className={inputCls + " bg-white"} style={ring} value={f.english_level} onChange={(e) => set("english_level", e.target.value)}>
                  <option value="">{t("homestay.student_apply.please_select")}</option>
                  {ENGLISH_LEVELS.map((o) => <option key={o} value={o}>{t(`homestay.student_apply.${ENGLISH_LEVEL_LABELS[o]}`)}</option>)}
                </select>
              </Field>
              <Field label={t("homestay.student_apply.label_visa_type")}>{selectFrom("visa_type", f.visa_type, VISA_TYPES, VISA_LABELS)}</Field>
              <Field label={t("homestay.student_apply.label_referral_source")}>{selectFrom("referral_source", f.referral_source, REFERRAL_SOURCES, REFERRAL_LABELS)}</Field>
              <Field label={t("homestay.student_apply.label_sns_type")}>{selectFrom("sns_type", f.sns_type, SNS_TYPES, SNS_LABELS)}</Field>
              <Field label={t("homestay.student_apply.label_sns_id")}><input className={inputCls} style={ring} value={f.sns_id} onChange={(e) => set("sns_id", e.target.value)} /></Field>
            </div>
            <div className="mt-4 space-y-4">
              <Field label={t("homestay.student_apply.label_relationship_with_host")}>
                <input className={inputCls} style={ring} value={f.relationship_with_host} onChange={(e) => set("relationship_with_host", e.target.value)} placeholder={t("homestay.student_apply.placeholder_relationship_with_host")} />
              </Field>
              <Field label={t("homestay.student_apply.label_additional_comment")}>
                <textarea className={textareaCls} style={ring} value={f.additional_comment} onChange={(e) => set("additional_comment", e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Home country address */}
          <div>
            <SectionTitle>{t("homestay.student_apply.section_address")}</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("homestay.student_apply.label_addr_street")}><input className={inputCls} style={ring} value={f.addr_street} onChange={(e) => set("addr_street", e.target.value)} /></Field>
              <Field label={t("homestay.student_apply.label_addr_street2")}><input className={inputCls} style={ring} value={f.addr_street2} onChange={(e) => set("addr_street2", e.target.value)} /></Field>
              <Field label={t("homestay.student_apply.label_addr_city")}><input className={inputCls} style={ring} value={f.addr_city} onChange={(e) => set("addr_city", e.target.value)} /></Field>
              <Field label={t("homestay.student_apply.label_addr_state")}><input className={inputCls} style={ring} value={f.addr_state} onChange={(e) => set("addr_state", e.target.value)} /></Field>
              <Field label={t("homestay.student_apply.label_addr_postcode")}><input className={inputCls} style={ring} value={f.addr_postcode} onChange={(e) => set("addr_postcode", e.target.value)} /></Field>
              <Field label={t("homestay.student_apply.label_addr_country")}><input className={inputCls} style={ring} value={f.addr_country} onChange={(e) => set("addr_country", e.target.value)} /></Field>
            </div>
          </div>

          {/* Guardian (under 18) */}
          {isMinor && (
            <div className="rounded-2xl p-6" style={{ backgroundColor: HS.cream }}>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-5 h-5" style={{ color: HS.brand }} />
                <h2 className="text-lg font-bold" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>{t("homestay.student_apply.guardian_heading")}</h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">{t("homestay.student_apply.guardian_note")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("homestay.student_apply.label_guardian_name")} required><input className={inputCls} style={ring} value={f.guardian_name} onChange={(e) => set("guardian_name", e.target.value)} /></Field>
                <Field label={t("homestay.student_apply.label_guardian_email")} required><input type="email" className={inputCls} style={ring} value={f.guardian_email} onChange={(e) => set("guardian_email", e.target.value)} /></Field>
                <Field label={t("homestay.student_apply.label_guardian_phone")}><input className={inputCls} style={ring} value={f.guardian_phone} onChange={(e) => set("guardian_phone", e.target.value)} /></Field>
                <Field label={t("homestay.student_apply.label_guardian_relationship")}><input className={inputCls} style={ring} value={f.guardian_relationship} onChange={(e) => set("guardian_relationship", e.target.value)} placeholder={t("homestay.student_apply.placeholder_guardian_relationship")} /></Field>
              </div>
            </div>
          )}

          {/* School information */}
          <div>
            <SectionTitle>{t("homestay.student_apply.section_school")}</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("homestay.student_apply.label_school_name")}><input className={inputCls} style={ring} value={f.school} onChange={(e) => set("school", e.target.value)} /></Field>
              <Field label={t("homestay.student_apply.label_course_name")}><input className={inputCls} style={ring} value={f.course_name} onChange={(e) => set("course_name", e.target.value)} /></Field>
              <Field label={t("homestay.student_apply.label_course_start_date")}><input type="date" className={inputCls} style={ring} value={f.course_start_date} onChange={(e) => set("course_start_date", e.target.value)} /></Field>
              <Field label={t("homestay.student_apply.label_campus_location")}><input className={inputCls} style={ring} value={f.campus_location} onChange={(e) => set("campus_location", e.target.value)} /></Field>
            </div>
          </div>

          {/* Homestay information */}
          <div>
            <SectionTitle>{t("homestay.student_apply.section_homestay")}</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("homestay.student_apply.label_stay_type")} hint={t("homestay.student_apply.hint_stay_type")}>
                <select className={inputCls + " bg-white"} style={ring} value={f.stay_type} onChange={(e) => set("stay_type", e.target.value)}>
                  {STAY_TYPES.map((o) => <option key={o} value={o}>{t(`homestay.student_apply.${STAY_TYPE_LABELS[o]}`)}</option>)}
                </select>
              </Field>
              <Field label={t("homestay.student_apply.label_contract_term")}>
                <select className={inputCls + " bg-white"} style={ring} value={f.contract_term} onChange={(e) => set("contract_term", e.target.value)}>
                  <option value="">{t("homestay.student_apply.please_select")}</option>
                  {CONTRACT_TERM_OPTS.map((o) => <option key={o} value={o}>{t(`homestay.student_apply.${CONTRACT_TERM_LABELS[o]}`)}</option>)}
                </select>
              </Field>
              <Field label={t("homestay.student_apply.label_space_sharing")} hint={t("homestay.student_apply.hint_space_sharing")}>
                <select className={inputCls + " bg-white"} style={ring} value={f.space_sharing} onChange={(e) => set("space_sharing", e.target.value)}>
                  <option value="">{t("homestay.student_apply.please_select")}</option>
                  {SPACE_SHARINGS.map((o) => <option key={o} value={o}>{t(`homestay.student_apply.${SPACE_SHARING_LABELS[o]}`)}</option>)}
                </select>
              </Field>
              <Field label={t("homestay.student_apply.label_homestay_start_date")}><input type="date" className={inputCls} style={ring} value={f.homestay_start_date} onChange={(e) => set("homestay_start_date", e.target.value)} /></Field>
              <Field label={t("homestay.student_apply.label_duration")} hint={t("homestay.student_apply.hint_duration")}><input type="number" min={4} className={inputCls} style={ring} value={f.duration_weeks} onChange={(e) => set("duration_weeks", e.target.value)} placeholder={t("homestay.student_apply.placeholder_duration")} /></Field>
              <Field label={t("homestay.student_apply.label_room_preference")}>
                <select className={inputCls + " bg-white"} style={ring} value={f.room_type} onChange={(e) => set("room_type", e.target.value)}>
                  {ROOM_TYPES.map((o) => <option key={o} value={o}>{t(`homestay.student_apply.${ROOM_TYPE_LABELS[o]}`)}</option>)}
                </select>
              </Field>
              <Field label={t("homestay.student_apply.label_meals")}>
                <select className={inputCls + " bg-white"} style={ring} value={f.meals} onChange={(e) => set("meals", e.target.value)}>
                  {MEAL_OPTIONS.map((o) => <option key={o} value={o}>{t(`homestay.student_apply.${MEAL_LABELS[o]}`)}</option>)}
                </select>
              </Field>
              <Field label={t("homestay.student_apply.label_allergic_to_pets")}>{sel("allergic_to_pets", f.allergic_to_pets)}</Field>
              <Field label={t("homestay.student_apply.label_can_live_with_pets")}>{sel("can_live_with_pets", f.can_live_with_pets)}</Field>
              <Field label={t("homestay.student_apply.label_do_you_smoke")}>{sel("smoker", f.smoker)}</Field>
              <Field label={t("homestay.student_apply.label_can_live_with_smokers")}>{sel("can_live_with_smokers", f.can_live_with_smokers)}</Field>
              <Field label={t("homestay.student_apply.label_can_live_with_students")}>{sel("can_live_with_students", f.can_live_with_students)}</Field>
              <Field label={t("homestay.student_apply.label_can_live_with_children")}>{sel("can_live_with_children", f.can_live_with_children)}</Field>
            </div>
            <div className="mt-4 space-y-4">
              <Field label={t("homestay.student_apply.label_beliefs")}>
                <textarea className={textareaCls} style={ring} value={f.beliefs} onChange={(e) => set("beliefs", e.target.value)} />
              </Field>
              <Field label={t("homestay.student_apply.label_dietary")}>
                <textarea className={textareaCls} style={ring} value={f.dietary} onChange={(e) => set("dietary", e.target.value)} placeholder={t("homestay.student_apply.placeholder_dietary")} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("homestay.student_apply.label_food_avoided")}><input className={inputCls} style={ring} value={f.food_avoided} onChange={(e) => set("food_avoided", e.target.value)} /></Field>
                <Field label={t("homestay.student_apply.label_hobbies")}><input className={inputCls} style={ring} value={f.hobbies} onChange={(e) => set("hobbies", e.target.value)} /></Field>
              </div>
              <Field label={t("homestay.student_apply.label_other_requirements")}>
                <textarea className={textareaCls} style={ring} value={f.other_requirements} onChange={(e) => set("other_requirements", e.target.value)} />
              </Field>
              <Field label={t("homestay.student_apply.label_self_introduction")}>
                <textarea className={textareaCls} style={ring} value={f.self_introduction} onChange={(e) => set("self_introduction", e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Airport pickup */}
          <div>
            <SectionTitle>{t("homestay.student_apply.section_airport")}</SectionTitle>
            <p className="text-sm text-gray-500 mb-4">{t("homestay.student_apply.airport_note")}</p>
            <Field label={t("homestay.student_apply.label_airport_required")}>
              <select className={inputCls + " bg-white"} style={ring} value={f.airport_pickup_option} onChange={(e) => set("airport_pickup_option", e.target.value)}>
                {AIRPORT_OPTIONS.map((o) => <option key={o} value={o}>{t(`homestay.student_apply.${AIRPORT_LABELS[o]}`)}</option>)}
              </select>
            </Field>
            {airportRequired && (
              <div className="grid gap-4 sm:grid-cols-3 mt-4">
                <Field label={t("homestay.student_apply.label_arrival_date")}><input type="date" className={inputCls} style={ring} value={f.arrival_date} onChange={(e) => set("arrival_date", e.target.value)} /></Field>
                <Field label={t("homestay.student_apply.label_arrival_time")}><input type="time" className={inputCls} style={ring} value={f.arrival_time} onChange={(e) => set("arrival_time", e.target.value)} /></Field>
                <Field label={t("homestay.student_apply.label_flight_no")}><input className={inputCls} style={ring} value={f.flight_no} onChange={(e) => set("flight_no", e.target.value)} /></Field>
              </div>
            )}
          </div>

          {/* Emergency contact */}
          <div>
            <SectionTitle>{t("homestay.student_apply.section_emergency")}</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("homestay.student_apply.label_ec_name")}><input className={inputCls} style={ring} value={f.ec_name} onChange={(e) => set("ec_name", e.target.value)} /></Field>
              <Field label={t("homestay.student_apply.label_ec_relationship")}><input className={inputCls} style={ring} value={f.ec_relationship} onChange={(e) => set("ec_relationship", e.target.value)} /></Field>
              <Field label={t("homestay.student_apply.label_ec_contact_no")}><input className={inputCls} style={ring} value={f.ec_contact_no} onChange={(e) => set("ec_contact_no", e.target.value)} /></Field>
              <Field label={t("homestay.student_apply.label_ec_email")}><input type="email" className={inputCls} style={ring} value={f.ec_email} onChange={(e) => set("ec_email", e.target.value)} /></Field>
            </div>
          </div>

          {/* Optional arrival support */}
          <div>
            <SectionTitle>{t("homestay.student_apply.section_arrival_support")}</SectionTitle>
            <div className="space-y-2">
              {[
                ["guardian_service", t("homestay.student_apply.addon_guardian_service")],
                ["settlement_support", t("homestay.student_apply.addon_settlement_support")],
              ].map(([k, label]) => (
                <label key={k} className="flex items-center gap-3 text-sm text-gray-700">
                  <input type="checkbox" checked={(f as any)[k]} onChange={(e) => set(k, e.target.checked)} className="h-4 w-4" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Agent / staff */}
          <div>
            <SectionTitle>{t("homestay.student_apply.section_agent")}</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("homestay.student_apply.label_uses_agent")}>{sel("uses_agent", f.uses_agent)}</Field>
            </div>
            {f.uses_agent === "Yes" && (
              <div className="grid gap-4 sm:grid-cols-2 mt-4">
                <Field label={t("homestay.student_apply.label_agent_name")}><input className={inputCls} style={ring} value={f.agent_name} onChange={(e) => set("agent_name", e.target.value)} /></Field>
                <Field label={t("homestay.student_apply.label_staff_name")}><input className={inputCls} style={ring} value={f.staff_name} onChange={(e) => set("staff_name", e.target.value)} /></Field>
                <Field label={t("homestay.student_apply.label_staff_email")}><input type="email" className={inputCls} style={ring} value={f.staff_email} onChange={(e) => set("staff_email", e.target.value)} /></Field>
                <Field label={t("homestay.student_apply.label_staff_contact")}><input className={inputCls} style={ring} value={f.staff_contact} onChange={(e) => set("staff_contact", e.target.value)} /></Field>
              </div>
            )}
          </div>

          {/* Collection & sensitive-information consent notice (APP 5 / APP 3.3) */}
          <div className="rounded-lg border p-4 text-sm text-gray-600 leading-relaxed" style={{ borderColor: HS.brand + "33", backgroundColor: HS.cream }}>
            <p>
              {t("homestay.student_apply.consent_notice")}
            </p>
            <p className="mt-2">
              {t("homestay.student_apply.consent_privacy_prefix")}{" "}
              <a href="/homestay/privacy" className="underline" style={{ color: HS.brand }}>{t("homestay.student_apply.consent_privacy_link")}</a>.
            </p>
          </div>

          {/* T&C */}
          <div>
            <SectionTitle>{t("homestay.student_apply.section_terms")}</SectionTitle>
            <ScrollToAgree
              accent={HS.brand}
              checked={f.terms_accepted}
              onChange={(v) => set("terms_accepted", v)}
              label={isMinor ? t("homestay.student_apply.terms_agree_label_minor") : t("homestay.student_apply.terms_agree_label")}
            >
              <HomestayTermsBody />
            </ScrollToAgree>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={submitting} className="w-full py-3 rounded-lg font-semibold text-white inline-flex items-center justify-center gap-2" style={{ backgroundColor: HS.brand }}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t("homestay.student_apply.submit_continue")}
          </button>
        </form>
      </section>
    </HomestayLayout>
  );
}

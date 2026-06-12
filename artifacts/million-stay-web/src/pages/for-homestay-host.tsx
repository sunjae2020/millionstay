import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import {
  ChevronRight, ChevronLeft, Plus, Trash2, Eye, EyeOff, Lock,
  AlertCircle, Home as HomeIcon, Save,
} from "lucide-react";
import {
  submitHostApplication, saveDraftApplication, setHomestayToken, HomestayApiError,
  type HomestayResident, type HomestayRoom,
} from "@/lib/homestay-api";

// ─── Option constants ─────────────────────────────────────────────────────────
const GENDERS = ["Male", "Female", "Other"];
const HEARD_ABOUT = ["Google", "Advertising", "Social media", "Friends", "Word of mouth", "Other"];
const BUILDING_TYPES = ["House", "Townhouse", "Apartment", "Other"];
const HOME_FEATURES = ["Pool", "Gym", "Carpet", "No Carpet"];
const BED_TYPES = ["Single", "Double", "Queen", "King", "Bunk", "Twin Single", "Triple", "King Single", "Independent Living"];
const BATH_TYPES = ["Shared", "Own", "Ensuite"];
const STUDENT_GENDERS = ["Male", "Female", "Either"];
const STUDENT_AGES = ["Over 18", "Under 18", "Either"];
const PACKAGES = ["full_board", "partial_board", "dinner_only", "no_meals"];
const DIETARY = ["Halal", "Vegetarian", "Vegan", "Kosher", "Gluten Free", "Other"];

const COUNTRIES = [
  "Australia", "South Korea", "China", "Japan", "Vietnam", "India", "Philippines",
  "Indonesia", "Malaysia", "Thailand", "Hong Kong", "Taiwan", "Singapore",
  "United Kingdom", "United States", "Canada", "New Zealand", "Other",
];

const TOTAL_STEPS = 7;

function emptyResident(): HomestayResident { return { name: "", age: "", gender: "", relationship: "" }; }
function emptyRoom(): HomestayRoom { return { name: "", bed_type: "", bath_type: "", has_lock: false, comments: "" }; }

// ─── Small reusable field controls ────────────────────────────────────────────
const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white";
const labelCls = "block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}{required && " *"}</label>
      {children}
    </div>
  );
}

function YesNoToggle({ value, onChange, yes, no }: { value: boolean; onChange: (v: boolean) => void; yes: string; no: string }) {
  return (
    <div className="inline-flex rounded-xl border border-gray-200 overflow-hidden">
      <button type="button" onClick={() => onChange(true)}
        className={`px-4 py-2 text-sm font-medium transition-colors ${value ? "bg-primary text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{yes}</button>
      <button type="button" onClick={() => onChange(false)}
        className={`px-4 py-2 text-sm font-medium transition-colors ${!value ? "bg-primary text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{no}</button>
    </div>
  );
}

function MultiChip({ options, selected, onToggle, label }: { options: string[]; selected: string[]; onToggle: (v: string) => void; label: (v: string) => string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button key={o} type="button" onClick={() => onToggle(o)}
            className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors ${on ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200 hover:border-primary/40"}`}>
            {label(o)}
          </button>
        );
      })}
    </div>
  );
}

export default function ForHomestayHost() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailExists, setEmailExists] = useState(false);

  // ─── Form state ───────────────────────────────────────────────────────────
  const [f, setF] = useState({
    // Step 1
    first_name: "", last_name: "", email: "", password: "", phone: "",
    date_of_birth: "", gender: "", nationality: "", cultural_background: "",
    address: "", suburb: "", heard_about: "",
    // Step 2
    residents: [emptyResident()] as HomestayResident[],
    smoking_in_home: false, smoke_outside_allowed: false,
    drink_in_home: false, guest_drink_allowed: false,
    has_pets: false, pet_types: "", pet_notes: "",
    // Step 3
    building_type: "", home_features: [] as string[],
    rooms: [emptyRoom()] as HomestayRoom[],
    // Step 4
    pref_student_gender: "", pref_student_age: "", host_under_18: false,
    packages_offered: [] as string[], dietary: [] as string[], dietary_notes: "",
    // Step 5
    welcome_message: "", profile_description: "",
    // Step 6
    emergency_contact: { name: "", relationship: "", phone: "", email: "" },
    host_referral: { heard_about: "", referred_by_host: false, referrer_name: "" },
    // Step 7
    agreement_accepted: false, signature_name: "",
  });

  const set = <K extends keyof typeof f>(key: K, val: (typeof f)[K]) => setF((p) => ({ ...p, [key]: val }));

  const toggleArr = (key: "home_features" | "packages_offered" | "dietary", val: string) =>
    setF((p) => {
      const arr = p[key];
      return { ...p, [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] };
    });

  // ─── Password strength (same rules as register.tsx) ─────────────────────────
  const pwChecks = {
    min: f.password.length >= 12,
    lower: /[a-z]/.test(f.password),
    upper: /[A-Z]/.test(f.password),
    digit: /[0-9]/.test(f.password),
    special: /[^A-Za-z0-9]/.test(f.password),
  };
  const pwValid = Object.values(pwChecks).every(Boolean);

  // ─── Per-step validation ────────────────────────────────────────────────────
  function stepValid(s: number): boolean {
    switch (s) {
      case 1:
        return !!(f.first_name && f.last_name && f.email && pwValid && f.phone &&
          f.date_of_birth && f.gender && f.nationality && f.address && f.suburb && f.heard_about);
      case 2:
        return f.residents.every((r) => r.name && r.age && r.gender && r.relationship);
      case 3:
        return !!f.building_type && f.rooms.every((r) => r.name && r.bed_type && r.bath_type);
      case 4:
        return !!(f.pref_student_gender && f.pref_student_age && f.packages_offered.length > 0);
      case 5:
        return !!(f.welcome_message && f.profile_description);
      case 6:
        return !!(f.emergency_contact.name && f.emergency_contact.phone);
      case 7:
        return f.agreement_accepted && !!f.signature_name;
      default:
        return true;
    }
  }

  const next = () => { if (stepValid(step)) { setStep((s) => Math.min(TOTAL_STEPS, s + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); } };
  const back = () => { setStep((s) => Math.max(1, s - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const handleSubmit = async () => {
    if (!stepValid(7)) return;
    setError(null); setEmailExists(false); setSubmitting(true);
    try {
      const res = await submitHostApplication({ ...f });
      setHomestayToken(res.token);
      setLocation("/host-portal");
    } catch (err) {
      if (err instanceof HomestayApiError && err.status === 409) {
        setEmailExists(true);
      } else {
        setError(err instanceof Error ? err.message : t("homestay.apply.submit_failed"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // A draft still needs the core credentials (email + valid password) so the host
  // can log back in to finish later. The agreement is NOT required for a draft.
  const draftValid = !!(f.first_name && f.last_name && f.email && pwValid);

  const handleSaveDraft = async () => {
    if (!draftValid) {
      setError(t("homestay.apply.draft_needs_login"));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setError(null); setEmailExists(false); setSavingDraft(true);
    try {
      const res = await saveDraftApplication({ ...f });
      setHomestayToken(res.token);
      setLocation("/host-portal?draft=saved");
    } catch (err) {
      if (err instanceof HomestayApiError && err.status === 409) {
        setEmailExists(true);
      } else {
        setError(err instanceof Error ? err.message : t("homestay.apply.draft_failed"));
      }
    } finally {
      setSavingDraft(false);
    }
  };

  // ─── Repeatable row helpers ─────────────────────────────────────────────────
  const updateResident = (i: number, patch: Partial<HomestayResident>) =>
    set("residents", f.residents.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const updateRoom = (i: number, patch: Partial<HomestayRoom>) =>
    set("rooms", f.rooms.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const STEP_TITLES = [
    "homestay.apply.step1_title", "homestay.apply.step2_title", "homestay.apply.step3_title",
    "homestay.apply.step4_title", "homestay.apply.step5_title", "homestay.apply.step6_title",
    "homestay.apply.step7_title",
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* Hero */}
      <div className="relative overflow-hidden shrink-0" style={{ height: "200px" }}>
        <img
          src="https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1920&q=80"
          alt="Become a homestay host"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/60" />
        <div className="absolute inset-0 flex flex-col items-start justify-end px-8 pb-8 max-w-5xl mx-auto w-full">
          <p className="font-cursive text-white/75 text-lg italic mb-1">{t("homestay.apply.hero_tagline")}</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white italic">{t("homestay.apply.hero_title")}</h1>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="max-w-5xl mx-auto w-full px-6 py-3 flex items-center gap-1.5 text-xs text-gray-400">
        <Link href="/" className="hover:text-primary transition-colors">{t("homestay.apply.breadcrumb_home")}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-600 font-medium">{t("homestay.apply.breadcrumb")}</span>
      </div>

      <section className="max-w-3xl mx-auto w-full px-6 py-8">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-800">{t(STEP_TITLES[step - 1]!)}</p>
            <p className="text-xs text-gray-400">{t("homestay.apply.step_of", { current: step, total: TOTAL_STEPS })}</p>
          </div>
          <Progress value={(step / TOTAL_STEPS) * 100} />
        </div>

        <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl border border-orange-100 shadow-sm p-6 sm:p-8 space-y-5">

          {/* ── Step 1: Host Information ── */}
          {step === 1 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label={t("homestay.apply.first_name")} required>
                  <Input value={f.first_name} onChange={(e) => set("first_name", e.target.value)} className="h-11" />
                </Field>
                <Field label={t("homestay.apply.last_name")} required>
                  <Input value={f.last_name} onChange={(e) => set("last_name", e.target.value)} className="h-11" />
                </Field>
                <Field label={t("homestay.apply.email")} required>
                  <Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} className="h-11" />
                </Field>
                <Field label={t("homestay.apply.phone")} required>
                  <Input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+61 4XX XXX XXX" className="h-11" />
                </Field>
              </div>

              <Field label={t("homestay.apply.password")} required>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input type={showPw ? "text" : "password"} value={f.password} onChange={(e) => set("password", e.target.value)}
                    className="pl-9 pr-10 h-11" placeholder={t("homestay.apply.password_placeholder")} />
                  <button type="button" onClick={() => setShowPw(!showPw)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {f.password.length > 0 && !pwValid && (
                  <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {([["min", "pw_min"], ["upper", "pw_upper"], ["lower", "pw_lower"], ["digit", "pw_digit"], ["special", "pw_special"]] as const).map(([k, key]) => (
                      <li key={k} className={pwChecks[k] ? "text-green-600" : "text-gray-400"}>
                        {pwChecks[k] ? "✓" : "○"} {t(`homestay.apply.${key}`)}
                      </li>
                    ))}
                  </ul>
                )}
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label={t("homestay.apply.date_of_birth")} required>
                  <Input type="date" value={f.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} className="h-11" />
                </Field>
                <Field label={t("homestay.apply.gender")} required>
                  <select value={f.gender} onChange={(e) => set("gender", e.target.value)} className={inputCls + " h-11"}>
                    <option value="">{t("homestay.apply.select")}</option>
                    {GENDERS.map((g) => <option key={g} value={g}>{t(`homestay.opt.gender.${g}`)}</option>)}
                  </select>
                </Field>
                <Field label={t("homestay.apply.nationality")} required>
                  <select value={f.nationality} onChange={(e) => set("nationality", e.target.value)} className={inputCls + " h-11"}>
                    <option value="">{t("homestay.apply.select")}</option>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label={t("homestay.apply.cultural_background")}>
                  <Input value={f.cultural_background} onChange={(e) => set("cultural_background", e.target.value)} className="h-11" />
                </Field>
                <Field label={t("homestay.apply.address")} required>
                  <Input value={f.address} onChange={(e) => set("address", e.target.value)} className="h-11" />
                </Field>
                <Field label={t("homestay.apply.suburb")} required>
                  <Input value={f.suburb} onChange={(e) => set("suburb", e.target.value)} className="h-11" />
                </Field>
              </div>
              <Field label={t("homestay.apply.heard_about")} required>
                <select value={f.heard_about} onChange={(e) => set("heard_about", e.target.value)} className={inputCls + " h-11"}>
                  <option value="">{t("homestay.apply.select")}</option>
                  {HEARD_ABOUT.map((h) => <option key={h} value={h}>{t(`homestay.opt.heard.${h}`)}</option>)}
                </select>
              </Field>
            </>
          )}

          {/* ── Step 2: Household ── */}
          {step === 2 && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-gray-800">{t("homestay.apply.residents_title")}</h3>
                  <Button type="button" variant="outline" size="sm" onClick={() => set("residents", [...f.residents, emptyResident()])}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> {t("homestay.apply.add_resident")}
                  </Button>
                </div>
                <p className="text-xs text-amber-600 mb-3 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> {t("homestay.apply.wwcc_note")}
                </p>
                <div className="space-y-3">
                  {f.residents.map((r, i) => (
                    <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end bg-gray-50 rounded-xl p-3">
                      <div className="sm:col-span-4">
                        <label className="block text-[11px] text-gray-500 mb-1">{t("homestay.apply.res_name")}</label>
                        <Input value={r.name} onChange={(e) => updateResident(i, { name: e.target.value })} className="h-10" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] text-gray-500 mb-1">{t("homestay.apply.res_age")}</label>
                        <Input value={r.age} onChange={(e) => updateResident(i, { age: e.target.value })} className="h-10" />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] text-gray-500 mb-1">{t("homestay.apply.res_gender")}</label>
                        <select value={r.gender} onChange={(e) => updateResident(i, { gender: e.target.value })} className={inputCls + " h-10 px-3"}>
                          <option value="">{t("homestay.apply.select")}</option>
                          {GENDERS.map((g) => <option key={g} value={g}>{t(`homestay.opt.gender.${g}`)}</option>)}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] text-gray-500 mb-1">{t("homestay.apply.res_relationship")}</label>
                        <Input value={r.relationship} onChange={(e) => updateResident(i, { relationship: e.target.value })} className="h-10" />
                      </div>
                      <div className="sm:col-span-1 flex justify-end">
                        {f.residents.length > 1 && (
                          <button type="button" onClick={() => set("residents", f.residents.filter((_, idx) => idx !== i))}
                            className="p-2 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <Field label={t("homestay.apply.smoking_in_home")}>
                  <YesNoToggle value={f.smoking_in_home} onChange={(v) => set("smoking_in_home", v)} yes={t("homestay.apply.yes")} no={t("homestay.apply.no")} />
                </Field>
                <Field label={t("homestay.apply.smoke_outside_allowed")}>
                  <YesNoToggle value={f.smoke_outside_allowed} onChange={(v) => set("smoke_outside_allowed", v)} yes={t("homestay.apply.yes")} no={t("homestay.apply.no")} />
                </Field>
                <Field label={t("homestay.apply.drink_in_home")}>
                  <YesNoToggle value={f.drink_in_home} onChange={(v) => set("drink_in_home", v)} yes={t("homestay.apply.yes")} no={t("homestay.apply.no")} />
                </Field>
                <Field label={t("homestay.apply.guest_drink_allowed")}>
                  <YesNoToggle value={f.guest_drink_allowed} onChange={(v) => set("guest_drink_allowed", v)} yes={t("homestay.apply.yes")} no={t("homestay.apply.no")} />
                </Field>
                <Field label={t("homestay.apply.has_pets")}>
                  <YesNoToggle value={f.has_pets} onChange={(v) => set("has_pets", v)} yes={t("homestay.apply.yes")} no={t("homestay.apply.no")} />
                </Field>
              </div>
              {f.has_pets && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={t("homestay.apply.pet_types")}>
                    <Input value={f.pet_types} onChange={(e) => set("pet_types", e.target.value)} className="h-11" />
                  </Field>
                  <Field label={t("homestay.apply.pet_notes")}>
                    <Input value={f.pet_notes} onChange={(e) => set("pet_notes", e.target.value)} className="h-11" />
                  </Field>
                </div>
              )}
            </>
          )}

          {/* ── Step 3: Home & Rooms ── */}
          {step === 3 && (
            <>
              <Field label={t("homestay.apply.building_type")} required>
                <select value={f.building_type} onChange={(e) => set("building_type", e.target.value)} className={inputCls + " h-11"}>
                  <option value="">{t("homestay.apply.select")}</option>
                  {BUILDING_TYPES.map((b) => <option key={b} value={b}>{t(`homestay.opt.building.${b}`)}</option>)}
                </select>
              </Field>
              <Field label={t("homestay.apply.home_features")}>
                <MultiChip options={HOME_FEATURES} selected={f.home_features} onToggle={(v) => toggleArr("home_features", v)}
                  label={(v) => t(`homestay.opt.feature.${v}`)} />
              </Field>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">{t("homestay.apply.rooms_title")}</h3>
                  <Button type="button" variant="outline" size="sm" onClick={() => set("rooms", [...f.rooms, emptyRoom()])}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> {t("homestay.apply.add_room")}
                  </Button>
                </div>
                <div className="space-y-3">
                  {f.rooms.map((r, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-500">{t("homestay.apply.room_n", { n: i + 1 })}</span>
                        {f.rooms.length > 1 && (
                          <button type="button" onClick={() => set("rooms", f.rooms.filter((_, idx) => idx !== i))}
                            className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-1">{t("homestay.apply.room_name")}</label>
                          <Input value={r.name} onChange={(e) => updateRoom(i, { name: e.target.value })} className="h-10" />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-1">{t("homestay.apply.bed_type")}</label>
                          <select value={r.bed_type} onChange={(e) => updateRoom(i, { bed_type: e.target.value })} className={inputCls + " h-10 px-3"}>
                            <option value="">{t("homestay.apply.select")}</option>
                            {BED_TYPES.map((b) => <option key={b} value={b}>{t(`homestay.opt.bed.${b}`)}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-1">{t("homestay.apply.bath_type")}</label>
                          <select value={r.bath_type} onChange={(e) => updateRoom(i, { bath_type: e.target.value })} className={inputCls + " h-10 px-3"}>
                            <option value="">{t("homestay.apply.select")}</option>
                            {BATH_TYPES.map((b) => <option key={b} value={b}>{t(`homestay.opt.bath.${b}`)}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id={`lock-${i}`} checked={r.has_lock} onChange={(e) => updateRoom(i, { has_lock: e.target.checked })}
                          className="h-4 w-4 accent-primary" />
                        <label htmlFor={`lock-${i}`} className="text-sm text-gray-600">{t("homestay.apply.has_lock")}</label>
                      </div>
                      <Input value={r.comments} onChange={(e) => updateRoom(i, { comments: e.target.value })}
                        placeholder={t("homestay.apply.room_comments")} className="h-10" />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Step 4: Students & Packages ── */}
          {step === 4 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label={t("homestay.apply.pref_student_gender")} required>
                  <select value={f.pref_student_gender} onChange={(e) => set("pref_student_gender", e.target.value)} className={inputCls + " h-11"}>
                    <option value="">{t("homestay.apply.select")}</option>
                    {STUDENT_GENDERS.map((g) => <option key={g} value={g}>{t(`homestay.opt.student_gender.${g}`)}</option>)}
                  </select>
                </Field>
                <Field label={t("homestay.apply.pref_student_age")} required>
                  <select value={f.pref_student_age} onChange={(e) => set("pref_student_age", e.target.value)} className={inputCls + " h-11"}>
                    <option value="">{t("homestay.apply.select")}</option>
                    {STUDENT_AGES.map((a) => <option key={a} value={a}>{t(`homestay.opt.student_age.${a}`)}</option>)}
                  </select>
                </Field>
              </div>
              <Field label={t("homestay.apply.host_under_18")}>
                <YesNoToggle value={f.host_under_18} onChange={(v) => set("host_under_18", v)} yes={t("homestay.apply.yes")} no={t("homestay.apply.no")} />
                {f.host_under_18 && <p className="text-xs text-amber-600 mt-2 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> {t("homestay.apply.wwcc_under18")}</p>}
              </Field>

              <Field label={t("homestay.apply.packages_offered")} required>
                <div className="space-y-2">
                  {PACKAGES.map((p) => {
                    const on = f.packages_offered.includes(p);
                    return (
                      <button key={p} type="button" onClick={() => toggleArr("packages_offered", p)}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${on ? "border-primary bg-orange-50" : "border-gray-200 hover:border-primary/40"}`}>
                        <div className="flex items-center gap-2">
                          <span className={`h-4 w-4 rounded border flex items-center justify-center text-[10px] ${on ? "bg-primary border-primary text-white" : "border-gray-300"}`}>{on ? "✓" : ""}</span>
                          <span className="font-medium text-sm text-gray-800">{t(`homestay.opt.package.${p}`)}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 ml-6">{t(`homestay.opt.package_desc.${p}`)}</p>
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label={t("homestay.apply.dietary")}>
                <MultiChip options={DIETARY} selected={f.dietary} onToggle={(v) => toggleArr("dietary", v)} label={(v) => t(`homestay.opt.dietary.${v}`)} />
              </Field>
              <Field label={t("homestay.apply.dietary_notes")}>
                <Input value={f.dietary_notes} onChange={(e) => set("dietary_notes", e.target.value)} className="h-11" />
              </Field>
            </>
          )}

          {/* ── Step 5: Profile ── */}
          {step === 5 && (
            <>
              <Field label={t("homestay.apply.welcome_message")} required>
                <Textarea rows={4} value={f.welcome_message} onChange={(e) => set("welcome_message", e.target.value)} placeholder={t("homestay.apply.welcome_placeholder")} />
              </Field>
              <Field label={t("homestay.apply.profile_description")} required>
                <Textarea rows={6} value={f.profile_description} onChange={(e) => set("profile_description", e.target.value)} placeholder={t("homestay.apply.profile_placeholder")} />
              </Field>
            </>
          )}

          {/* ── Step 6: Contacts ── */}
          {step === 6 && (
            <>
              <h3 className="font-semibold text-gray-800">{t("homestay.apply.emergency_title")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label={t("homestay.apply.ec_name")} required>
                  <Input value={f.emergency_contact.name} onChange={(e) => set("emergency_contact", { ...f.emergency_contact, name: e.target.value })} className="h-11" />
                </Field>
                <Field label={t("homestay.apply.ec_relationship")}>
                  <Input value={f.emergency_contact.relationship} onChange={(e) => set("emergency_contact", { ...f.emergency_contact, relationship: e.target.value })} className="h-11" />
                </Field>
                <Field label={t("homestay.apply.ec_phone")} required>
                  <Input value={f.emergency_contact.phone} onChange={(e) => set("emergency_contact", { ...f.emergency_contact, phone: e.target.value })} className="h-11" />
                </Field>
                <Field label={t("homestay.apply.ec_email")}>
                  <Input type="email" value={f.emergency_contact.email} onChange={(e) => set("emergency_contact", { ...f.emergency_contact, email: e.target.value })} className="h-11" />
                </Field>
              </div>

              <h3 className="font-semibold text-gray-800 pt-2">{t("homestay.apply.referral_title")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label={t("homestay.apply.ref_heard_about")}>
                  <select value={f.host_referral.heard_about} onChange={(e) => set("host_referral", { ...f.host_referral, heard_about: e.target.value })} className={inputCls + " h-11"}>
                    <option value="">{t("homestay.apply.select")}</option>
                    {HEARD_ABOUT.map((h) => <option key={h} value={h}>{t(`homestay.opt.heard.${h}`)}</option>)}
                  </select>
                </Field>
                <Field label={t("homestay.apply.ref_referred_by_host")}>
                  <YesNoToggle value={f.host_referral.referred_by_host} onChange={(v) => set("host_referral", { ...f.host_referral, referred_by_host: v })} yes={t("homestay.apply.yes")} no={t("homestay.apply.no")} />
                </Field>
                {f.host_referral.referred_by_host && (
                  <Field label={t("homestay.apply.ref_referrer_name")}>
                    <Input value={f.host_referral.referrer_name} onChange={(e) => set("host_referral", { ...f.host_referral, referrer_name: e.target.value })} className="h-11" />
                  </Field>
                )}
              </div>
            </>
          )}

          {/* ── Step 7: Agreement ── */}
          {step === 7 && (
            <>
              <h3 className="font-semibold text-gray-800">{t("homestay.apply.review_title")}</h3>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 space-y-1.5">
                <p><strong>{t("homestay.apply.first_name")}:</strong> {f.first_name} {f.last_name}</p>
                <p><strong>{t("homestay.apply.email")}:</strong> {f.email}</p>
                <p><strong>{t("homestay.apply.phone")}:</strong> {f.phone}</p>
                <p><strong>{t("homestay.apply.address")}:</strong> {f.address}, {f.suburb}</p>
                <p><strong>{t("homestay.apply.building_type")}:</strong> {f.building_type}</p>
                <p><strong>{t("homestay.apply.rooms_title")}:</strong> {f.rooms.length}</p>
                <p><strong>{t("homestay.apply.residents_title")}:</strong> {f.residents.length}</p>
                <p><strong>{t("homestay.apply.packages_offered")}:</strong> {f.packages_offered.map((p) => t(`homestay.opt.package.${p}`)).join(", ")}</p>
                <div className="border-t border-gray-200 pt-2 mt-2 text-xs leading-relaxed text-gray-500">
                  {t("homestay.apply.agreement_text")}
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={f.agreement_accepted} onChange={(e) => set("agreement_accepted", e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary" />
                <span className="text-sm text-gray-700">{t("homestay.apply.agreement_accept")}</span>
              </label>

              <Field label={t("homestay.apply.signature_name")} required>
                <Input value={f.signature_name} onChange={(e) => set("signature_name", e.target.value)} placeholder={t("homestay.apply.signature_placeholder")} className="h-11" />
              </Field>

              {emailExists && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  {t("homestay.apply.email_exists")}{" "}
                  <Link href="/host-login" className="font-semibold underline">{t("homestay.apply.email_exists_login")}</Link>
                </div>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
            </>
          )}

          {/* ── Nav buttons ── */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-100">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={back}>
                <ChevronLeft className="h-4 w-4 mr-1" /> {t("homestay.apply.back")}
              </Button>
            ) : <span />}
            <div className="flex items-center gap-2">
              {/* Save as Draft — visible from step 2 onward */}
              {step >= 2 && (
                <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={savingDraft || submitting}
                  className="border-primary/40 text-primary hover:bg-orange-50">
                  <Save className="h-4 w-4 mr-1.5" />
                  {savingDraft ? t("homestay.apply.saving_draft") : t("homestay.apply.save_draft")}
                </Button>
              )}
              {step < TOTAL_STEPS ? (
                <Button type="button" onClick={next} disabled={!stepValid(step)} className="bg-primary hover:bg-primary/90 text-white">
                  {t("homestay.apply.next")} <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button type="button" onClick={handleSubmit} disabled={!stepValid(7) || submitting}
                  className="bg-primary hover:bg-primary/90 text-white font-bold">
                  <HomeIcon className="h-4 w-4 mr-1.5" />
                  {submitting ? t("homestay.apply.submitting") : t("homestay.apply.submit")}
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        <p className="text-center text-xs text-gray-400 mt-4">
          {t("homestay.apply.already_applied")}{" "}
          <Link href="/host-login" className="text-primary font-medium hover:underline">{t("homestay.apply.login_link")}</Link>
        </p>
      </section>

      <Footer />
    </div>
  );
}

// Homestay host-family matching engine (Phase 5b).
//
// Pure, deterministic scoring — no I/O, unit-testable. Given a student request
// and a set of APPROVED host applications, it (1) drops hosts that fail a hard
// constraint (gender/age policy, pet allergy, smoking, minor safeguard,
// capacity) and (2) ranks the survivors by a weighted soft-compatibility score.
// The LLM rationale layer (matchRationale.ts) only EXPLAINS this ranking; it
// never decides it. See docs/proposals/HOMESTAY_WORKFLOW.md §6.
import type { HomestayHostApplication, HomestayStudentRequest, HomestayHostAvailability } from "@workspace/db";
import { formatPersonName } from "../../lib/nameFormat";

export interface HostSuggestion {
  host_application_id: number;
  host_name: string;
  suburb: string | null;
  score: number;            // 0–100 soft-compatibility (passing hosts only)
  matched: string[];        // positive signals (green chips)
  concerns: string[];       // soft mismatches worth noting (amber chips)
  rationale?: string;       // filled in by the AI layer, best-effort
}

// Tri-state preference strings as written by the public form ("Yes" | "No" | "").
const yes = (v: unknown): boolean => v === "Yes";
const no = (v: unknown): boolean => v === "No";
const norm = (v: unknown): string => String(v ?? "").trim().toLowerCase();

type Prefs = Record<string, any>;
function prefsOf(student: HomestayStudentRequest): Prefs {
  const p = student.preferences;
  return p && typeof p === "object" ? (p as Prefs) : {};
}

type Resident = { age?: number | string };
type WwccRecord = { verified?: boolean };

// Map the student's meal selection (free-text label) to a host package code.
function mealCode(meals: unknown): string | null {
  const m = norm(meals);
  if (!m) return null;
  if (m.startsWith("full")) return "full_board";
  if (m.startsWith("half") || m.includes("partial")) return "partial_board";
  if (m.startsWith("dinner")) return "dinner_only";
  if (m.startsWith("no")) return "no_meals";
  return null;
}

/**
 * Score a single host for a student. Returns null when a HARD constraint fails
 * (the host must not be shown). `availability` may be undefined — a host with no
 * availability row is treated as available (capacity 1, occupied 0).
 */
export function scoreHostForStudent(
  student: HomestayStudentRequest,
  host: HomestayHostApplication,
  availability?: HomestayHostAvailability | null,
): HostSuggestion | null {
  const p = prefsOf(student);

  // ── Hard constraints ──────────────────────────────────────────────────────
  // Gender policy.
  const hostGender = norm(host.pref_student_gender);
  const studentGender = norm(student.gender);
  if (hostGender && hostGender !== "either" && studentGender && hostGender !== studentGender) return null;

  // Age policy (minor vs adult).
  const agePref = norm(host.pref_student_age);
  if (agePref === "minor" && !student.is_minor) return null;
  if (agePref === "adult" && student.is_minor) return null;

  // Pet allergy is non-negotiable.
  if (yes(p.allergic_to_pets) && host.has_pets) return null;

  // A student who will not live with smokers cannot go to a smoking-indoors home.
  if (no(p.can_live_with_smokers) && host.smoking_in_home) return null;

  // Minor safeguard: every adult resident must have a verified WWCC.
  if (student.is_minor) {
    const residents = (host.residents as Resident[] | null) ?? [];
    const adults = residents.filter((r) => Number(r.age) >= 18);
    const wwcc = (host.wwcc_records as WwccRecord[] | null) ?? [];
    const verifiedCount = wwcc.filter((w) => w.verified).length;
    if (adults.length > 0 && verifiedCount < adults.length) return null;
  }

  // Capacity: only exclude when an availability row exists and is full.
  if (availability && availability.occupied >= availability.capacity) return null;

  // ── Soft score ──────────────────────────────────────────────────────────
  // Each applicable signal contributes `weight * score(0..1)`; signals that do
  // not apply are left out of BOTH numerator and denominator so missing data
  // never penalises a host.
  let earned = 0;
  let total = 0;
  const matched: string[] = [];
  const concerns: string[] = [];
  const add = (weight: number, score: number, label: string) => {
    earned += weight * score;
    total += weight;
    if (score >= 0.75) matched.push(label);
    else if (score <= 0.34) concerns.push(label);
  };

  // Pets comfort — only a signal when the host has pets.
  if (host.has_pets) {
    if (yes(p.can_live_with_pets)) add(15, 1, "Comfortable living with pets");
    else if (no(p.can_live_with_pets)) add(15, 0.2, "Prefers no pets, but host has pets");
    else add(15, 0.6, "Host has pets");
  }

  // Smoking comfort — signal when the host smokes somewhere.
  if (host.smoking_in_home || host.smoke_outside_allowed) {
    if (yes(p.can_live_with_smokers)) add(10, 1, "Fine with a smoking household");
    else if (host.smoking_in_home) add(10, 0.3, "Smoking indoors may not suit the student");
    else add(10, 0.7, "Smoking is outdoors only");
  }

  // Alcohol — signal when alcohol is consumed at home. The student form has no
  // explicit alcohol field, so this is informational unless beliefs object.
  if (host.drink_in_home) {
    const beliefs = norm(p.beliefs);
    const teetotal = beliefs.includes("alcohol") || beliefs.includes("muslim") || beliefs.includes("halal");
    add(10, teetotal ? 0.3 : 0.8, teetotal ? "Household drinks alcohol — check beliefs" : "Household drinks alcohol occasionally");
  }

  // Dietary coverage — student's needs covered by the host's catered diets.
  const studentDiet: string[] = Array.isArray(p.dietary)
    ? p.dietary.map(norm)
    : (norm(p.dietary) ? [norm(p.dietary)] : []);
  if (studentDiet.length) {
    const hostDiet = ((host.dietary as string[] | null) ?? []).map(norm);
    const covered = studentDiet.filter((d) => hostDiet.some((h) => h.includes(d) || d.includes(h)));
    add(15, studentDiet.length ? covered.length / studentDiet.length : 1,
      covered.length === studentDiet.length ? "Caters to dietary needs" : "Some dietary needs may not be catered");
  }

  // Meal package fit.
  const wantMeal = mealCode(p.meals);
  if (wantMeal) {
    const offered = ((host.packages_offered as string[] | null) ?? []).map(norm);
    add(15, offered.includes(wantMeal) ? 1 : 0.3,
      offered.includes(wantMeal) ? "Offers the requested meal plan" : "Requested meal plan not listed");
  }

  // Suburb / campus proximity (string match for now).
  const area = norm(p.campus_location) || norm(p.suburb) || norm(p.school);
  if (area && host.suburb) {
    const hs = norm(host.suburb);
    const hit = hs.includes(area) || area.includes(hs);
    add(15, hit ? 1 : 0.4, hit ? "Near the student's campus/area" : "Different area from campus");
  }

  // Children / other students in the home vs student preference.
  const residents = (host.residents as Resident[] | null) ?? [];
  const hasChildren = residents.some((r) => Number(r.age) < 18);
  if (hasChildren && (yes(p.can_live_with_children) || no(p.can_live_with_children))) {
    add(10, yes(p.can_live_with_children) ? 1 : 0.2,
      yes(p.can_live_with_children) ? "Happy with children in the home" : "Prefers no children, but host has children");
  }

  // Cultural / belief affinity.
  const culture = norm(host.cultural_background);
  const nat = norm(student.nationality);
  if (culture && nat && (culture.includes(nat) || nat.includes(culture))) {
    add(10, 1, "Shared cultural background");
  }

  // No applicable signals (sparse data) → neutral 60 so the host still ranks.
  const score = total > 0 ? Math.round((earned / total) * 100) : 60;

  return {
    host_application_id: host.id,
    host_name: formatPersonName(host.first_name, host.last_name),
    suburb: host.suburb ?? null,
    score,
    matched,
    concerns,
  };
}

/** Rank all hosts for a student, best first. Hosts failing a hard constraint are dropped. */
export function rankHosts(
  student: HomestayStudentRequest,
  hosts: Array<{ host: HomestayHostApplication; availability?: HomestayHostAvailability | null }>,
): HostSuggestion[] {
  return hosts
    .map(({ host, availability }) => scoreHostForStudent(student, host, availability))
    .filter((s): s is HostSuggestion => s !== null)
    .sort((a, b) => b.score - a.score);
}

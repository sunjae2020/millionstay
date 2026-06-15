// Public homestay student application API (Phase 3). No auth — intake is open,
// matching is admin-brokered. On success returns a signing token; the applicant
// is sent to /sign/:token to e-sign the application / T&C.
import { getApiBase } from "./api-base";

export interface StudentPreferences {
  // Personal (extends the top-level student columns)
  native_language?: string;
  english_level?: string;
  relationship_with_host?: string;
  additional_comment?: string;
  // School information (in Australia)
  school?: string;
  course_name?: string;
  course_start_date?: string;
  campus_location?: string;
  // Homestay information
  // Unified product classification — values map to the DB enums
  // (accommodation_options.ts): stay_type drives meal applicability, space_sharing
  // → room_type, contract_term → contract_term. Used to spin up a booking.
  stay_type?: string;       // "homestay" | "homestay_self_board" | "share"
  space_sharing?: string;   // "entire_place" | "house_share" | "room_share"
  contract_term?: string;   // "short_term" | "mid_term" | "long_term"
  homestay_start_date?: string;
  duration_weeks?: string;
  room_type?: string;
  meals?: string;
  allergic_to_pets?: string;
  can_live_with_pets?: string;
  smoker?: string;
  can_live_with_smokers?: string;
  beliefs?: string;
  dietary?: string;
  food_avoided?: string;
  hobbies?: string;
  can_live_with_students?: string;
  can_live_with_children?: string;
  other_requirements?: string;
  self_introduction?: string;
  // Airport pickup
  airport_pickup_option?: string;
  arrival_date?: string;
  arrival_time?: string;
  flight_no?: string;
  // Emergency contact
  emergency_contact?: { name?: string; relationship?: string; contact_no?: string; email?: string };
  // Optional arrival support
  addons?: { guardian_service?: boolean; airport_pickup?: boolean; settlement_support?: boolean };
  // Extra intake fields (parity with the Time Study program & service application)
  other_name?: string;
  referral_source?: string;
  visa_type?: string;
  sns?: { type?: string; id?: string };
  home_address?: { street?: string; street2?: string; city?: string; state?: string; postcode?: string; country?: string };
  agent?: { uses_agent?: string; agent_name?: string; staff_name?: string; staff_email?: string; staff_contact?: string };
}

export interface StudentApplicationInput {
  student_first_name: string;
  student_last_name: string;
  student_email?: string;
  student_phone?: string;
  date_of_birth: string;
  gender?: string;
  nationality?: string;
  guardian_name?: string;
  guardian_email?: string;
  guardian_phone?: string;
  guardian_relationship?: string;
  preferences: StudentPreferences;
  terms_accepted: boolean;
}

export interface StudentApplicationResult {
  success: boolean;
  request_ref: string;
  is_minor: boolean;
  signing_token: string;
}

export async function submitStudentApplication(input: StudentApplicationInput): Promise<StudentApplicationResult> {
  const res = await fetch(`${getApiBase()}/api/v1/public/homestay-student-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? "Failed to submit application.");
  return body as StudentApplicationResult;
}

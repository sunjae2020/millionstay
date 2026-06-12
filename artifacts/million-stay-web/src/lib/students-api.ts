// Public homestay student application API (Phase 3). No auth — intake is open,
// matching is admin-brokered. On success returns a signing token; the applicant
// is sent to /sign/:token to e-sign the application / T&C.
import { getApiBase } from "./api-base";

export interface StudentPreferences {
  suburb?: string;
  school?: string;
  timetable?: string;
  study_type?: string;
  meals?: string;
  dietary?: string;
  environment?: string;
  addons?: { guardian_service?: boolean; airport_pickup?: boolean; settlement_support?: boolean };
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

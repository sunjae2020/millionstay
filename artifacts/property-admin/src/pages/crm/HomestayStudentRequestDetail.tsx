import { useEffect, useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { formatDateTime } from "@/lib/date";
import { formatPersonName } from "@/lib/nameFormat";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, GraduationCap, PencilLine, ShieldCheck, Sparkles, Wand2, Loader2, MapPin, Check, AlertTriangle, ExternalLink, Handshake, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { LookupSelect } from "@/components/LookupSelect";
import { HomestaySignatureCard } from "@/components/HomestaySignatureCard";
import { StudentStatusBadge, STUDENT_STATUS_ORDER, STUDENT_STATUS_CONFIG, type StudentStatus } from "./HomestayStudentRequests";

const API = "/api/v1/homestay-student-requests";

interface EmergencyContact { name?: string; relationship?: string; contact_no?: string; email?: string }
interface Addons { guardian_service?: boolean; airport_pickup?: boolean; settlement_support?: boolean }

interface Preferences {
  native_language?: string;
  english_level?: string;
  relationship_with_host?: string;
  additional_comment?: string;
  school?: string;
  course_name?: string;
  course_start_date?: string;
  campus_location?: string;
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
  airport_pickup_option?: string;
  arrival_date?: string;
  arrival_time?: string;
  flight_no?: string;
  emergency_contact?: EmergencyContact;
  addons?: Addons;
}

interface StudentRequestFull {
  id: number;
  request_ref: string;
  status: StudentStatus;
  submitted_by?: string;
  student_first_name: string;
  student_last_name: string;
  student_email?: string | null;
  student_phone?: string | null;
  date_of_birth?: string | null;
  is_minor?: boolean;
  gender?: string | null;
  nationality?: string | null;
  guardian_name?: string | null;
  guardian_email?: string | null;
  guardian_phone?: string | null;
  guardian_relationship?: string | null;
  guardian_consent_at?: string | null;
  preferences?: Preferences;
  terms_accepted?: boolean;
  terms_accepted_at?: string | null;
  notes?: string | null;
  reviewed_at?: string | null;
  agent_account_id?: number | null;
  assigned_staff_user_id?: number | null;
  agent_account_name?: string | null;
  assigned_staff_name?: string | null;
  created_at: string;
}

interface DetailResponse { success: boolean; request: StudentRequestFull }

interface HostSuggestion {
  host_application_id: number;
  host_name: string;
  suburb: string | null;
  score: number;
  matched: string[];
  concerns: string[];
  rationale?: string;
}
interface SuggestionsResponse { success: boolean; suggestions: HostSuggestion[]; ai_used: boolean }

interface HostRow {
  id: number;
  application_ref: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  suburb?: string | null;
  status: string;
}
interface HostSearchResponse { success: boolean; data: HostRow[] }

// Colour the score badge by band.
function scoreBadge(score: number): string {
  if (score >= 75) return "bg-green-100 text-green-700 border-green-200";
  if (score >= 50) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">{title}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground break-words whitespace-pre-wrap">
        {value === null || value === undefined || value === "" ? <span className="text-muted-foreground/40">—</span> : value}
      </span>
    </div>
  );
}

function YesNoTag({ value }: { value?: boolean }) {
  const { t } = useTranslation();
  return <>{value ? t("common.yes") : t("common.no")}</>;
}

export default function HomestayStudentRequestDetail() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);

  const [, navigate] = useLocation();
  const [statusOpen, setStatusOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<StudentStatus>("UnderReview");
  const [notes, setNotes] = useState("");

  // Assignment — mapped agent account + assigned ops staff. Initialised from the
  // loaded request below.
  const [agentAccountId, setAgentAccountId] = useState<number | null>(null);
  const [assignedStaffId, setAssignedStaffId] = useState<number | null>(null);

  // Create-placement dialog (from a host suggestion).
  const [placeOpen, setPlaceOpen] = useState(false);
  const [placeHost, setPlaceHost] = useState<{ id: number; name: string } | null>(null);
  const [placeForm, setPlaceForm] = useState({ move_in_date: "", move_out_date: "", placement_fee: "", deposit: "", monthly_fee: "", currency: "AUD" });

  const { data, isLoading } = useQuery({
    queryKey: ["homestay-student-request", id],
    queryFn: async (): Promise<DetailResponse> => {
      const res = await apiFetch(`${API}/${id}`);
      if (!res.ok) throw new Error("Failed to load request");
      return res.json();
    },
    enabled: !!id,
  });

  const req = data?.request;
  const p = req?.preferences ?? {};

  // Host recommendations — lazy: only fetched once the user clicks "Find matches"
  // (the request hits Claude for rationale, so we don't auto-run it).
  const [showMatches, setShowMatches] = useState(false);
  const { data: matchData, isFetching: matchLoading, error: matchError } = useQuery({
    queryKey: ["homestay-host-suggestions", id],
    queryFn: async (): Promise<SuggestionsResponse> => {
      const res = await apiFetch(`${API}/${id}/host-suggestions?limit=5&rationale=1`);
      if (!res.ok) throw new Error("Failed to load suggestions");
      return res.json();
    },
    enabled: showMatches && !!id,
    staleTime: 5 * 60_000,
  });

  // Manual host-family search — fallback when no AI suggestion fits. Only
  // Approved hosts are searchable, since placement creation requires Approved.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchQDebounced, setSearchQDebounced] = useState("");
  useEffect(() => {
    const h = setTimeout(() => setSearchQDebounced(searchQ.trim()), 300);
    return () => clearTimeout(h);
  }, [searchQ]);
  const { data: hostSearch, isFetching: hostSearchLoading } = useQuery({
    queryKey: ["homestay-host-search", searchQDebounced],
    queryFn: async (): Promise<HostSearchResponse> => {
      const sp = new URLSearchParams({ status: "Approved", limit: "20" });
      if (searchQDebounced) sp.set("q", searchQDebounced);
      const res = await apiFetch(`/api/v1/homestay-applications?${sp.toString()}`);
      if (!res.ok) throw new Error("Failed to search hosts");
      return res.json();
    },
    enabled: searchOpen,
    staleTime: 60_000,
  });

  // Pick a host (from search or suggestion) → seed and open the placement dialog.
  function openPlacementFor(host: { id: number; name: string }) {
    setPlaceHost(host);
    setPlaceForm((f) => ({ ...f, move_in_date: p.homestay_start_date ?? "" }));
    setSearchOpen(false);
    setPlaceOpen(true);
  }

  // Seed the dialog with the current status + ops notes when it opens.
  useEffect(() => {
    if (req) {
      setNextStatus(req.status);
      setNotes(req.notes ?? "");
      setAgentAccountId(req.agent_account_id ?? null);
      setAssignedStaffId(req.assigned_staff_user_id ?? null);
    }
  }, [req]);

  const updateStatus = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`${API}/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: nextStatus, notes: notes || undefined }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("homestayStudent.toast_updated") });
      qc.invalidateQueries({ queryKey: ["homestay-student-request", id] });
      qc.invalidateQueries({ queryKey: ["homestay-student-requests"] });
      setStatusOpen(false);
    },
    onError: (e: any) => toast({ title: t("homestayStudent.error"), description: e.message, variant: "destructive" }),
  });

  const saveAssignment = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`${API}/${id}/assignment`, {
        method: "POST",
        body: JSON.stringify({ agent_account_id: agentAccountId, assigned_staff_user_id: assignedStaffId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("homestayStudent.assignment_saved") });
      qc.invalidateQueries({ queryKey: ["homestay-student-request", id] });
    },
    onError: (e: any) => toast({ title: t("homestayStudent.error"), description: e.message, variant: "destructive" }),
  });

  const sendPortalInvite = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`${API}/${id}/portal-invite`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? await res.text());
      return res.json();
    },
    onSuccess: (d: any) => {
      toast({ title: d?.emailed ? t("homestayStudent.invite_sent") : t("homestayStudent.invite_provisioned") });
    },
    onError: (e: any) => toast({ title: t("homestayStudent.error"), description: e.message, variant: "destructive" }),
  });

  const createPlacement = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/v1/homestay-placements`, {
        method: "POST",
        body: JSON.stringify({
          student_request_id: id,
          host_application_id: placeHost?.id,
          move_in_date: placeForm.move_in_date || undefined,
          move_out_date: placeForm.move_out_date || undefined,
          placement_fee: placeForm.placement_fee || "0",
          deposit: placeForm.deposit || "0",
          monthly_fee: placeForm.monthly_fee || "0",
          currency: placeForm.currency || "AUD",
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Failed to create placement");
      return res.json();
    },
    onSuccess: (d: any) => {
      toast({ title: t("homestayStudent.placement_created") });
      setPlaceOpen(false);
      if (d?.placement?.id) navigate(`/account/homestay-placements/${d.placement.id}`);
    },
    onError: (e: any) => toast({ title: t("homestayStudent.error"), description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <Layout><p className="p-6 text-sm text-muted-foreground">{t("common.loading")}</p></Layout>;
  if (!req) return <Layout><p className="p-6 text-sm text-muted-foreground">{t("homestayStudent.not_found")}</p></Layout>;

  const fullName = formatPersonName(req.student_first_name, req.student_last_name);
  const airportRequired = !!p.airport_pickup_option && p.airport_pickup_option !== "Not required";

  return (
    <Layout>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" /> {fullName || req.request_ref}
            <StudentStatusBadge status={req.status} />
            {req.is_minor && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                <ShieldCheck className="h-3.5 w-3.5" /> {t("homestayStudent.minor")}
              </span>
            )}
          </span>
        }
        subtitle={`${t("homestayStudent.label_ref")}: ${req.request_ref}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/account/homestay-student-requests">
              <Button variant="outline" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> {t("common.back")}</Button>
            </Link>
            <Button size="sm" className="gap-1.5" onClick={() => setStatusOpen(true)}>
              <PencilLine className="h-4 w-4" /> {t("homestayStudent.btn_update_status")}
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 max-w-4xl space-y-5">
        {/* Status / ops banner */}
        <div className="flex flex-wrap items-center gap-4 border rounded-lg bg-white p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("homestayStudent.col_status")}:</span>
            <StudentStatusBadge status={req.status} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("homestayStudent.f_submitted_by")}:</span>
            <span className="text-xs font-medium">{req.submitted_by ?? "student"}</span>
          </div>
          {req.reviewed_at && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{t("homestayStudent.f_reviewed_at")}:</span> {formatDateTime(req.reviewed_at)}
            </div>
          )}
          {req.notes && (
            <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{t("homestayStudent.label_notes")}:</span> {req.notes}</div>
          )}
        </div>

        {/* Assignment */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">
            {t("homestayStudent.assignment_title")}
          </div>
          <div className="p-4 grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>{t("homestayStudent.assignment_agent")}</Label>
              <LookupSelect
                value={agentAccountId}
                onChange={setAgentAccountId}
                lookupUrl="/api/v1/lookup/accounts?type=Agent"
                displayValue={req.agent_account_name}
                placeholder={t("homestayStudent.assignment_agent")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("homestayStudent.assignment_staff")}</Label>
              <LookupSelect
                value={assignedStaffId}
                onChange={setAssignedStaffId}
                lookupUrl="/api/v1/lookup/admin-users"
                displayValue={req.assigned_staff_name}
                placeholder={t("homestayStudent.assignment_staff")}
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => sendPortalInvite.mutate()} disabled={sendPortalInvite.isPending}>
                {sendPortalInvite.isPending ? t("common.saving") : t("homestayStudent.send_portal_invite")}
              </Button>
              <Button size="sm" onClick={() => saveAssignment.mutate()} disabled={saveAssignment.isPending}>
                {saveAssignment.isPending ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </div>
        </div>

        {/* Signature & document */}
        <HomestaySignatureCard contextType="student_app" contextId={id} entityType="homestay_student_request" />

        {/* AI host-family recommendations */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-orange-50 border-b px-4 py-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#E8621A] uppercase tracking-wider inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> {t("homestayStudent.match_title")}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 h-7" onClick={() => setSearchOpen(true)}>
                <Search className="h-3.5 w-3.5" /> {t("homestayStudent.match_manual")}
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 h-7" onClick={() => setShowMatches(true)} disabled={matchLoading}>
                {matchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                {showMatches ? t("homestayStudent.match_refresh") : t("homestayStudent.match_find")}
              </Button>
            </div>
          </div>
          <div className="p-4">
            {!showMatches ? (
              <p className="text-sm text-muted-foreground">{t("homestayStudent.match_hint")}</p>
            ) : matchLoading ? (
              <p className="text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {t("homestayStudent.match_loading")}</p>
            ) : matchError ? (
              <p className="text-sm text-red-600">{t("homestayStudent.error")}</p>
            ) : !matchData?.suggestions.length ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{t("homestayStudent.match_empty")}</p>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setSearchOpen(true)}>
                  <Search className="h-3.5 w-3.5" /> {t("homestayStudent.match_manual")}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {matchData.ai_used === false && (
                  <p className="text-[11px] text-muted-foreground">{t("homestayStudent.match_no_ai")}</p>
                )}
                {matchData.suggestions.map((s) => (
                  <div key={s.host_application_id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/account/homestay-applications/${s.host_application_id}`} className="font-medium hover:underline inline-flex items-center gap-1.5">
                        {s.host_name || `#${s.host_application_id}`}
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </Link>
                      <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${scoreBadge(s.score)}`}>
                        {t("homestayStudent.match_score")}: {s.score}
                      </span>
                    </div>
                    {s.suburb && (
                      <p className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {s.suburb}</p>
                    )}
                    {s.rationale && <p className="text-sm text-foreground/80 italic mt-2">"{s.rationale}"</p>}
                    {(s.matched.length > 0 || s.concerns.length > 0) && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {s.matched.map((m, i) => (
                          <span key={`m${i}`} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                            <Check className="h-3 w-3" /> {m}
                          </span>
                        ))}
                        {s.concerns.map((c, i) => (
                          <span key={`c${i}`} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle className="h-3 w-3" /> {c}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex justify-end">
                      <Button
                        size="sm"
                        className="gap-1.5 h-7"
                        onClick={() => openPlacementFor({ id: s.host_application_id, name: s.host_name })}
                      >
                        <Handshake className="h-3.5 w-3.5" /> {t("homestayStudent.create_placement")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Student personal */}
        <Section title={t("homestayStudent.section_personal")}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label={t("homestayStudent.f_name")} value={fullName} />
            <Field label={t("homestayStudent.f_dob")} value={req.date_of_birth} />
            <Field label={t("homestayStudent.f_gender")} value={req.gender} />
            <Field label={t("homestayStudent.f_nationality")} value={req.nationality} />
            <Field label={t("homestayStudent.f_email")} value={req.student_email} />
            <Field label={t("homestayStudent.f_phone")} value={req.student_phone} />
            <Field label={t("homestayStudent.f_native_language")} value={p.native_language} />
            <Field label={t("homestayStudent.f_english_level")} value={p.english_level} />
          </div>
          <div className="grid gap-4 mt-4">
            <Field label={t("homestayStudent.f_relationship_with_host")} value={p.relationship_with_host} />
            <Field label={t("homestayStudent.f_additional_comment")} value={p.additional_comment} />
          </div>
        </Section>

        {/* Guardian (under 18) */}
        {req.is_minor && (
          <Section title={t("homestayStudent.section_guardian")}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label={t("homestayStudent.f_guardian_name")} value={req.guardian_name} />
              <Field label={t("homestayStudent.f_guardian_relationship")} value={req.guardian_relationship} />
              <Field label={t("homestayStudent.f_guardian_email")} value={req.guardian_email} />
              <Field label={t("homestayStudent.f_guardian_phone")} value={req.guardian_phone} />
              <Field label={t("homestayStudent.f_guardian_consent_at")} value={req.guardian_consent_at ? formatDateTime(req.guardian_consent_at) : null} />
            </div>
          </Section>
        )}

        {/* School */}
        <Section title={t("homestayStudent.section_school")}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label={t("homestayStudent.f_school")} value={p.school} />
            <Field label={t("homestayStudent.f_course_name")} value={p.course_name} />
            <Field label={t("homestayStudent.f_course_start_date")} value={p.course_start_date} />
            <Field label={t("homestayStudent.f_campus_location")} value={p.campus_location} />
          </div>
        </Section>

        {/* Homestay information */}
        <Section title={t("homestayStudent.section_homestay")}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label={t("homestayStudent.f_homestay_start_date")} value={p.homestay_start_date} />
            <Field label={t("homestayStudent.f_duration_weeks")} value={p.duration_weeks} />
            <Field label={t("homestayStudent.f_room_type")} value={p.room_type} />
            <Field label={t("homestayStudent.f_meals")} value={p.meals} />
            <Field label={t("homestayStudent.f_allergic_to_pets")} value={p.allergic_to_pets} />
            <Field label={t("homestayStudent.f_can_live_with_pets")} value={p.can_live_with_pets} />
            <Field label={t("homestayStudent.f_smoker")} value={p.smoker} />
            <Field label={t("homestayStudent.f_can_live_with_smokers")} value={p.can_live_with_smokers} />
            <Field label={t("homestayStudent.f_can_live_with_students")} value={p.can_live_with_students} />
            <Field label={t("homestayStudent.f_can_live_with_children")} value={p.can_live_with_children} />
          </div>
          <div className="grid gap-4 mt-4">
            <Field label={t("homestayStudent.f_beliefs")} value={p.beliefs} />
            <Field label={t("homestayStudent.f_dietary")} value={p.dietary} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("homestayStudent.f_food_avoided")} value={p.food_avoided} />
              <Field label={t("homestayStudent.f_hobbies")} value={p.hobbies} />
            </div>
            <Field label={t("homestayStudent.f_other_requirements")} value={p.other_requirements} />
            <Field label={t("homestayStudent.f_self_introduction")} value={p.self_introduction} />
          </div>
        </Section>

        {/* Airport pickup */}
        <Section title={t("homestayStudent.section_airport")}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label={t("homestayStudent.f_airport_option")} value={p.airport_pickup_option} />
            {airportRequired && <>
              <Field label={t("homestayStudent.f_arrival_date")} value={p.arrival_date} />
              <Field label={t("homestayStudent.f_arrival_time")} value={p.arrival_time} />
              <Field label={t("homestayStudent.f_flight_no")} value={p.flight_no} />
            </>}
          </div>
        </Section>

        {/* Emergency contact */}
        <Section title={t("homestayStudent.section_emergency")}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label={t("homestayStudent.f_name")} value={p.emergency_contact?.name} />
            <Field label={t("homestayStudent.f_guardian_relationship")} value={p.emergency_contact?.relationship} />
            <Field label={t("homestayStudent.f_phone")} value={p.emergency_contact?.contact_no} />
            <Field label={t("homestayStudent.f_email")} value={p.emergency_contact?.email} />
          </div>
        </Section>

        {/* Optional arrival support */}
        <Section title={t("homestayStudent.section_addons")}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label={t("homestayStudent.f_addon_guardian")} value={<YesNoTag value={p.addons?.guardian_service} />} />
            <Field label={t("homestayStudent.f_addon_airport")} value={<YesNoTag value={p.addons?.airport_pickup} />} />
            <Field label={t("homestayStudent.f_addon_settlement")} value={<YesNoTag value={p.addons?.settlement_support} />} />
          </div>
        </Section>

        {/* Terms */}
        <Section title={t("homestayStudent.section_terms")}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label={t("homestayStudent.f_terms_accepted")} value={<YesNoTag value={req.terms_accepted} />} />
            <Field label={t("homestayStudent.f_terms_accepted_at")} value={req.terms_accepted_at ? formatDateTime(req.terms_accepted_at) : null} />
          </div>
        </Section>
      </div>

      {/* Update status dialog */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("homestayStudent.update_status_title")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>{t("homestayStudent.col_status")}</Label>
              <Select value={nextStatus} onValueChange={(v) => setNextStatus(v as StudentStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STUDENT_STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{t(STUDENT_STATUS_CONFIG[s].key)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("homestayStudent.label_notes_optional")}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={t("homestayStudent.notes_placeholder")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => updateStatus.mutate()} disabled={updateStatus.isPending}>
              {updateStatus.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual host-family search dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("homestayStudent.manual_search_title")}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                className="pl-8"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder={t("homestayStudent.manual_search_placeholder")}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">{t("homestayStudent.manual_search_hint")}</p>
            <div className="max-h-80 overflow-y-auto -mx-1 px-1">
              {hostSearchLoading ? (
                <p className="text-sm text-muted-foreground inline-flex items-center gap-2 py-4"><Loader2 className="h-4 w-4 animate-spin" /> {t("homestayStudent.manual_search_loading")}</p>
              ) : !hostSearch?.data?.length ? (
                <p className="text-sm text-muted-foreground py-4">{t("homestayStudent.manual_search_empty")}</p>
              ) : (
                <div className="space-y-2">
                  {hostSearch.data.map((h) => {
                    const name = formatPersonName(h.first_name, h.last_name) || h.application_ref;
                    return (
                      <div key={h.id} className="flex items-center justify-between gap-2 border rounded-lg p-2.5">
                        <div className="min-w-0">
                          <Link href={`/account/homestay-applications/${h.id}`} className="font-medium text-sm hover:underline inline-flex items-center gap-1.5">
                            {name}
                            <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                          </Link>
                          <p className="text-xs text-muted-foreground truncate">
                            {h.application_ref}{h.suburb ? ` · ${h.suburb}` : ""}{h.email ? ` · ${h.email}` : ""}
                          </p>
                        </div>
                        <Button size="sm" className="gap-1.5 h-7 shrink-0" onClick={() => openPlacementFor({ id: h.id, name })}>
                          <Handshake className="h-3.5 w-3.5" /> {t("homestayStudent.create_placement")}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSearchOpen(false)}>{t("common.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create placement dialog */}
      <Dialog open={placeOpen} onOpenChange={setPlaceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("homestayStudent.create_placement")}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <p className="text-sm text-muted-foreground">
              {t("homestayStudent.placement_with")}: <span className="font-medium text-foreground">{placeHost?.name}</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t("homestayPlacement.f_move_in")}</Label>
                <Input type="date" value={placeForm.move_in_date} onChange={(e) => setPlaceForm((f) => ({ ...f, move_in_date: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("homestayPlacement.f_move_out")}</Label>
                <Input type="date" value={placeForm.move_out_date} onChange={(e) => setPlaceForm((f) => ({ ...f, move_out_date: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("homestayPlacement.f_placement_fee")}</Label>
                <Input type="number" inputMode="decimal" value={placeForm.placement_fee} onChange={(e) => setPlaceForm((f) => ({ ...f, placement_fee: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("homestayPlacement.f_deposit")}</Label>
                <Input type="number" inputMode="decimal" value={placeForm.deposit} onChange={(e) => setPlaceForm((f) => ({ ...f, deposit: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("homestayPlacement.f_monthly_fee")}</Label>
                <Input type="number" inputMode="decimal" value={placeForm.monthly_fee} onChange={(e) => setPlaceForm((f) => ({ ...f, monthly_fee: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("homestayPlacement.f_currency")}</Label>
                <Input value={placeForm.currency} onChange={(e) => setPlaceForm((f) => ({ ...f, currency: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlaceOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => createPlacement.mutate()} disabled={createPlacement.isPending}>
              {createPlacement.isPending ? t("common.saving") : t("homestayStudent.create_placement")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

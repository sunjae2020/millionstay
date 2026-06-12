import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, GraduationCap, PencilLine, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
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
  created_at: string;
}

interface DetailResponse { success: boolean; request: StudentRequestFull }

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

  const [statusOpen, setStatusOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<StudentStatus>("UnderReview");
  const [notes, setNotes] = useState("");

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

  // Seed the dialog with the current status + ops notes when it opens.
  useEffect(() => {
    if (req) { setNextStatus(req.status); setNotes(req.notes ?? ""); }
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

  if (isLoading) return <Layout><p className="p-6 text-sm text-muted-foreground">{t("common.loading")}</p></Layout>;
  if (!req) return <Layout><p className="p-6 text-sm text-muted-foreground">{t("homestayStudent.not_found")}</p></Layout>;

  const fullName = `${req.student_first_name ?? ""} ${req.student_last_name ?? ""}`.trim();
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
              <span className="font-medium text-foreground">{t("homestayStudent.f_reviewed_at")}:</span> {new Date(req.reviewed_at).toLocaleString()}
            </div>
          )}
          {req.notes && (
            <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{t("homestayStudent.label_notes")}:</span> {req.notes}</div>
          )}
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
              <Field label={t("homestayStudent.f_guardian_consent_at")} value={req.guardian_consent_at ? new Date(req.guardian_consent_at).toLocaleString() : null} />
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
            <Field label={t("homestayStudent.f_terms_accepted_at")} value={req.terms_accepted_at ? new Date(req.terms_accepted_at).toLocaleString() : null} />
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
    </Layout>
  );
}

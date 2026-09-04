import { useState } from "react";
import { useParams } from "wouter";
import { Link } from "wouter";
import { formatDate, formatDateTime } from "@/lib/date";
import { formatPersonName } from "@/lib/nameFormat";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, CheckCircle2, XCircle, FileQuestion, Plus, Trash2, FileText,
  CheckCircle2 as CheckIcon, Clock, Home,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { HomestaySignatureCard } from "@/components/HomestaySignatureCard";
import { HomestayStatusBadge } from "./HomestayApplications";

import { CsvExportable } from "@/components/ui/ExportCsvButton";
const API = "/api/v1/homestay-applications";

interface Resident { name?: string; age?: number | string; gender?: string; relationship?: string }
interface Room { name?: string; bed_type?: string; bath_type?: string; has_lock?: boolean; comments?: string }
interface RequestedDoc { doc_type: string; note?: string; requested_at?: string; fulfilled?: boolean }
interface EmergencyContact { name?: string; relationship?: string; phone?: string; email?: string }
interface WwccRecord { name?: string; wwcc_number?: string; expiry_date?: string; verified?: boolean }
interface UploadedDoc { id: number; doc_type: string; file_name: string; cloudinary_public_id?: string; created_at: string }

interface HomestayApplicationFull {
  id: number;
  application_ref: string;
  status: "Draft" | "Submitted" | "UnderReview" | "DocsRequested" | "Approved" | "Rejected";
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  nationality?: string | null;
  cultural_background?: string | null;
  address?: string | null;
  suburb?: string | null;
  heard_about?: string | null;
  residents?: Resident[];
  smoking_in_home?: boolean;
  smoke_outside_allowed?: boolean;
  drink_in_home?: boolean;
  guest_drink_allowed?: boolean;
  has_pets?: boolean;
  pet_types?: string | null;
  pet_notes?: string | null;
  building_type?: string | null;
  home_features?: string[];
  rooms?: Room[];
  pref_student_gender?: string | null;
  pref_student_age?: string | null;
  host_under_18?: boolean;
  packages_offered?: string[];
  dietary?: string[];
  dietary_notes?: string | null;
  welcome_message?: string | null;
  profile_description?: string | null;
  emergency_contact?: EmergencyContact | null;
  host_referral?: string | null;
  agreement_accepted?: boolean;
  agreement_accepted_at?: string | null;
  signature_name?: string | null;
  requested_docs?: RequestedDoc[];
  approval_notes?: string | null;
  landing_active?: boolean;
  created_at: string;
  // Compliance
  wwcc_records?: WwccRecord[];
  insurance_provider?: string | null;
  insurance_policy_no?: string | null;
  insurance_expiry?: string | null;
  // Bank
  bank_name?: string | null;
  bank_account_name?: string | null;
  bank_bsb?: string | null;
  bank_account_number?: string | null;
  bank_swift?: string | null;
}

interface DetailResponse {
  success: boolean;
  application: HomestayApplicationFull;
  documents: UploadedDoc[];
}

const DOC_PRESETS = [
  { value: "WWCC", labelKey: "homestay.doc_wwcc" },
  { value: "ID/Passport", labelKey: "homestay.doc_id" },
  { value: "Proof of Residence", labelKey: "homestay.doc_residence" },
  { value: "Rental Agreement / Landlord Consent", labelKey: "homestay.doc_rental" },
  { value: "Insurance", labelKey: "homestay.doc_insurance" },
  { value: "__custom", labelKey: "homestay.doc_custom" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-primary/10 border-b px-4 py-2 text-xs font-semibold text-primary uppercase tracking-wider">{title}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground break-words">
        {value === null || value === undefined || value === "" ? <span className="text-muted-foreground/40">—</span> : value}
      </span>
    </div>
  );
}

/** True if a YYYY-MM-DD date is in the past or within the next 30 days. */
function isExpiringSoon(date?: string | null): boolean {
  if (!date) return false;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + 30);
  return d <= threshold;
}

function YesNo({ value }: { value?: boolean }) {
  const { t } = useTranslation();
  return <>{value ? t("common.yes") : t("common.no")}</>;
}

export default function HomestayApplicationDetail() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [approveNotes, setApproveNotes] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [docRequests, setDocRequests] = useState<{ doc_type: string; custom: string; note: string }[]>([
    { doc_type: "WWCC", custom: "", note: "" },
  ]);

  const { data, isLoading } = useQuery({
    queryKey: ["homestay-application", id],
    queryFn: async (): Promise<DetailResponse> => {
      const res = await apiFetch(`${API}/${id}`);
      if (!res.ok) throw new Error("Failed to load application");
      return res.json();
    },
    enabled: !!id,
  });

  const app = data?.application;
  const documents = data?.documents ?? [];

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ["homestay-application", id] });
    qc.invalidateQueries({ queryKey: ["homestay-applications"] });
    qc.invalidateQueries({ queryKey: ["/api/v1/homestay-applications"] });
  };

  const approve = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`${API}/${id}/approve`, { method: "POST", body: JSON.stringify({ notes: approveNotes || undefined }) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("homestay.toast_approved") });
      refetchAll();
      setApproveOpen(false);
      setApproveNotes("");
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const reject = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`${API}/${id}/reject`, { method: "POST", body: JSON.stringify({ notes: rejectNotes || undefined }) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("homestay.toast_rejected") });
      refetchAll();
      setRejectOpen(false);
      setRejectNotes("");
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const requestDocs = useMutation({
    mutationFn: async () => {
      const docs = docRequests
        .map((d) => ({ doc_type: d.doc_type === "__custom" ? d.custom.trim() : d.doc_type, note: d.note.trim() || undefined }))
        .filter((d) => d.doc_type);
      const res = await apiFetch(`${API}/${id}/request-docs`, { method: "POST", body: JSON.stringify({ docs }) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("homestay.toast_docs_requested") });
      refetchAll();
      setDocsOpen(false);
      setDocRequests([{ doc_type: "WWCC", custom: "", note: "" }]);
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const isFinalised = app?.status === "Approved" || app?.status === "Rejected";

  if (isLoading) return <Layout><p className="p-6 text-sm text-muted-foreground">{t("common.loading")}</p></Layout>;
  if (!app) return <Layout><p className="p-6 text-sm text-muted-foreground">{t("homestay.not_found")}</p></Layout>;

  const fullName = formatPersonName(app.first_name, app.last_name);

  return (
    <Layout>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Home className="h-5 w-5" /> {fullName || app.application_ref}
            <HomestayStatusBadge status={app.status} />
          </span>
        }
        subtitle={`${t("homestay.label_ref")}: ${app.application_ref}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/account/homestay-applications">
              <Button variant="outline" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> {t("common.back")}</Button>
            </Link>
            <Button
              size="sm" variant="outline"
              className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
              onClick={() => setDocsOpen(true)}
              disabled={isFinalised}
            >
              <FileQuestion className="h-4 w-4" /> {t("homestay.btn_request_docs")}
            </Button>
            <Button
              size="sm" variant="outline"
              className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50"
              onClick={() => setRejectOpen(true)}
              disabled={isFinalised}
            >
              <XCircle className="h-4 w-4" /> {t("homestay.btn_reject")}
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => setApproveOpen(true)}
              disabled={isFinalised}
            >
              <CheckCircle2 className="h-4 w-4" /> {t("homestay.btn_approve")}
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 max-w-4xl space-y-5">
        {/* Status / landing banner */}
        <div className="flex flex-wrap items-center gap-4 border rounded-lg bg-white p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("homestay.col_status")}:</span>
            <HomestayStatusBadge status={app.status} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("homestay.col_landing")}:</span>
            {app.landing_active ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> {t("homestay.landing_live")}</span>
            ) : (
              <span className="text-xs text-muted-foreground/60">{t("homestay.landing_off")}</span>
            )}
          </div>
          {app.approval_notes && (
            <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{t("homestay.label_notes")}:</span> {app.approval_notes}</div>
          )}
        </div>

        {/* Signature & document */}
        <HomestaySignatureCard contextType="host_app" contextId={id} entityType="homestay_host_application" />

        {/* Host info */}
        <Section title={t("homestay.section_host")}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label={t("homestay.f_name")} value={fullName} />
            <Field label={t("homestay.f_email")} value={app.email} />
            <Field label={t("homestay.f_phone")} value={app.phone} />
            <Field label={t("homestay.f_dob")} value={app.date_of_birth} />
            <Field label={t("homestay.f_gender")} value={app.gender} />
            <Field label={t("homestay.f_nationality")} value={app.nationality} />
            <Field label={t("homestay.f_cultural")} value={app.cultural_background} />
            <Field label={t("homestay.f_address")} value={app.address} />
            <Field label={t("homestay.f_suburb")} value={app.suburb} />
            <Field label={t("homestay.f_heard")} value={app.heard_about} />
          </div>
        </Section>

        {/* Household / residents */}
        <Section title={t("homestay.section_household")}>
          {app.residents && app.residents.length > 0 ? (
            <CsvExportable fileName="homestay-application-matches"><Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("homestay.f_name")}</TableHead>
                  <TableHead>{t("homestay.r_age")}</TableHead>
                  <TableHead>{t("homestay.f_gender")}</TableHead>
                  <TableHead>{t("homestay.r_relationship")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {app.residents.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.name || "—"}</TableCell>
                    <TableCell>{r.age ?? "—"}</TableCell>
                    <TableCell>{r.gender || "—"}</TableCell>
                    <TableCell>{r.relationship || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></CsvExportable>
          ) : (
            <p className="text-sm text-muted-foreground">{t("homestay.no_residents")}</p>
          )}
        </Section>

        {/* Smoking & alcohol */}
        <Section title={t("homestay.section_lifestyle")}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label={t("homestay.f_smoking_in_home")} value={<YesNo value={app.smoking_in_home} />} />
            <Field label={t("homestay.f_smoke_outside")} value={<YesNo value={app.smoke_outside_allowed} />} />
            <Field label={t("homestay.f_drink_in_home")} value={<YesNo value={app.drink_in_home} />} />
            <Field label={t("homestay.f_guest_drink")} value={<YesNo value={app.guest_drink_allowed} />} />
          </div>
        </Section>

        {/* Pets */}
        <Section title={t("homestay.section_pets")}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label={t("homestay.f_has_pets")} value={<YesNo value={app.has_pets} />} />
            <Field label={t("homestay.f_pet_types")} value={app.pet_types} />
            <Field label={t("homestay.f_pet_notes")} value={app.pet_notes} />
          </div>
        </Section>

        {/* Home & rooms */}
        <Section title={t("homestay.section_home")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Field label={t("homestay.f_building_type")} value={app.building_type} />
            <Field
              label={t("homestay.f_home_features")}
              value={app.home_features && app.home_features.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {app.home_features.map((f, i) => <span key={i} className="text-[11px] px-1.5 py-0.5 bg-muted rounded">{f}</span>)}
                </div>
              ) : null}
            />
          </div>
          {app.rooms && app.rooms.length > 0 ? (
            <CsvExportable fileName="homestay-application-placements"><Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("homestay.r_room")}</TableHead>
                  <TableHead>{t("homestay.r_bed")}</TableHead>
                  <TableHead>{t("homestay.r_bath")}</TableHead>
                  <TableHead>{t("homestay.r_lock")}</TableHead>
                  <TableHead>{t("homestay.r_comments")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {app.rooms.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.name || "—"}</TableCell>
                    <TableCell>{r.bed_type || "—"}</TableCell>
                    <TableCell>{r.bath_type || "—"}</TableCell>
                    <TableCell>{r.has_lock ? t("common.yes") : t("common.no")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.comments || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></CsvExportable>
          ) : (
            <p className="text-sm text-muted-foreground">{t("homestay.no_rooms")}</p>
          )}
        </Section>

        {/* Student preferences & packages */}
        <Section title={t("homestay.section_preferences")}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label={t("homestay.f_pref_gender")} value={app.pref_student_gender} />
            <Field label={t("homestay.f_pref_age")} value={app.pref_student_age} />
            <Field label={t("homestay.f_host_under_18")} value={<YesNo value={app.host_under_18} />} />
            <Field
              label={t("homestay.f_packages")}
              value={app.packages_offered && app.packages_offered.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {app.packages_offered.map((p, i) => <span key={i} className="text-[11px] px-1.5 py-0.5 bg-muted rounded">{p}</span>)}
                </div>
              ) : null}
            />
          </div>
        </Section>

        {/* Dietary */}
        <Section title={t("homestay.section_dietary")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label={t("homestay.f_dietary")}
              value={app.dietary && app.dietary.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {app.dietary.map((d, i) => <span key={i} className="text-[11px] px-1.5 py-0.5 bg-muted rounded">{d}</span>)}
                </div>
              ) : null}
            />
            <Field label={t("homestay.f_dietary_notes")} value={app.dietary_notes} />
          </div>
        </Section>

        {/* Profile */}
        <Section title={t("homestay.section_profile")}>
          <div className="grid gap-4">
            <Field label={t("homestay.f_welcome_message")} value={app.welcome_message} />
            <Field label={t("homestay.f_profile_description")} value={app.profile_description} />
          </div>
        </Section>

        {/* Emergency contact */}
        <Section title={t("homestay.section_emergency")}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label={t("homestay.f_name")} value={app.emergency_contact?.name} />
            <Field label={t("homestay.r_relationship")} value={app.emergency_contact?.relationship} />
            <Field label={t("homestay.f_phone")} value={app.emergency_contact?.phone} />
            <Field label={t("homestay.f_email")} value={app.emergency_contact?.email} />
          </div>
        </Section>

        {/* Referral */}
        <Section title={t("homestay.section_referral")}>
          <Field label={t("homestay.f_host_referral")} value={app.host_referral} />
        </Section>

        {/* Agreement */}
        <Section title={t("homestay.section_agreement")}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label={t("homestay.f_agreement_accepted")} value={<YesNo value={app.agreement_accepted} />} />
            <Field label={t("homestay.f_agreement_at")} value={app.agreement_accepted_at ? formatDateTime(app.agreement_accepted_at) : null} />
            <Field label={t("homestay.f_signature")} value={app.signature_name} />
          </div>
        </Section>

        {/* Compliance */}
        <Section title={t("homestay.section_compliance")}>
          <div className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">{t("homestay.wwcc_title")}</p>
            {app.wwcc_records && app.wwcc_records.length > 0 ? (
              <CsvExportable fileName="homestay-application-documents"><Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("homestay.f_name")}</TableHead>
                    <TableHead>{t("homestay.wwcc_number")}</TableHead>
                    <TableHead>{t("homestay.wwcc_expiry")}</TableHead>
                    <TableHead>{t("homestay.wwcc_verified")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {app.wwcc_records.map((w, i) => {
                    const expiring = isExpiringSoon(w.expiry_date);
                    return (
                      <TableRow key={i}>
                        <TableCell>{w.name || "—"}</TableCell>
                        <TableCell>{w.wwcc_number || "—"}</TableCell>
                        <TableCell className={expiring ? "text-red-600 font-semibold" : ""}>{w.expiry_date || "—"}</TableCell>
                        <TableCell>
                          {w.verified
                            ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700"><CheckIcon className="h-3.5 w-3.5" /> {t("common.yes")}</span>
                            : <span className="text-xs text-muted-foreground">{t("common.no")}</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table></CsvExportable>
            ) : (
              <p className="text-sm text-muted-foreground">{t("homestay.no_wwcc")}</p>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3 border-t">
            <Field label={t("homestay.f_insurance_provider")} value={app.insurance_provider} />
            <Field label={t("homestay.f_insurance_policy")} value={app.insurance_policy_no} />
            <Field
              label={t("homestay.f_insurance_expiry")}
              value={app.insurance_expiry
                ? <span className={isExpiringSoon(app.insurance_expiry) ? "text-red-600 font-semibold" : ""}>{app.insurance_expiry}</span>
                : null}
            />
          </div>
        </Section>

        {/* Bank details */}
        <Section title={t("homestay.section_bank")}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label={t("homestay.f_bank_name")} value={app.bank_name} />
            <Field label={t("homestay.f_bank_account_name")} value={app.bank_account_name} />
            <Field label={t("homestay.f_bank_bsb")} value={app.bank_bsb} />
            <Field label={t("homestay.f_bank_account_number")} value={app.bank_account_number} />
            <Field label={t("homestay.f_bank_swift")} value={app.bank_swift} />
          </div>
        </Section>

        {/* Uploaded documents */}
        <Section title={t("homestay.section_documents")}>
          {documents.length > 0 ? (
            <ul className="divide-y">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{d.file_name}</p>
                    <p className="text-xs text-muted-foreground">{d.doc_type}{d.created_at ? ` · ${formatDate(d.created_at)}` : ""}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("homestay.no_documents")}</p>
          )}
        </Section>

        {/* Requested documents */}
        {app.requested_docs && app.requested_docs.length > 0 && (
          <Section title={t("homestay.section_requested_docs")}>
            <ul className="divide-y">
              {app.requested_docs.map((d, i) => (
                <li key={i} className="flex items-center gap-3 py-2">
                  {d.fulfilled ? <CheckIcon className="h-4 w-4 text-green-600 flex-shrink-0" /> : <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{d.doc_type}</p>
                    {d.note && <p className="text-xs text-muted-foreground">{d.note}</p>}
                  </div>
                  <span className={`text-xs font-medium ${d.fulfilled ? "text-green-700" : "text-amber-600"}`}>
                    {d.fulfilled ? t("homestay.doc_fulfilled") : t("homestay.doc_pending")}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {/* Approve dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("homestay.approve_title")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <p className="text-sm text-muted-foreground">{t("homestay.approve_desc")}</p>
            <div className="grid gap-1.5">
              <Label>{t("homestay.label_notes_optional")}</Label>
              <Textarea value={approveNotes} onChange={(e) => setApproveNotes(e.target.value)} rows={3} placeholder={t("homestay.notes_placeholder")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>{t("common.cancel")}</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => approve.mutate()} disabled={approve.isPending}>
              {approve.isPending ? t("common.saving") : t("homestay.btn_approve")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("homestay.reject_title")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <p className="text-sm text-muted-foreground">{t("homestay.reject_desc")}</p>
            <div className="grid gap-1.5">
              <Label>{t("homestay.label_reason_optional")}</Label>
              <Textarea value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} rows={3} placeholder={t("homestay.reason_placeholder")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={() => reject.mutate()} disabled={reject.isPending}>
              {reject.isPending ? t("common.saving") : t("homestay.btn_reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request documents dialog */}
      <Dialog open={docsOpen} onOpenChange={setDocsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("homestay.request_docs_title")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <p className="text-sm text-muted-foreground">{t("homestay.request_docs_desc")}</p>
            <div className="grid gap-3">
              {docRequests.map((d, i) => (
                <div key={i} className="border rounded-lg p-3 grid gap-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 grid gap-2">
                      <Select
                        value={d.doc_type}
                        onValueChange={(v) => setDocRequests((prev) => prev.map((x, idx) => idx === i ? { ...x, doc_type: v } : x))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DOC_PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{t(p.labelKey)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {d.doc_type === "__custom" && (
                        <Input
                          placeholder={t("homestay.doc_custom_placeholder")}
                          value={d.custom}
                          onChange={(e) => setDocRequests((prev) => prev.map((x, idx) => idx === i ? { ...x, custom: e.target.value } : x))}
                        />
                      )}
                      <Input
                        placeholder={t("homestay.doc_note_placeholder")}
                        value={d.note}
                        onChange={(e) => setDocRequests((prev) => prev.map((x, idx) => idx === i ? { ...x, note: e.target.value } : x))}
                      />
                    </div>
                    {docRequests.length > 1 && (
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDocRequests((prev) => prev.filter((_, idx) => idx !== i))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 w-fit" onClick={() => setDocRequests((prev) => [...prev, { doc_type: "WWCC", custom: "", note: "" }])}>
              <Plus className="h-3.5 w-3.5" /> {t("homestay.add_doc")}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocsOpen(false)}>{t("common.cancel")}</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={requestDocs.isPending || docRequests.every((d) => (d.doc_type === "__custom" ? !d.custom.trim() : !d.doc_type))}
              onClick={() => requestDocs.mutate()}
            >
              {requestDocs.isPending ? t("common.saving") : t("homestay.btn_send_request")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

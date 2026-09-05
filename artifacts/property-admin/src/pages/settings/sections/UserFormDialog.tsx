import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { DateInput } from "@/components/ui/date-input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, UserPlus, Pencil, Upload, X, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime } from "@/lib/date";
import { CameraInput } from "@/components/CameraButton";

/** Every editable field of an admin user, flat — the same shape drives create
 *  and edit; `mode` only decides which of them are required or read-only. */
export interface UserFormValues {
  last_name: string;
  first_name: string;
  email: string;
  role: string;
  is_active: boolean;
  password: string;
  phone: string;
  date_of_birth: string;
  postcode: string;
  address_line1: string;
  address_detail: string;
  locale: string;
  department: string;
  /** 회계 접근 범위의 소속. `department`(표시용 자유 텍스트)와 다르다. */
  branch_id: string;
  team_id: string;
  job_title: string;
  employee_no: string;
  joined_on: string;
  emergency_contact_name: string;
  emergency_contact_relation: string;
  emergency_contact_phone: string;
  profile_photo_url: string;
  business_card_front_id: string;
  business_card_back_id: string;
  notes: string;
}

export const EMPTY_USER_FORM: UserFormValues = {
  last_name: "", first_name: "", email: "", role: "Admin", is_active: true, password: "",
  phone: "", date_of_birth: "", postcode: "", address_line1: "", address_detail: "", locale: "",
  department: "", branch_id: "", team_id: "", job_title: "", employee_no: "", joined_on: "",
  emergency_contact_name: "", emergency_contact_relation: "", emergency_contact_phone: "",
  profile_photo_url: "", business_card_front_id: "", business_card_back_id: "", notes: "",
};

interface ActivityRow {
  id: number;
  action: string;
  actor_email: string | null;
  ip_address: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null → create mode; a user id → edit mode (the detail is fetched). */
  userId: number | null;
  onSaved: () => void;
}

const LOCALES = ["en", "ko", "ja", "zh", "th", "vi"];

export function UserFormDialog({ open, onOpenChange, userId, onSaved }: Props) {
  // 지점·팀 목록. 조직이 없으면 셀렉터는 "소속 없음"만 남고, 그건 스코프를 아직
  // 켜지 않은 인스턴스의 정상 상태다.
  const { data: branchResp } = useQuery<{ data: Array<{ id: number; name: string }> }>({
    queryKey: ["branches"],
    enabled: open,
    queryFn: async () => {
      const res = await apiFetch("/api/v1/branches");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
  const { data: teamResp } = useQuery<{ data: Array<{ id: number; name: string; branch_id: number }> }>({
    queryKey: ["teams"],
    enabled: open,
    queryFn: async () => {
      const res = await apiFetch("/api/v1/teams");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
  const branches = branchResp?.data;
  const teams = teamResp?.data;

  const { t } = useTranslation();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();
  const isEdit = userId !== null;
  const isSuperAdmin = currentUser?.role === "SuperAdmin";
  const isSelf = isEdit && userId === currentUser?.id;

  const [form, setForm] = useState<UserFormValues>(EMPTY_USER_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState<"photo" | "front" | "back" | null>(null);
  const [cardPreview, setCardPreview] = useState<{ front: string | null; back: string | null }>({ front: null, back: null });
  const photoInput = useRef<HTMLInputElement>(null);
  const frontInput = useRef<HTMLInputElement>(null);
  const backInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  const { data: detail, isLoading } = useQuery<{ success: boolean; user: Record<string, any>; activity: ActivityRow[] }>({
    queryKey: ["admin-user", userId],
    enabled: open && isEdit,
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/admin/users/${userId}`);
      if (!res.ok) throw new Error("Failed to load user");
      return res.json();
    },
  });

  // Load the record into the form each time the dialog opens on a user.
  useEffect(() => {
    if (!open) return;
    if (!isEdit) { setForm(EMPTY_USER_FORM); setCardPreview({ front: null, back: null }); return; }
    const u = detail?.user;
    if (!u) return;
    setForm({
      ...EMPTY_USER_FORM,
      last_name: u.last_name ?? "",
      first_name: u.first_name ?? "",
      email: u.email ?? "",
      role: u.role ?? "Admin",
      is_active: !!u.is_active,
      password: "",
      phone: u.phone ?? "",
      date_of_birth: u.date_of_birth ?? "",
      postcode: u.postcode ?? "",
      address_line1: u.address_line1 ?? "",
      address_detail: u.address_detail ?? "",
      locale: u.locale ?? "",
      department: u.department ?? "",
      branch_id: u.branch_id != null ? String(u.branch_id) : "",
      team_id: u.team_id != null ? String(u.team_id) : "",
      job_title: u.job_title ?? "",
      employee_no: u.employee_no ?? "",
      joined_on: u.joined_on ?? "",
      emergency_contact_name: u.emergency_contact_name ?? "",
      emergency_contact_relation: u.emergency_contact_relation ?? "",
      emergency_contact_phone: u.emergency_contact_phone ?? "",
      profile_photo_url: u.profile_photo_url ?? "",
      business_card_front_id: u.business_card_front_id ?? "",
      business_card_back_id: u.business_card_back_id ?? "",
      notes: u.notes ?? "",
    });
    setCardPreview({ front: u.business_card_front_url ?? null, back: u.business_card_back_url ?? null });
  }, [open, isEdit, detail]);

  async function uploadImage(kind: "photo" | "front" | "back", file: File) {
    setUploading(kind);
    try {
      const body = new FormData();
      body.append("image", file);
      const path = kind === "photo" ? "/api/v1/admin/users/photo" : "/api/v1/admin/users/business-card";
      const res = await apiFetch(path, { method: "POST", body });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? t("settings_users.toast_upload_failed"));
      if (kind === "photo") {
        set("profile_photo_url", data.url);
      } else if (kind === "front") {
        set("business_card_front_id", data.public_id);
        setCardPreview(p => ({ ...p, front: data.preview_url }));
      } else {
        set("business_card_back_id", data.public_id);
        setCardPreview(p => ({ ...p, back: data.preview_url }));
      }
    } catch (err: any) {
      toast({ title: t("settings_users.toast_error"), description: err.message ?? t("settings_users.toast_upload_failed"), variant: "destructive" });
    } finally {
      setUploading(null);
    }
  }

  function profilePayload(): Record<string, unknown> {
    return {
      phone: form.phone,
      date_of_birth: form.date_of_birth,
      postcode: form.postcode,
      address_line1: form.address_line1,
      address_detail: form.address_detail,
      locale: form.locale,
      department: form.department,
      job_title: form.job_title,
      employee_no: form.employee_no,
      joined_on: form.joined_on,
      emergency_contact_name: form.emergency_contact_name,
      emergency_contact_relation: form.emergency_contact_relation,
      emergency_contact_phone: form.emergency_contact_phone,
      profile_photo_url: form.profile_photo_url,
      business_card_front_id: form.business_card_front_id,
      business_card_back_id: form.business_card_back_id,
      notes: form.notes,
    };
  }

  async function save() {
    setIsSaving(true);
    try {
      let res: Response;
      if (isEdit) {
        // Privileged fields only when they actually changed, so a plain Admin
        // saving a profile edit never trips the SuperAdmin gate.
        const payload: Record<string, unknown> = {
          first_name: form.first_name,
          last_name: form.last_name,
          ...profilePayload(),
        };
        const u = detail?.user;
        // 소속은 바뀐 때만 보낸다 — 서버가 관리자 권한을 요구하므로, 안 바뀌었는데
        // 실어 보내면 일반 직원의 프로필 저장이 403 으로 막힌다.
        const curBranch = u?.branch_id != null ? String(u.branch_id) : "";
        const curTeam = u?.team_id != null ? String(u.team_id) : "";
        if (form.branch_id !== curBranch) payload["branch_id"] = form.branch_id ? Number(form.branch_id) : null;
        if (form.team_id !== curTeam) payload["team_id"] = form.team_id ? Number(form.team_id) : null;
        if (isSuperAdmin && u) {
          const email = form.email.trim().toLowerCase();
          if (email !== String(u.email ?? "").toLowerCase()) payload["email"] = email;
          if (form.role !== u.role) payload["role"] = form.role;
          if (form.is_active !== !!u.is_active) payload["is_active"] = form.is_active;
          if (form.password.trim()) payload["password"] = form.password;
        }
        res = await apiFetch(`/api/v1/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await apiFetch("/api/v1/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: form.first_name,
            last_name: form.last_name,
            email: form.email,
            password: form.password,
            role: form.role,
            ...profilePayload(),
          }),
        });
      }
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? t("settings_users.toast_action_failed"));
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user", userId] });
      toast({ title: isEdit ? t("settings_users.toast_user_updated") : t("settings_users.toast_user_created") });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: t("settings_users.toast_error"), description: err.message ?? t("settings_users.toast_action_failed"), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  const sectionTitle = "text-sm font-semibold text-foreground";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isSaving) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? <Pencil className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {isEdit ? t("settings_users.edit_user_title") : t("settings_users.add_user_title")}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? t("settings_users.edit_user_desc") : t("settings_users.add_user_desc")}
          </DialogDescription>
        </DialogHeader>

        {isEdit && isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> {t("settings_users.loading_users")}
          </div>
        ) : (
          <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (!isSaving) save(); }}>
            {/* ── Account ─────────────────────────────── */}
            <div className="space-y-3">
              <h4 className={sectionTitle}>{t("settings_users.section_account")}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="uf-last">{t("settings_users.field_last_name")} *</Label>
                  <Input id="uf-last" value={form.last_name} required
                    onChange={(e) => set("last_name", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="uf-first">{t("settings_users.field_first_name")} *</Label>
                  <Input id="uf-first" value={form.first_name} required
                    onChange={(e) => set("first_name", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uf-email">{t("settings_users.field_email")} *</Label>
                <Input id="uf-email" type="email" value={form.email} required
                  disabled={isEdit && !isSuperAdmin}
                  onChange={(e) => set("email", e.target.value)} />
                {isEdit && !isSuperAdmin && (
                  <p className="text-xs text-muted-foreground">{t("settings_users.superadmin_only")}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="uf-role">{t("settings_users.field_role")}</Label>
                  <Select value={form.role} disabled={(isEdit && !isSuperAdmin) || isSelf}
                    onValueChange={(v) => set("role", v)}>
                    <SelectTrigger id="uf-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admin">{t("settings_users.role_admin")}</SelectItem>
                      <SelectItem value="Viewer">{t("settings_users.role_viewer")}</SelectItem>
                      {isSuperAdmin && (
                        <SelectItem value="SuperAdmin">{t("settings_users.role_superadmin")}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {isSelf && <p className="text-xs text-muted-foreground">{t("settings_users.self_edit_hint")}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="uf-locale">{t("settings_users.field_locale")}</Label>
                  <Select value={form.locale || "auto"} onValueChange={(v) => set("locale", v === "auto" ? "" : v)}>
                    <SelectTrigger id="uf-locale"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">{t("settings_users.locale_auto")}</SelectItem>
                      {LOCALES.map(code => (
                        <SelectItem key={code} value={code}>{t(`settings_users.locale_${code}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uf-password">
                  {isEdit ? t("settings_users.field_reset_password") : `${t("settings_users.field_temp_password")} *`}
                </Label>
                <Input id="uf-password" type="text" autoComplete="off" value={form.password}
                  required={!isEdit} disabled={isEdit && !isSuperAdmin}
                  placeholder={isEdit ? t("settings_users.field_reset_password_ph") : undefined}
                  onChange={(e) => set("password", e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  {isEdit ? t("settings_users.field_reset_password_hint") : t("settings_users.field_temp_password_hint")}
                </p>
              </div>
              {isEdit && (
                <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                  <div>
                    <Label htmlFor="uf-active" className="text-sm">{t("settings_users.field_is_active")}</Label>
                    <p className="text-xs text-muted-foreground">{t("settings_users.field_is_active_hint")}</p>
                  </div>
                  <Switch id="uf-active" checked={form.is_active} disabled={!isSuperAdmin || isSelf}
                    onCheckedChange={(v) => set("is_active", v)} />
                </div>
              )}
            </div>

            <Separator />

            {/* ── Personal details ────────────────────── */}
            <div className="space-y-3">
              <h4 className={sectionTitle}>{t("settings_users.section_personal")}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="uf-phone">{t("settings_users.field_phone")}</Label>
                  <Input id="uf-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="uf-dob">{t("settings_users.field_dob")}</Label>
                  <DateInput value={form.date_of_birth} onChange={(iso) => set("date_of_birth", iso)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="uf-postcode">{t("settings_users.field_postcode")}</Label>
                  <Input id="uf-postcode" value={form.postcode} onChange={(e) => set("postcode", e.target.value)} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="uf-addr">{t("settings_users.field_address")}</Label>
                  <Input id="uf-addr" value={form.address_line1} onChange={(e) => set("address_line1", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uf-addr2">{t("settings_users.field_address_detail")}</Label>
                <Input id="uf-addr2" value={form.address_detail} onChange={(e) => set("address_detail", e.target.value)} />
              </div>
            </div>

            <Separator />

            {/* ── Employment ──────────────────────────── */}
            <div className="space-y-3">
              <h4 className={sectionTitle}>{t("settings_users.section_employment")}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="uf-dept">{t("settings_users.field_department")}</Label>
                  <Input id="uf-dept" value={form.department} onChange={(e) => set("department", e.target.value)} />
                </div>
                {/* 소속(지점·팀)은 표시용 부서명과 다르다 — 회계에서 무엇을 볼 수
                    있는지를 정한다. 팀을 고르면 지점은 서버가 팀의 지점으로 맞춘다. */}
                <div>
                  <Label>{t("settings_users.field_branch")}</Label>
                  <Select
                    value={form.branch_id || "_none"}
                    onValueChange={(v) => { set("branch_id", v === "_none" ? "" : v); set("team_id", ""); }}
                  >
                    <SelectTrigger><SelectValue placeholder={t("settings_users.no_branch")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">{t("settings_users.no_branch")}</SelectItem>
                      {(branches ?? []).map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("settings_users.field_team")}</Label>
                  <Select
                    value={form.team_id || "_none"}
                    onValueChange={(v) => set("team_id", v === "_none" ? "" : v)}
                  >
                    <SelectTrigger><SelectValue placeholder={t("settings_users.no_team")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">{t("settings_users.no_team")}</SelectItem>
                      {(teams ?? [])
                        .filter((tm) => !form.branch_id || String(tm.branch_id) === form.branch_id)
                        .map((tm) => (
                          <SelectItem key={tm.id} value={String(tm.id)}>{tm.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="uf-title">{t("settings_users.field_job_title")}</Label>
                  <Input id="uf-title" value={form.job_title} onChange={(e) => set("job_title", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="uf-empno">{t("settings_users.field_employee_no")}</Label>
                  <Input id="uf-empno" value={form.employee_no} onChange={(e) => set("employee_no", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="uf-joined">{t("settings_users.field_joined_on")}</Label>
                  <DateInput value={form.joined_on} onChange={(iso) => set("joined_on", iso)} />
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Emergency contact ───────────────────── */}
            <div className="space-y-3">
              <h4 className={sectionTitle}>{t("settings_users.section_emergency")}</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="uf-ec-name">{t("settings_users.field_ec_name")}</Label>
                  <Input id="uf-ec-name" value={form.emergency_contact_name}
                    onChange={(e) => set("emergency_contact_name", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="uf-ec-rel">{t("settings_users.field_ec_relation")}</Label>
                  <Input id="uf-ec-rel" value={form.emergency_contact_relation}
                    onChange={(e) => set("emergency_contact_relation", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="uf-ec-phone">{t("settings_users.field_ec_phone")}</Label>
                  <Input id="uf-ec-phone" value={form.emergency_contact_phone}
                    onChange={(e) => set("emergency_contact_phone", e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t("settings_users.emergency_privacy_note")}</p>
            </div>

            <Separator />

            {/* ── Photo & business cards ──────────────── */}
            <div className="space-y-3">
              <h4 className={sectionTitle}>{t("settings_users.section_media")}</h4>
              <div className="grid grid-cols-3 gap-3">
                {/* Profile photo */}
                <div className="space-y-2">
                  <Label>{t("settings_users.field_photo")}</Label>
                  <div className="relative aspect-square rounded-lg border border-dashed bg-muted/40 overflow-hidden flex items-center justify-center">
                    {form.profile_photo_url ? (
                      <img src={form.profile_photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                    {uploading === "photo" && (
                      <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <Button type="button" size="sm" variant="outline" className="h-7 gap-1 flex-1"
                      onClick={() => photoInput.current?.click()} disabled={uploading !== null}>
                      <Upload className="h-3.5 w-3.5" /> {t("settings_users.upload")}
                    </Button>
                    {form.profile_photo_url && (
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => set("profile_photo_url", "")} aria-label={t("common.clear")}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <input ref={photoInput} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage("photo", f); e.target.value = ""; }} />
                  {/* 폰에서는 찍는 것이 곧 첨부다. 같은 핸들러로 들어간다. */}
                  <CameraInput onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage("photo", f); e.target.value = ""; }} multiple={false} />
                </div>

                {/* Card front / back */}
                {([["front", frontInput], ["back", backInput]] as const).map(([side, ref]) => {
                  const idKey = side === "front" ? "business_card_front_id" : "business_card_back_id";
                  const preview = cardPreview[side];
                  return (
                    <div key={side} className="space-y-2">
                      <Label>{side === "front" ? t("settings_users.field_card_front") : t("settings_users.field_card_back")}</Label>
                      <div className="relative aspect-square rounded-lg border border-dashed bg-muted/40 overflow-hidden flex items-center justify-center">
                        {preview ? (
                          <img src={preview} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        )}
                        {uploading === side && (
                          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin" />
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <Button type="button" size="sm" variant="outline" className="h-7 gap-1 flex-1"
                          onClick={() => ref.current?.click()} disabled={uploading !== null}>
                          <Upload className="h-3.5 w-3.5" /> {t("settings_users.upload")}
                        </Button>
                        {form[idKey] && (
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => { set(idKey, ""); setCardPreview(p => ({ ...p, [side]: null })); }}
                            aria-label={t("common.clear")}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <input ref={ref} type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(side, f); e.target.value = ""; }} />
                      {/* 폰에서는 찍는 것이 곧 첨부다. 같은 핸들러로 들어간다. */}
                      <CameraInput onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(side, f); e.target.value = ""; }} multiple={false} />
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">{t("settings_users.card_privacy_note")}</p>
            </div>

            <Separator />

            {/* ── Notes ───────────────────────────────── */}
            <div className="space-y-1.5">
              <Label htmlFor="uf-notes">{t("settings_users.field_notes")}</Label>
              <Textarea id="uf-notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>

            {/* ── Activity (edit only) ────────────────── */}
            {isEdit && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className={sectionTitle}>{t("settings_users.section_activity")}</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("settings_users.last_login")}</p>
                      <p>{detail?.user?.last_login_at ? formatDateTime(detail.user.last_login_at) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("settings_users.created_at")}</p>
                      <p>{detail?.user?.created_at ? formatDateTime(detail.user.created_at) : "—"}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border divide-y max-h-56 overflow-y-auto">
                    {(detail?.activity ?? []).length === 0 ? (
                      <p className="px-3 py-4 text-center text-sm text-muted-foreground">{t("settings_users.no_activity")}</p>
                    ) : (
                      (detail?.activity ?? []).map(row => (
                        <div key={row.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                          <span className="font-medium">{row.action}</span>
                          <span className="text-muted-foreground truncate flex-1">{row.actor_email ?? "—"}</span>
                          <span className="text-muted-foreground shrink-0">{formatDateTime(row.created_at)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isSaving || uploading !== null} className="gap-1.5">
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? t("common.save") : t("settings_users.create_user")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

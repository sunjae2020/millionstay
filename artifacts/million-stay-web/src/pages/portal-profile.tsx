import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useAuthStore } from "@/lib/store";
import { PortalLayout } from "@/components/portal-layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Lock, Phone, Globe, Briefcase, Car, ShieldAlert,
  Banknote, Eye, EyeOff, Save, Plus, Pencil, Trash2,
  CreditCard, ChevronDown, X, Check, Mail, Camera, Loader2, KeyRound,
} from "lucide-react";
import { getApiBase } from "@/lib/api-base";
import {
  passkeysSupported,
  isPasskeyCancel,
  listPasskeys,
  registerPasskey,
  deletePasskey,
  type PasskeyCredential,
} from "@/lib/passkey";
import { DateInput } from "@/components/ui/date-input";

const API_BASE = getApiBase();

type ProfileForm = {
  first_name: string; last_name: string; phone: string; nationality: string;
  date_of_birth: string; gender: string;
};
type StayForm = {
  company: string; job_title: string; stay_purpose: string;
  vehicle_plate: string; parking_required: boolean;
};
type BankForm = {
  bank_name: string; bank_account_name: string;
  bank_account_number: string; preferred_payment_method: string;
};
type EmergencyContact = {
  id: number; name: string; relationship: string; phone: string; email: string; is_primary: boolean;
};
type EmergencyForm = { name: string; relationship: string; phone: string; email: string; is_primary: boolean };

const STAY_PURPOSES = [
  { value: "residence", key: "portal.profile.purpose_residence" },
  { value: "business", key: "portal.profile.purpose_business" },
  { value: "travel", key: "portal.profile.purpose_travel" },
  { value: "study", key: "portal.profile.purpose_study" },
  { value: "other", key: "portal.profile.purpose_other" },
];
const PAYMENT_METHODS = [
  { value: "bank_transfer", key: "portal.profile.pay_bank_transfer" },
  { value: "card", key: "portal.profile.pay_card" },
  { value: "cash", key: "portal.profile.pay_cash" },
];
const GENDERS = [
  { value: "Male", key: "portal.profile.gender_male" },
  { value: "Female", key: "portal.profile.gender_female" },
  { value: "Non-binary", key: "portal.profile.gender_non_binary" },
  { value: "Prefer not to say", key: "portal.profile.gender_prefer_not" },
];

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white";
const labelCls = "block text-xs font-medium text-gray-500 mb-1.5";

function SectionHeader({ icon: Icon, title, color = "bg-primary/10", iconColor = "text-primary" }: {
  icon: React.ElementType; title: string; color?: string; iconColor?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center`}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <h2 className="font-semibold text-gray-800">{title}</h2>
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const { t } = useTranslation();
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} appearance-none pr-8`}
        >
          <option value="">{t("portal.profile.select_placeholder", "— Select —")}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}

export default function PortalProfile() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { token, guest, setGuest, logout } = useAuthStore();
  const { toast } = useToast();

  useEffect(() => {
    if (!token) setLocation("/login?redirect=/portal/profile");
  }, [token, setLocation]);

  // ─── Avatar state ─────────────────────────────────────────────────────────
  const [avatarUrl, setAvatarUrl] = useState<string | null>(guest?.avatar_url ?? null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Section loading states ───────────────────────────────────────────────
  const [loadingPersonal, setLoadingPersonal] = useState(false);
  const [loadingStay, setLoadingStay] = useState(false);
  const [loadingBank, setLoadingBank] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  // ─── Profile forms ────────────────────────────────────────────────────────
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    first_name: guest?.first_name ?? "",
    last_name: guest?.last_name ?? "",
    phone: guest?.phone ?? "",
    nationality: "",
    date_of_birth: "",
    gender: "",
  });
  const [stayForm, setStayForm] = useState<StayForm>({
    company: "", job_title: "", stay_purpose: "", vehicle_plate: "", parking_required: false,
  });
  const [bankForm, setBankForm] = useState<BankForm>({
    bank_name: "", bank_account_name: "", bank_account_number: "", preferred_payment_method: "",
  });
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // ─── Emergency contacts ───────────────────────────────────────────────────
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [editContactId, setEditContactId] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState<EmergencyForm>({ name: "", relationship: "", phone: "", email: "", is_primary: false });
  const [loadingContact, setLoadingContact] = useState(false);

  // ─── Passkeys ─────────────────────────────────────────────────────────────
  // Registering the phone here is what makes the one-tap sign-in on the login
  // screen work. The password keeps working either way.
  const [passkeys, setPasskeys] = useState<PasskeyCredential[]>([]);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  async function loadPasskeys() {
    try { setPasskeys(await listPasskeys()); } catch { setPasskeys([]); }
  }
  useEffect(() => { if (token && passkeysSupported()) void loadPasskeys(); }, [token]);

  async function addPasskey() {
    setPasskeyBusy(true);
    try {
      await registerPasskey();
      await loadPasskeys();
      toast({ title: t("portal.profile.passkey_added", "Passkey added") });
    } catch (err: unknown) {
      if (!isPasskeyCancel(err)) {
        toast({ variant: "destructive", title: t("portal.profile.passkey_add_failed", "Could not add the passkey"), description: (err as { message?: string })?.message });
      }
    } finally { setPasskeyBusy(false); }
  }

  async function removePasskey(id: number) {
    if (!window.confirm(t("portal.profile.passkey_remove_confirm", "Remove this passkey? That device will have to use its password again."))) return;
    try { await deletePasskey(id); await loadPasskeys(); }
    catch (err: unknown) {
      toast({ variant: "destructive", title: t("portal.profile.passkey_remove_failed", "Could not remove the passkey"), description: (err as { message?: string })?.message });
    }
  }

  // ─── Auth helper ─────────────────────────────────────────────────────────
  function handleUnauthorized() {
    logout();
    setLocation("/login?reason=session_expired");
  }

  function authHeaders() {
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  // ─── Load full profile on mount ───────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/v1/guest/profile`, { headers: authHeaders() })
      .then(async (r) => {
        if (r.status === 401) { handleUnauthorized(); return; }
        const j = await r.json();
        if (!j.data) return;
        const d = j.data;
        setProfileForm({
          first_name: d.first_name ?? "",
          last_name: d.last_name ?? "",
          phone: d.phone ?? "",
          nationality: d.nationality ?? "",
          date_of_birth: d.date_of_birth ?? "",
          gender: d.gender ?? "",
        });
        setStayForm({
          company: d.company ?? "",
          job_title: d.job_title ?? "",
          stay_purpose: d.stay_purpose ?? "",
          vehicle_plate: d.vehicle_plate ?? "",
          parking_required: d.parking_required ?? false,
        });
        setBankForm({
          bank_name: d.bank_name ?? "",
          bank_account_name: d.bank_account_name ?? "",
          bank_account_number: d.bank_account_number ?? "",
          preferred_payment_method: d.preferred_payment_method ?? "",
        });
        setContacts(d.emergency_contacts ?? []);
        setAvatarUrl(d.avatar_url ?? null);
      })
      .catch(() => {});
  }, [token]);

  // ─── Save helpers ─────────────────────────────────────────────────────────
  async function putProfile(body: Record<string, unknown>, setLoading: (v: boolean) => void, section: string) {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/guest/profile`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      const j = await res.json();
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : (j.error?.message ?? t("portal.profile.toast_update_failed", "Update failed")));
      if (j.data) {
        setGuest({ ...guest!, first_name: j.data.first_name ?? null, last_name: j.data.last_name ?? null, phone: j.data.phone ?? null });
      }
      toast({ title: t("portal.profile.toast_section_updated", "{{section}} updated", { section }), description: t("portal.profile.toast_saved_successfully", "Saved successfully.") });
    } catch (e: unknown) {
      toast({ title: t("portal.profile.toast_update_failed", "Update failed"), description: e instanceof Error ? e.message : t("portal.profile.toast_try_again", "Please try again."), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const savePersonal = () => putProfile(profileForm, setLoadingPersonal, t("portal.profile.section_personal_information", "Personal information"));
  const saveStay = () => putProfile(stayForm, setLoadingStay, t("portal.profile.section_stay_information", "Stay information"));
  const saveBank = () => putProfile(bankForm, setLoadingBank, t("portal.profile.section_deposit_account", "Deposit account"));

  // ─── Avatar upload ────────────────────────────────────────────────────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: t("portal.profile.toast_invalid_file_type", "Invalid file type"), description: t("portal.profile.toast_select_image", "Please select an image file."), variant: "destructive" }); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: t("portal.profile.toast_file_too_large", "File too large"), description: t("portal.profile.toast_max_file_size", "Maximum file size is 5MB."), variant: "destructive" }); return;
    }
    setAvatarLoading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch(`${API_BASE}/api/v1/guest/profile/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? t("portal.profile.toast_upload_failed", "Upload failed"));
      const newUrl = j.data.avatar_url;
      setAvatarUrl(newUrl);
      setGuest({ ...guest!, avatar_url: newUrl });
      toast({ title: t("portal.profile.toast_photo_updated", "Profile photo updated"), description: t("portal.profile.toast_photo_saved", "Your photo has been saved.") });
    } catch (e: unknown) {
      toast({ title: t("portal.profile.toast_upload_failed", "Upload failed"), description: e instanceof Error ? e.message : t("portal.profile.toast_try_again", "Please try again."), variant: "destructive" });
    } finally {
      setAvatarLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAvatarDelete = async () => {
    setAvatarLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/guest/profile/avatar`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) throw new Error(t("portal.profile.toast_delete_failed", "Delete failed"));
      setAvatarUrl(null);
      setGuest({ ...guest!, avatar_url: null });
      toast({ title: t("portal.profile.toast_photo_removed", "Profile photo removed") });
    } catch (e: unknown) {
      toast({ title: t("portal.profile.toast_failed", "Failed"), description: e instanceof Error ? e.message : t("portal.profile.toast_try_again", "Please try again."), variant: "destructive" });
    } finally {
      setAvatarLoading(false);
    }
  };

  // ─── Password change ──────────────────────────────────────────────────────
  const handlePasswordSave = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast({ title: t("portal.profile.toast_passwords_no_match", "Passwords don't match"), variant: "destructive" }); return;
    }
    if (passwordForm.new_password.length < 8) {
      toast({ title: t("portal.profile.toast_password_too_short", "Password too short"), description: t("portal.profile.toast_password_min", "At least 8 characters required."), variant: "destructive" }); return;
    }
    setLoadingPassword(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/guest/change-password`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ current_password: passwordForm.current_password, new_password: passwordForm.new_password }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      const j = await res.json();
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : (j.error?.message ?? t("portal.profile.toast_change_failed", "Change failed")));
      toast({ title: t("portal.profile.toast_password_changed", "Password changed"), description: t("portal.profile.toast_password_updated", "Your password has been updated.") });
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (e: unknown) {
      toast({ title: t("portal.profile.toast_error", "Error"), description: e instanceof Error ? e.message : t("portal.profile.toast_try_again", "Please try again."), variant: "destructive" });
    } finally {
      setLoadingPassword(false);
    }
  };

  // ─── Emergency contact CRUD ───────────────────────────────────────────────
  const resetContactForm = () => setContactForm({ name: "", relationship: "", phone: "", email: "", is_primary: false });

  const handleAddContact = async () => {
    if (!contactForm.name.trim()) {
      toast({ title: t("portal.profile.toast_name_required", "Name is required"), variant: "destructive" }); return;
    }
    setLoadingContact(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/guest/emergency-contacts`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify(contactForm),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message ?? j.error ?? t("portal.profile.toast_failed_add_contact", "Failed to add contact"));
      setContacts((prev) => [...prev, j.data]);
      setShowAddContact(false);
      resetContactForm();
      toast({ title: t("portal.profile.toast_contact_added", "Emergency contact added") });
    } catch (e: unknown) {
      toast({ title: t("portal.profile.toast_error", "Error"), description: e instanceof Error ? e.message : t("portal.profile.toast_try_again", "Please try again."), variant: "destructive" });
    } finally {
      setLoadingContact(false);
    }
  };

  const handleUpdateContact = async (id: number) => {
    setLoadingContact(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/guest/emergency-contacts/${id}`, {
        method: "PUT", headers: authHeaders(), body: JSON.stringify(contactForm),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message ?? j.error ?? t("portal.profile.toast_failed_update", "Failed to update"));
      setContacts((prev) => prev.map((c) => (c.id === id ? j.data : c)));
      setEditContactId(null);
      resetContactForm();
      toast({ title: t("portal.profile.toast_contact_updated", "Emergency contact updated") });
    } catch (e: unknown) {
      toast({ title: t("portal.profile.toast_error", "Error"), description: e instanceof Error ? e.message : t("portal.profile.toast_try_again", "Please try again."), variant: "destructive" });
    } finally {
      setLoadingContact(false);
    }
  };

  const handleDeleteContact = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/guest/emergency-contacts/${id}`, {
        method: "DELETE", headers: authHeaders(),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) throw new Error(t("portal.profile.toast_failed_delete", "Failed to delete"));
      setContacts((prev) => prev.filter((c) => c.id !== id));
      toast({ title: t("portal.profile.toast_contact_removed", "Emergency contact removed") });
    } catch {
      toast({ title: t("portal.profile.toast_error", "Error"), description: t("portal.profile.toast_could_not_delete", "Could not delete contact."), variant: "destructive" });
    }
  };

  const startEditContact = (c: EmergencyContact) => {
    setEditContactId(c.id);
    setContactForm({ name: c.name, relationship: c.relationship ?? "", phone: c.phone ?? "", email: c.email ?? "", is_primary: c.is_primary });
    setShowAddContact(false);
  };

  if (!token) return null;

  return (
    <PortalLayout active="/portal/profile">
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">

        {/* ── 0. Profile Photo ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}
          className="bg-white rounded-2xl border p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Camera className="h-4 w-4 text-primary" />
            </div>
            <h2 className="font-semibold text-gray-800">{t("portal.profile.photo_title", "Profile Photo")}</h2>
          </div>

          <div className="flex items-center gap-6">
            {/* Avatar Preview */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={t("portal.profile.photo_alt", "Profile")} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-gray-400">
                    {(profileForm.first_name?.[0] ?? guest?.email?.[0] ?? "G").toUpperCase()}
                  </span>
                )}
              </div>
              {avatarLoading && (
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                </div>
              )}
            </div>

            {/* Upload Controls */}
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-3">
                {t("portal.profile.photo_help", "Upload a profile photo. Recommended: square image, at least 200×200px, max 5MB.")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarLoading}
                  className="bg-primary hover:bg-primary/90 gap-2"
                  size="sm"
                >
                  <Camera className="h-4 w-4" />
                  {avatarUrl ? t("portal.profile.change_photo") : t("portal.profile.upload_photo")}
                </Button>
                {avatarUrl && (
                  <Button
                    onClick={handleAvatarDelete}
                    disabled={avatarLoading}
                    variant="outline"
                    size="sm"
                    className="gap-2 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("portal.profile.remove", "Remove")}
                  </Button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
          </div>
        </motion.div>

        {/* ── 1. Personal Information ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}
          className="bg-white rounded-2xl border p-6">
          <SectionHeader icon={User} title={t("portal.profile.personal_title")} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t("portal.profile.first_name", "First Name")}</label>
              <input type="text" value={profileForm.first_name}
                onChange={(e) => setProfileForm((f) => ({ ...f, first_name: e.target.value }))}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t("portal.profile.last_name", "Last Name")}</label>
              <input type="text" value={profileForm.last_name}
                onChange={(e) => setProfileForm((f) => ({ ...f, last_name: e.target.value }))}
                className={inputCls} />
            </div>
            <div>
              <label className={`${labelCls} flex items-center gap-1`}><Mail className="h-3 w-3" /> {t("portal.profile.email_address", "Email Address")}</label>
              <input type="email" value={guest?.email ?? ""} readOnly
                className={`${inputCls} bg-gray-50 text-gray-500 cursor-default`} />
              <p className="text-xs text-gray-400 mt-1">{t("portal.profile.email_cannot_change", "Email cannot be changed")}</p>
            </div>
            <div>
              <label className={`${labelCls} flex items-center gap-1`}><Phone className="h-3 w-3" /> {t("portal.profile.phone_number", "Phone Number")}</label>
              <input type="tel" value={profileForm.phone} placeholder="010-0000-0000"
                onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                className={inputCls} />
            </div>
            <div>
              <label className={`${labelCls} flex items-center gap-1`}><Globe className="h-3 w-3" /> {t("portal.profile.nationality", "Nationality")}</label>
              <input type="text" value={profileForm.nationality} placeholder={t("portal.profile.nationality_ph", "e.g. Korean")}
                onChange={(e) => setProfileForm((f) => ({ ...f, nationality: e.target.value }))}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t("portal.profile.date_of_birth", "Date of Birth")}</label>
              <DateInput value={profileForm.date_of_birth}
                onChange={(v) => setProfileForm((f) => ({ ...f, date_of_birth: v }))}
                className={inputCls} />
            </div>
            <SelectField label={t("portal.profile.gender", "Gender")} value={profileForm.gender}
              onChange={(v) => setProfileForm((f) => ({ ...f, gender: v }))}
              options={GENDERS.map((g) => ({ value: g.value, label: t(g.key, g.value) }))} />
          </div>

          <div className="mt-5 flex justify-end">
            <Button onClick={savePersonal} disabled={loadingPersonal} className="bg-primary hover:bg-primary/90 gap-2">
              <Save className="h-4 w-4" />{loadingPersonal ? t("portal.profile.saving") : t("portal.profile.save")}
            </Button>
          </div>
        </motion.div>

        {/* ── 2. Stay / Rental Information ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl border p-6">
          <SectionHeader icon={Briefcase} title={t("portal.profile.stay_title")} color="bg-teal-100" iconColor="text-teal-600" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t("portal.profile.company")}</label>
              <input type="text" value={stayForm.company}
                onChange={(e) => setStayForm((f) => ({ ...f, company: e.target.value }))}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t("portal.profile.job_title")}</label>
              <input type="text" value={stayForm.job_title}
                onChange={(e) => setStayForm((f) => ({ ...f, job_title: e.target.value }))}
                className={inputCls} />
            </div>
            <SelectField label={t("portal.profile.stay_purpose")} value={stayForm.stay_purpose}
              onChange={(v) => setStayForm((f) => ({ ...f, stay_purpose: v }))}
              options={STAY_PURPOSES.map((p) => ({ value: p.value, label: t(p.key) }))} />
            <div>
              <label className={`${labelCls} flex items-center gap-1`}><Car className="h-3 w-3" /> {t("portal.profile.vehicle_plate")}</label>
              <input type="text" value={stayForm.vehicle_plate} placeholder="12가 3456"
                onChange={(e) => setStayForm((f) => ({ ...f, vehicle_plate: e.target.value }))}
                className={inputCls} />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <input type="checkbox" id="parking_required" checked={stayForm.parking_required}
                onChange={(e) => setStayForm((f) => ({ ...f, parking_required: e.target.checked }))}
                className="h-4 w-4 rounded accent-teal-600" />
              <label htmlFor="parking_required" className="text-sm text-gray-600 select-none cursor-pointer">
                {t("portal.profile.parking_required")}
              </label>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <Button onClick={saveStay} disabled={loadingStay} className="bg-teal-600 hover:bg-teal-700 gap-2">
              <Save className="h-4 w-4" />{loadingStay ? t("portal.profile.saving") : t("portal.profile.save")}
            </Button>
          </div>
        </motion.div>

        {/* ── 3. Emergency Contacts ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                <ShieldAlert className="h-4 w-4 text-red-600" />
              </div>
              <h2 className="font-semibold text-gray-800">{t("portal.profile.emergency_title")}</h2>
            </div>
            {!showAddContact && editContactId === null && (
              <Button variant="outline" size="sm" onClick={() => { setShowAddContact(true); resetContactForm(); }}
                className="gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" /> {t("portal.profile.add_contact")}
              </Button>
            )}
          </div>

          {/* Existing contacts */}
          <div className="space-y-3">
            <AnimatePresence>
              {contacts.map((c) => (
                editContactId === c.id ? (
                  <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="border border-red-200 rounded-xl p-4 bg-red-50/30 space-y-3">
                    <ContactForm form={contactForm} setForm={setContactForm} />
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => { setEditContactId(null); resetContactForm(); }}>
                        <X className="h-3.5 w-3.5 mr-1" /> {t("portal.profile.cancel", "Cancel")}
                      </Button>
                      <Button size="sm" disabled={loadingContact} onClick={() => handleUpdateContact(c.id)}
                        className="bg-red-600 hover:bg-red-700 gap-1">
                        <Check className="h-3.5 w-3.5" />{loadingContact ? t("portal.profile.saving") : t("portal.profile.save")}
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-start justify-between rounded-xl border border-gray-100 p-4 bg-gray-50/50">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-gray-800">{c.name}</span>
                        {c.relationship && <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{c.relationship}</span>}
                        {c.is_primary && <span className="text-xs text-red-600 bg-red-50 rounded-full px-2 py-0.5 font-medium">{t("portal.profile.primary", "Primary")}</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                        {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                        {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0 ml-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-blue-600"
                        onClick={() => startEditContact(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-600"
                        onClick={() => handleDeleteContact(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                )
              ))}
            </AnimatePresence>

            {contacts.length === 0 && !showAddContact && (
              <p className="text-sm text-gray-400 text-center py-6">{t("portal.profile.no_contacts", "No emergency contacts yet. Add one for safety.")}</p>
            )}
          </div>

          {/* Add new contact form */}
          <AnimatePresence>
            {showAddContact && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="mt-3 border border-red-200 rounded-xl p-4 bg-red-50/30 space-y-3">
                <p className="text-xs font-medium text-red-700 mb-2">{t("portal.profile.new_emergency_contact", "New Emergency Contact")}</p>
                <ContactForm form={contactForm} setForm={setContactForm} />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => { setShowAddContact(false); resetContactForm(); }}>
                    <X className="h-3.5 w-3.5 mr-1" /> {t("portal.profile.cancel", "Cancel")}
                  </Button>
                  <Button size="sm" disabled={loadingContact} onClick={handleAddContact}
                    className="bg-red-600 hover:bg-red-700 gap-1">
                    <Plus className="h-3.5 w-3.5" />{loadingContact ? t("portal.profile.adding", "Adding…") : t("portal.profile.add_contact", "Add Contact")}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── 4. Bank / Payment Information ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl border p-6">
          <SectionHeader icon={Banknote} title={t("portal.profile.deposit_account_title")} color="bg-green-100" iconColor="text-green-700" />

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 mb-4">
            {t("portal.profile.deposit_notice")}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={`${labelCls} flex items-center gap-1`}><CreditCard className="h-3 w-3" /> {t("portal.profile.bank_name_label")}</label>
              <input type="text" value={bankForm.bank_name} placeholder={t("portal.profile.bank_name_ph")}
                onChange={(e) => setBankForm((f) => ({ ...f, bank_name: e.target.value }))}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t("portal.profile.account_name_label")}</label>
              <input type="text" value={bankForm.bank_account_name} placeholder={t("portal.profile.account_name_ph")}
                onChange={(e) => setBankForm((f) => ({ ...f, bank_account_name: e.target.value }))}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t("portal.profile.account_number_label")}</label>
              <input type="text" value={bankForm.bank_account_number} placeholder={t("portal.profile.account_number_ph")}
                onChange={(e) => setBankForm((f) => ({ ...f, bank_account_number: e.target.value }))}
                className={inputCls} />
            </div>
            <SelectField label={t("portal.profile.payment_method_label")} value={bankForm.preferred_payment_method}
              onChange={(v) => setBankForm((f) => ({ ...f, preferred_payment_method: v }))}
              options={PAYMENT_METHODS.map((m) => ({ value: m.value, label: t(m.key) }))} />
          </div>

          <div className="mt-5 flex justify-end">
            <Button onClick={saveBank} disabled={loadingBank} className="bg-green-700 hover:bg-green-800 gap-2">
              <Save className="h-4 w-4" />{loadingBank ? t("portal.profile.saving") : t("portal.profile.save")}
            </Button>
          </div>
        </motion.div>

        {/* ── 5. Change Password ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border p-6">
          <SectionHeader icon={Lock} title={t("portal.profile.change_password")} color="bg-gray-100" iconColor="text-gray-600" />

          <div className="space-y-4 max-w-sm">
            <div>
              <label className={labelCls}>{t("portal.profile.current_password", "Current Password")}</label>
              <div className="relative">
                <input type={showCurrent ? "text" : "password"} value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm((f) => ({ ...f, current_password: e.target.value }))}
                  className={`${inputCls} pr-10`} />
                <button type="button" onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>{t("portal.profile.new_password", "New Password")}</label>
              <div className="relative">
                <input type={showNew ? "text" : "password"} value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm((f) => ({ ...f, new_password: e.target.value }))}
                  className={`${inputCls} pr-10`} />
                <button type="button" onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>{t("portal.profile.confirm_new_password", "Confirm New Password")}</label>
              <input type="password" value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm((f) => ({ ...f, confirm_password: e.target.value }))}
                className={inputCls} />
            </div>
          </div>

          <div className="mt-5">
            <Button onClick={handlePasswordSave} disabled={loadingPassword} variant="outline" className="gap-2">
              <Lock className="h-4 w-4" />{loadingPassword ? t("portal.profile.changing", "Changing…") : t("portal.profile.change_password", "Change Password")}
            </Button>
          </div>
        </motion.div>

        {/* ── Passkeys ── */}
        {passkeysSupported() && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
            className="bg-white rounded-2xl border p-6">
            <SectionHeader icon={KeyRound} title={t("portal.profile.passkeys_title", "Passkeys")} color="bg-indigo-100" iconColor="text-indigo-600" />
            <p className="text-sm text-gray-500 -mt-2 mb-4">
              {t("portal.profile.passkeys_desc", "Sign in with Face ID, a fingerprint or your device PIN instead of a password.")}
            </p>

            {passkeys.length > 0 && (
              <ul className="divide-y border rounded-xl mb-4">
                {passkeys.map((c) => (
                  <li key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.device_name ?? t("portal.profile.passkey_unnamed", "Passkey")}</p>
                      <p className="text-xs text-gray-500">
                        {c.last_used_at
                          ? t("portal.profile.passkey_last_used", "Last used {{date}}", { date: new Date(c.last_used_at).toLocaleDateString() })
                          : t("portal.profile.passkey_never_used", "Not used yet")}
                      </p>
                    </div>
                    <button type="button" onClick={() => removePasskey(c.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      aria-label={t("portal.profile.passkey_remove", "Remove")}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <Button onClick={addPasskey} disabled={passkeyBusy} variant="outline" className="gap-2">
              <KeyRound className="h-4 w-4" />
              {passkeyBusy
                ? t("portal.profile.passkey_adding", "Adding…")
                : t("portal.profile.passkey_add", "Add this device")}
            </Button>
          </motion.div>
        )}

      </div>
    </PortalLayout>
  );
}

// ─── Sub-component: Emergency Contact Form ─────────────────────────────────
function ContactForm({ form, setForm }: { form: EmergencyForm; setForm: (f: EmergencyForm) => void }) {
  const { t } = useTranslation();
  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 bg-white";
  const labelCls = "block text-xs font-medium text-gray-500 mb-1";
  const RELATIONSHIPS = [
    { value: "Parent", key: "portal.profile.rel_parent" },
    { value: "Sibling", key: "portal.profile.rel_sibling" },
    { value: "Spouse / Partner", key: "portal.profile.rel_spouse_partner" },
    { value: "Friend", key: "portal.profile.rel_friend" },
    { value: "Guardian", key: "portal.profile.rel_guardian" },
    { value: "Relative", key: "portal.profile.rel_relative" },
    { value: "Other", key: "portal.profile.rel_other" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className={labelCls}>{t("portal.profile.full_name", "Full Name")} <span className="text-red-500">*</span></label>
        <input type="text" value={form.name} placeholder={t("portal.profile.full_name_ph", "Contact's full name")}
          onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>{t("portal.profile.relationship", "Relationship")}</label>
        <div className="relative">
          <select value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })}
            className={`${inputCls} appearance-none pr-8`}>
            <option value="">{t("portal.profile.select_placeholder", "— Select —")}</option>
            {RELATIONSHIPS.map((r) => <option key={r.value} value={r.value}>{t(r.key, r.value)}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>
      <div>
        <label className={labelCls}>{t("portal.profile.phone", "Phone")}</label>
        <input type="tel" value={form.phone} placeholder="010-0000-0000"
          onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>{t("portal.profile.email", "Email")}</label>
        <input type="email" value={form.email} placeholder={t("portal.profile.email_ph", "contact@email.com")}
          onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
      </div>
      <div className="sm:col-span-2 flex items-center gap-2">
        <input type="checkbox" id="is_primary" checked={form.is_primary}
          onChange={(e) => setForm({ ...form, is_primary: e.target.checked })}
          className="h-4 w-4 rounded accent-red-600" />
        <label htmlFor="is_primary" className="text-xs text-gray-600 select-none cursor-pointer">
          {t("portal.profile.set_as_primary", "Set as primary emergency contact")}
        </label>
      </div>
    </div>
  );
}

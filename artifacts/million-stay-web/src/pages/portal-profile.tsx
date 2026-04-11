import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuthStore } from "@/lib/store";
import { PortalLayout } from "@/components/portal-layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { User, Lock, ChevronRight, Save, Eye, EyeOff, Phone, Globe } from "lucide-react";


export default function PortalProfile() {
  const [, setLocation] = useLocation();
  const { token, guest, setGuest, logout } = useAuthStore();
  const { toast } = useToast();
  const API = import.meta.env.VITE_API_URL ?? "";

  useEffect(() => {
    if (!token) setLocation("/login?redirect=/portal/profile");
  }, [token, setLocation]);

  const [profileForm, setProfileForm] = useState({
    first_name: guest?.first_name ?? "",
    last_name: guest?.last_name ?? "",
    phone: guest?.phone ?? "",
    nationality: "",
  });
  const [profileLoading, setProfileLoading] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  function handleUnauthorized() {
    logout();
    setLocation("/login?reason=session_expired");
  }

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/v1/guest/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (r.status === 401) { handleUnauthorized(); return; }
        const j = await r.json();
        if (j.data) {
          setProfileForm({
            first_name: j.data.first_name ?? "",
            last_name: j.data.last_name ?? "",
            phone: j.data.phone ?? "",
            nationality: j.data.nationality ?? "",
          });
        }
      })
      .catch(() => {});
  }, [token]);

  const handleProfileSave = async () => {
    setProfileLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/guest/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(profileForm),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      const j = await res.json();
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : (j.error?.message ?? "Update failed"));
      setGuest({
        ...guest!,
        first_name: j.data.first_name ?? null,
        last_name: j.data.last_name ?? null,
        phone: j.data.phone ?? null,
      });
      toast({ title: "Profile updated", description: "Your information has been saved." });
    } catch (e: unknown) {
      toast({ title: "Update failed", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSave = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (passwordForm.new_password.length < 8) {
      toast({ title: "Password too short", description: "At least 8 characters required.", variant: "destructive" });
      return;
    }
    setPasswordLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/guest/change-password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password,
        }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      const j = await res.json();
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : (j.error?.message ?? "Change failed"));
      toast({ title: "Password changed", description: "Your password has been updated." });
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!token) return null;

  return (
    <PortalLayout active="/portal/profile">
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <div className="space-y-6">
            {/* Personal info */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border p-6"
            >
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-semibold text-gray-800">Personal Information</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">First Name</label>
                  <input
                    type="text"
                    value={profileForm.first_name}
                    onChange={(e) => setProfileForm((f) => ({ ...f, first_name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Last Name</label>
                  <input
                    type="text"
                    value={profileForm.last_name}
                    onChange={(e) => setProfileForm((f) => ({ ...f, last_name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Phone Number
                  </label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+61 4xx xxx xxx"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                    <Globe className="h-3 w-3" /> Nationality
                  </label>
                  <input
                    type="text"
                    value={profileForm.nationality}
                    onChange={(e) => setProfileForm((f) => ({ ...f, nationality: e.target.value }))}
                    placeholder="e.g. Korean"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <Button
                  onClick={handleProfileSave}
                  disabled={profileLoading}
                  className="bg-primary hover:bg-primary/90 gap-2"
                >
                  <Save className="h-4 w-4" />
                  {profileLoading ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </motion.div>

            {/* Change password */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white rounded-2xl border p-6"
            >
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                  <Lock className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-semibold text-gray-800">Change Password</h2>
              </div>

              <div className="space-y-4 max-w-sm">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrent ? "text" : "password"}
                      value={passwordForm.current_password}
                      onChange={(e) => setPasswordForm((f) => ({ ...f, current_password: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">New Password</label>
                  <div className="relative">
                    <input
                      type={showNew ? "text" : "password"}
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm((f) => ({ ...f, new_password: e.target.value }))}
                      placeholder="Minimum 8 characters"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordForm.new_password.length > 0 && (
                    <div className="flex gap-1 mt-1.5">
                      {[8, 12, 16].map((len) => (
                        <div
                          key={len}
                          className={`flex-1 h-1 rounded-full transition-colors ${
                            passwordForm.new_password.length >= len ? "bg-primary" : "bg-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, confirm_password: e.target.value }))}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                      passwordForm.confirm_password && passwordForm.confirm_password !== passwordForm.new_password
                        ? "border-red-300 focus:border-red-400"
                        : "border-gray-200 focus:border-primary"
                    }`}
                  />
                  {passwordForm.confirm_password && passwordForm.confirm_password !== passwordForm.new_password && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>
              </div>

              <div className="mt-5 flex justify-start">
                <Button
                  onClick={handlePasswordSave}
                  disabled={passwordLoading || !passwordForm.current_password || !passwordForm.new_password}
                  variant="outline"
                  className="gap-2 border-primary text-primary hover:bg-orange-50"
                >
                  <Lock className="h-4 w-4" />
                  {passwordLoading ? "Changing…" : "Change Password"}
                </Button>
              </div>
            </motion.div>

            {/* Email (read-only) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-4"
            >
              <p className="text-xs text-gray-400 font-medium">Email address (cannot be changed)</p>
              <p className="text-sm font-semibold text-gray-700 mt-0.5">{guest?.email}</p>
            </motion.div>
        </div>
      </div>
    </PortalLayout>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Mail, Phone, Save, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getMyProfile, updateMyProfile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function Profile() {
  const { refresh } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: getMyProfile,
  });

  const profile = data?.data;

  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Sync state when profile loads
  if (profile && !firstName && !lastName && !phone) {
    setFirstName(profile.first_name ?? "");
    setLastName(profile.last_name ?? "");
    setPhone(profile.phone ?? "");
  }

  const updateMutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: async () => {
      setSaved(true);
      setSaveError("");
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      await refresh();
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: Error) => {
      setSaveError(err.message);
    },
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    setSaveError("");
    updateMutation.mutate({
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      phone: phone || undefined,
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Manage your personal information</p>
      </div>

      {/* Avatar + Email */}
      <div className="bg-card border rounded-xl p-5 mb-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
          {(profile?.first_name?.[0] ?? profile?.email?.[0] ?? "G").toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-lg">
            {[profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Guest"}
          </p>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="w-3.5 h-3.5" />
            <span>{profile?.email}</span>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <div className="bg-card border rounded-xl p-5">
        <h2 className="font-semibold text-sm mb-4 flex items-center gap-1.5">
          <User className="w-4 h-4 text-primary" />
          Personal Information
        </h2>

        {saved && (
          <Alert className="mb-4 border-green-200 bg-green-50">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <AlertDescription className="text-green-700 text-sm">Profile updated successfully.</AlertDescription>
          </Alert>
        )}

        {saveError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="text-sm">{saveError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              value={profile?.email ?? ""}
              disabled
              className="mt-1.5 bg-muted/50 text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground mt-1">Email address cannot be changed.</p>
          </div>

          <div>
            <Label htmlFor="phone">Phone number</Label>
            <div className="relative mt-1.5">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+61 400 000 000"
                className="pl-9"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Save Changes</>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Account Info */}
      {profile?.account && (
        <div className="bg-card border rounded-xl p-5 mt-4">
          <h2 className="font-semibold text-sm mb-4">Account Details</h2>
          <div className="space-y-2 text-sm">
            {profile.account.name && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-24 shrink-0">Name</span>
                <span>{profile.account.name}</span>
              </div>
            )}
            {profile.account.address_line1 && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-24 shrink-0">Address</span>
                <span>
                  {[
                    profile.account.address_line1,
                    profile.account.address_suburb,
                    profile.account.address_state,
                    profile.account.address_postcode,
                  ].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Joined Date */}
      {profile?.created_at && (
        <p className="text-xs text-muted-foreground text-center mt-6">
          Member since {new Date(profile.created_at).toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
        </p>
      )}
    </div>
  );
}
